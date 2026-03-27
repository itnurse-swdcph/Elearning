// เปลี่ยน URL ตรงนี้เป็น Web App URL ที่ได้จาก Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbxlfD-5saP7FtUX_YxuBe3gowToA38b0qc0jW5JuWjMN9XotTlqRfc0LuaWtibYNwMp1Q/exec'; 

// ================= UI Utilities =================
function getDriveImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/300x180?text=Course+Cover';
    
    // ตรวจสอบว่าเป็นลิงก์ Drive หรือไม่
    const match = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (match && match[1]) {
        // ใช้ thumbnail endpoint ของ Google ซึ่งจะดึงรูปมาโชว์ได้ 100%
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
    return url;
}
function showLoader() { document.getElementById('loader').classList.remove('hidden'); }
function hideLoader() { document.getElementById('loader').classList.add('hidden'); }
function showAlert(title, message) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    document.getElementById('customAlert').classList.remove('hidden');
}
function closeAlert() { document.getElementById('customAlert').classList.add('hidden'); }
function toggleAuth() {
    document.getElementById('loginForm').classList.toggle('hidden');
    document.getElementById('registerForm').classList.toggle('hidden');
}

// ================= API Caller =================
async function callAPI(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, payload: payload })
        });
        return await response.json();
    } catch (error) {
        return { status: 'error', message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
    }
}

// ================= Authentication =================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const payload = {
        email: document.getElementById('loginEmail').value,
        password: document.getElementById('loginPassword').value
    };
    const res = await callAPI('login', payload);
    hideLoader();

    if (res.status === 'success') {
        // บันทึก Session ลง LocalStorage (จดจำการเข้าสู่ระบบ)
        localStorage.setItem('swd_user', JSON.stringify(res.user));
        initApp();
    } else {
        showAlert('ข้อผิดพลาด', res.message);
    }
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const payload = {
        name: document.getElementById('regName').value,
        position: document.getElementById('regPosition').value,
        department: document.getElementById('regDept').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('regPassword').value
    };
    const res = await callAPI('register', payload);
    hideLoader();

    if (res.status === 'success') {
        localStorage.setItem('swd_user', JSON.stringify(res.user));
        initApp();
    } else {
        showAlert('ข้อผิดพลาด', res.message);
    }
});

function logout() {
    localStorage.removeItem('swd_user');
    checkSession();
}

// ================= App Logic =================
function checkSession() {
    const user = localStorage.getItem('swd_user');
    if (user) {
        initApp();
    } else {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
    }
}

async function initApp() {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    
    // อัปเดตข้อมูลผู้ใช้ใน Sidebar
    document.getElementById('userNameDisplay').innerText = user.name;
    document.getElementById('userDeptDisplay').innerText = user.department;
    document.getElementById('totalHoursDisplay').innerText = user.hours || 0;

    // เช็คสิทธิ์ Admin
    if (user.role === 'admin') {
        document.getElementById('adminBtn').classList.remove('hidden');
    } else {
        document.getElementById('adminBtn').classList.add('hidden');
    }

    // โหลดหลักสูตรเข้า Dashboard
    loadCourses();
}
function switchUserTab(tabId, element) {
    // 1. ซ่อนทุก Tab
    const tabs = document.querySelectorAll('.user-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    // 2. ลบแถบสี Active ออกจากเมนูทั้งหมด
    const menus = document.querySelectorAll('#userMenu li');
    menus.forEach(menu => menu.classList.remove('active'));
    
    // 3. โชว์ Tab ที่เลือก และไฮไลท์เมนู
    document.getElementById(tabId).classList.remove('hidden');
    element.classList.add('active');

    // โหลดข้อมูลเพิ่มถ้ากดเข้าหน้าประวัติ
    if(tabId === 'historyTab') {
        loadTrainingHistory();
    }
}

// ฟังก์ชันโหลดประวัติลงตาราง Portfolio
async function loadTrainingHistory() {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const tbody = document.getElementById('historyTableBody');
    
    // โชว์ข้อความกำลังโหลด
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">กำลังดึงข้อมูลประวัติการอบรม...</td></tr>';
    
    // เรียก API ไปดึงข้อมูล
    const res = await callAPI('getUserHistory', { user_id: user.id });
    
    if (res.status === 'success') {
        tbody.innerHTML = ''; // ล้างตาราง
        
        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">ยังไม่มีประวัติการอบรมในระบบครับ</td></tr>';
            return;
        }
        
        // วนลูปสร้างแถวในตาราง
        res.data.forEach(item => {
            // เช็คว่ามีลิงก์ใบประกาศไหม ถ้ามีให้สร้างปุ่ม ถ้าไม่มีให้ขึ้นข้อความ
            const certBtn = item.cert_url && item.cert_url.trim() !== '' 
                ? `<a href="${item.cert_url}" target="_blank" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.85rem;"><i class="fas fa-file-pdf text-danger"></i> ดูใบประกาศ</a>`
                : '<span style="color: #94a3b8; font-size: 0.85rem;">ไม่มีใบประกาศ</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td>${item.date || '-'}</td>
                    <td><strong>${item.title}</strong></td>
                    <td><span class="badge-hours" style="background: #f1f5f9; color: var(--text-light); box-shadow: none;">${item.type}</span></td>
                    <td>${item.hours}</td>
                    <td>${certBtn}</td>
                </tr>
            `;
        });
        
        // อัปเดตตัวเลขจำนวนใบประกาศในหน้า Dashboard ด้วย (โบนัส)
        const certCount = res.data.filter(i => i.cert_url).length;
        document.querySelector('.fa-certificate').nextElementSibling.querySelector('.stat-number').innerText = certCount;
        
    } else {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #EF4444;">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่</td></tr>';
    }
}
// เพิ่มตัวแปรนี้ไว้เก็บข้อมูลหลักสูตรชั่วคราว
let globalCourses = []; 

async function loadCourses() {
    showLoader();
    const res = await callAPI('getCourses', {});
    hideLoader();

    const grid = document.getElementById('courseGrid');
    grid.innerHTML = '';

    if (res.status === 'success' && res.data.length > 0) {
        // เก็บข้อมูลที่โหลดมาครั้งแรกใส่ตัวแปรไว้ จะได้ไม่ต้องโหลดซ้ำ
        globalCourses = res.data; 

        res.data.forEach(course => {
            const imgUrl = getDriveImageUrl(course.image);
            const html = `
                <div class="course-card">
                    <img src="${imgUrl}" alt="Course Cover" class="course-img" onerror="this.src='https://via.placeholder.com/300x180?text=Image+Error'">
                    <div class="course-info">
                        <h4 class="course-title">${course.title}</h4>
                        <div class="course-meta">
                            <span><i class="fas fa-hospital"></i> ${course.organizer}</span>
                            <span><i class="fas fa-clock"></i> ${course.hours} ชั่วโมง</span>
                            <span><i class="fas fa-users"></i> ลงทะเบียนแล้ว ${course.enrolled} คน</span>
                        </div>
                        <button class="btn btn-primary w-100" onclick="enrollCourse('${course.id}')">ลงทะเบียนเรียน</button>
                    </div>
                </div>
            `;
            grid.innerHTML += html;
        });
    } else {
        grid.innerHTML = '<p>ยังไม่มีหลักสูตรเปิดสอนในขณะนี้</p>';
    }
}

// ตรวจสอบสถานะการล็อกอินเมื่อเปิดหน้าเว็บ
window.onload = checkSession;
// ================= Admin Logic =================

function goToAdminPanel() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    loadAdminReport(); // โหลดข้อมูลตารางสถิติทันทีที่เข้าหน้าแอดมิน
}

function exitAdmin() {
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
}

function switchAdminTab(tabId) {
    // ซ่อนทุก Tab
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    // ลบ Active menu
    const menus = document.querySelectorAll('.sidebar-menu li');
    menus.forEach(menu => menu.classList.remove('active'));
    
    // โชว์ Tab ที่เลือก
    document.getElementById(tabId).classList.remove('hidden');
    event.currentTarget.classList.add('active');
    
    if(tabId === 'reportTab') loadAdminReport();
    if(tabId === 'courseMgtTab') {
        resetCourseForm();
        loadAdminCoursesTable(); 
    }
    // --- เพิ่ม 3 บรรทัดนี้เข้าไป ---
    if(tabId === 'examMgtTab') {
        initExamAdmin(); // เรียกฟังก์ชันดึงรายชื่อวิชามาใส่ Dropdown
    }
    // -------------------------
}

async function loadAdminReport() {
    showLoader();
    const res = await callAPI('getAdminReport', {});
    hideLoader();
    
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    
    if (res.status === 'success') {
        res.data.forEach(row => {
            const statusBadge = row.status === 'ผ่านเกณฑ์' ? 
                '<span class="badge-pass">ผ่านเกณฑ์</span>' : 
                '<span class="badge-fail">ยังไม่ผ่าน</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td>${row.name}</td>
                    <td>${row.department}</td>
                    <td>${row.internal}</td>
                    <td>${row.external}</td>
                    <td>${row.totalHours}</td>
                    <td><strong>${row.totalDays}</strong></td>
                    <td>${statusBadge}</td>
                </tr>
            `;
        });
    } else {
        showAlert('แจ้งเตือน', 'ไม่สามารถโหลดข้อมูลสถิติได้');
    }
}

// ฟังก์ชัน Export Excel อย่างง่ายด้วย JS
function exportToExcel() {
    let table = document.querySelector(".admin-table");
    let html = table.outerHTML.replace(/ /g, '%20');
    let a = document.createElement('a');
    a.href = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + html;
    a.download = 'training_report_swd.xls';
    a.click();
}

// ================= Course Management Logic =================

let adminCoursesData = [];

// โหลดรายชื่อหลักสูตรในตารางแอดมิน
async function loadAdminCoursesTable() {
    showLoader();
    const res = await callAPI('getAdminCourses', {});
    hideLoader();

    const tbody = document.getElementById('adminCourseListBody');
    tbody.innerHTML = '';

    if (res.status === 'success') {
        adminCoursesData = res.data; 
        res.data.forEach(course => {
            // แปลงชั่วโมงกลับมาแสดงผล
            const hr = Math.floor(course.hours);
            const min = Math.round((course.hours - hr) * 60);
            const timeText = min > 0 ? `${hr} ชม. ${min} นาที` : `${hr} ชม.`;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${course.title}</strong></td>
                    <td>${course.organizer}</td>
                    <td>${timeText}</td>
                    <td>
                        <button class="btn btn-action btn-edit" onclick="editCourse('${course.course_id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                    </td>
                </tr>
            `;
        });
    }
}

// ฟังก์ชันเพิ่ม/ลบ กล่องกรอกข้อมูลวิดีโอ
function addUnitField(title = '', video = '', time = '') {
    const container = document.getElementById('unitsContainer');
    const unitHTML = `
        <div class="unit-box">
            <div class="unit-row">
                <input type="text" class="u-title" placeholder="ชื่อหน่วย (เช่น EP.1)" value="${title}" required>
                <input type="text" class="u-video" placeholder="URL วิดีโอ" value="${video}" required>
                <input type="number" class="u-time" placeholder="เวลาดูขั้นต่ำ (นาที)" value="${time}" required>
                <button type="button" class="btn-remove-unit" onclick="removeUnitField(this)"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', unitHTML);
}

function removeUnitField(btn) {
    btn.closest('.unit-box').remove();
}

// นำข้อมูลลงฟอร์มเพื่อเตรียมแก้ไข
function editCourse(courseId) {
    const course = adminCoursesData.find(c => c.course_id === courseId);
    if(!course) return;

    // เปลี่ยนหน้าตา UI
    document.getElementById('courseFormTitle').innerHTML = '<i class="fas fa-edit"></i> แก้ไขข้อมูลหลักสูตร';
    document.getElementById('btnSubmitCourse').innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข';
    document.getElementById('btnCancelEdit').classList.remove('hidden');
    document.getElementById('editCourseId').value = course.course_id;

    document.getElementById('cTitle').value = course.title;
    document.getElementById('cOrganizer').value = course.organizer;
    document.getElementById('cPassingScore').value = course.passing_score;
    document.getElementById('cCover').value = course.cover_image;
    document.getElementById('cCertTemplate').value = course.cert_template || '';

    const hr = Math.floor(course.hours);
    const min = Math.round((course.hours - hr) * 60);
    document.getElementById('cHours').value = hr;
    document.getElementById('cMins').value = min;

    document.getElementById('unitsContainer').innerHTML = '';
    const units = JSON.parse(course.units || '[]');
    if(units.length === 0) {
        addUnitField();
    } else {
        units.forEach(u => addUnitField(u.title, u.video_url, u.min_time));
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ล้างฟอร์มกลับเป็นโหมดเพิ่มหลักสูตร
function resetCourseForm() {
    document.getElementById('addCourseForm').reset();
    document.getElementById('courseFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> เพิ่มหลักสูตรใหม่';
    document.getElementById('btnSubmitCourse').innerHTML = '<i class="fas fa-save"></i> บันทึกหลักสูตร';
    document.getElementById('btnCancelEdit').classList.add('hidden');
    document.getElementById('editCourseId').value = '';
    
    document.getElementById('unitsContainer').innerHTML = '';
    addUnitField(); // สร้างช่องว่างไว้ 1 ช่องเสมอ
}

// ฟังก์ชันบันทึกหลักสูตร (จัดการทั้งตอนเพิ่มใหม่ และตอนแก้ไข)
document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 1. ดึงข้อมูลหน่วยย่อย
    const unitBoxes = document.querySelectorAll('.unit-box');
    let unitsData = [];
    unitBoxes.forEach((box) => {
        unitsData.push({
            title: box.querySelector('.u-title').value,
            video_url: box.querySelector('.u-video').value,
            min_time: parseInt(box.querySelector('.u-time').value)
        });
    });

    // 2. คำนวณชั่วโมงเป็นทศนิยม
    const hr = parseFloat(document.getElementById('cHours').value) || 0;
    const min = parseFloat(document.getElementById('cMins').value) || 0;
    const totalDecimalHours = +(hr + (min / 60)).toFixed(2);

    // 3. เตรียม Payload
    const payload = {
        title: document.getElementById('cTitle').value,
        organizer: document.getElementById('cOrganizer').value,
        hours: totalDecimalHours,
        passing_score: document.getElementById('cPassingScore').value,
        cover_image: document.getElementById('cCover').value,
        cert_template: document.getElementById('cCertTemplate').value,
        units: unitsData 
    };
    
    // 4. เช็คว่าเป็นโหมดเพิ่มใหม่ หรือ โหมดแก้ไข
    const editId = document.getElementById('editCourseId').value;
    let actionName = 'addCourse';
    if (editId !== '') {
        actionName = 'updateCourse';
        payload.course_id = editId;
    }
    
    showLoader();
    const res = await callAPI(actionName, payload);
    hideLoader();
    
    if(res.status === 'success') {
        showAlert('สำเร็จ', res.message);
        resetCourseForm();
        loadAdminCoursesTable(); 
    } else {
        showAlert('ผิดพลาด', res.message);
    }
});
// ================= Classroom & Video Tracker Logic =================

let ytPlayer;
let currentClassCourse = null;
let currentUnits = [];
let completedUnits = []; 
let resumeTimes = {}; // ตัวแปรใหม่สำหรับเก็บเวลาที่ดูค้างไว้
let activeUnitIndex = 0;
let maxTimeWatched = 0; 
let trackerInterval;

function extractYTId(url) {
    if(!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 1. ฟังก์ชันบันทึกความคืบหน้า (ทั้งตอนดูจบ และตอนกดออก)
function saveProgressToDB() {
    if(!currentClassCourse) return;
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    // อัปเดตเวลาล่าสุดก่อนส่ง
    if(ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
        maxTimeWatched = Math.max(maxTimeWatched, ytPlayer.getCurrentTime());
    }
    resumeTimes[activeUnitIndex] = maxTimeWatched; 
    
    callAPI('updateProgress', {
        user_id: user.id,
        course_id: currentClassCourse.id,
        progress_data: { completed: completedUnits, resumeTimes: resumeTimes }
    });
}

// 2. กดเข้าเรียน
async function enrollCourse(courseId) {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    const targetCourse = globalCourses.find(c => c.id === courseId);
    if(!targetCourse) return showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลหลักสูตรนี้');

    showLoader();
    const enrollRes = await callAPI('enrollCourse', { user_id: user.id, course_id: courseId });
    hideLoader();

    if(enrollRes.status === 'success') {
        // ดึงข้อมูลการเรียนจาก DB
        const progData = enrollRes.data || {}; 
        completedUnits = progData.completed || [];
        resumeTimes = progData.resumeTimes || {};
        currentClassCourse = targetCourse;
        
        try { currentUnits = JSON.parse(targetCourse.units || '[]'); } 
        catch(e) { currentUnits = []; }
        
        if(currentUnits.length === 0) return showAlert('แจ้งเตือน', 'หลักสูตรนี้ยังไม่มีวิดีโอเนื้อหาครับ');
        
        // --- ส่วนที่แก้ไข: เช็คว่าทำ Pre-test หรือยัง ---
        // ถ้าค่า preTestScore ยังไม่มี แสดงว่าเพิ่งเข้ามาครั้งแรก ให้ไปทำข้อสอบก่อน
        if (progData.preTestScore === undefined || progData.preTestScore === null) {
            startQuiz('pre'); 
        } else {
            // ถ้าทำข้อสอบก่อนเรียนไปแล้ว ให้เข้าห้องเรียนไปดูวิดีโอต่อได้เลย
            enterClassroom();
        }
        // ----------------------------------------
        
    } else {
        showAlert('ข้อผิดพลาดจากระบบ', enrollRes.message);
    }
}

function enterClassroom() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.remove('hidden');
    document.getElementById('classroomCourseTitle').innerText = currentClassCourse.title;
    
    renderPlaylist();
    
    // หา EP ถัดไปที่ยังไม่จบมาเล่นก่อน
    let nextUnfinishedUnit = 0;
    for(let i=0; i<currentUnits.length; i++) {
        if(!completedUnits.includes(i)) {
            nextUnfinishedUnit = i;
            break;
        }
    }
    loadVideo(nextUnfinishedUnit);
}

// 3. ปิดหน้าห้องเรียน (ส่งข้อมูลเวลาไปบันทึก)
function exitClassroom() {
    clearInterval(trackerInterval);
    saveProgressToDB(); // บันทึกเวลาที่ดูค้างไว้ลง Google Sheets ทันที
    
    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    document.getElementById('classroomSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
}

function renderPlaylist() {
    const list = document.getElementById('unitPlaylist');
    list.innerHTML = '';
    let totalDone = 0;

    currentUnits.forEach((unit, index) => {
        const isDone = completedUnits.includes(index);
        const isActive = index === activeUnitIndex;
        const isLocked = index > 0 && !completedUnits.includes(index - 1);
        
        if(isDone) totalDone++;

        let statusIcon = isDone ? '<i class="fas fa-check-circle" style="color: #10B981; font-size: 1.2rem;"></i>' : 
                         (isLocked ? '<i class="fas fa-lock" style="color: #94a3b8;"></i>' : '<i class="fas fa-play-circle" style="color: #94a3b8;"></i>');
        
        let liStyle = `padding: 15px; border: 1px solid #eee; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; transition: all 0.3s;`;
        if (isActive) liStyle += `border-left: 4px solid var(--primary-color); background-color: #f0fdf4; cursor: default;`;
        else if (isLocked) liStyle += `opacity: 0.6; background-color: #f8fafc; cursor: not-allowed;`;
        else liStyle += `cursor: pointer;`;

        list.innerHTML += `
            <li style="${liStyle}" onclick="${(isLocked || isActive) ? '' : `loadVideo(${index})`}">
                <div>
                    <strong style="color: ${isActive ? 'var(--primary-color)' : 'inherit'}">${unit.title}</strong><br>
                    <small style="color: #64748b;"><i class="fas fa-clock"></i> ${unit.min_time} นาที</small>
                </div>
                ${statusIcon}
            </li>
        `;
    });

    const percent = Math.round((totalDone / currentUnits.length) * 100) || 0;
    document.getElementById('courseProgressFill').style.width = percent + '%';
    document.getElementById('progressText').innerText = `สำเร็จ ${percent}%`;

    if(percent === 100) document.getElementById('btnTakeExam').classList.remove('hidden');
}

// 4. โหลดวิดีโอพร้อม Resume เวลา
function loadVideo(index) {
    // ถ้ามีการเปลี่ยน EP ให้เซฟเวลาของ EP เดิมก่อน
    if (activeUnitIndex !== index && currentClassCourse) {
        saveProgressToDB();
    }

    activeUnitIndex = index;
    const unit = currentUnits[index];
    const videoId = extractYTId(unit.video_url);
    
    document.getElementById('currentUnitTitle').innerText = unit.title;
    
    // ดึงเวลาที่ดูค้างไว้ (ผสมกันระหว่าง Local Storage ป้องกันไฟดับ และ DB)
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const cacheKey = `resume_${user.id}_${currentClassCourse.id}_${index}`;
    let localSavedTime = parseFloat(localStorage.getItem(cacheKey)) || 0;
    let dbSavedTime = resumeTimes[index] || 0;
    maxTimeWatched = Math.max(localSavedTime, dbSavedTime);

    renderPlaylist(); 

    if(!videoId) return showAlert('ข้อผิดพลาด', 'ลิงก์วิดีโอไม่ถูกต้อง');

    if(!ytPlayer) {
        ytPlayer = new YT.Player('youtubePlayer', {
            height: '100%', width: '100%',
            videoId: videoId,
            playerVars: { 
                'controls': 1, 'disablekb': 1, 'rel': 0, 
                'start': Math.floor(maxTimeWatched) // สั่งให้เริ่มเล่นจากจุดที่ดูค้างไว้
            },
            events: { 'onStateChange': onPlayerStateChange }
        });
    } else {
        // ใช้คำสั่งโหลดวิดีโอแบบระบุวินาทีเริ่มต้น
        ytPlayer.loadVideoById({videoId: videoId, startSeconds: Math.floor(maxTimeWatched)});
    }
}

// 5. ระบบตรวจจับเวลาและจัดการตอนจบ
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        trackerInterval = setInterval(() => {
            const currentTime = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();
            
            // เช็คการแอบกรอวิดีโอ
            if (currentTime > maxTimeWatched + 3) {
                // ถ้า EP นี้ดูจบแล้ว (Done) ให้ดูอิสระได้ ไม่ล็อก!
                if (completedUnits.includes(activeUnitIndex)) {
                    maxTimeWatched = currentTime; 
                } else {
                    // ถ้ายังไม่จบ ดึงกลับมาที่เดิม
                    ytPlayer.seekTo(maxTimeWatched); 
                    showAlert('กรุณารับชมวิดีโอให้จบ', 'ระบบล็อกการเลื่อนข้ามสำหรับ EP ที่ยังเรียนไม่จบครับ');
                }
            } else {
                maxTimeWatched = Math.max(maxTimeWatched, currentTime);
            }

            // แบคอัปเวลาลงเครื่องอัตโนมัติทุกๆ 5 วินาที (กันไฟดับ/เผลอปิดแท็บ)
            if (Math.floor(currentTime) % 5 === 0) {
                const user = JSON.parse(localStorage.getItem('swd_user'));
                const cacheKey = `resume_${user.id}_${currentClassCourse.id}_${activeUnitIndex}`;
                localStorage.setItem(cacheKey, maxTimeWatched);
            }

            // จบ EP (เหลือไม่ถึง 2 วิสุดท้าย)
            if (duration > 0 && currentTime >= duration - 2) {
                markUnitComplete(activeUnitIndex);
            }
        }, 1000);
    } else {
        clearInterval(trackerInterval); 
    }
}

// 6. บันทึกเมื่อจบหน่วย
function markUnitComplete(index) {
    if(!completedUnits.includes(index)) {
        completedUnits.push(index);
        saveProgressToDB(); // บันทึกว่าจบแล้ว
        renderPlaylist();
        showAlert('ยอดเยี่ยม!', `คุณเรียน ${currentUnits[index].title} จบแล้ว!`);
    }
}

function startExam() {
    startQuiz('post');
}
// ================= Admin: Exam Management =================
let adminCurrentExams = [];

// โหลดรายชื่อหลักสูตรใส่ Dropdown (เรียกใช้ตอนเข้าหน้าแอดมิน)
// โหลดรายชื่อหลักสูตรใส่ Dropdown (ฉบับดึงข้อมูลสดจากฐานข้อมูล)
async function initExamAdmin() {
    const select = document.getElementById('examCourseSelect');
    select.innerHTML = '<option value="">-- กำลังโหลดหลักสูตร... --</option>';
    
    // สั่งดึงข้อมูลหลักสูตรทั้งหมดของแอดมิน
    const res = await callAPI('getAdminCourses', {});
    
    select.innerHTML = '<option value="">-- กรุณาเลือกหลักสูตร --</option>';
    
    if (res.status === 'success' && res.data.length > 0) {
        adminCoursesData = res.data; // อัปเดตข้อมูลในความจำเครื่อง
        res.data.forEach(c => {
            select.innerHTML += `<option value="${c.course_id}">${c.title}</option>`;
        });
    } else {
        select.innerHTML = '<option value="">-- ยังไม่มีหลักสูตรในระบบ --</option>';
    }
}

// เมื่อแอดมินเลือกหลักสูตร
async function loadCourseExamsForAdmin() {
    const courseId = document.getElementById('examCourseSelect').value;
    const builder = document.getElementById('examBuilderSection');
    if(!courseId) { builder.classList.add('hidden'); return; }
    
    showLoader();
    const res = await callAPI('getCourseExams', { course_id: courseId });
    hideLoader();
    
    builder.classList.remove('hidden');
    document.getElementById('questionsContainer').innerHTML = '';
    
    if(res.status === 'success' && res.data.length > 0) {
        res.data.forEach((ex, idx) => addQuestionBox(ex, idx + 1));
    } else {
        addQuestionBox(); // โชว์กล่องเปล่า 1 กล่อง
    }
}

// สร้างกล่องพิมพ์ข้อสอบ
function addQuestionBox(data = null, num = null) {
    const container = document.getElementById('questionsContainer');
    const qCount = container.children.length + 1;
    const qNum = num || qCount;
    
    const d = data || { question: '', a: '', b: '', c: '', d: '', answer: 'A' };
    
    const html = `
        <div class="exam-box">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
            <h5 style="margin-bottom: 10px; color: var(--primary-color);">ข้อที่ ${qNum}</h5>
            <input type="text" class="q-text" placeholder="พิมพ์คำถาม..." value="${d.question}" style="width: 100%; padding: 10px; margin-bottom: 10px;" required>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="A" ${d.answer === 'A' ? 'checked' : ''}> ก. <input type="text" class="q-a" placeholder="ตัวเลือก ก." value="${d.a}" style="width: 100%; padding: 8px;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="B" ${d.answer === 'B' ? 'checked' : ''}> ข. <input type="text" class="q-b" placeholder="ตัวเลือก ข." value="${d.b}" style="width: 100%; padding: 8px;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="C" ${d.answer === 'C' ? 'checked' : ''}> ค. <input type="text" class="q-c" placeholder="ตัวเลือก ค." value="${d.c}" style="width: 100%; padding: 8px;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="D" ${d.answer === 'D' ? 'checked' : ''}> ง. <input type="text" class="q-d" placeholder="ตัวเลือก ง." value="${d.d}" style="width: 100%; padding: 8px;">
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// แอดมินกดบันทึกข้อสอบ
async function saveExamsToDB() {
    const courseId = document.getElementById('examCourseSelect').value;
    if(!courseId) return showAlert('แจ้งเตือน', 'กรุณาเลือกหลักสูตรก่อนบันทึก');
    
    const boxes = document.querySelectorAll('.exam-box');
    let examsData = [];
    
    boxes.forEach(box => {
        const checkedAns = box.querySelector('input[type="radio"]:checked');
        examsData.push({
            question: box.querySelector('.q-text').value,
            a: box.querySelector('.q-a').value,
            b: box.querySelector('.q-b').value,
            c: box.querySelector('.q-c').value,
            d: box.querySelector('.q-d').value,
            answer: checkedAns ? checkedAns.value : 'A'
        });
    });
    
    if(examsData.length === 0) return showAlert('แจ้งเตือน', 'ต้องมีข้อสอบอย่างน้อย 1 ข้อ');
    
    showLoader();
    const res = await callAPI('saveCourseExams', { course_id: courseId, exams: examsData });
    hideLoader();
    
    if(res.status === 'success') showAlert('สำเร็จ', 'บันทึกคลังข้อสอบเรียบร้อยแล้ว');
}

// *อย่าลืมไปเพิ่มการเรียก initExamAdmin() ไว้ในฟังก์ชัน switchAdminTab(tabId) ด้วยนะครับ (เมื่อ tabId === 'examMgtTab')*


// ================= User: Quiz Taking System =================
let userQuizData = [];
let currentQIndex = 0;
let userAnswers = {}; // เก็บคำตอบ { 0: 'A', 1: 'C' }
let activeQuizType = 'pre'; // 'pre' หรือ 'post'

// เริ่มทำข้อสอบ (เรียกจากหน้า Dashboard หรือ ห้องเรียน)
async function startQuiz(type) {
    activeQuizType = type;
    showLoader();
    
    // ดึงข้อสอบ
    const res = await callAPI('getCourseExams', { course_id: currentClassCourse.id });
    hideLoader();
    
    if(res.status === 'success' && res.data.length > 0) {
        userQuizData = res.data;
        currentQIndex = 0;
        userAnswers = {};
        
        document.getElementById('quizTitle').innerText = type === 'pre' ? 'แบบทดสอบก่อนเรียน (Pre-test)' : 'แบบทดสอบหลังเรียน (Post-test)';
        document.getElementById('quizSubtitle').innerText = `วิชา: ${currentClassCourse.title}`;
        
        document.getElementById('quizSection').classList.remove('hidden');
        document.getElementById('quizContent').classList.remove('hidden');
        document.getElementById('quizResult').classList.add('hidden');
        
        renderQuestion();
    } else {
        showAlert('แจ้งเตือน', 'หลักสูตรนี้ยังไม่มีการตั้งค่าแบบทดสอบครับ กรุณาข้ามไปเรียนได้เลย');
        if(type === 'pre') enterClassroom(); // ถ้าไม่มีข้อสอบ ให้เข้าเรียนเลย
    }
}

// แสดงคำถามทีละข้อ
function renderQuestion() {
    const q = userQuizData[currentQIndex];
    document.getElementById('quizProgressText').innerText = `ข้อที่ ${currentQIndex + 1} / ${userQuizData.length}`;
    document.getElementById('questionText').innerText = `${currentQIndex + 1}. ${q.question}`;
    
    const ans = userAnswers[currentQIndex] || '';
    
    const optionsHtml = `
        <label class="option-label ${ans==='A'?'selected':''}" onclick="selectAnswer('A')">
            <input type="radio" name="userAns" value="A" ${ans==='A'?'checked':''}> ก. ${q.a}
        </label>
        <label class="option-label ${ans==='B'?'selected':''}" onclick="selectAnswer('B')">
            <input type="radio" name="userAns" value="B" ${ans==='B'?'checked':''}> ข. ${q.b}
        </label>
        <label class="option-label ${ans==='C'?'selected':''}" onclick="selectAnswer('C')">
            <input type="radio" name="userAns" value="C" ${ans==='C'?'checked':''}> ค. ${q.c}
        </label>
        <label class="option-label ${ans==='D'?'selected':''}" onclick="selectAnswer('D')">
            <input type="radio" name="userAns" value="D" ${ans==='D'?'checked':''}> ง. ${q.d}
        </label>
    `;
    document.getElementById('optionsContainer').innerHTML = optionsHtml;
    
    // จัดการปุ่ม
    if(currentQIndex === userQuizData.length - 1) {
        document.getElementById('btnNextQuestion').classList.add('hidden');
        document.getElementById('btnSubmitQuiz').classList.remove('hidden');
    } else {
        document.getElementById('btnNextQuestion').classList.remove('hidden');
        document.getElementById('btnSubmitQuiz').classList.add('hidden');
    }
}

// เลือกคำตอบ (ทำไฮไลท์สี)
function selectAnswer(val) {
    userAnswers[currentQIndex] = val;
    document.querySelectorAll('.option-label').forEach(el => el.classList.remove('selected'));
    document.querySelector(`input[value="${val}"]`).parentElement.classList.add('selected');
    document.querySelector(`input[value="${val}"]`).checked = true;
}

// กดไปข้อถัดไป
function nextQuestion() {
    if(!userAnswers[currentQIndex]) return showAlert('แจ้งเตือน', 'กรุณาเลือกคำตอบก่อนไปข้อถัดไป');
    currentQIndex++;
    renderQuestion();
}

// กดส่งคำตอบเพื่อตรวจ
async function submitQuizData() {
    if(!userAnswers[currentQIndex]) return showAlert('แจ้งเตือน', 'กรุณาเลือกคำตอบข้อสุดท้าย');
    
    let score = 0;
    userQuizData.forEach((q, idx) => {
        if(userAnswers[idx] === q.answer) score++;
    });
    
    const maxScore = userQuizData.length;
    const passingScoreReq = currentClassCourse.passing_score || 80; // ดึงเกณฑ์จากหลักสูตร (%)
    const userPercent = (score / maxScore) * 100;
    const isPassed = userPercent >= passingScoreReq;
    
    showLoader();
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    // ส่งข้อมูลไปบันทึก
    await callAPI('submitQuiz', {
        user_id: user.id,
        course_id: currentClassCourse.id,
        type: activeQuizType,
        score: score,
        is_passed: isPassed
    });
    hideLoader();
    
    // โชว์หน้าสรุปผล
    document.getElementById('quizContent').classList.add('hidden');
    const resBox = document.getElementById('quizResult');
    resBox.classList.remove('hidden');
    
    document.getElementById('resultScore').innerText = score;
    document.getElementById('resultTotal').innerText = maxScore;
    
    // ประกาศตัวแปรปุ่มดำเนินการต่อ เพื่อเรียกใช้ง่ายๆ
    const btnReturn = document.getElementById('btnReturnFromQuiz');
    btnReturn.classList.remove('hidden'); // ให้โชว์เป็นค่าเริ่มต้นไว้ก่อน
    
    if(activeQuizType === 'pre') {
        document.getElementById('resultTitle').innerText = 'ทำ Pre-test เสร็จสิ้น';
        document.getElementById('resultTitle').style.color = 'var(--text-main)';
        document.getElementById('resultIcon').className = 'fas fa-clipboard-check text-primary';
    } else {
        if(isPassed) {
            document.getElementById('resultTitle').style.color = '#10B981';
            document.getElementById('resultIcon').className = 'fas fa-check-circle';
            document.getElementById('resultIcon').style.color = '#10B981';
            
            // --- เริ่มต้นการสร้าง PDF ---
            document.getElementById('resultTitle').innerText = 'กำลังสร้างใบประกาศ... กรุณารอสักครู่';
            document.getElementById('btnDownloadCert').classList.add('hidden');
            
            btnReturn.classList.add('hidden'); // <--- 1. ซ่อนปุ่ม "ดำเนินการต่อ" ตรงนี้! ป้องกันคนกดออก
            
            const certRes = await callAPI('generateCert', {
                user_id: user.id,
                user_name: user.name,
                course_id: currentClassCourse.id
            });
            
            if(certRes.status === 'success') {
                document.getElementById('resultTitle').innerText = 'ยินดีด้วย! คุณสอบผ่าน';
                const btnCert = document.getElementById('btnDownloadCert');
                btnCert.href = certRes.pdf_url;
                btnCert.classList.remove('hidden'); // โชว์ปุ่มโหลด PDF
            } else {
                document.getElementById('resultTitle').innerText = 'สอบผ่าน (แต่พบปัญหาสร้างใบประกาศ)';
                console.error(certRes.message);
            }
            
            btnReturn.classList.remove('hidden'); // <--- 2. โชว์ปุ่ม "ดำเนินการต่อ" กลับมาเมื่อกระบวนการเสร็จสิ้น!
            // --------------------------
            
        } else {
            document.getElementById('resultTitle').innerText = 'เสียใจด้วย คุณสอบไม่ผ่านเกณฑ์';
            document.getElementById('resultTitle').style.color = '#EF4444';
            document.getElementById('resultIcon').className = 'fas fa-times-circle';
            document.getElementById('resultIcon').style.color = '#EF4444';
        }
    }
}

// ปิดหน้าข้อสอบและไปสเตปถัดไป
function closeQuiz() {
    document.getElementById('quizSection').classList.add('hidden');
    if(activeQuizType === 'pre') {
        enterClassroom(); // ทำ Pre เสร็จ เข้าเรียนต่อ
    } else {
        exitClassroom(); // ทำ Post เสร็จ กลับหน้าหลัก (ถ้าผ่าน ใบประกาศจะเด้งในอนาคต)
    }
}
