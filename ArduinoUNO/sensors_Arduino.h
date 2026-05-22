// =================================================================================
// sensor.h
// ไฟล์นี้ประกอบด้วยคลาสของเซ็นเซอร์ pH, ORP และ Turbidity
// =================================================================================

#ifndef SENSORS_H
#define SENSORS_H

#include <Arduino.h>

// ===================================
// pH Sensor Class
// ===================================
class pHSensor {
private:
  int analogPin;
  float calibration; 
  
  int buf[10];        
  int sampleIndex;    
  unsigned long lastSampleTime; 
  float phValue;      
  bool newReadingAvailable; 
  static const unsigned long SAMPLE_INTERVAL = 30; 

  void calculateValue() {
    int tempBuf[10];
    for(int i=0; i<10; i++) { tempBuf[i] = buf[i]; }

    for (int i = 0; i < 9; i++) {
      for (int j = i + 1; j < 10; j++) {
        if (tempBuf[i] > tempBuf[j]) {
          int temp = tempBuf[i];
          tempBuf[i] = tempBuf[j];
          tempBuf[j] = temp;
        }
      }
    }

    unsigned long int avgValue = 0;
    for (int i = 2; i < 8; i++) avgValue += tempBuf[i];
    float pHVol = (float)avgValue * 5.0 / 1024 / 6;
    phValue = -5.70 * pHVol + calibration;
    newReadingAvailable = true;
  }

public:
  pHSensor(int pin, float cal = 21.24) : 
    analogPin(pin), calibration(cal), sampleIndex(0), 
    lastSampleTime(0), phValue(0), newReadingAvailable(false) {}

  void begin() {}
  
  void update() {
    if (millis() - lastSampleTime > SAMPLE_INTERVAL) {
      buf[sampleIndex] = analogRead(analogPin);
      sampleIndex++;
      lastSampleTime = millis();

      if (sampleIndex >= 10) {
        sampleIndex = 0;
        calculateValue();
      }
    }
  }
  
  float read() { return phValue; }
  
  bool isReadingReady() {
    if (newReadingAvailable) { 
      newReadingAvailable = false;
      return true; 
    }
    return false;
  }
};

// ===================================
// ORP Sensor Class
// ===================================
class ORPSensor {
private:
  static const float VOLTAGE;
  static const int OFFSET;
  static const int ArrayLenth = 100;
  int orpPin;
  int orpArray[ArrayLenth];
  int orpArrayIndex;
  double orpValue;
  unsigned long lastOrpTime;

  double avergearray(int* arr, int number) {
    int i; int max, min; double avg; long amount = 0;
    if (number <= 0) return 0;
    if (number < 5) { for (i = 0; i < number; i++) amount += arr[i]; avg = amount / number; }
    else {
      if (arr[0] < arr[1]) { min = arr[0]; max = arr[1]; } else { min = arr[1]; max = arr[0]; }
      for (i = 2; i < number; i++) {
        if (arr[i] < min) { amount += min; min = arr[i]; }
        else if (arr[i] > max) { amount += max; max = arr[i]; }
        else { amount += arr[i]; }
      }
      avg = (double)amount / (number - 2);
    }
    return avg;
  }

public:
  ORPSensor(int pin) : orpPin(pin), orpArrayIndex(0), orpValue(0), lastOrpTime(0) {}
  
  void begin() {
    for(int i = 0; i < ArrayLenth; i++) { orpArray[i] = 0; }
  }
  
  void update() {
    if (millis() - lastOrpTime > 20) {
      lastOrpTime = millis();
      orpArray[orpArrayIndex++] = analogRead(orpPin);
      if (orpArrayIndex == ArrayLenth) orpArrayIndex = 0;
      orpValue = ((30 * VOLTAGE * 1000) - (75 * avergearray(orpArray, ArrayLenth) * VOLTAGE * 1000 / 1024)) / 75 - OFFSET;
    }
  }
  
  double read() { return orpValue; }
};

const float ORPSensor::VOLTAGE = 5.00;
const int ORPSensor::OFFSET = 22;

// ===================================
// Turbidity Sensor Class
// ===================================
class TurbiditySensor {
private:
  int turbidityPin;
  const int CLEAR_WATER_RAW = 700; 
  const int OPAQUE_RAW = 0;

public:
  TurbiditySensor(int pin) : turbidityPin(pin) {}
  void begin() {}
  
  int read() {
    int sensorValue = analogRead(turbidityPin);
    int constrainedValue = constrain(sensorValue, OPAQUE_RAW, CLEAR_WATER_RAW);
    int turbidityPercent = map(constrainedValue, OPAQUE_RAW, CLEAR_WATER_RAW, 100, 0);
    return turbidityPercent;
  }
};

#endif // SENSORS_H