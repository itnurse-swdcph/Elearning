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

// ฟังก์ชันจำลองการโหลดประวัติ (เดี๋ยวเราจะเขียนเชื่อม API ภายหลัง)
function loadTrainingHistory() {
    // โค้ดส่วนนี้เดี๋ยวเราจะเขียนเพื่อดึงข้อมูลจาก Sheet: Enrollments และ External_Training มาโชว์ครับ
}
async function loadCourses() {
    showLoader();
    const res = await callAPI('getCourses', {});
    hideLoader();

    const grid = document.getElementById('courseGrid');
    grid.innerHTML = '';

    if (res.status === 'success' && res.data.length > 0) {
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
        // ถ้ากดมาหน้าจัดการหลักสูตร ให้ล้างฟอร์มและโหลดตารางรายชื่อ
        resetCourseForm();
        loadAdminCoursesTable(); 
    }
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
let activeUnitIndex = 0;
let maxTimeWatched = 0; 
let trackerInterval;

function extractYTId(url) {
    if(!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

async function enrollCourse(courseId) {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    showLoader();
    
    const courseRes = await callAPI('getCourses', {});
    const targetCourse = courseRes.data.find(c => c.id === courseId);
    
    if(!targetCourse) {
        hideLoader();
        showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลหลักสูตรนี้');
        return;
    }

    const enrollRes = await callAPI('enrollCourse', { user_id: user.id, course_id: courseId });
    hideLoader();

    if(enrollRes.status === 'success') {
        completedUnits = enrollRes.data.completed_units || [];
        currentClassCourse = targetCourse;
        
        try {
            currentUnits = JSON.parse(targetCourse.units || '[]');
        } catch(e) {
            currentUnits = [];
        }
        
        if(currentUnits.length === 0) {
            showAlert('แจ้งเตือน', 'หลักสูตรนี้ยังไม่มีวิดีโอเนื้อหาครับ');
            return;
        }

        enterClassroom();
    } else {
        // เพิ่มแจ้งเตือนกันเหนียว ถ้าระบบหลังบ้าน Error
        showAlert('ข้อผิดพลาดจากระบบ', enrollRes.message || 'ไม่สามารถเข้าสู่บทเรียนได้');
    }
}

function enterClassroom() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.remove('hidden');
    document.getElementById('classroomCourseTitle').innerText = currentClassCourse.title;
    
    renderPlaylist();
    
    let nextUnfinishedUnit = 0;
    for(let i=0; i<currentUnits.length; i++) {
        if(!completedUnits.includes(i)) {
            nextUnfinishedUnit = i;
            break;
        }
    }
    loadVideo(nextUnfinishedUnit);
}

function exitClassroom() {
    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    clearInterval(trackerInterval);
    document.getElementById('classroomSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    
    loadCourses(); 
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

    if(percent === 100) {
        document.getElementById('btnTakeExam').classList.remove('hidden');
    } else {
        document.getElementById('btnTakeExam').classList.add('hidden');
    }
}

function loadVideo(index) {
    activeUnitIndex = index;
    const unit = currentUnits[index];
    const videoId = extractYTId(unit.video_url);
    
    document.getElementById('currentUnitTitle').innerText = unit.title;
    maxTimeWatched = 0; 
    renderPlaylist(); 

    if(!videoId) {
        showAlert('ข้อผิดพลาด', 'ลิงก์วิดีโอไม่ถูกต้อง (รองรับเฉพาะ YouTube เท่านั้น)');
        return;
    }

    if(!ytPlayer) {
        ytPlayer = new YT.Player('youtubePlayer', {
            height: '100%', width: '100%',
            videoId: videoId,
            playerVars: { 'controls': 1, 'disablekb': 1, 'rel': 0 },
            events: { 'onStateChange': onPlayerStateChange }
        });
    } else {
        ytPlayer.loadVideoById(videoId);
    }
}

function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        trackerInterval = setInterval(() => {
            const currentTime = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();
            
            if (currentTime > maxTimeWatched + 3) {
                ytPlayer.seekTo(maxTimeWatched); 
                showAlert('กรุณารับชมวิดีโอให้จบ', 'ระบบล็อกการเลื่อนข้าม เพื่อให้แน่ใจว่าคุณได้รับเนื้อหาครบถ้วนครับ');
            } else {
                maxTimeWatched = Math.max(maxTimeWatched, currentTime);
            }

            if (duration > 0 && currentTime >= duration - 2) {
                markUnitComplete(activeUnitIndex);
            }
        }, 1000);
    } else {
        clearInterval(trackerInterval); 
    }
}

async function markUnitComplete(index) {
    if(!completedUnits.includes(index)) {
        completedUnits.push(index);
        renderPlaylist();
        
        const user = JSON.parse(localStorage.getItem('swd_user'));
        await callAPI('updateProgress', {
            user_id: user.id,
            course_id: currentClassCourse.id,
            completed_units: completedUnits
        });
        
        showAlert('ยอดเยี่ยม!', `คุณเรียน EP.${index+1} จบแล้ว!`);
    }
}

function startExam() {
    showAlert('เตรียมพร้อม', 'ระบบแบบทดสอบและใบประกาศ PDF จะอยู่ในขั้นตอนต่อไปครับ');
}
