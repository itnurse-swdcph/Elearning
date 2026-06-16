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
