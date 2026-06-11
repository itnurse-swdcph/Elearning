# Certificate File Verification & Auto-Regeneration System

## Overview

This system provides robust certificate download handling by:
1. **Verifying** if the certificate file still exists in storage
2. **Auto-regenerating** missing certificates seamlessly
3. **Updating** all references with new file URLs
4. **Notifying** users appropriately

---

## Architecture

### Flow Diagram

```
User clicks "Download Certificate"
          ↓
    Frontend calls verifyCertificateAndDownload()
          ↓
    Backend checks if file exists in Google Drive
          ↓
    File exists?
     ├─ YES → Return existing URL (fast path)
     └─ NO  → Regenerate certificate
               ├─ Verify template exists
               ├─ Create new presentation
               ├─ Replace text placeholders
               ├─ Insert QR code
               ├─ Convert to PDF
               ├─ Save to Drive
               ├─ Update database records
               └─ Return new URL
          ↓
    Frontend opens PDF in new tab
```

---

## Backend Components (code.gs)

### 1. `verifyCertificateFileExists_(pdfUrl, certId)`

**Purpose**: Check if a certificate PDF file still exists and is accessible

**Parameters**:
- `pdfUrl` (string): The Google Drive sharing URL of the PDF
- `certId` (string): Certificate ID for logging

**Returns**:
```javascript
{
  exists: true/false,              // File is in Drive
  isAccessible: true/false,        // User can access it
  fileId: "FILE_ID" or null,       // Google Drive file ID
  fileName: "filename.pdf",        // File name (if exists)
  fileSize: 12345,                 // File size in bytes (if exists)
  reason: "explanation"            // Why it failed (if exists=false)
}
```

**Logic**:
- Extracts file ID from URL using regex patterns
- Attempts to access file via DriveApp API
- Checks if file is not in trash
- Returns detailed status information

**Error Handling**:
- Invalid URL format → `{ exists: false, reason: 'Invalid URL format' }`
- File not found → `{ exists: false, reason: 'Access denied or not found' }`
- File in trash → `{ exists: false, reason: 'File is in trash' }`

---

### 2. `regenerateMissingCertificate_(sheet, certId)`

**Purpose**: Regenerate a missing certificate from scratch

**Parameters**:
- `sheet` (Spreadsheet): SpreadSheet object
- `certId` (string): Certificate ID to regenerate

**Returns**:
```javascript
{
  status: 'success' | 'error',
  message: 'User-friendly message',
  pdf_url: 'https://...' | null
}
```

**Process**:
1. Fetch certificate record from database
2. Find course template
3. Copy template file
4. Replace all text placeholders ({{NAME}}, {{COURSE}}, {{CAUSE}}, {{DATE}}, {{CERT_ID}}, {{VERIFY_URL}})
5. Insert QR code
6. Convert to PDF
7. Save to Drive folder
8. Update database records (both Certificate Registry and Enrollments sheets)
9. Delete temporary files
10. Return new URL

**Error Handling**:
- Certificate record not found
- Template missing or inaccessible
- Folder not found (uses fallback folder)
- PDF conversion errors

---

### 3. `verifyCertificateAndDownload(sheet, payload)` ⭐ **Main API Endpoint**

**Purpose**: Main entry point for certificate download verification

**Parameters**:
```javascript
{
  user_id: 'USER_ID',              // User ID
  course_id: 'COURSE_ID',          // Course ID
  cert_id: 'CERT_ID' (optional)    // Specific certificate ID
}
```

**Returns**:
```javascript
{
  status: 'success' | 'error',
  message: 'User-friendly message',
  pdf_url: 'https://drive.google.com/...',
  cert_id: 'CERT-2026...',
  verify_url: 'https://script.google.com/...',
  file_verified: true,             // File already existed
  file_regenerated: true           // File was regenerated
}
```

**Logic**:
1. Find certificate record by cert_id OR by user_id + course_id
2. Call `verifyCertificateFileExists_()` to check file status
3. If file exists and accessible → Return URL immediately (fast path)
4. If file missing → Call `regenerateMissingCertificate_()` to regenerate
5. Return result with appropriate flags

**Logging**: All operations are logged via Logger.log() for debugging

---

## Frontend Components (app.js)

### 1. `downloadCertificateWithVerification(courseId)`

**Purpose**: Enhanced download function with verification

**Parameters**:
- `courseId` (string): Course ID

**Process**:
1. Verify user is logged in
2. Find course and enrollment data
3. Check if course is completed
4. Call backend API with 120-second timeout
5. Handle response:
   - If file regenerated: Show notification
   - If file verified: Open silently
   - If error: Show user-friendly error message
6. Open PDF in new tab using `window.open(url, '_blank')`

**Error Messages**:
- "Verification timeout" → User-friendly: "Operation taking too long, please retry"
- "Invalid PDF URL" → "Data error, contact admin"
- Network/API errors → "Check connection and retry"

---

### 2. `downloadCertificateFromModal(courseId)`

**Purpose**: Download from "Passed Courses" modal

Simply calls `downloadCertificateWithVerification()`

---

### 3. `initializeCertificateDownloadButtons()`

**Purpose**: Setup event listeners on all certificate buttons

**Features**:
- Finds all buttons with `data-cert-action="download"`
- Finds modal download button
- Attaches click handlers
- Prevents default link behavior

---

## Implementation Steps

### Step 1: Add Backend Code to `code.gs`

Copy the entire content from `certificate_verification.gs` into your `code.gs` file.

**Where to insert**: After all existing certificate functions (around line 2031)

---

### Step 2: Add Frontend Code to `app.js`

Copy the entire content from `certificate_download_verification.js` into your `app.js` file.

**Where to insert**: 
- New functions: End of file
- Initialization: In the DOMContentLoaded event handler

---

### Step 3: Update HTML Buttons in `index.html`

**Find these buttons and update them**:

#### Button #1: Download in Result Screen
```html
<!-- OLD -->
<a id="btnDownloadCert" href="#" target="_blank" class="btn btn-success hidden">
    <i class="fas fa-download"></i> ดาวน์โหลดใบประกาศ
</a>

<!-- NEW -->
<button id="btnDownloadCert" class="btn btn-success hidden" onclick="downloadCertificateWithVerification(currentClassCourse.id)">
    <i class="fas fa-download"></i> ดาวน์โหลดใบประกาศ
</button>
```

#### Button #2: Download in Dashboard/Passed Courses
```html
<!-- OLD -->
<a id="btnPassedDownloadCert" href="#" target="_blank" class="btn btn-primary">
    <i class="fas fa-download"></i> ดาวน์โหลดใบประกาศ
</a>

<!-- NEW -->
<button id="btnPassedDownloadCert" class="btn btn-primary" onclick="downloadCertificateWithVerification(currentPassedCourse.id)">
    <i class="fas fa-download"></i> ดาวน์โหลดใบประกาศ
</button>
```

#### Button #3: Download in Course Card (if exists)
```html
<!-- Add data attributes to any certificate download button -->
<button class="btn btn-primary" data-cert-action="download" data-course-id="COURSE_ID">
    <i class="fas fa-download"></i> ดาวน์โหลด
</button>
```

---

## Database Update Logic

### Certificates Sheet
When a certificate is regenerated:
- **Column A** (Cert ID): Unchanged
- **Column B-D** (User info): Unchanged
- **Column E-G** (Course info): Unchanged
- **Column H** (PDF URL): **UPDATED** to new URL
- **Column I** (Verify URL): Unchanged

### Enrollments Sheet
When a certificate is regenerated:
- **Column H** (Cert URL): **UPDATED** to new URL

---

## Error Scenarios & Handling

| Scenario | Detection | Action | User Message |
|----------|-----------|--------|--------------|
| **File deleted** | `verifyCertificateFileExists_()` returns `exists=false` | Call `regenerateMissingCertificate_()` | "Creating new certificate..." → "Ready!" |
| **File in trash** | File found but `isTrashed()=true` | Regenerate | Same as above |
| **Permission lost** | DriveApp access denied | Regenerate | Same as above |
| **URL malformed** | Regex extraction fails | Regenerate | Same as above |
| **Template missing** | `getFileById()` throws error | Show error | "Template not found, contact admin" |
| **Regeneration fails** | Exception during process | Show error | "Cannot create certificate, retry later" |
| **Network timeout** | 120s timeout exceeded | Show error | "Operation taking too long, retry" |

---

## Performance Considerations

### Fast Path (File Exists)
- **Time**: < 1 second
- **API calls**: 1 (file existence check)
- **User experience**: Opens PDF immediately

### Slow Path (Regenerate)
- **Time**: 15-45 seconds
- **API calls**: Multiple (Slides, Drive, conversions)
- **User experience**: Shows loading spinner, then success message

### Caching
- Frontend caches certificate URL in `cachedUserEnrollments`
- Next download uses cached URL if available
- Cache invalidated on certificate regeneration

---

## Testing Checklist

- [ ] **Test 1: Normal Download**
  - Complete course, pass exam
  - Certificate generates automatically
  - Click download button
  - PDF opens in new tab
  - User stays logged in

- [ ] **Test 2: File Exists (Fast Path)**
  - Attempt download immediately after generation
  - Verify file exists check runs
  - Verify PDF opens in < 1 second
  - Check logs show `file_verified=true`

- [ ] **Test 3: File Deleted (Regeneration)**
  - Delete PDF file from Google Drive folder
  - Click download button
  - Verify system detects missing file
  - Verify certificate regenerates
  - Verify new file created in Drive
  - Verify database updated with new URL
  - Verify PDF opens successfully
  - Check logs show `file_regenerated=true`

- [ ] **Test 4: Template Missing**
  - Delete or move certificate template
  - Attempt download
  - Verify system shows "Template not found" error
  - Check logs show template error

- [ ] **Test 5: Multiple Downloads**
  - Download same certificate 3 times quickly
  - Verify each opens correct file
  - Verify no duplicate files created
  - Check logs for proper caching

- [ ] **Test 6: User Switching**
  - Download as user A
  - Logout and login as user B
  - Download their certificate
  - Verify correct files opened

---

## Logging & Debugging

### Where to Find Logs
Google Apps Script Editor → Executions tab

### What to Look For
```javascript
// Success logs
"Certificate file verified: CERT-2026..."
"Certificate regenerated successfully: CERT-2026..."
"Certificate opened: CERT-2026..."

// Warning logs
"QR code insertion failed (non-critical): ..."
"Text replacement warning: ..."

// Error logs
"Certificate file missing or inaccessible: ..."
"File not found or access denied: ..."
"Certificate regeneration error: ..."
```

---

## Troubleshooting

### Q: Regeneration stuck / taking too long
**A**: 
- Check Google Drive storage quota
- Verify template file is accessible
- Check network connection in Script Editor logs
- May need to increase timeout (currently 120s)

### Q: New certificate file not updating in database
**A**:
- Verify Sheet permissions are correct
- Check if row index is being calculated correctly
- Ensure `upsertCertificateRecord_()` is implemented
- Check database logs for SQL errors

### Q: PDF still shows old content after regeneration
**A**:
- Verify new template file content
- Clear browser cache (Ctrl+Shift+Del)
- Try private/incognito window
- Check if old file is being served from cache

### Q: Multiple files being created
**A**:
- Check if regeneration is being called multiple times
- Add debouncing/locking mechanism
- Verify duplicate download attempts aren't happening
- Check frontend for race conditions

