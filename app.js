// ==================== GLOBAL VARIABLES ====================
let adminCoursesData = [];
let adminExternalCourseData = [];
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

// ==================== Alert Functions ====================
function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertMessage').textContent = message;
    document.getElementById('customAlert').classList.remove('hidden');
}

function closeAlert() {
    document.getElementById('customAlert').classList.add('hidden');
}

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
    const cMouScoreInput = document.getElementById('cMouScore');

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
}

// ==================== Authentication Functions ====================
function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showAlert('ข้อมูลไม่ครบ', 'กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน');
        return;
    }

    // Simulate login (replace with actual backend call)
    console.log('Login attempt:', username);
    
    // Check localStorage for test data
    const users = JSON.parse(localStorage.getItem('elearning_users')) || [];
    const user = users.find(u => u.username === username && u.password === password);

    if (user) {
        currentUser = user;
        sessionStorage.setItem('currentUser', JSON.stringify(user));
        showDashboard();
    } else {
        showAlert('เข้าสู่ระบบไม่สำเร็จ', 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    }
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value.trim();
    const position = document.getElementById('regPosition').value.trim();
    const workingGroup = document.getElementById('regWorkingGroup').value;
    const dept = document.getElementById('regDept').value;
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword')?.value;

    if (!name || !position || !workingGroup || !dept || !username || !email || !password) {
        showAlert('ข้อมูลไม่ครบ', 'กรุณากรอกข้อมูลให้ครบทั้งหมด');
        return;
    }

    if (password !== confirmPassword) {
        showAlert('รหัสผ่านไม่ตรงกัน', 'กรุณายืนยันรหัสผ่านให้ถูกต้อง');
        return;
    }

    // Save to localStorage (replace with actual backend call)
    const users = JSON.parse(localStorage.getItem('elearning_users')) || [];
    
    if (users.find(u => u.username === username)) {
        showAlert('ชื่อผู้ใช้งานซ้ำ', 'ชื่อผู้ใช้งานนี้ถูกใช้ไปแล้ว');
        return;
    }

    const newUser = {
        id: Date.now().toString(),
        name,
        position,
        workingGroup,
        dept,
        username,
        email,
        password,
        role: 'user',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    localStorage.setItem('elearning_users', JSON.stringify(users));
    
    showAlert('ลงทะเบียนสำเร็จ', 'กรุณาเข้าสู่ระบบด้วยชื่อผู้ใช้งานและรหัสผ่านของคุณ');
    toggleAuth();
}

function toggleAuth() {
    const loginForm = document.getElementById('loginForm')?.parentElement;
    const registerForm = document.getElementById('registerForm')?.parentElement;
    
    if (loginForm?.classList.contains('hidden')) {
        loginForm.classList.remove('hidden');
        registerForm?.classList.add('hidden');
    } else {
        loginForm?.classList.add('hidden');
        registerForm?.classList.remove('hidden');
    }
}

function showDashboard() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
    
    // Update user display
    document.getElementById('userNameDisplay').textContent = currentUser?.name || 'ผู้ใช้งาน';
    document.getElementById('userDeptDisplay').textContent = currentUser?.dept || 'หน่วยงาน';
    
    // Show admin button if user is admin
    if (currentUser?.role === 'admin') {
        document.getElementById('adminBtn').classList.remove('hidden');
    }
    
    loadDashboardData();
}

function logout() {
    if (confirm('คุณแน่ใจหรือไม่ว่าต้องการออกจากระบบ?')) {
        currentUser = null;
        sessionStorage.removeItem('currentUser');
        adminMode = false;
        document.getElementById('appSection').classList.add('hidden');
        document.getElementById('adminSection').classList.add('hidden');
        document.getElementById('authSection').classList.remove('hidden');
        document.getElementById('loginForm').reset();
    }
}

function loadDashboardData() {
    // Load courses and other data
    console.log('Loading dashboard data for user:', currentUser?.name);
}

// ==================== Tab Navigation ====================
function switchUserTab(tabName, element) {
    const tabs = document.querySelectorAll('.user-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    const menuItems = document.querySelectorAll('.sidebar-menu li');
    menuItems.forEach(item => item.classList.remove('active'));
    
    document.getElementById(tabName).classList.remove('hidden');
    if (element) element.classList.add('active');
}

function switchAdminTab(tabName, element) {
    const tabs = document.querySelectorAll('.admin-tab');
    tabs.forEach(tab => tab.classList.add('hidden'));
    
    const menuItems = document.querySelectorAll('.navbar-menu li');
    menuItems.forEach(item => item.classList.remove('active'));
    
    document.getElementById(tabName).classList.remove('hidden');
    if (element) element.classList.add('active');
}

function goToAdminPanel() {
    adminMode = true;
    document.getElementById('appSection').classList.add('hidden');
    document.getElementById('adminSection').classList.remove('hidden');
}

function exitAdmin() {
    adminMode = false;
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('appSection').classList.remove('hidden');
}

// ==================== Auth Enhancement Functions ====================
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
}

function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.classList.add('hidden');
}

function ensureForgotPasswordModal() {
    if (document.getElementById('forgotPasswordModal')) return;
    const modal = document.createElement('div');
    modal.id = 'forgotPasswordModal';
    modal.className = 'modal hidden';
    modal.innerHTML = `
        <div class="modal-content" style="text-align: left; max-width: 460px;">
            <h3 style="margin-bottom: 10px;">ลืมรหัสผ่าน</h3>
            <p style="margin-bottom: 20px;">กรอกอีเมลที่ใช้ลงทะเบียน ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่</p>
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
    document.body.appendChild(modal);
}

function handleForgotPasswordRequest(e) {
    e.preventDefault();
    const email = document.getElementById('forgotPasswordEmail').value;
    showAlert('ระบบประมวลผลการขอรีเซ็ตรหัสผ่าน', 'ลิงก์รีเซ็ตจะถูกส่งไปยัง ' + email + ' ในไม่ช้า');
    closeForgotPasswordModal();
    document.getElementById('forgotPasswordForm').reset();
}

function ensureForgotPasswordTrigger() {
    const forgotLinks = document.querySelectorAll('a[onclick*="toggleAuth"]');
    if (forgotLinks.length === 0) return;
    forgotLinks.forEach(link => {
        const parentSpan = link.closest('.switch-form');
        if (parentSpan && !parentSpan.querySelector('[onclick*="openForgotPasswordModal"]')) {
            const forgotLink = document.createElement('a');
            forgotLink.href = '#';
            forgotLink.textContent = 'ลืมรหัสผ่าน';
            forgotLink.style.marginLeft = '8px';
            forgotLink.onclick = (e) => { e.preventDefault(); openForgotPasswordModal(); };
            parentSpan.appendChild(document.createTextNode(' | '));
            parentSpan.appendChild(forgotLink);
        }
    });
}

function ensureRegisterConfirmPasswordField() {
    const regPassword = document.getElementById('regPassword');
    if (!regPassword || document.getElementById('regConfirmPassword')) return;

    const confirmGroup = document.createElement('div');
    confirmGroup.className = 'input-group';
    confirmGroup.innerHTML = '<input type="password" id="regConfirmPassword" placeholder="ยืนยันรหัสผ่าน" required>';
    regPassword.parentElement.parentElement.insertBefore(confirmGroup, regPassword.parentElement.nextElementSibling);
}

function enhancePasswordField(fieldId) {
    const field = document.getElementById(fieldId);
    if (!field) return;

    if (!field.parentElement.classList.contains('password-field')) {
        const wrapper = document.createElement('div');
        wrapper.className = 'password-field';
        field.parentElement.insertBefore(wrapper, field);
        wrapper.appendChild(field);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'password-toggle';
        toggleBtn.textContent = 'แสดง';
        toggleBtn.onclick = () => {
            if (field.type === 'password') {
                field.type = 'text';
                toggleBtn.textContent = 'ซ่อน';
            } else {
                field.type = 'password';
                toggleBtn.textContent = 'แสดง';
            }
        };
        wrapper.appendChild(toggleBtn);
    }
}

function enhancePositionInput(posFieldId, otherFieldId) {
    const posField = document.getElementById(posFieldId);
    if (!posField) return;

    const commonPositions = ['แพทย์', 'พยาบาล', 'เจ้าหน้าที่', 'ผู้จัดการ'];
    if (!posField.getAttribute('data-enhanced')) {
        posField.setAttribute('data-enhanced', 'true');
        posField.setAttribute('list', 'positionList');

        const datalist = document.createElement('datalist');
        datalist.id = 'positionList';
        commonPositions.forEach(pos => {
            const option = document.createElement('option');
            option.value = pos;
            datalist.appendChild(option);
        });
        posField.parentElement.appendChild(datalist);
    }
}

function applyAuthTextOverrides() {}

function calculateModeBHours() {
    const startDate = document.getElementById('extDateStart');
    const endDate = document.getElementById('extDateEnd');
    const hoursDisplay = document.getElementById('extHoursModeB');

    if (!startDate || !endDate || !hoursDisplay) return;

    if (startDate.value && endDate.value) {
        const start = new Date(startDate.value);
        const end = new Date(endDate.value);
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        const hours = diffDays * 7;
        hoursDisplay.value = hours;
    }
}

// ==================== Course Management Functions ====================
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

function editCourse(courseId) {
    const course = adminCoursesData.find(c => c.course_id === courseId);
    if(!course) return;

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
            coverPreview.src = getDriveImageUrl(course.cover_image);
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
            addUnitField();
        } else {
            units.forEach(u => addUnitField(u.title, u.video_url, u.min_time));
        }
    }
    toggleCourseDeliveryFields();
    
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
    toggleCourseDeliveryFields();
}

function resetExternalRecommendationForm() {
    document.getElementById('externalRecommendationForm').reset();
    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-link"></i> เพิ่มหลักสูตรภายนอกแนะนำ';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> บันทึกหลักสูตรภายนอก';
    document.getElementById('btnCancelExternalRecEdit').classList.add('hidden');
    document.getElementById('editExtRecId').value = '';
    document.getElementById('extMouScore').value = 0;
}

function editExternalRecommendation(extRecId) {
    const extRec = adminExternalCourseData.find(c => c.ext_rec_id === extRecId);
    if(!extRec) return;

    document.getElementById('externalRecFormTitle').innerHTML = '<i class="fas fa-edit"></i> แก้ไขหลักสูตรภายนอก';
    document.getElementById('btnSubmitExternalRec').innerHTML = '<i class="fas fa-save"></i> บันทึกการแก้ไข';
    document.getElementById('btnCancelExternalRecEdit').classList.remove('hidden');
    document.getElementById('editExtRecId').value = extRec.ext_rec_id;

    document.getElementById('extRecTitle').value = extRec.title;
    document.getElementById('extRecOrganizer').value = extRec.organizer;
    document.getElementById('extRecUrl').value = extRec.url;
    document.getElementById('extRecCover').value = extRec.cover_image;
    
    const hr = Math.floor(extRec.hours);
    const min = Math.round((extRec.hours - hr) * 60);
    document.getElementById('extRecHours').value = hr;
    document.getElementById('extRecMins').value = min;
    document.getElementById('extMouScore').value = extRec.mou_score || 0;

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function addUnitField(title = '', videoUrl = '', minTime = 0) {
    const container = document.getElementById('unitsContainer');
    if (!container) return;
    
    const unitIndex = container.children.length;
    
    const unitBox = document.createElement('div');
    unitBox.className = 'unit-box';
    unitBox.innerHTML = `
        <div class="unit-row">
            <input type="text" class="u-title" placeholder="ชื่อหน่วย" value="${title}" required>
            <input type="url" class="u-video" placeholder="ลิงก์วิดีโอ (YouTube/Drive)" value="${videoUrl}" required>
            <input type="number" class="u-time" placeholder="นาที" min="0" value="${minTime}" required>
            <button type="button" class="btn-remove-unit" onclick="removeUnitField(this)" ${unitIndex === 0 && !title ? 'disabled' : ''}>
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
    container.appendChild(unitBox);
}

function removeUnitField(btn) {
    btn.parentElement.parentElement.remove();
}

function addQuestionBox() {
    const container = document.getElementById('questionsContainer');
    const qIndex = container.children.length + 1;
    const questionBox = document.createElement('div');
    questionBox.className = 'unit-box';
    questionBox.innerHTML = `
        <div style="margin-bottom: 10px;">
            <label><strong>ข้อที่ ${qIndex}</strong></label>
            <input type="text" placeholder="ข้อคำถาม" class="question-text" required style="width: 100%; padding: 8px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #ddd;">
        </div>
        <div id="options-${qIndex}"></div>
        <button type="button" class="btn btn-outline btn-sm" onclick="addOption(${qIndex})">+ เพิ่มตัวเลือก</button>
        <button type="button" class="btn btn-danger btn-sm" style="margin-left: 5px;" onclick="removeQuestion(this)">ลบข้อ</button>
    `;
    container.appendChild(questionBox);
    addOption(qIndex);
    addOption(qIndex);
}

function addOption(qIndex) {
    const container = document.getElementById(`options-${qIndex}`);
    if (!container) return;
    
    const oIndex = container.children.length + 1;
    const optionBox = document.createElement('div');
    optionBox.style.marginBottom = '8px';
    optionBox.innerHTML = `
        <label style="margin-right: 10px;"><input type="radio" name="correct-${qIndex}"> ตัวเลือก ${oIndex}:</label>
        <input type="text" placeholder="ข้อความตัวเลือก" class="option-text" style="width: calc(100% - 180px); padding: 8px; border-radius: 6px; border: 1px solid #ddd;">
    `;
    container.appendChild(optionBox);
}

function removeQuestion(btn) {
    btn.parentElement.remove();
}

function previewCoverImage(input) {
    if (!input.files[0]) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('cCoverPreview');
        if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        }
    };
    reader.readAsDataURL(input.files[0]);
}

function getDriveImageUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}`;
}

// ==================== Sidebar Toggle ====================
function toggleSidebar() {
    const sidebar = document.querySelector('.user-sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    
    if (sidebar) {
        sidebar.style.display = sidebar.style.display === 'none' ? 'flex' : 'none';
    }
    
    if (overlay) {
        overlay.classList.toggle('hidden');
    }
}

function toggleAdminMenu() {
    const menu = document.getElementById('adminNavbarMenu');
    const actions = document.getElementById('adminNavbarActions');
    
    if (menu) menu.classList.toggle('open');
    if (actions) actions.classList.toggle('open');
}

// ==================== Utility Functions ====================
function scrollGuideTo(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

function filterCourses() {
    const searchText = (document.getElementById('courseSearchInput')?.value || '').toLowerCase();
    const courseCards = document.querySelectorAll('.course-card');
    
    courseCards.forEach(card => {
        const title = (card.querySelector('.course-title')?.textContent || '').toLowerCase();
        card.style.display = title.includes(searchText) ? 'flex' : 'none';
    });
}
