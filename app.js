const API_URL = 'https://script.google.com/macros/s/AKfycbxlfD-5saP7FtUX_YxuBe3gowToA38b0qc0jW5JuWjMN9XotTlqRfc0LuaWtibYNwMp1Q/exec'; 
const appState = {
    user: null,
    dashboardNeedsRefresh: true,
    dashboardStats: null,
    externalRecommendationsLoaded: false
};

const POSITION_PRESETS = [
    'เธเธฑเธเธงเธดเธเธฒเธเธฒเธฃเธชเธฒเธเธฒเธฃเธ“เธชเธธเธ(เธเธขเธฒเธเธฒเธฅ)',
    'เธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธ',
    'เธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธเธเธเธดเธเธฑเธ•เธดเธเธฒเธฃ',
    'เธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธเธเธณเธเธฒเธเธเธฒเธฃ',
    'เธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธเธเธณเธเธฒเธเธเธฒเธฃเธเธดเน€เธจเธฉ',
    'เธเธเธฑเธเธเธฒเธเธเนเธงเธขเน€เธซเธฅเธทเธญเธเธเนเธเน',
    'เธเธเธฑเธเธเธฒเธเธเธฃเธฐเธเธณเธ•เธถเธ'
];

let loaderCount = 0;
let courseRequestToken = 0;
let externalRecommendationRequestToken = 0;

function ensureForgotPasswordModal() {
    if (document.getElementById('forgotPasswordModal')) return;

    const wrapper = document.createElement('div');
    wrapper.id = 'forgotPasswordModal';
    wrapper.className = 'modal hidden';
    wrapper.innerHTML = `
        <div class="modal-content" style="text-align: left; max-width: 460px;">
            <h3 style="margin-bottom: 10px;">เธฅเธทเธกเธฃเธซเธฑเธชเธเนเธฒเธ</h3>
            <p style="margin-bottom: 20px;">เธเธฃเธญเธเธญเธตเน€เธกเธฅเธ—เธตเนเนเธเนเธฅเธเธ—เธฐเน€เธเธตเธขเธ เธฃเธฐเธเธเธเธฐเธชเนเธเธฅเธดเธเธเนเธชเธณเธซเธฃเธฑเธเธ•เธฑเนเธเธฃเธซเธฑเธชเธเนเธฒเธเนเธซเธกเนเนเธเธขเธฑเธเธญเธตเน€เธกเธฅเธเธฑเนเธ</p>
            <form id="forgotPasswordForm">
                <div class="input-group">
                    <input type="email" id="forgotPasswordEmail" placeholder="เธญเธตเน€เธกเธฅเธ—เธตเนเธฅเธเธ—เธฐเน€เธเธตเธขเธเนเธงเน" required>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" onclick="closeForgotPasswordModal()" class="btn btn-outline">เธขเธเน€เธฅเธดเธ</button>
                    <button type="submit" class="btn btn-primary">เธชเนเธเธฅเธดเธเธเนเธฃเธตเน€เธเนเธ•</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(wrapper);
}

function populatePositionSelectOptions(select) {
    if (!select || select.dataset.positionOptionsReady === 'true') return;

    const currentValue = select.value;
    const placeholderLabel = select.dataset.placeholder || 'เน€เธฅเธทเธญเธเธ•เธณเนเธซเธเนเธ';
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
    otherOption.textContent = 'เธ•เธณเนเธซเธเนเธเธญเธทเนเธ เน';
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
        select.dataset.placeholder = existingField.placeholder || 'เน€เธฅเธทเธญเธเธ•เธณเนเธซเธเนเธ';
        select.setAttribute('onchange', `handlePositionFieldChange('${selectId}', '${otherInputId}')`);
        parent.replaceChild(select, existingField);
    }

    populatePositionSelectOptions(select);

    let otherInput = document.getElementById(otherInputId);
    if (!otherInput) {
        otherInput = document.createElement('input');
        otherInput.type = 'text';
        otherInput.id = otherInputId;
        otherInput.placeholder = 'เธเธดเธกเธเนเธ•เธณเนเธซเธเนเธเธญเธทเนเธ เน';
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
        button.textContent = nextType === 'password' ? 'เนเธชเธ”เธ' : 'เธเนเธญเธ';
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
    toggleButton.textContent = 'เนเธชเธ”เธ';
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
    confirmGroup.innerHTML = '<input type="password" id="regConfirmPassword" placeholder="เธขเธทเธเธขเธฑเธเธฃเธซเธฑเธชเธเนเธฒเธเธญเธตเธเธเธฃเธฑเนเธ" required>';
    passwordGroup.insertAdjacentElement('afterend', confirmGroup);
    enhancePasswordField('regConfirmPassword');
}

function ensureForgotPasswordTrigger() {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm || loginForm.querySelector('.text-link-btn')) return;

    const submitButton = loginForm.querySelector('button[type="submit"]');
    if (!submitButton) return;

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'text-link-btn';
    trigger.textContent = 'เธฅเธทเธกเธฃเธซเธฑเธชเธเนเธฒเธ?';
    trigger.addEventListener('click', openForgotPasswordModal);
    submitButton.insertAdjacentElement('afterend', trigger);
}

function initializeAuthEnhancements() {
    ensureForgotPasswordModal();
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
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธญเธตเน€เธกเธฅเธ—เธตเนเธฅเธเธ—เธฐเน€เธเธตเธขเธเนเธงเน');
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
        showAlert('เธ•เธฃเธงเธเธชเธญเธเธญเธตเน€เธกเธฅ', res.message || 'เธซเธฒเธเธญเธตเน€เธกเธฅเธเธตเนเธกเธตเธญเธขเธนเนเนเธเธฃเธฐเธเธ เธเธฐเธกเธตเธฅเธดเธเธเนเธชเธณเธซเธฃเธฑเธเธ•เธฑเนเธเธฃเธซเธฑเธชเธเนเธฒเธเนเธซเธกเนเธชเนเธเนเธเนเธซเน');
    } else {
        showAlert('เน€เธเธดเธ”เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธชเนเธเธฅเธดเธเธเนเธฃเธตเน€เธเนเธ•เธฃเธซเธฑเธชเธเนเธฒเธเนเธ”เน');
    }
}

// เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเธทเนเธเธเธฒเธเน€เธกเธทเนเธญเน€เธเธดเธ”เน€เธงเนเธ
window.addEventListener('DOMContentLoaded', async () => {
    // 1. เธญเธฑเธเน€เธ”เธ•เธเธตเนเธ Footer เธ—เธฑเธเธ—เธต (เธ—เธธเธเธเธธเธ”เธ—เธตเนเนเธเนเธเธฅเธฒเธช current-year)
    initializeAuthEnhancements();
    const years = document.querySelectorAll('.current-year');
    const thisYear = new Date().getFullYear();
    years.forEach(el => el.innerText = thisYear);

    // 2. เนเธซเธฅเธ”เธฃเธฒเธขเธเธทเนเธญเธซเธเนเธงเธขเธเธฒเธเธชเธณเธซเธฃเธฑเธเธเนเธญเธเน€เธฅเธทเธญเธเนเธฅเธฐ datalist เธ—เธตเนเธขเธฑเธเนเธเนเธเธฒเธเธญเธขเธนเน
    try {
        const res = await callAPI('getSettings', {});
        if(res && res.status === 'success') {
            const departments = Array.isArray(res.data) ? res.data : [];
            const deptList = document.getElementById('deptList');
            if (deptList) {
                deptList.innerHTML = '';
                departments.forEach((department) => {
                    const option = document.createElement('option');
                    option.value = department;
                    deptList.appendChild(option);
                });
            }

            const registerDept = document.getElementById('regDept');
            if (registerDept) {
                registerDept.innerHTML = '<option value="">เน€เธฅเธทเธญเธเธซเธเนเธงเธขเธเธฒเธ</option>';
                departments.forEach((department) => {
                    const option = document.createElement('option');
                    option.value = department;
                    option.textContent = department;
                    registerDept.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error("เธฃเธฐเธเธเนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธฃเธฒเธขเธเธฒเธฃเธซเธเนเธงเธขเธเธฒเธเนเธ”เน:", err);
    }
});

// เธ•เธฃเธงเธเธชเธญเธเธชเธ–เธฒเธเธฐเธเธฒเธฃเธฅเนเธญเธเธญเธดเธเน€เธกเธทเนเธญเน€เธเธดเธ”เธซเธเนเธฒเน€เธงเนเธ

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
    closeForgotPasswordModal();
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
        return { status: 'error', message: 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เน€เธเธทเนเธญเธกเธ•เนเธญเน€เธเธดเธฃเนเธเน€เธงเธญเธฃเนเนเธ”เน' };
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
    } else showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message);
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;
    const position = getPositionFieldValue('regPosition', 'regPositionOther');

    if (!position) {
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฃเธทเธญเธฃเธฐเธเธธเธ•เธณเนเธซเธเนเธ');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธฃเธซเธฑเธชเธเนเธฒเธเนเธฅเธฐเธขเธทเธเธขเธฑเธเธฃเธซเธฑเธชเธเนเธฒเธเนเธกเนเธ•เธฃเธเธเธฑเธ');
        return;
    }

    showLoader();
    const payload = {
        name: document.getElementById('regName').value.trim(), 
        position: position, 
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
        showAlert('เธชเธณเน€เธฃเนเธ', 'เธฅเธเธ—เธฐเน€เธเธตเธขเธเน€เธฃเธตเธขเธเธฃเนเธญเธข เธเธฃเธธเธ“เธฒเน€เธเนเธฒเธชเธนเนเธฃเธฐเธเธ'); 
        toggleAuth(); 
    } else showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message);
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
        showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', statRes.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธชเธ–เธดเธ•เธดเนเธ”เน');
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
// เนเธเธ Event เนเธซเนเธเนเธญเธเธญเธฑเธเนเธซเธฅเธ”เธฃเธนเธเธซเธเนเธฒเธเธเนเธญเธ”เธกเธดเธ
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
    document.getElementById('cCoverStatus').innerText = "เธเธณเธฅเธฑเธเธญเธฑเธเนเธซเธฅเธ”...";
    const res = await uploadImageFile(this.files[0], 'Cover');
/*
        if(res.status === 'success') {
            document.getElementById('cCover').value = res.url;
            document.getElementById('cCoverStatus').innerHTML = '<span style="color:green;">โ… เธญเธฑเธเนเธซเธฅเธ”เธชเธณเน€เธฃเนเธ</span>';
        }
*/
    if (res.status === 'success') {
        document.getElementById('cCover').value = res.url;
        document.getElementById('cCoverStatus').innerHTML = '<span style="color:green;">เธญเธฑเธเนเธซเธฅเธ”เธชเธณเน€เธฃเนเธ</span>';
    } else {
        document.getElementById('cCoverStatus').innerHTML = '<span style="color:#ef4444;">เธญเธฑเธเนเธซเธฅเธ”เนเธกเนเธชเธณเน€เธฃเนเธ</span>';
    }
});

// เธชเนเธเธเธญเธฃเนเธกเนเธเนเนเธ Profile
document.getElementById('extRecCoverUpload').addEventListener('change', async function() {
    if(!this.files[0]) return;
    document.getElementById('extRecCoverStatus').innerText = 'เธเธณเธฅเธฑเธเธญเธฑเธเนเธซเธฅเธ”...';
    const res = await uploadImageFile(this.files[0], 'ExternalRecCover');
    if (res.status === 'success') {
        document.getElementById('extRecCover').value = res.url;
        document.getElementById('extRecCoverStatus').innerHTML = '<span style="color:green;">เธญเธฑเธเนเธซเธฅเธ”เธชเธณเน€เธฃเนเธ</span>';
    } else {
        document.getElementById('extRecCoverStatus').innerHTML = '<span style="color:#ef4444;">เธญเธฑเธเนเธซเธฅเธ”เนเธกเนเธชเธณเน€เธฃเนเธ</span>';
    }
});

document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = getCurrentUser();
    const file = document.getElementById('pImgUpload').files[0];
    const position = getPositionFieldValue('pPosition', 'pPositionOther');
    if (!position) {
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฃเธทเธญเธฃเธฐเธเธธเธ•เธณเนเธซเธเนเธ');
        return;
    }
    showLoader();
    
    let profileUrl = user.profile_img;
    // เธ–เนเธฒเธกเธตเธเธฒเธฃเน€เธฅเธทเธญเธเธฃเธนเธเนเธซเธกเน เนเธซเนเธญเธฑเธเนเธซเธฅเธ”เธเนเธญเธ
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
        department: document.getElementById('pDept').value, 
        password: document.getElementById('pPassword').value,
        profile_img: profileUrl
    });
    hideLoader();

    if(res.status === 'success') {
        user.name = document.getElementById('pName').value;
        user.position = position;
        user.department = document.getElementById('pDept').value;
        user.profile_img = profileUrl;
        localStorage.setItem('swd_user', JSON.stringify(user));
        showAlert('เธชเธณเน€เธฃเนเธ', 'เธญเธฑเธเน€เธ”เธ•เธเนเธญเธกเธนเธฅเธชเนเธงเธเธ•เธฑเธงเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง');
        initApp(); // เธฃเธตเน€เธเธฃเธเธซเธเนเธฒเธเธญ
    }
});

// เน€เธ•เธดเธกเธเนเธญเธกเธนเธฅเธฅเธเธเธญเธฃเนเธกเนเธฅเธฐเธฃเธตเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเน€เธกเธทเนเธญเน€เธเธฅเธตเนเธขเธเนเธ—เนเธ
function switchUserTab(tabId, element) {
    const tabs = document.querySelectorAll('.user-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    const menus = document.querySelectorAll('#userMenu li');
    menus.forEach(menu => menu.classList.remove('active'));
    
    document.getElementById(tabId).classList.remove('hidden');
    
    // เธเนเธญเธเธเธฑเธ Error เธ–เนเธฒเธซเธฒ element เนเธกเนเน€เธเธญ
    if (element) {
        element.classList.add('active');
    }

    // --- เธชเนเธงเธเธฃเธตเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธ•เธฒเธกเนเธ—เนเธเธ—เธตเนเธเธ” ---
    if(tabId === 'dashboardTab') {
        initApp(); // เธชเธฑเนเธเธ”เธถเธเธชเธ–เธดเธ•เธดเนเธ”เธเธเธญเธฃเนเธ”เนเธฅเธฐเธเธฒเธฃเนเธ”เธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธซเธกเนเธ—เธธเธเธเธฃเธฑเนเธเธ—เธตเนเธเธฅเธฑเธเธกเธฒเธซเธเนเธฒเธเธตเน
    }
    if(tabId === 'historyTab') {
        loadTrainingHistory();
    }
    if(tabId === 'profileTab') {
        const user = JSON.parse(localStorage.getItem('swd_user'));
        document.getElementById('pName').value = user.name;
        setPositionFieldValue('pPosition', 'pPositionOther', user.position || '');
        document.getElementById('pUsername').value = user.username || '-';
        document.getElementById('pDept').value = user.department;
        document.getElementById('pPassword').value = '';
        if(user.profile_img) document.getElementById('profilePreview').src = user.profile_img;
    }
}

// เธเธฑเธเธเนเธเธฑเธเนเธซเธฅเธ”เธเธฃเธฐเธงเธฑเธ•เธดเธฅเธเธ•เธฒเธฃเธฒเธ Portfolio
async function loadTrainingHistory() {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const tbody = document.getElementById('historyTableBody');
    if(!tbody) return;
    
    // เน€เธเธฅเธตเนเธขเธ colspan เน€เธเนเธ 6 เน€เธเธฃเธฒเธฐเน€เธฃเธฒเน€เธเธดเนเธกเธเธญเธฅเธฑเธกเธเน
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">เธเธณเธฅเธฑเธเธ”เธถเธเธเนเธญเธกเธนเธฅเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธญเธเธฃเธก...</td></tr>';
    const res = await callAPI('getUserHistory', { user_id: user.id });
    
    if (res.status === 'success') {
        tbody.innerHTML = ''; 
        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">เธขเธฑเธเนเธกเนเธกเธตเธเธฃเธฐเธงเธฑเธ•เธดเธเธฒเธฃเธญเธเธฃเธกเนเธเธฃเธฐเธเธเธเธฃเธฑเธ</td></tr>';
            return;
        }
        
        res.data.forEach(item => {
            // เธเธฑเธเธเธฑเธเนเธกเนเนเธซเนเธเธธเนเธกเธ•เธเธเธฃเธฃเธ—เธฑเธ” (white-space: nowrap)
            const certBtn = item.cert_url && item.cert_url.trim() !== '' 
                ? `<a href="${item.cert_url}" target="_blank" class="btn btn-outline" style="padding: 5px 10px; font-size: 0.85rem; white-space: nowrap;"><i class="fas fa-file-pdf text-danger"></i> เธซเธฅเธฑเธเธเธฒเธ</a>`
                : '<span style="color: #94a3b8; font-size: 0.85rem; white-space: nowrap;">เนเธกเนเธกเธตเนเธเธฅเน</span>';
            
            // เธเนเธฒเธขเธเธณเธเธฑเธเธชเธ–เธฒเธเธฐเธชเธณเธซเธฃเธฑเธเธญเธเธฃเธกเธ เธฒเธขเธเธญเธ
            let statusBadge = '';
            if(item.status === 'pending') statusBadge = '<span class="badge" style="background:#f59e0b; color:white; font-size: 0.7rem; white-space: nowrap;">เธฃเธญเธ•เธฃเธงเธ</span>';
            else if(item.status === 'rejected') statusBadge = '<span class="badge" style="background:#ef4444; color:white; font-size: 0.7rem; white-space: nowrap;">เนเธกเนเธญเธเธธเธกเธฑเธ•เธด</span>';
                
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
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #EF4444;">เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเนเธ”เน เธเธฃเธธเธ“เธฒเธฅเธญเธเนเธซเธกเน</td></tr>';
    }
}
// ================= Course Display & Search Logic =================
let globalCourses = []; 
let cachedUserEnrollments = []; // เน€เธเนเธเธชเธ–เธฒเธเธฐเธเธฒเธฃเน€เธฃเธตเธขเธเนเธงเนเนเธเน€เธเธฃเธทเนเธญเธ เธเธฐเนเธ”เนเนเธกเนเธ•เนเธญเธเนเธซเธฅเธ”เธเนเธณเธ•เธญเธเธเนเธเธซเธฒ
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
        renderCourseGrid(globalCourses); // เธชเธฑเนเธเธงเธฒเธ”เธเธฒเธฃเนเธ”เธ—เธฑเนเธเธซเธกเธ”เธเธฃเธฑเนเธเนเธฃเธ
    }
}

// เธเธฑเธเธเนเธเธฑเธเธเนเธเธซเธฒเธซเธฅเธฑเธเธชเธนเธ•เธฃ (เธ—เธณเธเธฒเธเน€เธกเธทเนเธญเธเธดเธกเธเนเธเนเธญเธเธงเธฒเธก)
function filterCourses() {
    const user = appState.user || getCurrentUser();
    const searchText = document.getElementById('courseSearchInput').value.trim().toLowerCase();
    const visibleCourses = globalCourses.filter(course => isCourseVisibleToUser(course, user));
    
    if (searchText === '') {
        renderCourseGrid(visibleCourses); // เนเธเธงเนเธ—เธฑเนเธเธซเธกเธ”
    } else {
        const filtered = visibleCourses.filter(course => 
            course.title.toLowerCase().includes(searchText)
        );
        renderCourseGrid(filtered); // เนเธเธงเนเน€เธเธเธฒเธฐเธ—เธตเนเธเนเธเน€เธเธญ
    }
}

// เธเธฑเธเธเนเธเธฑเธเธงเธฒเธ”เธเธฒเธฃเนเธ”เธซเธฅเธฑเธเธชเธนเธ•เธฃเธฅเธเธซเธเนเธฒเธเธญ
function renderCourseGrid(coursesToRender) {
    const grid = document.getElementById('courseGrid');
    grid.innerHTML = '';
    
    if (coursesToRender.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-light); padding: 30px; background: #f8fafc; border-radius: 8px;">เนเธกเนเธเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ—เธตเนเธเนเธเธซเธฒเธเธฃเธฑเธ</div>';
        return;
    }

    coursesToRender.forEach(course => {
        const enrollData = cachedUserEnrollments.find(e => e.course_id === course.id);
        let btnText = "เน€เธเนเธฒเธชเธนเนเธเธ—เน€เธฃเธตเธขเธ", btnClass = "btn-primary";
        
        if(enrollData) {
            if(enrollData.status === 'completed') {
                btnText = "เน€เธเนเธฒเธชเธนเนเธเธ—เน€เธฃเธตเธขเธเธญเธตเธเธเธฃเธฑเนเธ"; btnClass = "btn-outline";
            } else {
                try {
                    let prog = JSON.parse(enrollData.progress);
                    if(prog.completed && prog.completed.length > 0) { btnText = "เน€เธฃเธตเธขเธเธ•เนเธญ"; btnClass = "btn-success"; }
                } catch(e) {}
            }
        }

        grid.innerHTML += `
            <div class="course-card">
                <img src="${getDriveImageUrl(course.image)}" class="course-img">
                <div class="course-info">
                    <h4>${course.title}</h4>
                    <div class="course-meta">
                        <span><i class="fas fa-clock"></i> ${course.hours} เธเธก.</span>
                    </div>
                    <button class="btn ${btnClass} w-100" onclick="enrollCourse('${course.id}')">${btnText}</button>
                </div>
            </div>
        `;
    });
}

// เธ•เธฃเธงเธเธชเธญเธเธชเธ–เธฒเธเธฐเธเธฒเธฃเธฅเนเธญเธเธญเธดเธเน€เธกเธทเนเธญเน€เธเธดเธ”เธซเธเนเธฒเน€เธงเนเธ
// ================= Admin Logic =================

function goToAdminPanel() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
    loadAdminReport(); // เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธ•เธฒเธฃเธฒเธเธชเธ–เธดเธ•เธดเธ—เธฑเธเธ—เธตเธ—เธตเนเน€เธเนเธฒเธซเธเนเธฒเนเธญเธ”เธกเธดเธ
}

// เธญเธญเธเธเธฒเธเธฃเธฐเธเธเนเธญเธ”เธกเธดเธ (เธเธฅเธฑเธเธซเธเนเธฒเธเธนเนเนเธเนเธเธฒเธเนเธฅเธฐเธฃเธตเน€เธเธฃเธ)
function exitAdmin() {
    // เน€เธฃเธตเธขเธเนเธเนเธฃเธฐเธเธเธเธฅเธฑเธเธซเธเนเธฒเธซเธฅเธฑเธเนเธเธเธฃเธตเน€เธเธฃเธเธเนเธญเธกเธนเธฅ
    returnToDashboard();
}

function switchAdminTab(tabId, element = null) {
    // เธเนเธญเธเธ—เธธเธ Tab
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    // เธฅเธ Active menu
    const menus = document.querySelectorAll('.admin-sidebar li'); // เน€เธเนเธเนเธซเนเธ•เธฃเธเธเธฑเธเธเธฅเธฒเธชเน€เธกเธเธนเธเธญเธเธเธธเธ“ (เน€เธเนเธ .admin-sidebar li เธซเธฃเธทเธญ .sidebar-menu li)
    menus.forEach(menu => menu.classList.remove('active'));
    
    // เนเธเธงเน Tab เธ—เธตเนเน€เธฅเธทเธญเธ
    const targetTab = document.getElementById(tabId);
    if(targetTab) targetTab.classList.remove('hidden');
    
    // เน€เธเธดเนเธกเธชเธต Active เนเธซเนเน€เธกเธเธนเธ—เธตเนเธ–เธนเธเธเธฅเธดเธ (เนเธเธเธเนเธญเธเธเธฑเธ Error)
    if (element) {
        element.classList.add('active');
    } else if (window.event && window.event.currentTarget) {
        window.event.currentTarget.classList.add('active');
    }
    
    // เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธ•เธฒเธกเธซเธเนเธฒ Tab เธ—เธตเนเน€เธฅเธทเธญเธ
    if(tabId === 'reportTab') loadAdminReport();
    if(tabId === 'courseMgtTab') {
        appState.coursesLoaded = false;
        setDashboardRefreshNeeded();
        resetCourseForm();
        loadAdminCoursesTable(); 
    }
    if(tabId === 'examMgtTab') {
        initExamAdmin(); // เน€เธฃเธตเธขเธเธเธฑเธเธเนเธเธฑเธเธ”เธถเธเธฃเธฒเธขเธเธทเนเธญเธงเธดเธเธฒเธกเธฒเนเธชเน Dropdown
    }
    if(tabId === 'approveExtTab') {
        loadAdminExtRequests();
    }
    if(tabId === 'userMgtTab') {
        loadAdminUsersTable();
    }
    if(tabId === 'courseReportTab') {
        initCourseReportAdmin(); // เนเธซเธฅเธ”เธฃเธฒเธขเธเธทเนเธญเธงเธดเธเธฒเนเธชเน Dropdown
    }
}

// ================= Admin: Report & Stats (เธเธฃเนเธญเธกเธฃเธฐเธเธเธเธฃเธญเธ) =================
let globalAdminReportData = []; // เธชเธฃเนเธฒเธเธ•เธฑเธงเนเธเธฃเน€เธเนเธเธเนเธญเธกเธนเธฅเธชเธ–เธดเธ•เธดเนเธงเนเนเธเน€เธเธฃเธทเนเธญเธ เธเธฐเนเธ”เนเนเธกเนเธ•เนเธญเธเนเธซเธฅเธ”เนเธซเธกเนเธ•เธญเธเน€เธเธฅเธตเนเธขเธ Dropdown
let adminChartInstance = null;  // เธ•เธฑเธงเนเธเธฃเน€เธเนเธเธเธฃเธฒเธ

// เธเธฑเธเธเนเธเธฑเธเธ”เธถเธเธเนเธญเธกเธนเธฅเธเธฒเธ API (เธ—เธณเธเธฒเธเธเธฃเธฑเนเธเนเธฃเธเธ•เธญเธเน€เธเธดเธ”เนเธ—เนเธ)
async function loadAdminReport() {
    const tbody = document.getElementById('reportTableBody'); 
    if(!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธชเธ–เธดเธ•เธด...</td></tr>';
    const res = await callAPI('getAdminReport', {});
    
    if (res.status === 'success') {
        globalAdminReportData = res.data; 
        filterAdminReport();
    } else {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: red;">เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเธดเธ”เธเธฅเธฒเธ”</td></tr>`;
    }
}

function filterAdminReport() {
    const selectedDept = document.getElementById('adminReportDeptFilter').value.trim();
    const selectedGroup = document.getElementById('adminReportGroupFilter').value;

    const filteredData = globalAdminReportData.filter(item => {
        const deptMatch = selectedDept === '' || item.department === selectedDept;
        const groupMatch = selectedGroup === 'all' || item.position_group === selectedGroup;
        return deptMatch && groupMatch;
    });

    renderReportTableAndChart(filteredData);
}

function renderReportTableAndChart(dataToShow) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';
    
    if (dataToShow.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center;">เนเธกเนเธกเธตเธเนเธญเธกเธนเธฅเธเธนเนเนเธเนเธเธฒเธเธ•เธฒเธกเน€เธเธทเนเธญเธเนเธเธ—เธตเนเน€เธฅเธทเธญเธ</td></tr>';
        renderAdminChart({}); // เธงเธฒเธ”เธเธฃเธฒเธเน€เธเธฅเนเธฒ
        return;
    }
    
    let deptStats = {}; // เน€เธเนเธเธชเธ–เธดเธ•เธดเธ—เธณเธเธฃเธฒเธ
    
    dataToShow.forEach(r => {
        if (!deptStats[r.department]) deptStats[r.department] = { passed: 0, failed: 0 };
        if (r.is_passed) deptStats[r.department].passed++;
        else deptStats[r.department].failed++;

        let statusColor = '#EF4444';
        if (r.status_code === 'pass') statusColor = '#10B981';
        if (r.status_code === 'warning') statusColor = '#f59e0b';

        const statusBadge = `<span class="badge" style="background: ${statusColor}; color: white;">${r.status}</span>`;
        const positionGroupLabel = r.position_group === 'nurse' ? 'เธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธ' : 'เธชเธฒเธขเธชเธเธฑเธเธชเธเธธเธ';
        const dayLabel = r.position_group === 'nurse' ? r.totalDays : '-';
        const mandatoryLabel = r.position_group === 'support'
            ? `${r.mandatory_completed}/${r.mandatory_total || 0}`
            : '-';
        const mandatoryHint = r.position_group === 'support' && Array.isArray(r.mandatory_pending_titles) && r.mandatory_pending_titles.length > 0
            ? `<br><small style="color: var(--text-light);">เธเธเน€เธซเธฅเธทเธญ: ${r.mandatory_pending_titles.join(', ')}</small>`
            : '';
            
        tbody.innerHTML += `
            <tr>
                <td><strong>${r.name}</strong></td>
                <td>${r.position || '-'}<br><small style="color: var(--text-light);">${r.department}</small></td>
                <td>${positionGroupLabel}<br><small style="color: var(--text-light);">${r.criteria_type}</small></td>
                <td>${r.internal}</td>
                <td>${r.external}</td>
                <td><strong>${r.totalHours}</strong></td>
                <td><strong>${dayLabel}</strong></td>
                <td><strong>${mandatoryLabel}</strong>${mandatoryHint}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    // เธงเธฒเธ”เธเธฃเธฒเธ
    renderAdminChart(deptStats);
}

// เธเธฑเธเธเนเธเธฑเธเธงเธฒเธ”เธเธฃเธฒเธ Chart.js
function renderAdminChart(deptStats) {
    const ctx = document.getElementById('passRateChart').getContext('2d');
    
    // เธฅเธเธเธฃเธฒเธเน€เธเนเธฒเธ—เธดเนเธเธเนเธญเธ (เธ–เนเธฒเธกเธต) เธเนเธญเธเธเธฑเธเธเธฑเนเธเธเธฃเธฒเธเธเธฃเธฐเธเธฃเธดเธเธเนเธญเธเธเธฑเธ
    if (adminChartInstance) adminChartInstance.destroy();

    const labels = Object.keys(deptStats);
    const passedData = labels.map(dept => deptStats[dept].passed);
    const failedData = labels.map(dept => deptStats[dept].failed);

    adminChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                { label: 'เธเนเธฒเธเน€เธเธ“เธ‘เน (เธเธ)', data: passedData, backgroundColor: '#10B981', borderRadius: 4 },
                { label: 'เธขเธฑเธเนเธกเนเธเนเธฒเธ (เธเธ)', data: failedData, backgroundColor: '#EF4444', borderRadius: 4 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { stacked: true }, 
                y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1 } } // เธเธฑเธเธเธฑเธเนเธซเนเธเธฃเธฒเธเนเธเธงเธ•เธฑเนเธเน€เธเนเธเน€เธฅเธเธเธณเธเธงเธเน€เธ•เนเธก (เธเธ)
            },
            plugins: { 
                legend: { position: 'top' } 
            }
        }
    });
}
// เธเธฑเธเธเนเธเธฑเธ Export Excel เธญเธขเนเธฒเธเธเนเธฒเธขเธ”เนเธงเธข JS
function exportToExcel() {
    let table = document.getElementById('adminReportTable');
    if (!table) return;
    let html = table.outerHTML.replace(/ /g, '%20');
    let a = document.createElement('a');
    a.href = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + html;
    a.download = 'training_report_swd.xls';
    a.click();
}

// ================= Course Management Logic =================

let adminCoursesData = [];

// เนเธซเธฅเธ”เธฃเธฒเธขเธเธทเนเธญเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธเธ•เธฒเธฃเธฒเธเนเธญเธ”เธกเธดเธ
async function loadAdminCoursesTable() {
    showLoader();
    const res = await callAPI('getAdminCourses', {});
    hideLoader();

    const tbody = document.getElementById('adminCourseListBody');
    tbody.innerHTML = '';

    if (res.status === 'success') {
        adminCoursesData = res.data; 
        res.data.forEach(course => {
            // เนเธเธฅเธเธเธฑเนเธงเนเธกเธเธเธฅเธฑเธเธกเธฒเนเธชเธ”เธเธเธฅ
            const hr = Math.floor(course.hours);
            const min = Math.round((course.hours - hr) * 60);
            const timeText = min > 0 ? `${hr} เธเธก. ${min} เธเธฒเธ—เธต` : `${hr} เธเธก.`;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${course.title}</strong></td>
                    <td>${course.organizer}</td>
                    <td>${timeText}</td>
                    <td>
                        <button class="btn btn-action btn-edit" onclick="editCourse('${course.course_id}')"><i class="fas fa-edit"></i> เนเธเนเนเธ</button>
                    </td>
                </tr>
            `;
        });
    }
}

// เธเธฑเธเธเนเธเธฑเธเน€เธเธดเนเธก/เธฅเธ เธเธฅเนเธญเธเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธงเธดเธ”เธตเนเธญ
function addUnitField(title = '', video = '', time = '') {
    const container = document.getElementById('unitsContainer');
    const unitHTML = `
        <div class="unit-box">
            <div class="unit-row">
                <input type="text" class="u-title" placeholder="เธเธทเนเธญเธซเธเนเธงเธข (เน€เธเนเธ EP.1)" value="${title}" required>
                <input type="text" class="u-video" placeholder="URL เธงเธดเธ”เธตเนเธญ" value="${video}" required>
                <input type="number" class="u-time" placeholder="เน€เธงเธฅเธฒเธ”เธนเธเธฑเนเธเธ•เนเธณ (เธเธฒเธ—เธต)" value="${time}" required>
                <button type="button" class="btn-remove-unit" onclick="removeUnitField(this)"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', unitHTML);
}

function removeUnitField(btn) {
    btn.closest('.unit-box').remove();
}

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
        addUnitField();
    }
}

// เธเธณเธเนเธญเธกเธนเธฅเธฅเธเธเธญเธฃเนเธกเน€เธเธทเนเธญเน€เธ•เธฃเธตเธขเธกเนเธเนเนเธ
function editCourse(courseId) {
    const course = adminCoursesData.find(c => c.course_id === courseId);
    if(!course) return;

    // เน€เธเธฅเธตเนเธขเธเธซเธเนเธฒเธ•เธฒ UI
    document.getElementById('courseFormTitle').innerHTML = '<i class="fas fa-edit"></i> เนเธเนเนเธเธเนเธญเธกเธนเธฅเธซเธฅเธฑเธเธชเธนเธ•เธฃ';
    document.getElementById('btnSubmitCourse').innerHTML = '<i class="fas fa-save"></i> เธเธฑเธเธ—เธถเธเธเธฒเธฃเนเธเนเนเธ';
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

    const hr = Math.floor(course.hours);
    const min = Math.round((course.hours - hr) * 60);
    document.getElementById('cHours').value = hr;
    document.getElementById('cMins').value = min;

    document.getElementById('unitsContainer').innerHTML = '';
    if ((course.delivery_type || 'video') === 'video') {
        const units = JSON.parse(course.units || '[]');
        if(units.length === 0) {
            addUnitField();
        } else {
            units.forEach(u => addUnitField(u.title, u.video_url, u.min_time));
        }
    }
    toggleCourseDeliveryFields();
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// เธฅเนเธฒเธเธเธญเธฃเนเธกเธเธฅเธฑเธเน€เธเนเธเนเธซเธกเธ”เน€เธเธดเนเธกเธซเธฅเธฑเธเธชเธนเธ•เธฃ
function resetCourseForm() {
    document.getElementById('addCourseForm').reset();
    document.getElementById('courseFormTitle').innerHTML = '<i class="fas fa-plus-circle"></i> เน€เธเธดเนเธกเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธซเธกเน';
    document.getElementById('btnSubmitCourse').innerHTML = '<i class="fas fa-save"></i> เธเธฑเธเธ—เธถเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ';
    document.getElementById('btnCancelEdit').classList.add('hidden');
    document.getElementById('editCourseId').value = '';
    document.getElementById('cDeliveryType').value = 'video';
    document.getElementById('cAudience').value = 'all';
    document.getElementById('cIsMandatory').checked = false;
    
    document.getElementById('unitsContainer').innerHTML = '';
    addUnitField();
    toggleCourseDeliveryFields();
}

// เธเธฑเธเธเนเธเธฑเธเธเธฑเธเธ—เธถเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ (เธเธฑเธ”เธเธฒเธฃเธ—เธฑเนเธเธ•เธญเธเน€เธเธดเนเธกเนเธซเธกเน เนเธฅเธฐเธ•เธญเธเนเธเนเนเธ)
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
            return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธเธเธญเธญเธเนเธฅเธเนเธ•เนเธญเธเธกเธตเธซเธเนเธงเธขเธงเธดเธ”เธตเนเธญเธญเธขเนเธฒเธเธเนเธญเธข 1 เธซเธเนเธงเธข');
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
        is_mandatory: document.getElementById('cIsMandatory').checked
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
        showAlert('เธชเธณเน€เธฃเนเธ', res.message);
        resetCourseForm();
        loadAdminCoursesTable(); 
    } else {
        showAlert('เธเธดเธ”เธเธฅเธฒเธ”', res.message);
    }
});

toggleCourseDeliveryFields();
// ================= Classroom & Video Tracker Logic =================

let ytPlayer;
let currentClassCourse = null;
let currentUnits = [];
let completedUnits = []; 
let resumeTimes = {}; // เธ•เธฑเธงเนเธเธฃเนเธซเธกเนเธชเธณเธซเธฃเธฑเธเน€เธเนเธเน€เธงเธฅเธฒเธ—เธตเนเธ”เธนเธเนเธฒเธเนเธงเน
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

// 1. เธเธฑเธเธเนเธเธฑเธเธเธฑเธเธ—เธถเธเธเธงเธฒเธกเธเธทเธเธซเธเนเธฒ (เธ—เธฑเนเธเธ•เธญเธเธ”เธนเธเธ เนเธฅเธฐเธ•เธญเธเธเธ”เธญเธญเธ)
function saveProgressToDB() {
    if(!currentClassCourse || currentCourseFlow === 'classroom') return;
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    // เธญเธฑเธเน€เธ”เธ•เน€เธงเธฅเธฒเธฅเนเธฒเธชเธธเธ”เธเนเธญเธเธชเนเธ
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

// 2. เธเธ”เน€เธเนเธฒเน€เธฃเธตเธขเธ
async function enrollCourse(courseId) {
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    const targetCourse = globalCourses.find(c => c.id === courseId);
    if(!targetCourse) return showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', 'เนเธกเนเธเธเธเนเธญเธกเธนเธฅเธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธตเน');

    showLoader();
    const enrollRes = await callAPI('enrollCourse', { user_id: user.id, course_id: courseId });
    hideLoader();

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
                'เธซเธฅเธฑเธเธชเธนเธ•เธฃเธญเธเธฃเธกเนเธเธซเนเธญเธ',
                'เธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธตเนเนเธกเนเธกเธตเธงเธดเธ”เธตเนเธญเนเธเธฃเธฐเธเธ เธเธนเนเน€เธเนเธฒเธญเธเธฃเธกเธ•เนเธญเธเธเนเธฒเธเธเธฒเธฃเธญเธเธฃเธกเนเธเธซเนเธญเธเน€เธฃเธตเธขเธเธเนเธญเธ เนเธฅเนเธงเธเธถเธเธ—เธณเนเธเธเธ—เธ”เธชเธญเธเธซเธฅเธฑเธเน€เธฃเธตเธขเธเนเธเธฃเธฐเธเธเน€เธเธทเนเธญเธฃเธฑเธเนเธเธเธฃเธฐเธเธฒเธจ'
            );
            if (!confirmed) return;
            startQuiz('post');
            return;
        }

        if(currentUnits.length === 0) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธตเนเธขเธฑเธเนเธกเนเธกเธตเธงเธดเธ”เธตเนเธญเน€เธเธทเนเธญเธซเธฒเธเธฃเธฑเธ');
        
        if (progData.preTestScore === undefined || progData.preTestScore === null) {
            startQuiz('pre');
        } else {
            enterClassroom();
        }
    } else {
        showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”เธเธฒเธเธฃเธฐเธเธ', enrollRes.message);
    }
}

function enterClassroom() {
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('classroomSection').classList.remove('hidden');
    document.getElementById('classroomCourseTitle').innerText = currentClassCourse.title;
    
    renderPlaylist();
    
    // เธซเธฒ EP เธ–เธฑเธ”เนเธเธ—เธตเนเธขเธฑเธเนเธกเนเธเธเธกเธฒเน€เธฅเนเธเธเนเธญเธ
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

// เธญเธญเธเธเธฒเธเธซเนเธญเธเน€เธฃเธตเธขเธ (เธเธฅเธฑเธเธซเธเนเธฒเธซเธฅเธฑเธเนเธฅเธฐเธฃเธตเน€เธเธฃเธ)
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
                    <small style="color: #64748b;"><i class="fas fa-clock"></i> ${unit.min_time} เธเธฒเธ—เธต</small>
                </div>
                ${statusIcon}
            </li>
        `;
    });

    const percent = Math.round((totalDone / currentUnits.length) * 100) || 0;
    document.getElementById('courseProgressFill').style.width = percent + '%';
    document.getElementById('progressText').innerText = `เธชเธณเน€เธฃเนเธ ${percent}%`;

    if(percent === 100) document.getElementById('btnTakeExam').classList.remove('hidden');
    else document.getElementById('btnTakeExam').classList.add('hidden');
}

// 4. เนเธซเธฅเธ”เธงเธดเธ”เธตเนเธญเธเธฃเนเธญเธก Resume เน€เธงเธฅเธฒ
function loadVideo(index) {
    // เธ–เนเธฒเธกเธตเธเธฒเธฃเน€เธเธฅเธตเนเธขเธ EP เนเธซเนเน€เธเธเน€เธงเธฅเธฒเธเธญเธ EP เน€เธ”เธดเธกเธเนเธญเธ
    if (activeUnitIndex !== index && currentClassCourse) {
        saveProgressToDB();
    }

    activeUnitIndex = index;
    const unit = currentUnits[index];
    const videoId = extractYTId(unit.video_url);
    
    document.getElementById('currentUnitTitle').innerText = unit.title;
    
    // เธ”เธถเธเน€เธงเธฅเธฒเธ—เธตเนเธ”เธนเธเนเธฒเธเนเธงเน (เธเธชเธกเธเธฑเธเธฃเธฐเธซเธงเนเธฒเธ Local Storage เธเนเธญเธเธเธฑเธเนเธเธ”เธฑเธ เนเธฅเธฐ DB)
    const user = JSON.parse(localStorage.getItem('swd_user'));
    const cacheKey = `resume_${user.id}_${currentClassCourse.id}_${index}`;
    let localSavedTime = parseFloat(localStorage.getItem(cacheKey)) || 0;
    let dbSavedTime = resumeTimes[index] || 0;
    maxTimeWatched = Math.max(localSavedTime, dbSavedTime);

    renderPlaylist(); 

    if(!videoId) return showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', 'เธฅเธดเธเธเนเธงเธดเธ”เธตเนเธญเนเธกเนเธ–เธนเธเธ•เนเธญเธ');

    if(!ytPlayer) {
        ytPlayer = new YT.Player('youtubePlayer', {
            height: '100%', width: '100%',
            videoId: videoId,
            playerVars: { 
                'controls': 1, 'disablekb': 1, 'rel': 0, 
                'start': Math.floor(maxTimeWatched) // เธชเธฑเนเธเนเธซเนเน€เธฃเธดเนเธกเน€เธฅเนเธเธเธฒเธเธเธธเธ”เธ—เธตเนเธ”เธนเธเนเธฒเธเนเธงเน
            },
            events: { 'onStateChange': onPlayerStateChange }
        });
    } else {
        // เนเธเนเธเธณเธชเธฑเนเธเนเธซเธฅเธ”เธงเธดเธ”เธตเนเธญเนเธเธเธฃเธฐเธเธธเธงเธดเธเธฒเธ—เธตเน€เธฃเธดเนเธกเธ•เนเธ
        ytPlayer.loadVideoById({videoId: videoId, startSeconds: Math.floor(maxTimeWatched)});
    }
}

// 5. เธฃเธฐเธเธเธ•เธฃเธงเธเธเธฑเธเน€เธงเธฅเธฒเนเธฅเธฐเธเธฑเธ”เธเธฒเธฃเธ•เธญเธเธเธ
function onPlayerStateChange(event) {
    if (event.data == YT.PlayerState.PLAYING) {
        trackerInterval = setInterval(() => {
            const currentTime = ytPlayer.getCurrentTime();
            const duration = ytPlayer.getDuration();
            
            // เน€เธเนเธเธเธฒเธฃเนเธญเธเธเธฃเธญเธงเธดเธ”เธตเนเธญ
            if (currentTime > maxTimeWatched + 3) {
                // เธ–เนเธฒ EP เธเธตเนเธ”เธนเธเธเนเธฅเนเธง (Done) เนเธซเนเธ”เธนเธญเธดเธชเธฃเธฐเนเธ”เน เนเธกเนเธฅเนเธญเธ!
                if (completedUnits.includes(activeUnitIndex)) {
                    maxTimeWatched = currentTime; 
                } else {
                    // เธ–เนเธฒเธขเธฑเธเนเธกเนเธเธ เธ”เธถเธเธเธฅเธฑเธเธกเธฒเธ—เธตเนเน€เธ”เธดเธก
                    ytPlayer.seekTo(maxTimeWatched); 
                    showAlert('เธเธฃเธธเธ“เธฒเธฃเธฑเธเธเธกเธงเธดเธ”เธตเนเธญเนเธซเนเธเธ', 'เธฃเธฐเธเธเธฅเนเธญเธเธเธฒเธฃเน€เธฅเธทเนเธญเธเธเนเธฒเธกเธชเธณเธซเธฃเธฑเธ EP เธ—เธตเนเธขเธฑเธเน€เธฃเธตเธขเธเนเธกเนเธเธเธเธฃเธฑเธ');
                }
            } else {
                maxTimeWatched = Math.max(maxTimeWatched, currentTime);
            }

            // เนเธเธเธญเธฑเธเน€เธงเธฅเธฒเธฅเธเน€เธเธฃเธทเนเธญเธเธญเธฑเธ•เนเธเธกเธฑเธ•เธดเธ—เธธเธเน 5 เธงเธดเธเธฒเธ—เธต (เธเธฑเธเนเธเธ”เธฑเธ/เน€เธเธฅเธญเธเธดเธ”เนเธ—เนเธ)
            if (Math.floor(currentTime) % 5 === 0) {
                const user = JSON.parse(localStorage.getItem('swd_user'));
                const cacheKey = `resume_${user.id}_${currentClassCourse.id}_${activeUnitIndex}`;
                localStorage.setItem(cacheKey, maxTimeWatched);
            }

            // เธเธ EP (เน€เธซเธฅเธทเธญเนเธกเนเธ–เธถเธ 2 เธงเธดเธชเธธเธ”เธ—เนเธฒเธข)
            if (duration > 0 && currentTime >= duration - 2) {
                markUnitComplete(activeUnitIndex);
            }
        }, 1000);
    } else {
        clearInterval(trackerInterval); 
    }
}

// 6. เธเธฑเธเธ—เธถเธเน€เธกเธทเนเธญเธเธเธซเธเนเธงเธข
function markUnitComplete(index) {
    if(!completedUnits.includes(index)) {
        completedUnits.push(index);
        saveProgressToDB(); // เธเธฑเธเธ—เธถเธเธงเนเธฒเธเธเนเธฅเนเธง
        renderPlaylist();
        showAlert('เธขเธญเธ”เน€เธขเธตเนเธขเธก!', `เธเธธเธ“เน€เธฃเธตเธขเธ ${currentUnits[index].title} เธเธเนเธฅเนเธง!`);
    }
}

function startExam() {
    startQuiz('post');
}
// ================= Admin: Exam Management =================
let adminCurrentExams = [];

// เนเธซเธฅเธ”เธฃเธฒเธขเธเธทเนเธญเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธชเน Dropdown (เน€เธฃเธตเธขเธเนเธเนเธ•เธญเธเน€เธเนเธฒเธซเธเนเธฒเนเธญเธ”เธกเธดเธ)
// เนเธซเธฅเธ”เธฃเธฒเธขเธเธทเนเธญเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธชเน Dropdown (เธเธเธฑเธเธ”เธถเธเธเนเธญเธกเธนเธฅเธชเธ”เธเธฒเธเธเธฒเธเธเนเธญเธกเธนเธฅ)
async function initExamAdmin() {
    const select = document.getElementById('examCourseSelect');
    select.innerHTML = '<option value="">-- เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธซเธฅเธฑเธเธชเธนเธ•เธฃ... --</option>';
    
    // เธชเธฑเนเธเธ”เธถเธเธเนเธญเธกเธนเธฅเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ—เธฑเนเธเธซเธกเธ”เธเธญเธเนเธญเธ”เธกเธดเธ
    const res = await callAPI('getAdminCourses', {});
    
    select.innerHTML = '<option value="">-- เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ --</option>';
    
    if (res.status === 'success' && res.data.length > 0) {
        adminCoursesData = res.data; // เธญเธฑเธเน€เธ”เธ•เธเนเธญเธกเธนเธฅเนเธเธเธงเธฒเธกเธเธณเน€เธเธฃเธทเนเธญเธ
        res.data.forEach(c => {
            select.innerHTML += `<option value="${c.course_id}">${c.title}</option>`;
        });
    } else {
        select.innerHTML = '<option value="">-- เธขเธฑเธเนเธกเนเธกเธตเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธเธฃเธฐเธเธ --</option>';
    }
}

// เน€เธกเธทเนเธญเนเธญเธ”เธกเธดเธเน€เธฅเธทเธญเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ
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
        addQuestionBox(); // เนเธเธงเนเธเธฅเนเธญเธเน€เธเธฅเนเธฒ 1 เธเธฅเนเธญเธ
    }
}

// เธชเธฃเนเธฒเธเธเธฅเนเธญเธเธเธดเธกเธเนเธเนเธญเธชเธญเธ
function addQuestionBox(data = null, num = null) {
    const container = document.getElementById('questionsContainer');
    const qCount = container.children.length + 1;
    const qNum = num || qCount;
    
    const d = data || { question: '', a: '', b: '', c: '', d: '', answer: 'A' };
    
    const html = `
        <div class="exam-box">
            <button class="btn-remove" onclick="this.parentElement.remove()"><i class="fas fa-trash"></i></button>
            <h5 style="margin-bottom: 10px; color: var(--primary-color);">เธเนเธญเธ—เธตเน ${qNum}</h5>
            <input type="text" class="q-text" placeholder="เธเธดเธกเธเนเธเธณเธ–เธฒเธก..." value="${d.question}" style="width: 100%; padding: 10px; margin-bottom: 10px;" required>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="A" ${d.answer === 'A' ? 'checked' : ''}> เธ. <input type="text" class="q-a" placeholder="เธ•เธฑเธงเน€เธฅเธทเธญเธ เธ." value="${d.a}" style="width: 100%; padding: 8px;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="B" ${d.answer === 'B' ? 'checked' : ''}> เธ. <input type="text" class="q-b" placeholder="เธ•เธฑเธงเน€เธฅเธทเธญเธ เธ." value="${d.b}" style="width: 100%; padding: 8px;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="C" ${d.answer === 'C' ? 'checked' : ''}> เธ. <input type="text" class="q-c" placeholder="เธ•เธฑเธงเน€เธฅเธทเธญเธ เธ." value="${d.c}" style="width: 100%; padding: 8px;">
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="radio" name="ans_${qCount}" value="D" ${d.answer === 'D' ? 'checked' : ''}> เธ. <input type="text" class="q-d" placeholder="เธ•เธฑเธงเน€เธฅเธทเธญเธ เธ." value="${d.d}" style="width: 100%; padding: 8px;">
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
}

// เนเธญเธ”เธกเธดเธเธเธ”เธเธฑเธเธ—เธถเธเธเนเธญเธชเธญเธ
async function saveExamsToDB() {
    const courseId = document.getElementById('examCourseSelect').value;
    if(!courseId) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธเนเธญเธเธเธฑเธเธ—เธถเธ');
    
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
    
    if(examsData.length === 0) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธ•เนเธญเธเธกเธตเธเนเธญเธชเธญเธเธญเธขเนเธฒเธเธเนเธญเธข 1 เธเนเธญ');
    
    showLoader();
    const res = await callAPI('saveCourseExams', { course_id: courseId, exams: examsData });
    hideLoader();
    
    if(res.status === 'success') showAlert('เธชเธณเน€เธฃเนเธ', 'เธเธฑเธเธ—เธถเธเธเธฅเธฑเธเธเนเธญเธชเธญเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง');
}

// *เธญเธขเนเธฒเธฅเธทเธกเนเธเน€เธเธดเนเธกเธเธฒเธฃเน€เธฃเธตเธขเธ initExamAdmin() เนเธงเนเนเธเธเธฑเธเธเนเธเธฑเธ switchAdminTab(tabId) เธ”เนเธงเธขเธเธฐเธเธฃเธฑเธ (เน€เธกเธทเนเธญ tabId === 'examMgtTab')*


// ================= User: Quiz Taking System =================
let userQuizData = [];
let currentQIndex = 0;
let userAnswers = {}; // เน€เธเนเธเธเธณเธ•เธญเธ { 0: 'A', 1: 'C' }
let activeQuizType = 'pre'; // 'pre' เธซเธฃเธทเธญ 'post'

// เน€เธฃเธดเนเธกเธ—เธณเธเนเธญเธชเธญเธ (เน€เธฃเธตเธขเธเธเธฒเธเธซเธเนเธฒ Dashboard เธซเธฃเธทเธญ เธซเนเธญเธเน€เธฃเธตเธขเธ)
async function startQuiz(type) {
    activeQuizType = type;
    showLoader();
    
    // เธ”เธถเธเธเนเธญเธชเธญเธ
    const res = await callAPI('getCourseExams', { course_id: currentClassCourse.id });
    hideLoader();
    
    if(res.status === 'success' && res.data.length > 0) {
        userQuizData = res.data;
        currentQIndex = 0;
        userAnswers = {};
        
        document.getElementById('quizTitle').innerText = type === 'pre' ? 'เนเธเธเธ—เธ”เธชเธญเธเธเนเธญเธเน€เธฃเธตเธขเธ (Pre-test)' : 'เนเธเธเธ—เธ”เธชเธญเธเธซเธฅเธฑเธเน€เธฃเธตเธขเธ (Post-test)';
        document.getElementById('quizSubtitle').innerText = `เธงเธดเธเธฒ: ${currentClassCourse.title}`;
        
        document.getElementById('quizSection').classList.remove('hidden');
        document.getElementById('quizContent').classList.remove('hidden');
        document.getElementById('quizResult').classList.add('hidden');
        
        renderQuestion();
    } else {
        const message = currentCourseFlow === 'classroom'
            ? 'เธซเธฅเธฑเธเธชเธนเธ•เธฃเธญเธเธฃเธกเนเธเธซเนเธญเธเธเธตเนเธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเธ•เธฑเนเธเธเนเธฒเนเธเธเธ—เธ”เธชเธญเธเธซเธฅเธฑเธเน€เธฃเธตเธขเธ'
            : 'เธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธตเนเธขเธฑเธเนเธกเนเธกเธตเธเธฒเธฃเธ•เธฑเนเธเธเนเธฒเนเธเธเธ—เธ”เธชเธญเธเธเธฃเธฑเธ เธเธฃเธธเธ“เธฒเธเนเธฒเธกเนเธเน€เธฃเธตเธขเธเนเธ”เนเน€เธฅเธข';
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', message);
        if(type === 'pre') enterClassroom();
        if(type === 'post' && currentCourseFlow === 'classroom') finishCourseFlow();
    }
}

// เนเธชเธ”เธเธเธณเธ–เธฒเธกเธ—เธตเธฅเธฐเธเนเธญ
function renderQuestion() {
    const q = userQuizData[currentQIndex];
    document.getElementById('quizProgressText').innerText = `เธเนเธญเธ—เธตเน ${currentQIndex + 1} / ${userQuizData.length}`;
    document.getElementById('questionText').innerText = `${currentQIndex + 1}. ${q.question}`;
    
    const ans = userAnswers[currentQIndex] || '';
    
    const optionsHtml = `
        <label class="option-label ${ans==='A'?'selected':''}" onclick="selectAnswer('A')">
            <input type="radio" name="userAns" value="A" ${ans==='A'?'checked':''}> เธ. ${q.a}
        </label>
        <label class="option-label ${ans==='B'?'selected':''}" onclick="selectAnswer('B')">
            <input type="radio" name="userAns" value="B" ${ans==='B'?'checked':''}> เธ. ${q.b}
        </label>
        <label class="option-label ${ans==='C'?'selected':''}" onclick="selectAnswer('C')">
            <input type="radio" name="userAns" value="C" ${ans==='C'?'checked':''}> เธ. ${q.c}
        </label>
        <label class="option-label ${ans==='D'?'selected':''}" onclick="selectAnswer('D')">
            <input type="radio" name="userAns" value="D" ${ans==='D'?'checked':''}> เธ. ${q.d}
        </label>
    `;
    document.getElementById('optionsContainer').innerHTML = optionsHtml;
    
    // เธเธฑเธ”เธเธฒเธฃเธเธธเนเธก
    if(currentQIndex === userQuizData.length - 1) {
        document.getElementById('btnNextQuestion').classList.add('hidden');
        document.getElementById('btnSubmitQuiz').classList.remove('hidden');
    } else {
        document.getElementById('btnNextQuestion').classList.remove('hidden');
        document.getElementById('btnSubmitQuiz').classList.add('hidden');
    }
}

// เน€เธฅเธทเธญเธเธเธณเธ•เธญเธ (เธ—เธณเนเธฎเนเธฅเธ—เนเธชเธต)
function selectAnswer(val) {
    userAnswers[currentQIndex] = val;
    document.querySelectorAll('.option-label').forEach(el => el.classList.remove('selected'));
    document.querySelector(`input[value="${val}"]`).parentElement.classList.add('selected');
    document.querySelector(`input[value="${val}"]`).checked = true;
}

// เธเธ”เนเธเธเนเธญเธ–เธฑเธ”เนเธ
function nextQuestion() {
    if(!userAnswers[currentQIndex]) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธณเธ•เธญเธเธเนเธญเธเนเธเธเนเธญเธ–เธฑเธ”เนเธ');
    currentQIndex++;
    renderQuestion();
}

// เธเธ”เธชเนเธเธเธณเธ•เธญเธเน€เธเธทเนเธญเธ•เธฃเธงเธ
async function submitQuizData() {
    if(!userAnswers[currentQIndex]) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธเธณเธ•เธญเธเธเนเธญเธชเธธเธ”เธ—เนเธฒเธข');
    
    let score = 0;
    userQuizData.forEach((q, idx) => {
        if(userAnswers[idx] === q.answer) score++;
    });
    
    const maxScore = userQuizData.length;
    const passingScoreReq = currentClassCourse.passing_score || 80; // เธ”เธถเธเน€เธเธ“เธ‘เนเธเธฒเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ (%)
    const userPercent = (score / maxScore) * 100;
    const isPassed = userPercent >= passingScoreReq;
    
    showLoader();
    const user = JSON.parse(localStorage.getItem('swd_user'));
    
    // เธชเนเธเธเนเธญเธกเธนเธฅเนเธเธเธฑเธเธ—เธถเธ
    await callAPI('submitQuiz', {
        user_id: user.id,
        course_id: currentClassCourse.id,
        type: activeQuizType,
        score: score,
        is_passed: isPassed
    });
    hideLoader();
    
    // เนเธเธงเนเธซเธเนเธฒเธชเธฃเธธเธเธเธฅ
    document.getElementById('quizContent').classList.add('hidden');
    const resBox = document.getElementById('quizResult');
    resBox.classList.remove('hidden');
    
    document.getElementById('resultScore').innerText = score;
    document.getElementById('resultTotal').innerText = maxScore;
    
    // เธเธฃเธฐเธเธฒเธจเธ•เธฑเธงเนเธเธฃเธเธธเนเธกเธ”เธณเน€เธเธดเธเธเธฒเธฃเธ•เนเธญ เน€เธเธทเนเธญเน€เธฃเธตเธขเธเนเธเนเธเนเธฒเธขเน
    const btnReturn = document.getElementById('btnReturnFromQuiz');
    btnReturn.classList.remove('hidden'); // เนเธซเนเนเธเธงเนเน€เธเนเธเธเนเธฒเน€เธฃเธดเนเธกเธ•เนเธเนเธงเนเธเนเธญเธ
    
    if(activeQuizType === 'pre') {
        document.getElementById('resultTitle').innerText = 'เธ—เธณ Pre-test เน€เธชเธฃเนเธเธชเธดเนเธ';
        document.getElementById('resultTitle').style.color = 'var(--text-main)';
        document.getElementById('resultIcon').className = 'fas fa-clipboard-check text-primary';
    } else {
        if(isPassed) {
            document.getElementById('resultTitle').style.color = '#10B981';
            document.getElementById('resultIcon').className = 'fas fa-check-circle';
            document.getElementById('resultIcon').style.color = '#10B981';
            
            // --- เน€เธฃเธดเนเธกเธ•เนเธเธเธฒเธฃเธชเธฃเนเธฒเธ PDF ---
            document.getElementById('resultTitle').innerText = 'เธเธณเธฅเธฑเธเธชเธฃเนเธฒเธเนเธเธเธฃเธฐเธเธฒเธจ... เธเธฃเธธเธ“เธฒเธฃเธญเธชเธฑเธเธเธฃเธนเน';
            document.getElementById('btnDownloadCert').classList.add('hidden');
            
            btnReturn.classList.add('hidden'); // <--- 1. เธเนเธญเธเธเธธเนเธก "เธ”เธณเน€เธเธดเธเธเธฒเธฃเธ•เนเธญ" เธ•เธฃเธเธเธตเน! เธเนเธญเธเธเธฑเธเธเธเธเธ”เธญเธญเธ
            
            const certRes = await callAPI('generateCert', {
                user_id: user.id,
                user_name: user.name,
                course_id: currentClassCourse.id
            });
            
            if(certRes.status === 'success') {
                document.getElementById('resultTitle').innerText = 'เธขเธดเธเธ”เธตเธ”เนเธงเธข! เธเธธเธ“เธชเธญเธเธเนเธฒเธ';
                const btnCert = document.getElementById('btnDownloadCert');
                btnCert.href = certRes.pdf_url;
                btnCert.classList.remove('hidden'); // เนเธเธงเนเธเธธเนเธกเนเธซเธฅเธ” PDF
            } else {
                document.getElementById('resultTitle').innerText = 'เธชเธญเธเธเนเธฒเธ (เนเธ•เนเธเธเธเธฑเธเธซเธฒเธชเธฃเนเธฒเธเนเธเธเธฃเธฐเธเธฒเธจ)';
                console.error(certRes.message);
            }
            
            btnReturn.classList.remove('hidden'); // <--- 2. เนเธเธงเนเธเธธเนเธก "เธ”เธณเน€เธเธดเธเธเธฒเธฃเธ•เนเธญ" เธเธฅเธฑเธเธกเธฒเน€เธกเธทเนเธญเธเธฃเธฐเธเธงเธเธเธฒเธฃเน€เธชเธฃเนเธเธชเธดเนเธ!
            // --------------------------
            
        } else {
            document.getElementById('resultTitle').innerText = 'เน€เธชเธตเธขเนเธเธ”เนเธงเธข เธเธธเธ“เธชเธญเธเนเธกเนเธเนเธฒเธเน€เธเธ“เธ‘เน';
            document.getElementById('resultTitle').style.color = '#EF4444';
            document.getElementById('resultIcon').className = 'fas fa-times-circle';
            document.getElementById('resultIcon').style.color = '#EF4444';
        }
    }
}

// เธเธดเธ”เธซเธเนเธฒเธเนเธญเธชเธญเธเนเธฅเธฐเนเธเธชเน€เธ•เธเธ–เธฑเธ”เนเธ
function closeQuiz() {
    document.getElementById('quizSection').classList.add('hidden');
    if(activeQuizType === 'pre') {
        enterClassroom();
    } else {
        const isPassed = document.getElementById('resultIcon').classList.contains('fa-check-circle');
        if (isPassed) {
            openReviewModal();
        } else {
            finishCourseFlow();
        }
    }
}
// ================= External Training Logic (เธญเธฑเธเนเธซเธฅเธ”เธเธฃเธฐเธงเธฑเธ•เธดเธ เธฒเธขเธเธญเธ) =================
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
    select.innerHTML = '<option value="">เธเธฃเธญเธเธเนเธญเธกเธนเธฅเน€เธญเธ</option>';
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
        if (hint) hint.innerText = 'เน€เธฅเธทเธญเธเธเธฒเธเธฃเธฒเธขเธเธฒเธฃเนเธเธฐเธเธณเนเธฅเนเธง เธฃเธฐเธเธเธ”เธถเธเธเนเธญเธกเธนเธฅเธซเธฅเธฑเธเธชเธนเธ•เธฃ เธซเธเนเธงเธขเธเธฒเธ เนเธฅเธฐเธเธฑเนเธงเนเธกเธเนเธซเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด เน€เธซเธฅเธทเธญเธเธฃเธญเธเธงเธฑเธเธ—เธตเนเนเธฅเธฐเนเธเธเธซเธฅเธฑเธเธเธฒเธ';
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
    if (hint) hint.innerText = 'เธ–เนเธฒเน€เธฅเธทเธญเธเธเธฒเธเธฃเธฒเธขเธเธฒเธฃเนเธเธฐเธเธณ เธฃเธฐเธเธเธเธฐเธ”เธถเธเธเธทเนเธญเธซเธฅเธฑเธเธชเธนเธ•เธฃ เธซเธเนเธงเธขเธเธฒเธ เนเธฅเธฐเธเธฑเนเธงเนเธกเธเนเธซเนเธญเธฑเธ•เนเธเธกเธฑเธ•เธด เน€เธซเธฅเธทเธญเธเธฃเธญเธเธงเธฑเธเธ—เธตเนเธเธฑเธเนเธเธเธซเธฅเธฑเธเธเธฒเธ';
}

document.getElementById('externalTrainingForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('extCertFile');
    if (fileInput.files.length === 0) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเนเธเธเนเธเธฅเนเนเธเธเธฃเธฐเธเธฒเธจเธ”เนเธงเธขเธเธฃเธฑเธ');
    
    const file = fileInput.files[0];
    // เธ•เธฃเธงเธเธชเธญเธเธเธเธฒเธ”เนเธเธฅเน (เธเธณเธเธฑเธ”เนเธกเนเน€เธเธดเธ 5MB เน€เธเธทเนเธญเนเธกเนเนเธซเนเธเธฑเนเธ Apps Script เธ—เธณเธเธฒเธเธซเธเธฑเธเน€เธเธดเธเนเธ)
    if (file.size > 5 * 1024 * 1024) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธเธฒเธ”เนเธเธฅเนเนเธซเธเนเน€เธเธดเธเนเธ (เธ•เนเธญเธเนเธกเนเน€เธเธดเธ 5MB) เธเธฃเธธเธ“เธฒเธเธตเธเธญเธฑเธ”เนเธเธฅเนเธเธฃเธฑเธ');
    
    showLoader();
    
    // เน€เธ—เธเธเธดเธเนเธเธฅเธเนเธเธฅเน (PDF/Image) เนเธซเนเน€เธเนเธเธเนเธญเธกเธนเธฅเนเธเธ Base64 เน€เธเธทเนเธญเธชเนเธเธเนเธฒเธ JSON
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
            return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธทเนเธญเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธฅเธฐเธซเธเนเธงเธขเธเธฒเธเธ—เธตเนเธเธฑเธ”เนเธซเนเธเธฃเธ');
        }
        if (!isRecommendationMode && totalDecimalHours <= 0) {
            hideLoader();
            return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเธฑเนเธงเนเธกเธเธเธฒเธฃเธญเธเธฃเธกเนเธซเนเธ–เธนเธเธ•เนเธญเธ');
        }
        
        const payload = {
            user_id: user.id,
            topic: topicValue,
            organizer: organizerValue,
            date: document.getElementById('extDate').value,
            hours: totalDecimalHours,
            fileName: user.name + '_ExtCert_' + file.name, // เธ•เธฑเนเธเธเธทเนเธญเนเธเธฅเนเนเธซเธกเนเนเธซเนเธกเธตเธเธทเนเธญเธเธเธญเธฑเธเนเธซเธฅเธ”เธเธณเธซเธเนเธฒ
            fileData: base64Data // เธเนเธญเธกเธนเธฅเนเธเธฅเนเธ—เธตเนเนเธเธฅเธเนเธฅเนเธง
        };
        
        const res = await callAPI('addExternalTraining', payload);
        hideLoader();
        
        if (res.status === 'success') {
            showAlert('เธชเธณเน€เธฃเนเธ', 'เธเธฑเธเธ—เธถเธเธเธฃเธฐเธงเธฑเธ•เธดเนเธฅเธฐเธญเธฑเธเนเธซเธฅเธ”เนเธเธฅเนเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง (เธฃเธญเนเธญเธ”เธกเธดเธเธ•เธฃเธงเธเธชเธญเธเน€เธเธทเนเธญเธญเธเธธเธกเธฑเธ•เธดเธเธฑเนเธงเนเธกเธ)');
            document.getElementById('externalTrainingForm').reset();
            handleExternalTrainingRecommendationChange('');
            // เนเธซเธฅเธ”เธ•เธฒเธฃเธฒเธเธเธฃเธฐเธงเธฑเธ•เธดเนเธซเธกเนเน€เธเธทเนเธญเนเธซเนเธญเธฑเธเน€เธ”เธ•เธ—เธฑเธเธ—เธต
            loadTrainingHistory(); 
        } else {
            showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message);
        }
    };
    
    reader.readAsDataURL(file); // เน€เธฃเธดเนเธกเธญเนเธฒเธเนเธเธฅเน
});
// ================= Admin: Approve External Training =================
async function loadAdminExtRequests() {
    const tbody = document.getElementById('adminExtReqBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ...</td></tr>';
    
    const res = await callAPI('getAdminExternalReq', {});
    
    if (res.status === 'success') {
        tbody.innerHTML = '';
        if (res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">เนเธกเนเธกเธตเธฃเธฒเธขเธเธฒเธฃเธฃเธญเธญเธเธธเธกเธฑเธ•เธด</td></tr>';
            return;
        }
        
        res.data.forEach(req => {
            // เนเธเธฅเธเธงเธฑเธเธ—เธตเนเนเธซเนเธญเนเธฒเธเธเนเธฒเธข
            const dateObj = new Date(req.date);
            const dateStr = !isNaN(dateObj) ? dateObj.toLocaleDateString('th-TH') : req.date;

            tbody.innerHTML += `
                <tr>
                    <td><strong>${req.user_name}</strong></td>
                    <td>${req.topic}<br><small style="color:var(--text-light);">${req.organizer}</small></td>
                    <td>${dateStr}<br><span class="badge-hours">${req.hours} เธเธก.</span></td>
                    <td><a href="${req.cert_url}" target="_blank" class="btn btn-outline btn-sm"><i class="fas fa-file-pdf"></i> เธ•เธฃเธงเธเธชเธญเธเนเธเธฅเน</a></td>
                    <td>
                        <button class="btn btn-success btn-sm" onclick="handleExtReq('${req.ext_id}', 'approved')" style="margin-right: 5px;"><i class="fas fa-check"></i> เธญเธเธธเธกเธฑเธ•เธด</button>
                        <button class="btn btn-sm" style="background:#EF4444; color:white;" onclick="handleExtReq('${req.ext_id}', 'rejected')"><i class="fas fa-times"></i> เธเธเธดเน€เธชเธ</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function handleExtReq(extId, status) {
    const title = status === 'approved' ? 'เธขเธทเธเธขเธฑเธเธเธฒเธฃเธญเธเธธเธกเธฑเธ•เธด' : 'เธขเธทเธเธขเธฑเธเธเธฒเธฃเธเธเธดเน€เธชเธ';
    const confirmMsg = status === 'approved' ? 'เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃเธญเธเธธเธกเธฑเธ•เธดเธเธฑเนเธงเนเธกเธเธญเธเธฃเธกเธเธตเนเนเธเนเธซเธฃเธทเธญเนเธกเน?' : 'เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃเธเธเธดเน€เธชเธเธเธณเธเธญเธญเธเธฃเธกเธเธตเน (เธเธฐเนเธกเนเนเธ”เนเธฃเธฑเธเธเธฑเนเธงเนเธกเธ) เนเธเนเธซเธฃเธทเธญเนเธกเน?';
    
    // เน€เธฃเธตเธขเธเนเธเนเธเธฅเนเธญเธ Custom Confirm เนเธ—เธ pop-up เน€เธเธฃเธฒเธงเนเน€เธเธญเธฃเน
    const isConfirmed = await showConfirm(title, confirmMsg);
    
    // เธ–เนเธฒเธเธนเนเนเธเนเธเธ”เธขเธเน€เธฅเธดเธ เนเธซเนเธซเธขเธธเธ”เธเธฒเธฃเธ—เธณเธเธฒเธเธ—เธฑเธเธ—เธต
    if (!isConfirmed) return; 
    
    // เธ–เนเธฒเธเธ”เธขเธทเธเธขเธฑเธ เนเธซเนเนเธซเธฅเธ” API เธ•เนเธญเนเธ
    showLoader();
    const res = await callAPI('updateExternalStatus', { ext_id: extId, status: status });
    hideLoader();
    
    if (res.status === 'success') {
        showAlert('เธชเธณเน€เธฃเนเธ', res.message);
        loadAdminExtRequests(); // เนเธซเธฅเธ”เธ•เธฒเธฃเธฒเธเนเธซเธกเน
    } else {
        showAlert('เธเธดเธ”เธเธฅเธฒเธ”', res.message);
    }
}
// ================= Admin: User Management Logic =================
let adminUsersData = [];

async function loadAdminUsersTable() {
    const tbody = document.getElementById('adminUsersBody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ...</td></tr>';
    
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
                        <button class="btn btn-outline btn-sm" onclick="editAdminUser('${u.id}')"><i class="fas fa-edit"></i> เนเธเนเนเธ</button>
                    </td>
                </tr>
            `;
        });
    }
}

async function editAdminUser(userId) {
    // 1. เธซเธฒเธเนเธญเธกเธนเธฅเธเธนเนเนเธเนเธเธฒเธ Array เธซเธฃเธทเธญเน€เธฃเธตเธขเธเธเธฒเธ Server (เนเธฅเนเธงเนเธ•เนเธฃเธฐเธเธเธเธญเธเธเธธเธ“)
    // เธชเธกเธกเธ•เธดเธงเนเธฒเธ•เธฑเธงเนเธเธฃ users เธเธทเธญเธ—เธตเนเน€เธเนเธเธเนเธญเธกเธนเธฅเธเธขเธฒเธเธฒเธฅเธ—เธฑเนเธเธซเธกเธ”
    const user = adminUsersData.find(u => u.id === userId); 

    if (user) {
        // 2. เนเธชเธ”เธ Section เนเธเนเนเธ
        document.getElementById('editUserSection').classList.remove('hidden');

        // 3. เธชเนเธเธเนเธฒเธเนเธญเธกเธนเธฅเน€เธ”เธดเธกเนเธเนเธชเนเนเธเนเธ•เนเธฅเธฐเธเนเธญเธ Input
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
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฃเธทเธญเธฃเธฐเธเธธเธ•เธณเนเธซเธเนเธ');
        return;
    }
    
    const payload = {
        id: document.getElementById('editUserId').value,
        name: document.getElementById('euName').value,
        position: position,
        department: document.getElementById('euDept').value,
        role: document.getElementById('euRole').value,
        password: document.getElementById('euPassword').value
    };
    
    const isConfirmed = await showConfirm('เธขเธทเธเธขเธฑเธเธเธฒเธฃเนเธเนเนเธ', 'เธเธธเธ“เธ•เนเธญเธเธเธฒเธฃเธเธฑเธเธ—เธถเธเธเธฒเธฃเน€เธเธฅเธตเนเธขเธเนเธเธฅเธเธเนเธญเธกเธนเธฅเธเธนเนเนเธเนเธเธตเนเนเธเนเธซเธฃเธทเธญเนเธกเน?');
    if(!isConfirmed) return;
    
    showLoader();
    const res = await callAPI('updateUserByAdmin', payload);
    hideLoader();
    
    if(res.status === 'success') {
        showAlert('เธชเธณเน€เธฃเนเธ', res.message);
        cancelEditUser();
        loadAdminUsersTable(); // เนเธซเธฅเธ”เธ•เธฒเธฃเธฒเธเนเธซเธกเนเธซเธฅเธฑเธเน€เธเธเน€เธชเธฃเนเธ
    } else {
        showAlert('เธเธดเธ”เธเธฅเธฒเธ”', res.message);
    }
});
// ================= Export Portfolio to PDF =================
function exportPortfolioPDF() {
    const user = JSON.parse(localStorage.getItem('swd_user')) || {};
    
    // เธ”เธฑเธเธเนเธญเธกเธนเธฅเน€เธเธทเนเธญเธซเธฒเนเธกเนเน€เธเธญ เธเธฐเนเธ”เนเนเธกเนเธเธถเนเธ undefined
    const name = user.name || '-';
    const position = user.position || '-';
    const dept = user.department || '-';

    document.getElementById('pdfUserName').innerHTML = `<strong>เธเธทเนเธญ-เธเธฒเธกเธชเธเธธเธฅ:</strong> ${name} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>เธ•เธณเนเธซเธเนเธ:</strong> ${position} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>เธซเธเนเธงเธขเธเธฒเธ:</strong> ${dept}`;
    
    const element = document.getElementById('printablePortfolio');
    document.getElementById('pdfHeader').style.display = 'block'; // เนเธเธงเนเธซเธฑเธงเธเธฃเธฐเธ”เธฒเธฉ
    
    const opt = {
        margin:       10,
        filename:     `Portfolio_${name}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' } // เน€เธเธฅเธตเนเธขเธเน€เธเนเธเนเธเธงเธเธญเธ
    };

    showLoader();
    html2pdf().set(opt).from(element).save().then(() => {
        document.getElementById('pdfHeader').style.display = 'none'; // เธเนเธญเธเธซเธฑเธงเธเธฃเธฐเธ”เธฒเธฉเธเธฅเธฑเธ
        hideLoader();
    });
}
// ================= Admin: Course Detail Report =================

// เธ”เธถเธเธฃเธฒเธขเธเธทเนเธญเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธชเน Dropdown เนเธเธซเธเนเธฒเธฃเธฒเธขเธเธฒเธ
async function initCourseReportAdmin() {
    const select = document.getElementById('reportCourseSelect');
    select.innerHTML = '<option value="">-- เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธซเธฅเธฑเธเธชเธนเธ•เธฃ... --</option>';
    const res = await callAPI('getAdminCourses', {});
    
    if (res.status === 'success') {
        select.innerHTML = '<option value="">-- เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ—เธตเนเธ•เนเธญเธเธเธฒเธฃเธ”เธนเธฃเธฒเธขเธเธฒเธ --</option>';
        res.data.forEach(c => {
            select.innerHTML += `<option value="${c.course_id}">${c.title}</option>`;
        });
    }
}

// เธเธฑเธเธเนเธเธฑเธเนเธซเธฅเธ”เธฃเธฒเธขเธเธฒเธเน€เธกเธทเนเธญเน€เธเธฅเธตเนเธขเธ Dropdown
async function loadCourseReport() {
    const courseId = document.getElementById('reportCourseSelect').value;
    const tbody = document.getElementById('courseReportBody');
    const summaryCard = document.getElementById('courseReportSummary');

    if(!courseId) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-light);">เธเธฃเธธเธ“เธฒเน€เธฅเธทเธญเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธฒเธเธ”เนเธฒเธเธเธเน€เธเธทเนเธญเธ”เธนเธฃเธฒเธขเธเธฒเธ</td></tr>';
        summaryCard.classList.add('hidden');
        return;
    }

    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">เธเธณเธฅเธฑเธเธเธณเธเธงเธ“เนเธฅเธฐเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ...</td></tr>';
    const res = await callAPI('getCourseReport', { course_id: courseId });

    if(res.status === 'success') {
        summaryCard.classList.remove('hidden');
        tbody.innerHTML = '';

        if(res.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">เธขเธฑเธเนเธกเนเธกเธตเธเธนเนเธฅเธเธ—เธฐเน€เธเธตเธขเธเนเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธตเน</td></tr>';
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
            
            // เนเธเธฃเธฐเธเธเธเธตเน status 'completed' เธซเธกเธฒเธขเธ–เธถเธเน€เธฃเธตเธขเธเธเธเนเธฅเธฐเธชเธญเธเธเนเธฒเธเนเธฅเนเธง
            if(r.status === 'completed') {
                statusText = 'เธเนเธฒเธเธเธฒเธฃเธญเธเธฃเธก';
                statusBadge = `<span class="badge" style="background: #10B981; color: white;">เธเนเธฒเธ</span>`;
                totalPassed++;
            } else {
                statusText = 'เธเธณเธฅเธฑเธเน€เธฃเธตเธขเธ/เธขเธฑเธเนเธกเนเธเนเธฒเธ';
                statusBadge = `<span class="badge" style="background: #f59e0b; color: white;">เธฃเธญเธ”เธณเน€เธเธดเธเธเธฒเธฃ</span>`;
            }

            // เธฃเธงเธกเธเธฐเนเธเธเน€เธเธทเนเธญเธซเธฒเธเนเธฒเน€เธเธฅเธตเนเธข
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

        // เธญเธฑเธเน€เธ”เธ•เธ•เธฑเธงเน€เธฅเธเธชเธฃเธธเธเธเธเธเธฒเธฃเนเธ”
        document.getElementById('crTotal').innerText = totalEnrolled;
        document.getElementById('crPassed').innerText = totalPassed;

        let passRate = totalEnrolled > 0 ? ((totalPassed / totalEnrolled) * 100).toFixed(2) : 0;
        document.getElementById('crPassRate').innerText = `${passRate}%`;

        let avgScore = postScoreCount > 0 ? (sumPostScore / postScoreCount).toFixed(2) : '-';
        document.getElementById('crAvgScore').innerText = avgScore;

    } else {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: red;">เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเธเธดเธ”เธเธฅเธฒเธ”</td></tr>';
    }
}

// เนเธซเธฅเธ”เธ•เธฒเธฃเธฒเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธตเนเธญเธญเธเน€เธเนเธ Excel
function exportCourseReportToExcel() {
    let table = document.getElementById("courseReportTable");
    let html = table.outerHTML.replace(/ /g, '%20');
    let a = document.createElement('a');
    a.href = 'data:application/vnd.ms-excel;charset=utf-8,\uFEFF' + html;
    
    // เธ•เธฑเนเธเธเธทเนเธญเนเธเธฅเนเธ•เธฒเธกเธเธทเนเธญเธงเธดเธเธฒ
    const select = document.getElementById('reportCourseSelect');
    let courseName = select.options[select.selectedIndex].text;
    if(select.value === "") courseName = "เธชเธฃเธธเธเธฃเธฒเธขเธงเธดเธเธฒ";
    
    a.download = `เธฃเธฒเธขเธเธฒเธเธเธฅเธญเธเธฃเธก_${courseName}.xls`;
    a.click();
}
// ================= Q&A Logic =================
async function loadQA() {
    const container = document.getElementById('qaListContainer');
    container.innerHTML = '<div style="text-align: center; color: var(--text-light);"><i class="fas fa-spinner fa-spin"></i> เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเธณเธ–เธฒเธก...</div>';
    const res = await callAPI('getQA', { course_id: currentClassCourse.id });
    
    if(res.status === 'success') {
        container.innerHTML = '';
        if(res.data.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: var(--text-light); padding: 15px;">เธขเธฑเธเนเธกเนเธกเธตเธเธณเธ–เธฒเธกเนเธเธเธ—เน€เธฃเธตเธขเธเธเธตเน เน€เธเนเธเธเธเนเธฃเธเธ—เธตเนเน€เธฃเธดเนเธกเธ–เธฒเธกเน€เธฅเธข!</div>';
            return;
        }
        
        const user = JSON.parse(localStorage.getItem('swd_user'));
        
        res.data.forEach(qa => {
            let adminReplyHtml = '';
            if(qa.answer) {
                // เธ–เนเธฒเธกเธตเธเธเธ•เธญเธเนเธฅเนเธง เนเธเธงเนเธเธณเธ•เธญเธ
                adminReplyHtml = `
                    <div style="margin-top: 10px; background: #f0fdf4; padding: 10px; border-radius: 6px; border-left: 3px solid #10b981; font-size: 0.9rem;">
                        <strong style="color: #10b981;"><i class="fas fa-user-md"></i> ${qa.ans_by} (เธเธนเนเธ•เธญเธ):</strong> ${qa.answer}
                    </div>
                `;
            } else if (user.role === 'admin') {
                // เธ–เนเธฒเนเธญเธ”เธกเธดเธเธ”เธนเธญเธขเธนเน เนเธฅเธฐเธขเธฑเธเนเธกเนเธกเธตเธเธเธ•เธญเธ เธเธฐเน€เธซเนเธเธเนเธญเธเนเธซเนเธเธดเธกเธเนเธ•เธญเธ
                adminReplyHtml = `
                    <div style="margin-top: 10px; display: flex; gap: 5px;">
                        <input type="text" id="reply_${qa.id}" placeholder="เธเธดเธกเธเนเธเธณเธ•เธญเธเนเธเธเธฒเธเธฐเธเธนเนเธ”เธนเนเธฅ..." style="width: 100%; padding: 5px 10px; border-radius: 4px; border: 1px solid #cbd5e1; font-family: 'Prompt'; font-size: 0.85rem;">
                        <button class="btn btn-sm btn-success" onclick="replyQA('${qa.id}')" style="white-space: nowrap;"><i class="fas fa-reply"></i> เธ•เธญเธ</button>
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
        container.scrollTop = container.scrollHeight; // เน€เธฅเธทเนเธญเธเนเธซเนเน€เธซเนเธเธเนเธญเธเธงเธฒเธกเธฅเนเธฒเธชเธธเธ”
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
    loadQA(); // เนเธซเธฅเธ”เธเธฃเธฐเธ”เธฒเธเนเธซเธกเน
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

// เนเธเธ Event เนเธซเนเธ”เธฒเธงเน€เธเธฅเธตเนเธขเธเธชเธตเธ•เธญเธเธเธ”
document.querySelectorAll('.star-btn').forEach(star => {
    star.addEventListener('click', function() {
        selectedRating = this.getAttribute('data-val');
        document.querySelectorAll('.star-btn').forEach(s => {
            if(s.getAttribute('data-val') <= selectedRating) {
                s.style.color = '#fbbf24'; // เธชเธตเธ—เธญเธ
            } else {
                s.style.color = '#cbd5e1'; // เธชเธตเน€เธ—เธฒ
            }
        });
    });
});

function openReviewModal() {
    selectedRating = 0;
    document.querySelectorAll('.star-btn').forEach(s => s.style.color = '#cbd5e1'); // เธฅเนเธฒเธเธชเธต
    document.getElementById('reviewComment').value = '';
    document.getElementById('reviewModal').classList.remove('hidden');
}

function closeReviewModal() {
    document.getElementById('reviewModal').classList.add('hidden');
    finishCourseFlow();
}

async function submitCourseReview() {
    if(selectedRating === 0) return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเธเธ”เนเธซเนเธเธฐเนเธเธเธ”เธฒเธงเธเนเธญเธเธชเนเธเธเธฃเธฑเธ โญ๏ธ');
    
    const user = JSON.parse(localStorage.getItem('swd_user'));
    showLoader();
    await callAPI('submitReview', {
        course_id: currentClassCourse.id, user_id: user.id, user_name: user.name, 
        rating: selectedRating, comment: document.getElementById('reviewComment').value
    });
    hideLoader();
    
    showAlert('เธเธญเธเธเธธเธ“เธเธฃเธฑเธ', 'เธฃเธฐเธเธเนเธ”เนเธฃเธฑเธเธเธฅเธเธฒเธฃเธเธฃเธฐเน€เธกเธดเธเธเธญเธเธเธธเธ“เน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง');
    closeReviewModal();
}
// เธเธฑเธเธเนเธเธฑเธ เน€เธเธดเธ”-เธเธดเธ” เนเธ–เธ Q&A
function toggleQA() {
    const content = document.getElementById('qaContent');
    const chevron = document.getElementById('qaChevron');
    
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        chevron.style.transform = 'rotate(180deg)'; // เธซเธกเธธเธเธฅเธนเธเธจเธฃเธเธถเนเธ
        // เน€เธฅเธทเนเธญเธเธซเธเนเธฒเธเธญเธฅเธเธกเธฒเนเธซเนเน€เธซเนเธเธเนเธญเธเธเธณเธ–เธฒเธกเธเธฑเธ”เน€เธเธ
        setTimeout(() => {
            content.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } else {
        content.classList.add('hidden');
        chevron.style.transform = 'rotate(0deg)'; // เธซเธกเธธเธเธฅเธนเธเธจเธฃเธเธฅเธฑเธ
    }
}
// เธเธฑเธเธเนเธเธฑเธ เน€เธเธดเธ”-เธเธดเธ” เน€เธกเธเธนเนเธฎเธกเน€เธเธญเธฃเนเน€เธเธญเธฃเน
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

// เธญเธฑเธเน€เธ”เธ•เธเธฑเธเธเนเธเธฑเธ switchTab เธ—เธธเธเธ•เธฑเธง เนเธซเนเธเธดเธ” Sidebar เธญเธฑเธ•เนเธเธกเธฑเธ•เธดเน€เธกเธทเนเธญเธเธ”เน€เธฅเธทเธญเธเน€เธกเธเธน (เนเธเธกเธทเธญเธ–เธทเธญ)
const originalSwitchUserTab = switchUserTab;
switchUserTab = function(tabId, element) {
    originalSwitchUserTab(tabId, element); // เธฃเธฑเธเธเธฑเธเธเนเธเธฑเธเน€เธ”เธดเธก
    if (window.innerWidth <= 768) {
        toggleSidebar(); // เธเธดเธ”เน€เธกเธเธนเน€เธกเธทเนเธญเน€เธฅเธทเธญเธเนเธ—เนเธเน€เธชเธฃเนเธ
    }
};

const originalSwitchAdminTab = switchAdminTab;
switchAdminTab = function(tabId, element) {
    originalSwitchAdminTab(tabId, element); // เธฃเธฑเธเธเธฑเธเธเนเธเธฑเธเน€เธ”เธดเธก
    if (window.innerWidth <= 768) {
        toggleSidebar(); // เธเธดเธ”เน€เธกเธเธนเน€เธกเธทเนเธญเน€เธฅเธทเธญเธเนเธ—เนเธเน€เธชเธฃเนเธ
    }
};
let adminExternalRecommendationsData = [];

function getUserPositionGroup(user) {
    const position = String((user && user.position) || '').trim();
    return position.includes('เธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธ') ? 'nurse' : 'support';
}

function getCourseDeliveryLabel(deliveryType) {
    return deliveryType === 'classroom' ? 'เธญเธเธฃเธกเนเธเธซเนเธญเธ' : 'เธญเธญเธเนเธฅเธเน';
}

function getCourseAudienceLabel(audience) {
    if (audience === 'nurse') return 'เน€เธเธเธฒเธฐเธเธขเธฒเธเธฒเธฅเธงเธดเธเธฒเธเธตเธ';
    if (audience === 'support') return 'เน€เธเธเธฒเธฐเธชเธฒเธขเธชเธเธฑเธเธชเธเธธเธ';
    return 'เธ—เธธเธเธ•เธณเนเธซเธเนเธ';
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
    if (hr === 0 && min === 0) return '0 เธเธก.';
    if (min === 0) return `${hr} เธเธก.`;
    return `${hr} เธเธก. ${min} เธเธฒเธ—เธต`;
}

function splitHoursAndMinutes(hours) {
    const numericHours = parseFloat(hours) || 0;
    const hr = Math.floor(numericHours);
    const min = Math.round((numericHours - hr) * 60);
    return { hours: hr, minutes: min };
}

function getStatusText(status) {
    if (status === 'inactive') return 'เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ';
    if (status === 'deleted') return 'เธฅเธเนเธฅเนเธง';
    return 'เน€เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ';
}

function getStatusBadge(status) {
    const normalizedStatus = status || 'active';
    return `<span class="table-status-badge ${normalizedStatus}">${getStatusText(normalizedStatus)}</span>`;
}

function getToggleRegistrationAction(status) {
    if (status === 'inactive') {
        return {
            nextStatus: 'active',
            label: 'เน€เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ',
            className: 'btn-success',
            icon: 'fa-lock-open'
        };
    }

    return {
        nextStatus: 'inactive',
        label: 'เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ',
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
        showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', (res.message || enrollRes.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธ”เน'));
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
        renderEmptyGrid('courseGrid', 'เนเธกเนเธเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ—เธตเนเธเนเธเธซเธฒ');
        return;
    }

    coursesToRender.forEach(course => {
        const enrollData = cachedUserEnrollments.find(e => e.course_id === course.id);
        const classroomCourse = isClassroomCourse(course);
        let btnText = classroomCourse ? 'เธ—เธณเนเธเธเธ—เธ”เธชเธญเธเธซเธฅเธฑเธเธญเธเธฃเธก' : 'เน€เธเนเธฒเธชเธนเนเธเธ—เน€เธฃเธตเธขเธ';
        let btnClass = 'btn-primary';

        if (enrollData) {
            if (enrollData.status === 'completed') {
                btnText = classroomCourse ? 'เน€เธเนเธฒเธชเธญเธเธ—เธเธ—เธงเธเธญเธตเธเธเธฃเธฑเนเธ' : 'เน€เธเนเธฒเน€เธฃเธตเธขเธเธญเธตเธเธเธฃเธฑเนเธ';
                btnClass = 'btn-outline';
            } else if (!classroomCourse) {
                try {
                    const prog = JSON.parse(enrollData.progress || '{}');
                    if (prog.completed && prog.completed.length > 0) {
                        btnText = 'เน€เธฃเธตเธขเธเธ•เนเธญ';
                        btnClass = 'btn-success';
                    }
                } catch (error) {}
            } else {
                btnText = 'เน€เธเนเธฒเธชเธญเธเธซเธฅเธฑเธเธญเธเธฃเธก';
            }
        }

        const badgeParts = [
            `<div class="course-badge">${getCourseDeliveryLabel(course.delivery_type)}</div>`,
            `<div class="course-badge">${getCourseAudienceLabel(course.audience)}</div>`
        ];

        if (course.is_mandatory && isCourseVisibleToUser(course, user)) {
            badgeParts.push('<div class="course-badge course-badge-mandatory">เธซเธฅเธฑเธเธชเธนเธ•เธฃเธเธฑเธเธเธฑเธ</div>');
        }

        const courseHint = classroomCourse
            ? (course.note || 'เนเธกเนเธกเธตเธงเธดเธ”เธตเนเธญเนเธเธฃเธฐเธเธ เธเธนเนเน€เธเนเธฒเธญเธเธฃเธกเธ—เธณเนเธเธเธ—เธ”เธชเธญเธเธซเธฅเธฑเธเธญเธเธฃเธกเนเธเธซเนเธญเธเน€เธฃเธตเธขเธ')
            : (course.note || 'เน€เธฃเธตเธขเธเธ•เธฒเธกเธซเธเนเธงเธขเธงเธดเธ”เธตเนเธญเนเธเธฃเธฐเธเธ เนเธฅเธฐเธ—เธณเนเธเธเธ—เธ”เธชเธญเธเธซเธฅเธฑเธเน€เธฃเธตเธขเธเน€เธกเธทเนเธญเน€เธฃเธตเธขเธเธเธฃเธ');

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
        showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เนเธซเธฅเธ”เธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธ”เน');
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
        renderEmptyGrid('externalRecommendationGrid', 'เธขเธฑเธเนเธกเนเธกเธตเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธเธฐเธเธณ');
        return;
    }

    recommendations.forEach(course => {
        grid.innerHTML += `
            <div class="course-card course-card-external">
                <img src="${getDriveImageUrl(course.cover_image)}" class="course-img" alt="${course.title}">
                <div class="course-info">
                    <div class="course-badge">เธ เธฒเธขเธเธญเธ</div>
                    <h4 class="course-title">${course.title}</h4>
                    <div class="course-meta">
                        <span><i class="fas fa-building"></i> ${course.organizer || '-'}</span>
                        <span><i class="fas fa-clock"></i> ${formatHoursLabel(course.hours)}</span>
                    </div>
                    <button class="btn btn-primary w-100" onclick="openExternalRegistration('${normalizeExternalUrl(course.register_url)}')">เธฅเธเธ—เธฐเน€เธเธตเธขเธ</button>
                </div>
            </div>
        `;
    });
}

function openExternalRegistration(url) {
    const normalizedUrl = normalizeExternalUrl(url);
    if (!normalizedUrl) {
        showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธขเธฑเธเนเธกเนเนเธ”เนเธฃเธฐเธเธธ URL เธชเธณเธซเธฃเธฑเธเธฅเธเธ—เธฐเน€เธเธตเธขเธ');
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
            document.getElementById('profilePreview').src = user.profile_img || 'https://via.placeholder.com/150';
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

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ...</td></tr>';
    const res = await callAPI('getExternalRecommendations', { admin_view: true });

    if (res.status !== 'success') {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเนเธกเนเธชเธณเน€เธฃเนเธ</td></tr>';
        return;
    }

    adminExternalRecommendationsData = res.data || [];
    if (adminExternalRecommendationsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">เธขเธฑเธเนเธกเนเธกเธตเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธเธฐเธเธณ</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminExternalRecommendationsData.forEach(course => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.organizer || '-'}</td>
                <td>${formatHoursLabel(course.hours)}</td>
                <td><a href="${normalizeExternalUrl(course.register_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">เน€เธเธดเธ”เธฅเธดเธเธเน</a></td>
                <td><button class="btn btn-action btn-edit" onclick="editExternalRecommendation('${course.rec_id}')"><i class="fas fa-edit"></i> เนเธเนเนเธ</button></td>
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
    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-link"></i> เน€เธเธดเนเธกเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธเธฐเธเธณ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> เธเธฑเธเธ—เธถเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธ';
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
    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-edit"></i> เนเธเนเนเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธเธฐเธเธณ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> เธเธฑเธเธ—เธถเธเธเธฒเธฃเนเธเนเนเธ';
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
            return showAlert('เนเธเนเธเน€เธ•เธทเธญเธ', 'เธเธฃเธธเธ“เธฒเธเธฃเธญเธเธเนเธญเธกเธนเธฅเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธซเนเธเธฃเธเธ—เธธเธเธเนเธญเธ');
        }

        const action = editId ? 'updateExternalRecommendation' : 'addExternalRecommendation';
        if (editId) payload.rec_id = editId;

        showLoader();
        const res = await callAPI(action, payload);
        hideLoader();

        if (res.status === 'success') {
            appState.externalRecommendationsLoaded = false;
            setDashboardRefreshNeeded();
            showAlert('เธชเธณเน€เธฃเนเธ', res.message);
            resetExternalRecommendationForm();
            loadAdminExternalRecommendationsTable();
        } else {
            showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธเธฑเธเธ—เธถเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธ”เน');
        }
    });
}

loadAdminCoursesTable = async function() {
    const tbody = document.getElementById('adminCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ...</td></tr>';
    const res = await callAPI('getAdminCourses', {});

    if (res.status !== 'success') {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #ef4444;">เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเนเธกเนเธชเธณเน€เธฃเนเธ</td></tr>';
        return;
    }

    adminCoursesData = (res.data || []).filter(course => (course.status || 'active') !== 'deleted');
    if (adminCoursesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-light);">เธขเธฑเธเนเธกเนเธกเธตเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธเธฃเธฐเธเธ</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    adminCoursesData.forEach(course => {
        const status = course.status || 'active';
        const toggleAction = getToggleRegistrationAction(status);
        const mandatoryBadge = course.is_mandatory
            ? '<span class="table-status-badge active" style="margin-top: 6px;">เธเธฑเธเธเธฑเธ</span>'
            : '<span class="table-status-badge inactive" style="margin-top: 6px;">เนเธกเนเธเธฑเธเธเธฑเธ</span>';

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
                        <button class="btn btn-action btn-edit" onclick="editCourse('${course.course_id}')"><i class="fas fa-edit"></i> เนเธเนเนเธ</button>
                        <button class="btn btn-action ${toggleAction.className}" onclick="changeCourseStatus('${course.course_id}', '${toggleAction.nextStatus}')"><i class="fas ${toggleAction.icon}"></i> ${toggleAction.label}</button>
                        <button class="btn btn-action btn-danger" onclick="changeCourseStatus('${course.course_id}', 'deleted')"><i class="fas fa-trash-alt"></i> เธฅเธ</button>
                    </div>
                </td>
            </tr>
        `;
    });
};

async function changeCourseStatus(courseId, nextStatus) {
    const course = adminCoursesData.find(item => item.course_id === courseId);
    if (!course) return;

    const actionLabel = nextStatus === 'deleted' ? 'เธฅเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ' : (nextStatus === 'inactive' ? 'เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ' : 'เน€เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ');
    const message = nextStatus === 'deleted'
        ? `เธขเธทเธเธขเธฑเธเธเธฒเธฃเธฅเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ "${course.title}" เนเธเนเธซเธฃเธทเธญเนเธกเน?`
        : `เธขเธทเธเธขเธฑเธเธเธฒเธฃ${actionLabel}เธชเธณเธซเธฃเธฑเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ "${course.title}" เนเธเนเธซเธฃเธทเธญเนเธกเน?`;
    const confirmed = await showConfirm('เธขเธทเธเธขเธฑเธเธเธฒเธฃเธ—เธณเธฃเธฒเธขเธเธฒเธฃ', message);
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
        showAlert('เธชเธณเน€เธฃเนเธ', nextStatus === 'deleted' ? 'เธฅเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง' : res.message);
        loadAdminCoursesTable();
    } else {
        showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเธซเธฅเธฑเธเธชเธนเธ•เธฃเนเธ”เน');
    }
}

loadAdminExternalRecommendationsTable = async function() {
    const tbody = document.getElementById('adminExternalCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">เธเธณเธฅเธฑเธเนเธซเธฅเธ”เธเนเธญเธกเธนเธฅ...</td></tr>';
    const res = await callAPI('getExternalRecommendations', { admin_view: true });

    if (res.status !== 'success') {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #ef4444;">เนเธซเธฅเธ”เธเนเธญเธกเธนเธฅเนเธกเนเธชเธณเน€เธฃเนเธ</td></tr>';
        return;
    }

    adminExternalRecommendationsData = (res.data || []).filter(course => (course.status || 'active') !== 'deleted');
    if (adminExternalRecommendationsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-light);">เธขเธฑเธเนเธกเนเธกเธตเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธเธฐเธเธณ</td></tr>';
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
                <td><a href="${normalizeExternalUrl(course.register_url)}" target="_blank" rel="noopener" class="btn btn-outline btn-sm">เน€เธเธดเธ”เธฅเธดเธเธเน</a></td>
                <td>${getStatusBadge(status)}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn btn-action btn-edit" onclick="editExternalRecommendation('${course.rec_id}')"><i class="fas fa-edit"></i> เนเธเนเนเธ</button>
                        <button class="btn btn-action ${toggleAction.className}" onclick="changeExternalRecommendationStatus('${course.rec_id}', '${toggleAction.nextStatus}')"><i class="fas ${toggleAction.icon}"></i> ${toggleAction.label}</button>
                        <button class="btn btn-action btn-danger" onclick="changeExternalRecommendationStatus('${course.rec_id}', 'deleted')"><i class="fas fa-trash-alt"></i> เธฅเธ</button>
                    </div>
                </td>
            </tr>
        `;
    });
};

async function changeExternalRecommendationStatus(recId, nextStatus) {
    const course = adminExternalRecommendationsData.find(item => item.rec_id === recId);
    if (!course) return;

    const actionLabel = nextStatus === 'deleted' ? 'เธฅเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธ' : (nextStatus === 'inactive' ? 'เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ' : 'เน€เธเธดเธ”เธฅเธเธ—เธฐเน€เธเธตเธขเธ');
    const message = nextStatus === 'deleted'
        ? `เธขเธทเธเธขเธฑเธเธเธฒเธฃเธฅเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ "${course.title}" เนเธเนเธซเธฃเธทเธญเนเธกเน?`
        : `เธขเธทเธเธขเธฑเธเธเธฒเธฃ${actionLabel}เธชเธณเธซเธฃเธฑเธเธซเธฅเธฑเธเธชเธนเธ•เธฃ "${course.title}" เนเธเนเธซเธฃเธทเธญเนเธกเน?`;
    const confirmed = await showConfirm('เธขเธทเธเธขเธฑเธเธเธฒเธฃเธ—เธณเธฃเธฒเธขเธเธฒเธฃ', message);
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
        showAlert('เธชเธณเน€เธฃเนเธ', nextStatus === 'deleted' ? 'เธฅเธเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเน€เธฃเธตเธขเธเธฃเนเธญเธขเนเธฅเนเธง' : res.message);
        loadAdminExternalRecommendationsTable();
    } else {
        showAlert('เธเนเธญเธเธดเธ”เธเธฅเธฒเธ”', res.message || 'เนเธกเนเธชเธฒเธกเธฒเธฃเธ–เธญเธฑเธเน€เธ”เธ•เธชเธ–เธฒเธเธฐเธซเธฅเธฑเธเธชเธนเธ•เธฃเธ เธฒเธขเธเธญเธเนเธ”เน');
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
    document.getElementById('euDept').value = user.department || '';
    document.getElementById('euEmail').value = user.email || '';
    document.getElementById('euPassword').value = user.password || '';
    document.getElementById('euRole').value = user.role || 'user';
    document.getElementById('editUserSection').scrollIntoView({ behavior: 'smooth' });
};
