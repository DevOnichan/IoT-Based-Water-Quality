// ================= ฟังก์ชันตัวช่วยทั่วไป ที่ทุกไฟล์ต้องใช้ ================= //
// (ฟังก์ชันเสริม) Reply Text ธรรมดาสำหรับคำสั่งทั่วไป
function replyLine(token, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: token, messages: [{ type: 'text', text: text }] })
  });
}

// Helper ส่ง Flex Reply
function sendFlexReply(token, flexContents, altText) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
    payload: JSON.stringify({
      replyToken: token,
      messages: [{ "type": "flex", "altText": altText, "contents": flexContents }]
    })
  });
}

// Helper ส่ง Flex Push (สำหรับ Alert)
function sendFlexPushToGroup(flexContents, altText) {
  const targetId = getAlertTargetId();
  if (!targetId) return; 

  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + LINE_ACCESS_TOKEN },
    payload: JSON.stringify({
      to: targetId,
      messages: [{ "type": "flex", "altText": altText, "contents": flexContents }]
    })
  });
}

function getAlertTargetId() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty('ALERT_TARGET_ID') || ''; 
}

function getSettings() {
  const props = PropertiesService.getScriptProperties();
  let conf = props.getProperties();
  if (!conf.blynkToken) {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    let sheet = ss.getSheetByName(SHEET_CONFIG_NAME);
    if (!sheet) { sheet = ss.insertSheet(SHEET_CONFIG_NAME); sheet.appendRow(["BlynkToken", "Email", "NotifyStatus"]); sheet.appendRow(["TOKEN_HERE", "email@example.com", "ON"]); }
    const data = sheet.getRange(2, 1, 1, 3).getValues()[0];
    conf = { blynkToken: data[0], email: data[1], notify: data[2] };
    props.setProperties(conf);
  }
  return conf;
}

function updateSetting(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, value);
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_CONFIG_NAME);
  if (key === 'blynkToken') sheet.getRange("A2").setValue(value);
  if (key === 'email') sheet.getRange("B2").setValue(value);
  if (key === 'notify') sheet.getRange("C2").setValue(value);
}

function getEffectiveSensors() {
  const props = PropertiesService.getScriptProperties();
  const rawProps = props.getProperties(); 
  let effective = JSON.parse(JSON.stringify(DEFAULT_SENSORS));
  for (let key in effective) {
    if (rawProps[`LIMIT_${key}_MIN`]) effective[key].min = parseFloat(rawProps[`LIMIT_${key}_MIN`]);
    if (rawProps[`LIMIT_${key}_MAX`]) {
      if (key === 'v2') effective[key].max_limit = parseFloat(rawProps[`LIMIT_${key}_MAX`]);
      else effective[key].max = parseFloat(rawProps[`LIMIT_${key}_MAX`]);
    }
  }
  return effective;
}

function isOutOfLimit(key, val, sensorsObj) {
  const s = sensorsObj[key];
  if (key === 'v2') return val > s.max_limit; 
  return val < s.min || val > s.max;
}

function success() {
  return ContentService.createTextOutput(JSON.stringify({status: 'success'})).setMimeType(ContentService.MimeType.JSON);
}
