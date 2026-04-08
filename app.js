// เปลี่ยน URL ตรงนี้เป็น Web App URL ที่ได้จาก Google Apps Script
const API_URL = 'https://script.google.com/macros/s/AKfycbxlfD-5saP7FtUX_YxuBe3gowToA38b0qc0jW5JuWjMN9XotTlqRfc0LuaWtibYNwMp1Q/exec'; 
const appState = {
    user: null,
    dashboardNeedsRefresh: true,
    dashboardStats: null,
    externalRecommendationsLoaded: false
};

let loaderCount = 0;
let courseRequestToken = 0;
let externalRecommendationRequestToken = 0;

// โหลดข้อมูลพื้นฐานเมื่อเปิดเว็บ
window.addEventListener('DOMContentLoaded', async () => {
    // 1. อัปเดตปีใน Footer ทันที (ทุกจุดที่ใช้คลาส current-year)
    const years = document.querySelectorAll('.current-year');
    const thisYear = new Date().getFullYear();
    years.forEach(el => el.innerText = thisYear);

    // 2. โหลดรายชื่อหน่วยงานใส่ Datalist (สำหรับหน้าสมัครเรียนและหน้าแก้ไขโปรไฟล์)
    try {
        const res = await callAPI('getSettings', {});
        if(res && res.status === 'success') {
            let datalistHtml = '';
            res.data.forEach(d => {
                datalistHtml += `<option value="${d}">`;
            });
            const deptList = document.getElementById('deptList');
            if(deptList) deptList.innerHTML = datalistHtml;
        }
    } catch (err) {
        console.error("ระบบไม่สามารถโหลดรายการหน่วยงานได้:", err);
    }
});

// ตรวจสอบสถานะการล็อกอินเมื่อเปิดหน้าเว็บ

window.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

function getCurrentUser() {
    try {
        const rawUser = localStorage.getItem('swd_user');
        return rawUser ? JSON.parse(rawUser) : null;
    } catch (error) {
        localStorage.removeItem('swd_user');
        return null;
    }
}

// ================= UI Utilities =================
function getDriveImageUrl(url) {
    if (!url) return 'https://via.placeholder.com/300x180?text=Course+Cover';
    const match = url.match(/drive\.google\.com\/file\/d\/([^\/]+)/);
    if (match && match[1]) {
        return `https://drive.google.com/thumbnail?id=${match[1]}&sz=w800`;
    }
    return url;
}

function showLoader() {
    loaderCount += 1;
    document.getElementById('loader').classList.remove('hidden');
}

function hideLoader(force = false) {
    loaderCount = force ? 0 : Math.max(0, loaderCount - 1);
    if (loaderCount === 0) {
        document.getElementById('loader').classList.add('hidden');
    }
}

function showAlert(title, message) {
    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertMessage').innerText = message;
    document.getElementById('customAlert').classList.remove('hidden');
}

function closeAlert() { document.getElementById('customAlert').classList.add('hidden'); }

function showConfirm(title, message) {
    return new Promise((resolve) => {
        document.getElementById('confirmTitle').innerText = title;
        document.getElementById('confirmMessage').innerText = message;
        document.getElementById('customConfirm').classList.remove('hidden');
        const btnYes = document.getElementById('btnConfirmYes');
        const newBtnYes = btnYes.cloneNode(true);
        btnYes.parentNode.replaceChild(newBtnYes, btnYes);
        newBtnYes.addEventListener('click', () => {
            document.getElementById('customConfirm').classList.add('hidden');
            resolve(true);
        });
        window.cancelConfirm = () => {
            document.getElementById('customConfirm').classList.add('hidden');
            resolve(false);
        };
    });
}

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
    const res = await callAPI('login', { username: document.getElementById('loginUsername').value, password: document.getElementById('loginPassword').value });
    hideLoader();
    if (res.status === 'success') {
        localStorage.setItem('swd_user', JSON.stringify(res.user));
        await initApp({ forceDashboardRefresh: true });
    } else showAlert('ข้อผิดพลาด', res.message);
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const payload = {
        name: document.getElementById('regName').value, 
        position: document.getElementById('regPosition').value,
        department: document.getElementById('regDept').value, 
        username: document.getElementById('regUsername').value,
        email: document.getElementById('regEmail').value, 
        password: document.getElementById('regPassword').value
    };
    const res = await callAPI('register', payload);
    hideLoader();
    if (res.status === 'success') { 
        showAlert('สำเร็จ', 'ลงทะเบียนเรียบร้อย กรุณาเข้าสู่ระบบ'); 
        toggleAuth(); 
    } else showAlert('ข้อผิดพลาด', res.message);
});

function logout() {
    localStorage.removeItem('swd_user');
    appState.user = null;
    appState.dashboardStats = null;
    appState.dashboardNeedsRefresh = true;
    appState.coursesLoaded = false;
    appState.externalRecommendationsLoaded = false;
    globalCourses = [];
    cachedUserEnrollments = [];
    checkSession();
}

// ================= App Logic =================
function checkSession() {
    const user = getCurrentUser();
    appState.user = user;
    if (user) {
        initApp({ forceDashboardRefresh: !appState.dashboardStats || appState.dashboardNeedsRefresh });
    } else {
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('appSection').classList.add('hidden');
        document.getElementById('adminSection').classList.add('hidden');
        document.getElementById('classroomSection').classList.add('hidden');
        document.getElementById('adminBtn').classList.add('hidden');
        hideLoader(true);
    }
}

function setDashboardRefreshNeeded() {
    appState.dashboardNeedsRefresh = true;
}

function renderCurrentUser(user) {
    document.getElementById('userNameDisplay').innerText = user.name;
    document.getElementById('userDeptDisplay').innerText = user.department;

    const avatar = document.querySelector('.user-profile-mini .avatar');
    if (user.profile_img) {
        avatar.innerHTML = `<img src="${user.profile_img}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
    } else {
        avatar.innerHTML = '<i class="fas fa-user-nurse"></i>';
    }

    if (user.role === 'admin') document.getElementById('adminBtn').classList.remove('hidden');
    else document.getElementById('adminBtn').classList.add('hidden');
}

function renderDashboardStats(stats) {
    if (!stats) return;
    document.querySelectorAll('.stat-number')[0].innerText = stats.inProgress;
    document.querySelectorAll('.stat-number')[1].innerText = stats.certCount;
    document.getElementById('totalHoursDisplay').innerText = stats.totalHours;
}

async function loadDashboardStats(force = false) {
    const user = appState.user || getCurrentUser();
    if (!user) return null;

    if (!force && appState.dashboardStats) {
        renderDashboardStats(appState.dashboardStats);
        return appState.dashboardStats;
    }

    showLoader();
    try {
        const statRes = await callAPI('getDashboardStats', { user_id: user.id });
        if (statRes.status === 'success') {
            appState.dashboardStats = statRes.stats;
            renderDashboardStats(statRes.stats);
            return statRes.stats;
        }
        showAlert('ข้อผิดพลาด', statRes.message || 'ไม่สามารถโหลดสถิติได้');
    } finally {
        hideLoader();
    }

    return null;
}

async function refreshDashboardData(force = false) {
    const shouldRefresh = force || appState.dashboardNeedsRefresh || !appState.dashboardStats || globalCourses.length === 0 || !appState.externalRecommendationsLoaded;
    if (!shouldRefresh) {
        filterCourses();
        renderExternalRecommendationGrid(externalRecommendationCourses);
        return;
    }

    const refreshMode = force || appState.dashboardNeedsRefresh;
    await Promise.all([
        loadDashboardStats(refreshMode),
        loadCourses(refreshMode),
        loadExternalRecommendations(refreshMode)
    ]);
    appState.dashboardNeedsRefresh = false;
}

async function initApp(options = {}) {
    const user = getCurrentUser();
    if (!user) return checkSession();

    appState.user = user;
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');

    renderCurrentUser(user);
    if (options.forceDashboardRefresh) {
        setDashboardRefreshNeeded();
    }
    await refreshDashboardData(!!options.forceDashboardRefresh);
}

function returnToDashboard() {
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    setDashboardRefreshNeeded();
    const dashboardMenuBtn = document.querySelector('#userMenu li:first-child');
    switchUserTab('dashboardTab', dashboardMenuBtn);
}
// แนบ Event ให้ช่องอัปโหลดรูปหน้าปกแอดมิน
async function uploadImageFile(file, filePrefix) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const res = await callAPI('uploadFile', { fileName: `${filePrefix}_${Date.now()}`, fileData: e.target.result });
            resolve(res);
        };
        reader.readAsDataURL(file);
    });
}

document.getElementById('cCoverUpload').addEventListener('change', async function() {
    if(!this.files[0]) return;
    document.getElementById('cCoverStatus').innerText = "กำลังอัปโหลด...";
    const res = await uploadImageFile(this.files[0], 'Cover');
/*
        if(res.status === 'success') {
            document.getElementById('cCover').value = res.url;
            document.getElementById('cCoverStatus').innerHTML = '<span style="color:green;">✅ อัปโหลดสำเร็จ</span>';
        }
*/
    if (res.status === 'success') {
        document.getElementById('cCover').value = res.url;
        document.getElementById('cCoverStatus').innerHTML = '<span style="color:green;">อัปโหลดสำเร็จ</span>';
    } else {
        document.getElementById('cCoverStatus').innerHTML = '<span style="color:#ef4444;">อัปโหลดไม่สำเร็จ</span>';
    }
});

// ส่งฟอร์มแก้ไข Profile
document.getElementById('extRecCoverUpload').addEventListener('change', async function() {
    if(!this.files[0]) return;
    document.getElementById('extRecCoverStatus').innerText = 'กำลังอัปโหลด...';
    const res = await uploadImageFile(this.files[0], 'ExternalRecCover');
    if (res.status === 'success') {
        document.getElementById('extRecCover').value = res.url;
        document.getElementById('extRecCoverStatus').innerHTML = '<span style="color:green;">อัปโหลดสำเร็จ</span>';
    } else {
        document.getElementById('extRecCoverStatus').innerHTML = '<span style="color:#ef4444;">อัปโหลดไม่สำเร็จ</span>';
    }
});

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const file = document.getElementById('pImgUpload').files[0];
    showLoader();
    
    let profileUrl = user.profile_img;
    // ถ้ามีการเลือกรูปใหม่ ให้อัปโหลดก่อน
    if(file) {
        const reader = new FileReader();
        await new Promise((resolve) => {
            reader.onload = async (e) => {
                const uploadRes = await callAPI('uploadFile', { fileName: 'Profile_'+user.id, fileData: e.target.result });
                if(uploadRes.status === 'success') profileUrl = uploadRes.url;
                resolve();
            };
            reader.readAsDataURL(file);
        });
    }

    const res = await callAPI('updateUserProfile', {
        user_id: user.id, 
        name: document.getElementById('pName').value,
        position: document.getElementById('pPosition').value,
        department: document.getElementById('pDept').value, 
        password: document.getElementById('pPassword').value,
        profile_img: profileUrl
    });
    hideLoader();

    if(res.status === 'success') {
        user.name = document.getElementById('pName').value;
        user.position = document.getElementById('pPosition').value;
        user.department = document.getElementById('pDept').value;
        user.profile_img = profileUrl;
        localStorage.setItem('swd_user', JSON.stringify(user));
        showAlert('สำเร็จ', 'อัปเดตข้อมูลส่วนตัวเรียบร้อยแล้ว');
        initApp(); // รีเฟรชหน้าจอ
    }
});

// เติมข้อมูลลงฟอร์มและรีโหลดข้อมูลเมื่อเปลี่ยนแท็บ
function switchUserTab(tabId, element) {
    const tabs = document.querySelectorAll('.user-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    const menus = document.querySelectorAll('#userMenu li');
    menus.forEach(menu => menu.classList.remove('active'));
    
    document.getElementById(tabId).classList.remove('hidden');
    
    // ป้องกัน Error ถ้าหา element ไม่เจอ
    if (element) {
        element.classList.add('active');
    }

    // --- ส่วนรีโหลดข้อมูลตามแท็บที่กด ---
    if(tabId === 'dashboardTab') {
        initApp(); // สั่งดึงสถิติแดชบอร์ดและการ์ดหลักสูตรใหม่ทุกครั้งที่กลับมาหน้านี้
    }
    if(tabId === 'historyTab') {
        loadTrainingHistory();
    }
    if(tabId === 'profileTab') {
        const user = JSON.parse(localStorage.getItem('swd_user'));
        document.getElementById('pName').value = user.name;
        document.getElementById('pPosition').value = user.position || '';
        document.getElementById('pUsername').value = user.username || '-';
        document.getElementById('pDept').value = user.department;
        document.getElementById('pPassword').value = '';
        if(user.profile_img) document.getElementById('profilePreview').src = user.profile_img;
    }
}

// ฟังก์ชันโหลดประวัติลงตาราง Portfolio
async function loadTrainingHistory() {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const tbody = document.getElementById('historyTableBody');
    if(!tbody) return;
    
    // เปลี่ยน colspan เป็น 6 เพราะเราเพิ่มคอลัมน์
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">กำลังดึงข้อมูลประวัติการอบรม...</td></tr>';
    const res = await callAPI('getUserHistory', { user_id: user.id });
    
    if (res.status === 'success') {
        tbody.innerHTML = ''; 
        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">ยังไม่มีประวัติการอบรมในระบบครับ</td></tr>';
            return;
        }
        
        res.data.forEach(item => {
            // บังคับไม่ให้ปุ่มตกบรรทัด (white-space: nowrap)
            const certBtn = item.cert_url && item.cert_url.trim() !== '' 
                ? `<a href="${item.cert_url}" target="_blank" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.85rem; white-space: nowrap;"><i class="fas fa-file-pdf text-danger"></i> หลักฐาน</a>`
                : '<span style="color: #94a3b8; font-size: 0.85rem; white-space: nowrap;">ไม่มีไฟล์</span>';
            
            // ป้ายกำกับสถานะสำหรับอบรมภายนอก
            let statusBadge = '';
            if(item.status === 'pending') statusBadge = '<span class="badge" style="background:#f59e0b; color:white; font-size: 0.7rem; white-space: nowrap;">รอตรวจ</span>';
            else if(item.status === 'rejected') statusBadge = '<span class="badge" style="background:#ef4444; color:white; font-size: 0.7rem; white-space: nowrap;">ไม่อนุมัติ</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center; white-space: nowrap;">${item.date || '-'}</td>
                    <td><strong>${item.title}</strong> ${statusBadge}</td>
                    <td>${item.organizer || '-'}</td> <td style="text-align: center; white-space: nowrap;"><span class="badge-hours" style="background: #f1f5f9; color: var(--text-light); box-shadow: none; white-space: nowrap;">${item.type}</span></td>
                    <td style="text-align: center;"><strong>${item.hours}</strong></td>
                    <td style="text-align: center; white-space: nowrap;">${certBtn}</td>
                </tr>
            `;
        });
        
        const certCount = res.data.filter(i => i.status === 'approved').length;
        document.querySelectorAll('.stat-number')[1].innerText = certCount;
        
    } else {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444;">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่</td></tr>';
    }
}
// ================= Course Display & Search Logic =================
let globalCourses = []; 
let cachedUserEnrollments = []; // เก็บสถานะการเรียนไว้ในเครื่อง จะได้ไม่ต้องโหลดซ้ำตอนค้นหา
let externalRecommendationCourses = [];

async function loadCourses() {
    showLoader();
    const res = await callAPI('getCourses', {});
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const enrollRes = await callAPI('getUserEnrollments', { user_id: user.id }); 
    hideLoader();

    if (res.status === 'success') {
        globalCourses = res.data; 
        cachedUserEnrollments = enrollRes.data || [];
        renderCourseGrid(globalCourses); // สั่งวาดการ์ดทั้งหมดครั้งแรก
    }
}

// ฟังก์ชันค้นหาหลักสูตร (ทำงานเมื่อพิมพ์ข้อความ)
function filterCourses() {
    const searchText = document.getElementById('courseSearchInput').value.trim().toLowerCase();
    
    if (searchText === '') {
        renderCourseGrid(globalCourses); // โชว์ทั้งหมด
    } else {
        const filtered = globalCourses.filter(course => 
            course.title.toLowerCase().includes(searchText)
        );
        renderCourseGrid(filtered); // โชว์เฉพาะที่ค้นเจอ
    }
}

// ฟังก์ชันวาดการ์ดหลักสูตรลงหน้าจอ
function renderCourseGrid(coursesToRender) {
    const grid = document.getElementById('courseGrid');
    grid.innerHTML = '';
    
    if (coursesToRender.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-light); padding: 30px; background: #f8fafc; border-radius: 8px;">ไม่พบหลักสูตรที่ค้นหาครับ</div>';
        return;
    }

    coursesToRender.forEach(course => {
        const enrollData = cachedUserEnrollments.find(e => e.course_id === course.id);
        let btnText = "เข้าสู่บทเรียน", btnClass = "btn-primary";
        
        if(enrollData) {
            if(enrollData.status === 'completed') {
                btnText = "เข้าสู่บทเรียนอีกครั้ง"; btnClass = "btn-outline";
            } else {
                try {
                    let prog = JSON.parse(enrollData.progress);
                    if(prog.completed && prog.completed.length > 0) { btnText = "เรียนต่อ"; btnClass = "btn-success"; }
                } catch(e) {}
            }
        }

        grid.innerHTML += `
            <div class="course-card">
                <img src="${getDriveImageUrl(course.image)}" class="course-img">
                <div class="course-info">
                    <h4>${course.title}</h4>
                    <div class="course-meta">
                        <span><i class="fas fa-clock"></i> ${course.hours} ชม.</span>
                    </div>
                    <button class="btn ${btnClass} w-100" onclick="enrollCourse('${course.id}')">${btnText}</button>
                </div>
            </div>
        `;
    });
}

// ตรวจสอบสถานะการล็อกอินเมื่อเปิดหน้าเว็บ
// ================= Admin Logic =================

function goToAdminPanel() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    loadAdminReport(); // โหลดข้อมูลตารางสถิติทันทีที่เข้าหน้าแอดมิน
}

// ออกจากระบบแอดมิน (กลับหน้าผู้ใช้งานและรีเฟรช)
function exitAdmin() {
    // เรียกใช้ระบบกลับหน้าหลักแบบรีเฟรชข้อมูล
    returnToDashboard();
}

function switchAdminTab(tabId, element = null) {
    // ซ่อนทุก Tab
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    // ลบ Active menu
    const menus = document.querySelectorAll('.admin-sidebar li'); // เช็คให้ตรงกับคลาสเมนูของคุณ (เช่น .admin-sidebar li หรือ .sidebar-menu li)
    menus.forEach(menu => menu.classList.remove('active'));
    
    // โชว์ Tab ที่เลือก
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.remove('hidden');
    
    // เพิ่มสี Active ให้เมนูที่ถูกคลิก (แบบป้องกัน Error)
    if (element) {
        element.classList.add('active');
    } else if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    
    // โหลดข้อมูลตามหน้า Tab ที่เลือก
    if(tabId === 'reportTab') loadAdminReport();
    if(tabId === 'courseMgtTab') {
        appState.coursesLoaded = false;
        setDashboardRefreshNeeded();
        resetCourseForm();
        loadAdminCoursesTable(); 
    }
    if(tabId === 'examMgtTab') {
        initExamAdmin(); // เรียกฟังก์ชันดึงรายชื่อวิชามาใส่ Dropdown
    }
    if(tabId === 'approveExtTab') {
        loadAdminExtRequests();
    }
    if(tabId === 'userMgtTab') {
        loadAdminUsersTable();
    }
    if(tabId === 'courseReportTab') {
        initCourseReportAdmin(); // โหลดรายชื่อวิชาใส่ Dropdown
    }
}

// ================= Admin: Report & Stats (พร้อมระบบกรอง) =================
let globalAdminReportData = []; // สร้างตัวแปรเก็บข้อมูลสถิติไว้ในเครื่อง จะได้ไม่ต้องโหลดใหม่ตอนเปลี่ยน Dropdown
let adminChartInstance = null;  // ตัวแปรเก็บกราฟ

// ฟังก์ชันดึงข้อมูลจาก API (ทำงานครั้งแรกตอนเปิดแท็บ)
async function loadAdminReport() {
    const tbody = document.getElementById('reportTableBody'); 
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">กำลังโหลดข้อมูลสถิติ...</td></tr>';
    const res = await callAPI('getAdminReport', {});
    
    if (res.status === 'success') {
        globalAdminReportData = res.data; 
        
        // ลบโค้ดสร้าง option ออก เพราะเราใช้ list="deptList" ที่โหลดไว้ตั้งแต่เปิดเว็บแล้ว
        // สั่งวาดตารางและกราฟ (แสดงทั้งหมด)
        renderReportTableAndChart(globalAdminReportData);
    } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">โหลดข้อมูลผิดพลาด</td></tr>`;
    }
}

function filterAdminReport() {
    // อ่านค่าที่พิมพ์ และตัดช่องว่างซ้ายขวา
    const selectedDept = document.getElementById('adminReportDeptFilter').value.trim();
    
    // ถ้าช่องค้นหาว่างเปล่า ให้โชว์ข้อมูลทั้งหมด
    if (selectedDept === '') {
        renderReportTableAndChart(globalAdminReportData); 
    } else {
        // กรองเอาเฉพาะข้อมูลที่แผนกตรงกับคำค้นหา
        const filteredData = globalAdminReportData.filter(item => item.department === selectedDept);
        renderReportTableAndChart(filteredData);
    }
}

// ฟังก์ชันจัดการวาดตารางและกราฟ
function renderReportTableAndChart(dataToShow) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    
    if (dataToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ไม่มีข้อมูลผู้ใช้งาน</td></tr>';
        renderAdminChart({}); // วาดกราฟเปล่า
        return;
    }
    
    let deptStats = {}; // เก็บสถิติทำกราฟ
    
    dataToShow.forEach(r => {
        // เก็บสถิติสำหรับกราฟ
        if (!deptStats[r.department]) deptStats[r.department] = { passed: 0, failed: 0 };
        if (r.status === 'ผ่านเกณฑ์') deptStats[r.department].passed++;
        else deptStats[r.department].failed++;

        // วาดตาราง
        const statusBadge = r.status === 'ผ่านเกณฑ์'
            ? `<span class="badge" style="background: #10B981; color: white;">ผ่านเกณฑ์</span>`
            : `<span class="badge" style="background: #EF4444; color: white;">ยังไม่ผ่าน</span>`;
            
        tbody.innerHTML += `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.department}</td>
                <td>${r.internal}</td>
                <td>${r.external}</td>
                <td><strong>${r.totalHours}</strong></td>
                <td><strong>${r.totalDays}</strong></td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    // วาดกราฟ
    renderAdminChart(deptStats);
}

// ฟังก์ชันวาดกราฟ Chart.js
function renderAdminChart(deptStats) {
    const ctx = document.getElementById('passRateChart').getContext('2d');
    
    // ลบกราฟเก่าทิ้งก่อน (ถ้ามี) ป้องกันบั๊กกราฟกระพริบซ้อนกัน
    if (adminChartInstance) adminChartInstance.destroy();

    const labels = Object.keys(deptStats);
    const passedData = labels.map(dept => deptStats[dept].passed);
    const failedData = labels.map(dept => deptStats[dept].failed);

    adminChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'ผ่านเกณฑ์ (คน)', data: passedData, backgroundColor: '#10B981', borderRadius: 4 },
                { label: 'ยังไม่ผ่าน (คน)', data: failedData, backgroundColor: '#EF4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { stacked: true }, 
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } // บังคับให้กราฟแนวตั้งเป็นเลขจำนวนเต็ม (คน)
            },
            plugins: { 
                legend: { position: 'top' } 
            }
        }
    });
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
    loadQA();
}

// ออกจากห้องเรียน (กลับหน้าหลักและรีเฟรช)
function exitClassroom() {
    clearInterval(trackerInterval);
    saveProgressToDB(); // บันทึกเวลาที่ดูค้างไว้ลง Google Sheets ทันที

    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    
    // เรียกใช้ระบบกลับหน้าหลักแบบรีเฟรชข้อมูล
    returnToDashboard(); 
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
        // เช็คว่าผ่านไหม (ดูจาก class ของไอคอน)
        const isPassed = document.getElementById('resultIcon').classList.contains('fa-check-circle');
        if (isPassed) {
            openReviewModal(); // ถ้าสอบผ่าน ให้เด้งหน้าประเมินดาว ⭐️
        } else {
            exitClassroom(); // ถ้าตก ให้กลับหน้าหลัก
        }
    }
}
// ================= External Training Logic (อัปโหลดประวัติภายนอก) =================
document.getElementById('externalTrainingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('extCertFile');
    if (fileInput.files.length === 0) return showAlert('แจ้งเตือน', 'กรุณาแนบไฟล์ใบประกาศด้วยครับ');
    
    const file = fileInput.files[0];
    // ตรวจสอบขนาดไฟล์ (จำกัดไม่เกิน 5MB เพื่อไม่ให้ฝั่ง Apps Script ทำงานหนักเกินไป)
    if (file.size > 5 * 1024 * 1024) return showAlert('แจ้งเตือน', 'ขนาดไฟล์ใหญ่เกินไป (ต้องไม่เกิน 5MB) กรุณาบีบอัดไฟล์ครับ');
    
    showLoader();
    
    // เทคนิคแปลงไฟล์ (PDF/Image) ให้เป็นข้อมูลแบบ Base64 เพื่อส่งผ่าน JSON
    const reader = new FileReader();
    reader.onload = async function(event) {
        const base64Data = event.target.result;
        
        const user = JSON.parse(localStorage.getItem('swd_user'));
        const hr = parseFloat(document.getElementById('extHours').value) || 0;
        const min = parseFloat(document.getElementById('extMins').value) || 0;
        const totalDecimalHours = +(hr + (min / 60)).toFixed(2);
        
        const payload = {
            user_id: user.id,
            topic: document.getElementById('extTopic').value,
            organizer: document.getElementById('extOrganizer').value,
            date: document.getElementById('extDate').value,
            hours: totalDecimalHours,
            fileName: user.name + '_ExtCert_' + file.name, // ตั้งชื่อไฟล์ใหม่ให้มีชื่อคนอัปโหลดนำหน้า
            fileData: base64Data // ข้อมูลไฟล์ที่แปลงแล้ว
        };
        
        const res = await callAPI('addExternalTraining', payload);
        hideLoader();
        
        if (res.status === 'success') {
            showAlert('สำเร็จ', 'บันทึกประวัติและอัปโหลดไฟล์เรียบร้อยแล้ว (รอแอดมินตรวจสอบเพื่ออนุมัติชั่วโมง)');
            document.getElementById('externalTrainingForm').reset();
            // โหลดตารางประวัติใหม่เพื่อให้อัปเดตทันที
            loadTrainingHistory(); 
        } else {
            showAlert('ข้อผิดพลาด', res.message);
        }
    };
    
    reader.readAsDataURL(file); // เริ่มอ่านไฟล์
});
// ================= Admin: Approve External Training =================
async function loadAdminExtRequests() {
    const tbody = document.getElementById('adminExtReqBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>';
    
    const res = await callAPI('getAdminExternalReq', {});
    
    if (res.status === 'success') {
        tbody.innerHTML = '';
        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">ไม่มีรายการรออนุมัติ</td></tr>';
            return;
        }
        
        res.data.forEach(req => {
            // แปลงวันที่ให้อ่านง่าย
            const dateObj = new Date(req.date);
            const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString('th-TH') : req.date;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${req.user_name}</strong></td>
                    <td>${req.topic}<br><small style="color:var(--text-light);">${req.organizer}</small></td>
                    <td>${dateStr}<br><span class="badge-hours">${req.hours} ชม.</span></td>
                    <td><a href="${req.cert_url}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-file-pdf"></i> ตรวจสอบไฟล์</a></td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="handleExtReq('${req.ext_id}', 'approved')" style="margin-right: 5px;"><i class="fas fa-check"></i> อนุมัติ</button>
                        <button class="btn btn-sm" style="background:#EF4444; color:white;" onclick="handleExtReq('${req.ext_id}', 'rejected')"><i class="fas fa-times"></i> ปฏิเสธ</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function handleExtReq(extId, status) {
    const title = status === 'approved' ? 'ยืนยันการอนุมัติ' : 'ยืนยันการปฏิเสธ';
    const confirmMsg = status === 'approved' ? 'คุณต้องการอนุมัติชั่วโมงอบรมนี้ใช่หรือไม่?' : 'คุณต้องการปฏิเสธคำขออบรมนี้ (จะไม่ได้รับชั่วโมง) ใช่หรือไม่?';
    
    // เรียกใช้กล่อง Custom Confirm แทน pop-up เบราว์เซอร์
    const isConfirmed = await showConfirm(title, confirmMsg);
    
    // ถ้าผู้ใช้กดยกเลิก ให้หยุดการทำงานทันที
    if (!isConfirmed) return; 
    
    // ถ้ากดยืนยัน ให้โหลด API ต่อไป
    showLoader();
    const res = await callAPI('updateExternalStatus', { ext_id: extId, status: status });
    hideLoader();
    
    if (res.status === 'success') {
        showAlert('สำเร็จ', res.message);
        loadAdminExtRequests(); // โหลดตารางใหม่
    } else {
        showAlert('ผิดพลาด', res.message);
    }
}
// ================= Admin: User Management Logic =================
let adminUsersData = [];

async function loadAdminUsersTable() {
    const tbody = document.getElementById('adminUsersBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>';
    
    const res = await callAPI('getAdminUsers', {});
    
    if (res.status === 'success') {
        adminUsersData = res.data;
        tbody.innerHTML = '';
        
        res.data.forEach(u => {
            const roleBadge = u.role === 'admin' 
                ? '<span class="badge" style="background: var(--accent-color); color: white;">Admin</span>' 
                : '<span class="badge" style="background: #e2e8f0; color: var(--text-main);">User</span>';
                
            tbody.innerHTML += `
                <tr>
                    <td><strong>${u.name}</strong></td>
                    <td>${u.position}<br><small style="color:var(--text-light);">${u.department}</small></td>
                    <td>${u.email}</td>
                    <td>${roleBadge}</td>
                    <td>
                        <button class="btn btn-outline btn-sm" onclick="editAdminUser('${u.id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function editAdminUser(userId) {
    // 1. หาข้อมูลผู้ใช้จาก Array หรือเรียกจาก Server (แล้วแต่ระบบของคุณ)
    // สมมติว่าตัวแปร users คือที่เก็บข้อมูลพยาบาลทั้งหมด
    const user = adminUsersData.find(u => u.id === userId); 

    if (user) {
        // 2. แสดง Section แก้ไข
        document.getElementById('editUserSection').classList.remove('hidden');

        // 3. ส่งค่าข้อมูลเดิมไปใส่ในแต่ละช่อง Input
        document.getElementById('editUserId').value = user.id;
        document.getElementById('euName').value = user.name;
        document.getElementById('euUsername').value = user.username;
        document.getElementById('euPosition').value = user.position;
        document.getElementById('euDept').value = user.department || '';
        document.getElementById('euEmail').value = user.email || ''; 
        document.getElementById('euPassword').value = user.password; 
        document.getElementById('editUserSection').scrollIntoView({ behavior: 'smooth' });
    }
}

function cancelEditUser() {
    document.getElementById('editUserSection').classList.add('hidden');
    document.getElementById('editUserForm').reset();
}

document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const payload = {
        id: document.getElementById('editUserId').value,
        name: document.getElementById('euName').value,
        position: document.getElementById('euPosition').value,
        department: document.getElementById('euDept').value,
        role: document.getElementById('euRole').value,
        password: document.getElementById('euPassword').value
    };
    
    const isConfirmed = await showConfirm('ยืนยันการแก้ไข', 'คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลผู้ใช้นี้ใช่หรือไม่?');
    if(!isConfirmed) return;
    
    showLoader();
    const res = await callAPI('updateUserByAdmin', payload);
    hideLoader();
    
    if(res.status === 'success') {
        showAlert('สำเร็จ', res.message);
        cancelEditUser();
        loadAdminUsersTable(); // โหลดตารางใหม่หลังเซฟเสร็จ
    } else {
        showAlert('ผิดพลาด', res.message);
    }
});
// ================= Export Portfolio to PDF =================
function exportPortfolioPDF() {
    const user = JSON.parse(localStorage.getItem('swd_user')) || {};
    
    // ดักข้อมูลเผื่อหาไม่เจอ จะได้ไม่ขึ้น undefined
    const name = user.name || '-';
    const position = user.position || '-';
    const dept = user.department || '-';

    document.getElementById('pdfUserName').innerHTML = `<strong>ชื่อ-นามสกุล:</strong> ${name} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>ตำแหน่ง:</strong> ${position} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>หน่วยงาน:</strong> ${dept}`;
    
    const element = document.getElementById('printablePortfolio');
    document.getElementById('pdfHeader').style.display = 'block'; // โชว์หัวกระดาษ
    
    const opt = {
        margin:       10,
        filename:     `Portfolio_${name}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' } // เปลี่ยนเป็นแนวนอน
    };

    showLoader();
    html2pdf().set(opt).from(element).save().then(() => {
        document.getElementById('pdfHeader').style.display = 'none'; // ซ่อนหัวกระดาษกลับ
        hideLoader();
    });
}
// ================= Admin: Course Detail Report =================

// ดึงรายชื่อหลักสูตรใส่ Dropdown ในหน้ารายงาน
async function initCourseReportAdmin() {
    const select = document.getElementById('reportCourseSelect');
    select.innerHTML = '<option value="">-- กำลังโหลดหลักสูตร... --</option>';
    const res = await callAPI('getAdminCourses', {});
    
    if (res.status === 'success') {
        select.innerHTML = '<option value="">-- กรุณาเลือกหลักสูตรที่ต้องการดูรายงาน --</option>';
        res.data.forEach(c => {
            select.innerHTML += `<option value="${c.course_id}">${c.title}</option>`;
        });
    }
}

// ฟังก์ชันโหลดรายงานเมื่อเปลี่ยน Dropdown
async function loadCourseReport() {
    const courseId = document.getElementById('reportCourseSelect').value;
    const tbody = document.getElementById('courseReportBody');
    const summaryCard = document.getElementById('courseReportSummary');

    if(!courseId) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-light);">กรุณาเลือกหลักสูตรจากด้านบนเพื่อดูรายงาน</td></tr>';
        summaryCard.classList.add('hidden');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">กำลังคำนวณและโหลดข้อมูล...</td></tr>';
    const res = await callAPI('getCourseReport', { course_id: courseId });

    if(res.status === 'success') {
        summaryCard.classList.remove('hidden');
        tbody.innerHTML = '';

        if(res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">ยังไม่มีผู้ลงทะเบียนในหลักสูตรนี้</td></tr>';
            document.getElementById('crTotal').innerText = 0;
            document.getElementById('crPassed').innerText = 0;
            document.getElementById('crPassRate').innerText = '0%';
            document.getElementById('crAvgScore').innerText = '-';
            return;
        }

        let totalEnrolled = res.data.length;
        let totalPassed = 0; 
        let sumPostScore = 0;
        let postScoreCount = 0;

        res.data.forEach((r, index) => {
            let statusText = '';
            let statusBadge = '';
            
            // ในระบบนี้ status 'completed' หมายถึงเรียนจบและสอบผ่านแล้ว
            if(r.status === 'completed') {
                statusText = 'ผ่านการอบรม';
                statusBadge = `<span class="badge" style="background: #10B981; color: white;">ผ่าน</span>`;
                totalPassed++;
            } else {
                statusText = 'กำลังเรียน/ยังไม่ผ่าน';
                statusBadge = `<span class="badge" style="background: #f59e0b; color: white;">รอดำเนินการ</span>`;
            }

            // รวมคะแนนเพื่อหาค่าเฉลี่ย
            if(r.post_score !== '-') {
                sumPostScore += parseFloat(r.post_score);
                postScoreCount++;
            }

            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${r.name}</td>
                    <td>${r.position}</td>
                    <td>${r.department}</td>
                    <td style="text-align: center; color: #64748b;">${r.pre_score}</td>
                    <td style="text-align: center; font-weight: bold; color: #0f172a;">${r.post_score}</td>
                    <td style="text-align: center;">${statusBadge}</td>
                </tr>
            `;
        });

        // อัปเดตตัวเลขสรุปบนการ์ด
        document.getElementById('crTotal').innerText = totalEnrolled;
        document.getElementById('crPassed').innerText = totalPassed;

        let passRate = totalEnrolled > 0 ? ((totalPassed / totalEnrolled) * 100).toFixed(2) : 0;
        document.getElementById('crPassRate').innerText = `${passRate}%`;

        let avgScore = postScoreCount > 0 ? (sumPostScore / postScoreCount).toFixed(2) : '-';
        document.getElementById('crAvgScore').innerText = avgScore;

    } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">โหลดข้อมูลผิดพลาด</td></tr>';
    }
}

// โหลดตารางหลักสูตรนี้ออกเป็น Excel
function exportCourseReportToExcel() {
    let table = document.getElementById("courseReportTable");
    let html = table.outerHTML.replace(/ /g, '%20');
    let a = document.createElement('a');
    a.href = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + html;
    
    // ตั้งชื่อไฟล์ตามชื่อวิชา
    const select = document.getElementById('reportCourseSelect');
    let courseName = select.options[select.selectedIndex].text;
    if(select.value === "") courseName = "สรุปรายวิชา";
    
    a.download = `รายงานผลอบรม_${courseName}.xls`;
    a.click();
}
// ================= Q&A Logic =================
async function loadQA() {
    const container = document.getElementById('qaListContainer');
    container.innerHTML = '<div style="text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> กำลังโหลดคำถาม...</div>';
    const res = await callAPI('getQA', { course_id: currentClassCourse.id });
    
    if(res.status === 'success') {
        container.innerHTML = '';
        if(res.data.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 15px;">ยังไม่มีคำถามในบทเรียนนี้ เป็นคนแรกที่เริ่มถามเลย!</div>';
            return;
        }
        
        const user = JSON.parse(localStorage.getItem('swd_user'));
        
        res.data.forEach(qa => {
            let adminReplyHtml = '';
            if(qa.answer) {
                // ถ้ามีคนตอบแล้ว โชว์คำตอบ
                adminReplyHtml = `
                    <div style="margin-top: 10px; background: #f0fdf4; padding: 10px; border-radius: 6px; border-left: 3px solid #10b981; font-size: 0.9rem;">
                        <strong style="color: #10b981;"><i class="fas fa-user-md"></i> ${qa.ans_by} (ผู้ตอบ):</strong> ${qa.answer}
                    </div>
                `;
            } else if (user.role === 'admin') {
                // ถ้าแอดมินดูอยู่ และยังไม่มีคนตอบ จะเห็นช่องให้พิมพ์ตอบ
                adminReplyHtml = `
                    <div style="margin-top: 10px; display: flex; gap: 5px;">
                        <input type="text" id="reply_${qa.id}" placeholder="พิมพ์คำตอบในฐานะผู้ดูแล..." style="width: 100%; padding: 5px 10px; border-radius: 4px; border: 1px solid #cbd5e1; font-family: 'Prompt'; font-size: 0.85rem;">
                        <button class="btn btn-sm btn-success" onclick="replyQA('${qa.id}')" style="white-space: nowrap;"><i class="fas fa-reply"></i> ตอบ</button>
                    </div>
                `;
            }
            
            container.innerHTML += `
                <div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #e2e8f0;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                        <strong><i class="fas fa-user-circle" style="color: var(--primary-color);"></i> ${qa.user_name}</strong>
                        <small style="color: #94a3b8;">${qa.date}</small>
                    </div>
                    <p style="margin: 0; color: var(--text-main); line-height: 1.5;">${qa.question}</p>
                    ${adminReplyHtml}
                </div>
            `;
        });
        container.scrollTop = container.scrollHeight; // เลื่อนให้เห็นข้อความล่าสุด
    }
}

async function submitQA() {
    const text = document.getElementById('qaInput').value.trim();
    if(!text) return;
    
    const user = JSON.parse(localStorage.getItem('swd_user'));
    showLoader();
    await callAPI('askQuestion', {
        course_id: currentClassCourse.id, user_id: user.id, user_name: user.name, question: text
    });
    hideLoader();
    
    document.getElementById('qaInput').value = '';
    loadQA(); // โหลดกระดานใหม่
}

async function replyQA(qaId) {
    const text = document.getElementById('reply_' + qaId).value.trim();
    if(!text) return;
    
    const user = JSON.parse(localStorage.getItem('swd_user'));
    showLoader();
    await callAPI('answerQuestion', { qa_id: qaId, answer: text, admin_name: user.name });
    hideLoader();
    loadQA();
}

// ================= Star Rating Logic =================
let selectedRating = 0;

// แนบ Event ให้ดาวเปลี่ยนสีตอนกด
document.querySelectorAll('.star-btn').forEach(star => {
    star.addEventListener('click', function() {
        selectedRating = this.getAttribute('data-val');
        document.querySelectorAll('.star-btn').forEach(s => {
            if(s.getAttribute('data-val') <= selectedRating) {
                s.style.color = '#fbbf24'; // สีทอง
            } else {
                s.style.color = '#cbd5e1'; // สีเทา
            }
        });
    });
});

function openReviewModal() {
    selectedRating = 0;
    document.querySelectorAll('.star-btn').forEach(s => s.style.color = '#cbd5e1'); // ล้างสี
    document.getElementById('reviewComment').value = '';
    document.getElementById('reviewModal').classList.remove('hidden');
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.add('hidden');
    exitClassroom(); // ประเมินเสร็จ ให้ออกจากห้องเรียนกลับหน้าหลัก
}

async function submitCourseReview() {
    if(selectedRating === 0) return showAlert('แจ้งเตือน', 'กรุณากดให้คะแนนดาวก่อนส่งครับ ⭐️');
    
    const user = JSON.parse(localStorage.getItem('swd_user'));
    showLoader();
    await callAPI('submitReview', {
        course_id: currentClassCourse.id, user_id: user.id, user_name: user.name, 
        rating: selectedRating, comment: document.getElementById('reviewComment').value
    });
    hideLoader();
    
    showAlert('ขอบคุณครับ', 'ระบบได้รับผลการประเมินของคุณเรียบร้อยแล้ว');
    closeReviewModal();
}
// ฟังก์ชัน เปิด-ปิด แถบ Q&A
function toggleQA() {
    const content = document.getElementById('qaContent');
    const chevron = document.getElementById('qaChevron');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)'; // หมุนลูกศรขึ้น
        // เลื่อนหน้าจอลงมาให้เห็นช่องคำถามชัดเจน
        setTimeout(() => {
            content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        content.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)'; // หมุนลูกศรกลับ
    }
}
// ฟังก์ชัน เปิด-ปิด เมนูแฮมเบอร์เกอร์
function toggleSidebar() {
    const body = document.body;
    const overlay = document.getElementById('sidebarOverlay');
    
    if (body.classList.contains('sidebar-open')) {
        body.classList.remove('sidebar-open');
        overlay.classList.add('hidden');
    } else {
        body.classList.add('sidebar-open');
        overlay.classList.remove('hidden');
    }
}

// อัปเดตฟังก์ชัน switchTab ทุกตัว ให้ปิด Sidebar อัตโนมัติเมื่อกดเลือกเมนู (ในมือถือ)
const originalSwitchUserTab = switchUserTab;
switchUserTab = function(tabId, element) {
    originalSwitchUserTab(tabId, element); // รันฟังก์ชันเดิม
    if (window.innerWidth <= 768) {
        toggleSidebar(); // ปิดเมนูเมื่อเลือกแท็บเสร็จ
    }
};

const originalSwitchAdminTab = switchAdminTab;
switchAdminTab = function(tabId, element) {
    originalSwitchAdminTab(tabId, element); // รันฟังก์ชันเดิม
    if (window.innerWidth <= 768) {
        toggleSidebar(); // ปิดเมนูเมื่อเลือกแท็บเสร็จ
    }
};
let adminExternalRecommendationsData = [];

function normalizeExternalUrl(url) {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `https://${url}`;
}

function formatHoursLabel(hours) {
    const numericHours = parseFloat(hours) || 0;
    const hr = Math.floor(numericHours);
    const min = Math.round((numericHours - hr) * 60);
    if (hr === 0 && min === 0) return '0 ชม.';
    if (min === 0) return `${hr} ชม.`;
    return `${hr} ชม. ${min} นาที`;
}

function splitHoursAndMinutes(hours) {
    const numericHours = parseFloat(hours) || 0;
    const hr = Math.floor(numericHours);
    const min = Math.round((numericHours - hr) * 60);
    return { hours: hr, minutes: min };
}

function getStatusText(status) {
    if (status === 'inactive') return 'ปิดลงทะเบียน';
    if (status === 'deleted') return 'ลบแล้ว';
    return 'เปิดลงทะเบียน';
}

function getStatusBadge(status) {
    const normalizedStatus = status || 'active';
    return `<span class="table-status-badge ${normalizedStatus}">${getStatusText(normalizedStatus)}</span>`;
}

function getToggleRegistrationAction(status) {
    if (status === 'inactive') {
        return {
            nextStatus: 'active',
            label: 'เปิดลงทะเบียน',
            className: 'btn-success',
            icon: 'fa-lock-open'
        };
    }

    return {
        nextStatus: 'inactive',
        label: 'ปิดลงทะเบียน',
        className: 'btn-warning',
        icon: 'fa-user-lock'
    };
}

function renderEmptyGrid(gridId, message) {
    const grid = document.getElementById(gridId);
    if (!grid) return;
    grid.innerHTML = `<div class="empty-grid">${message}</div>`;
}

async function loadCourses(force = false) {
    const user = appState.user || getCurrentUser();
    if (!user) return [];

    if (!force && appState.coursesLoaded) {
        filterCourses();
        return globalCourses;
    }

    const requestToken = ++courseRequestToken;
    showLoader();

    try {
        const [res, enrollRes] = await Promise.all([
            callAPI('getCourses', {}),
            callAPI('getUserEnrollments', { user_id: user.id })
        ]);

        if (requestToken !== courseRequestToken) return globalCourses;

        if (res.status === 'success' && enrollRes.status === 'success') {
            globalCourses = res.data || [];
            cachedUserEnrollments = enrollRes.data || [];
            appState.coursesLoaded = true;
            filterCourses();
            return globalCourses;
        }

        renderCourseGrid([]);
        showAlert('ข้อผิดพลาด', (res.message || enrollRes.message || 'ไม่สามารถโหลดหลักสูตรได้'));
    } finally {
        hideLoader();
    }

    return [];
}

function renderCourseGrid(coursesToRender) {
    const grid = document.getElementById('courseGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (!coursesToRender || coursesToRender.length === 0) {
        renderEmptyGrid('courseGrid', 'ไม่พบหลักสูตรที่ค้นหา');
        return;
    }

    coursesToRender.forEach(course => {
        const enrollData = cachedUserEnrollments.find(e => e.course_id === course.id);
        let btnText = 'เข้าสู่บทเรียน';
        let btnClass = 'btn-primary';

        if (enrollData) {
            if (enrollData.status === 'completed') {
                btnText = 'เข้าเรียนอีกครั้ง';
                btnClass = 'btn-outline';
            } else {
                try {
                    const prog = JSON.parse(enrollData.progress || '{}');
                    if (prog.completed && prog.completed.length > 0) {
                        btnText = 'เรียนต่อ';
                        btnClass = 'btn-success';
                    }
                } catch (error) {}
            }
        }

        grid.innerHTML += `
            <div class="course-card">
                <img src="${getDriveImageUrl(course.image)}" class="course-img" alt="${course.title}">
                <div class="course-info">
                    <h4 class="course-title">${course.title}</h4>
                    <div class="course-meta">
                        <span><i class="fas fa-building"></i> ${course.organizer || '-'}</span>
                        <span><i class="fas fa-clock"></i> ${formatHoursLabel(course.hours)}</span>
                    </div>
                    <button class="btn ${btnClass} w-100" onclick="enrollCourse('${course.id}')">${btnText}</button>
                </div>
            </div>
        `;
    });
}

async function loadExternalRecommendations(force = false) {
    if (!force && appState.externalRecommendationsLoaded) {
        renderExternalRecommendationGrid(externalRecommendationCourses);
        return externalRecommendationCourses;
    }

    const requestToken = ++externalRecommendationRequestToken;
    showLoader();

    try {
        const res = await callAPI('getExternalRecommendations', {});
        if (requestToken !== externalRecommendationRequestToken) return externalRecommendationCourses;

        if (res.status === 'success') {
            externalRecommendationCourses = res.data || [];
            appState.externalRecommendationsLoaded = true;
            renderExternalRecommendationGrid(externalRecommendationCourses);
            return externalRecommendationCourses;
        }

        renderExternalRecommendationGrid([]);
        showAlert('ข้อผิดพลาด', res.message || 'ไม่สามารถโหลดหลักสูตรภายนอกได้');
    } finally {
        hideLoader();
    }

    return [];
}

function renderExternalRecommendationGrid(recommendations) {
    const grid = document.getElementById('externalRecommendationGrid');
    if (!grid) return;

    grid.innerHTML = '';
    if (!recommendations || recommendations.length === 0) {
        renderEmptyGrid('externalRecommendationGrid', 'ยังไม่มีหลักสูตรภายนอกแนะนำ');
        return;
    }

    recommendations.forEach(course => {
        grid.innerHTML += `
            <div class="course-card course-card-external">
                <img src="${getDriveImageUrl(course.cover_image)}" class="course-img" alt="${course.title}">
                <div class="course-info">
                    <div class="course-badge">ภายนอก</div>
                    <h4 class="course-title">${course.title}</h4>
                    <div class="course-meta">
                        <span><i class="fas fa-building"></i> ${course.organizer || '-'}</span>
                        <span><i class="fas fa-clock"></i> ${formatHoursLabel(course.hours)}</span>
                    </div>
                    <button class="btn btn-primary w-100" onclick="openExternalRegistration('${normalizeExternalUrl(course.register_url)}')">ลงทะเบียน</button>
                </div>
            </div>
        `;
    });
}

function openExternalRegistration(url) {
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl) {
        showAlert('แจ้งเตือน', 'ยังไม่ได้ระบุ URL สำหรับลงทะเบียน');
        return;
    }
    window.open(normalizedUrl, '_blank', 'noopener,noreferrer');
}

switchUserTab = function(tabId, element) {
    const tabs = document.querySelectorAll('.user-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));

    const menus = document.querySelectorAll('#userMenu li');
    menus.forEach(menu => menu.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');
    if (element) element.classList.add('active');

    if (tabId === 'dashboardTab') refreshDashboardData();
    if (tabId === 'historyTab') loadTrainingHistory();
    if (tabId === 'profileTab') {
        const user = getCurrentUser();
        if (user) {
            document.getElementById('pName').value = user.name;
            document.getElementById('pPosition').value = user.position || '';
            document.getElementById('pUsername').value = user.username || '-';
            document.getElementById('pDept').value = user.department;
            document.getElementById('pPassword').value = '';
            document.getElementById('profilePreview').src = user.profile_img || 'https://via.placeholder.com/150';
        }
    }

    if (window.innerWidth <= 768 && document.body.classList.contains('sidebar-open')) {
        toggleSidebar();
    }
};

goToAdminPanel = function() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    const reportMenu = document.querySelector('.admin-sidebar .sidebar-menu li');
    switchAdminTab('reportTab', reportMenu);
};

switchAdminTab = function(tabId, element = null) {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));

    const menus = document.querySelectorAll('.admin-sidebar .sidebar-menu li');
    menus.forEach(menu => menu.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    if (element) {
        element.classList.add('active');
    } else {
        const fallback = Array.from(menus).find(menu => menu.getAttribute('onclick') && menu.getAttribute('onclick').includes(`'${tabId}'`));
        if (fallback) fallback.classList.add('active');
    }

    if (tabId === 'reportTab') loadAdminReport();
    if (tabId === 'courseMgtTab') {
        resetCourseForm();
        resetExternalRecommendationForm();
        loadAdminCoursesTable();
        loadAdminExternalRecommendationsTable();
    }
    if (tabId === 'examMgtTab') initExamAdmin();
    if (tabId === 'approveExtTab') loadAdminExtRequests();
    if (tabId === 'userMgtTab') loadAdminUsersTable();
    if (tabId === 'courseReportTab') initCourseReportAdmin();

    if (window.innerWidth <= 768 && document.body.classList.contains('sidebar-open')) {
        toggleSidebar();
    }
};

async function loadAdminExternalRecommendationsTable() {
    const tbody = document.getElementById('adminExternalCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>';
    const res = await callAPI('getExternalRecommendations', { admin_view: true });

    if (res.status !== 'success') {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        return;
    }

    adminExternalRecommendationsData = res.data || [];
    if (adminExternalRecommendationsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">ยังไม่มีหลักสูตรภายนอกแนะนำ</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminExternalRecommendationsData.forEach(course => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.organizer || '-'}</td>
                <td>${formatHoursLabel(course.hours)}</td>
                <td><a href="${normalizeExternalUrl(course.register_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">เปิดลิงก์</a></td>
                <td><button class="btn btn-action btn-edit" onclick="editExternalRecommendation('${course.rec_id}')"><i class="fas fa-edit"></i> แก้ไข</button></td>
            </tr>
        `;
    });
}

function resetExternalRecommendationForm() {
    const form = document.getElementById('externalRecommendationForm');
    if (!form) return;

    form.reset();
    document.getElementById('editExtRecId').value = '';
    document.getElementById('extRecCover').value = '';
    document.getElementById('extRecCoverStatus').innerText = '';
    document.getElementById('extRecHours').value = '';
    document.getElementById('extRecMins').value = '';
    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-link"></i> เพิ่มหลักสูตรภายนอกแนะนำ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> บันทึกหลักสูตรภายนอก';
    document.getElementById('btnCancelExternalRecEdit').classList.add('hidden');
}

function editExternalRecommendation(recId) {
    const course = adminExternalRecommendationsData.find(item => item.rec_id === recId);
    if (!course) return;
    const duration = splitHoursAndMinutes(course.hours);

    document.getElementById('editExtRecId').value = course.rec_id;
    document.getElementById('extRecTitle').value = course.title || '';
    document.getElementById('extRecOrganizer').value = course.organizer || '';
    document.getElementById('extRecHours').value = duration.hours;
    document.getElementById('extRecMins').value = duration.minutes;
    document.getElementById('extRecCover').value = course.cover_image || '';
    document.getElementById('extRecUrl').value = course.register_url || '';
    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-edit"></i> แก้ไขหลักสูตรภายนอกแนะนำ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข';
    document.getElementById('btnCancelExternalRecEdit').classList.remove('hidden');
    document.getElementById('externalRecommendationForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const externalRecommendationForm = document.getElementById('externalRecommendationForm');
if (externalRecommendationForm) {
    externalRecommendationForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const hours = parseFloat(document.getElementById('extRecHours').value) || 0;
        const minutes = parseFloat(document.getElementById('extRecMins').value) || 0;
        const totalHours = +(hours + (minutes / 60)).toFixed(2);
        const editId = document.getElementById('editExtRecId').value;
        const currentRecommendation = adminExternalRecommendationsData.find(item => item.rec_id === editId);

        const payload = {
            title: document.getElementById('extRecTitle').value.trim(),
            organizer: document.getElementById('extRecOrganizer').value.trim(),
            hours: totalHours,
            cover_image: document.getElementById('extRecCover').value.trim(),
            register_url: normalizeExternalUrl(document.getElementById('extRecUrl').value.trim()),
            status: currentRecommendation ? (currentRecommendation.status || 'active') : 'active'
        };

        if (!payload.title || !payload.organizer || !payload.cover_image || !payload.register_url) {
            return showAlert('แจ้งเตือน', 'กรุณากรอกข้อมูลหลักสูตรภายนอกให้ครบทุกช่อง');
        }

        const action = editId ? 'updateExternalRecommendation' : 'addExternalRecommendation';
        if (editId) payload.rec_id = editId;

        showLoader();
        const res = await callAPI(action, payload);
        hideLoader();

        if (res.status === 'success') {
            appState.externalRecommendationsLoaded = false;
            setDashboardRefreshNeeded();
            showAlert('สำเร็จ', res.message);
            resetExternalRecommendationForm();
            loadAdminExternalRecommendationsTable();
        } else {
            showAlert('ข้อผิดพลาด', res.message || 'ไม่สามารถบันทึกหลักสูตรภายนอกได้');
        }
    });
}

loadAdminCoursesTable = async function() {
    const tbody = document.getElementById('adminCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>';
    const res = await callAPI('getAdminCourses', {});

    if (res.status !== 'success') {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        return;
    }

    adminCoursesData = (res.data || []).filter(course => (course.status || 'active') !== 'deleted');
    if (adminCoursesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">ยังไม่มีหลักสูตรในระบบ</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminCoursesData.forEach(course => {
        const status = course.status || 'active';
        const toggleAction = getToggleRegistrationAction(status);

        tbody.innerHTML += `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.organizer || '-'}</td>
                <td>${formatHoursLabel(course.hours)}</td>
                <td>${getStatusBadge(status)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-action btn-edit" onclick="editCourse('${course.course_id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                        <button class="btn btn-action ${toggleAction.className}" onclick="changeCourseStatus('${course.course_id}', '${toggleAction.nextStatus}')"><i class="fas ${toggleAction.icon}"></i> ${toggleAction.label}</button>
                        <button class="btn btn-action btn-danger" onclick="changeCourseStatus('${course.course_id}', 'deleted')"><i class="fas fa-trash-alt"></i> ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    });
};

async function changeCourseStatus(courseId, nextStatus) {
    const course = adminCoursesData.find(item => item.course_id === courseId);
    if (!course) return;

    const actionLabel = nextStatus === 'deleted' ? 'ลบหลักสูตร' : (nextStatus === 'inactive' ? 'ปิดลงทะเบียน' : 'เปิดลงทะเบียน');
    const message = nextStatus === 'deleted'
        ? `ยืนยันการลบหลักสูตร "${course.title}" ใช่หรือไม่?`
        : `ยืนยันการ${actionLabel}สำหรับหลักสูตร "${course.title}" ใช่หรือไม่?`;
    const confirmed = await showConfirm('ยืนยันการทำรายการ', message);
    if (!confirmed) return;

    showLoader();
    const res = await callAPI('updateCourseStatus', { course_id: courseId, status: nextStatus });
    hideLoader();

    if (res.status === 'success') {
        appState.coursesLoaded = false;
        setDashboardRefreshNeeded();
        if (document.getElementById('editCourseId').value === courseId) {
            resetCourseForm();
        }
        showAlert('สำเร็จ', nextStatus === 'deleted' ? 'ลบหลักสูตรเรียบร้อยแล้ว' : res.message);
        loadAdminCoursesTable();
    } else {
        showAlert('ข้อผิดพลาด', res.message || 'ไม่สามารถอัปเดตสถานะหลักสูตรได้');
    }
}

loadAdminExternalRecommendationsTable = async function() {
    const tbody = document.getElementById('adminExternalCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>';
    const res = await callAPI('getExternalRecommendations', { admin_view: true });

    if (res.status !== 'success') {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">โหลดข้อมูลไม่สำเร็จ</td></tr>';
        return;
    }

    adminExternalRecommendationsData = (res.data || []).filter(course => (course.status || 'active') !== 'deleted');
    if (adminExternalRecommendationsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">ยังไม่มีหลักสูตรภายนอกแนะนำ</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminExternalRecommendationsData.forEach(course => {
        const status = course.status || 'active';
        const toggleAction = getToggleRegistrationAction(status);

        tbody.innerHTML += `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.organizer || '-'}</td>
                <td>${formatHoursLabel(course.hours)}</td>
                <td><a href="${normalizeExternalUrl(course.register_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">เปิดลิงก์</a></td>
                <td>${getStatusBadge(status)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-action btn-edit" onclick="editExternalRecommendation('${course.rec_id}')"><i class="fas fa-edit"></i> แก้ไข</button>
                        <button class="btn btn-action ${toggleAction.className}" onclick="changeExternalRecommendationStatus('${course.rec_id}', '${toggleAction.nextStatus}')"><i class="fas ${toggleAction.icon}"></i> ${toggleAction.label}</button>
                        <button class="btn btn-action btn-danger" onclick="changeExternalRecommendationStatus('${course.rec_id}', 'deleted')"><i class="fas fa-trash-alt"></i> ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    });
};

async function changeExternalRecommendationStatus(recId, nextStatus) {
    const course = adminExternalRecommendationsData.find(item => item.rec_id === recId);
    if (!course) return;

    const actionLabel = nextStatus === 'deleted' ? 'ลบหลักสูตรภายนอก' : (nextStatus === 'inactive' ? 'ปิดลงทะเบียน' : 'เปิดลงทะเบียน');
    const message = nextStatus === 'deleted'
        ? `ยืนยันการลบหลักสูตร "${course.title}" ใช่หรือไม่?`
        : `ยืนยันการ${actionLabel}สำหรับหลักสูตร "${course.title}" ใช่หรือไม่?`;
    const confirmed = await showConfirm('ยืนยันการทำรายการ', message);
    if (!confirmed) return;

    showLoader();
    const res = await callAPI('updateExternalRecommendationStatus', { rec_id: recId, status: nextStatus });
    hideLoader();

    if (res.status === 'success') {
        appState.externalRecommendationsLoaded = false;
        setDashboardRefreshNeeded();
        if (document.getElementById('editExtRecId').value === recId) {
            resetExternalRecommendationForm();
        }
        showAlert('สำเร็จ', nextStatus === 'deleted' ? 'ลบหลักสูตรภายนอกเรียบร้อยแล้ว' : res.message);
        loadAdminExternalRecommendationsTable();
    } else {
        showAlert('ข้อผิดพลาด', res.message || 'ไม่สามารถอัปเดตสถานะหลักสูตรภายนอกได้');
    }
}

editAdminUser = function(userId) {
    const user = adminUsersData.find(u => u.id === userId);
    if (!user) return;

    document.getElementById('editUserSection').classList.remove('hidden');
    document.getElementById('editUserId').value = user.id;
    document.getElementById('euName').value = user.name;
    document.getElementById('euUsername').value = user.username;
    document.getElementById('euPosition').value = user.position || '';
    document.getElementById('euDept').value = user.department || '';
    document.getElementById('euEmail').value = user.email || '';
    document.getElementById('euPassword').value = user.password || '';
    document.getElementById('euRole').value = user.role || 'user';
    document.getElementById('editUserSection').scrollIntoView({ behavior: 'smooth' });
};
