// เปลี่ยน URL ตรงนี้เป็น Web App URL ที่ได้จาก Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbxlfD-5saP7FtUX_YxuBe3gowToA38b0qc0jW5JuWjMN9XotTlqRfc0LuaWtibYNwMp1Q/exec'; 

// ================= UI Utilities =================
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
    
    // Switch Views
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    
    // Set User Info
    document.getElementById('userNameDisplay').innerText = `สวัสดี, ${user.name}`;
    document.getElementById('totalHoursDisplay').innerText = `${user.hours || 0} ชม.`;

    // --- เพิ่มเงื่อนไขเช็คสิทธิ์ Admin ตรงนี้ครับ ---
    if (user.role === 'admin') {
        document.getElementById('adminBtn').classList.remove('hidden');
    } else {
        document.getElementById('adminBtn').classList.add('hidden');
    }
    // ----------------------------------------

    // Load Courses
    loadCourses();
}

async function loadCourses() {
    showLoader();
    const res = await callAPI('getCourses', {});
    hideLoader();

    const grid = document.getElementById('courseGrid');
    grid.innerHTML = '';

    if (res.status === 'success' && res.data.length > 0) {
        res.data.forEach(course => {
            // Placeholder รูปภาพหากไม่ได้ตั้งค่าไว้
            const imgUrl = course.image || 'https://via.placeholder.com/300x180?text=Nursing+Course';
            const html = `
                <div class="course-card">
                    <img src="${imgUrl}" alt="Course Cover" class="course-img">
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

function enrollCourse(courseId) {
    showAlert('ยืนยันการลงทะเบียน', 'กำลังเข้าสู่บทเรียน... (ระบบวิดีโอและข้อสอบจะอยู่ในเฟสต่อไป)');
    // *ต่อยอด: ส่ง API ไปบันทึกใน Sheet Enrollments และพาไปหน้า Video Tracker
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

// ฟังก์ชันเพิ่มหลักสูตร
document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const payload = {
        title: document.getElementById('cTitle').value,
        organizer: document.getElementById('cOrganizer').value,
        hours: document.getElementById('cHours').value,
        min_time: document.getElementById('cMinTime').value,
        cover_image: document.getElementById('cCover').value,
        video_url: document.getElementById('cVideo').value,
        passing_score: 80 // ตั้งค่าเริ่มต้นที่ 80%
    };
    
    const res = await callAPI('addCourse', payload);
    hideLoader();
    
    if(res.status === 'success') {
        showAlert('สำเร็จ', 'บันทึกหลักสูตรเรียบร้อยแล้ว');
        document.getElementById('addCourseForm').reset();
    }
});

// ฟังก์ชัน Export Excel อย่างง่ายด้วย JS
function exportToExcel() {
    let table = document.querySelector(".admin-table");
    let html = table.outerHTML.replace(/ /g, '%20');
    let a = document.createElement('a');
    a.href = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + html;
    a.download = 'training_report_swd.xls';
    a.click();
}
// ================= Course Units Logic =================

// ฟังก์ชันเพิ่มกล่องกรอกข้อมูลวิดีโอ
function addUnitField() {
    const container = document.getElementById('unitsContainer');
    const unitHTML = `
        <div class="unit-box">
            <div class="unit-row">
                <input type="text" class="u-title" placeholder="ชื่อหน่วย (เช่น EP.2 ...)" required>
                <input type="text" class="u-video" placeholder="URL วิดีโอ" required>
                <input type="number" class="u-time" placeholder="เวลาดูขั้นต่ำ (นาที)" required>
                <button type="button" class="btn-remove-unit" onclick="removeUnitField(this)"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', unitHTML);
}

// ฟังก์ชันลบกล่องวิดีโอ
function removeUnitField(btn) {
    btn.closest('.unit-box').remove();
}

// ฟังก์ชันบันทึกหลักสูตร
document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // 1. ดึงข้อมูลหน่วยการเรียนรู้ทั้งหมดมาสร้างเป็น Array
    const unitBoxes = document.querySelectorAll('.unit-box');
    let unitsData = [];
    
    unitBoxes.forEach((box) => {
        unitsData.push({
            title: box.querySelector('.u-title').value,
            video_url: box.querySelector('.u-video').value,
            min_time: parseInt(box.querySelector('.u-time').value)
        });
    });

    // 2. เตรียมข้อมูล Payload
    const payload = {
        title: document.getElementById('cTitle').value,
        organizer: document.getElementById('cOrganizer').value,
        hours: document.getElementById('cHours').value,
        passing_score: document.getElementById('cPassingScore').value,
        cover_image: document.getElementById('cCover').value,
        units: unitsData // ส่ง Array ไปเลย
    };
    
    showLoader();
    const res = await callAPI('addCourse', payload);
    hideLoader();
    
    if(res.status === 'success') {
        showAlert('สำเร็จ', 'บันทึกหลักสูตรเรียบร้อยแล้ว');
        document.getElementById('addCourseForm').reset();
        
        // ลบกล่องที่เพิ่มมาให้เหลือแค่อันเดียว
        const extraBoxes = document.querySelectorAll('.unit-box:not(:first-child)');
        extraBoxes.forEach(box => box.remove());
    }
});
