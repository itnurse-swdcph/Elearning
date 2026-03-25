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
