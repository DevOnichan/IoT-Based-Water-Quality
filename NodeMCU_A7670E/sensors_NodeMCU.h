#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ===================================
// Temperature Sensor Class 
// ===================================
class TemperatureSensor {
private:
  OneWire oneWire;
  DallasTemperature sensors;
  unsigned long lastRequestTime = 0;
  float temperature = -999.0;
  bool newDataReady = false;
  bool isWaitingForConversion = false;
  const unsigned long conversionTime = 750;

public:
  TemperatureSensor(int pin) : oneWire(pin), sensors(&oneWire) {}
  
  void begin() {
    sensors.begin();
    sensors.setWaitForConversion(false); 
  }
  
  void update() {
    if (!isWaitingForConversion) {
      sensors.requestTemperatures();
      lastRequestTime = millis();
      isWaitingForConversion = true;
    } else if (millis() - lastRequestTime > conversionTime) {
      float tempC = sensors.getTempCByIndex(0);
      if (tempC != DEVICE_DISCONNECTED_C) {
        temperature = tempC;
        newDataReady = true;
      }
      isWaitingForConversion = false;
    }
  }
  
  float read() { return temperature; }
};

// ===================================
// TDS Sensor Class 
// ===================================
class TDSSensor {
private:
  int tdsPin;
  
  const float VREF = 3.3; 
  
  const int SCOUNT = 30;
  int analogBuffer[30];
  int analogBufferTemp[30];
  int analogBufferIndex = 0;
  float averageVoltage = 0;
  float tdsValue = 0;
  unsigned long lastSampleTime = 0;
  unsigned long lastReadTime = 0;
  bool newDataReady = false;

  // K-Factor ของหัววัด ปรับตามสัดส่วน เดิม = 0.5
  float CALIBRATION_FACTOR = 0.33; 

  TemperatureSensor* tempSensorPtr;

  int getMedianNum(int bArray[], int iFilterLen) {
    int bTab[iFilterLen];
    for (byte i = 0; i < iFilterLen; i++) bTab[i] = bArray[i];
    int i, j, bTemp;
    for (j = 0; j < iFilterLen - 1; j++) {
      for (i = 0; i < iFilterLen - j - 1; i++) {
        if (bTab[i] > bTab[i + 1]) { bTemp = bTab[i]; bTab[i] = bTab[i + 1]; bTab[i + 1] = bTemp; }
      }
    }
    if ((iFilterLen & 1) > 0) bTemp = bTab[(iFilterLen - 1) / 2];
    else bTemp = (bTab[iFilterLen / 2] + bTab[iFilterLen / 2 - 1]) / 2;
    return bTemp;
  }

public:
  TDSSensor(int pin, TemperatureSensor* tempSensor) : tdsPin(pin), tempSensorPtr(tempSensor) {
    memset(analogBuffer, 0, sizeof(analogBuffer));
  }
  
  void begin() { pinMode(tdsPin, INPUT); }
  
  void update() {
    if (millis() - lastSampleTime > 40) {
      lastSampleTime = millis();
      analogBuffer[analogBufferIndex] = analogRead(tdsPin);
      analogBufferIndex++;
      if (analogBufferIndex == SCOUNT) analogBufferIndex = 0;
    }
    
    if (millis() - lastReadTime > 800) {
      lastReadTime = millis();
      for (int copyIndex = 0; copyIndex < SCOUNT; copyIndex++) analogBufferTemp[copyIndex] = analogBuffer[copyIndex];
      
      averageVoltage = getMedianNum(analogBufferTemp, SCOUNT) * (float)VREF / 1024.0;
      
      float currentTemp = tempSensorPtr->read();
      if(currentTemp <= 0 || currentTemp > 100) currentTemp = 25.0;
      
      float compensationCoefficient = 1.0 + 0.02 * (currentTemp - 25.0);
      float compensationVolatge = averageVoltage / compensationCoefficient;
      
      tdsValue = (133.42 * compensationVolatge * compensationVolatge * compensationVolatge - 
                  255.86 * compensationVolatge * compensationVolatge + 
                  857.39 * compensationVolatge) * CALIBRATION_FACTOR; 
      
      newDataReady = true;
    }
  }
  
  float read() { return tdsValue; }
};

#endif