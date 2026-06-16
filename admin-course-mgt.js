// ==================== Course Management UI & Logic ====================

/**
 * ฟังก์ชันสำหรับสลับการแสดงผลแบบฟอร์ม (เปิด/ปิด)
 * @param {string} containerId - ID ของกล่องที่หุ้มแบบฟอร์มไว้
 * @param {boolean} forceOpen - บังคับให้เปิด (ใช้กรณีที่กดปุ่ม 'แก้ไข' แล้วต้องการให้ฟอร์มแสดงทันที)
 */
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
    if (typeof adminExternalCoursesData === 'undefined') return;
    const course = adminExternalCoursesData.find(c => c.rec_id === recId);
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
    if (!tbody || typeof adminExternalCoursesData === 'undefined') return;

    tbody.innerHTML = adminExternalCoursesData.map(course => {
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
