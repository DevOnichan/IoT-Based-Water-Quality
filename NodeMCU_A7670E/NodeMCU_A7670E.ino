/*
 * NodeMCU V2 + A7670E (Ultimate Power Saver)
 * System: SoftwareSerial + Flight Mode Sleep + Clean Reset Wakeup
 * Note: A7670E MUST BE SET TO 9600 BAUD RATE!
 */

#include <ArduinoJson.h>
#include <SoftwareSerial.h>
#include <OneWire.h> 
#include <DallasTemperature.h>
#include "sensors_NodeMCU.h" 

#define TINY_GSM_MODEM_SIM7600
#include <TinyGsmClient.h>

// --- Config Pins (Software Serial) ---
#define MODEM_RX_PIN     D2 // ต่อกับ TX ของ A7670E
#define MODEM_TX_PIN     D1 // ต่อกับ RX ของ A7670E

const char apn[] = "internet";
const char blynk_auth_token[] = "HOXuSs6Dv2u6DS18cbc7VRxCylCCzVC0"; 

const uint64_t SLEEP_DURATION_US = 600e6; // 10 นาที

struct {
  uint32_t crc32;
  int cycleCounter;
  int failCounter;
} rtcData;

SoftwareSerial SerialAT(MODEM_RX_PIN, MODEM_TX_PIN); 
TinyGsm modem(SerialAT); 

TemperatureSensor tempSensor(D5);
TDSSensor tdsSensor(A0, &tempSensor);

float ph=0, orp=0, tds=0, temp=0;
int tur=0;
char jsonBuffer[128];
byte bufferIndex = 0;

// --- Helper Functions ---
uint32_t calculateCRC32(const uint8_t *data, size_t length) {
  uint32_t crc = 0xffffffff;
  while (length--) {
    uint8_t c = *data++;
    for (uint32_t i = 0x80; i > 0; i >>= 1) {
      bool bit = crc & 0x80000000;
      if (c & i) bit = !bit;
      crc <<= 1;
      if (bit) crc ^= 0x04c11db7;
    }
  }
  return crc;
}

// ฟังก์ชันรีเซ็ตและปลุก (Wake & Clean Reset)
void cleanSoftReset() {
  // 1. เปิด Serial มาคุยก่อน
  SerialAT.begin(9600);
  delay(100);

  // 2. ยิงกระตุ้น (เผื่อหลับลึกจาก CFUN=0)
  modem.sendAT(GF(""));
  delay(100);

  // 3. สั่ง Reset ระบบ (Reset จะยกเลิก Flight Mode อัตโนมัติ)
  modem.sendAT(GF("+CRESET")); 
  // ไม่รอ Response เพราะจะรีบตัดสาย

  // 4. ตัดสัญญาณทันที! (Anti-Backfeed) 
  // เพื่อไม่ให้ไฟจาก NodeMCU ไปเลี้ยง 
  SerialAT.end(); 
  
  pinMode(MODEM_TX_PIN, OUTPUT); digitalWrite(MODEM_TX_PIN, LOW); // 0V
  pinMode(MODEM_RX_PIN, OUTPUT); digitalWrite(MODEM_RX_PIN, LOW); // 0V

  // 5. รอเวลาบูต 20 วินาที (ให้มันบูตแบบไม่มีไฟกวน)
  delay(20000); 

  // 6. เปิดสัญญาณกลับมา
  SerialAT.begin(9600); 
  delay(100);
  
  // 7. ล้างขยะ Buffer
  while(SerialAT.available()) { SerialAT.read(); }
}

// ฟังก์ชันเข้านอน (Sleep & Cut Power)
void goToSleep() {
  // 1. สั่งเข้า Flight Mode
  modem.sendAT(GF("+CFUN=0")); 
  modem.waitResponse(10000L); // รอให้จบงาน

  // 2. ตัดสัญญาณขา Data ทิ้ง (สำคัญมากสำหรับ USB Power!)
  // ถ้าไม่ตัด ไฟจะไหลไปเลี้ยง Modem ตอนนอน ทำให้มันค้าง
  SerialAT.end();
  pinMode(MODEM_TX_PIN, OUTPUT); digitalWrite(MODEM_TX_PIN, LOW);
  pinMode(MODEM_RX_PIN, OUTPUT); digitalWrite(MODEM_RX_PIN, LOW);
  
  //digitalWrite(MODEM_DTR_PIN, HIGH); 
  ESP.deepSleep(SLEEP_DURATION_US);
}

void sendToBlynkHTTP_AT() {
  bool success = false;
  modem.sendAT(GF("+HTTPINIT"));
  modem.waitResponse();

  String url = "http://blynk.cloud/external/api/batch/update?token=" + String(blynk_auth_token) +
               "&v0=" + String(ph, 2) +
               "&v1=" + String(orp, 0) +
               "&v2=" + String(tur) +
               "&v3=" + String(tds, 0) +
               "&v4=" + String(temp, 2);

  for (int attempt = 1; attempt <= 3; attempt++){

    modem.sendAT(GF("+HTTPTERM"));
    modem.waitResponse(5000L);

    modem.sendAT(GF("+HTTPINIT"));
    modem.waitResponse(5000L);

  modem.sendAT(GF("+HTTPPARA=\"URL\",\""), url, GF("\""));
  modem.waitResponse();

  modem.sendAT(GF("+HTTPACTION=0"));
  
  if (modem.waitResponse(20000L, GF("+HTTPACTION: 0,200")) == 1) {
    success = true;
    break;
     // Success
  } else {
     // Error
     delay(3000);
  }
}

  modem.sendAT(GF("+HTTPTERM"));
  modem.waitResponse();

  if (!success) {
    rtcData.failCounter++;
  } else {
    delay(2000);
  }

}

void setup() {
  // Hardware Serial เอาไว้คุยกับ Arduino
  Serial.begin(9600); 
  delay(1000); 

  //pinMode(MODEM_DTR_PIN, OUTPUT);
  //digitalWrite(MODEM_DTR_PIN, LOW); 

  // --- RTC Check ---
  bool rtcValid = false;
  if (ESP.rtcUserMemoryRead(0, (uint32_t*) &rtcData, sizeof(rtcData))) {
    if (calculateCRC32((uint8_t*)&rtcData.cycleCounter, sizeof(rtcData)) == rtcData.crc32) {
      rtcValid = true;
    }
  }
  if (!rtcValid) { rtcData.cycleCounter = 0; rtcData.failCounter = 0; }

  // ==========================================
  // 1. WAKE UP & RESET (Clean Start)
  // ==========================================
  // ฟังก์ชันนี้จะทำหน้าที่ Reset โมเด็มให้ตื่นจาก CFUN=0 ด้วย
  cleanSoftReset();

  // ==========================================
  // 2. CONNECT
  // ==========================================
  // รอจับสัญญาณ (หลังจาก Reset ต้องรอเสมอ)
  if (!modem.waitForNetwork(60000L)) {
    rtcData.failCounter++;
    goToSleep(); 
    return;
  }

  modem.sendAT(GF("+NETOPEN"));
  modem.waitResponse(10000L); 
  
  delay(1000);

  modem.sendAT(GF("E0"));
  modem.waitResponse();

  modem.sendAT(GF("+CREG=2"));
  modem.waitResponse();


  // --- Read Arduino (Hardware Serial) ---
  while(Serial.available()) Serial.read(); 
  for(int i=0; i<3; i++) { Serial.print('R'); delay(50); }

  unsigned long start = millis();
  while(millis() - start < 4000) {
    if (Serial.available()) {
      char c = Serial.read(); 
      if (c == '{') bufferIndex = 0;
      if (bufferIndex < sizeof(jsonBuffer) - 1) jsonBuffer[bufferIndex++] = c;
      if (c == '\n' && bufferIndex > 0) {
        jsonBuffer[bufferIndex] = '\0';
        if (strchr(jsonBuffer, '}')) {
          if (parseArduinoData(jsonBuffer)) {
             memset(jsonBuffer, 0, sizeof(jsonBuffer));
             break;
          }
        }
        bufferIndex = 0;
      }
    }
    yield();
  }

  readLocalSensors();
  sendToBlynkHTTP_AT(); 

  rtcData.cycleCounter++;
  rtcData.crc32 = calculateCRC32((uint8_t*) &rtcData.cycleCounter, sizeof(rtcData));
  ESP.rtcUserMemoryWrite(0, (uint32_t*) &rtcData, sizeof(rtcData));

  goToSleep();
}

void loop() {
}

// ... คงฟังก์ชัน readLocalSensors และ parseArduinoData ไว้ ...
void readLocalSensors() {
  tempSensor.begin(); 
  tdsSensor.begin();
  unsigned long w = millis();
  while(millis() - w < 1000) {
    tempSensor.update(); tdsSensor.update(); yield();
  }
  tds = tdsSensor.read();
  temp = tempSensor.read();
}

bool parseArduinoData(char* jsonString) {
  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, jsonString);
  if (error) return false;
  ph  = doc["ph"] | 0.0;
  orp = doc["orp"] | 0.0;
  tur = doc["tur"] | 0;
  return true;
}