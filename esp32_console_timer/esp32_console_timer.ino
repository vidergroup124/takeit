/**
 * TakeIT Gaming & Console — โค้ดบอร์ด ESP32 นับชั่วโมงเครื่องคอนโซลแบบ Real-time
 * - ใช้ Firebase ตัวเดิมของหน้าเว็บ TakeIT (Project: takeit-ebb5e) ได้เลยทันที!
 * - ไม่ต้องสร้าง Firebase ใหม่ และไม่ต้องใช้ Database Secret
 * - แก้ไขบั๊กเครื่องหมาย * และ : ให้เรียบร้อยพร้อมคอมไพล์
 */

#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include "time.h"

// ================= 1. ตั้งค่าระบบ (ใช้ Firebase Realtime Database ของเว็บ TakeIT) =================
// หากตอนสร้าง Realtime Database เลือกเซิร์ฟเวอร์ Singapore ให้ใช้ .asia-southeast1.firebasedatabase.app
// (หากเลือก United States ให้เปลี่ยนเป็น https://takeit-ebb5e-default-rtdb.firebaseio.com)
String FIREBASE_RTDB_URL   = "https://takeit-ebb5e-default-rtdb.asia-southeast1.firebasedatabase.app";
String CONSOLE_ID          = "PS4_01"; // ตั้งชื่อรหัสเครื่อง (เช่น PS4_01, PS4_02, PS5_01, NSW_01)
// ============================================================================================

#define BOOT_BUTTON 0 // ปุ่ม BOOT บนบอร์ด สำหรับกดค้าง 3 วินาทีเพื่อรีเซ็ต Wi-Fi เวลาเปลี่ยนบ้านลูกค้า
#define LED_PIN 2     // ไฟสถานะสีฟ้าบนบอร์ด

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600; // เวลาประเทศไทย (UTC+7)
const int   daylightOffset_sec = 0;

unsigned long lastUpdate = 0;
const unsigned long updateInterval = 3000; // ส่งข้อมูลสดเข้า Realtime Database ทุกๆ 3 วินาที!
const int heartbeatIntervalSec = 3;

String sessionID = "";
String sessionStartStr = "";
unsigned long sessionSeconds = 0;
unsigned long lastSyncedTotalSeconds = 0;
unsigned int syncCounter = 0;
bool hasSyncedCloudBaseline = false;

// ฟังก์ชันดึงเวลาปัจจุบัน
String getFormattedTime(const char* format) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "Unknown_Time";
  }
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), format, &timeinfo);
  return String(timeStringBuff);
}

// ฟังก์ชันดึงค่า Timestamp (Epoch วินาที)
unsigned long getEpochTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return 0;
  }
  time(&now);
  return now;
}

// ช่วยดึงค่า integer จาก Firestore REST JSON อย่างปลอดภัย
long extractFirestoreInt(const String& payload, const char* fieldName, long fallback = -1) {
  String searchKey = String("\"") + fieldName + "\"";
  int keyIdx = payload.indexOf(searchKey);
  if (keyIdx == -1) return fallback;
  int objEnd = payload.indexOf("}", keyIdx);
  int intIdx = payload.indexOf("\"integerValue\"", keyIdx);
  if (intIdx == -1 || (objEnd != -1 && intIdx > objEnd)) return fallback;
  int colonIdx = payload.indexOf(":", intIdx);
  int valStart = payload.indexOf("\"", colonIdx);
  int valEnd = payload.indexOf("\"", valStart + 1);
  if (valStart != -1 && valEnd != -1) {
    return payload.substring(valStart + 1, valEnd).toInt();
  }
  return fallback;
}

// ฟังก์ชันอ่านจำนวนวินาทีสะสมเดิมจาก Firebase Realtime Database (คืนค่า true เมื่ออ่านสำเร็จ เพื่อป้องกันการเขียน 0 ทับยอดเดิม)
bool fetchCloudTotalSeconds(unsigned long& outSecs) {
  for (int attempt = 0; attempt < 2; attempt++) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    http.setTimeout(10000);

    String secUrl = FIREBASE_RTDB_URL + "/ps4_tracker/" + CONSOLE_ID + "/total_seconds.json";
    http.begin(client, secUrl);
    int code = http.GET();

    if (code == 200) {
      String payload = http.getString();
      payload.trim();
      http.end();
      if (payload != "null" && payload.length() > 0) {
        long val = payload.toInt();
        outSecs = val > 0 ? (unsigned long)val : 0;
        return true;
      }

      // ถ้ายังไม่มี total_seconds ใน RTDB ให้ลองเช็ก total_minutes แทน
      WiFiClientSecure clientMin;
      clientMin.setInsecure();
      HTTPClient httpMin;
      httpMin.setTimeout(10000);
      httpMin.begin(clientMin, FIREBASE_RTDB_URL + "/ps4_tracker/" + CONSOLE_ID + "/total_minutes.json");
      int minCode = httpMin.GET();
      if (minCode == 200) {
        String minPayload = httpMin.getString();
        minPayload.trim();
        httpMin.end();
        if (minPayload != "null" && minPayload.length() > 0) {
          long m = minPayload.toInt();
          outSecs = m > 0 ? (unsigned long)m * 60UL : 0;
        } else {
          outSecs = 0;
        }
        return true;
      }
      httpMin.end();
      outSecs = 0;
      return true;
    } else {
      Serial.printf("[RTDB GET Warning attempt %d] Code: %d (%s)\n",
                    attempt + 1, code, http.errorToString(code).c_str());
      http.end();
      delay(400);
    }
  }
  return false;
}

// ฟังก์ชันส่งข้อมูลอัปเดตเข้า Firebase Realtime Database ของเว็บ TakeIT (อัปเดตสดทุกๆ 3 วินาที)
void updateFirebase(bool isInitialBoot, unsigned long deltaSeconds = 0) {
  if (WiFi.status() != WL_CONNECTED) return;

  // เช็กยอดสะสมล่าสุดจาก RTDB ทุกครั้งก่อนบวกเพิ่ม เพื่อให้รับรู้ทันทีหากแอดมินกดรีเซ็ตเป็น 0 บนหน้าเว็บ
  unsigned long totalSeconds = lastSyncedTotalSeconds;
  unsigned long cloudSecs = 0;
  if (fetchCloudTotalSeconds(cloudSecs)) {
    hasSyncedCloudBaseline = true;
    totalSeconds = cloudSecs;
  }

  if (!isInitialBoot) {
    if (hasSyncedCloudBaseline && totalSeconds == 0 && lastSyncedTotalSeconds >= (unsigned long)heartbeatIntervalSec) {
      sessionSeconds = 0; // กรณีแอดมินกดรีเซ็ตบิลบนหน้าเว็บ
    }
    totalSeconds += deltaSeconds;
    sessionSeconds += deltaSeconds;
  }
  lastSyncedTotalSeconds = totalSeconds;

  unsigned long totalMinutes = totalSeconds / 60UL;
  unsigned long sessionMinutes = sessionSeconds / 60UL;
  float totalHours = round((totalSeconds / 3600.0) * 100.0) / 100.0;
  String currentTimeStr = getFormattedTime("%d/%m/%Y %H:%M:%S");
  unsigned long currentEpoch = getEpochTime();
  if (currentEpoch == 0) {
    struct tm retryTm;
    getLocalTime(&retryTm, 2000);
    currentEpoch = getEpochTime();
    currentTimeStr = getFormattedTime("%d/%m/%Y %H:%M:%S");
  }

  String rtdbUrl = FIREBASE_RTDB_URL + "/ps4_tracker/" + CONSOLE_ID + ".json";

  String body = "{";
  body += "\"console_name\":\"" + CONSOLE_ID + "\",";
  body += "\"deviceId\":\"" + CONSOLE_ID + "\",";
  body += "\"heartbeat_interval\":" + String(heartbeatIntervalSec) + ",";
  if (hasSyncedCloudBaseline) {
    body += "\"total_seconds\":" + String(totalSeconds) + ",";
    body += "\"total_minutes\":" + String(totalMinutes) + ",";
    body += "\"total_hours\":" + String(totalHours, 2) + ",";
    body += "\"session_minutes\":" + String(sessionMinutes) + ",";
  }
  body += "\"last_active\":\"" + currentTimeStr + "\",";
  body += "\"last_timestamp\":" + String(currentEpoch) + ",";
  body += "\"current_session\":\"" + sessionID + "\",";
  body += "\"session_start\":\"" + sessionStartStr + "\",";
  body += "\"powerStatus\":\"online\"";
  body += "}";

  int httpCode1 = -1;
  {
    WiFiClientSecure client1;
    client1.setInsecure();
    HTTPClient http1;
    http1.setTimeout(10000);
    http1.begin(client1, rtdbUrl);
    http1.addHeader("Content-Type", "application/json");
    httpCode1 = http1.PATCH(body);
    if (httpCode1 <= 0) {
      Serial.printf("[RTDB PATCH Error] Code: %d (%s)\n", httpCode1, http1.errorToString(httpCode1).c_str());
    }
    http1.end();
  }

  // บันทึกประวัติการเล่นรายรอบ (Session History) ตอนเปิดเครื่องและทุกๆ 1 นาที (20 รอบ x 3 วิ)
  int httpCode2 = 200;
  if (isInitialBoot || (syncCounter % 20 == 0)) {
    String sessionUrl = FIREBASE_RTDB_URL + "/ps4_tracker/" + CONSOLE_ID + "/sessions/" + sessionID + ".json";
    String sessionBody = "{";
    sessionBody += "\"start_time\":\"" + sessionStartStr + "\",";
    sessionBody += "\"last_seen\":\"" + currentTimeStr + "\",";
    sessionBody += "\"duration_minutes\":" + String(sessionMinutes);
    sessionBody += "}";

    WiFiClientSecure client2;
    client2.setInsecure();
    HTTPClient http2;
    http2.setTimeout(10000);
    http2.begin(client2, sessionUrl);
    http2.addHeader("Content-Type", "application/json");
    httpCode2 = http2.PATCH(sessionBody);
    http2.end();
  }
  syncCounter++;

  // ไฟสีฟ้ากะพริบ 1 ครั้งเมื่อส่งข้อมูลสำเร็จ
  if (httpCode1 == 200 && httpCode2 == 200) {
    Serial.printf("[TakeIT Firebase Updated] Console: %s | Total: %lu secs (%lu mins, %.2f hrs)\n",
                  CONSOLE_ID.c_str(), totalSeconds, totalMinutes, totalHours);
    digitalWrite(LED_PIN, HIGH);
    delay(150);
    digitalWrite(LED_PIN, LOW);
  } else {
    Serial.printf("[Firebase Error] Code: %d, %d\n", httpCode1, httpCode2);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(BOOT_BUTTON, INPUT_PULLUP);
  pinMode(LED_PIN, OUTPUT);

  // ระบบจัดการ Wi-Fi (ถ้ายังไม่เคยต่อ จะปล่อย Hotspot ชื่อ PS4_Timer_Setup รหัส 12345678)
  WiFiManager wm;
  wm.setConfigPortalTimeout(180);
  Serial.println("Connecting to WiFi...");
  if (!wm.autoConnect("PS4_Timer_Setup", "12345678")) {
    Serial.println("Failed to connect. Restarting...");
    delay(3000);
    ESP.restart();
  }
  Serial.println("WiFi Connected!");

  // ซิงค์เวลา NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  struct tm timeinfo;
  int retry = 0;
  while (!getLocalTime(&timeinfo) && retry < 20) {
    delay(500);
    retry++;
  }

  sessionID = getFormattedTime("%Y-%m-%d_%H-%M-%S");
  sessionStartStr = getFormattedTime("%d/%m/%Y %H:%M:%S");
  sessionSeconds = 0;

  // ส่งสถานะตอนเปิดเครื่องรอบนี้ทันที
  updateFirebase(true, 0);
  lastUpdate = millis();
}

void loop() {
  // กดปุ่ม BOOT บนบอร์ดค้างไว้ 3 วินาที เพื่อรีเซ็ต Wi-Fi (เวลาเปลี่ยนบ้านลูกค้า)
  if (digitalRead(BOOT_BUTTON) == LOW) {
    delay(3000);
    if (digitalRead(BOOT_BUTTON) == LOW) {
      Serial.println("Resetting WiFi...");
      for (int i = 0; i < 5; i++) {
        digitalWrite(LED_PIN, HIGH);
        delay(100);
        digitalWrite(LED_PIN, LOW);
        delay(100);
      }
      WiFiManager wm;
      wm.resetSettings();
      ESP.restart();
    }
  }

  // ส่งข้อมูลอัปเดตทุกๆ 15 วินาที
  unsigned long nowMillis = millis();
  if (nowMillis - lastUpdate >= updateInterval) {
    unsigned long deltaSec = (nowMillis - lastUpdate) / 1000UL;
    if (deltaSec == 0) deltaSec = heartbeatIntervalSec;
    lastUpdate = nowMillis;
    updateFirebase(false, deltaSec);
  }
}