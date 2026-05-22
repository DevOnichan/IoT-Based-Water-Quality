// ================= สําหรับใส่ค่าที่เปลี่ยนเเปลงได้ ================= //
// ================= CONFIGURATION ================= //
const LINE_ACCESS_TOKEN = 'YOUR_LINE_MESSAGING_TOKEN'; // ใส่ Token Line
const SHEET_ID = 'YOUR_GOOGLE_SHEET_TOKEN'; // ใส่ Sheet ID

// ตั้งค่าชื่อ Tab ใน Google Sheet
const SHEET_DATA_NAME = 'RawData'; // Tab เก็บข้อมูลดิบ
const SHEET_REPORT_NAME = 'Report';     // Tab กราฟสำหรับทำ PDF
const SHEET_CONFIG_NAME = 'Config';     // Tab เก็บค่า Config (Email, Token)

// รายชื่อ Admin (ผู้มีสิทธิ์สั่งแก้ไขค่า)
const ADMIN_IDS = [
  'LINE_UID' // ใส่ User UID ที่ต้องการให้เป็น ADMIN
];

const DEFAULT_SENSORS = {
  v0: { 
    name: 'pH (กรด-เบส)', 
    aliases: ['ph', 'พีเอช', 'กรดด่าง'], 
    unit: '', min: 6.5, max: 8.5 
  },
  v1: { 
    name: 'ORP (ออกซิเดชัน-รีดักชัน)', 
    aliases: ['orp', 'โออาร์พี'], 
    unit: 'mV', min: 150, max: 400 
  },
  v2: { 
    name: 'ความขุ่น (Turbidity)', 
    aliases: ['turbidity', 'turb', 'ความขุ่น', 'ขุ่น'], 
    unit: '%', max_limit: 80 
  }, 
  v3: { 
    name: 'สารละลายในน้ำ (TDS)', 
    aliases: ['tds', 'ทีดีเอส', 'สารละลาย'], 
    unit: 'ppm', min: 100, max: 400 
  },
  v4: { 
    name: 'อุณหภูมิ (Temperature)', 
    aliases: ['temp', 'temperature', 'อุณหภูมิ'], 
    unit: '°C', min: 20, max: 35 
  }
};





















