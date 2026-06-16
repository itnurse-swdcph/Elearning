const API_URL = 'https://script.google.com/macros/s/AKfycbxlfD-5saP7FtUX_YxuBe3gowToA38b0qc0jW5JuWjMN9XotTlqRfc0LuaWtibYNwMp1Q/exec'; 
const appState = {
    user: null,
    dashboardNeedsRefresh: true,
    dashboardStats: null,
    externalRecommendationsLoaded: false
};

const POSITION_PRESETS = [
    'นักวิชาการสาธารณสุข(พยาบาล)',
    'พยาบาลวิชาชีพ',
    'พยาบาลวิชาชีพปฏิบัติการ',
    'พยาบาลวิชาชีพชำนาญการ',
    'พยาบาลวิชาชีพชำนาญการพิเศษ',
    'พนักงานช่วยเหลือคนไข้',
    'พนักงานประจำตึก'
];

let loaderCount = 0;
let courseRequestToken = 0;
let externalRecommendationRequestToken = 0;

let orgStructure = [];
let mouScoreDefault = 0;
let currentExtMode = 'A';
let pendingExtPayload = null;
let editingExtTrainingId = null;
let currentPassedCourse = null;


function classifyPositionGroup(position) {
    const normalized = String(position || '').trim();
    const profKeywords = [
        'พยาบาลวิชาชีพ',
        'นักวิชาการสาธารณสุข',
        'นักฉุกเฉินการแพทย์',
        'เจ้าพนักงานสาธารณสุข',
        'เจ้าพนักงานฉุกเฉินการแพทย์'
    ];
    for (let i = 0; i < profKeywords.length; i++) {
        if (normalized.indexOf(profKeywords[i]) !== -1) {
            return 'professional';
        }
    }
    return 'support';
}

function ensureForgotPasswordModal() {
    if (document.getElementById('forgotPasswordModal')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'forgotPasswordModal';
    wrapper.className = 'modal hidden';
    wrapper.innerHTML = `
        <div class="modal-content" style="text-align: left; max-width: 460px;">
            <h3 style="margin-bottom: 10px;">ลืมรหัสผ่าน</h3>
            <p style="margin-bottom: 20px;">กรอกอีเมลที่ใช้ลงทะเบียน ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลนั้น</p>
            <form id="forgotPasswordForm">
                <div class="input-group">
                    <input type="email" id="forgotPasswordEmail" placeholder="อีเมลที่ลงทะเบียนไว้" required>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="closeForgotPasswordModal()" class="btn btn-outline">ยกเลิก</button>
                    <button type="submit" class="btn btn-primary">ส่งลิงก์รีเซ็ต</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(wrapper);
}

function applyAuthTextOverrides() {
    const loginIdentifierInput = document.getElementById('loginUsername');
    if (loginIdentifierInput) {
        loginIdentifierInput.placeholder = 'Username หรือ Email';
    }

    const forgotModal = document.getElementById('forgotPasswordModal');
    if (forgotModal) {
        const modalTitle = forgotModal.querySelector('h3');
        const modalDescription = forgotModal.querySelector('p');
        const emailInput = document.getElementById('forgotPasswordEmail');
        const actionButton = forgotModal.querySelector('button[type="submit"]');

        if (modalTitle) modalTitle.textContent = 'ลืมชื่อผู้ใช้ / ลืมรหัสผ่าน';
        if (modalDescription) modalDescription.textContent = 'กรอกอีเมลที่ใช้ลงทะเบียน ระบบจะส่งชื่อผู้ใช้และลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมลนั้น';
        if (emailInput) emailInput.placeholder = 'อีเมลที่ลงทะเบียนไว้';
        if (actionButton) actionButton.textContent = 'ส่งข้อมูลกู้บัญชี';
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const helperButton = loginForm.querySelector('.text-link-btn');
        if (helperButton) {
            helperButton.textContent = 'ลืมชื่อผู้ใช้ / ลืมรหัสผ่าน';
        }
    }
}

function populatePositionSelectOptions(select) {
    if (!select || select.dataset.positionOptionsReady === 'true') return;

    const currentValue = select.value;
    const placeholderLabel = select.dataset.placeholder || 'เลือกตำแหน่ง';
    select.innerHTML = '';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = placeholderLabel;
    select.appendChild(placeholder);

    POSITION_PRESETS.forEach((position) => {
        const option = document.createElement('option');
        option.value = position;
        option.textContent = position;
        select.appendChild(option);
    });

    const otherOption = document.createElement('option');
    otherOption.value = '__other__';
    otherOption.textContent = 'ตำแหน่งอื่น ๆ';
    select.appendChild(otherOption);

    select.dataset.positionOptionsReady = 'true';
    if (currentValue) {
        select.value = currentValue;
    }
}

function handlePositionFieldChange(selectId, otherInputId) {
    const select = document.getElementById(selectId);
    const otherInput = document.getElementById(otherInputId);
    if (!select || !otherInput) return;

    const isOther = select.value === '__other__';
    otherInput.classList.toggle('hidden', !isOther);
    otherInput.required = isOther;
    if (!isOther) {
        otherInput.value = '';
    }
}

function setPositionFieldValue(selectId, otherInputId, value) {
    const select = document.getElementById(selectId);
    const otherInput = document.getElementById(otherInputId);
    if (!select || !otherInput) return;

    populatePositionSelectOptions(select);
    const normalized = String(value || '').trim();

    if (!normalized) {
        select.value = '';
        otherInput.value = '';
        handlePositionFieldChange(selectId, otherInputId);
        return;
    }

    if (POSITION_PRESETS.includes(normalized)) {
        select.value = normalized;
        otherInput.value = '';
    } else {
        select.value = '__other__';
        otherInput.value = normalized;
    }

    handlePositionFieldChange(selectId, otherInputId);
}

function getPositionFieldValue(selectId, otherInputId) {
    const select = document.getElementById(selectId);
    const otherInput = document.getElementById(otherInputId);
    if (!select) return '';
    return select.value === '__other__'
        ? String(otherInput ? otherInput.value : '').trim()
        : String(select.value || '').trim();
}

function enhancePositionInput(selectId, otherInputId) {
    const existingField = document.getElementById(selectId);
    if (!existingField) return;

    let select = existingField;
    const parent = existingField.parentElement;
    const originalValue = String(existingField.value || '').trim();

    if (existingField.tagName !== 'SELECT') {
        select = document.createElement('select');
        select.id = selectId;
        select.required = existingField.required;
        select.className = existingField.className;
        select.dataset.placeholder = existingField.placeholder || 'เลือกตำแหน่ง';
        select.setAttribute('onchange', `handlePositionFieldChange('${selectId}', '${otherInputId}')`);
        parent.replaceChild(select, existingField);
    }

    populatePositionSelectOptions(select);

    let otherInput = document.getElementById(otherInputId);
    if (!otherInput) {
        otherInput = document.createElement('input');
        otherInput.type = 'text';
        otherInput.id = otherInputId;
        otherInput.placeholder = 'พิมพ์ตำแหน่งอื่น ๆ';
        otherInput.className = 'hidden';
        parent.appendChild(otherInput);
    }

    if (!select.getAttribute('onchange')) {
        select.setAttribute('onchange', `handlePositionFieldChange('${selectId}', '${otherInputId}')`);
    }

    setPositionFieldValue(selectId, otherInputId, originalValue);
}

function togglePasswordVisibility(inputId, button) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const nextType = input.type === 'password' ? 'text' : 'password';
    input.type = nextType;
    if (button) {
        button.textContent = nextType === 'password' ? 'แสดง' : 'ซ่อน';
    }
}

function enhancePasswordField(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    if (input.parentElement && input.parentElement.classList.contains('password-field')) return;

    input.type = 'password';
    const wrapper = document.createElement('div');
    wrapper.className = 'password-field';
    input.parentNode.insertBefore(wrapper, input);
    wrapper.appendChild(input);

    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.className = 'password-toggle';
    toggleButton.textContent = 'แสดง';
    toggleButton.addEventListener('click', () => togglePasswordVisibility(inputId, toggleButton));
    wrapper.appendChild(toggleButton);
}

function ensureRegisterConfirmPasswordField() {
    if (document.getElementById('regConfirmPassword')) return;

    const registerPassword = document.getElementById('regPassword');
    if (!registerPassword || !registerPassword.parentElement) return;

    const passwordGroup = registerPassword.closest('.input-group');
    if (!passwordGroup || !passwordGroup.parentElement) return;

    const confirmGroup = document.createElement('div');
    confirmGroup.className = 'input-group';
    confirmGroup.innerHTML = '<input type="password" id="regConfirmPassword" placeholder="ยืนยันรหัสผ่านอีกครั้ง" required>';
    passwordGroup.insertAdjacentElement('afterend', confirmGroup);
    enhancePasswordField('regConfirmPassword');
}

function ensureForgotPasswordTrigger() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    const existingTrigger = loginForm.querySelector('[data-auth-helper="forgot-password"]');
    if (existingTrigger) {
        existingTrigger.textContent = 'ลืมชื่อผู้ใช้ / ลืมรหัสผ่าน';
        return;
    }

    const switchForm = loginForm.querySelector('.switch-form');
    if (!switchForm) return;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'text-link-btn';
    trigger.dataset.authHelper = 'forgot-password';
    trigger.textContent = 'ลืมชื่อผู้ใช้ / ลืมรหัสผ่าน';
    trigger.addEventListener('click', openForgotPasswordModal);
    switchForm.insertAdjacentElement('afterend', trigger);
}

function populateOrgStructureDropdowns() {
    // Populate Working Group dropdowns
    const workingGroups = Array.from(new Set(orgStructure.map(item => item.working_group).filter(Boolean)));
    
    const wgs = ['regWorkingGroup', 'pWorkingGroup', 'euWorkingGroup', 'adminReportWorkingGroupFilter'];
    wgs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const defaultText = id === 'adminReportWorkingGroupFilter' ? 'ทุกกลุ่มงาน' : 'เลือกกลุ่มงาน';
            el.innerHTML = `<option value="">${defaultText}</option>`;
            workingGroups.forEach(wg => {
                const opt = document.createElement('option');
                opt.value = wg;
                opt.textContent = wg;
                el.appendChild(opt);
            });
        }
    });
    
    // Populate deptList (datalist) with all unique departments
    const departments = Array.from(new Set(orgStructure.map(item => item.department).filter(Boolean)));
    const deptList = document.getElementById('deptList');
    if (deptList) {
        deptList.innerHTML = '';
        departments.forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            deptList.appendChild(opt);
        });
    }

    // Also populate adminReportDeptFilter
    const adminReportDeptFilter = document.getElementById('adminReportDeptFilter');
    if (adminReportDeptFilter) {
        adminReportDeptFilter.innerHTML = '<option value="">ทุกหน่วยงาน</option>';
        departments.forEach(dept => {
            const opt = document.createElement('option');
            opt.value = dept;
            opt.textContent = dept;
            adminReportDeptFilter.appendChild(opt);
        });
    }
}

async function loadOrgStructure() {
    try {
        const res = await callAPI('getSettings', {});
        if (res && res.status === 'success') {
            orgStructure = res.org_structure || [];
            mouScoreDefault = res.mou_score_default || 0;
            populateOrgStructureDropdowns();
        }
    } catch (err) {
        console.error("ระบบไม่สามารถโหลดโครงสร้างหน่วยงานได้:", err);
    }
}

function onWorkingGroupChange(wgSelectId, deptSelectId) {
    const wgSelect = document.getElementById(wgSelectId);
    const deptSelect = document.getElementById(deptSelectId);
    if (!wgSelect || !deptSelect) return;
    
    const selectedWg = wgSelect.value;
    const defaultText = (deptSelectId === 'adminReportDeptFilter') ? 'ทุกหน่วยงาน' : 'เลือกหน่วยงาน';
    deptSelect.innerHTML = `<option value="">${defaultText}</option>`;
    
    let filteredDepts = [];
    if (selectedWg) {
        filteredDepts = orgStructure
            .filter(item => item.working_group === selectedWg)
            .map(item => item.department)
            .filter(Boolean);
    } else {
        // if no working group selected, show all departments
        filteredDepts = Array.from(new Set(orgStructure.map(item => item.department).filter(Boolean)));
    }
    
    // remove duplicates
    filteredDepts = Array.from(new Set(filteredDepts));
    
    filteredDepts.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept;
        opt.textContent = dept;
        deptSelect.appendChild(opt);
    });
    
    if (wgSelectId === 'adminReportWorkingGroupFilter') {
        filterAdminReport();
    }
}

window.addEventListener('DOMContentLoaded', async () => {
    initializeAuthEnhancements();
    
    // 1. จัดการปีปัจจุบัน
    const years = document.querySelectorAll('.current-year');
    const thisYear = new Date().getFullYear();
    years.forEach(el => el.innerText = thisYear);
    
    // 2. โหลดโครงสร้างองค์กร
    await loadOrgStructure();

    // 3. Bind event listeners for Mode B calculator
    const extDateStart = document.getElementById('extDateStart');
    const extDateEnd = document.getElementById('extDateEnd');
    if (extDateStart) extDateStart.addEventListener('input', calculateModeBHours);
    if (extDateEnd) extDateEnd.addEventListener('input', calculateModeBHours);

    // 4. Bind event listener for course cover image preview
    const cCover = document.getElementById('cCover');
    if (cCover) {
        cCover.addEventListener('input', () => {
            const coverPreview = document.getElementById('cCoverPreview');
            if (coverPreview) {
                const val = cCover.value.trim();
                if (val) {
                    coverPreview.src = getDriveImageUrl(val);
                    coverPreview.classList.remove('hidden');
                } else {
                    coverPreview.src = '';
                    coverPreview.classList.add('hidden');
                }
            }
        });
    }

    // 6. [แก้ไข] คำนวณคะแนน MOU อัตโนมัติ (External Recommendation - รองรับชั่วโมงและนาที)
    const extHoursInput = document.getElementById('extHours');
    const extMinsInput = document.getElementById('extMins');
    const extMouScoreInput = document.getElementById('extMouScore');

    if (extHoursInput && extMinsInput && extMouScoreInput) {
        const updateExternalMOUScore = () => {
            const hours = parseFloat(extHoursInput.value) || 0;
            const mins = parseFloat(extMinsInput.value) || 0;
            const totalMinutes = (hours * 60) + mins;
            extMouScoreInput.value = calculateMOUScore(totalMinutes);
        };
        
        extHoursInput.addEventListener('input', updateExternalMOUScore);
        extHoursInput.addEventListener('change', updateExternalMOUScore);
        extMinsInput.addEventListener('input', updateExternalMOUScore);
        extMinsInput.addEventListener('change', updateExternalMOUScore);
    }
    if (typeof toggleCourseDeliveryFields === 'function') {
        toggleCourseDeliveryFields();
    }
});

function initializeAuthEnhancements() {
    ensureForgotPasswordModal();
    applyAuthTextOverrides();
    enhancePasswordField('loginPassword');
    enhancePasswordField('regPassword');
    enhancePasswordField('pPassword');
    enhancePasswordField('euPassword');
    ensureRegisterConfirmPasswordField();
    ensureForgotPasswordTrigger();
    enhancePositionInput('regPosition', 'regPositionOther');
    enhancePositionInput('pPosition', 'pPositionOther');
    enhancePositionInput('euPosition', 'euPositionOther');

    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm && forgotForm.dataset.bound !== 'true') {
        forgotForm.dataset.bound = 'true';
        forgotForm.addEventListener('submit', handleForgotPasswordRequest);
    }
}

function openForgotPasswordModal() {
    ensureForgotPasswordModal();
    const modal = document.getElementById('forgotPasswordModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const emailInput = document.getElementById('forgotPasswordEmail');
    if (emailInput) emailInput.focus();
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (!modal) return;
    modal.classList.add('hidden');
    const form = document.getElementById('forgotPasswordForm');
    if (form) form.reset();
}

async function handleForgotPasswordRequest(e) {
    e.preventDefault();
    const emailInput = document.getElementById('forgotPasswordEmail');
    const email = String(emailInput ? emailInput.value : '').trim();
    if (!email) {
        showAlert('แจ้งเตือน', 'กรุณากรอกอีเมลที่ลงทะเบียนไว้');
        return;
    }


    showLoader();
    const res = await callAPI('requestPasswordReset', {
        email,
        app_url: window.location.href.split('#')[0].split('?')[0]
    });
    hideLoader();

    if (res.status === 'success') {
        closeForgotPasswordModal();
        showAlert('ตรวจสอบอีเมล', res.message || 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งชื่อผู้ใช้และลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้');
    } else {
        showAlert('เกิดข้อผิดพลาด', res.message || 'ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้');
    }
}



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
    if (!url) return "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 180' fill='%23e2e8f0'><rect width='300' height='180' rx='10' fill='%23e2e8f0'/><text x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%2364748b' font-family='sans-serif' font-size='16'>Course Cover</text></svg>";
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
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('customAlert').classList.remove('hidden');
}

function closeAlert() { document.getElementById('customAlert').classList.add('hidden'); }

function showConfirm(title, message, callback) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    const btnYes = document.getElementById('btnConfirmYes');
    
    // ลบ event listener เดิม
    const newBtnYes = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);
    
    newBtnYes.onclick = () => {
        document.getElementById('customConfirm').classList.add('hidden');
        callback(true);
    };
    
    document.getElementById('customConfirm').classList.remove('hidden');
}

function cancelConfirm() {
    document.getElementById('customConfirm').classList.add('hidden');
}

function toggleAuth() {
    document.getElementById('loginForm').classList.toggle('hidden');
    document.getElementById('registerForm').classList.toggle('hidden');
    closeForgotPasswordModal();

    const registerForm = document.getElementById('registerForm');
    if (registerForm && !registerForm.classList.contains('hidden')) {
        loadDepartments();
    }
}


// ================= API Caller =================
async function callAPI(action, payload) {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, payload: payload })
        });
        const rawText = await response.text();
        try {
            return JSON.parse(rawText);
        } catch (parseError) {
            const looksLikeHtml = /^\s*</.test(rawText);
            return {
                status: 'error',
                message: looksLikeHtml
                    ? 'ระบบตอบกลับเป็นหน้าเว็บแทน JSON กรุณาตรวจสอบการ Deploy Google Apps Script ล่าสุด'
                    : 'ระบบตอบกลับข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
            };
        }
    } catch (error) {
        return { status: 'error', message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้' };
    }
}

// ================= Authentication =================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    showLoader();
    const res = await callAPI('login', { username: document.getElementById('loginUsername').value.trim(), password: document.getElementById('loginPassword').value });
    hideLoader();
    if (res.status === 'success') {
        localStorage.setItem('swd_user', JSON.stringify(res.user));
        await initApp({ forceDashboardRefresh: true });
    } else showAlert('ข้อผิดพลาด', res.message);
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const position = getPositionFieldValue('regPosition', 'regPositionOther');

    if (!position) {
        showAlert('แจ้งเตือน', 'กรุณาเลือกหรือระบุตำแหน่ง');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('แจ้งเตือน', 'รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน');
        return;
    }

    showLoader();
    const payload = {
        name: document.getElementById('regName').value.trim(), 
        position: position, 
        working_group: document.getElementById('regWorkingGroup').value.trim(),
        department: document.getElementById('regDept').value.trim(),
        username: document.getElementById('regUsername').value.trim(),
        email: document.getElementById('regEmail').value.trim(), 
        password: password
    };
    const res = await callAPI('register', payload);
    hideLoader();
    if (res.status === 'success') { 
        document.getElementById('registerForm').reset();
        setPositionFieldValue('regPosition', 'regPositionOther', '');
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

    const adminRoles = ['admin', 'working_group_leader', 'department_leader'];
    if (adminRoles.indexOf(user.role) !== -1) {
        document.getElementById('adminBtn').classList.remove('hidden');
    } else {
        document.getElementById('adminBtn').classList.add('hidden');
    }
}

function renderDashboardStats(stats) {
    if (!stats) return;
    const user = appState.user || getCurrentUser();
    const positionGroup = user ? classifyPositionGroup(user.position) : 'support';
    
    const statsRow = document.querySelector('.stats-row');
    if (!statsRow) return;
    
    if (positionGroup === 'professional') {
        const completedHours = parseFloat(stats.totalHours) || 0;
        const remainingHours = Math.max(0, 70 - completedHours).toFixed(2);
        const statusText = completedHours >= 70 ? '<span class="text-success" style="font-weight:bold;">ผ่านเกณฑ์ 10 วัน/ปี</span>' : `<span class="text-danger" style="font-weight:bold;">ยังไม่ผ่านเกณฑ์ (ขาดอีก ${remainingHours} ชม.)</span>`;
        
        statsRow.innerHTML = `
            <div class="stat-card">
                <i class="fas fa-book-reader"></i>
                <div><h4>หลักสูตรที่กำลังเรียน</h4><p class="stat-number">${stats.inProgress}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-certificate text-success"></i>
                <div><h4>ใบประกาศนียบัตรที่ได้รับ</h4><p class="stat-number">${stats.certCount}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-clock text-info"></i>
                <div><h4>ชั่วโมงสะสม (เกณฑ์ 70 ชม.)</h4><p class="stat-number">${completedHours.toFixed(2)}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <div><h4>คะแนน MOU สะสม</h4><p class="stat-number" style="color: #f59e0b;">${parseFloat(stats.totalMOU || 0).toFixed(0)}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-tasks text-warning"></i>
                <div><h4>สถานะพัฒนาตนเอง</h4><p style="font-size: 1.1rem; margin-top: 5px;">${statusText}</p></div>
            </div>
        `;
    } else {
        statsRow.innerHTML = `
            <div class="stat-card">
                <i class="fas fa-book-reader"></i>
                <div><h4>หลักสูตรที่กำลังเรียน</h4><p class="stat-number">${stats.inProgress}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-certificate text-success"></i>
                <div><h4>ใบประกาศนียบัตรที่ได้รับ</h4><p class="stat-number">${stats.certCount}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-clock text-primary"></i>
                <div><h4>ชั่วโมงสะสมรวม</h4><p class="stat-number">${parseFloat(stats.totalHours).toFixed(2)}</p></div>
            </div>
            <div class="stat-card">
                <i class="fas fa-star" style="color: #f59e0b;"></i>
                <div><h4>คะแนน MOU สะสม</h4><p class="stat-number" style="color: #f59e0b;">${parseFloat(stats.totalMOU || 0).toFixed(0)}</p></div>
            </div>
        `;
    }
    
    const totalHoursDisplay = document.getElementById('totalHoursDisplay');
    if (totalHoursDisplay) {
        totalHoursDisplay.innerText = parseFloat(stats.totalHours).toFixed(2);
    }
    const totalMOUDisplay = document.getElementById('totalMOUDisplay');
    if (totalMOUDisplay) {
        totalMOUDisplay.innerText = parseFloat(stats.totalMOU || 0).toFixed(0);
    }
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
    const user = appState.user || getCurrentUser();
    if (!user) return;

    const shouldRefresh = force || appState.dashboardNeedsRefresh || !appState.dashboardStats || globalCourses.length === 0 || !appState.externalRecommendationsLoaded;
    if (!shouldRefresh) {
        filterCourses();
        renderExternalRecommendationGrid(externalRecommendationCourses);
        return;
    }

    showLoader();
    const loaderEl = document.getElementById('loader');
    if (loaderEl) {
        const loaderText = loaderEl.querySelector('.loader-text');
        if (loaderText) loaderText.textContent = 'กำลังโหลดข้อมูล...';
    }

    const TIMEOUT_MS = 25000;
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        hideLoader(true);
        showAlert('แจ้งเตือน', 'ระบบใช้เวลานานกว่าปกติ กรุณาลองใหม่');
    }, TIMEOUT_MS);

    try {
        const res = await callAPI('loadInitialData', { user_id: user.id });
        clearTimeout(timeoutId);
        if (timedOut) return;

        if (res && res.status === 'success') {
            // Update user profile from server (profile_img may have changed)
            if (res.user) {
                const storedUser = getCurrentUser();
                const mergedUser = Object.assign({}, storedUser, res.user);
                localStorage.setItem('swd_user', JSON.stringify(mergedUser));
                appState.user = mergedUser;
                renderCurrentUser(mergedUser);
            }

            // Stats
            if (res.stats) {
                appState.dashboardStats = res.stats;
                renderDashboardStats(res.stats);
            }

            // Courses
            if (res.courses) {
                globalCourses = res.courses;
                appState.coursesLoaded = true;
            }

            // Enrollments
            if (res.enrollments) {
                cachedUserEnrollments = res.enrollments;
            }

            // External recommendations
            if (res.externalRecommendations) {
                externalRecommendationCourses = res.externalRecommendations;
                appState.externalRecommendationsLoaded = true;
            }

            // Org structure & settings
            if (res.org_structure) {
                orgStructure = res.org_structure;
                mouScoreDefault = res.mou_score_default || 0;
                populateOrgStructureDropdowns();
            }

            appState.dashboardNeedsRefresh = false;
            filterCourses();
            renderExternalRecommendationGrid(externalRecommendationCourses);
        } else {
            // Fallback: load separately
            await Promise.all([
                loadDashboardStats(true),
                loadCourses(true),
                loadExternalRecommendations(true)
            ]);
            appState.dashboardNeedsRefresh = false;
        }
    } catch (err) {
        clearTimeout(timeoutId);
        if (!timedOut) {
            showAlert('ข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่');
        }
    } finally {
        hideLoader();
    }
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
    const position = getPositionFieldValue('pPosition', 'pPositionOther');
    if (!position) {
        showAlert('แจ้งเตือน', 'กรุณาเลือกหรือระบุตำแหน่ง');
        return;
    }
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
        position: position,
        working_group: document.getElementById('pWorkingGroup').value,
        department: document.getElementById('pDept').value, 
        password: document.getElementById('pPassword').value,
        profile_img: profileUrl
    });
    hideLoader();

    if(res.status === 'success') {
        user.name = document.getElementById('pName').value;
        user.position = position;
        user.working_group = document.getElementById('pWorkingGroup').value;
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
        setPositionFieldValue('pPosition', 'pPositionOther', user.position || '');
        document.getElementById('pUsername').value = user.username || '-';
        
        document.getElementById('pWorkingGroup').value = user.working_group || '';
        onWorkingGroupChange('pWorkingGroup', 'pDept');
        document.getElementById('pDept').value = user.department || '';
        
        document.getElementById('pPassword').value = '';
        if(user.profile_img) document.getElementById('profilePreview').src = user.profile_img;
    }
}

// ฟังก์ชันโหลดประวัติลงตาราง Portfolio
async function loadTrainingHistory() {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const tbody = document.getElementById('historyTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-light);">กำลังดึงข้อมูลประวัติการอบรม...</td></tr>';
    const res = await callAPI('getUserHistory', { user_id: user.id });
    
    if (res.status === 'success') {
        tbody.innerHTML = ''; 
        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-light);">ยังไม่มีประวัติการอบรมในระบบครับ</td></tr>';
            return;
        }
        
        res.data.forEach(item => {
            const certBtn = item.cert_url && item.cert_url.trim() !== '' 
                ? `<a href="${item.cert_url}" target="_blank" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.85rem; white-space: nowrap;"><i class="fas fa-file-pdf text-danger"></i> หลักฐาน</a>`
                : '<span style="color: #94a3b8; font-size: 0.85rem; white-space: nowrap;">ไม่มีไฟล์</span>';
            
            let statusBadge = '';
            let actionBtns = '-';
            
            if (item.source === 'internal') {
                statusBadge = '<span class="badge" style="background:#10b981; color:white; font-size: 0.7rem; white-space: nowrap;">ผ่านแล้ว</span>';
            } else {
                if (item.status === 'pending') {
                    statusBadge = '<span class="badge" style="background:#f59e0b; color:white; font-size: 0.7rem; white-space: nowrap;">รอตรวจ</span>';
                    actionBtns = `
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button class="btn btn-primary btn-sm" onclick="editExtTraining('${item.ext_id}')" style="padding: 2px 6px; font-size: 0.75rem;"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm" onclick="deleteExtTraining('${item.ext_id}')" style="background:#ef4444; color:white; padding: 2px 6px; font-size: 0.75rem;"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                } else if (item.status === 'rejected') {
                    const rejReason = item.rejection_reason ? ` <i class="fas fa-info-circle text-danger" title="เหตุผล: ${item.rejection_reason}"></i>` : '';
                    statusBadge = `<span class="badge" style="background:#ef4444; color:white; font-size: 0.7rem; white-space: nowrap;">ไม่อนุมัติ</span>${rejReason}`;
                    actionBtns = `
                        <div style="display:flex; gap:4px; justify-content:center;">
                            <button class="btn btn-primary btn-sm" onclick="editExtTraining('${item.ext_id}')" style="padding: 2px 6px; font-size: 0.75rem;"><i class="fas fa-edit"></i></button>
                            <button class="btn btn-sm" onclick="deleteExtTraining('${item.ext_id}')" style="background:#ef4444; color:white; padding: 2px 6px; font-size: 0.75rem;"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                } else {
                    statusBadge = '<span class="badge" style="background:#10b981; color:white; font-size: 0.7rem; white-space: nowrap;">อนุมัติ</span>';
                }
            }
                
            tbody.innerHTML += `
                <tr>
                    <td style="text-align: center; white-space: nowrap;">${item.date || '-'}</td>
                    <td><strong>${item.title}</strong></td>
                    <td>${item.organizer || '-'}</td>
                    <td style="text-align: center; white-space: nowrap;"><span class="badge-hours" style="background: #f1f5f9; color: var(--text-light); box-shadow: none; white-space: nowrap;">${item.type}</span></td>
                    <td style="text-align: center;"><strong>${item.hours}</strong></td>
                    <td style="text-align: center;">${statusBadge}</td>
                    <td style="text-align: center; white-space: nowrap;">${certBtn}</td>
                    <td style="text-align: center;" class="no-print">${actionBtns}</td>
                </tr>
            `;
        });
        
        const certCount = res.data.filter(i => i.status === 'approved' || i.source === 'internal').length;
        document.querySelectorAll('.stat-number')[1].innerText = certCount;
        
    } else {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #EF4444;">ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่</td></tr>';
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
    const user = appState.user || getCurrentUser();
    const searchText = document.getElementById('courseSearchInput').value.trim().toLowerCase();
    const visibleCourses = globalCourses.filter(course => isCourseVisibleToUser(course, user));
    
    if (searchText === '') {
        renderCourseGrid(visibleCourses); // โชว์ทั้งหมด
    } else {
        const filtered = visibleCourses.filter(course => 
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
                        ${course.mou_score > 0 ? `<span class="badge-mou"><i class="fas fa-star"></i> MOU: ${course.mou_score} คะแนน</span>` : ''}
                    </div>
                    <button class="btn ${btnClass} w-100" onclick="enrollCourse('${course.id}')">${btnText}</button>
                </div>
            </div>
        `;
    });
}

// ตรวจสอบสถานะการล็อกอินเมื่อเปิดหน้าเว็บ
// ================= Admin Logic =================

function restrictAdminFilters() {
    const user = appState.user || getCurrentUser();
    if (!user) return;
    
    const wgFilter = document.getElementById('adminReportWorkingGroupFilter');
    const deptFilter = document.getElementById('adminReportDeptFilter');
    if (!wgFilter || !deptFilter) return;
    
    if (user.role === 'admin') {
        wgFilter.disabled = false;
        deptFilter.disabled = false;
        return;
    }
    
    const targets = user.permissions || [];
    
    if (user.role === 'working_group_leader') {
        wgFilter.innerHTML = '';
        targets.forEach(tg => {
            const opt = document.createElement('option');
            opt.value = tg;
            opt.textContent = tg;
            wgFilter.appendChild(opt);
        });
        wgFilter.value = targets[0] || '';
        wgFilter.disabled = targets.length <= 1;
        
        onWorkingGroupChange('adminReportWorkingGroupFilter', 'adminReportDeptFilter');
        deptFilter.disabled = false;
        
    } else if (user.role === 'department_leader') {
        wgFilter.innerHTML = '<option value="">-</option>';
        wgFilter.value = '';
        wgFilter.disabled = true;
        
        deptFilter.innerHTML = '';
        targets.forEach(tg => {
            const opt = document.createElement('option');
            opt.value = tg;
            opt.textContent = tg;
            deptFilter.appendChild(opt);
        });
        deptFilter.value = targets[0] || '';
        deptFilter.disabled = targets.length <= 1;
    }
}

function goToAdminPanel() {
    const user = appState.user || getCurrentUser();
    if (!user) return;
    
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    
    // Control sidebar menu visibility
    const menus = document.querySelectorAll('.admin-sidebar .sidebar-menu li');
    if (user.role === 'admin') {
        menus.forEach(menu => {
            if (!menu.classList.contains('logout-menu')) {
                menu.style.display = 'block';
            }
        });
    } else if (user.role === 'working_group_leader' || user.role === 'department_leader') {
        // Hide all config/approval/user management tabs
        menus.forEach(menu => {
            if (menu.classList.contains('logout-menu')) return;
            const clickAttr = menu.getAttribute('onclick') || '';
            if (clickAttr.indexOf('reportTab') !== -1 || clickAttr.indexOf('courseReportTab') !== -1) {
                menu.style.display = 'block';
            } else {
                menu.style.display = 'none';
            }
        });
    }
    
    // Automatically switch to first visible tab
    switchAdminTab('reportTab');
}

// ออกจากระบบแอดมิน (กลับหน้าผู้ใช้งานและรีเฟรช)
function exitAdmin() {
    returnToDashboard();
}

function switchAdminTab(tabId, element = null) {
    // ซ่อนทุก Tab
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    // ลบ Active menu
    const menus = document.querySelectorAll('.admin-sidebar li'); 
    menus.forEach(menu => menu.classList.remove('active'));
    
    // โชว์ Tab ที่เลือก
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.remove('hidden');
    
    // เพิ่มสี Active ให้เมนูที่ถูกคลิก (แบบป้องกัน Error)
    if (element) {
        element.classList.add('active');
    } else {
        const sidebarMenus = document.querySelectorAll('.admin-sidebar .sidebar-menu li');
        sidebarMenus.forEach(m => {
            const clickAttr = m.getAttribute('onclick') || '';
            if (clickAttr.indexOf(tabId) !== -1) {
                m.classList.add('active');
            }
        });
    }
    
    // โหลดข้อมูลตามหน้า Tab ที่เลือก
    if(tabId === 'reportTab') {
        restrictAdminFilters();
        loadAdminReport();
    }
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
        restrictAdminFilters();
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
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">กำลังโหลดข้อมูลสถิติ...</td></tr>';
    const user = appState.user || getCurrentUser();
    const res = await callAPI('getAdminReport', { user_id: user ? user.id : '' });
    
    if (res.status === 'success') {
        globalAdminReportData = res.data; 
        filterAdminReport();
    } else {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">โหลดข้อมูลผิดพลาด</td></tr>`;
    }
}

let currentReportSortColumn = -1;
let currentReportSortAsc = true;
let lastReportData = [];

function filterAdminReport() {
    const selectedDept = document.getElementById('adminReportDeptFilter').value.trim();
    const selectedGroup = document.getElementById('adminReportGroupFilter').value;
    const selectedWorkingGroup = document.getElementById('adminReportWorkingGroupFilter').value.trim();
    const selectedStatus = document.getElementById('adminReportStatusFilter') ? document.getElementById('adminReportStatusFilter').value : 'all';

    const filteredData = globalAdminReportData.filter(item => {
        const deptMatch = selectedDept === '' || item.department === selectedDept;
        const groupMatch = selectedGroup === 'all' || item.position_group === selectedGroup;
        const wgMatch = selectedWorkingGroup === '' || item.working_group === selectedWorkingGroup;
        
        let statusMatch = true;
        if (selectedStatus === 'passed') {
            statusMatch = item.is_passed === true;
        } else if (selectedStatus === 'not_passed') {
            statusMatch = item.is_passed !== true;
        }
        
        return deptMatch && groupMatch && wgMatch && statusMatch;
    });

    renderReportTableAndChart(filteredData);
}

function renderReportTableAndChart(dataToShow) {
    lastReportData = dataToShow;
    
    // Update KPI Summary Cards
    const totalPersonnel = dataToShow.length;
    const passedCriteria = dataToShow.filter(item => item.is_passed).length;
    const notPassedCriteria = totalPersonnel - passedCriteria;

    const kpiTotalEl = document.getElementById('kpiTotalPersonnel');
    const kpiPassedEl = document.getElementById('kpiPassedCriteria');
    const kpiNotPassedEl = document.getElementById('kpiNotPassedCriteria');

    if (kpiTotalEl) kpiTotalEl.innerText = totalPersonnel;
    if (kpiPassedEl) kpiPassedEl.innerText = passedCriteria;
    if (kpiNotPassedEl) kpiNotPassedEl.innerText = notPassedCriteria;

    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    
    const summaryDiv = document.getElementById('reportSummaryDiv');
    if (summaryDiv) {
        if (dataToShow.length > 0) {
            let totalCount = dataToShow.length;
            let passedCount = dataToShow.filter(item => item.is_passed).length;
            let totalPassRate = (passedCount / totalCount * 100).toFixed(1);
            
            let wgStats = {};
            let deptStats = {};
            
            dataToShow.forEach(item => {
                const wg = item.working_group || 'ไม่ระบุกลุ่มงาน';
                const dept = item.department || 'ไม่ระบุหน่วยงาน';
                
                if (!wgStats[wg]) wgStats[wg] = { total: 0, passed: 0 };
                if (!deptStats[dept]) deptStats[dept] = { total: 0, passed: 0 };
                
                wgStats[wg].total++;
                deptStats[dept].total++;
                if (item.is_passed) {
                    wgStats[wg].passed++;
                    deptStats[dept].passed++;
                }
            });
            
            let wgHtml = '';
            for (let wg in wgStats) {
                let rate = (wgStats[wg].passed / wgStats[wg].total * 100).toFixed(1);
                wgHtml += `<div class="stat-card" style="padding: 12px; margin-bottom: 0;">
                    <strong>${wg}</strong><br>
                    ผ่านเกณฑ์: ${wgStats[wg].passed}/${wgStats[wg].total} คน (${rate}%)
                </div>`;
            }
            
            let deptHtml = '';
            for (let dept in deptStats) {
                let rate = (deptStats[dept].passed / deptStats[dept].total * 100).toFixed(1);
                deptHtml += `<div class="stat-card" style="padding: 12px; margin-bottom: 0;">
                    <strong>${dept}</strong><br>
                    ผ่านเกณฑ์: ${deptStats[dept].passed}/${deptStats[dept].total} คน (${rate}%)
                </div>`;
            }
            
            summaryDiv.innerHTML = `
                <div style="background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                    <h4 style="margin-bottom: 12px;"><i class="fas fa-chart-pie"></i> สรุปผลผ่านเกณฑ์รายหน่วยงาน</h4>
                    <p style="font-size: 1.1rem; margin-bottom: 15px;"><strong>ภาพรวมทั้งหมด:</strong> ผ่านเกณฑ์ ${passedCount} จาก ${totalCount} คน (${totalPassRate}%)</p>
                    
                    <h5 style="margin-bottom: 8px;">สรุปรายกลุ่มงาน</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 20px;">
                        ${wgHtml}
                    </div>
                    
                    <h5 style="margin-bottom: 8px;">สรุปรายหน่วยงาน</h5>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                        ${deptHtml}
                    </div>
                </div>
            `;
            summaryDiv.style.display = 'block';
        } else {
            summaryDiv.style.display = 'none';
        }
    }

    if (dataToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">ไม่มีข้อมูลผู้ใช้งานตามเงื่อนไขที่เลือก</td></tr>';
        renderAdminChart({}); 
        return;
    }
    
    let deptStatsMap = {}; 
    
    dataToShow.forEach(r => {
        if (!deptStatsMap[r.department]) deptStatsMap[r.department] = { passed: 0, failed: 0 };
        if (r.is_passed) deptStatsMap[r.department].passed++;
        else deptStatsMap[r.department].failed++;
    });

    renderReportTableOnly(dataToShow);
    renderAdminChart(deptStatsMap);
}

function renderReportTableOnly(dataToShow) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    
    const formatHours = (val) => {
        const num = parseFloat(val);
        return isNaN(num) ? '0' : parseFloat(num.toFixed(2)).toString();
    };

    dataToShow.forEach(r => {
        let statusColor = '#EF4444';
        if (r.status_code === 'pass') statusColor = '#10B981';
        if (r.status_code === 'warning') statusColor = '#f59e0b';

        const statusBadge = `<span class="badge" style="background: ${statusColor}; color: white; border-radius:12px; padding:4px 10px; font-weight:bold;">${r.status}</span>`;
        const positionGroupLabel = r.position_group === 'professional' ? 'กลุ่มวิชาชีพ' : 'สายสนับสนุน';
        const dayLabel = r.position_group === 'professional' ? formatHours(r.totalDays) : '-';
        const mandatoryLabel = r.position_group === 'support'
            ? `${r.mandatory_completed}/${r.mandatory_total || 0}`
            : '-';
        const mandatoryHint = r.position_group === 'support' && Array.isArray(r.mandatory_pending_titles) && r.mandatory_pending_titles.length > 0
            ? `<br><small style="color: var(--text-light);">คงเหลือ: ${r.mandatory_pending_titles.join(', ')}</small>`
            : '';
            
        tbody.innerHTML += `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.position || '-'}<br><small style="color: var(--text-light);">${r.department}</small></td>
                <td>${positionGroupLabel}<br><small style="color: var(--text-light);">${r.criteria_type}</small></td>
                <td>${formatHours(r.internal)}</td>
                <td>${formatHours(r.external)}</td>
                <td><strong>${formatHours(r.totalHours)}</strong></td>
                <td><strong>${dayLabel}</strong></td>
                <td><strong>${mandatoryLabel}</strong>${mandatoryHint}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });
}

function sortReportTable(colIndex) {
    if (currentReportSortColumn === colIndex) {
        currentReportSortAsc = !currentReportSortAsc;
    } else {
        currentReportSortColumn = colIndex;
        currentReportSortAsc = true;
    }
    
    if (!lastReportData || lastReportData.length === 0) return;
    
    lastReportData.sort((a, b) => {
        let valA, valB;
        switch(colIndex) {
            case 0:
                valA = a.name || '';
                valB = b.name || '';
                return currentReportSortAsc ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
            case 1:
                valA = (a.position || '') + ' ' + (a.department || '');
                valB = (b.position || '') + ' ' + (b.department || '');
                return currentReportSortAsc ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
            case 2:
                valA = a.position_group || '';
                valB = b.position_group || '';
                return currentReportSortAsc ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
            case 3:
                valA = parseFloat(a.internal) || 0;
                valB = parseFloat(b.internal) || 0;
                break;
            case 4:
                valA = parseFloat(a.external) || 0;
                valB = parseFloat(b.external) || 0;
                break;
            case 5:
                valA = parseFloat(a.totalHours) || 0;
                valB = parseFloat(b.totalHours) || 0;
                break;
            case 6:
                valA = parseFloat(a.totalDays) || 0;
                valB = parseFloat(b.totalDays) || 0;
                break;
            case 7:
                valA = parseFloat(a.mandatory_completed) || 0;
                valB = parseFloat(b.mandatory_completed) || 0;
                break;
            case 8:
                valA = a.status || '';
                valB = b.status || '';
                return currentReportSortAsc ? valA.localeCompare(valB, 'th') : valB.localeCompare(valA, 'th');
            default:
                return 0;
        }
        return currentReportSortAsc ? valA - valB : valB - valA;
    });
    
    renderReportTableOnly(lastReportData);
}

// ฟังก์ชันวาดกราฟ Chart.js
function renderAdminChart(deptStats) {
    const ctx = document.getElementById('passRateChart').getContext('2d');
    
    if (adminChartInstance) adminChartInstance.destroy();

    // Sort departments by passing percentage from highest to lowest
    const deptList = Object.keys(deptStats).map(dept => {
        const passed = deptStats[dept].passed;
        const failed = deptStats[dept].failed;
        const total = passed + failed;
        const passRate = total > 0 ? (passed / total * 100) : 0;
        return { dept, passed, failed, passRate };
    });
    
    deptList.sort((a, b) => b.passRate - a.passRate);

    const labels = deptList.map(item => item.dept);
    const passedData = deptList.map(item => item.passed);
    const failedData = deptList.map(item => item.failed);

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
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } }, 
                y: { stacked: true }
            },
            plugins: { 
                legend: { position: 'top' } 
            }
        }
    });
}
// ฟังก์ชัน Export Excel อย่างง่ายด้วย JS
function exportToExcel() {
    let table = document.getElementById('adminReportTable');
    if (!table) return;
    let html = table.outerHTML.replace(/ /g, '%20');
    let a = document.createElement('a');
    a.href = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + html;
    a.download = 'training_report_swd.xls';
    a.click();
}

// ==================== Course Management UI & Logic ====================
let adminCoursesData = [];

function toggleAdminForm(containerId, forceOpen = false) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (forceOpen) {
        container.classList.remove('hidden');
    } else {
        container.classList.toggle('hidden');
    }
}

/**
 * ฟังก์ชันตรวจสอบรูปแบบหลักสูตรเพื่อซ่อน/แสดงส่วนของหน่วยการเรียนรู้(วิดีโอ)
 */
function toggleCourseDeliveryFields() {
    const deliveryType = document.getElementById('cDeliveryType').value;
    const unitsSection = document.getElementById('courseUnitsSection');
    const classroomHint = document.getElementById('courseClassroomHint');
    const unitsContainer = document.getElementById('unitsContainer');

    if (deliveryType === 'classroom') {
        unitsSection.classList.add('hidden');
        classroomHint.classList.remove('hidden');
        unitsContainer.innerHTML = '';
        return;
    }

    unitsSection.classList.remove('hidden');
    classroomHint.classList.add('hidden');
    if (unitsContainer.children.length === 0) {
        addUnitField(); // ต้องมีฟังก์ชันนี้อยู่ใน app.js หรือไฟล์อื่น
    }
}

// ==================== Internal Courses (หลักสูตรในระบบ) ====================

function editCourse(courseId) {
    // เช็คตัวแปร adminCoursesData ซึ่งควรดึงมาจาก app.js
    if (typeof adminCoursesData === 'undefined') return;
    const course = adminCoursesData.find(c => c.course_id === courseId);
    if(!course) return;

    // เปิดฟอร์มขึ้นมาทันทีเมื่อกดแก้ไข
    toggleAdminForm('internalCourseFormContainer', true);

    document.getElementById('courseFormTitle').innerHTML = '<i class="fas fa-edit"></i> แก้ไขข้อมูลหลักสูตร';
    document.getElementById('btnSubmitCourse').innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข';
    document.getElementById('btnCancelEdit').classList.remove('hidden');
    document.getElementById('editCourseId').value = course.course_id;

    document.getElementById('cTitle').value = course.title;
    document.getElementById('cOrganizer').value = course.organizer;
    document.getElementById('cPassingScore').value = course.passing_score;
    document.getElementById('cCover').value = course.cover_image;
    document.getElementById('cCertTemplate').value = course.cert_template || '';
    document.getElementById('cDeliveryType').value = course.delivery_type || 'video';
    document.getElementById('cAudience').value = course.audience || 'all';
    document.getElementById('cIsMandatory').checked = !!course.is_mandatory;
    document.getElementById('cMOU').value = course.mou_score || 0;

    const coverPreview = document.getElementById('cCoverPreview');
    if (coverPreview) {
        if (course.cover_image) {
            // ต้องมีฟังก์ชัน getDriveImageUrl() ในระบบ
            coverPreview.src = typeof getDriveImageUrl === 'function' ? getDriveImageUrl(course.cover_image) : '';
            coverPreview.style.display = 'block';
        } else {
            coverPreview.src = '';
            coverPreview.style.display = 'none';
        }
    }

    const hr = Math.floor(course.hours);
    const min = Math.round((course.hours - hr) * 60);
    document.getElementById('cHours').value = hr;
    document.getElementById('cMins').value = min;

    document.getElementById('unitsContainer').innerHTML = '';
    if ((course.delivery_type || 'video') === 'video') {
        const units = JSON.parse(course.units || '[]');
        if(units.length === 0) {
            if(typeof addUnitField === 'function') addUnitField();
        } else {
            if(typeof addUnitField === 'function') {
                units.forEach(u => addUnitField(u.title, u.video_url, u.min_time));
            }
        }
    }
    toggleCourseDeliveryFields();
    
    // เลื่อนหน้าจอขึ้นไปที่ฟอร์ม
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetCourseForm() {
    document.getElementById('addCourseForm').reset();
    document.getElementById('courseFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> เพิ่มหลักสูตรใหม่';
    document.getElementById('btnSubmitCourse').innerHTML = '<i class="fas fa-save"></i> บันทึกหลักสูตร';
    document.getElementById('btnCancelEdit').classList.add('hidden');
    document.getElementById('editCourseId').value = '';
    document.getElementById('cMOU').value = 0;
    document.getElementById('unitsContainer').innerHTML = '';
    
    const coverPreview = document.getElementById('cCoverPreview');
    if (coverPreview) coverPreview.style.display = 'none';

    toggleCourseDeliveryFields();
    
    // ซ่อนฟอร์มกลับไปเมื่อกดยกเลิก
    toggleAdminForm('internalCourseFormContainer');
}

function displayAdminCourseList() {
    const tbody = document.getElementById('adminCourseListBody');
    if (!tbody || typeof adminCoursesData === 'undefined') return;

    tbody.innerHTML = adminCoursesData.map(course => {
        const mouScore = course.mou_score || (typeof calculateMOUScore === 'function' ? calculateMOUScore(course.hours * 60) : 0);
        
        // แปลงรูปแบบข้อมูลให้สวยงาม
        const typeDisplay = course.delivery_type === 'classroom' ? 'อบรมในห้อง' : 'ออนไลน์';
        let audienceDisplay = 'ทุกตำแหน่ง';
        if (course.audience === 'nurse') audienceDisplay = 'พยาบาลวิชาชีพ';
        else if (course.audience === 'support') audienceDisplay = 'สายสนับสนุน';

        const statusBadgeClass = course.status === 'active' ? 'active' : 'inactive';
        const statusText = course.status === 'active' ? 'ใช้งาน' : 'ระงับ/ปิด';

        return `
            <tr>
                <td class="td-title"><strong>${course.title}</strong></td>
                <td>${typeDisplay}<br><small style="color: var(--text-light);">กลุ่ม: ${audienceDisplay}</small></td>
                <td class="text-center">${course.hours} ชม.</td>
                <td class="text-center" style="font-weight: 600; color: var(--primary-color);">${mouScore} คะแนน</td>
                <td class="text-center"><span class="table-status-badge ${statusBadgeClass}">${statusText}</span></td>
                <td class="td-actions text-center">
                    <button class="btn-action btn-edit" onclick="editCourse('${course.course_id}')" title="แก้ไข"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-warning" onclick="typeof toggleCourseStatus === 'function' ? toggleCourseStatus('${course.course_id}') : alert('รอกำหนดฟังก์ชันปิดสถานะ')" title="ปิด/เปิดลงทะเบียน"><i class="fas fa-power-off"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteCourse('${course.course_id}')" title="ลบ"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}


// ==================== External Recommendations (หลักสูตรภายนอก) ====================

function editExternalCourse(recId) {
    if (typeof adminExternalRecommendationsData === 'undefined') return;
    const course = adminExternalRecommendationsData.find(c => c.rec_id === recId);
    if(!course) return;

    // เปิดฟอร์มขึ้นมาทันทีเมื่อกดแก้ไข
    toggleAdminForm('externalCourseFormContainer', true);

    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-edit"></i> แก้ไขหลักสูตรภายนอกแนะนำ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข';
    document.getElementById('btnCancelExternalRecEdit').classList.remove('hidden');
    
    document.getElementById('editExtRecId').value = course.rec_id;
    document.getElementById('extRecTitle').value = course.title;
    document.getElementById('extRecOrganizer').value = course.organizer;
    document.getElementById('extRecUrl').value = course.url || '';
    document.getElementById('extMouScore').value = course.mou_score || 0;
    
    // รูปภาพปก
    document.getElementById('extRecCover').value = course.cover_image || '';

    const hr = Math.floor(course.hours);
    const min = Math.round((course.hours - hr) * 60);
    document.getElementById('extRecHours').value = hr;
    document.getElementById('extRecMins').value = min;

    // เลื่อนหน้าจอขึ้นไปที่ฟอร์ม
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetExternalRecommendationForm() {
    document.getElementById('externalRecommendationForm').reset();
    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-link"></i> เพิ่มหลักสูตรภายนอกแนะนำ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> บันทึกหลักสูตรภายนอก';
    document.getElementById('btnCancelExternalRecEdit').classList.add('hidden');
    document.getElementById('editExtRecId').value = '';
    document.getElementById('extMouScore').value = 0;
    document.getElementById('extRecCover').value = '';

    // ซ่อนฟอร์มกลับไปเมื่อกดยกเลิก
    toggleAdminForm('externalCourseFormContainer');
}

function displayAdminExternalCourseList() {
    const tbody = document.getElementById('adminExternalCourseListBody');
    if (!tbody || typeof adminExternalRecommendationsData === 'undefined') return;
    tbody.innerHTML = adminExternalRecommendationsData.map(course => {
        const mouScore = course.mou_score || (typeof calculateMOUScore === 'function' ? calculateMOUScore(course.hours * 60) : 0);
        
        const statusBadgeClass = course.status === 'active' ? 'active' : 'inactive';
        const statusText = course.status === 'active' ? 'ใช้งาน' : 'ระงับ/ปิด';

        return `
            <tr>
                <td class="td-title"><strong>${course.title}</strong></td>
                <td>${course.organizer}</td>
                <td class="text-center">${course.hours} ชม.</td>
                <td class="text-center" style="font-weight: 600; color: var(--primary-color);">${mouScore} คะแนน</td>
                <td class="text-center">
                    ${course.url ? `<a href="${course.url}" target="_blank" class="btn-link" title="เปิดลิงก์"><i class="fas fa-external-link-alt"></i></a>` : '-'}
                </td>
                <td class="text-center"><span class="table-status-badge ${statusBadgeClass}">${statusText}</span></td>
                <td class="td-actions text-center">
                    <button class="btn-action btn-edit" onclick="editExternalCourse('${course.rec_id}')" title="แก้ไข"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-warning" onclick="typeof toggleExternalCourseStatus === 'function' ? toggleExternalCourseStatus('${course.rec_id}') : alert('รอกำหนดฟังก์ชันปิดสถานะ')" title="ปิด/เปิดลงทะเบียน"><i class="fas fa-power-off"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteExternalCourse('${course.rec_id}')" title="ลบ"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
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


// ฟังก์ชันบันทึกหลักสูตร (จัดการทั้งตอนเพิ่มใหม่ และตอนแก้ไข)
document.getElementById('addCourseForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const deliveryType = document.getElementById('cDeliveryType').value;
    const unitBoxes = document.querySelectorAll('.unit-box');
    let unitsData = [];
    if (deliveryType === 'video') {
        unitBoxes.forEach((box) => {
            unitsData.push({
                title: box.querySelector('.u-title').value,
                video_url: box.querySelector('.u-video').value,
                min_time: parseInt(box.querySelector('.u-time').value)
            });
        });
        if (unitsData.length === 0) {
            return showAlert('แจ้งเตือน', 'หลักสูตรแบบออนไลน์ต้องมีหน่วยวิดีโออย่างน้อย 1 หน่วย');
        }
    }

    const hr = parseFloat(document.getElementById('cHours').value) || 0;
    const min = parseFloat(document.getElementById('cMins').value) || 0;
    const totalDecimalHours = +(hr + (min / 60)).toFixed(2);

    const payload = {
        title: document.getElementById('cTitle').value,
        organizer: document.getElementById('cOrganizer').value,
        hours: totalDecimalHours,
        passing_score: document.getElementById('cPassingScore').value,
        cover_image: document.getElementById('cCover').value,
        cert_template: document.getElementById('cCertTemplate').value,
        units: unitsData,
        delivery_type: deliveryType,
        audience: document.getElementById('cAudience').value,
        is_mandatory: document.getElementById('cIsMandatory').checked,
        mou_score: parseFloat(document.getElementById('cMOU').value) || 0
    };
    
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
let currentCourseFlow = 'video';

function extractYTId(url) {
    if(!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

// 1. ฟังก์ชันบันทึกความคืบหน้า (ทั้งตอนดูจบ และตอนกดออก)
function saveProgressToDB() {
    if(!currentClassCourse || currentCourseFlow === 'classroom') return;
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
// 2. กดเข้าเรียน
let isCourseLoading = false;

async function enrollCourse(courseId) {
    if (isCourseLoading) return;
    isCourseLoading = true;

    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    const targetCourse = globalCourses.find(c => c.id === courseId);
    if(!targetCourse) {
        isCourseLoading = false;
        return showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลหลักสูตรนี้');
    }

    const enrollData = cachedUserEnrollments.find(e => e.course_id === courseId);
    if (enrollData && enrollData.status === 'completed') {
        showPassedCourseModal(targetCourse, enrollData);
        isCourseLoading = false;
        return;
    }

    showLoader();
    try {
        const enrollRes = await Promise.race([
            callAPI('enrollCourse', { user_id: user.id, course_id: courseId }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);
        hideLoader();
        isCourseLoading = false;

        if(enrollRes.status === 'success') {
            const progData = enrollRes.data || {}; 
            completedUnits = progData.completed || [];
            resumeTimes = progData.resumeTimes || {};
            currentClassCourse = targetCourse;
            currentCourseFlow = isClassroomCourse(targetCourse) ? 'classroom' : 'video';
            
            try { currentUnits = JSON.parse(targetCourse.units || '[]'); } 
            catch(e) { currentUnits = []; }

            if (currentCourseFlow === 'classroom') {
                const confirmed = await showConfirm(
                    'หลักสูตรอบรมในห้อง',
                    'หลักสูตรนี้ไม่มีวิดีโอในระบบ ผู้เข้าอบรมต้องผ่านการอบรมในห้องเรียนก่อน แล้วจึงทำแบบทดสอบหลังเรียนในระบบเพื่อรับใบประกาศ'
                );
                if (!confirmed) return;
                startQuiz('post');
                return;
            }

            if(currentUnits.length === 0) return showAlert('แจ้งเตือน', 'หลักสูตรนี้ยังไม่มีวิดีโอเนื้อหาครับ');

            enterClassroom();
        } else {
            showAlert('ข้อผิดพลาดจากระบบ', enrollRes.message);
        }
    } catch (error) {
        hideLoader(true);
        isCourseLoading = false;
        showAlert('ข้อผิดพลาด', 'ไม่สามารถโหลดบทเรียนได้ กรุณาลองใหม่');
    }
}

function showPassedCourseModal(course, enrollData) {
    currentPassedCourse = course;
    document.getElementById('passedCourseTitle').innerText = course.title;
    
    const btnDownload = document.getElementById('btnPassedDownloadCert');
    if (enrollData && enrollData.cert_url) {
        btnDownload.href = enrollData.cert_url;
        btnDownload.classList.remove('hidden');
    } else {
        btnDownload.classList.add('hidden');
    }
    
    document.getElementById('passedCourseModal').classList.remove('hidden');
}

function closePassedCourseModal() {
    document.getElementById('passedCourseModal').classList.add('hidden');
    currentPassedCourse = null;
}

async function enrollAndEnterCourse(course) {
    if (isCourseLoading) return;
    isCourseLoading = true;

    closePassedCourseModal();
    const user = JSON.parse(localStorage.getItem('swd_user'));
    showLoader();
    try {
        const enrollRes = await Promise.race([
            callAPI('enrollCourse', { user_id: user.id, course_id: course.id }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
        ]);
        hideLoader();
        isCourseLoading = false;
        
        if (enrollRes.status === 'success') {
            const progData = enrollRes.data || {};
            completedUnits = progData.completed || [];
            resumeTimes = progData.resumeTimes || {};
            currentClassCourse = course;
            currentCourseFlow = isClassroomCourse(course) ? 'classroom' : 'video';
            
            try { currentUnits = JSON.parse(course.units || '[]'); }
            catch (e) { currentUnits = []; }
            
            if (currentCourseFlow === 'classroom') {
                startQuiz('post');
                return;
            }
            
            enterClassroom();
        } else {
            showAlert('ข้อผิดพลาดจากระบบ', enrollRes.message);
        }
    } catch (error) {
        hideLoader(true);
        isCourseLoading = false;
        showAlert('ข้อผิดพลาด', 'ไม่สามารถโหลดบทเรียนได้ กรุณาลองใหม่');
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
    saveProgressToDB();

    if(ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
    
    returnToDashboard();
}

function finishCourseFlow() {
    if (currentCourseFlow === 'classroom') {
        document.getElementById('quizSection').classList.add('hidden');
        document.getElementById('reviewModal').classList.add('hidden');
        currentClassCourse = null;
        currentUnits = [];
        completedUnits = [];
        resumeTimes = {};
        returnToDashboard();
        return;
    }
    exitClassroom();
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
    else document.getElementById('btnTakeExam').classList.add('hidden');
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
let activeQuizType = 'post';

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
        
        document.getElementById('quizTitle').innerText = 'แบบทดสอบหลังเรียน (Post-test)';
        document.getElementById('quizSubtitle').innerText = `วิชา: ${currentClassCourse.title}`;
        
        document.getElementById('quizSection').classList.remove('hidden');
        document.getElementById('quizContent').classList.remove('hidden');
        document.getElementById('quizResult').classList.add('hidden');
        document.getElementById('resultCertMeta').classList.add('hidden');
        document.getElementById('resultCertMeta').innerHTML = '';
        
        renderQuestion();
    } else {
        const message = currentCourseFlow === 'classroom'
            ? 'หลักสูตรอบรมในห้องนี้ยังไม่มีการตั้งค่าแบบทดสอบหลังเรียน'
            : 'หลักสูตรนี้ยังไม่มีการตั้งค่าแบบทดสอบครับ กรุณาข้ามไปเรียนได้เลย';
        showAlert('แจ้งเตือน', message);
        if(type === 'post' && currentCourseFlow === 'classroom') finishCourseFlow();
    }
}

// แสดงคำถามทีละข้อ
function renderQuestion() {
    const q = userQuizData[currentQIndex];
    document.getElementById('quizProgressText').innerText = `ข้อที่ ${currentQIndex + 1} / ${userQuizData.length}`;
    document.getElementById('questionText').innerText = `${currentQIndex + 1}. ${q.question}`;
    
    const pct = Math.round((currentQIndex / userQuizData.length) * 100);
    const progressEl = document.getElementById('quizProgressBar');
    if (progressEl) progressEl.style.width = pct + '%';
    
    const btnPrev = document.getElementById('btnPrevQuestion');
    if (btnPrev) {
        if (currentQIndex > 0) {
            btnPrev.classList.remove('hidden');
        } else {
            btnPrev.classList.add('hidden');
        }
    }
    
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
    const user = JSON.parse(localStorage.getItem('swd_user'));
    if (!user) {
        showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลผู้ใช้ กรุณาเข้าสู่ระบบใหม่');
        setTimeout(() => logout(), 2000);
        return;
    }

    let correctCount = 0;
    for (let qIdx = 0; qIdx < userQuizData.length; qIdx++) {
        if (userAnswers[qIdx] === userQuizData[qIdx].answer) {
            correctCount++;
        }
    }

    const total = userQuizData.length;
    const score = Math.round((correctCount / total) * 100);
    const passingScore = currentClassCourse.passing_score || 80;
    const isPassed = score >= passingScore;

    // ===== SHOW RESULT SCREEN =====
    document.getElementById('quizContent').classList.add('hidden');
    document.getElementById('quizResult').classList.remove('hidden');
    
    document.getElementById('resultScore').innerText = correctCount;
    document.getElementById('resultTotal').innerText = total;
    document.getElementById('resultPassScore').innerText = 
        `(${passingScore}% ถือว่าผ่าน)`;

    const btnReturn = document.getElementById('btnReturnFromQuiz');
    const btnCert = document.getElementById('btnDownloadCert');
    const certMeta = document.getElementById('resultCertMeta');

    if (isPassed) {
        document.getElementById('resultTitle').style.color = '#10B981';
        document.getElementById('resultIcon').className = 'fas fa-check-circle';
        document.getElementById('resultIcon').style.color = '#10B981';
        document.getElementById('resultStatusBadge').innerHTML = 
            `<span style="display:inline-block; background:#dcfce7; color:#166534; padding:6px 12px; border-radius:999px; font-weight:700;">ผ่านการสอบ</span>`;
        
        // KEEP USER LOGGED IN - Don't hide return button yet
        btnReturn.classList.remove('hidden');
        btnReturn.innerText = '⏳ กำลังสร้างใบประกาศ... กรุณารอสักครู่';
        btnReturn.disabled = true;

        // ===== GENERATE CERTIFICATE =====
        try {
            // Submit quiz score first
            await callAPI('submitQuiz', {
                user_id: user.id,
                course_id: currentClassCourse.id,
                type: 'post',
                score: score,
                is_passed: true
            });

            // Then generate certificate with explicit timeout
            const certRes = await Promise.race([
                callAPI('generateCert', {
                    user_id: user.id,
                    user_name: user.name,
                    course_id: currentClassCourse.id
                }),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Certificate generation timeout')), 90000)
                )
            ]);

            // ===== HANDLE CERTIFICATE RESPONSE =====
            if (certRes && certRes.status === 'success' && certRes.pdf_url) {
                // ✅ FIX: Store URL and open in new tab (doesn't redirect user)
                const enrollData = cachedUserEnrollments.find(e => e.course_id === currentClassCourse.id);
                if (enrollData) {
                    enrollData.cert_url = certRes.pdf_url;
                }

                // Display success message
                document.getElementById('resultTitle').innerText = 'ยินดีด้วย! คุณสอบผ่าน และได้รับใบประกาศ';
                document.getElementById('resultStatusBadge').innerHTML = 
                    `<span style="display:inline-block; background:#dcfce7; color:#166534; padding:6px 12px; border-radius:999px; font-weight:700;">✓ ใบประกาศพร้อม</span>`;

                // Show download button
                btnCert.href = certRes.pdf_url;
                btnCert.target = '_blank';
                btnCert.rel = 'noopener noreferrer';
                btnCert.classList.remove('hidden');

                // Show certificate metadata
                if (certRes.cert_id || certRes.verify_url) {
                    certMeta.innerHTML = `
                        ${certRes.cert_id ? `<strong>Certificate ID:</strong> ${certRes.cert_id}<br>` : ''}
                        ${certRes.verify_url ? `<a href="${certRes.verify_url}" target="_blank" rel="noopener">🔍 ตรวจสอบใบประกาศ</a>` : ''}
                    `;
                    certMeta.classList.remove('hidden');
                }
                showCertificateReadyNotification(certRes.cert_id, certRes.verify_url);

                // ✅ FIX: Auto-open PDF in new tab (not same window)
                window.open(certRes.pdf_url, '_blank', 'noopener,noreferrer');

                Logger.log('Certificate generated and opened: ' + certRes.cert_id);
            } else {
                const errorMsg = (certRes && certRes.message) 
                    ? certRes.message
                    : 'ไม่สามารถสร้างเกียรติบัตรได้ กรุณาลองใหม่';
                
                document.getElementById('resultTitle').innerText = 'สอบผ่าน (แต่พบปัญหาสร้างใบประกาศ)';
                document.getElementById('resultStatusBadge').innerHTML = 
                    `<span style="display:inline-block; background:#fef3c7; color:#92400e; padding:6px 12px; border-radius:999px;">⚠️ ${escapeHtml_(errorMsg)}</span>`;
                
                showAlert('แจ้งเตือน', 'ไม่สามารถสร้างเกียรติบัตรได้ แต่คุณสอบผ่านแล้ว\n\nเหตุผล: ' + errorMsg);
            }
        } catch (error) {
            console.error('Certificate error:', error);
            
            document.getElementById('resultTitle').innerText = 'สอบผ่าน (ข้อผิดพลาดการสร้างใบประกาศ)';
            
            let errorMsg = 'ข้อผิดพลาด: ' + error.toString();
            if (error.message && error.message.includes('timeout')) {
                errorMsg = 'หมดเวลารอ - โปรดลองใหม่อีกครั้ง';
            }
            
            document.getElementById('resultStatusBadge').innerHTML = 
                `<span style="display:inline-block; background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:999px;">❌ ${errorMsg}</span>`;
            
            showAlert('ข้อผิดพลาด', errorMsg + '\n\nกรุณาติดต่อผู้ดูแลระบบ');
        } finally {
            // ✅ FIX: Always restore button functionality
            btnReturn.disabled = false;
            btnReturn.innerText = '👈 ดำเนินการต่อ';
        }

    } else {
        // Failed
        document.getElementById('resultTitle').innerText = 'ขออภัย! คุณสอบไม่ผ่าน';
        document.getElementById('resultTitle').style.color = '#dc2626';
        document.getElementById('resultIcon').className = 'fas fa-times-circle';
        document.getElementById('resultIcon').style.color = '#dc2626';
        document.getElementById('resultStatusBadge').innerHTML = 
            `<span style="display:inline-block; background:#fee2e2; color:#991b1b; padding:6px 12px; border-radius:999px; font-weight:700;">ไม่ผ่าน (ต้องได้ ${passingScore}% ขึ้นไป)</span>`;

        btnCert.classList.add('hidden');
        btnReturn.classList.remove('hidden');
        btnReturn.innerText = '🔄 ทำแบบทดสอบใหม่';

        // Record failed attempt
        try {
            await callAPI('submitQuiz', {
                user_id: user.id,
                course_id: currentClassCourse.id,
                type: 'post',
                score: score,
                is_passed: false
            });
        } catch(e) {
            Logger.log('Failed to record quiz attempt: ' + e);
        }
    }
}

// ปิดหน้าข้อสอบและไปสเตปถัดไป
function closeQuiz() {
    document.getElementById('quizSection').classList.add('hidden');
    const isPassed = document.getElementById('resultIcon').classList.contains('fa-check-circle');
    if (isPassed) {
        openReviewModal();
    } else {
        finishCourseFlow();
    }
}
// ================= External Training Logic (อัปโหลดประวัติภายนอก) =================
let selectedExternalTrainingRecommendation = null;

async function loadExternalTrainingRecommendationOptions(force = false) {
    const select = document.getElementById('extRecSelect');
    if (!select) return;

    let recommendations = externalRecommendationCourses || [];
    if (force || recommendations.length === 0) {
        const res = await callAPI('getExternalRecommendations', {});
        if (res.status === 'success') {
            recommendations = res.data || [];
            externalRecommendationCourses = recommendations;
            appState.externalRecommendationsLoaded = recommendations.length > 0;
        } else {
            recommendations = [];
        }
    }

    const currentValue = select.value;
    select.innerHTML = '<option value="">กรอกข้อมูลเอง</option>';
    recommendations.forEach(course => {
        select.innerHTML += `<option value="${course.rec_id}">${course.title} | ${course.organizer || '-'} | ${formatHoursLabel(course.hours)}</option>`;
    });

    if (currentValue && recommendations.some(course => course.rec_id === currentValue)) {
        select.value = currentValue;
        handleExternalTrainingRecommendationChange(currentValue);
    } else {
        handleExternalTrainingRecommendationChange('');
    }
}

function handleExternalTrainingRecommendationChange(recId) {
    const topicInput = document.getElementById('extTopic');
    const organizerInput = document.getElementById('extOrganizer');
    const dateInput = document.getElementById('extDate');
    const hoursInput = document.getElementById('extHours');
    const minsInput = document.getElementById('extMins');
    const durationDisplay = document.getElementById('extDurationDisplay');
    const manualDurationGroup = document.getElementById('extManualDurationGroup');
    const presetDurationGroup = document.getElementById('extPresetDurationGroup');
    const hint = document.getElementById('extRecSelectHint');

    if (!topicInput || !organizerInput || !dateInput || !hoursInput || !minsInput || !durationDisplay || !manualDurationGroup || !presetDurationGroup) {
        return;
    }

    const recommendation = (externalRecommendationCourses || []).find(course => course.rec_id === recId) || null;
    selectedExternalTrainingRecommendation = recommendation;

    if (recommendation) {
        const duration = splitHoursAndMinutes(recommendation.hours);
        topicInput.value = recommendation.title || '';
        organizerInput.value = recommendation.organizer || '';
        topicInput.readOnly = true;
        organizerInput.readOnly = true;
        topicInput.classList.add('readonly-field');
        organizerInput.classList.add('readonly-field');
        hoursInput.value = duration.hours;
        minsInput.value = duration.minutes;
        hoursInput.required = false;
        minsInput.required = false;
        manualDurationGroup.classList.add('hidden');
        presetDurationGroup.classList.remove('hidden');
        durationDisplay.value = formatHoursLabel(recommendation.hours);
        if (hint) hint.innerText = 'เลือกจากรายการแนะนำแล้ว ระบบดึงข้อมูลหลักสูตร หน่วยงาน และชั่วโมงให้อัตโนมัติ เหลือกรอกวันที่และแนบหลักฐาน';
        return;
    }

    topicInput.readOnly = false;
    organizerInput.readOnly = false;
    topicInput.classList.remove('readonly-field');
    organizerInput.classList.remove('readonly-field');
    topicInput.value = '';
    organizerInput.value = '';
    hoursInput.value = '';
    minsInput.value = '';
    durationDisplay.value = '';
    hoursInput.required = true;
    minsInput.required = true;
    manualDurationGroup.classList.remove('hidden');
    presetDurationGroup.classList.add('hidden');
    if (hint) hint.innerText = 'ถ้าเลือกจากรายการแนะนำ ระบบจะดึงชื่อหลักสูตร หน่วยงาน และชั่วโมงให้อัตโนมัติ เหลือกรอกวันที่กับแนบหลักฐาน';
}

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
        const topicValue = document.getElementById('extTopic').value.trim();
        const organizerValue = document.getElementById('extOrganizer').value.trim();
        const isRecommendationMode = !!selectedExternalTrainingRecommendation;
        const hr = isRecommendationMode ? Math.floor(parseFloat(selectedExternalTrainingRecommendation.hours) || 0) : (parseFloat(document.getElementById('extHours').value) || 0);
        const min = isRecommendationMode ? Math.round(((parseFloat(selectedExternalTrainingRecommendation.hours) || 0) - hr) * 60) : (parseFloat(document.getElementById('extMins').value) || 0);
        const totalDecimalHours = +(hr + (min / 60)).toFixed(2);

        if (!topicValue || !organizerValue) {
            hideLoader();
            return showAlert('แจ้งเตือน', 'กรุณากรอกชื่อหลักสูตรและหน่วยงานที่จัดให้ครบ');
        }
        if (!isRecommendationMode && totalDecimalHours <= 0) {
            hideLoader();
            return showAlert('แจ้งเตือน', 'กรุณากรอกชั่วโมงการอบรมให้ถูกต้อง');
        }
        
        const payload = {
            user_id: user.id,
            topic: topicValue,
            organizer: organizerValue,
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
            handleExternalTrainingRecommendationChange('');
            // โหลดตารางประวัติใหม่เพื่อให้อัปเดตทันที
            loadTrainingHistory(); 
        } else {
            showAlert('ข้อผิดพลาด', res.message);
        }
    };
    
    reader.readAsDataURL(file); // เริ่มอ่านไฟล์
});
// ================= Admin: Approve External Training =================
let globalAdminExtRequests = [];

async function loadAdminExtRequests() {
    const tbody = document.getElementById('adminExtReqBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">กำลังโหลดข้อมูล...</td></tr>';
    
    const res = await callAPI('getAdminExternalReq', {});
    
    if (res.status === 'success') {
        globalAdminExtRequests = res.data;
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
                        <button class="btn btn-outline btn-sm" onclick="openExtEditModal('${req.ext_id}')" style="margin-right: 5px;"><i class="fas fa-edit"></i> แก้ไข</button>
                        <button class="btn btn-success btn-sm" onclick="handleExtReq('${req.ext_id}', 'approved')" style="margin-right: 5px;"><i class="fas fa-check"></i> อนุมัติ</button>
                        <button class="btn btn-sm" style="background:#EF4444; color:white;" onclick="handleExtReq('${req.ext_id}', 'rejected')"><i class="fas fa-times"></i> ปฏิเสธ</button>
                    </td>
                </tr>
            `;
        });
    }
}

function openExtEditModal(extId) {
    const req = globalAdminExtRequests.find(r => r.ext_id === extId);
    if (!req) return;
    
    document.getElementById('editExtReqId').value = req.ext_id;
    document.getElementById('editExtTopic').value = req.topic;
    
    let formattedDate = '';
    if (req.date) {
        const dateObj = new Date(req.date);
        if (!isNaN(dateObj)) {
            // Convert to Local Timezone formatted string YYYY-MM-DD
            const year = dateObj.getFullYear();
            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
            const day = String(dateObj.getDate()).padStart(2, '0');
            formattedDate = `${year}-${month}-${day}`;
        }
    }
    document.getElementById('editExtDate').value = formattedDate;
    document.getElementById('editExtHours').value = req.hours;
    
    document.getElementById('extEditModal').classList.remove('hidden');
}

function closeExtEditModal() {
    document.getElementById('extEditModal').classList.add('hidden');
}

async function saveExtReqEdit(event) {
    event.preventDefault();
    const extId = document.getElementById('editExtReqId').value;
    const topic = document.getElementById('editExtTopic').value.trim();
    const date = document.getElementById('editExtDate').value;
    const hours = parseFloat(document.getElementById('editExtHours').value) || 0;
    
    showLoader();
    const res = await callAPI('updateExternalStatus', { 
        ext_id: extId, 
        status: 'approved',
        topic: topic,
        date: date,
        hours: hours
    });
    hideLoader();
    
    if (res.status === 'success') {
        showAlert('สำเร็จ', 'บันทึกการแก้ไขและอนุมัติชั่วโมงอบรมเรียบร้อยแล้ว');
        closeExtEditModal();
        loadAdminExtRequests();
    } else {
        showAlert('ผิดพลาด', res.message);
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
        setPositionFieldValue('euPosition', 'euPositionOther', user.position || '');
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

    const position = getPositionFieldValue('euPosition', 'euPositionOther');
    if (!position) {
        showAlert('แจ้งเตือน', 'กรุณาเลือกหรือระบุตำแหน่ง');
        return;
    }
    
    const role = document.getElementById('euRole').value;
    let permissions = [];
    if (role === 'working_group_leader' || role === 'department_leader') {
        const rawPerms = document.getElementById('euPermissions').value || '';
        permissions = rawPerms.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);
    }
    
    const payload = {
        id: document.getElementById('editUserId').value,
        name: document.getElementById('euName').value,
        position: position,
        working_group: document.getElementById('euWorkingGroup').value,
        department: document.getElementById('euDept').value,
        role: role,
        password: document.getElementById('euPassword').value,
        permissions: permissions
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">กรุณาเลือกหลักสูตรจากด้านบนเพื่อดูรายงาน</td></tr>';
        summaryCard.classList.add('hidden');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">กำลังคำนวณและโหลดข้อมูล...</td></tr>';
    const res = await callAPI('getCourseReport', { course_id: courseId });

    if(res.status === 'success') {
        summaryCard.classList.remove('hidden');
        tbody.innerHTML = '';

        if(res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">ยังไม่มีผู้ลงทะเบียนในหลักสูตรนี้</td></tr>';
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: red;">โหลดข้อมูลผิดพลาด</td></tr>';
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
    finishCourseFlow();
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

function getUserPositionGroup(user) {
    const position = String((user && user.position) || '').trim();
    return position.includes('พยาบาลวิชาชีพ') ? 'nurse' : 'support';
}

function getCourseDeliveryLabel(deliveryType) {
    return deliveryType === 'classroom' ? 'อบรมในห้อง' : 'ออนไลน์';
}

function getCourseAudienceLabel(audience) {
    if (audience === 'nurse') return 'เฉพาะพยาบาลวิชาชีพ';
    if (audience === 'support') return 'เฉพาะสายสนับสนุน';
    return 'ทุกตำแหน่ง';
}

function isCourseVisibleToUser(course, user) {
    if (user && user.role === 'admin') return true;
    const audience = (course && course.audience) || 'all';
    const userGroup = getUserPositionGroup(user || getCurrentUser() || {});
    return audience === 'all' || audience === userGroup;
}

function isClassroomCourse(course) {
    return (course && course.delivery_type) === 'classroom';
}

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

    const user = appState.user || getCurrentUser();
    grid.innerHTML = '';
    if (!coursesToRender || coursesToRender.length === 0) {
        renderEmptyGrid('courseGrid', 'ไม่พบหลักสูตรที่ค้นหา');
        return;
    }

    coursesToRender.forEach(course => {
        const enrollData = cachedUserEnrollments.find(e => e.course_id === course.id);
        const classroomCourse = isClassroomCourse(course);
        let btnText = classroomCourse ? 'ทำแบบทดสอบหลังอบรม' : 'เข้าสู่บทเรียน';
        let btnClass = 'btn-primary';

        if (enrollData) {
            if (enrollData.status === 'completed') {
                btnText = classroomCourse ? 'เข้าสอบทบทวนอีกครั้ง' : 'เข้าเรียนอีกครั้ง';
                btnClass = 'btn-outline';
            } else if (!classroomCourse) {
                try {
                    const prog = JSON.parse(enrollData.progress || '{}');
                    if (prog.completed && prog.completed.length > 0) {
                        btnText = 'เรียนต่อ';
                        btnClass = 'btn-success';
                    }
                } catch (error) {}
            } else {
                btnText = 'เข้าสอบหลังอบรม';
            }
        }

        const badgeParts = [
            `<div class="course-badge">${getCourseDeliveryLabel(course.delivery_type)}</div>`,
            `<div class="course-badge">${getCourseAudienceLabel(course.audience)}</div>`
        ];

        if (course.is_mandatory && isCourseVisibleToUser(course, user)) {
            badgeParts.push('<div class="course-badge course-badge-mandatory">หลักสูตรบังคับ</div>');
        }

        const courseHint = classroomCourse
            ? (course.note || 'ไม่มีวิดีโอในระบบ ผู้เข้าอบรมทำแบบทดสอบหลังอบรมในห้องเรียน')
            : (course.note || 'เรียนตามหน่วยวิดีโอในระบบ และทำแบบทดสอบหลังเรียนเมื่อเรียนครบ');

        const isCompleted = enrollData && enrollData.status === 'completed';
        const statusHtml = isCompleted ? `<div style="margin-top: 10px; margin-bottom: 10px; color: #10B981; font-weight: bold; font-size: 0.95rem;"><i class="fas fa-check-circle"></i> สถานะ: เรียนจบแล้ว</div>` : '';
        const buttonsHtml = isCompleted 
            ? `<button class="btn ${btnClass} w-100" style="margin-bottom: 8px;" onclick="enrollCourse('${course.id}')">${btnText}</button>
               <button class="btn btn-success w-100" onclick="downloadCertificate('${course.id}')"><i class="fas fa-download"></i> ดาวน์โหลดเกียรติบัตร</button>`
            : `<button class="btn ${btnClass} w-100" onclick="enrollCourse('${course.id}')">${btnText}</button>`;

        grid.innerHTML += `
            <div class="course-card">
                <img src="${getDriveImageUrl(course.image)}" class="course-img" alt="${course.title}">
                <div class="course-info">
                    <div class="course-badge-row">${badgeParts.join('')}</div>
                    <h4 class="course-title">${course.title}</h4>
                    <div class="course-meta">
                        <span><i class="fas fa-building"></i> ${course.organizer || '-'}</span>
                        <span><i class="fas fa-clock"></i> ${formatHoursLabel(course.hours)}</span>
                        <span><i class="fas fa-circle-info"></i> ${courseHint}</span>
                    </div>
                    ${statusHtml}
                    ${buttonsHtml}
                </div>
            </div>
        `;
    });
}

/**
 * Download certificate with better error messaging
 */
async function downloadCertificate(courseId) {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    if (!user) {
        showAlert('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบใหม่');
        logout();
        return;
    }

    const targetCourse = globalCourses.find(c => c.id === courseId);
    if (!targetCourse) {
        showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลหลักสูตรนี้');
        return;
    }

    const enrollData = cachedUserEnrollments.find(e => e.course_id === courseId);
    if (!enrollData || enrollData.status !== 'completed') {
        showAlert('แจ้งเตือน', 'คุณยังเรียนไม่ผ่านหลักสูตรนี้');
        return;
    }

    // ===== IF CERTIFICATE ALREADY EXISTS =====
    if (enrollData.cert_url && isValidUrl_(enrollData.cert_url)) {
        window.open(enrollData.cert_url, '_blank', 'noopener,noreferrer');
        return;
    }

    // ===== GENERATE NEW CERTIFICATE =====
    showLoader();
    try {
        const certRes = await Promise.race([
            callAPI('generateCert', {
                user_id: user.id,
                user_name: user.name,
                course_id: courseId
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Certificate generation timeout after 90 seconds')), 90000)
            )
        ]);

        hideLoader();

        if (certRes && certRes.status === 'success' && certRes.pdf_url) {
            // ✅ FIX: Validate URL before opening
            if (isValidUrl_(certRes.pdf_url)) {
                enrollData.cert_url = certRes.pdf_url;
                // Open in new tab WITHOUT redirecting current page
                window.open(certRes.pdf_url, '_blank', 'noopener,noreferrer');
                
                showAlert('สำเร็จ', 'ใบประกาศกำลังเปิด...\n\nCertificate ID: ' + (certRes.cert_id || 'N/A'));
            } else {
                throw new Error('Invalid PDF URL received');
            }
        } else {
            const errorMsg = (certRes && certRes.message) 
                ? certRes.message
                : 'ไม่สามารถสร้างเกียรติบัตรได้';
            
            showAlert('ข้อผิดพลาด', errorMsg + '\n\nกรุณาตรวจสอบ:\n1. Template ID ได้รับการตั้งค่าแล้ว\n2. สิทธิ์การใช้งาน\n3. ลองใหม่อีกครั้ง');
        }
    } catch (error) {
        hideLoader();
        console.error('Certificate download error:', error);

        let friendlyMessage = 'ไม่สามารถสร้างเกียรติบัตรได้';
        
        if (error.message && error.message.includes('timeout')) {
            friendlyMessage = 'การขอหมดเวลา (90 วินาที) - โปรดลองใหม่อีกครั้ง';
        } else if (error.message && error.message.includes('Template')) {
            friendlyMessage = 'ข้อผิดพลาด: ไม่พบ Template ใบประกาศ\n\nโปรดติดต่อผู้ดูแลระบบ';
        }

        showAlert('ข้อผิดพลาด', friendlyMessage);
    }
}

function isValidUrl_(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch(e) {
        return false;
    }
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
                        ${course.mou_score > 0 ? `<span class="badge-mou"><i class="fas fa-star"></i> MOU: ${course.mou_score} คะแนน</span>` : ''}
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

function scrollGuideTo(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    if (tabId === 'externalTab') loadExternalTrainingRecommendationOptions(true);
    if (tabId === 'historyTab') loadTrainingHistory();
    if (tabId === 'profileTab') {
        const user = getCurrentUser();
        if (user) {
            document.getElementById('pName').value = user.name;
            setPositionFieldValue('pPosition', 'pPositionOther', user.position || '');
            document.getElementById('pUsername').value = user.username || '-';
            document.getElementById('pDept').value = user.department;
            document.getElementById('pPassword').value = '';
            document.getElementById('profilePreview').src = user.profile_img || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23cbd5e1'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>";
        }
    }
    if (tabId === 'guideTab') {
        const userContent = document.querySelector('.user-content');
        if (userContent) userContent.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (window.innerWidth <= 768 && document.body.classList.contains('sidebar-open')) {
        toggleSidebar();
    }
};

function toggleAdminMenu() {
    const menu = document.getElementById('adminNavbarMenu');
    const actions = document.getElementById('adminNavbarActions');
    if (menu && actions) {
        menu.classList.toggle('open');
        actions.classList.toggle('open');
    }
}

goToAdminPanel = function() {
    const user = appState.user || getCurrentUser();
    if (!user) return;

    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');

    const menus = document.querySelectorAll('.admin-navbar .navbar-menu li, .admin-sidebar .sidebar-menu li');
    if (user.role === 'admin') {
        menus.forEach(menu => {
            menu.style.display = 'flex';
        });
    } else if (user.role === 'working_group_leader' || user.role === 'department_leader') {
        menus.forEach(menu => {
            const clickAttr = menu.getAttribute('onclick') || '';
            if (clickAttr.indexOf('reportTab') !== -1 || clickAttr.indexOf('courseReportTab') !== -1) {
                menu.style.display = 'flex';
            } else {
                menu.style.display = 'none';
            }
        });
    }

    const reportMenu = Array.from(menus).find(menu => {
        const clickAttr = menu.getAttribute('onclick') || '';
        return clickAttr.indexOf('reportTab') !== -1 && menu.style.display !== 'none';
    }) || document.querySelector('.admin-navbar .navbar-menu li, .admin-sidebar .sidebar-menu li');

    switchAdminTab('reportTab', reportMenu);
};

switchAdminTab = function(tabId, element = null) {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));

    const menus = document.querySelectorAll('.admin-navbar .navbar-menu li, .admin-sidebar .sidebar-menu li');
    menus.forEach(menu => menu.classList.remove('active'));

    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.remove('hidden');

    if (element) {
        element.classList.add('active');
    } else {
        const fallback = Array.from(menus).find(menu => menu.getAttribute('onclick') && menu.getAttribute('onclick').includes(`'${tabId}'`));
        if (fallback) fallback.classList.add('active');
    }

    // Close admin responsive navbar on choice
    const adminNavbarMenu = document.getElementById('adminNavbarMenu');
    const adminNavbarActions = document.getElementById('adminNavbarActions');
    if (adminNavbarMenu) adminNavbarMenu.classList.remove('open');
    if (adminNavbarActions) adminNavbarActions.classList.remove('open');

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
            status: currentRecommendation ? (currentRecommendation.status || 'active') : 'active',
            mou_score: parseFloat(document.getElementById('extMouScore').value) || 0
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
        const mandatoryBadge = course.is_mandatory
            ? '<span class="table-status-badge active" style="margin-top: 6px;">บังคับ</span>'
            : '<span class="table-status-badge inactive" style="margin-top: 6px;">ไม่บังคับ</span>';

        tbody.innerHTML += `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>
                    ${getCourseDeliveryLabel(course.delivery_type)}<br>
                    <small style="color: var(--text-light);">${getCourseAudienceLabel(course.audience)}</small><br>
                    ${mandatoryBadge}
                </td>
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
    setPositionFieldValue('euPosition', 'euPositionOther', user.position || '');
    
    document.getElementById('euWorkingGroup').value = user.working_group || '';
    onWorkingGroupChange('euWorkingGroup', 'euDept');
    document.getElementById('euDept').value = user.department || '';
    
    document.getElementById('euEmail').value = user.email || '';
    document.getElementById('euPassword').value = user.password || '';
    document.getElementById('euRole').value = user.role || 'user';
    document.getElementById('euPermissions').value = (user.permissions || []).join('\n');
    togglePermissionsSection();
    
    document.getElementById('editUserSection').scrollIntoView({ behavior: 'smooth' });
};

function togglePermissionsSection() {
    const role = document.getElementById('euRole').value;
    const section = document.getElementById('euPermissionsSection');
    if (section) {
        if (role === 'working_group_leader' || role === 'department_leader') {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    }
}

function switchExtMode(mode) {
    currentExtMode = mode;
    const btnA = document.getElementById('btnModeA');
    const btnB = document.getElementById('btnModeB');
    const fieldsA = document.getElementById('extModeAFields');
    const fieldsB = document.getElementById('extModeBFields');
    
    if (mode === 'A') {
        if (btnA) btnA.className = 'btn btn-primary';
        if (btnB) btnB.className = 'btn btn-outline';
        if (fieldsA) fieldsA.style.display = 'block';
        if (fieldsB) fieldsB.style.display = 'none';
        
        document.getElementById('extDate').required = true;
        if (!selectedExternalTrainingRecommendation) {
            document.getElementById('extHours').required = true;
            document.getElementById('extMins').required = true;
        }
        
        document.getElementById('extDateStart').required = false;
        document.getElementById('extDateEnd').required = false;
    } else {
        if (btnA) btnA.className = 'btn btn-outline';
        if (btnB) btnB.className = 'btn btn-primary';
        if (fieldsA) fieldsA.style.display = 'none';
        if (fieldsB) fieldsB.style.display = 'block';
        
        document.getElementById('extDate').required = false;
        document.getElementById('extHours').required = false;
        document.getElementById('extMins').required = false;
        
        document.getElementById('extDateStart').required = true;
        document.getElementById('extDateEnd').required = true;
    }
}

function convertThaiDateToISODate(thaiDateStr) {
    if (!thaiDateStr) return '';
    const months = {
        'ม.ค.': '01', 'ก.พ.': '02', 'มี.ค.': '03', 'เม.ย.': '04', 'พ.ค.': '05', 'มิ.ย.': '06',
        'ก.ค.': '07', 'ส.ค.': '08', 'ก.ย.': '09', 'ต.ค.': '10', 'พ.ย.': '11', 'ธ.ค.': '12'
    };
    const parts = String(thaiDateStr).trim().split(/\s+/);
    if (parts.length !== 3) return '';
    const day = parts[0].padStart(2, '0');
    const month = months[parts[1]];
    const year = parseInt(parts[2], 10) - 543;
    if (!month || isNaN(year)) return '';
    return `${year}-${month}-${day}`;
}

function convertISODateToThaiDate(isoDateStr) {
    if (!isoDateStr) return '';
    const parts = isoDateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10) + 543;
    const monthIndex = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${day} ${months[monthIndex]} ${year}`;
}

function validateThaiDate(dateStr) {
    // If it's standard ISO format YYYY-MM-DD from calendar:
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return true;
    const regex = /^\d{1,2}\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+\d{4}$/;
    return regex.test(String(dateStr || '').trim());
}

function parseThaiDate(dateStr) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return new Date(dateStr);
    }
    const months = {
        'ม.ค.': 0, 'ก.พ.': 1, 'มี.ค.': 2, 'เม.ย.': 3, 'พ.ค.': 4, 'มิ.ย.': 5,
        'ก.ค.': 6, 'ส.ค.': 7, 'ก.ย.': 8, 'ต.ค.': 9, 'พ.ย.': 10, 'ธ.ค.': 11
    };
    const parts = String(dateStr || '').trim().split(/\s+/);
    if (parts.length !== 3) return null;
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1];
    const year = parseInt(parts[2], 10) - 543; // Buddhist year to AD
    if (isNaN(day) || isNaN(year) || months[monthStr] === undefined) return null;
    return new Date(year, months[monthStr], day);
}

function calculateModeBHours() {
    const startStr = document.getElementById('extDateStart').value.trim();
    const endStr = document.getElementById('extDateEnd').value.trim();
    const calcInput = document.getElementById('extHoursCalc');
    if (!calcInput) return;
    
    if (startStr && endStr) {
        const start = new Date(startStr);
        const end = new Date(endStr);
        if (end >= start) {
            const diffTime = Math.abs(end - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // inclusive
            const totalHours = diffDays * 7;
            calcInput.value = `${totalHours} ชม. (${diffDays} วัน)`;
        } else {
            calcInput.value = '';
        }
    } else {
        calcInput.value = '';
    }
}

function previewExternalTraining() {
    const topic = document.getElementById('extTopic').value.trim();
    const organizer = document.getElementById('extOrganizer').value.trim();
    
    if (!topic || !organizer) {
        return Swal.fire({
            icon: 'warning',
            title: 'แจ้งเตือน',
            text: 'กรุณากรอกชื่อหลักสูตรและหน่วยงานที่จัด',
            confirmButtonText: 'ตกลง'
        });
    }
    
    let dateStr = '';
    let hours = 0;
    
    if (currentExtMode === 'A') {
        const dateVal = document.getElementById('extDate').value.trim();
        if (!dateVal || !/^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
            return Swal.fire({
                icon: 'warning',
                title: 'แจ้งเตือน',
                text: 'รูปแบบวันที่ไม่ถูกต้อง กรุณาเลือกวันที่จากปฏิทิน',
                confirmButtonText: 'ตกลง'
            });
        }
        dateStr = convertISODateToThaiDate(dateVal);
        
        if (selectedExternalTrainingRecommendation) {
            hours = parseFloat(selectedExternalTrainingRecommendation.hours) || 0;
        } else {
            const hr = parseFloat(document.getElementById('extHours').value) || 0;
            const min = parseFloat(document.getElementById('extMins').value) || 0;
            hours = +(hr + (min / 60)).toFixed(2);
            if (hours <= 0) {
                return Swal.fire({
                    icon: 'warning',
                    title: 'แจ้งเตือน',
                    text: 'กรุณาระบุชั่วโมงการอบรม',
                    confirmButtonText: 'ตกลง'
                });
            }
        }
    } else {
        const startVal = document.getElementById('extDateStart').value.trim();
        const endVal = document.getElementById('extDateEnd').value.trim();
        if (!startVal || !/^\d{4}-\d{2}-\d{2}$/.test(startVal) || !endVal || !/^\d{4}-\d{2}-\d{2}$/.test(endVal)) {
            return Swal.fire({
                icon: 'warning',
                title: 'แจ้งเตือน',
                text: 'รูปแบบวันที่ไม่ถูกต้อง กรุณาเลือกวันที่จากปฏิทิน',
                confirmButtonText: 'ตกลง'
            });
        }
        const start = new Date(startVal);
        const end = new Date(endVal);
        if (end < start) {
            return Swal.fire({
                icon: 'warning',
                title: 'แจ้งเตือน',
                text: 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มอบรม',
                confirmButtonText: 'ตกลง'
            });
        }
        dateStr = `${convertISODateToThaiDate(startVal)} ถึง ${convertISODateToThaiDate(endVal)}`;
        
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        hours = diffDays * 7;
    }
    
    const fileInput = document.getElementById('extCertFile');
    if (!editingExtTrainingId && fileInput.files.length === 0) {
        return Swal.fire({
            icon: 'warning',
            title: 'แจ้งเตือน',
            text: 'กรุณาแนบไฟล์ใบประกาศ / หลักฐาน',
            confirmButtonText: 'ตกลง'
        });
    }
    
    if (fileInput.files.length > 0 && fileInput.files[0].size > 5 * 1024 * 1024) {
        return Swal.fire({
            icon: 'warning',
            title: 'แจ้งเตือน',
            text: 'ขนาดไฟล์ใหญ่เกินไป (ต้องไม่เกิน 5MB) กรุณาบีบอัดไฟล์ครับ',
            confirmButtonText: 'ตกลง'
        });
    }
    
    // Display preview in modal
    const previewContent = document.getElementById('extPreviewContent');
    if (previewContent) {
        previewContent.innerHTML = `
            <strong>ชื่อหลักสูตร/หัวข้อ:</strong> ${topic}<br>
            <strong>หน่วยงานที่จัด:</strong> ${organizer}<br>
            <strong>วันที่อบรม:</strong> ${dateStr}<br>
            <strong>จำนวนชั่วโมงสะสม:</strong> ${hours} ชั่วโมง<br>
            <strong>หลักฐานที่แนบ:</strong> ${fileInput.files.length > 0 ? fileInput.files[0].name : (editingExtTrainingId ? 'ใช้หลักฐานเดิม' : 'ไม่มี')}
        `;
    }
    
    pendingExtPayload = {
        topic,
        organizer,
        date: dateStr,
        hours,
        recommendation_id: selectedExternalTrainingRecommendation ? selectedExternalTrainingRecommendation.rec_id : ''
    };
    
    document.getElementById('extPreviewModal').classList.remove('hidden');
}

function closeExtPreview() {
    document.getElementById('extPreviewModal').classList.add('hidden');
}

async function confirmSaveExternalTraining() {
    if (!pendingExtPayload) return;
    
    document.getElementById('extPreviewModal').classList.add('hidden');
    showLoader();
    
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const fileInput = document.getElementById('extCertFile');
    
    const sendSaveRequest = async (fileUrl = '') => {
        let action = 'addExternalTraining';
        const payload = {
            user_id: user.id,
            topic: pendingExtPayload.topic,
            organizer: pendingExtPayload.organizer,
            date: pendingExtPayload.date,
            hours: pendingExtPayload.hours,
            recommendation_id: pendingExtPayload.recommendation_id
        };
        
        if (fileUrl) {
            payload.file_url = fileUrl;
            payload.fileData = fileUrl;
        }
        
        if (editingExtTrainingId) {
            action = 'updateExternalTrainingByUser';
            payload.ext_id = editingExtTrainingId;
        }
        
        const res = await callAPI(action, payload);
        hideLoader();
        
        if (res.status === 'success') {
            showAlert('สำเร็จ', editingExtTrainingId ? 'แก้ไขและส่งคำขอใหม่เรียบร้อยแล้ว' : 'บันทึกประวัติอบรมภายนอกสำเร็จ (รอการอนุมัติ)');
            document.getElementById('externalTrainingForm').reset();
            handleExternalTrainingRecommendationChange('');
            editingExtTrainingId = null;
            pendingExtPayload = null;
            switchUserTab('historyTab');
        } else {
            showAlert('ข้อผิดพลาด', res.message);
        }
    };
    
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();
        reader.onload = async function(e) {
            const base64Data = e.target.result;
            
            if (editingExtTrainingId) {
                const uploadRes = await callAPI('uploadFile', {
                    fileName: user.name + '_ExtCert_' + file.name,
                    fileData: base64Data
                });
                if (uploadRes.status === 'success') {
                    sendSaveRequest(uploadRes.url);
                } else {
                    hideLoader();
                    showAlert('ข้อผิดพลาด', 'อัปโหลดไฟล์ล้มเหลว: ' + uploadRes.message);
                }
            } else {
                let payload = {
                    user_id: user.id,
                    topic: pendingExtPayload.topic,
                    organizer: pendingExtPayload.organizer,
                    date: pendingExtPayload.date,
                    hours: pendingExtPayload.hours,
                    recommendation_id: pendingExtPayload.recommendation_id,
                    fileName: user.name + '_ExtCert_' + file.name,
                    fileData: base64Data
                };
                const res = await callAPI('addExternalTraining', payload);
                hideLoader();
                if (res.status === 'success') {
                    showAlert('สำเร็จ', 'บันทึกประวัติอบรมภายนอกสำเร็จ (รอการอนุมัติ)');
                    document.getElementById('externalTrainingForm').reset();
                    handleExternalTrainingRecommendationChange('');
                    pendingExtPayload = null;
                    switchUserTab('historyTab');
                } else {
                    showAlert('ข้อผิดพลาด', res.message);
                }
            }
        };
        reader.readAsDataURL(file);
    } else {
        sendSaveRequest('');
    }
}

async function editExtTraining(extId) {
    showLoader();
    const user = getCurrentUser();
    const res = await callAPI('getUserHistory', { user_id: user.id });
    hideLoader();
    
    if (res.status !== 'success') {
        return showAlert('ข้อผิดพลาด', 'ไม่สามารถดึงข้อมูลเพื่อแก้ไขได้');
    }
    
    const record = res.data.find(item => item.ext_id === extId);
    if (!record) return showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลที่ต้องการแก้ไข');
    
    editingExtTrainingId = extId;
    
    document.getElementById('extTopic').value = record.title || '';
    document.getElementById('extOrganizer').value = record.organizer || '';
    
    if (record.date.includes(' ถึง ')) {
        switchExtMode('B');
        const dates = record.date.split(' ถึง ');
        document.getElementById('extDateStart').value = convertThaiDateToISODate(dates[0]) || '';
        document.getElementById('extDateEnd').value = convertThaiDateToISODate(dates[1]) || '';
        calculateModeBHours();
    } else {
        switchExtMode('A');
        document.getElementById('extDate').value = convertThaiDateToISODate(record.date) || '';
        
        if (record.recommendation_id) {
            document.getElementById('extRecSelect').value = record.recommendation_id;
            handleExternalTrainingRecommendationChange(record.recommendation_id);
        } else {
            document.getElementById('extRecSelect').value = '';
            handleExternalTrainingRecommendationChange('');
            const hr = Math.floor(record.hours);
            const min = Math.round((record.hours - hr) * 60);
            document.getElementById('extHours').value = hr;
            document.getElementById('extMins').value = min;
        }
    }
    
    switchUserTab('externalTab');
}

async function deleteExtTraining(extId) {
    const confirmed = await showConfirm('ยืนยันการลบ', 'คุณแน่ใจหรือไม่ว่าต้องการลบรายการคำขอนี้?');
    if (!confirmed) return;
    
    showLoader();
    const user = getCurrentUser();
    const res = await callAPI('deleteExternalTraining', { ext_id: extId, user_id: user.id });
    hideLoader();
    
    if (res.status === 'success') {
        showAlert('สำเร็จ', 'ลบรายการคำขอเรียบร้อยแล้ว');
        loadTrainingHistory();
    } else {
        showAlert('ข้อผิดพลาด', res.message);
    }
}

function prevQuestion() {
    if (currentQIndex > 0) {
        currentQIndex--;
        renderQuestion();
    }
}
/**
 * Show notification when certificate is ready
 */
function showCertificateReadyNotification(certId, verifyUrl) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #10B981 0%, #059669 100%);
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
        font-size: 14px;
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
        font-family: 'Prompt', sans-serif;
    `;
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
            <i class="fas fa-check-circle" style="font-size: 20px;"></i>
            <strong>✓ ใบประกาศพร้อมใช้งาน!</strong>
        </div>
        <div style="font-size: 12px; opacity: 0.95;">
            Certificate ID: <strong>${certId}</strong>
        </div>
        ${verifyUrl ? `<div style="margin-top: 10px;"><a href="${verifyUrl}" target="_blank" style="color: white; text-decoration: underline;">🔍 ตรวจสอบ</a></div>` : ''}
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 8000);
}

// Add CSS animations
if (!document.querySelector('#certNotificationStyles')) {
    const style = document.createElement('style');
    style.id = 'certNotificationStyles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
// ================= CERTIFICATE DOWNLOAD WITH VERIFICATION - FRONTEND (app.js) =================
// Frontend: app.js
// This file contains all functions needed to verify and download certificates
// with automatic regeneration of missing files
// ==========================================================================================

/**
 * DOWNLOAD CERTIFICATE WITH VERIFICATION
 * Frontend function that handles certificate download with file verification
 * If file is missing, backend automatically regenerates it seamlessly
 * 
 * Usage: Call this when user clicks "Download Certificate" button
 * Example: onclick="downloadCertificateWithVerification(currentClassCourse.id)"
 */
async function downloadCertificateWithVerification(courseId) {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    if (!user) {
        showAlert('ข้อผิดพลาด', 'กรุณาเข้าสู่ระบบใหม่');
        logout();
        return;
    }

    const targetCourse = globalCourses.find(c => c.id === courseId);
    if (!targetCourse) {
        showAlert('ข้อผิดพลาด', 'ไม่พบข้อมูลหลักสูตรนี้');
        return;
    }

    const enrollData = cachedUserEnrollments.find(e => e.course_id === courseId);
    if (!enrollData || enrollData.status !== 'completed') {
        showAlert('แจ้งเตือน', 'คุณยังเรียนไม่ผ่านหลักสูตรนี้');
        return;
    }

    showLoader();
    try {
        // ===== STEP 1: CALL VERIFICATION API =====
        const verifyRes = await Promise.race([
            callAPI('verifyCertificateAndDownload', {
                user_id: user.id,
                course_id: courseId
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Verification timeout')), 120000)
            )
        ]);

        hideLoader();

        // ===== STEP 2: HANDLE RESPONSE =====
        if (verifyRes && verifyRes.status === 'success' && verifyRes.pdf_url) {
            
            // Update cache with latest URL
            enrollData.cert_url = verifyRes.pdf_url;
            
            // Show status based on whether file was regenerated
            if (verifyRes.file_regenerated) {
                showAlert(
                    '✓ ใบประกาศสร้างใหม่เรียบร้อย',
                    'ไฟล์ต้นฉบับหายไป ระบบได้สร้างใบประกาศใหม่แล้ว\n\n' +
                    'Certificate ID: ' + verifyRes.cert_id
                );
            } else if (verifyRes.file_verified) {
                // File already existed - no action needed
            }

            // Open certificate in new tab
            if (isValidUrl_(verifyRes.pdf_url)) {
                window.open(verifyRes.pdf_url, '_blank', 'noopener,noreferrer');
                console.log('Certificate opened: ' + verifyRes.cert_id);
            } else {
                throw new Error('Invalid PDF URL received');
            }

        } else {
            // Error response
            const errorMsg = (verifyRes && verifyRes.message) 
                ? verifyRes.message
                : 'ไม่สามารถตรวจสอบหรือดาวน์โหลดเกียรติบัตรได้';
            
            showAlert(
                'ข้อผิดพลาด',
                errorMsg + '\n\nกรุณา:\n' +
                '1. ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต\n' +
                '2. ทำการลองใหม่\n' +
                '3. ติดต่อผู้ดูแลระบบหากปัญหายังคงเกิด'
            );
        }

    } catch (error) {
        hideLoader();
        console.error('Certificate verification error:', error);

        let friendlyMessage = 'ไม่สามารถตรวจสอบเกียรติบัตรได้';
        
        if (error.message && error.message.includes('timeout')) {
            friendlyMessage = 'การขอหมดเวลา (2 นาที)\n\nระบบกำลังประมวลผล กรุณาลองใหม่ในอีกสักครู่';
        } else if (error.message && error.message.includes('Invalid')) {
            friendlyMessage = 'ข้อมูล URL ไม่ถูกต้อง\n\nติดต่อผู้ดูแลระบบ';
        }

        showAlert('ข้อผิดพลาด', friendlyMessage);
    }
}

/**
 * DOWNLOAD FROM PASSED COURSE MODAL
 * Enhanced function for downloading certificate from "Passed Courses" modal
 * 
 * @param {string} courseId - The course ID to download certificate for
 */
async function downloadCertificateFromModal(courseId) {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    if (!user) {
        logout();
        return;
    }
    
    await downloadCertificateWithVerification(courseId);
}

/**
 * INITIALIZE CERTIFICATE DOWNLOAD BUTTONS
 * Setup event listeners on all certificate download buttons
 * Call this once when page loads (in DOMContentLoaded handler)
 */
function initializeCertificateDownloadButtons() {
    // Update all certificate download buttons with data attributes
    const certButtons = document.querySelectorAll('[data-cert-action="download"]');
    
    certButtons.forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            const courseId = this.getAttribute('data-course-id');
            if (courseId) {
                await downloadCertificateWithVerification(courseId);
            }
        });
    });

    // Update modal button (from passed courses)
    const modalCertBtn = document.getElementById('btnPassedDownloadCert');
    if (modalCertBtn) {
        modalCertBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (currentPassedCourse && currentPassedCourse.id) {
                await downloadCertificateWithVerification(currentPassedCourse.id);
            }
        });
    }

    // Update result screen button (after post-test)
    const resultCertBtn = document.getElementById('btnDownloadCert');
    if (resultCertBtn) {
        resultCertBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (currentClassCourse && currentClassCourse.id) {
                await downloadCertificateWithVerification(currentClassCourse.id);
            }
        });
    }
}

/**
 * CHECK IF URL IS VALID HTTP/HTTPS URL
 * 
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid, false otherwise
 */
function isValidUrl_(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch(e) {
        return false;
    }
}

// ==================== Initialize Page ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded');
    
    // Initialize auth enhancements
    initializeAuthEnhancements();
    
    // Bind form events
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }

    // Initialize form event listeners for MOU calculation
    setTimeout(() => {
        initializeMOUCalculation();
    }, 500);
});
// ==================== Form Event Listeners ====================
function initializeMOUCalculation() {
    // 1. Bind event listeners for calculate MOU Score (Course)
    const cHoursInput = document.getElementById('cHours');
    const cMinsInput = document.getElementById('cMins');
    const cMouScoreInput = document.getElementById('cMOU');

    if (cHoursInput && cMinsInput && cMouScoreInput) {
        const updateCourseMOUScore = () => {
            const hours = parseFloat(cHoursInput.value) || 0;
            const mins = parseFloat(cMinsInput.value) || 0;
            const totalMinutes = (hours * 60) + mins;
            cMouScoreInput.value = calculateMOUScore(totalMinutes);
        };

        cHoursInput.addEventListener('input', updateCourseMOUScore);
        cHoursInput.addEventListener('change', updateCourseMOUScore);
        cMinsInput.addEventListener('input', updateCourseMOUScore);
        cMinsInput.addEventListener('change', updateCourseMOUScore);
    }

    // 2. Bind event listener for external recommendation course MOU
    const extRecHoursInput = document.getElementById('extRecHours');
    const extRecMinsInput = document.getElementById('extRecMins');
    const extMouScoreInput = document.getElementById('extMouScore');

    if (extRecHoursInput && extRecMinsInput && extMouScoreInput) {
        const updateExternalMOUScore = () => {
            const hours = parseFloat(extRecHoursInput.value) || 0;
            const mins = parseFloat(extRecMinsInput.value) || 0;
            const totalMinutes = (hours * 60) + mins;
            extMouScoreInput.value = calculateMOUScore(totalMinutes);
        };

        extRecHoursInput.addEventListener('input', updateExternalMOUScore);
        extRecHoursInput.addEventListener('change', updateExternalMOUScore);
        extRecMinsInput.addEventListener('input', updateExternalMOUScore);
        extRecMinsInput.addEventListener('change', updateExternalMOUScore);
    }

    // 3. Bind event listeners for Mode B calculator
    const extDateStart = document.getElementById('extDateStart');
    const extDateEnd = document.getElementById('extDateEnd');
    if (extDateStart) extDateStart.addEventListener('input', calculateModeBHours);
    if (extDateEnd) extDateEnd.addEventListener('input', calculateModeBHours);

    // 4. Bind event listener for course cover image preview
    const cCover = document.getElementById('cCover');
    if (cCover) {
        cCover.addEventListener('input', () => {
            const coverPreview = document.getElementById('cCoverPreview');
            if (coverPreview) {
                if (cCover.value) {
                    coverPreview.src = getDriveImageUrl(cCover.value);
                    coverPreview.style.display = 'block';
                } else {
                    coverPreview.src = '';
                    coverPreview.style.display = 'none';
                }
            }
        });
    }
}
let currentUser = null;
let adminMode = false;
// ==================== MOU Score Calculation Function ====================
/**
 * คำนวณคะแนน MOU ตามเกณฑ์:
 * น้อยกว่า 1 ชั่วโมง (0-59 นาที): 1 คะแนน
 * 1 ชั่วโมง - 1:59: 2 คะแนน
 * 2 ชั่วโมง - 2:59: 4 คะแนน
 * 3 ชั่วโมงขึ้นไป: 4 + ((ชั่วโมง - 3) * 2) คะแนน
 */
function calculateMOUScore(hoursOrMinutes) {
    let totalMinutes = 0;

    // ถ้า input เป็นตัวเลขธรรมชาติ ให้ถือว่าเป็นชั่วโมง
    if (typeof hoursOrMinutes === 'string') {
        hoursOrMinutes = parseFloat(hoursOrMinutes) || 0;
    }

    // แปลงชั่วโมงเป็นนาที
    if (hoursOrMinutes < 100) {
        totalMinutes = hoursOrMinutes * 60;
    } else {
        // ถ้าเป็นตัวเลขมากกว่า 100 ถือว่าเป็นนาทีแล้ว
        totalMinutes = hoursOrMinutes;
    }

    const totalHours = totalMinutes / 60;

    let score = 0;
    if (totalHours < 1) {
        score = 1;
    } else if (totalHours < 2) {
        score = 2;
    } else if (totalHours < 3) {
        score = 4;
    } else {
        // 3 ชั่วโมงขึ้นไป: 4 + เพิ่มขึ้น 2 คะแนนต่อชั่วโมง
        const hoursOver3 = totalHours - 3;
        score = 4 + Math.floor(hoursOver3 * 2);
    }

    return Math.max(score, 0);
}
