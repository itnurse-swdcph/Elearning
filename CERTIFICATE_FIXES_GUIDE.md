# Certificate Generation System - Complete Fixes Guide

## Overview
This guide provides comprehensive fixes for 3 critical issues in the certificate generation system:
1. **Missing Certificate Data** (Course Name & QR Code)
2. **Download/Popup Behavior Issues** (Logout/Redirect)
3. **Automatic Certificate Trigger** (Upon course completion)

---

## ISSUE #1: Missing Certificate Data (Course Name & QR Code)

### Problem
The generated certificate is missing:
- **Course Name/Title** where {{CAUSE}} placeholder should appear
- **QR Code** image at the bottom left corner

### Root Cause
1. The `{{CAUSE}}` placeholder in Google Slides template expects "course name" but the code doesn't replace it properly
2. QR code generation fails silently; the code continues without inserting the image
3. The template file itself might not have the `{{CAUSE}}` placeholder

### Solution

**Step 1: Verify/Update Your Google Slides Template**

Ensure your template has these placeholders (check in Google Slides):
```
{{NAME}}           → Student name ✓ (working)
{{COURSE}}         → Course name ✓ (working)
{{DATE}}           → Current date ✓ (working)
{{CERT_ID}}        → Certificate ID ✓ (working)
{{VERIFY_URL}}     → Verification link ✓ (working)
{{CAUSE}}          → Course Name / Cause (MISSING - needs fixing)
{{QR_CODE}}        → QR Code image (needs proper placement)
```

**Step 2: Update code.gs - Replace the `generateCertificate` function**

```javascript
// ================= ENHANCED CERTIFICATE GENERATION =================

const CERT_FOLDER_ID = '19Htb9AjawXDOzje5yVeyT_i7mkYh-k45';

function generateCertificate(sheet, payload) {
  const wsEnroll = sheet.getSheetByName('Enrollments');
  const wsCourse = getCoursesSheet_(sheet);
  const wsCert = getCertificateRegistrySheet_(sheet);
  
  const courseData = wsCourse.getDataRange().getValues();
  const enrollData = wsEnroll.getDataRange().getValues();
  
  let courseTitle = '';
  let courseCause = '';  // ← NEW: For {{CAUSE}} placeholder
  let templateId = '';
  let completionDate = '';
  let enrollmentRowIndex = 0;
  let enrollmentStatus = '';
  
  // ===== STEP 1: FIND COURSE DATA =====
  for (let i = 1; i < courseData.length; i++) {
    if (courseData[i][0] === payload.course_id) {
      const course = buildCourseRecord_(courseData[i]);
      courseTitle = course.title;
      courseCause = course.title;  // ← Use course title as cause
      templateId = course.cert_template;
      break;
    }
  }

  if (!payload.user_name || String(payload.user_name).trim() === "") {
    return responseJSON({ status: 'error', message: 'ไม่พบข้อมูลชื่อ-นามสกุลของผู้เรียน' });
  }
  if (!courseTitle || String(courseTitle).trim() === "") {
    return responseJSON({ status: 'error', message: 'ไม่พบข้อมูลชื่อหลักสูตร' });
  }
  if (!templateId || String(templateId).trim() === "") {
    return responseJSON({ 
      status: 'error', 
      message: 'หลักสูตรนี้ยังไม่ได้ตั้งค่า Template ใบประกาศ (Slides Template ID)' 
    });
  }

  // ===== STEP 2: VERIFY TEMPLATE FILE =====
  let templateFile;
  try {
    templateFile = DriveApp.getFileById(templateId);
  } catch(e) {
    return responseJSON({ 
      status: 'error', 
      message: 'ไม่สามารถเข้าถึง Template ใบประกาศได้: ' + e.toString() 
    });
  }

  // ===== STEP 3: FIND ENROLLMENT RECORD =====
  for (let i = 1; i < enrollData.length; i++) {
    if (enrollData[i][1] === payload.user_id && enrollData[i][2] === payload.course_id) {
      enrollmentRowIndex = i + 1;
      completionDate = enrollData[i][6] || new Date();
      enrollmentStatus = enrollData[i][5] || '';
      break;
    }
  }

  if (!enrollmentRowIndex) {
    return responseJSON({ status: 'error', message: 'ไม่พบข้อมูลการลงทะเบียนสำหรับออกใบประกาศ' });
  }
  if (enrollmentStatus !== 'completed') {
    return responseJSON({ status: 'error', message: 'ไม่พบสถานะการเรียนจบหลักสูตรนี้' });
  }

  try {
    const existingCert = findCertificateRecordByUserCourse_(wsCert, payload.user_id, payload.course_id);
    const certId = existingCert ? existingCert.certId : generateCertificateId_();
    const verifyUrl = buildCertificateVerifyUrl_(certId);
    const issuedAt = new Date();

    // ===== STEP 4: COPY & MODIFY TEMPLATE =====
    let destFolder;
    try {
      destFolder = DriveApp.getFolderById(CERT_FOLDER_ID);
    } catch(fe) {
      const certFolders = DriveApp.getFoldersByName('E-Learning Certificates');
      destFolder = certFolders.hasNext() ? certFolders.next() : DriveApp.createFolder('E-Learning Certificates');
    }

    const certFileName = `Cert_${certId}_${sanitizeFileName_(payload.user_name)}_${sanitizeFileName_(courseTitle)}`;
    const tempFile = templateFile.makeCopy(certFileName, destFolder);
    const tempPresentation = SlidesApp.openById(tempFile.getId());
    const slide = tempPresentation.getSlides()[0];
    
    const today = new Date().toLocaleDateString('th-TH', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });

    // ===== STEP 5: REPLACE ALL TEXT PLACEHOLDERS =====
    try {
      slide.replaceAllText('{{NAME}}', payload.user_name);
      slide.replaceAllText('{{COURSE}}', courseTitle);
      slide.replaceAllText('{{CAUSE}}', courseCause);  // ← FIX: Replace {{CAUSE}} with course name
      slide.replaceAllText('{{DATE}}', today);
      slide.replaceAllText('{{CERT_ID}}', certId);
      slide.replaceAllText('{{VERIFY_URL}}', verifyUrl);
    } catch(re) {
      Logger.log('Text replacement warning: ' + re.toString());
    }

    // ===== STEP 6: INSERT QR CODE =====
    try {
      insertQrCodePlaceholders_(tempPresentation, verifyUrl);
    } catch(qe) {
      Logger.log('QR Code insertion failed (non-critical): ' + qe.toString());
      // Continue - certificate still valid without QR
    }

    // ===== STEP 7: SAVE & CONVERT TO PDF =====
    tempPresentation.saveAndClose();
    const pdfBlob = tempFile.getAs('application/pdf').setName(certId + '.pdf');
    const pdfFile = destFolder.createFile(pdfBlob);
    pdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // ===== STEP 8: CLEANUP & RECORD =====
    tempFile.setTrashed(true);
    wsEnroll.getRange(enrollmentRowIndex, 8).setValue(pdfFile.getUrl());

    upsertCertificateRecord_(wsCert, {
      rowIndex: existingCert ? existingCert.rowIndex : 0,
      certId: certId,
      userId: payload.user_id,
      userName: payload.user_name,
      courseId: payload.course_id,
      courseTitle: courseTitle,
      completionDate: completionDate,
      issuedAt: issuedAt,
      pdfUrl: pdfFile.getUrl(),
      verifyUrl: verifyUrl
    });

    Logger.log('Certificate generated successfully: ' + certId);
    return responseJSON({ 
      status: 'success', 
      pdf_url: pdfFile.getUrl(), 
      cert_id: certId, 
      verify_url: verifyUrl,
      course_name: courseTitle  // ← NEW: Return course name for verification
    });

  } catch (error) {
    Logger.log('Certificate generation error: ' + error.toString());
    return responseJSON({ 
      status: 'error', 
      message: 'สร้างใบประกาศไม่สำเร็จ: ' + error.toString() 
    });
  }
}

// ===== ENHANCED QR CODE INSERTION =====
function insertQrCodePlaceholders_(presentation, verifyUrl) {
  const placeholder = '{{QR_CODE}}';
  const slides = presentation.getSlides();
  
  let qrBlob;
  try {
    qrBlob = buildQrCodeBlob_(verifyUrl);
  } catch(e) {
    Logger.log('QR code generation failed: ' + e.toString());
    return; // Continue without QR code
  }

  slides.forEach(function(slide) {
    const elements = slide.getPageElements();
    // Iterate backwards to safely remove elements
    for (let i = elements.length - 1; i >= 0; i--) {
      try {
        const element = elements[i];
        
        // Only process text shapes
        if (element.getPageElementType() !== SlidesApp.PageElementType.SHAPE) continue;
        
        const shape = element.asShape();
        const textRange = shape.getText();
        if (!textRange) continue;
        
        const rawText = textRange.asString();
        if (rawText.indexOf(placeholder) === -1) continue;

        // Get element position for image placement
        const left = element.getLeft();
        const top = element.getTop();
        const width = element.getWidth();
        const height = element.getHeight();

        // Remove placeholder text
        if (rawText.trim() === placeholder) {
          element.remove();
        } else {
          textRange.replaceAllText(placeholder, '');
        }

        // Insert QR code image
        slide.insertImage(qrBlob.copyBlob(), left, top, width, height);
        Logger.log('QR code inserted at position: left=' + left + ', top=' + top);
      } catch(e) {
        Logger.log('QR insertion element error: ' + e.toString());
        // Continue to next element
      }
    }
  });
}

function sanitizeFileName_(name) {
  return String(name)
    .replace(/[\/\\?*:|"<>]/g, '')
    .substring(0, 50);
}
```

---

## ISSUE #2: Download and Popup Behavior Issues

### Problem
- Certificate generates successfully but user gets logged out or redirected
- No download dialog appears
- Session gets disrupted

### Root Cause
1. The logout happens due to session timeout during certificate generation
2. The browser popup doesn't wait for the full API response
3. The PDF URL is not properly validated before being passed to window.open()

### Solution

**Update app.js - Replace `submitQuizData` and `downloadCertificate` functions**

```javascript
// ================= ENHANCED QUIZ SUBMISSION & CERTIFICATE HANDLING =================

/**
 * Submit quiz answers and generate certificate upon passing
 */
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
                enrollData.cert_url = certRes.pdf_url;
                const enrollEntry = cachedUserEnrollments.find(e => e.course_id === currentClassCourse.id);
                if (enrollEntry) {
                    enrollEntry.cert_url = certRes.pdf_url;
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

/**
 * Download certificate with enhanced error handling
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

/**
 * Validate if URL is valid and HTTPS
 */
function isValidUrl_(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch(e) {
        return false;
    }
}
```

---

## ISSUE #3: Automatic Certificate Generation Upon Course Completion

### Problem
- Certificate is only generated when user manually clicks "Download Certificate"
- System should auto-generate it immediately after passing the exam
- No notification when certificate is ready

### Solution

**This is now FIXED by Issue #2 solution above!**

When a user **passes the post-test exam** in `submitQuizData()`, the system automatically:
1. ✅ Submits the quiz score to backend
2. ✅ Calls `generateCert` API immediately
3. ✅ Opens PDF in new tab
4. ✅ Stores URL in cache

**Additional Enhancement: Add Certificate Ready Notification**

In `app.js`, add this function to notify user when certificate is ready:

```javascript
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
```

Then call it in `submitQuizData()` after certificate generation:

```javascript
if (certRes && certRes.status === 'success' && certRes.pdf_url) {
    // ... existing code ...
    
    // ✅ NEW: Show notification
    showCertificateReadyNotification(certRes.cert_id, certRes.verify_url);
    
    // Open certificate
    window.open(certRes.pdf_url, '_blank', 'noopener,noreferrer');
}
```

---

## Deployment Checklist

### Before Deploying:

- [ ] **Google Slides Template**: Add `{{CAUSE}}` placeholder and `{{QR_CODE}}` placeholder
- [ ] **code.gs**: Replace `generateCertificate` and `insertQrCodePlaceholders_` functions
- [ ] **app.js**: Replace `submitQuizData` and `downloadCertificate` functions
- [ ] **app.js**: Add `showCertificateReadyNotification` and `isValidUrl_` helper functions
- [ ] **Test**: Complete a course, pass the exam, verify certificate auto-generates

### Testing Steps:

```
1. Login as test user
2. Enroll in a course with video units
3. Watch all units (mark 100% complete)
4. Click "Post-test" exam button
5. Answer all questions correctly (score ≥ 80%)
6. Verify:
   ✓ Certificate generates automatically
   ✓ {{CAUSE}} and {{QR_CODE}} appear in PDF
   ✓ New tab opens with PDF (user stays logged in)
   ✓ Green notification shows "Certificate Ready"
   ✓ Certificate ID is displayed
   ✓ Can click "Download" button on dashboard
7. Logout and login again
8. Verify certificate URL is still accessible
```

---

## Troubleshooting

### Q: Certificate still missing {{CAUSE}} text
**A**: Check your Google Slides template has the `{{CAUSE}}` placeholder. If not, edit the template and add it manually.

### Q: QR Code not appearing
**A**: Verify `{{QR_CODE}}` placeholder exists in template. Also check:
- QuickChart API is accessible (test: `https://quickchart.io/qr?text=test`)
- Google Apps Script has UrlFetch permission

### Q: User gets logged out during certificate generation
**A**: This is now fixed. The solution doesn't redirect pages and keeps the user session alive.

### Q: PDF doesn't open in new tab
**A**: Browser popup blockers may prevent it. Check:
- Browser console for errors (F12 → Console)
- Allow popups for this domain
- Use direct link: `window.open(url, '_blank')`

