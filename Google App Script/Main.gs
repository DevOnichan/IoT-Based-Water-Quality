// ================= เก็บฟังก์ชันหลักที่เป็น Trigger และ Webhook ================= //
// ================= MAIN FUNCTION (Trigger) ================= //
function logBlynkData() {
  const settings = getSettings(); 
  if (!settings.blynkToken) return;

  const url = `https://blynk.cloud/external/api/get?token=${settings.blynkToken}&v0&v1&v2&v3&v4`;
  
  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    
    const values = {
      v0: parseFloat(json.v0 || json.V0 || 0),
      v1: parseFloat(json.v1 || json.V1 || 0),
      v2: parseFloat(json.v2 || json.V2 || 0),
      v3: parseFloat(json.v3 || json.V3 || 0),
      v4: parseFloat(json.v4 || json.V4 || 0)
    };

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_DATA_NAME);
    sheet.appendRow([new Date(), values.v0, values.v1, values.v2, values.v3, values.v4]);

    if (settings.notify === 'ON') {
      checkSensorHealth(values); 
    }

  } catch (e) {
    console.error("Error: " + e.toString());
  }
}

// ================= ส่งเเจ้งเตือนเข้า EMAIL ================= //
function sendDailyReport() {
  const settings = getSettings();
  if (!settings.email) return;

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const reportSheet = ss.getSheetByName(SHEET_REPORT_NAME);
  
  // 1. เตรียมวันที่สำหรับหัวข้อและชื่อไฟล์
  const today = new Date();
  const dateStr = Utilities.formatDate(today, "GMT+7", "dd/MM/yyyy");     // รูปแบบ 05/02/2026
  const fileDate = Utilities.formatDate(today, "GMT+7", "yyyy-MM-dd");    // รูปแบบ 2026-02-05 (ชื่อไฟล์)

  // 2. สร้าง PDF (โค้ดเดิม)
  const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/export?';
  const exportOptions = 'exportFormat=pdf&format=pdf&size=A4&portrait=true&fitw=true&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false&gid=' + reportSheet.getSheetId();
  const token = ScriptApp.getOAuthToken();
  const response = UrlFetchApp.fetch(url + exportOptions, { headers: { 'Authorization': 'Bearer ' + token } });
  const pdfBlob = response.getBlob().setName(`Water_Report_${fileDate}.pdf`);

  // 3. ✨ ดึงเนื้อหา "สรุปยอด" มาใส่ใน Body
  const summaryBody = getDailySummary(today); // ฟังก์ชันใหม่ที่เราจะสร้างข้างล่าง

  // 4. ส่งอีเมล (หัวข้อและเนื้อหาเปลี่ยนตามวันที่และข้อมูลจริง)
  // ทำความสะอาดอีเมลก่อน (ตัดช่องว่างหน้าหลังทิ้งให้หมด กันเหนียว)
  const cleanEmails = settings.email.split(',').map(e => e.trim()).join(',');

  GmailApp.sendEmail(cleanEmails, `รายงานสรุปคุณภาพน้ำรายวัน ประจำวันที่ ${dateStr}`, summaryBody, {
    attachments: [pdfBlob]
  });
}

// ฟังก์ชันดึงข้อมูลสรุปจากหน้า Sheet Report โดยตรง (C4:E8)
function getDailySummary(targetDate) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const reportSheet = ss.getSheetByName(SHEET_REPORT_NAME); // ต้องเป็นชื่อ "Report" ตามรูป
  
  // จากรูปภาพ:
  // ข้อมูลเริ่มที่ Row 4 ถึง 8
  // Col C = เฉลี่ย (Avg)
  // Col D = ต่ำสุด (Min)
  // Col E = สูงสุด (Max)
  // getDisplayValues() จะดึงค่าตามที่ตาเห็น (ติดทศนิยมมาด้วย)
  const data = reportSheet.getRange("C4:E8").getDisplayValues(); 
  
  // เช็คกันเหนียว: ถ้าไม่มีข้อมูลในตาราง (ค่าเป็นว่าง) แสดงว่าวันนี้อาจยังไม่มีข้อมูล
  if (data[0][0] === "" || data[0][0] === "#DIV/0!") {
    return "⚠️ ยังไม่มีข้อมูลสรุปในหน้า Report สำหรับวันนี้";
  }

  // ดึงค่าออกมาใส่ตัวแปร (Data Array เริ่มนับที่ 0)
  // data[0] = แถว pH
  // data[1] = แถว ORP
  // data[2] = แถว Turbidity
  // data[3] = แถว TDS
  // data[4] = แถว Temp

  const dateStr = Utilities.formatDate(targetDate, "GMT+7", "dd/MM/yyyy");

  let msg = `เรียน ผู้ดูแลระบบ,\n\n`;
  msg += `สรุปภาพรวมคุณภาพน้ำ ประจำวันที่ ${dateStr}\n`;
  msg += `--------------------------------------------------\n`;
  
  msg += `pH (กรด-ด่าง):\n`;
  msg += `   เฉลี่ย: ${data[0][0]} | ต่ำสุด: ${data[0][1]} | สูงสุด: ${data[0][2]}\n\n`;

  msg += `ORP (ออกซิเดชั่น - รีดักชั่น):\n`;
  msg += `   เฉลี่ย: ${data[1][0]} | ต่ำสุด: ${data[1][1]} | สูงสุด: ${data[1][2]}\n\n`;

  msg += `ความขุ่น (Turbidity):\n`;
  msg += `   เฉลี่ย: ${data[2][0]} | ต่ำสุด: ${data[2][1]} | สูงสุด: ${data[2][2]}\n\n`;

  msg += `สารละลาย (TDS):\n`;
  msg += `   เฉลี่ย: ${data[3][0]} | ต่ำสุด: ${data[3][1]} | สูงสุด: ${data[3][2]}\n\n`;

  msg += `อุณหภูมิ:\n`;
  msg += `   เฉลี่ย: ${data[4][0]} | ต่ำสุด: ${data[4][1]} | สูงสุด: ${data[4][2]}\n`;
  
  msg += `--------------------------------------------------\n`;
  msg += `ตรวจสอบกราฟและรายละเอียดเพิ่มเติมได้ในไฟล์แนบ PDF\n`;
  msg += `(ระบบรายงานอัตโนมัติ)`;

  return msg;
}

// ================= LINE WEBHOOK & COMMANDS ================= //
function doPost(e) {
  try {
    const json = JSON.parse(e.postData.contents);
    const events = json.events[0];
    
    if (events.type === 'message' && events.message.type === 'text') {
      const msg = events.message.text.trim();
      const userId = events.source.userId;
      const groupId = events.source.groupId;
      const replyToken = events.replyToken;

      const isAdmin = checkIsAdmin(userId); // เช็คสิทธิ์

      // --- 1. คำสั่งที่ "ใครก็ใช้ได้" (Public Commands) ---
      
      // Sync (เปิด Public ตาม request)
      if (msg.toLowerCase() === "sync" || msg.toLowerCase() === "refresh") {
        const count = syncAdminsFromSheet();
        replyLine(replyToken, `✅ **System Synced**\nอัปเดตข้อมูลจาก Sheet เรียบร้อย\nจำนวน Admin ในระบบ: ${count} คน`);
        return success();
      }

      if (msg.toUpperCase().startsWith("AI ")) {
        const question = msg.substring(3); // ตัดคำว่า "AI " ออก เอาแต่คำถาม
        handleAIQuery(replyToken, question);
        return success();
      }

      // Help
      if (msg.toLowerCase() === "help" || msg === "ช่วยเหลือ" || msg === "วิธีใช้" || msg === "?") {
        replyHelpMenu(replyToken, isAdmin);
        return success();
      }

      // MyID
      if (msg.toLowerCase() === "myid" || msg.toLowerCase() === "id") {
        let replyMsg = `👤 User ID: ${userId}`;
        if (groupId) replyMsg += `\n🏠 Group ID: ${groupId}`;
        replyLine(replyToken, replyMsg);
        return success();
      }

      // Status
      if (msg === "สถานะ") {
        replyLatestData(replyToken);
        return success();
      }

      // --- 2. คำสั่งเฉพาะ Admin (Admin Commands) ---
      if (isAdmin) {
         // ส่งเข้าตัวจัดการคำสั่ง Admin
         const isCommand = handleAdminCommand(replyToken, msg);
         if (!isCommand) { /* พิมพ์เล่นๆ ไม่ทำอะไร */ }
      } else {
         // ถ้าไม่ใช่ Admin แต่พยายามพิมพ์คำสั่ง
         if (msg.toLowerCase().startsWith("set") || msg.toLowerCase().startsWith("add") || msg.toLowerCase().startsWith("del") || msg.toLowerCase().startsWith("change")
            || msg.toLowerCase().startsWith("notify") || msg.toLowerCase().startsWith("admin")) {
           replyLine(replyToken, "⛔ คุณไม่มีสิทธิ์ใช้งานคำสั่งนี้ (Admin Only)");
         } 
         // ถ้าพิมพ์อย่างอื่นก็เงียบไป (หรือไม่ก็ส่ง Help)
      }
    }
    return success();
  } catch (e) {
    return success();
  }
}
