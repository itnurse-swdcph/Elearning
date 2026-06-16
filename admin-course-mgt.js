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

function displayAdminCourseList() {
    const tbody = document.getElementById('adminCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = adminCoursesData.map(course => {
        const mouScore = course.mou_score || calculateMOUScore(course.hours * 60);
        return `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.delivery_type === 'classroom' ? 'ห้องเรียน' : 'ออนไลน์'} / ${course.audience === 'all' ? 'ทุกคน' : course.audience === 'nurse' ? 'พยาบาลวิชาชีพ' : 'สายสนับสนุน'}</td>
                <td>${course.hours} ชม.</td>
                <td style="font-weight: 600; color: var(--primary-color);">${mouScore} คะแนน</td>
                <td><span class="table-status-badge ${course.status === 'active' ? 'active' : 'inactive'}">${course.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="editCourse('${course.course_id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteCourse('${course.course_id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

function displayAdminExternalCourseList() {
    const tbody = document.getElementById('adminExternalCourseListBody');
    if (!tbody) return;

    tbody.innerHTML = adminExternalCoursesData.map(course => {
        const mouScore = course.mou_score || calculateMOUScore(course.hours * 60);
        return `
            <tr>
                <td><strong>${course.title}</strong></td>
                <td>${course.organizer}</td>
                <td>${course.hours} ชม.</td>
                <td style="font-weight: 600; color: var(--primary-color);">${mouScore} คะแนน</td>
                <td><span class="table-status-badge ${course.status === 'active' ? 'active' : 'inactive'}">${course.status === 'active' ? 'ใช้งาน' : 'ระงับ'}</span></td>
                <td>
                    <button class="btn-action btn-edit" onclick="editExternalCourse('${course.rec_id}')"><i class="fas fa-edit"></i></button>
                    <button class="btn-action btn-danger" onclick="deleteExternalCourse('${course.rec_id}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}
