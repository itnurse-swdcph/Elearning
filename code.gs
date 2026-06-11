// Code.gs
const SHEET_ID = '1QpqrBg7Sf_HBM9NoPukDvpgZ1pzeTqU_82wn1uUbmSY'; // เปลี่ยนเป็น ID ของ Google Sheet

// --- Caching layer ---
function getSheetDataCached(sheet, sheetName, clearCache) {
  const cacheKey = 'sheet_data_' + sheetName;
  const cache = CacheService.getScriptCache();
  if (!clearCache) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Parse cached sheet failed:", e);
      }
    }
  }
  const ws = sheet.getSheetByName(sheetName);
  if (!ws) return [];
  const data = ws.getDataRange().getValues();
  try {
    // Cache for 10 minutes (600 seconds)
    cache.put(cacheKey, JSON.stringify(data), 600);
  } catch (e) {
    console.error("Write cache failed:", e);
  }
  return data;
}

function clearSheetCache(sheetName) {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('sheet_data_' + sheetName);
  } catch (e) {
    console.error("Remove cache failed:", e);
  }
}

function authorizeCertificateService() {
  try {
    // Trigger permissions for Drive, Slides, UrlFetch, Spreadsheet, and Mail
    const driveOk = DriveApp.getRootFolder() ? "Drive OK" : "Drive Error";
    const tempPresentation = SlidesApp.create("Temp Auth Slide");
    const slidesOk = tempPresentation ? "Slides OK" : "Slides Error";
    if (tempPresentation) {
      DriveApp.getFileById(tempPresentation.getId()).setTrashed(true);
    }
    
    const urlFetchOk = UrlFetchApp.fetch("https://quickchart.io", { muteHttpExceptions: true }).getResponseCode() === 200 ? "UrlFetch OK" : "UrlFetch Error";
    const mailOk = MailApp.getRemainingDailyQuota() >= 0 ? "Mail OK" : "Mail Error";
    
    return responseJSON({
      status: 'success',
      message: 'สิทธิ์การใช้งานได้รับการอนุญาตเรียบร้อยแล้ว: ' + [driveOk, slidesOk, urlFetchOk, mailOk].join(', ')
    });
  } catch (e) {
    return responseJSON({
      status: 'error',
      message: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์: ' + e.toString()
    });
  }
}

// รองรับการเปิดลิงก์รีเซ็ตรหัสผ่านโดยตรงผ่าน URL
function doGet(e) {
  const sheet = SpreadsheetApp.openById(SHEET_ID);
  initializeDatabase(sheet);
  const params = e && e.parameter ? e.parameter : {};
  const token = String(params.token || '').trim();
  const mode = String(params.mode || '').trim().toLowerCase();
  const certId = String(params.certId || params.id || '').trim();

  if (mode === 'verifycert' && certId) {
    return HtmlService.createHtmlOutput(buildCertificateVerificationPage_(sheet, certId))
      .setTitle('Certificate Verification');
  }

  if (mode === 'reset' && token) {
    return HtmlService.createHtmlOutput(buildResetPasswordPage_(sheet, token, params.returnUrl || ''))
      .setTitle('Reset Password');
  }

  return ContentService.createTextOutput("ระบบ Backend (API) ของ E-Learning Nurse SWD กำลังทำงานตามปกติ 🟢")
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  const sheet = SpreadsheetApp.openById(SHEET_ID);
  initializeDatabase(sheet);
  const data = JSON.parse(e.postData.contents);
  const action = data.action;
  
  if (action === 'loadInitialData') { return loadInitialData(sheet, data.payload); }
  else if (action === 'authorizeCertificateService') { return authorizeCertificateService(); }
  else if (action === 'register') { return registerUser(sheet, data.payload); }
  else if (action === 'login') { return loginUser(sheet, data.payload); }
  else if (action === 'requestPasswordReset') { return requestPasswordReset(sheet, data.payload); }
  else if (action === 'resetPasswordWithToken') { return resetPasswordWithToken(sheet, data.payload); }
  else if (action === 'getDashboardStats') { return getDashboardStats(sheet, data.payload); } // Dashboard
  else if (action === 'getCourses') { return getCourses(sheet); }
  else if (action === 'getUserEnrollments') { return getUserEnrollments(sheet, data.payload); } // รายการลงทะเบียน
  else if (action === 'enrollCourse') { return enrollCourse(sheet, data.payload); }
  else if (action === 'updateProgress') { return updateProgress(sheet, data.payload); }
  else if (action === 'getCourseExams') { return getCourseExams(sheet, data.payload); }
  else if (action === 'saveCourseExams') { return saveCourseExams(sheet, data.payload); }
  else if (action === 'submitQuiz') { return submitQuiz(sheet, data.payload); }
  else if (action === 'generateCert') { return generateCertificate(sheet, data.payload); }
  else if (action === 'getUserHistory') { return getUserHistory(sheet, data.payload); }
  else if (action === 'addExternalTraining') { return addExternalTraining(sheet, data.payload); }
  else if (action === 'deleteExternalTraining') { return deleteExternalTraining(sheet, data.payload); }
  else if (action === 'updateExternalTrainingByUser') { return updateExternalTrainingByUser(sheet, data.payload); }
  else if (action === 'getExternalRecommendations') { return getExternalRecommendations(sheet, data.payload || {}); }
  else if (action === 'getAdminReport') { return getAdminReport(sheet, data.payload); }
  else if (action === 'getAdminCourses') { return getAdminCourses(sheet); }
  else if (action === 'addCourse') { return addCourse(sheet, data.payload); }
  else if (action === 'updateCourse') { return updateCourse(sheet, data.payload); }
  else if (action === 'updateCourseStatus') { return updateCourseStatus(sheet, data.payload); }
  else if (action === 'addExternalRecommendation') { return addExternalRecommendation(sheet, data.payload); }
  else if (action === 'updateExternalRecommendation') { return updateExternalRecommendation(sheet, data.payload); }
  else if (action === 'updateExternalRecommendationStatus') { return updateExternalRecommendationStatus(sheet, data.payload); }
  else if (action === 'getAdminExternalReq') { return getAdminExternalReq(sheet); }
  else if (action === 'updateExternalStatus') { return updateExternalStatus(sheet, data.payload); }
  else if (action === 'getAdminUsers') { return getAdminUsers(sheet); }
  else if (action === 'updateUserByAdmin') { return updateUserByAdmin(sheet, data.payload); }
  else if (action === 'getSettings') { return getSettings(sheet); } // ดึงหน่วยงาน
  else if (action === 'uploadFile') { return uploadFile(sheet, data.payload); } // อัปโหลดไฟล์
  else if (action === 'updateUserProfile') { return updateUserProfile(sheet, data.payload); } // แก้ไขโปรไฟล์
  else if (action === 'getCourseReport') { return getCourseReport(sheet, data.payload); }
  else if (action === 'getQA') { return getQA(sheet, data.payload); }
  else if (action === 'askQuestion') { return askQuestion(sheet, data.payload); }
  else if (action === 'answerQuestion') { return answerQuestion(sheet, data.payload); } 
  else if (action === 'submitReview') { return submitReview(sheet, data.payload); }
  
  return responseJSON({ status: 'error', message: 'Unknown action: ' + action });
}

function responseJSON(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(spreadsheet, sheetName, headers) {
  let ws = spreadsheet.getSheetByName(sheetName);
  if (!ws) {
    ws = spreadsheet.insertSheet(sheetName);
  }
  if (ws.getLastRow() === 0 && headers && headers.length > 0) {
    ws.appendRow(headers);
  }
  return ws;
}

function initializeDatabase(sheet) {
  const sheetsToCreate = {
    'Users': [
      'User_ID', 'Full_Name', 'Position', 'Department', 'Working_Group',
      'Username', 'Email', 'Password', 'Role', 'Total_Hours', 'Profile_Img', 'Created_At'
    ],
    'Courses': [
      'Course_ID', 'Title', 'Cover_Image', 'Units', 'Total_Min_Time',
      'Passing_Score', 'Organizer', 'Hours', 'Enrolled', 'Status',
      'Cert_Template', 'Delivery_Type', 'Audience', 'Is_Mandatory', 'Note', 'Mandatory_Groups', 'MOU_Score'
    ],
    'Lessons': [
      'Lesson_ID', 'Course_ID', 'Title', 'Video_URL', 'Min_Time', 'Order'
    ],
    'Exams': [
      'Exam_ID', 'Course_ID', 'Question', 'Option_A', 'Option_B', 'Option_C', 'Option_D', 'Answer'
    ],
    'Certificates': [
      'Certificate_ID', 'User_ID', 'User_Name', 'Course_ID', 'Course_Title',
      'Completion_Date', 'Issued_At', 'PDF_URL', 'Verification_URL'
    ],
    'External_Training': [
      'Ext_ID', 'User_ID', 'Topic', 'Organizer', 'Date', 'Hours',
      'File_URL', 'Status', 'Recommendation_ID', 'Rejection_Reason', 'Training_Time'
    ],
    'OrganizationStructure': [
      'Working_Group', 'Department'
    ],
    'Permissions': [
      'Permission_ID', 'User_ID', 'Role', 'Target'
    ],
    'Settings': [
      'Key', 'Value', 'Description'
    ]
  };

  const DEFAULT_ORG_UNITS = [
    ["กลุ่มการพยาบาล", "กลุ่มการพยาบาล"],
    ["กลุุ่มงานการพยาบาลผู้ป่วยนอก", "งานการพยาบาลผู้ป่วยนอก"],
    ["กลุุ่มงานการพยาบาลผู้ป่วยนอก", "คลินิกโรคเรืื้อรัง"],
    ["กลุุ่มงานการพยาบาลผู้ป่วยนอก", "คลิินิกให้คำปรึกษา"],
    ["กลุุ่มงานการพยาบาลผู้ป่วยนอก", "คลินิิกฝากครรภ์"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอุบัติเหตุและฉุกเฉิน", "งานการพยาบาลผูุ้ป่วยอุบัติเหตุและฉุกเฉิน"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอุบัติเหตุและฉุกเฉิน", "ศูนย์เปล"],
    ["กลุ่มงานการพยาบาลจิตเวช", "งานการพยาบาลผู้ป่วยในจิตเวช"],
    ["กลุ่มงานการพยาบาลผูุ้ป่วยห้องผ่าตัด", "งานการพยาบาลผู้ป่วยห้องผ่าตัด"],
    ["กลุ่มงานการพยาบาลวิสัญญี", "งานการพยาบาลวิสัญญี"],
    ["กลุ่มงานการพยาบาลด้านการควบคุมและป้องกันการติดเชื้อ", "งานการพยาบาลการควบคุมและป้องกันการติดเชื้อ"],
    ["กลุ่มงานการพยาบาลด้านการควบคุมและป้องกันการติดเชื้อ", "หน่วยจ่ายกลาง"],
    ["กลุ่มงานการพยาบาลผู้คลอด", "งานการพยาบาลผู้คลอด"],
    ["กลุ่มงานการพยาบาลตรวจรักษาพิเศษ", "งานการพยาบาลไตเทียม"],
    ["กลุ่มงานการพยาบาลตรวจรักษาพิเศษ", "งานการพยาบาลตรวจรักษาด้วยการส่องกล้อง"],
    ["กลุ่มงานการพยาบาลตรวจรักษาพิเศษ", "งานการพยาบาลเคมีบำบัด"],
    ["กลุ่มงานการพยาบาลผู้ป่วยหนัก", "งานการพยาบาลผู้ป่วยหนัก"],
    ["กลุ่มงานการพยาบาลผู้ป่วยหนัก", "งานการพยาบาลทารกแรกเกิดระยะวิกฤตและทารกป่วย"],
    ["กลุ่มงานการพยาบาลผู้ป่วยโสต ศอ นาสิก", "งานการพยาบาลผู้ป่วยในโสต ศอ นาสิก"],
    ["กลุ่มงานการพยาบาลผู้ป่วยออร์โธปิดิกส์", "งานการพยาบาลผู้ป่วยในออร์โธปิดิกส์"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม", "งานการพยาบาลผู้ป่วยในอายุรกรรมหญิง"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม", "งานการพยาบาลผู้ป่วยในอายุรกรรมชาย"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม", "งานการพยาบาลผู้ป่วยในหลอดเลือดสมอง"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม", "งานการพยาบาลผู้ป่วยในพิเศษปาริฉัตร"],
    ["กลุ่มงานการพยาบาลผู้ป่วยอายุรกรรม", "งานการพยาบาลผู้ป่วยในสงฆ์อาพาธ"],
    ["กลุ่มงานการพยาบาลผู้ป่วยศัลยกรรม", "งานการพยาบาลผู้ป่วยในศัลยกรรม"],
    ["กลุ่มงานการพยาบาลผู้ป่วยสูติ-นรีเวช", "งานการพยาบาลผู้ป่วยในสูติ-นรีเวช"],
    ["กลุ่มงานการพยาบาลผู้ป่วยสูติ-นรีเวช", "งานการพยาบาลผู้ป่วยในพิเศษพวงชมพู"],
    ["กลุ่มงานการพยาบาลผู้ป่วยกุมารเวชกรรม", "งานการพยาบาลผู้ป่วยในกุมารเวชกรรม"]
  ];

  for (let sheetName in sheetsToCreate) {
    let ws = sheet.getSheetByName(sheetName);
    if (sheetName === 'OrganizationStructure') {
      let wsThai = sheet.getSheetByName('ชื่อหน่วยงาน');
      if (wsThai) {
        ensureSheetHeaders_(wsThai, sheetsToCreate[sheetName]);
        if (wsThai.getLastRow() <= 1) {
          DEFAULT_ORG_UNITS.forEach(row => wsThai.appendRow(row));
        }
        continue;
      }
    }
    if (!ws) {
      ws = sheet.insertSheet(sheetName);
    }
    ensureSheetHeaders_(ws, sheetsToCreate[sheetName]);
    if (sheetName === 'OrganizationStructure' && ws.getLastRow() <= 1) {
      DEFAULT_ORG_UNITS.forEach(row => ws.appendRow(row));
    }
  }
}


const COURSE_SHEET_HEADERS_ = [
  'Course_ID',
  'Title',
  'Cover_Image',
  'Units',
  'Total_Min_Time',
  'Passing_Score',
  'Organizer',
  'Hours',
  'Enrolled',
  'Status',
  'Cert_Template',
  'Delivery_Type',
  'Audience',
  'Is_Mandatory',
  'Note',
  'Mandatory_Groups',
  'MOU_Score'
];

const EXTERNAL_RECOMMENDATION_HEADERS_ = [
  'Rec_ID',
  'Title',
  'Organizer',
  'Hours',
  'Cover_Image',
  'Register_URL',
  'Status',
  'Created_At',
  'Audience',
  'Mandatory_Groups'
];

const EXTERNAL_TRAINING_HEADERS_ = [
  'Ext_ID',
  'User_ID',
  'Topic',
  'Organizer',
  'Date',
  'Hours',
  'File_URL',
  'Status',
  'Recommendation_ID',
  'Rejection_Reason',
  'Training_Time'
];

function ensureSheetHeaders_(ws, headers) {
  if (!ws || !headers || headers.length === 0) return ws;
  if (ws.getMaxColumns() < headers.length) {
    ws.insertColumnsAfter(ws.getMaxColumns(), headers.length - ws.getMaxColumns());
  }
  const headerRange = ws.getRange(1, 1, 1, headers.length);
  const currentHeaders = headerRange.getValues()[0];
  const nextHeaders = headers.map(function(header, index) {
    return currentHeaders[index] || header;
  });

  let changed = false;
  for (let i = 0; i < headers.length; i++) {
    if (currentHeaders[i] !== nextHeaders[i]) {
      changed = true;
      break;
    }
  }
  if (changed) {
    headerRange.setValues([nextHeaders]);
  }
  return ws;
}

function getCoursesSheet_(spreadsheet) {
  return ensureSheetHeaders_(getOrCreateSheet_(spreadsheet, 'Courses', COURSE_SHEET_HEADERS_), COURSE_SHEET_HEADERS_);
}

function getExternalTrainingSheet_(spreadsheet) {
  return ensureSheetHeaders_(getOrCreateSheet_(spreadsheet, 'External_Training', EXTERNAL_TRAINING_HEADERS_), EXTERNAL_TRAINING_HEADERS_);
}

function getExternalRecommendationSheet_(spreadsheet) {
  return ensureSheetHeaders_(
    getOrCreateSheet_(spreadsheet, 'External_Course_Recommendations', EXTERNAL_RECOMMENDATION_HEADERS_),
    EXTERNAL_RECOMMENDATION_HEADERS_
  );
}

function isAdminDepartment_(department) {
  return String(department || '').trim().toLowerCase() === 'admin';
}

function normalizeUsername_(value) {
  return String(value == null ? '' : value).trim();
}

function normalizePassword_(value) {
  return String(value == null ? '' : value);
}

function setPlainTextCell_(range, value) {
  range.setNumberFormat('@');
  range.setValue(String(value == null ? '' : value));
}

function writeUserCredentialCells_(ws, rowIndex, username, email, password) {
  ws.getRange(rowIndex, 6).setNumberFormat('@');
  ws.getRange(rowIndex, 7).setNumberFormat('@');
  ws.getRange(rowIndex, 8).setNumberFormat('@');
  ws.getRange(rowIndex, 6).setValue(username);
  ws.getRange(rowIndex, 7).setValue(email);
  ws.getRange(rowIndex, 8).setValue(password);
}

function normalizeEmail_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeLoginIdentifier_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

function normalizeFullName_(value) {
  return String(value == null ? '' : value).trim().replace(/\s+/g, ' ').toLowerCase();
}

function isDuplicateUserField_(data, fieldIndex, normalizedValue, excludeUserId) {
  if (!normalizedValue) return false;
  for (let i = 1; i < data.length; i++) {
    if (excludeUserId && data[i][0] === excludeUserId) continue;
    const currentValue = fieldIndex === 1
      ? normalizeFullName_(data[i][fieldIndex])
      : (fieldIndex === 6 ? normalizeEmail_(data[i][fieldIndex]) : normalizeUsername_(data[i][fieldIndex]));
    if (currentValue && currentValue === normalizedValue) return true;
  }
  return false;
}

function findUserRowByEmail_(data, email) {
  const normalizedEmail = normalizeEmail_(email);
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][6]) === normalizedEmail) {
      return { rowIndex: i + 1, row: data[i] };
    }
  }
  return null;
}

function getPasswordResetSheet_(spreadsheet) {
  return getOrCreateSheet_(spreadsheet, 'Password_Reset_Tokens', [
    'Token_Hash',
    'User_ID',
    'Email',
    'Return_URL',
    'Expires_At',
    'Used_At',
    'Created_At'
  ]);
}

function getCertificateRegistrySheet_(spreadsheet) {
  return getOrCreateSheet_(spreadsheet, 'Certificates', [
    'Certificate_ID',
    'User_ID',
    'User_Name',
    'Course_ID',
    'Course_Title',
    'Completion_Date',
    'Issued_At',
    'PDF_URL',
    'Verification_URL'
  ]);
}

function formatDisplayDate_(value) {
  if (!value) return '-';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }

  return String(value);
}

function formatDisplayDateTime_(value) {
  if (!value) return '-';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }

  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  }

  return String(value);
}

function generateCertificateId_() {
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMddHHmmss');
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return 'CERT-' + stamp + '-' + randomPart;
}

function buildCertificateVerifyUrl_(certId) {
  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) {
    throw new Error('ยังไม่พบ URL ของ Web App กรุณา Deploy Web App ล่าสุดก่อนใช้งานระบบตรวจสอบใบประกาศ');
  }
  return serviceUrl + '?mode=verifyCert&id=' + encodeURIComponent(certId);
}

function findCertificateRecordById_(ws, certId) {
  const data = ws.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === certId) {
      return {
        rowIndex: i + 1,
        certId: data[i][0],
        userId: data[i][1],
        userName: data[i][2],
        courseId: data[i][3],
        courseTitle: data[i][4],
        completionDate: data[i][5],
        issuedAt: data[i][6],
        pdfUrl: data[i][7],
        verifyUrl: data[i][8]
      };
    }
  }
  return null;
}

function findCertificateRecordByUserCourse_(ws, userId, courseId) {
  const data = ws.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim() === userId && String(data[i][3] || '').trim() === courseId) {
      return {
        rowIndex: i + 1,
        certId: data[i][0],
        userId: data[i][1],
        userName: data[i][2],
        courseId: data[i][3],
        courseTitle: data[i][4],
        completionDate: data[i][5],
        issuedAt: data[i][6],
        pdfUrl: data[i][7],
        verifyUrl: data[i][8]
      };
    }
  }
  return null;
}

function upsertCertificateRecord_(ws, record) {
  const values = [[
    record.certId,
    record.userId,
    record.userName,
    record.courseId,
    record.courseTitle,
    record.completionDate,
    record.issuedAt,
    record.pdfUrl,
    record.verifyUrl
  ]];

  if (record.rowIndex) {
    ws.getRange(record.rowIndex, 1, 1, values[0].length).setValues(values);
  } else {
    ws.appendRow(values[0]);
  }
}

function buildQrCodeBlob_(text) {
  const qrUrl = 'https://quickchart.io/qr?size=300&margin=1&text=' + encodeURIComponent(text);
  const response = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) {
    throw new Error('ไม่สามารถสร้าง QR code สำหรับใบประกาศได้');
  }
  return response.getBlob().setName('certificate-qr.png');
}

function insertQrCodePlaceholders_(presentation, verifyUrl) {
  const placeholder = '{{QR_CODE}}';
  const slides = presentation.getSlides();
  const qrBlob = buildQrCodeBlob_(verifyUrl);

  slides.forEach(function(slide) {
    const elements = slide.getPageElements();
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      if (element.getPageElementType() !== SlidesApp.PageElementType.SHAPE) continue;

      const shape = element.asShape();
      const textRange = shape.getText();
      if (!textRange) continue;

      const rawText = textRange.asString();
      if (rawText.indexOf(placeholder) === -1) continue;

      const left = element.getLeft();
      const top = element.getTop();
      const width = element.getWidth();
      const height = element.getHeight();

      if (rawText.trim() === placeholder) {
        element.remove();
      } else {
        textRange.replaceAllText(placeholder, '');
      }

      slide.insertImage(qrBlob.copyBlob(), left, top, width, height);
    }
  });
}

function buildCertificateVerificationPage_(sheet, certId) {
  const ws = getCertificateRegistrySheet_(sheet);
  const record = findCertificateRecordById_(ws, certId);
  const checkedAt = formatDisplayDateTime_(new Date());

  if (!record) {
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate Verification</title>
  <style>
    body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#fff7ed,#f8fafc);margin:0;padding:24px;color:#1f2937}
    .card{max-width:760px;margin:32px auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
    .status{display:inline-block;padding:8px 14px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:700;margin-bottom:18px}
    h1{margin:0 0 10px;color:#7c2d12}
    p{line-height:1.7;margin:0 0 12px}
    .muted{color:#64748b}
  </style>
</head>
<body>
  <div class="card">
    <div class="status">ไม่พบข้อมูลใบประกาศ</div>
    <h1>Certificate ID นี้ยังตรวจสอบไม่ได้</h1>
    <p>ไม่พบข้อมูลสำหรับรหัส <strong>${escapeHtml_(certId)}</strong> ในทะเบียนใบประกาศของระบบ</p>
    <p class="muted">เวลาตรวจสอบ: ${escapeHtml_(checkedAt)}</p>
  </div>
</body>
</html>`;
  }

  const pdfLink = record.pdfUrl
    ? `<a href="${escapeHtml_(record.pdfUrl)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:18px;background:#0f172a;color:#fff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">เปิดใบประกาศ PDF</a>`
    : '';

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Certificate Verification</title>
  <style>
    body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#eff6ff,#f8fafc);margin:0;padding:24px;color:#1f2937}
    .card{max-width:760px;margin:32px auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 18px 45px rgba(15,23,42,.12)}
    .status{display:inline-block;padding:8px 14px;border-radius:999px;background:#dcfce7;color:#166534;font-weight:700;margin-bottom:18px}
    h1{margin:0 0 20px;color:#0f172a}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px}
    .item{padding:16px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc}
    .label{display:block;color:#64748b;font-size:13px;margin-bottom:6px}
    .value{font-size:16px;font-weight:700;color:#0f172a;word-break:break-word}
    .muted{margin-top:18px;color:#64748b}
  </style>
</head>
<body>
  <div class="card">
    <div class="status">ใบประกาศนี้ตรวจสอบได้และมีข้อมูลในระบบ</div>
    <h1>ผลการตรวจสอบใบประกาศ</h1>
    <div class="grid">
      <div class="item"><span class="label">Certificate ID</span><span class="value">${escapeHtml_(record.certId)}</span></div>
      <div class="item"><span class="label">ชื่อผู้ผ่านการอบรม</span><span class="value">${escapeHtml_(record.userName || '-')}</span></div>
      <div class="item"><span class="label">หลักสูตร</span><span class="value">${escapeHtml_(record.courseTitle || '-')}</span></div>
      <div class="item"><span class="label">วันที่ผ่านการอบรม</span><span class="value">${escapeHtml_(formatDisplayDate_(record.completionDate))}</span></div>
      <div class="item"><span class="label">วันที่ออกใบประกาศ</span><span class="value">${escapeHtml_(formatDisplayDateTime_(record.issuedAt))}</span></div>
      <div class="item"><span class="label">ลิงก์ตรวจสอบ</span><span class="value">${escapeHtml_(record.verifyUrl || '-')}</span></div>
    </div>
    ${pdfLink}
    <p class="muted">เวลาตรวจสอบล่าสุด: ${escapeHtml_(checkedAt)}</p>
  </div>
</body>
</html>`;
}

function hashString_(value) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value || ''));
  return digest.map(function(byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function isValidHttpUrl_(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

function escapeHtml_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function invalidateExistingResetTokensForEmail_(ws, email) {
  const data = ws.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (normalizeEmail_(data[i][2]) === email && !data[i][5]) {
      ws.getRange(i + 1, 6).setValue(new Date());
    }
  }
}

function getPasswordResetRecord_(sheet, token) {
  const ws = getPasswordResetSheet_(sheet);
  const data = ws.getDataRange().getValues();
  const hashedToken = hashString_(token);
  const now = new Date();

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0] || '') !== hashedToken) continue;

    const expiresAt = data[i][4] instanceof Date ? data[i][4] : new Date(data[i][4]);
    if (data[i][5]) {
      return { valid: false, message: 'ลิงก์นี้ถูกใช้งานแล้ว' };
    }
    if (!(expiresAt instanceof Date) || isNaN(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
      return { valid: false, message: 'ลิงก์หมดอายุหรือไม่ถูกต้อง กรุณาขอรีเซ็ตรหัสผ่านใหม่' };
    }

    return {
      valid: true,
      ws: ws,
      rowIndex: i + 1,
      userId: data[i][1],
      email: data[i][2],
      returnUrl: data[i][3] || ''
    };
  }

  return { valid: false, message: 'ไม่พบลิงก์รีเซ็ตรหัสผ่าน หรือข้อมูลไม่ถูกต้อง' };
}

function buildPasswordResetUrl_(token, returnUrl) {
  const serviceUrl = ScriptApp.getService().getUrl();
  if (!serviceUrl) throw new Error('ยังไม่พบ URL ของ Web App กรุณา Deploy Web App ล่าสุดก่อนใช้งานระบบรีเซ็ตรหัสผ่าน');

  let url = serviceUrl + '?mode=reset&token=' + encodeURIComponent(token);
  if (isValidHttpUrl_(returnUrl)) {
    url += '&returnUrl=' + encodeURIComponent(returnUrl);
  }
  return url;
}

function buildResetPasswordPage_(sheet, token, returnUrl) {
  const resetRecord = getPasswordResetRecord_(sheet, token);
  const effectiveReturnUrl = isValidHttpUrl_(returnUrl) ? returnUrl : resetRecord.returnUrl;
  const safeReturnLink = isValidHttpUrl_(effectiveReturnUrl)
    ? '<a class="secondary-link" href="' + escapeHtml_(effectiveReturnUrl) + '">กลับไปหน้าเข้าสู่ระบบ</a>'
    : '';
  const tokenJson = JSON.stringify(token);
  const apiUrlJson = JSON.stringify(ScriptApp.getService().getUrl() || '');

  if (!resetRecord.valid) {
    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password</title>
  <style>
    body{font-family:Arial,sans-serif;background:#f4f7f6;margin:0;padding:24px;color:#1f2937}
    .card{max-width:480px;margin:48px auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 10px 30px rgba(15,23,42,.12)}
    h1{margin:0 0 12px;color:#0f172a;font-size:26px}
    .message{margin:0 0 18px;line-height:1.7}
    .secondary-link{color:#1d4ed8;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <h1>ลิงก์ไม่พร้อมใช้งาน</h1>
    <p class="message">${escapeHtml_(resetRecord.message)}</p>
    ${safeReturnLink}
  </div>
</body>
</html>`;
  }

  return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Password</title>
  <style>
    body{font-family:Arial,sans-serif;background:linear-gradient(135deg,#eff6ff,#f8fafc);margin:0;padding:24px;color:#1f2937}
    .card{max-width:480px;margin:48px auto;background:#fff;border-radius:18px;padding:32px;box-shadow:0 18px 45px rgba(15,23,42,.16)}
    h1{margin:0 0 10px;color:#0f172a;font-size:28px}
    .sub{margin:0 0 24px;color:#64748b;line-height:1.7}
    .field{margin-bottom:16px}
    .field label{display:block;margin-bottom:8px;font-weight:600}
    .password-wrap{position:relative}
    .password-wrap input{width:100%;box-sizing:border-box;padding:12px 72px 12px 12px;border:1px solid #cbd5e1;border-radius:10px;font-size:16px}
    .password-toggle{position:absolute;right:12px;top:50%;transform:translateY(-50%);border:none;background:transparent;color:#1d4ed8;font-weight:700;cursor:pointer}
    .primary-btn{width:100%;border:none;background:#0f172a;color:#fff;padding:12px 16px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:10px}
    .primary-btn:hover{background:#1d4ed8}
    .primary-btn:disabled{opacity:.75;cursor:not-allowed}
    .btn-spinner{width:16px;height:16px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;display:none;animation:spin .8s linear infinite}
    .primary-btn.is-loading .btn-spinner{display:inline-block}
    .primary-btn.is-loading .btn-label{opacity:.95}
    @keyframes spin{to{transform:rotate(360deg)}}
    .message{margin-top:16px;padding:12px 14px;border-radius:10px;display:none;line-height:1.6}
    .message.show{display:block}
    .message.success{background:#dcfce7;color:#166534}
    .message.error{background:#fee2e2;color:#991b1b}
    .secondary-link{display:inline-block;margin-top:18px;color:#1d4ed8;text-decoration:none;font-weight:600}
  </style>
</head>
<body>
  <div class="card">
    <h1>ตั้งรหัสผ่านใหม่</h1>
    <p class="sub">กรอกรหัสผ่านใหม่และยืนยันรหัสผ่านอีกครั้ง จากนั้นกดบันทึกเพื่อกลับไปใช้งานบัญชีเดิมได้ทันที</p>
    <form id="resetForm">
      <div class="field">
        <label for="newPassword">รหัสผ่านใหม่</label>
        <div class="password-wrap">
          <input type="password" id="newPassword" required>
          <button type="button" class="password-toggle" onclick="togglePassword('newPassword', this)">แสดง</button>
        </div>
      </div>
      <div class="field">
        <label for="confirmPassword">ยืนยันรหัสผ่านใหม่</label>
        <div class="password-wrap">
          <input type="password" id="confirmPassword" required>
          <button type="button" class="password-toggle" onclick="togglePassword('confirmPassword', this)">แสดง</button>
        </div>
      </div>
      <button type="submit" class="primary-btn" id="resetSubmitBtn">
        <span class="btn-spinner" aria-hidden="true"></span>
        <span class="btn-label">บันทึกรหัสผ่านใหม่</span>
      </button>
    </form>
    <div id="statusBox" class="message"></div>
    ${safeReturnLink}
  </div>
  <script>
    const TOKEN = ${tokenJson};
    const API_URL = ${apiUrlJson};

    function togglePassword(id, btn) {
      const input = document.getElementById(id);
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.textContent = isPassword ? 'ซ่อน' : 'แสดง';
    }

    function showStatus(message, type) {
      const box = document.getElementById('statusBox');
      box.textContent = message;
      box.className = 'message show ' + type;
    }

    function setSubmitLoading(isLoading) {
      const submitBtn = document.getElementById('resetSubmitBtn');
      const label = submitBtn ? submitBtn.querySelector('.btn-label') : null;
      if (!submitBtn || !label) return;
      submitBtn.disabled = isLoading;
      submitBtn.classList.toggle('is-loading', isLoading);
      label.textContent = isLoading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่';
    }

    document.getElementById('resetForm').addEventListener('submit', async function(event) {
      event.preventDefault();
      const newPassword = document.getElementById('newPassword').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (newPassword !== confirmPassword) {
        showStatus('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน', 'error');
        return;
      }

      if (!newPassword) {
        showStatus('กรุณากรอกรหัสผ่านใหม่', 'error');
        return;
      }

      if (!API_URL) {
        showStatus('ยังไม่พบ URL ของ Web App กรุณา Deploy ระบบใหม่อีกครั้ง', 'error');
        return;
      }

      setSubmitLoading(true);
      try {
        const response = await fetch(API_URL, {
          method: 'POST',
          body: JSON.stringify({
            action: 'resetPasswordWithToken',
            payload: { token: TOKEN, password: newPassword }
          })
        });

        const rawText = await response.text();
        let result;

        try {
          result = JSON.parse(rawText);
        } catch (parseError) {
          const looksLikeHtml = /^\s*</.test(rawText);
          throw new Error(
            looksLikeHtml
              ? 'ระบบตอบกลับเป็นหน้าเว็บแทน JSON กรุณา Deploy Web App ล่าสุดแล้วลองใหม่อีกครั้ง'
              : 'ระบบตอบกลับข้อมูลไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง'
          );
        }

        showStatus(
          result.message || 'ไม่สามารถบันทึกรหัสผ่านใหม่ได้',
          result.status === 'success' ? 'success' : 'error'
        );

        if (result.status === 'success') {
          document.getElementById('resetForm').reset();
        }
      } catch (error) {
        showStatus(error.message || 'ไม่สามารถเชื่อมต่อระบบตั้งรหัสผ่านใหม่ได้', 'error');
      } finally {
        setSubmitLoading(false);
      }
    });
  </script>
</body>
</html>`;
}
function parseBooleanFlag_(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'y' || normalized === 'mandatory' || normalized === 'required';
}

function normalizeCourseDeliveryType_(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  if (normalized === 'classroom' || normalized === 'offline' || normalized === 'inperson') return 'classroom';
  return 'video';
}

function normalizeCourseAudience_(value) {
  const normalized = String(value == null ? '' : value).trim().toLowerCase();
  if (normalized === 'professional' || normalized === 'prof' || normalized === 'nurse') return 'professional';
  if (normalized === 'support') return 'support';
  return 'all';
}

function normalizeMandatoryGroups_(value, audience, isMandatory) {
  let values = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      values = Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      values = value.split(',');
    }
  } else if (value) {
    values = [value];
  }

  const normalizedValues = values
    .map(normalizeCourseAudience_)
    .filter(function(group) { return group === 'professional' || group === 'support'; })
    .filter(function(group, index, source) { return source.indexOf(group) === index; });

  if (normalizedValues.length > 0) return normalizedValues;
  if (!isMandatory) return [];

  const normalizedAudience = normalizeCourseAudience_(audience);
  if (normalizedAudience === 'professional' || normalizedAudience === 'support') {
    return [normalizedAudience];
  }
  return ['professional', 'support'];
}

function serializeMandatoryGroups_(groups, audience, isMandatory) {
  return JSON.stringify(normalizeMandatoryGroups_(groups, audience, isMandatory));
}

function classifyPositionGroup_(position) {
  const normalized = String(position == null ? '' : position).trim();
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

function courseMatchesPositionGroup_(course, positionGroup) {
  const audience = normalizeCourseAudience_(course && course.audience);
  return audience === 'all' || audience === positionGroup;
}

function mandatoryItemMatchesPositionGroup_(item, positionGroup) {
  return normalizeMandatoryGroups_(item && item.mandatory_groups, item && item.audience, item && item.is_mandatory)
    .indexOf(positionGroup) !== -1;
}

function buildCourseRecord_(row) {
  const audience = normalizeCourseAudience_(row[12]);
  const isMandatory = parseBooleanFlag_(row[13]);
  return {
    id: row[0],
    title: row[1],
    image: row[2],
    units: row[3] || '[]',
    total_min_time: parseFloat(row[4]) || 0,
    passing_score: parseFloat(row[5]) || 80,
    organizer: row[6] || '',
    hours: parseFloat(row[7]) || 0,
    enrolled: row[8],
    status: row[9] || 'active',
    cert_template: row[10] || '',
    delivery_type: normalizeCourseDeliveryType_(row[11]),
    audience: audience,
    is_mandatory: isMandatory,
    note: row[14] || '',
    mandatory_groups: normalizeMandatoryGroups_(row[15], audience, isMandatory),
    mou_score: parseFloat(row[16]) || 0
  };
}

function buildExternalRecommendationRecord_(row) {
  const audience = normalizeCourseAudience_(row[8]);
  const mandatoryGroups = normalizeMandatoryGroups_(row[9], audience, false);
  return {
    rec_id: row[0],
    title: row[1],
    organizer: row[2],
    hours: parseFloat(row[3]) || 0,
    cover_image: row[4],
    register_url: row[5],
    status: row[6] || 'active',
    created_at: row[7] || '',
    audience: audience,
    mandatory_groups: mandatoryGroups,
    is_mandatory: mandatoryGroups.length > 0
  };
}

function buildLookupKey_(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

// ดึงหน่วยงาน
function getSettings(sheet) {
  const orgWsName = sheet.getSheetByName('ชื่อหน่วยงาน') ? 'ชื่อหน่วยงาน' : 'OrganizationStructure';
  const orgDataRaw = getSheetDataCached(sheet, orgWsName);
  let orgData = [];
  for (let i = 1; i < orgDataRaw.length; i++) {
    const group = String(orgDataRaw[i][0] || '').trim();
    const dept = String(orgDataRaw[i][1] || '').trim();
    if (group || dept) {
      orgData.push({ working_group: group, department: dept });
    }
  }

  const settingsRaw = getSheetDataCached(sheet, 'Settings');
  let mScore = 0;
  for (let i = 1; i < settingsRaw.length; i++) {
    if (String(settingsRaw[i][0]).trim() === 'MOU_Score_Default') {
      mScore = parseFloat(settingsRaw[i][1]) || 0;
    }
  }

  return responseJSON({ 
    status: 'success', 
    org_structure: orgData,
    mou_score_default: mScore
  });
}

// อัปโหลดไฟล์
function uploadFile(sheet, payload) {
  try {
    const FOLDER_ID = '19Htb9AjawXDOzje5yVeyT_i7mkYh-k45'; 
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const contentType = payload.fileData.substring(payload.fileData.indexOf(":")+1, payload.fileData.indexOf(";"));
    const base64Data = payload.fileData.split(',')[1];
    const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, payload.fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return responseJSON({ status: 'success', url: `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w800` });
  } catch(e) { return responseJSON({ status: 'error', message: e.toString() }); }
}

function registerUser(sheet, payload) {
  const ws = sheet.getSheetByName('Users');
  const data = getSheetDataCached(sheet, 'Users');
  const fullName = String(payload.name == null ? '' : payload.name).trim();
  const normalizedName = normalizeFullName_(fullName);
  const username = normalizeUsername_(payload.username);
  const password = normalizePassword_(payload.password);
  const email = normalizeEmail_(payload.email);
  const workingGroup = String(payload.working_group || '').trim();
  const dept = String(payload.department || '').trim();

  if (!fullName || !payload.position || !workingGroup || !username || !email || !password) {
    return responseJSON({ status: 'error', message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
  }

  if (isDuplicateUserField_(data, 1, normalizedName)) {
    return responseJSON({ status: 'error', message: 'ชื่อ-นามสกุลนี้เคยลงทะเบียนแล้ว กรุณาตรวจสอบหรือใช้เมนูลืมชื่อผู้ใช้ / ลืมรหัสผ่าน' });
  }
  if (isDuplicateUserField_(data, 5, username)) {
    return responseJSON({ status: 'error', message: 'ชื่อผู้ใช้นี้ (Username) มีคนใช้แล้ว' });
  }
  if (isDuplicateUserField_(data, 6, email)) {
    return responseJSON({ status: 'error', message: 'อีเมลนี้ถูกใช้งานแล้ว กรุณาใช้อีเมลอื่นหรือกดลืมรหัสผ่าน' });
  }

  const userId = 'USR' + new Date().getTime();
  const rowIndex = ws.getLastRow() + 1;
  ws.getRange(rowIndex, 1, 1, 12).setValues([[userId, fullName, payload.position, dept, workingGroup, '', '', '', 'user', 0, '', new Date()]]);
  writeUserCredentialCells_(ws, rowIndex, username, email, password);
  clearSheetCache('Users');
  return responseJSON({ status: 'success', message: 'ลงทะเบียนสำเร็จ' });
}

function loginUser(sheet, payload) {
  const ws = sheet.getSheetByName('Users');
  const data = getSheetDataCached(sheet, 'Users');
  const identifier = normalizeLoginIdentifier_(payload.username);
  const password = normalizePassword_(payload.password);

  for (let i = 1; i < data.length; i++) {
    const sheetUsername = normalizeUsername_(data[i][5]);
    const sheetEmail = normalizeEmail_(data[i][6]);
    const sheetPassword = normalizePassword_(data[i][7]);
    const isIdentifierMatched = sheetUsername.toLowerCase() === identifier || sheetEmail === identifier;
    if (isIdentifierMatched && sheetPassword === password) {
      writeUserCredentialCells_(ws, i + 1, data[i][5], data[i][6], password);
      const userPermissions = getUserPermissions_(sheet, data[i][0]);
      return responseJSON({ 
        status: 'success', 
        user: { 
          id: data[i][0], 
          name: data[i][1], 
          position: data[i][2], 
          department: data[i][3] || '', 
          working_group: data[i][4] || '',
          username: data[i][5], 
          role: data[i][8], 
          profile_img: data[i][10],
          permissions: userPermissions
        }
      });
    }
  }
  return responseJSON({ status: 'error', message: 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง' });
}

function updateUserProfile(sheet, payload) {
  const ws = sheet.getSheetByName('Users');
  const data = getSheetDataCached(sheet, 'Users');
  const fullName = String(payload.name == null ? '' : payload.name).trim();
  const normalizedName = normalizeFullName_(fullName);
  const workingGroup = String(payload.working_group || '').trim();
  const dept = String(payload.department || '').trim();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.user_id) {
      if (isDuplicateUserField_(data, 1, normalizedName, payload.user_id)) {
        return responseJSON({ status: 'error', message: 'ชื่อ-นามสกุลนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบก่อนบันทึก' });
      }
      ws.getRange(i+1, 2).setValue(fullName);
      ws.getRange(i+1, 3).setValue(payload.position);
      ws.getRange(i+1, 4).setValue(dept);
      ws.getRange(i+1, 5).setValue(workingGroup);
      if(payload.password) setPlainTextCell_(ws.getRange(i+1, 8), normalizePassword_(payload.password));
      if(payload.profile_img) ws.getRange(i+1, 11).setValue(payload.profile_img);
      clearSheetCache('Users');
      return responseJSON({ status: 'success', message: 'อัปเดตข้อมูลสำเร็จ' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบผู้ใช้' });
}

function requestPasswordReset(sheet, payload) {
  const email = normalizeEmail_(payload && payload.email);
  const genericMessage = 'หากอีเมลนี้มีอยู่ในระบบ เราจะส่งชื่อผู้ใช้และลิงก์รีเซ็ตรหัสผ่านไปยังอีเมลที่ลงทะเบียนไว้';
  if (!email) {
    return responseJSON({ status: 'error', message: 'กรุณาระบุอีเมลที่ลงทะเบียนไว้' });
  }

  const wsUsers = sheet.getSheetByName('Users');
  const userData = wsUsers.getDataRange().getValues();
  const matchedUser = findUserRowByEmail_(userData, email);
  if (!matchedUser) {
    return responseJSON({ status: 'success', message: genericMessage });
  }

  const resetWs = getPasswordResetSheet_(sheet);
  invalidateExistingResetTokensForEmail_(resetWs, email);

  try {
    const rawToken = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000));
    const returnUrl = String(payload && payload.app_url ? payload.app_url : '').trim();
    resetWs.appendRow([hashString_(rawToken), matchedUser.row[0], email, returnUrl, expiresAt, '', new Date()]);

    const resetUrl = buildPasswordResetUrl_(rawToken, returnUrl);
    const safeName = escapeHtml_(matchedUser.row[1] || 'ผู้ใช้งาน');
    const safeUsername = escapeHtml_(matchedUser.row[5] || '-');
    MailApp.sendEmail({
      to: email,
      subject: 'ข้อมูลกู้บัญชี - Learning SWD',
      htmlBody: '<div style="font-family:Arial,sans-serif;line-height:1.7;color:#1f2937"><h2 style="color:#0f172a">ลืมชื่อผู้ใช้ / ลืมรหัสผ่าน</h2><p>เรียน ' + safeName + '</p><p>ชื่อผู้ใช้ของคุณคือ <strong>' + safeUsername + '</strong></p><p>หากต้องการตั้งรหัสผ่านใหม่ กรุณากดปุ่มด้านล่าง ลิงก์นี้มีอายุ 1 ชั่วโมง</p><p><a href="' + escapeHtml_(resetUrl) + '" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:700">ตั้งรหัสผ่านใหม่</a></p><p>หากคุณไม่ได้เป็นผู้ร้องขอ สามารถละเว้นอีเมลฉบับนี้ได้ทันที</p></div>'
    });
  } catch (error) {
    return responseJSON({ status: 'error', message: 'ไม่สามารถส่งอีเมลรีเซ็ตรหัสผ่านได้: ' + error.toString() });
  }

  return responseJSON({ status: 'success', message: genericMessage });
}

function resetPasswordWithToken(sheet, payload) {
  const token = String(payload && payload.token ? payload.token : '').trim();
  const password = normalizePassword_(payload && payload.password);
  if (!token || !password) {
    return responseJSON({ status: 'error', message: 'ข้อมูลสำหรับตั้งรหัสผ่านใหม่ไม่ครบถ้วน' });
  }

  const resetRecord = getPasswordResetRecord_(sheet, token);
  if (!resetRecord.valid) {
    return responseJSON({ status: 'error', message: resetRecord.message });
  }

  const wsUsers = sheet.getSheetByName('Users');
  const userData = wsUsers.getDataRange().getValues();
  for (let i = 1; i < userData.length; i++) {
    if (userData[i][0] === resetRecord.userId) {
      setPlainTextCell_(wsUsers.getRange(i + 1, 8), password);
      resetRecord.ws.getRange(resetRecord.rowIndex, 6).setValue(new Date());
      return responseJSON({ status: 'success', message: 'บันทึกรหัสผ่านใหม่เรียบร้อยแล้ว สามารถกลับไปเข้าสู่ระบบได้ทันที' });
    }
  }

  return responseJSON({ status: 'error', message: 'ไม่พบบัญชีผู้ใช้สำหรับลิงก์นี้ กรุณาติดต่อผู้ดูแลระบบ' });
}
// คำนวณสถิติสำหรับ Dashboard
function getDashboardStats(sheet, payload) {
  const uId = payload.user_id;
  const enrollData = sheet.getSheetByName('Enrollments').getDataRange().getValues();
  const extData = getExternalTrainingSheet_(sheet).getDataRange().getValues();
  const courseData = getCoursesSheet_(sheet).getDataRange().getValues();
  
  let courseMap = {};
  for(let i=1; i<courseData.length; i++) courseMap[courseData[i][0]] = parseFloat(courseData[i][7]) || 0;

  let inProgress = 0, certCount = 0, totalHours = 0;

  for(let i=1; i<enrollData.length; i++) {
    if(enrollData[i][1] === uId) {
      if(enrollData[i][5] === 'pending') inProgress++;
      if(enrollData[i][5] === 'completed') {
        certCount++;
        totalHours += courseMap[enrollData[i][2]] || 0;
      }
    }
  }
  for(let j=1; j<extData.length; j++) {
    if(extData[j][1] === uId && extData[j][7] === 'approved') {
      totalHours += parseFloat(extData[j][5]) || 0;
    }
  }
  
  // อัปเดตค่าที่ normalize แล้วกลับไปยังชีต Users
  const wsUser = sheet.getSheetByName('Users');
  const uData = wsUser.getDataRange().getValues();
  for(let k=1; k<uData.length; k++) {
    if(uData[k][0] === uId) { wsUser.getRange(k+1, 10).setValue(totalHours); break; }
  }

  return responseJSON({ status: 'success', stats: { inProgress, certCount, totalHours: totalHours.toFixed(2) } });
}

function loadInitialData(sheet, payload) {
  const uId = payload.user_id;
  
  // 1. Get cached Courses
  const coursesData = getSheetDataCached(sheet, 'Courses');
  const courses = [];
  for (let i = 1; i < coursesData.length; i++) {
    const course = buildCourseRecord_(coursesData[i]);
    if (course.id !== "" && course.status === 'active') {
      courses.push({
        id: course.id,
        title: course.title,
        image: course.image,
        units: course.units,
        passing_score: course.passing_score,
        organizer: course.organizer,
        hours: course.hours,
        enrolled: course.enrolled,
        delivery_type: course.delivery_type,
        audience: course.audience,
        is_mandatory: course.is_mandatory,
        mandatory_groups: course.mandatory_groups,
        note: course.note
      });
    }
  }

  // 2. Get enrollments for the user
  const enrollData = sheet.getSheetByName('Enrollments').getDataRange().getValues();
  const enrollments = [];
  let courseMap = {};
  for (let i = 1; i < coursesData.length; i++) {
    courseMap[coursesData[i][0]] = parseFloat(coursesData[i][7]) || 0;
  }
  
  let inProgress = 0;
  let certCount = 0;
  let totalHours = 0;

  for (let i = 1; i < enrollData.length; i++) {
    if (enrollData[i][1] === uId) {
      const status = enrollData[i][5];
      enrollments.push({
        course_id: enrollData[i][2],
        status: status,
        progress: enrollData[i][3],
        cert_url: enrollData[i][7]
      });
      if (status === 'pending') inProgress++;
      if (status === 'completed') {
        certCount++;
        totalHours += courseMap[enrollData[i][2]] || 0;
      }
    }
  }

  // 3. Get external training for user
  const extData = getExternalTrainingSheet_(sheet).getDataRange().getValues();
  for (let j = 1; j < extData.length; j++) {
    if (extData[j][1] === uId && extData[j][7] === 'approved') {
      totalHours += parseFloat(extData[j][5]) || 0;
    }
  }

  // 4. Get User Profile and update totalHours in Users sheet if changed
  const wsUser = sheet.getSheetByName('Users');
  const uData = getSheetDataCached(sheet, 'Users');
  let userProfile = null;
  for (let k = 1; k < uData.length; k++) {
    if (uData[k][0] === uId) {
      const currentHoursInSheet = parseFloat(uData[k][9]) || 0;
      if (Math.abs(currentHoursInSheet - totalHours) > 0.01) {
        wsUser.getRange(k + 1, 10).setValue(totalHours);
        clearSheetCache('Users');
      }
      userProfile = {
        id: uData[k][0],
        name: uData[k][1],
        position: uData[k][2],
        department: uData[k][3] || '',
        working_group: uData[k][4] || '',
        username: uData[k][5],
        role: uData[k][8],
        profile_img: uData[k][10],
        permissions: getUserPermissions_(sheet, uId)
      };
      break;
    }
  }

  // 5. Get external recommendations
  const extRecData = getSheetDataCached(sheet, 'External_Course_Recommendations');
  const recommendations = [];
  for (let i = 1; i < extRecData.length; i++) {
    const rec = buildExternalRecommendationRecord_(extRecData[i]);
    if (rec.rec_id && rec.status === 'active') {
      recommendations.push(rec);
    }
  }

  // 6. Get settings/org structure
  const orgData = [];
  const orgWsName = sheet.getSheetByName('ชื่อหน่วยงาน') ? 'ชื่อหน่วยงาน' : 'OrganizationStructure';
  const orgDataRaw = getSheetDataCached(sheet, orgWsName);
  for (let i = 1; i < orgDataRaw.length; i++) {
    const group = String(orgDataRaw[i][0] || '').trim();
    const dept = String(orgDataRaw[i][1] || '').trim();
    if (group || dept) {
      orgData.push({ working_group: group, department: dept });
    }
  }

  const settingsRaw = getSheetDataCached(sheet, 'Settings');
  let mScore = 0;
  for (let i = 1; i < settingsRaw.length; i++) {
    if (String(settingsRaw[i][0]).trim() === 'MOU_Score_Default') {
      mScore = parseFloat(settingsRaw[i][1]) || 0;
    }
  }

  return responseJSON({
    status: 'success',
    user: userProfile,
    courses: courses,
    enrollments: enrollments,
    stats: {
      inProgress: inProgress,
      certCount: certCount,
      totalHours: totalHours.toFixed(2)
    },
    externalRecommendations: recommendations,
    org_structure: orgData,
    mou_score_default: mScore
  });
}

function getCourses(sheet) {
  const data = getSheetDataCached(sheet, 'Courses');
  const courses = [];
  
  for (let i = 1; i < data.length; i++) {
    const course = buildCourseRecord_(data[i]);
    if(course.id !== "" && course.status === 'active') { // ดึงเฉพาะคอร์สที่ active
      courses.push({
        id: course.id,
        title: course.title,
        image: course.image,
        units: course.units,
        passing_score: course.passing_score,
        organizer: course.organizer,
        hours: course.hours,
        enrolled: course.enrolled,
        delivery_type: course.delivery_type,
        audience: course.audience,
        is_mandatory: course.is_mandatory,
        mandatory_groups: course.mandatory_groups,
        note: course.note
      });
    }
  }
  return responseJSON({ status: 'success', data: courses });
}

function getExternalRecommendations(sheet, payload) {
  const data = getSheetDataCached(sheet, 'External_Course_Recommendations');
  const adminView = payload && payload.admin_view === true;
  const recommendations = [];

  for (let i = 1; i < data.length; i++) {
    const recommendation = buildExternalRecommendationRecord_(data[i]);
    if (!recommendation.rec_id) continue;

    const status = recommendation.status || 'active';
    if (status === 'deleted') continue;
    if (!adminView && status !== 'active') continue;

    recommendations.push(recommendation);
  }

  return responseJSON({ status: 'success', data: recommendations });
}
// --- กลุ่ม Admin API ---

// 1. ดึงรายงานสถิติภาพรวม (คำนวณเกณฑ์ 10 วัน/ปี)
function getAdminReport(sheet, payload) {
  const requestingUserId = payload && payload.user_id;
  let requestingRole = 'user';
  let allowedTargets = [];
  
  if (requestingUserId) {
    const uData = getSheetDataCached(sheet, 'Users');
    for (let i = 1; i < uData.length; i++) {
      if (uData[i][0] === requestingUserId) {
        requestingRole = uData[i][8];
        break;
      }
    }
    allowedTargets = getUserPermissions_(sheet, requestingUserId);
  }

  const usersData = getSheetDataCached(sheet, 'Users');
  const enrollData = sheet.getSheetByName('Enrollments').getDataRange().getValues();
  const extData = getExternalTrainingSheet_(sheet).getDataRange().getValues();
  const coursesData = getSheetDataCached(sheet, 'Courses');
  const externalRecommendationData = getSheetDataCached(sheet, 'External_Course_Recommendations');
  
  let courseMap = {};
  let externalRecommendationMap = {};
  let mandatoryItemsByGroup = { professional: [], support: [] };

  for (let i = 1; i < coursesData.length; i++) {
    const course = buildCourseRecord_(coursesData[i]);
    if (!course.id) continue;
    courseMap[course.id] = course;

    if (course.status === 'active' && course.is_mandatory) {
      ['professional', 'support'].forEach(function(group) {
        if (mandatoryItemMatchesPositionGroup_(course, group)) {
          mandatoryItemsByGroup[group].push({
            item_id: 'course:' + course.id,
            source: 'course',
            source_id: course.id,
            title: course.title
          });
        }
      });
    }
  }

  for (let i = 1; i < externalRecommendationData.length; i++) {
    const recommendation = buildExternalRecommendationRecord_(externalRecommendationData[i]);
    if (!recommendation.rec_id) continue;
    externalRecommendationMap[recommendation.rec_id] = recommendation;

    if (recommendation.status === 'active' && recommendation.is_mandatory) {
      ['professional', 'support'].forEach(function(group) {
        if (mandatoryItemMatchesPositionGroup_(recommendation, group)) {
          mandatoryItemsByGroup[group].push({
            item_id: 'external:' + recommendation.rec_id,
            source: 'external',
            source_id: recommendation.rec_id,
            title: recommendation.title,
            organizer: recommendation.organizer
          });
        }
      });
    }
  }
  
  let reportList = [];
  
  for (let i = 1; i < usersData.length; i++) {
    let uId = usersData[i][0];
    let uName = usersData[i][1];
    let uPosition = usersData[i][2];
    let uDept = usersData[i][3]; 
    let uWorkGroup = usersData[i][4];
    let positionGroup = classifyPositionGroup_(uPosition);

    if (!uId || isAdminDepartment_(uDept)) continue;

    // Filter by supervisor role
    if (requestingRole !== 'admin') {
      if (requestingRole === 'working_group_leader') {
        if (allowedTargets.indexOf(uWorkGroup) === -1) continue;
      } else if (requestingRole === 'department_leader') {
        if (allowedTargets.indexOf(uDept) === -1) continue;
      } else {
        continue;
      }
    }
    
    let tInt = 0, tExt = 0;
    let completedMandatoryMap = {};
    
    for (let j = 1; j < enrollData.length; j++) {
      if (enrollData[j][1] === uId && enrollData[j][5] === 'completed') {
        const completedCourse = courseMap[enrollData[j][2]];
        tInt += completedCourse ? completedCourse.hours : 0;
        if (completedCourse && mandatoryItemMatchesPositionGroup_(completedCourse, positionGroup)) {
          completedMandatoryMap['course:' + completedCourse.id] = true;
        }
      }
    }
    
    for (let k = 1; k < extData.length; k++) {
      if (extData[k][1] === uId && extData[k][7] === 'approved') {
        tExt += parseFloat(extData[k][5]) || 0;

        const recommendationId = String(extData[k][8] || '').trim();
        if (recommendationId && externalRecommendationMap[recommendationId] && mandatoryItemMatchesPositionGroup_(externalRecommendationMap[recommendationId], positionGroup)) {
          completedMandatoryMap['external:' + recommendationId] = true;
          continue;
        }

        const approvedTopicKey = buildLookupKey_(extData[k][2]);
        const approvedOrganizerKey = buildLookupKey_(extData[k][3]);
        (mandatoryItemsByGroup[positionGroup] || []).forEach(function(item) {
          if (item.source !== 'external') return;
          if (buildLookupKey_(item.title) !== approvedTopicKey) return;
          if (approvedOrganizerKey && item.organizer && buildLookupKey_(item.organizer) !== approvedOrganizerKey) return;
          completedMandatoryMap[item.item_id] = true;
        });
      }
    }
    
    let gTotal = tInt + tExt;
    let days = +(gTotal / 7).toFixed(2);
    let mandatoryItems = mandatoryItemsByGroup[positionGroup] || [];
    let mandatoryTotal = mandatoryItems.length;
    let mandatoryCompleted = mandatoryItems.filter(function(item) { return completedMandatoryMap[item.item_id]; }).length;
    let mandatoryPendingTitles = mandatoryItems
      .filter(function(item) { return !completedMandatoryMap[item.item_id]; })
      .map(function(item) { return item.title; });
    let criteriaType = positionGroup === 'professional' ? '10 วัน/ปี/คน' : 'หลักสูตรบังคับ';
    let statusCode = 'fail';
    let statusText = '';

    if (positionGroup === 'professional') {
      statusCode = days >= 10 ? 'pass' : 'fail';
      statusText = days >= 10 ? 'ผ่านเกณฑ์ 10 วัน/ปี/คน' : 'ยังไม่ผ่านเกณฑ์ 10 วัน/ปี/คน';
    } else if (mandatoryTotal === 0) {
      statusCode = 'warning';
      statusText = 'ยังไม่ได้กำหนดหลักสูตรบังคับ';
    } else {
      statusCode = mandatoryCompleted >= mandatoryTotal ? 'pass' : 'fail';
      statusText = mandatoryCompleted >= mandatoryTotal ? 'ครบหลักสูตรบังคับ' : 'ยังไม่ครบหลักสูตรบังคับ';
    }
    
    reportList.push({ 
        id: uId, 
        name: uName, 
        position: uPosition,
        department: uDept, 
        working_group: uWorkGroup || '',
        position_group: positionGroup,
        criteria_type: criteriaType,
        internal: tInt, 
        external: tExt, 
        totalHours: gTotal, 
        totalDays: days, 
        mandatory_completed: mandatoryCompleted,
        mandatory_total: mandatoryTotal,
        mandatory_pending_titles: mandatoryPendingTitles,
        status: statusText,
        status_code: statusCode,
        is_passed: statusCode === 'pass'
    });
  }
  
  return responseJSON({ status: 'success', data: reportList });
}

// 2. จัดการหลักสูตร (Course Management)
function addCourse(sheet, payload) {
  const ws = getCoursesSheet_(sheet);
  const courseId = 'CRS' + new Date().getTime();
  const units = Array.isArray(payload.units) ? payload.units : [];
  const unitsJsonString = JSON.stringify(units);
  const deliveryType = normalizeCourseDeliveryType_(payload.delivery_type);
  const audience = normalizeCourseAudience_(payload.audience);
  const isMandatory = payload.is_mandatory === true || parseBooleanFlag_(payload.is_mandatory);
  const mandatoryGroups = serializeMandatoryGroups_(payload.mandatory_groups, audience, isMandatory);
  const mouScore = parseFloat(payload.mou_score) || 0;

  let totalMinTime = 0;
  units.forEach(unit => totalMinTime += parseFloat(unit.min_time) || 0);

  ws.appendRow([
    courseId, payload.title, payload.cover_image, unitsJsonString,
    totalMinTime, (payload.passing_score || 80), payload.organizer,
    payload.hours, 0, 'active', payload.cert_template,
    deliveryType, audience, isMandatory, payload.note || '', mandatoryGroups, mouScore
  ]);
  clearSheetCache('Courses');
  return responseJSON({ status: 'success', message: 'เพิ่มหลักสูตรเรียบร้อยแล้ว' });
}

// แก้ไขหลักสูตร (Admin)
function updateCourse(sheet, payload) {
  const ws = getCoursesSheet_(sheet);
  const data = ws.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.course_id) {
      const units = Array.isArray(payload.units) ? payload.units : [];
      const unitsJsonString = JSON.stringify(units);
      let totalMinTime = 0;
      units.forEach(unit => totalMinTime += parseFloat(unit.min_time) || 0);

      ws.getRange(i+1, 2).setValue(payload.title);
      ws.getRange(i+1, 3).setValue(payload.cover_image);
      ws.getRange(i+1, 4).setValue(unitsJsonString);
      ws.getRange(i+1, 5).setValue(totalMinTime);
      ws.getRange(i+1, 6).setValue(payload.passing_score);
      ws.getRange(i+1, 7).setValue(payload.organizer);
      ws.getRange(i+1, 8).setValue(payload.hours);
      ws.getRange(i+1, 11).setValue(payload.cert_template);
      const audience = normalizeCourseAudience_(payload.audience);
      const isMandatory = payload.is_mandatory === true || parseBooleanFlag_(payload.is_mandatory);
      ws.getRange(i+1, 12).setValue(normalizeCourseDeliveryType_(payload.delivery_type));
      ws.getRange(i+1, 13).setValue(audience);
      ws.getRange(i+1, 14).setValue(isMandatory);
      ws.getRange(i+1, 15).setValue(payload.note || '');
      ws.getRange(i+1, 16).setValue(serializeMandatoryGroups_(payload.mandatory_groups, audience, isMandatory));
      ws.getRange(i+1, 17).setValue(parseFloat(payload.mou_score) || 0); // col Q: MOU_Score

      clearSheetCache('Courses');
      return responseJSON({ status: 'success', message: 'อัปเดตหลักสูตรเรียบร้อยแล้ว' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบหลักสูตรที่ต้องการแก้ไข' });
}

function updateCourseStatus(sheet, payload) {
  const ws = getCoursesSheet_(sheet);
  const data = ws.getDataRange().getValues();
  const nextStatus = String(payload.status || '').trim().toLowerCase();

  if (['active', 'inactive', 'deleted'].indexOf(nextStatus) === -1) {
    return responseJSON({ status: 'error', message: 'สถานะหลักสูตรไม่ถูกต้อง' });
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.course_id) {
      ws.getRange(i + 1, 10).setValue(nextStatus);
      clearSheetCache('Courses');
      return responseJSON({ status: 'success', message: 'อัปเดตสถานะหลักสูตรเรียบร้อยแล้ว' });
    }
  }

  return responseJSON({ status: 'error', message: 'ไม่พบหลักสูตรที่ต้องการอัปเดตสถานะ' });
}

// จัดการหลักสูตรภายนอกแนะนำ (Admin)
function addExternalRecommendation(sheet, payload) {
  const ws = getExternalRecommendationSheet_(sheet);
  const recId = 'ERC' + new Date().getTime();
  const audience = normalizeCourseAudience_(payload.audience);
  const isMandatory = payload.is_mandatory === true || parseBooleanFlag_(payload.is_mandatory);

  ws.appendRow([
    recId,
    payload.title,
    payload.organizer,
    parseFloat(payload.hours) || 0,
    payload.cover_image,
    payload.register_url,
    payload.status || 'active',
    new Date(),
    audience,
    serializeMandatoryGroups_(payload.mandatory_groups, audience, isMandatory)
  ]);

  clearSheetCache('External_Course_Recommendations');
  return responseJSON({ status: 'success', message: 'เพิ่มหลักสูตรภายนอกแนะนำเรียบร้อยแล้ว' });
}

function updateExternalRecommendation(sheet, payload) {
  const ws = getExternalRecommendationSheet_(sheet);
  const data = ws.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.rec_id) {
      const audience = normalizeCourseAudience_(payload.audience);
      const isMandatory = payload.is_mandatory === true || parseBooleanFlag_(payload.is_mandatory);
      ws.getRange(i + 1, 2).setValue(payload.title);
      ws.getRange(i + 1, 3).setValue(payload.organizer);
      ws.getRange(i + 1, 4).setValue(parseFloat(payload.hours) || 0);
      ws.getRange(i + 1, 5).setValue(payload.cover_image);
      ws.getRange(i + 1, 6).setValue(payload.register_url);
      ws.getRange(i + 1, 7).setValue(payload.status || 'active');
      ws.getRange(i + 1, 9).setValue(audience);
      ws.getRange(i + 1, 10).setValue(serializeMandatoryGroups_(payload.mandatory_groups, audience, isMandatory));
      clearSheetCache('External_Course_Recommendations');
      return responseJSON({ status: 'success', message: 'อัปเดตหลักสูตรภายนอกแนะนำเรียบร้อยแล้ว' });
    }
  }

  return responseJSON({ status: 'error', message: 'ไม่พบหลักสูตรภายนอกแนะนำที่ต้องการแก้ไข' });
}

function updateExternalRecommendationStatus(sheet, payload) {
  const ws = getExternalRecommendationSheet_(sheet);
  const data = ws.getDataRange().getValues();
  const nextStatus = String(payload.status || '').trim().toLowerCase();

  if (['active', 'inactive', 'deleted'].indexOf(nextStatus) === -1) {
    return responseJSON({ status: 'error', message: 'สถานะหลักสูตรภายนอกไม่ถูกต้อง' });
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.rec_id) {
      ws.getRange(i + 1, 7).setValue(nextStatus);
      clearSheetCache('External_Course_Recommendations');
      return responseJSON({ status: 'success', message: 'อัปเดตสถานะหลักสูตรภายนอกเรียบร้อยแล้ว' });
    }
  }

  return responseJSON({ status: 'error', message: 'ไม่พบหลักสูตรภายนอกแนะนำที่ต้องการอัปเดตสถานะ' });
}

function getAdminCourses(sheet) {
  const data = getSheetDataCached(sheet, 'Courses');
  const courses = [];

  for (let i = 1; i < data.length; i++) {
    const course = buildCourseRecord_(data[i]);
    if (course.id !== '' && course.status !== 'deleted') {
      courses.push({
        course_id: course.id,
        title: course.title,
        cover_image: course.image,
        units: course.units,
        passing_score: course.passing_score,
        organizer: course.organizer,
        hours: course.hours,
        status: course.status,
        cert_template: course.cert_template,
        delivery_type: course.delivery_type,
        audience: course.audience,
        is_mandatory: course.is_mandatory,
        mandatory_groups: course.mandatory_groups,
        note: course.note,
        mou_score: course.mou_score || 0
      });
    }
  }
  return responseJSON({ status: 'success', data: courses });
}
// --- กลุ่ม Classroom API ---
function enrollCourse(sheet, payload) {
  const ws = sheet.getSheetByName('Enrollments');
  const data = ws.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.user_id && data[i][2] === payload.course_id) {
      // ปรับโครงสร้างข้อมูลให้รองรับทั้งตอนเก่าและแบบใหม่ที่มี resumeTimes
      let progressObj = { completed: [], resumeTimes: {} };
      try {
        let parsed = JSON.parse(data[i][3]);
        if (Array.isArray(parsed)) progressObj.completed = parsed; // รองรับข้อมูลรูปแบบเดิม
        else progressObj = parsed; // รองรับโครงสร้างแบบ object
      } catch(e) {}
      
      return responseJSON({ status: 'success', data: progressObj });
    }
  }

const courseData = getCoursesSheet_(sheet).getDataRange().getValues();
  let courseFound = false;
  for (let i = 1; i < courseData.length; i++) {
    if (courseData[i][0] === payload.course_id) {
      courseFound = true;
      if ((courseData[i][9] || 'active') !== 'active') {
        return responseJSON({ status: 'error', message: 'หลักสูตรนี้ปิดลงทะเบียนแล้ว' });
      }
      break;
    }
  }
  if (!courseFound) {
    return responseJSON({ status: 'error', message: 'ไม่พบหลักสูตรที่ต้องการลงทะเบียน' });
  }
  
  const enrollId = 'ENR' + new Date().getTime();
  const initProgress = { completed: [], resumeTimes: {} };
  ws.appendRow([enrollId, payload.user_id, payload.course_id, JSON.stringify(initProgress), 0, 'pending', '']);
  
  return responseJSON({ status: 'success', data: initProgress });
}

function updateProgress(sheet, payload) {
  const ws = sheet.getSheetByName('Enrollments');
  const data = ws.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.user_id && data[i][2] === payload.course_id) {
      
      // 1. ดึงข้อมูลเดิมออกมาก่อน เพื่อไม่ให้คะแนน pre/post test หาย
      let progressObj = { completed: [], resumeTimes: {} };
      try {
        let parsed = JSON.parse(data[i][3]);
        if (Array.isArray(parsed)) {
            progressObj.completed = parsed;
        } else if (parsed) {
            progressObj = parsed; // รองรับโครงสร้างที่มีข้อมูลครบถ้วนอยู่แล้ว
        }
      } catch(e) {}
      
      // 2. นำข้อมูลล่าสุดจากหน้าเรียนมาอัปเดต
      progressObj.completed = payload.progress_data.completed;
      progressObj.resumeTimes = payload.progress_data.resumeTimes;
      
      // 3. บันทึกกลับลงชีต โดยยังเก็บคะแนนและเวลาค้างไว้ครบถ้วน
      ws.getRange(i+1, 4).setValue(JSON.stringify(progressObj));
      return responseJSON({ status: 'success' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบประวัติการลงทะเบียน' });
}
// ================= Exam & Quiz API =================

// 1. ดึงข้อสอบของหลักสูตรนี้
function getCourseExams(sheet, payload) {
  const ws = sheet.getSheetByName('Exams');
  const data = ws.getDataRange().getValues();
  const exams = [];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.course_id) {
      exams.push({
        exam_id: data[i][0], question: data[i][2],
        a: data[i][3], b: data[i][4], c: data[i][5], d: data[i][6], answer: data[i][7]
      });
    }
  }
  return responseJSON({ status: 'success', data: exams });
}

// 2. บันทึกคลังข้อสอบ (ลบของเก่าแล้วแทนที่)
function saveCourseExams(sheet, payload) {
  const ws = sheet.getSheetByName('Exams');
  const data = ws.getDataRange().getValues();
  
  // ลบข้อสอบเดิมของหลักสูตรนี้ออกก่อน
  for (let i = data.length - 1; i >= 1; i--) {
    if (data[i][1] === payload.course_id) {
      ws.deleteRow(i + 1);
    }
  }
  
  // เพิ่มข้อสอบชุดใหม่ทั้งหมด
  payload.exams.forEach(ex => {
    const examId = 'EXM' + new Date().getTime() + Math.floor(Math.random() * 1000);
    ws.appendRow([examId, payload.course_id, ex.question, ex.a, ex.b, ex.c, ex.d, ex.answer]);
  });
  
  return responseJSON({ status: 'success', message: 'บันทึกข้อสอบเรียบร้อยแล้ว' });
}

// ดึงสถานะการลงทะเบียนเรียน
function getUserEnrollments(sheet, payload) {
  const data = sheet.getSheetByName('Enrollments').getDataRange().getValues();
  let arr = [];
  for(let i=1; i<data.length; i++) {
    if(data[i][1] === payload.user_id) arr.push({ course_id: data[i][2], status: data[i][5], progress: data[i][3], cert_url: data[i][7] });
  }
  return responseJSON({ status: 'success', data: arr });
}

// ส่งคำตอบข้อสอบ (รองรับการ complete หลังสอบผ่าน)
function submitQuiz(sheet, payload) {
  const wsEnroll = sheet.getSheetByName('Enrollments');
  const data = wsEnroll.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] === payload.user_id && data[i][2] === payload.course_id) {
      let progObj = {};
      try { progObj = JSON.parse(data[i][3]); } catch(e) {}
      
      if(payload.type === 'pre') progObj.preTestScore = payload.score;
      else if (payload.type === 'post') {
        progObj.postTestScore = payload.score;
        wsEnroll.getRange(i+1, 5).setValue(payload.score);
        // ถ้าสอบผ่านให้เปลี่ยนสถานะเป็น completed
        if(payload.is_passed) {
          wsEnroll.getRange(i+1, 6).setValue('completed');
          wsEnroll.getRange(i+1, 7).setValue(new Date().toLocaleDateString('th-TH'));
        }
      }
      wsEnroll.getRange(i+1, 4).setValue(JSON.stringify(progObj));
      return responseJSON({ status: 'success', score: payload.score });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบข้อมูลการลงทะเบียน' });
}
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
// ================= User History API =================
function getUserHistory(sheet, payload) {
  const userId = payload.user_id;

  const enrollSheet = sheet.getSheetByName('Enrollments');
  const courseSheet = getCoursesSheet_(sheet);
  const extSheet = getExternalTrainingSheet_(sheet);

  const enrollData = enrollSheet.getDataRange().getValues();
  const courseData = courseSheet.getDataRange().getValues();
  const extData = extSheet ? extSheet.getDataRange().getValues() : [];

  let courseMap = {};
  for (let i = 1; i < courseData.length; i++) {
    const course = buildCourseRecord_(courseData[i]);
    courseMap[course.id] = {
      title: course.title,
      hours: course.hours,
      organizer: course.organizer || 'โรงพยาบาลสมเด็จพระยุพราชสว่างแดนดิน',
      delivery_type: course.delivery_type
    };
  }

  let historyList = [];

  // 1. ดึงประวัติอบรมในระบบ
  for (let i = 1; i < enrollData.length; i++) {
    if (enrollData[i][1] === userId && enrollData[i][5] === 'completed') {
      let cId = enrollData[i][2];
      let cInfo = courseMap[cId] || { title: 'ไม่ทราบชื่อหลักสูตร', hours: 0, organizer: '-' };

      let rawDate = enrollData[i][6];
      let formattedDate = '-';
      if (rawDate) {
        if (rawDate instanceof Date) formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        else formattedDate = rawDate;
      }

      historyList.push({
        source: 'internal',
        date: formattedDate,
        title: cInfo.title,
        organizer: cInfo.organizer,
        type: cInfo.delivery_type === 'classroom' ? 'อบรมในห้องเรียน' : 'อบรมออนไลน์',
        hours: cInfo.hours,
        cert_url: enrollData[i][7],
        status: 'approved'
      });
    }
  }

  // 2. ดึงประวัติอบรมนอกระบบ (รวมสถานะ pending / rejected / approved)
  for (let j = 1; j < extData.length; j++) {
    if (extData[j][1] === userId) {
      let rawDate = extData[j][4];
      let formattedDate = '-';
      if (rawDate) {
        if (rawDate instanceof Date) formattedDate = Utilities.formatDate(rawDate, Session.getScriptTimeZone(), 'dd/MM/yyyy');
        else formattedDate = rawDate;
      }

      historyList.push({
        source: 'external',
        ext_id: extData[j][0],            // col A: Ext_ID (for edit/delete)
        date: formattedDate,
        title: extData[j][2],             // col C: Topic
        organizer: extData[j][3],         // col D: Organizer
        type: 'อบรมนอกหน่วยงาน',
        hours: extData[j][5],             // col F: Hours
        cert_url: extData[j][6],          // col G: File_URL
        status: extData[j][7],            // col H: Status
        recommendation_id: extData[j][8], // col I: Recommendation_ID
        rejection_reason: extData[j][9],  // col J: Rejection_Reason
        training_time: extData[j][10]     // col K: Training_Time
      });
    }
  }

  return responseJSON({ status: 'success', data: historyList });
}
// ================= External Training API =================
// ใช้ Folder เดียวกับใบประกาศ สามารถเปลี่ยน ID ภายหลังได้
const EXT_CERT_FOLDER_ID = '19Htb9AjawXDOzje5yVeyT_i7mkYh-k45'; 

function getOrCreateExtCertFolder_() {
  try {
    return DriveApp.getFolderById(EXT_CERT_FOLDER_ID);
  } catch(e) {
    // Fallback: search for or create a folder named 'E-Learning Certificates'
    const folders = DriveApp.getFoldersByName('E-Learning Certificates');
    if (folders.hasNext()) return folders.next();
    return DriveApp.createFolder('E-Learning Certificates');
  }
}

function addExternalTraining(sheet, payload) {
  try {
    const ws = getExternalTrainingSheet_(sheet);
    const extId = 'EXT' + new Date().getTime();
    let fileUrl = '';

    if (payload.fileData) {
      // 1. แปลงไฟล์จาก Base64 กลับเป็น Blob
      const folder = getOrCreateExtCertFolder_();
      const contentType = payload.fileData.substring(payload.fileData.indexOf(":")+1, payload.fileData.indexOf(";"));
      const base64Data = payload.fileData.split(',')[1];
      const blob = Utilities.newBlob(Utilities.base64Decode(base64Data), contentType, payload.fileName || extId);
      const file = folder.createFile(blob);
      // ตั้งค่าสิทธิ์ให้เปิดจากลิงก์ได้สำหรับแอดมินตรวจสอบ
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      fileUrl = file.getUrl();
    }

    // 2. บันทึกข้อมูลลงชีต โดยเริ่มต้นสถานะเป็น pending
    ws.appendRow([
      extId,
      payload.user_id,
      payload.topic,
      payload.organizer,
      payload.date,
      parseFloat(payload.hours) || 0,
      fileUrl,
      'pending', // รอแอดมินตรวจสอบก่อนนำชั่วโมงไปคำนวณ
      payload.recommendation_id || '',
      '', // Rejection_Reason blank
      payload.training_time || '' // Training_Time (e.g. '08:00-17:00')
    ]);

    return responseJSON({ status: 'success', message: 'อัปโหลดและบันทึกประวัติเรียบร้อยแล้ว', ext_id: extId });

  } catch (error) {
    return responseJSON({ status: 'error', message: 'อัปโหลดไม่สำเร็จ: ' + error.toString() });
  }
}
// ================= Admin: External Training Approval API =================
// 1. ดึงรายการที่รออนุมัติไปแสดง
function getAdminExternalReq(sheet) {
const wsExt = getExternalTrainingSheet_(sheet);
  const wsUser = sheet.getSheetByName('Users');
  
  const extData = wsExt.getDataRange().getValues();
  const userData = wsUser.getDataRange().getValues();
  
  // สร้างตัวช่วย map ชื่อผู้ใช้จาก user ID
  let userMap = {};
  for(let i=1; i<userData.length; i++) {
    userMap[userData[i][0]] = userData[i][1]; // id -> name
  }
  
  let reqList = [];
  for (let i = 1; i < extData.length; i++) {
    // ดึงเฉพาะรายการสถานะ pending
    if (extData[i][7] === 'pending') {
      reqList.push({
        ext_id: extData[i][0],
        user_name: userMap[extData[i][1]] || 'ไม่ทราบชื่อ',
        topic: extData[i][2],
        organizer: extData[i][3],
        date: extData[i][4],
        hours: extData[i][5],
        cert_url: extData[i][6]
      });
    }
  }
  return responseJSON({ status: 'success', data: reqList });
}

// 2. อนุมัติ / ไม่อนุมัติรายการ
function updateExternalStatus(sheet, payload) {
  const wsExt = getExternalTrainingSheet_(sheet);
  const extData = wsExt.getDataRange().getValues();

  for (let i = 1; i < extData.length; i++) {
    if (extData[i][0] === payload.ext_id) {
      wsExt.getRange(i+1, 8).setValue(payload.status); // col H: Status
      // Save rejection reason if rejected
      if (payload.status === 'rejected' && payload.rejection_reason) {
        wsExt.getRange(i+1, 10).setValue(payload.rejection_reason); // col J: Rejection_Reason
      }
      // Save training_time if provided (admin editing)
      if (payload.training_time) {
        wsExt.getRange(i+1, 11).setValue(payload.training_time); // col K: Training_Time
      }
      // Update hours if admin changes it
      if (payload.hours) {
        wsExt.getRange(i+1, 6).setValue(parseFloat(payload.hours) || extData[i][5]); // col F: Hours
      }
      // Update date if admin changes it
      if (payload.date) {
        wsExt.getRange(i+1, 5).setValue(payload.date); // col E: Date
      }

      // Send email notification to user if rejected
      if (payload.status === 'rejected') {
        try {
          const wsUser = sheet.getSheetByName('Users');
          const uData = wsUser.getDataRange().getValues();
          const userId = extData[i][1];
          for (let u = 1; u < uData.length; u++) {
            if (uData[u][0] === userId) {
              const userEmail = uData[u][6];
              const userName = uData[u][1];
              if (userEmail) {
                MailApp.sendEmail({
                  to: userEmail,
                  subject: 'ผลการพิจารณาการบันทึกชั่วโมงอบรมนอกหน่วยงาน',
                  htmlBody: '<div style="font-family:Arial,sans-serif;line-height:1.7;color:#1f2937">' +
                    '<h2 style="color:#991b1b">คำขอถูกปฏิเสธ</h2>' +
                    '<p>เรียน ' + escapeHtml_(userName) + '</p>' +
                    '<p>คำขอบันทึกชั่วโมงอบรมนอกหน่วยงาน เรื่อง <strong>' + escapeHtml_(extData[i][2]) + '</strong> ได้รับการ<strong>ปฏิเสธ</strong> จากผู้ดูแลระบบ</p>' +
                    (payload.rejection_reason ? '<p>เหตุผล: ' + escapeHtml_(payload.rejection_reason) + '</p>' : '') +
                    '<p>กรุณาแก้ไขข้อมูลและส่งคำขอใหม่อีกครั้ง</p>' +
                    '</div>'
                });
              }
              break;
            }
          }
        } catch(e) { /* Email error is non-critical */ }
      }

      return responseJSON({ status: 'success', message: 'อัปเดตสถานะเรียบร้อยแล้ว' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบรายการคำขอนี้' });
}

// ผู้ใช้ลบคำขออบรมนอกหน่วยงาน (เฉพาะสถานะ pending หรือ rejected)
function deleteExternalTraining(sheet, payload) {
  const wsExt = getExternalTrainingSheet_(sheet);
  const extData = wsExt.getDataRange().getValues();
  for (let i = 1; i < extData.length; i++) {
    if (extData[i][0] === payload.ext_id && extData[i][1] === payload.user_id) {
      const currentStatus = extData[i][7];
      if (currentStatus !== 'pending' && currentStatus !== 'rejected') {
        return responseJSON({ status: 'error', message: 'ไม่สามารถลบรายการที่อนุมัติแล้วได้' });
      }
      wsExt.deleteRow(i + 1);
      return responseJSON({ status: 'success', message: 'ลบรายการเรียบร้อยแล้ว' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบรายการที่ต้องการลบ' });
}

// ผู้ใช้แก้ไขคำขออบรมนอกหน่วยงาน (เฉพาะสถานะ pending หรือ rejected → reset เป็น pending)
function updateExternalTrainingByUser(sheet, payload) {
  const wsExt = getExternalTrainingSheet_(sheet);
  const extData = wsExt.getDataRange().getValues();
  for (let i = 1; i < extData.length; i++) {
    if (extData[i][0] === payload.ext_id && extData[i][1] === payload.user_id) {
      const currentStatus = extData[i][7];
      if (currentStatus !== 'pending' && currentStatus !== 'rejected') {
        return responseJSON({ status: 'error', message: 'ไม่สามารถแก้ไขรายการที่อนุมัติแล้วได้' });
      }
      wsExt.getRange(i+1, 3).setValue(payload.topic);
      wsExt.getRange(i+1, 4).setValue(payload.organizer);
      wsExt.getRange(i+1, 5).setValue(payload.date);
      wsExt.getRange(i+1, 6).setValue(parseFloat(payload.hours) || extData[i][5]);
      wsExt.getRange(i+1, 8).setValue('pending'); // reset to pending
      wsExt.getRange(i+1, 10).setValue(''); // clear rejection reason
      if (payload.file_url) wsExt.getRange(i+1, 7).setValue(payload.file_url);
      return responseJSON({ status: 'success', message: 'แก้ไขและส่งคำขอใหม่เรียบร้อยแล้ว' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบรายการที่ต้องการแก้ไข' });
}
// ================= Permissions Helper Functions =================
function getUserPermissions_(sheet, userId) {
  const ws = sheet.getSheetByName('Permissions');
  if (!ws) return [];
  const data = ws.getDataRange().getValues();
  const targets = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1] || '').trim() === String(userId || '').trim()) {
      const target = String(data[i][3] || '').trim();
      if (target && targets.indexOf(target) === -1) targets.push(target);
    }
  }
  return targets;
}

function setUserPermissions_(sheet, userId, role, targets) {
  const ws = sheet.getSheetByName('Permissions');
  if (!ws) return;
  // Remove existing permissions for this user
  const data = ws.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1] || '').trim() === String(userId || '').trim()) {
      ws.deleteRow(i + 1);
    }
  }
  // Add new permissions if targets provided
  if (!targets || !Array.isArray(targets) || targets.length === 0) return;
  const supervisorRoles = ['working_group_leader', 'department_leader'];
  if (supervisorRoles.indexOf(role) === -1) return;
  targets.forEach(function(target) {
    if (!target) return;
    const permId = 'PRM' + new Date().getTime() + Math.floor(Math.random() * 1000);
    ws.appendRow([permId, userId, role, target]);
  });
}

// ================= Admin: User Management API =================
// 1. ดึงรายชื่อผู้ใช้งานทั้งหมด
function getAdminUsers(sheet) {
  const ws = sheet.getSheetByName('Users');
  const data = ws.getDataRange().getValues();
  let users = [];
  
  for (let i = 1; i < data.length; i++) {
    const userId = data[i][0];
    const userPermissions = getUserPermissions_(sheet, userId);
    users.push({
      id: userId,
      name: data[i][1],
      position: data[i][2],
      department: data[i][3] || '',
      working_group: data[i][4] || '',
      username: normalizeUsername_(data[i][5]), // Username อยู่คอลัมน์ F
      email: data[i][6],    // Email อยู่คอลัมน์ G
      password: normalizePassword_(data[i][7]), // Password อยู่คอลัมน์ H
      role: data[i][8],      // Role อยู่คอลัมน์ I
      permissions: userPermissions
    });
  }
  return responseJSON({ status: 'success', data: users });
}

// 2. บันทึกการแก้ไขข้อมูลผู้ใช้งาน
function updateUserByAdmin(sheet, payload) {
  const ws = sheet.getSheetByName('Users');
  const data = ws.getDataRange().getValues();
  const fullName = String(payload.name == null ? '' : payload.name).trim();
  const normalizedName = normalizeFullName_(fullName);
  const workingGroup = String(payload.working_group || '').trim();
  const dept = String(payload.department || '').trim();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === payload.id) {
      if (isDuplicateUserField_(data, 1, normalizedName, payload.id)) {
        return responseJSON({ status: 'error', message: 'ชื่อ-นามสกุลนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบก่อนบันทึก' });
      }
      ws.getRange(i+1, 2).setValue(fullName);
      ws.getRange(i+1, 3).setValue(payload.position);
      ws.getRange(i+1, 4).setValue(dept);
      ws.getRange(i+1, 5).setValue(workingGroup);
      setPlainTextCell_(ws.getRange(i+1, 8), normalizePassword_(payload.password));
      ws.getRange(i+1, 9).setValue(payload.role);
      
      setUserPermissions_(sheet, payload.id, payload.role, payload.permissions);
      
      return responseJSON({ status: 'success', message: 'อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว' });
    }
  }
  return responseJSON({ status: 'error', message: 'ไม่พบผู้ใช้งานในระบบ' });
}
// ================= Admin: Course Report API =================
function getCourseReport(sheet, payload) {
  const courseId = payload.course_id;
  if (!courseId) return responseJSON({ status: 'error', message: 'กรุณาระบุ ID หลักสูตร' });

  const requestingUserId = payload && payload.user_id;
  let requestingRole = 'user';
  let allowedTargets = [];
  if (requestingUserId) {
    const uData = getSheetDataCached(sheet, 'Users');
    for (let i = 1; i < uData.length; i++) {
      if (uData[i][0] === requestingUserId) {
        requestingRole = uData[i][8];
        break;
      }
    }
    allowedTargets = getUserPermissions_(sheet, requestingUserId);
  }

  const wsEnroll = sheet.getSheetByName('Enrollments');

  const enrollData = wsEnroll.getDataRange().getValues();
  const userData = getSheetDataCached(sheet, 'Users');

  // สร้าง map ข้อมูลผู้ใช้ (ชื่อ ตำแหน่ง หน่วยงาน)
  let userMap = {};
  for(let i = 1; i < userData.length; i++) {
    userMap[userData[i][0]] = {
      name: userData[i][1],
      position: userData[i][2],
      department: userData[i][3] || '',
      working_group: userData[i][4] || ''
    };
  }

  let reportData = [];
  
  // หาเฉพาะผู้ลงทะเบียนในหลักสูตรนี้
  for(let i = 1; i < enrollData.length; i++) {
    if(enrollData[i][2] === courseId) {
      let uId = enrollData[i][1];
      let user = userMap[uId] || { name: 'ไม่ทราบชื่อ', position: '-', department: '-', working_group: '-' };
      
      // Filter by permissions
      if (requestingRole !== 'admin') {
        if (requestingRole === 'working_group_leader') {
          if (allowedTargets.indexOf(user.working_group) === -1) continue;
        } else if (requestingRole === 'department_leader') {
          if (allowedTargets.indexOf(user.department) === -1) continue;
        } else {
          continue;
        }
      }

      let progObj = {};
      try { progObj = JSON.parse(enrollData[i][3]); } catch(e) {}

      reportData.push({
        user_id: uId,
        name: user.name,
        position: user.position,
        department: user.department,
        working_group: user.working_group,
        pre_score: progObj.preTestScore !== undefined ? progObj.preTestScore : '-',
        post_score: progObj.postTestScore !== undefined ? progObj.postTestScore : '-',
        status: enrollData[i][5] // สถานะ pending หรือ completed
      });
    }
  }

  return responseJSON({ status: 'success', data: reportData });
}
// ================= Q&A และ Rating API =================
function getQA(sheet, payload) {
  const ws = sheet.getSheetByName('QA');
  if(!ws) return responseJSON({status:'success', data:[]}); // หากยังไม่มีชีต ให้ส่งค่าว่างกลับ
  
  const data = ws.getDataRange().getValues();
  let qaList = [];
  for(let i=1; i<data.length; i++){
    if(data[i][1] === payload.course_id) {
      qaList.push({ id: data[i][0], user_name: data[i][3], question: data[i][4], answer: data[i][5], ans_by: data[i][6], date: data[i][7] });
    }
  }
  return responseJSON({status:'success', data:qaList});
}

function askQuestion(sheet, payload) {
  let ws = sheet.getSheetByName('QA');
  if(!ws) { ws = sheet.insertSheet('QA'); ws.appendRow(['QA_ID', 'Course_ID', 'User_ID', 'User_Name', 'Question', 'Answer', 'Answered_By', 'Date']); }
  
  const qId = 'QA' + new Date().getTime();
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
  ws.appendRow([qId, payload.course_id, payload.user_id, payload.user_name, payload.question, '', '', dateStr]);
  return responseJSON({status:'success', message:'ส่งคำถามเรียบร้อยแล้ว'});
}

function answerQuestion(sheet, payload) {
  const ws = sheet.getSheetByName('QA');
  const data = ws.getDataRange().getValues();
  for(let i=1; i<data.length; i++){
    if(data[i][0] === payload.qa_id) {
      ws.getRange(i+1, 6).setValue(payload.answer);
      ws.getRange(i+1, 7).setValue(payload.admin_name);
      return responseJSON({status:'success'});
    }
  }
  return responseJSON({status:'error'});
}

function submitReview(sheet, payload) {
  let ws = sheet.getSheetByName('Reviews');
  if(!ws) { ws = sheet.insertSheet('Reviews'); ws.appendRow(['Rev_ID', 'Course_ID', 'User_ID', 'User_Name', 'Rating', 'Comment', 'Date']); }
  
  const revId = 'REV' + new Date().getTime();
  const dateStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy");
  ws.appendRow([revId, payload.course_id, payload.user_id, payload.user_name, payload.rating, payload.comment, dateStr]);
  return responseJSON({status:'success'});
}
