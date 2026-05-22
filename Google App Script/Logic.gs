// ================= การคำนวณ Alert เเจ้งเตือน และจัดการคำสั่ง Admin ================= //
// ฟังก์ชันตรวจสอบความผิดปกติ (Updated: รวมทุกปัญหามาแจ้งเตือนพร้อมกัน)
function checkSensorHealth(values) {
  const props = PropertiesService.getScriptProperties();
  let systemState = JSON.parse(props.getProperty('SYSTEM_STATE') || '{"freezeCount":0, "lastValues":{}, "isSystemOffline":false, "isAlerted":false}');
  let sensorState = JSON.parse(props.getProperty('SENSOR_STATE') || '{}');
  
  const currentSensors = getEffectiveSensors(); 
  let alertBubbles = [];
  let hasNewIssue = false; // ตัวแปรเช็คว่ามีเรื่องใหม่ต้องแจ้งไหม

  // --- PART A: Check Freeze (เหมือนเดิม) ---
  let allSame = true;
  let hasLastValues = Object.keys(systemState.lastValues).length > 0;

  if (hasLastValues) {
    for (let key in values) {
      if (values[key] !== systemState.lastValues[key]) {
        allSame = false; break;
      }
    }
  } else { allSame = false; }

  if (allSame) systemState.freezeCount++;
  else {
    systemState.freezeCount = 0;
    systemState.isSystemOffline = false;
    systemState.isAlerted = false; 
  }
  systemState.lastValues = values;

  if (systemState.freezeCount >= 3) {
    systemState.isSystemOffline = true;
    if (!systemState.isAlerted) {
      // ถ้า System Freeze ให้แจ้งเตือนอันเดียวจบเลย (เพราะค่า Sensor อื่นเชื่อไม่ได้แล้ว)
      alertBubbles.push(createAlertBubble("SYSTEM FROZEN", "ระบบหยุดส่งข้อมูล", "ค่าเดิมซ้ำกันเกิน 30 นาที", "#8B0000"));
      systemState.isAlerted = true;
      hasNewIssue = true;
    }
  }
  props.setProperty('SYSTEM_STATE', JSON.stringify(systemState));

  // --- PART B: Check Sensor (Logic ใหม่) ---
  if (!systemState.isSystemOffline) {
    
    // 1. วนลูปอัปเดตสถานะการนับ (Counting) ของทุกตัวก่อน
    for (let key in currentSensors) {
      const val = values[key];
      const spec = currentSensors[key];
      
      if (!sensorState[key]) sensorState[key] = { zeroCount: 0, limitCount: 0, isAlerted: false };

      let isError = (val === 0);
      let isLimit = isOutOfLimit(key, val, currentSensors);

      if (isError) {
        sensorState[key].zeroCount++;
        sensorState[key].limitCount = 0;
      } else if (isLimit) {
        sensorState[key].limitCount++;
        sensorState[key].zeroCount = 0;
      } else {
        sensorState[key].zeroCount = 0;
        sensorState[key].limitCount = 0;
        sensorState[key].isAlerted = false; // กลับมาปกติ ให้ Reset Alert Flag
      }
      
      // เช็คว่าตัวนี้เป็น "ปัญหาใหม่" ที่ยังไม่เคยแจ้งหรือเปล่า?
      let isOfflineConfirmed = sensorState[key].zeroCount >= 3;
      let isLimitConfirmed = sensorState[key].limitCount >= 3;
      
      if ((isOfflineConfirmed || isLimitConfirmed) && !sensorState[key].isAlerted) {
         hasNewIssue = true; // เจอเรื่องใหม่แล้ว! เตรียมส่งแจ้งเตือน
      }
    }

    // 2. ถ้ามีเรื่องใหม่ (hasNewIssue = true) ให้กวาด "ทุกตัวที่เสีย" มาสร้าง Bubble
    if (hasNewIssue) {
       for (let key in currentSensors) {
          const val = values[key];
          const spec = currentSensors[key];
          let sState = sensorState[key];

          // ถ้าเสีย (ไม่ว่าจะเรื่องเก่าหรือเรื่องใหม่) เอามาใส่ใน Alert รอบนี้ด้วยเลย User จะได้เห็นครบ
          if (sState.zeroCount >= 3) {
             alertBubbles.push(createAlertBubble("SENSOR OFFLINE", `Sensor: ${spec.name}`, "ค่าเป็น 0 ต่อเนื่อง 30 นาที", "#D93025"));
             sState.isAlerted = true; // อัปเดตว่าแจ้งแล้ว
          }
          else if (sState.limitCount >= 3) {
             let problem = (key === 'v2') ? (val > spec.max_limit ? "สูงกว่าเกณฑ์" : "ผิดปกติ") : (val < spec.min ? "ต่ำกว่าเกณฑ์" : "สูงกว่าเกณฑ์");
             alertBubbles.push(createAlertBubble("SENSOR WARNING", `Sensor: ${spec.name}`, `ค่า: ${val} ${spec.unit} (${problem})`, "#F57C00"));
             sState.isAlerted = true; // อัปเดตว่าแจ้งแล้ว
          }
       }
    }
    
    props.setProperty('SENSOR_STATE', JSON.stringify(sensorState));
  }

  // ส่ง Flex Message (Carousel)
  if (alertBubbles.length > 0) {
    const flexPayload = {
      type: "carousel",
      contents: alertBubbles
    };
    sendFlexPushToGroup(flexPayload, "⚠️ มีการแจ้งเตือนคุณภาพน้ำใหม่");
  }
}

// ================= ADMIN COMMAND HANDLER ================= //
function handleAdminCommand(replyToken, msg) {
  const parts = msg.split(/\s+/); 
  const cmd = parts[0].toLowerCase();

  // --- 1. ADMIN MANAGEMENT (มีชื่อเล่น) ---
  
  // เพิ่ม Admin: addadmin {id} {ชื่อเล่น}
  if (cmd === "addadmin" && parts[1]) {
    const newAdminId = parts[1];
    const newAdminName = parts.slice(2).join(" ") || "Admin"; // ถ้าไม่ใส่ชื่อ ให้ชื่อว่า Admin

    if (checkIsAdmin(newAdminId)) {
      replyLine(replyToken, `⚠️ ID นี้เป็น Admin อยู่แล้ว`);
      return true;
    }
    
    addAdminToSystem(newAdminId, newAdminName);
    replyLine(replyToken, `✅ **Admin Added**\nเพิ่ม: ${newAdminName}\nID: ${newAdminId}`);
    return true;
  }

  // ลบ Admin: deladmin {id หรือ ชื่อเล่น}
  if ((cmd === "deladmin" || cmd === "removeadmin") && parts[1]) {
    const target = parts[1]; // เป็นได้ทั้ง ID หรือ ชื่อ
    const result = removeAdminFromSystem(target);
    
    if (result.success) {
      replyLine(replyToken, `🗑️ **Admin Removed**\nลบ: ${result.name} (${result.id})\nเรียบร้อยแล้ว`);
    } else {
      replyLine(replyToken, `⚠️ ไม่พบ Admin ที่ชื่อหรือไอดี "${target}"`);
    }
    return true;
  }

  // ดูรายชื่อ Admin: admins
  if (cmd === "adminlist" || cmd === "admins") {
    const memAdmins = getAdminListFromMemory(); // ได้เป็น Array ของ Object {id, name}
    let txt = `🛡️ **Admin List (${memAdmins.length})**\n\n`;
    
    memAdmins.forEach((a, index) => {
       txt += `${index+1}. ${a.name}\n   └ ${a.id}\n`;
    });
    
    replyLine(replyToken, txt);
    return true;
  }

  // --- GENERAL CONFIG COMMANDS (เหมือนเดิม) ---
  if (cmd === "change" && parts[1].toLowerCase() === "notify" && parts[2]) {
    const newId = parts[2];
    PropertiesService.getScriptProperties().setProperty('ALERT_TARGET_ID', newId);
    replyLine(replyToken, `✅ **System Updated**\nเปลี่ยนกลุ่มแจ้งเตือนเป็น:\n${newId}`);
    return true;
  }
  // เพิ่ม Email: addemail {email}
  if (cmd === "addemail" && parts[1]) {
    const res = manageEmailList("add", parts[1]);
    replyLine(replyToken, res);
    return true;
  }

  // ลบ Email: delemail {email}
  if (cmd === "delemail" && parts[1]) {
    const res = manageEmailList("del", parts[1]);
    replyLine(replyToken, res);
    return true;
  }

  // ดูรายชื่อ Email: emails
  if (cmd === "emaillist" || cmd === "emails" || cmd === "checkemail") {
    const emails = getEmailList();
    if (emails.length === 0) {
      replyLine(replyToken, "📧 **Email List**\nยังไม่มีอีเมลในระบบ");
    } else {
      let txt = `📧 **Email List (${emails.length}/10)**\n\n`;
      emails.forEach((e, i) => txt += `${i+1}. ${e}\n`);
      replyLine(replyToken, txt);
    }
    return true;
  }
  if (cmd === "settoken" && parts[1]) {
    updateSetting('blynkToken', parts[1]);
    replyLine(replyToken, `✅ Update Token เรียบร้อย`);
    return true;
  }
  if (cmd === "notify" && parts[1]) {
    const status = (parts[1].toUpperCase() === 'OFF') ? 'OFF' : 'ON';
    updateSetting('notify', status);
    replyLine(replyToken, `✅ Alert Status: ${status}`);
    return true;
  }
// ================= SET ================= //
  if (cmd === "set" && parts[1] && parts[2] && parts[3]) {
    const sensorNameInput = parts[1].toLowerCase(); 
    const limitType = parts[2].toLowerCase();       
    const value = parseFloat(parts[3]);

    if (isNaN(value)) { replyLine(replyToken, "❌ ค่าไม่ใช่ตัวเลข"); return true; }

    let targetKey = null;
    let targetSensorName = "";
    
    // --- Loop ค้นหาแบบรองรับชื่อเล่น (Aliases) ---
    for (let k in DEFAULT_SENSORS) {
      const s = DEFAULT_SENSORS[k];
      const isNameMatch = s.name.toLowerCase() === sensorNameInput;
      let isAliasMatch = false;
      if (s.aliases) {
        isAliasMatch = s.aliases.some(alias => alias.toLowerCase() === sensorNameInput);
      }

      if (isNameMatch || isAliasMatch) {
        targetKey = k;
        targetSensorName = s.name;
        break;
      }
    }

    if (!targetKey) { replyLine(replyToken, `❌ ไม่พบ Sensor ชื่อ "${parts[1]}"`); return true; }

    const props = PropertiesService.getScriptProperties();

    // =======================================================
    // 🛠️ ส่วนที่แก้ไขให้ฉลาดขึ้น (ดึงค่าปัจจุบันมาเทียบ)
    // =======================================================
    
    // 1. ดึง Spec ของ Sensor นั้นๆ มารอก่อน
    const defaultSpec = DEFAULT_SENSORS[targetKey];

    // 2. ดึงค่าปัจจุบันจาก Memory
    let currentMin = parseFloat(props.getProperty(`LIMIT_${targetKey}_MIN`));
    let currentMax = parseFloat(props.getProperty(`LIMIT_${targetKey}_MAX`));

    // 3. ถ้าใน Memory ไม่มี (เป็น NaN) ให้ไปดึงค่า Default มาแทน
    // (แก้บัค: รองรับทั้ง .max และ .max_limit สำหรับ v2)
    if (isNaN(currentMin)) {
       currentMin = (defaultSpec.min !== undefined) ? defaultSpec.min : 0;
    }
    if (isNaN(currentMax)) {
       currentMax = (defaultSpec.max !== undefined) ? defaultSpec.max : defaultSpec.max_limit;
    }

    // กรณีพิเศษ: v2 (Turbidity) ไม่มี Min ให้ถือว่าเป็น 0 เสมอ
    if (targetKey === 'v2') currentMin = 0; 
    
    // =======================================================

    // --- กรณีตั้งค่า MIN (LOW) ---
    if (limitType === "low" || limitType === "min" || limitType === "ตํ่า") {
      if (targetKey === 'v2') { replyLine(replyToken, "❌ Turbidity ไม่มีการตั้งค่า Min (Low)"); return true; }
      
      // ✅ เช็ค: ห้ามตั้ง Min สูงกว่า (หรือเท่ากับ) Max
      if (value >= currentMax) {
         replyLine(replyToken, `⛔ **ตั้งค่าไม่ได้!**\nค่า Min (${value}) ต้องน้อยกว่า Max ปัจจุบัน (${currentMax})`);
         return true;
      }

      props.setProperty(`LIMIT_${targetKey}_MIN`, value);
      replyLine(replyToken, `✅ MIN Set ${targetSensorName} Min: ${value}`);
    } 
    // --- กรณีตั้งค่า MAX (HIGH) ---
    else if (limitType === "high" || limitType === "max" || limitType === "สูง") {
      
      // ✅ เช็ค: ห้ามตั้ง Max ต่ำกว่า (หรือเท่ากับ) Min
      if (value <= currentMin) {
         replyLine(replyToken, `⛔ **ตั้งค่าไม่ได้!**\nค่า Max (${value}) ต้องมากกว่า Min ปัจจุบัน (${currentMin})`);
         return true;
      }

      props.setProperty(`LIMIT_${targetKey}_MAX`, value);
      replyLine(replyToken, `✅ MAX Set ${targetSensorName} Max: ${value}`);
    } 
    else { replyLine(replyToken, "❌ ใช้ High หรือ Low (เช่น set ph min 6.5)"); }
    return true;
  }
  if (cmd === "checkconfig" || cmd === "config") {
    // 1. 📂 อ่านค่าสดๆ จาก Google Sheet (Tab Config) โดยตรง
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
    
    // (กันเหนียว: ถ้าหา Tab ไม่เจอ ให้สร้างใหม่)
    //if (!sheet) { 
    //    sheet = ss.insertSheet(SHEET_CONFIG_NAME); 
    //    sheet.appendRow(["BlynkToken", "Email", "NotifyStatus"]); 
    //    sheet.appendRow(["", "", "ON"]); 
    //}

    // อ่านแถวที่ 2 (A2, B2, C2)
    const data = sheet.getRange(2, 1, 1, 3).getValues()[0]; 
    const sheetToken = data[0];
    const sheetEmail = data[1];
    const sheetNotify = data[2];

    // 2. 🔄 อัปเดตเข้า Memory ทันที (Sync) 
    // เพื่อให้ฟังก์ชันอื่นๆ เช่น การแจ้งเตือน ได้ใช้ค่าล่าสุดด้วย
    PropertiesService.getScriptProperties().setProperties({
      'blynkToken': sheetToken,
      'email': sheetEmail,
      'notify': sheetNotify
    });

    // 3. 💬 เตรียมข้อความตอบกลับ
    const currentSensors = getEffectiveSensors();
    let msg = "⚙️ **Current Config (From Sheet)**\n\n";
    
    // แสดงรายการ Sensor
    for (let k in currentSensors) {
      const s = currentSensors[k];
      let limit = (k === 'v2') ? `Max: ${s.max_limit}` : `Min: ${s.min} | Max: ${s.max}`;
      msg += `🔹 ${s.name}\n   ${limit}\n`;
    }

    // แสดง System Settings ที่อ่านมาจาก Sheet
    const targetId = getAlertTargetId();
    msg += `\n📡 **System Settings:**\n`;
    msg += `📧 Email เเจ้งเตือนรายวัน: ${sheetEmail || "❌ ว่าง"}\n`;
    msg += `🔑 Blynk Token: ${sheetToken || "❌ ว่าง"}\n`;
    msg += `🎯 Target ID:\n${targetId || "❌ ยังไม่ได้ตั้งค่า (ระบบจะไม่แจ้งเตือน)"}`;

    replyLine(replyToken, msg);
    return true;
  }
  if (cmd === "sheet" || cmd === "ชีต" || cmd === "ตาราง") {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}`;
    replyLine(replyToken, `📄 **Google Sheet Link**\nคลิกเพื่อเปิดตารางข้อมูล:\n${url}`);
    return true;
  }
  return false; 
}

// ================= ADMIN HELPERS ================= //

// 1. เช็คว่าเป็น Admin ไหม (โดยดูจาก ID)
function checkIsAdmin(userId) {
  // เช็คใน Code (Hardcode)
  if (ADMIN_IDS.includes(userId)) return true;
  
  // เช็คใน Memory (ต้อง Loop หาเพราะโครงสร้างเปลี่ยนเป็น Object)
  const memAdmins = getAdminListFromMemory(); // [{id: "...", name: "..."}]
  return memAdmins.some(a => a.id === userId);
}

// อ่าน Admin จาก Memory
function getAdminListFromMemory() {
  const props = PropertiesService.getScriptProperties();
  const json = props.getProperty('ADMIN_LIST_V2'); // เปลี่ยน Key เป็น V2 เพื่อล้างค่าเก่า
  return json ? JSON.parse(json) : [];
}

// 2. เพิ่ม Admin ลง Sheet (Col E = ID, Col F = Name)
function addAdminToSystem(newId, newName) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_CONFIG_NAME);
  
  // เขียนหัวตารางถ้ายังไม่มี
  if (sheet.getRange("E1").getValue() !== "Admin ID") {
     sheet.getRange("E1").setValue("Admin ID").setFontWeight("bold");
     sheet.getRange("F1").setValue("Admin Name").setFontWeight("bold");
  }
  
  // หาแถวว่าง
  let targetRow = 2;
  while (sheet.getRange(targetRow, 5).getValue() !== "") { targetRow++; }
  
  // บันทึก ID และ ชื่อ
  sheet.getRange(targetRow, 5).setValue(newId);
  sheet.getRange(targetRow, 6).setValue(newName);

  // Sync เข้า Memory ทันที
  syncAdminsFromSheet();
}

// 3. ลบ Admin (ด้วย ID หรือ ชื่อ)
function removeAdminFromSystem(target) {
  // ห้ามลบ Hardcode
  if (ADMIN_IDS.includes(target)) return { success: false };

  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  if (!sheet) return { success: false };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: false };

  // อ่านข้อมูล Col E(ID) และ F(Name)
  const range = sheet.getRange(2, 5, lastRow - 1, 2);
  const values = range.getValues(); // [[id, name], [id, name]]
  
  let newAdmins = [];
  let found = false;
  let deletedInfo = { id: "", name: "" };

  for (let i = 0; i < values.length; i++) {
    const id = values[i][0].toString().trim();
    const name = values[i][1].toString().trim();
    
    // เช็คว่าตรงกับ ID หรือ ชื่อเล่น ไหม
    if (id === target || name === target) {
      found = true;
      deletedInfo = { id: id, name: name };
    } else if (id !== "") {
      newAdmins.push([id, name]); // เก็บคนที่ไม่โดนลบไว้
    }
  }

  if (found) {
    range.clearContent(); // ลบทั้งหมดก่อน
    if (newAdmins.length > 0) {
      sheet.getRange(2, 5, newAdmins.length, 2).setValues(newAdmins); // เขียนกลับเฉพาะคนที่เหลือ
    }
    syncAdminsFromSheet(); // Update Memory
    return { success: true, ...deletedInfo };
  }
  
  return { success: false };
}

// 4. Sync Sheet -> Memory (เก็บเป็น Array of Objects)
function syncAdminsFromSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  if (!sheet) return;

  const lastRow = sheet.getLastRow();
  let adminList = [];
  
  if (lastRow >= 2) {
    const values = sheet.getRange(2, 5, lastRow - 1, 2).getValues();
    for (let i = 0; i < values.length; i++) {
      const id = values[i][0].toString().trim();
      const name = values[i][1].toString().trim();
      if (id !== "") {
        adminList.push({ id: id, name: name || "Admin" });
      }
    }
  }
  PropertiesService.getScriptProperties().setProperty('ADMIN_LIST_V2', JSON.stringify(adminList));
}

// --- EMAIL SYSTEM (MULTI-LIST) ---

// จัดการ Add/Del Email
function manageEmailList(action, emailInput) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
  if (!sheet) return "❌ ไม่พบ Sheet Config";

  // อ่านค่าเดิมจาก B2 (สมมติเก็บเป็น email1,email2,email3)
  let currentStr = sheet.getRange("B2").getValue().toString();
  let emailList = currentStr ? currentStr.split(',').map(e => e.trim()) : [];
  
  const email = emailInput.trim();

  if (action === "add") {
    if (emailList.length >= 10) return "⛔ ครบลิมิต 10 อีเมลแล้ว";
    if (emailList.includes(email)) return "⚠️ อีเมลนี้มีอยู่แล้ว";
    
    emailList.push(email);
    sheet.getRange("B2").setValue(emailList.join(',')); // บันทึกกลับแบบคั่นด้วย comma
    updateMemoryEmail(emailList.join(','));
    return `✅ เพิ่มอีเมล: ${email}\n(รวม ${emailList.length}/10)`;
  } 
  
  else if (action === "del") {
    if (!emailList.includes(email)) return "⚠️ ไม่พบอีเมลนี้ในรายการ";
    
    emailList = emailList.filter(e => e !== email);
    sheet.getRange("B2").setValue(emailList.join(','));
    updateMemoryEmail(emailList.join(','));
    return `🗑️ ลบอีเมล: ${email}\n(เหลือ ${emailList.length})`;
  }
}

function getEmailList() {
  const props = PropertiesService.getScriptProperties();
  const str = props.getProperty('email') || ""; // ใช้ Key 'email' เดิม
  return str ? str.split(',') : [];
}

function updateMemoryEmail(str) {
  PropertiesService.getScriptProperties().setProperty('email', str);
}

// ================= AI SECTION (Gemini) ================= //

// 1. ใส่ API Key ที่ไปขอมา
const GEMINI_API_KEY = 'AIzaSyBNP2xna98tE0ppLc9l5ikvq4OVCtrTNHo'; 

// 2. ฟังก์ชันหลักสำหรับคุยกับ AI
function handleAIQuery(replyToken, userQuestion) {
  // A. ดึงข้อมูลย้อนหลัง 10 แถวจาก Sheet มาปั้นเป็นข้อความ
  const contextData = getRecentDataForAI(); 
  
  if (!contextData) {
    replyLine(replyToken, "⚠️ ไม่พบข้อมูลใน Sheet เพื่อส่งให้ AI วิเคราะห์");
    return;
  }

  // B. สร้าง Prompt (คำสั่ง) ที่จะสั่ง AI
  const prompt = `
  บทบาท: คุณคือผู้เชี่ยวชาญด้านคุณภาพน้ำและการเลี้ยงปลา โดยเฉพาะปลาสลิดที่เลี้ยงภายในจังหวัดสมุทรสงคราม
  
  ข้อมูลอ้างอิงของเซนเซอร์:
  - pH: ค่าปกติ 6.5-8.5
  - ORP: ค่าปกติ 150-400 mV (ต่ำกว่านี้แสดงว่าน้ำสกปรก)
  - Turbidity (ความขุ่น): ไม่ควรเกิน 70%
  - TDS: ค่าปกติ 100-400 ppm
  - Temp: 28-35 องศาเซลเซียส
  
  ข้อมูลดิบจากบ่อเลี้ยงปลาช่วงล่าสุด (เรียงตามเวลา):
  ${contextData}
  
  คำถามจากผู้ใช้: "${userQuestion}"
  
  คำแนะนำ:
  - ตอบเป็นภาษาไทย สั้น กระชับ เข้าใจง่าย
  - อ้างอิงตัวเลขจากข้อมูลดิบที่ให้ไป
  - ถ้าค่าไหนผิดปกติ ให้แนะนำวิธีแก้ไขเบื้องต้น
  - ที่สําคัญ คุณอธิบายให้กับชาวบ้านฟัง ให้ย่อประโยคให้กระชับ น้อยที่สุด สั้นที่สุด เเต่ยังคงความสําคัญไว้ 
  `;

  // C. ยิงไปหา Google Gemini API
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;
  const payload = {
    "contents": [{ "parts": [{ "text": prompt }] }]
  };
  
  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  try {
    // แจ้งผู้ใช้ก่อนว่ากำลังคิด (Optional: ถ้าอยากให้รู้ว่ารับทราบแล้ว)
    // replyLine(replyToken, "🤖 กำลังวิเคราะห์ข้อมูล รอสักครู่..."); 
    // หมายเหตุ: ถ้าเปิดบรรทัดบน อาจจะต้องใช้ Push Message แทน Reply ในตอนจบ เพราะ Reply Token ใช้ได้ครั้งเดียว

    const response = UrlFetchApp.fetch(url, options);
    const json = JSON.parse(response.getContentText());
    
    if (json.error) {
      replyLine(replyToken, "❌ AI Error: " + json.error.message);
    } else {
      const aiAnswer = json.candidates[0].content.parts[0].text;
      replyLine(replyToken, "🤖 **AI Analysis:**\n" + aiAnswer);
    }
  } catch (e) {
    replyLine(replyToken, "❌ เชื่อมต่อ AI ไม่ได้: " + e.toString());
  }
}

// 3. ฟังก์ชันดึงข้อมูลจาก Sheet เป็น Text
function getRecentDataForAI() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_DATA_NAME);
  const lastRow = sheet.getLastRow();
  
  if (lastRow < 2) return null;
  
  // --- คำนวณช่วงข้อมูล ---
  const maxRows = 100; 
  const rowsToGet = Math.min(lastRow - 1, maxRows); 
  const startRow = lastRow - rowsToGet + 1;
  
  // อ่านข้อมูลชุดใหญ่มา (Time, pH, ORP, Turb, TDS, Temp)
  const values = sheet.getRange(startRow, 1, rowsToGet, 6).getDisplayValues(); 
  
  let textData = "";
  
  // --- เทคนิค Sampling (ลดจำนวนข้อมูลแต่ได้ไทม์ไลน์ครบ) ---
  // ถ้าข้อมูลเยอะเกิน 20 แถว เราจะหยิบข้ามๆ (Skip) เพื่อให้ได้ภาพรวมทั้งวัน
  // เช่น ถ้ามี 144 แถว -> step = 3 (หยิบ 1 ทิ้ง 2) จะได้ข้อมูลประมาณ 48 จุด (ละเอียดพอสำหรับ AI)
  
  let step = 1;
  if (rowsToGet > 20) {
    step = Math.ceil(rowsToGet / 20); 
  }

  // วนลูปเก็บข้อมูลตาม Step ที่คำนวณได้
  for (let i = 0; i < values.length; i += step) {
    const row = values[i];
    // Format: [เวลา] pH:..., ORP:..., ...
    textData += `[${row[0]}] pH:${row[1]}, ORP:${row[2]}, Turb:${row[3]}%, TDS:${row[4]}, Temp:${row[5]}C\n`;
  }
  
  // แถม: เอาบรรทัดล่าสุดไปด้วยเสมอ (เพื่อให้รู้ค่าปัจจุบันจริงๆ)
  const lastVal = values[values.length - 1];
  textData += `[LATEST NOW] pH:${lastVal[1]}, ORP:${lastVal[2]}, Turb:${lastVal[3]}%, TDS:${lastVal[4]}, Temp:${lastVal[5]}C\n`;

  return textData;
}
