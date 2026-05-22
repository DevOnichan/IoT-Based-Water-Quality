// ================= ส่วนแสดงผลหน้าตา Flex Message ทั้งหมด ================= //
// ================= FLEX REPLY (ส่วนรายงานสถานะแบบสวยงาม) ================= //
function replyLatestData(replyToken) {
  const settings = getSettings();
  const notifyStatus = settings.notify || 'ON';
  
  const targetId = getAlertTargetId();
  const targetNameDisplay = targetId ? (targetId.substring(0, 4) + "...") : "Not Set";

  const currentSensors = getEffectiveSensors(); 
  const props = PropertiesService.getScriptProperties();
  const systemState = JSON.parse(props.getProperty('SYSTEM_STATE') || '{"isSystemOffline":false}');
  const sensorState = JSON.parse(props.getProperty('SENSOR_STATE') || '{}');

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_DATA_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) {
    replyLine(replyToken, "⚠️ ยังไม่พบข้อมูลบันทึกในระบบ");
    return;
  }

  const data = sheet.getRange(lastRow, 1, 1, 6).getValues()[0];
  const ts = Utilities.formatDate(new Date(data[0]), "GMT+7", "dd/MM HH:mm");
  const vals = { v0: data[1], v1: data[2], v2: data[3], v3: data[4], v4: data[5] };

  // --- สร้าง Flex Container ---
  let flexContents = [];

  // 1. System Frozen Warning (ถ้ามี)
  if (systemState.isSystemOffline) {
     flexContents.push({
       "type": "box",
       "layout": "vertical",
       "backgroundColor": "#FFCDD2",
       "cornerRadius": "md",
       "paddingAll": "md",
       "margin": "md",
       "contents": [
         { "type": "text", "text": "⚠️ SYSTEM FROZEN", "weight": "bold", "color": "#B71C1C", "size": "sm" },
         { "type": "text", "text": "ระบบหยุดส่งข้อมูล (ค้าง)", "size": "xs", "color": "#B71C1C" }
       ]
     });
  }

  // 2. Loop สร้างแถว Sensor
  for (let k in currentSensors) {
    const val = vals[k];
    const s = currentSensors[k];
    let sState = sensorState[k] || { zeroCount: 0 };
    let isSensorOffline = sState.zeroCount >= 3;
    
    let statusText = "ปกติ";
    let statusColor = "#1DB446"; // เขียว
    let valueColor = "#000000";

    // Logic กำหนดสีและข้อความ
    if (systemState.isSystemOffline) {
        statusText = "Offline";
        statusColor = "#B71C1C"; // แดงเข้ม
    } else if (isSensorOffline) {
        statusText = "Offline";
        statusColor = "#D93025"; // แดง
        valueColor = "#AAAAAA";  // เทา (ข้อมูลเก่าเชื่อไม่ได้)
    } else {
        if (val == 0) {
           statusText = "รอตรวจสอบ";
           statusColor = "#F4B400"; // เหลือง
        } else if (k === 'v2') {
           if (val > s.max_limit) { statusText = "สูงกว่าเกณฑ์"; statusColor = "#F4B400"; }
        } else {
           if (val < s.min) { statusText = "ต่ำกว่าเกณฑ์"; statusColor = "#F4B400"; }
           else if (val > s.max) { statusText = "สูงกว่าเกณฑ์"; statusColor = "#F4B400"; }
        }
    }

    // สร้าง Row ของ Sensor นั้น
    flexContents.push({
      "type": "box",
      "layout": "vertical",
      "margin": "md",
      "contents": [
        // 1. ส่วนชื่อ Sensor (อยู่บรรทัดบน เต็มความกว้าง)
        {
          "type": "text",
          "text": s.name,      // ชื่อไทยยาวๆ
          "weight": "bold",
          "color": "#333333",  // สีเข้มขึ้นนิดนึง
          "size": "sm",        // ขนาดกำลังดี
          "wrap": true         // ถ้าชื่อยาวเกินให้ปัดลงมา ไม่ตัดทิ้ง
        },
        // 2. ส่วนแสดงค่า และ สถานะ (อยู่บรรทัดล่างคู่กัน)
        {
          "type": "box",
          "layout": "baseline",
          "margin": "sm",      // เว้นระยะห่างจากชื่อนิดหน่อย
          "contents": [
            // ค่าตัวเลข (ทำตัวใหญ่ขึ้นจะได้เด่น)
            { 
               "type": "text", 
               "text": `${val} ${s.unit}`, 
               "weight": "bold", 
               "color": valueColor, 
               "size": "xl",   // 🔍 ปรับให้ตัวเลขใหญ่สะใจ
               "flex": 0       // ให้กินพื้นที่เท่าความยาวตัวอักษร
            },
            { "type": "filler" }, // ตัวดัน: ดันสถานะไปชิดขวาสุด
            // สถานะ (ตัวเล็กชิดขวา)
            { 
               "type": "text", 
               "text": statusText, 
               "size": "xs", 
               "color": statusColor, 
               "align": "end",
               "flex": 0 
            }
          ]
        },
        { "type": "separator", "margin": "sm", "color": "#EEEEEE" } // เส้นคั่นบางๆ
      ]
    });
  }

  // สร้าง Payload Flex Message
  const flexPayload = {
    "type": "bubble",
    "size": "giga",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": "#0288D1",
      "paddingAll": "lg",
      "contents": [
        { "type": "text", "text": "รายงานคุณภาพน้ำ", "weight": "bold", "color": "#FFFFFF", "size": "lg" },
        { 
          "type": "box", "layout": "baseline", "margin": "md",
          "contents": [
             { "type": "text", "text": `อัพเดตล่าสุดเมื่อ 🕒 ${ts} น.`, "color": "#E1F5FE", "size": "xs", "flex": 1 },
             { "type": "text", "text": `เเจ้งเตือน: ${notifyStatus}`, "color": "#E1F5FE", "size": "xs", "align": "end", "flex": 0 }
          ]
        }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": flexContents
    }
  };

  sendFlexReply(replyToken, flexPayload, "รายงานคุณภาพน้ำล่าสุด");
}

// ฟังก์ชันส่งคู่มือการใช้งาน (Flex Message) แบบแยก User/Admin
function replyHelpMenu(replyToken, isAdmin) {
  
  // --- ส่วนที่ 1: คำสั่งพื้นฐาน (ทุกคนเห็นเหมือนกัน) ---
  let contents = [
    {
      "type": "text", "text": "คำสั่งพื้นฐาน (Basic)", "weight": "bold", "color": "#1DB446", "size": "sm", "margin": "md"
    },
    {
      "type": "box", "layout": "vertical", "margin": "sm", "spacing": "sm",
      "contents": [
        // แถวที่ 1: สถานะ
        {
          "type": "box", "layout": "baseline",
          "contents": [
            { "type": "text", "text": "สถานะ", "weight": "bold", "color": "#000000", "flex": 2 },
            { "type": "text", "text": "ดูค่าน้ำปัจจุบัน", "size": "sm", "color": "#666666", "flex": 4 }
          ]
        },
        // แถวที่ 2: myid
        {
          "type": "box", "layout": "baseline",
          "contents": [
            { "type": "text", "text": "myid", "weight": "bold", "color": "#000000", "flex": 2 },
            { "type": "text", "text": "ดูรหัสประจำตัว", "size": "sm", "color": "#666666", "flex": 4 }
          ]
        }
      ]
    }
  ];

  // --- ส่วนที่ 2: คำสั่ง Admin (เพิ่มเข้าไปเฉพาะถ้าเป็น Admin) ---
  if (isAdmin) {
    // เส้นคั่น
    contents.push({ "type": "separator", "margin": "lg", "color": "#E0E0E0" });
    
    // หัวข้อ Admin
    contents.push({
      "type": "text", "text": "🔧 Admin Command Only", "weight": "bold", "color": "#FF6D00", "size": "sm", "margin": "lg"
    });

    // รายการคำสั่ง Admin
    contents.push({
      "type": "box", "layout": "vertical", "margin": "sm", "spacing": "sm",
      "contents": [
        {
          "type": "box", "layout": "baseline",
          "contents": [
            { "type": "text", "text": "Config", "weight": "bold", "color": "#000000", "flex": 2 },
            { "type": "text", "text": "ดูค่าเกณฑ์ที่ตั้งไว้", "size": "sm", "color": "#666666", "flex": 4 }
          ]
        },
        {
          "type": "box", "layout": "baseline",
          "contents": [
            { "type": "text", "text": "Notify [ON/OFF]", "weight": "bold", "color": "#000000", "flex": 2, "wrap": true },
            { "type": "text", "text": "เปิด/ปิด แจ้งเตือน", "size": "sm", "color": "#666666", "flex": 4 }
          ]
        },
        {
          "type": "box", "layout": "baseline",
          "contents": [
            { "type": "text", "text": "Set [Sensor]...", "weight": "bold", "color": "#000000", "flex": 2, "wrap": true },
            { "type": "text", "text": "ตั้งค่า High/Low", "size": "sm", "color": "#666666", "flex": 4 }
          ]
        },
        {
          "type": "text", "text": "ex. Set pH Low 6.5", "size": "xxs", "color": "#AAAAAA", "margin": "xs", "offsetStart": "33%"
        },
        {
          "type": "box", "layout": "baseline",
          "contents": [
            { "type": "text", "text": "Change Notify [ID]", "weight": "bold", "color": "#000000", "flex": 2, "wrap": true },
            { "type": "text", "text": "เปลี่ยนกลุ่มแจ้งเตือน", "size": "sm", "color": "#666666", "flex": 4 }
          ]
        },
        {
          "type": "text", "text": "ex. ID เช็คได้จากคําสั่ง myid", "size": "xxs", "color": "#AAAAAA", "margin": "xs", "offsetStart": "33%"
        },
        {
           "type": "box", "layout": "baseline",
           "contents": [
             { "type": "text", "text": "SetToken [Token]", "weight": "bold", "color": "#000000", "flex": 2, "wrap": true },
             { "type": "text", "text": "เปลี่ยน Blynk Token", "size": "sm", "color": "#666666", "flex": 4 }
           ]
        },
        {
          "type": "text", "text": "ex. SetToken {Tokens ยาวๆ}", "size": "xxs", "color": "#AAAAAA", "margin": "xs", "offsetStart": "33%"
        },
        {
           "type": "box", "layout": "baseline",
           "contents": [
             { "type": "text", "text": "Add/DelEmail [Email]", "weight": "bold", "color": "#000000", "flex": 2, "wrap": true },
             { "type": "text", "text": "เพิ่ม/ลบ Email สําหรับเเจ้ง\nเตือนรายวัน ดู list ได้ผ่านคําสั่ง emails", "size": "sm", "color": "#666666", "flex": 4 , "wrap": true }
           ]
        },
        {
          "type": "text", "text": "ex. SetToken {Email@gmail.com}", "size": "xxs", "color": "#AAAAAA", "margin": "xs", "offsetStart": "33%"
        },
        {
           "type": "box", "layout": "baseline",
           "contents": [
             { "type": "text", "text": "Sheet", "weight": "bold", "color": "#000000", "flex": 2, "wrap": true },
             { "type": "text", "text": "สําหรับขอ Link Google \nSheet เพื่อดูข้อมูลดิบ", "size": "sm", "color": "#666666", "flex": 4 , "wrap": true }
           ]
        },
        {
          "type": "text", "text": "ex. Sheet", "size": "xxs", "color": "#AAAAAA", "margin": "xs", "offsetStart": "33%"
        },
      ]
    });
  }

  // สร้าง Payload
  const flexPayload = {
    "type": "bubble",
    "size": "mega",
    "header": {
      "type": "box",
      "layout": "vertical",
      "backgroundColor": isAdmin ? "#263238" : "#0288D1", // Admin=เทาเข้ม, User=ฟ้า
      "paddingAll": "lg",
      "contents": [
        {
          "type": "text", "text": isAdmin ? "Admin Manual" : "User Manual", 
          "weight": "bold", "color": "#FFFFFF", "size": "lg"
        },
        {
          "type": "text", "text": isAdmin ? "คู่มือคำสั่งสำหรับผู้ดูแลระบบ" : "คู่มือการใช้งานสำหรับสมาชิก", 
          "color": "#CFD8DC", "size": "xs", "margin": "xs"
        }
      ]
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": contents
    }
  };

  sendFlexReply(replyToken, flexPayload, "คู่มือการใช้งาน");
}

// สร้าง Bubble สำหรับ Alert
function createAlertBubble(title, line1, line2, colorCode) {
  return {
    "type": "bubble",
    "header": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": "⚠️ " + title, "weight": "bold", "color": "#FFFFFF", "size": "md" }
      ],
      "backgroundColor": colorCode,
      "paddingAll": "12px"
    },
    "body": {
      "type": "box",
      "layout": "vertical",
      "contents": [
        { "type": "text", "text": line1, "weight": "bold", "size": "lg", "wrap": true },
        { "type": "text", "text": line2, "size": "sm", "color": "#666666", "wrap": true, "margin": "sm" }
      ]
    }
  };
}

