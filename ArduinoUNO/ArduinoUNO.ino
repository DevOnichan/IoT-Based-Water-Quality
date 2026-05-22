/* Arduino Uno (Sensor Slave) */
#include <Arduino.h>
#include "sensors_Arduino.h"
#include <stdio.h>

#include <avr/wdt.h>

const int PH_PIN = A0;
const int ORP_PIN = A2;
const int TURBIDITY_PIN = A4;

pHSensor phSensor(PH_PIN);
ORPSensor orpSensor(ORP_PIN);
TurbiditySensor turbiditySensor(TURBIDITY_PIN);

void setup() {
  Serial.begin(9600);
  phSensor.begin();
  orpSensor.begin();
  turbiditySensor.begin();

  wdt_enable(WDTO_4S);
}

void loop() {
  // Update ค่าตลอดเวลา เพื่อให้พร้อมส่งเสมอ
  wdt_reset();

  phSensor.update();
  orpSensor.update();

  // *** รอฟังคำสั่งจาก NodeMCU ***
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    
    // ถ้าเจอตัว 'R' (Request) ให้ส่งข้อมูลทันที
    if (cmd == 'R') {
      float ph = phSensor.read();
      double orp = orpSensor.read();
      int tur = turbiditySensor.read();
      
      // Validation & Cleaning
      if (isnan(ph) || ph < 0 || ph > 14) ph = 0.0;
      if (orp < -2000 || orp > 2000) orp = 0.0;
      if (tur < 0 || tur > 100) tur = 0;

      char phStr[10], orpStr[10];
      dtostrf(ph, 4, 2, phStr);
      dtostrf(orp, 4, 0, orpStr);

      char jsonBuffer[128];
      int charsWritten = snprintf(jsonBuffer, sizeof(jsonBuffer), "{\"ph\":%s,\"orp\":%s,\"tur\":%d}", phStr, orpStr, tur);
      
      // ส่ง JSON กลับไป
      if (charsWritten > 0 && charsWritten < sizeof(jsonBuffer)) {
      Serial.println(jsonBuffer);
  } 
      
      // เคลียร์ Buffer ขาเข้า (กันเบิ้ล)
      while(Serial.available()) Serial.read(); 
    }
  }
}