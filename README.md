# 🐟 ระบบตรวจวัดคุณภาพน้ำสำหรับบ่อเลี้ยงปลาสลิดด้วยเทคโนโลยี IoT

## 📖 ความเป็นมาของโครงการ
โครงการนี้เริ่มต้นขึ้นเพื่อแก้ปัญหาในพื้นที่เกษตรกรรมของจังหวัดสมุทรสงคราม ซึ่งมีการเพาะเลี้ยงปลาสลิดเป็นจำนวนมาก แหล่งน้ำแต่ละบ่อมีสภาพแวดล้อมที่แตกต่างกันและอาจเกิดความผิดปกติ (เช่น ค่าความเป็นกรด-ด่างไม่เหมาะสม หรือมีสารปนเปื้อน) ซึ่งส่งผลกระทบต่อสุขภาพและอัตราการรอดของปลาโดยตรง การเก็บตัวอย่างน้ำไปตรวจที่ห้องปฏิบัติการนั้นใช้เวลานานและมีค่าใช้จ่ายสูง เราจึงได้พัฒนาระบบเทคโนโลยี Internet of Things (IoT) ขึ้นมาเพื่อคอยตรวจจับและแจ้งเตือนค่าคุณภาพน้ำแบบทันที (Real-time) ช่วยให้เกษตรกรสามารถรับมือและแก้ไขปัญหาได้รวดเร็วขึ้น

## 🛠️ อุปกรณ์ฮาร์ดแวร์ที่ใช้

* **NodeMCU V2 ESP8266:** บอร์ดไมโครคอนโทรลเลอร์พร้อมตัวกระจายสัญญาณ Wi-Fi ทำหน้าที่รับข้อมูลและส่งขึ้นคลาวด์
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/ESP8266.png" alt="NodeMCU V2 ESP8266"></details>

* **Arduino UNO R3:** บอร์ดสำหรับรับค่าจากเซ็นเซอร์แอนะล็อกเพื่อเพิ่มความเสถียรของสัญญาณก่อนส่งต่อ
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/ArduinoUNO.jpg" alt="Arduino UNO R3"></details>

* **Sensor วัดอุณหภูมิในน้ำ (DS18B20):** เซ็นเซอร์ดิจิทัลสำหรับวัดอุณหภูมิของเหลว
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Sensor Temp.jpg" alt="DS18B20 Temperature Sensor"></details>

* **Sensor วัดค่าความขุ่น:** อุปกรณ์สำหรับเช็คปริมาณสารแขวนลอยในน้ำ
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Sensor Turb.jpg" alt="Turbidity Sensor"></details>

* **Sensor วัดค่า TDS:** เซ็นเซอร์ตรวจจับปริมาณของแข็งที่ละลายในน้ำ เพื่อบ่งชี้ความบริสุทธิ์
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Sensor TDS.jpg" alt="TDS Sensor"></details>

* **Sensor วัดค่า pH:** อุปกรณ์ตรวจสอบระดับความเป็นกรด-ด่างของน้ำ
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Sensor pH.jpg" alt="pH Sensor"></details>

* **Sensor วัดค่า ORP:** เซ็นเซอร์วัดศักย์ไฟฟ้าเพื่อดูการปนเปื้อนและปฏิกิริยาในน้ำ
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Sensor ORP.jpg" alt="ORP Sensor"></details>

* **โมดูลสื่อสารไร้สาย 4G LTE Cat 1 (A7670E):** อุปกรณ์รับส่งข้อมูลความเร็วสูงผ่านเครือข่ายมือถือ
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/A7670E.png" alt="4G LTE Cat 1 A7670E"></details>

* **แผงโซล่าเซลล์ (10 วัตต์):** แหล่งกำเนิดพลังงานแสงอาทิตย์สำหรับจ่ายไฟให้ระบบ
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Solar Panel.jpg" alt="10W Solar Panel"></details>

* **เครื่องควบคุมการชาร์จ (PWM):** อุปกรณ์ควบคุมและจัดการกระแสไฟจากแผงโซล่าเซลล์เพื่อชาร์จลงแบตเตอรี่
  <details><summary>📸 ดูรูปภาพ</summary><img src=".assets/Hardware/Solar Charge Controllers.jpg" alt="PWM Solar Charge Controller"></details>

---

## 🔌 การทำงานและการต่อวงจร (Circuit & Data Flow)
ระบบมีการแบ่งการประมวลผลเพื่อลดภาระและเพิ่มความเสถียร บอร์ด Arduino จะรับหน้าที่อ่านค่าจากเซ็นเซอร์ pH, ORP และความขุ่น (แอนะล็อก) ส่วน NodeMCU จะอ่านค่า TDS และอุณหภูมิโดยตรง

หลังจาก Arduino รวบรวมค่าได้ จะส่งข้อมูลต่อไปให้ NodeMCU ทางพอร์ต Serial (TX-RX) เมื่อประมวลผลความถูกต้องเสร็จสิ้น NodeMCU จะส่งข้อมูลทั้งหมดขึ้นเซิร์ฟเวอร์ผ่านโมดูล 4G (A7670E) และเข้าสู่โหมดประหยัดพลังงาน (Sleep Mode) อัตโนมัติเพื่อลดการใช้ไฟจากโซล่าเซลล์

<div align="center">
  <img src=".assets/circuit.jpg" alt="IoT Circuit Diagram">
  <p><em>ภาพรวมการต่อวงจรของระบบ IoT วัดคุณภาพน้ำ</em></p>
</div>

---

## 📱 การออกแบบส่วนเชื่อมต่อผู้ใช้ (User Interface)
ระบบนี้ถูกออกแบบมาเพื่อให้ผู้ใช้งานดูข้อมูลและรับการแจ้งเตือนได้สะดวกที่สุด:
1. **Cloud Connection:** ข้อมูลจากบอร์ดจะถูกส่งขึ้นไปเก็บบนแพลตฟอร์มคลาวด์ของ Blynk
2. **Database System:** เราใช้งาน Google Apps Script (GAS) เพื่อดึงข้อมูลจาก Blynk มาบันทึกลง Google Sheet อย่างเป็นระบบ
3. **LINE Official Account:** แจ้งเตือนและติดต่อกับผู้ใช้งานผ่าน LINE Messaging API ทำให้สามารถส่งรายงานสถานะน้ำ แจ้งเตือนเมื่อค่าผิดปกติ และมีเมนู (Rich Menu) สำหรับตั้งค่าเปิด-ปิดการแจ้งเตือนได้ทันที

<div align="center">
  <img src=".assets/User Interface Design.jpg" alt="User Interface and LINE Application Integration">
  <p><em>โครงสร้างส่วนเชื่อมต่อระหว่าง Cloud, Database และ LINE Application</em></p>
</div>
