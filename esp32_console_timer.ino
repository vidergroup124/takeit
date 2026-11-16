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

// ================= 1. ตั้งค่าระบบ (ใช้ Firebase ตัวเดิมของเว็บ TakeIT ได้เลย) =================
String FIREBASE_PROJECT_ID = "takeit-ebb5e";
String FIREBASE_API_KEY    = "AIzaSyDUAxkwmUt6WPUTj294qhPeGwpHOp3772A";
String CONSOLE_ID          = "PS4_01"; // ตั้งชื่อรหัสเครื่อง (เช่น PS4_01, PS4_02, PS5_01, NSW_01)
// ============================================================================================

#define BOOT_BUTTON 0 // ปุ่ม BOOT บนบอร์ด สำหรับกดค้าง 3 วินาทีเพื่อรีเซ็ต Wi-Fi เวลาเปลี่ยนบ้านลูกค้า
#define LED_PIN 2     // ไฟสถานะสีฟ้าบนบอร์ด

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 7 * 3600; // เวลาประเทศไทย (UTC+7)
const int   daylightOffset_sec = 0;

unsigned long lastUpdate = 0;
const unsigned long updateInterval = 60000; // ส่งข้อมูลทุกๆ 1 นาที (60,000 ms)

String sessionID = "";
String sessionStartStr = "";
int sessionMinutes = 0;

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

// ฟังก์ชันอ่านจำนวนนาทีสะสมเดิมจาก Firebase Firestore (คอลเลกชัน ps4_tracker ของเว็บ TakeIT)
int getCurrentTotalMinutes() {
  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  String url = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
               "/databases/(default)/documents/ps4_tracker/" + CONSOLE_ID +
               "?key=" + FIREBASE_API_KEY;

  http.begin(client, url);
  int httpResponseCode = http.GET();
  int totalMins = 0;

  if (httpResponseCode == 200) {
    String payload = http.getString();
    // ค้นหาค่า "total_minutes" จาก Firestore JSON response
    int keyIdx = payload.indexOf("\"total_minutes\"");
    if (keyIdx != -1) {
      int intIdx = payload.indexOf("\"integerValue\"", keyIdx);
      if (intIdx != -1) {
        int colonIdx = payload.indexOf(":", intIdx);
        int valStart = payload.indexOf("\"", colonIdx);
        int valEnd = payload.indexOf("\"", valStart + 1);
        if (valStart != -1 && valEnd != -1) {
          totalMins = payload.substring(valStart + 1, valEnd).toInt();
        }
      }
    }
  }
  http.end();
  return totalMins;
}

// ฟังก์ชันส่งข้อมูลอัปเดตเข้า Firebase ตัวเดิมของเว็บ TakeIT (อัปเดตหน้าเว็บแบบ Real-time ทันที)
void updateFirebase(bool isInitialBoot) {
  if (WiFi.status() != WL_CONNECTED) return;

  WiFiClientSecure client;
  client.setInsecure();
  HTTPClient http;

  int totalMinutes = getCurrentTotalMinutes();
  if (!isInitialBoot) {
    totalMinutes += 1;
    sessionMinutes += 1;
  }

  float totalHours = round((totalMinutes / 60.0) * 100.0) / 100.0;
  String currentTimeStr = getFormattedTime("%d/%m/%Y %H:%M:%S");
  unsigned long currentEpoch = getEpochTime();

  // อัปเดตเฉพาะฟิลด์เวลาของบอร์ด โดยไม่ทับข้อมูลชื่อลูกค้าหรือเรทราคาที่แอดมินตั้งไว้บนเว็บ
  String updateMask = "updateMask.fieldPaths=console_name"
                      "&updateMask.fieldPaths=deviceId"
                      "&updateMask.fieldPaths=total_minutes"
                      "&updateMask.fieldPaths=total_hours"
                      "&updateMask.fieldPaths=last_active"
                      "&updateMask.fieldPaths=last_timestamp"
                      "&updateMask.fieldPaths=current_session"
                      "&updateMask.fieldPaths=session_start"
                      "&updateMask.fieldPaths=session_minutes"
                      "&updateMask.fieldPaths=powerStatus";

  String firestoreUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
                        "/databases/(default)/documents/ps4_tracker/" + CONSOLE_ID +
                        "?" + updateMask + "&key=" + FIREBASE_API_KEY;

  String body = "{";
  body += "\"fields\":{";
  body += "\"console_name\":{\"stringValue\":\"" + CONSOLE_ID + "\"},";
  body += "\"deviceId\":{\"stringValue\":\"" + CONSOLE_ID + "\"},";
  body += "\"total_minutes\":{\"integerValue\":\"" + String(totalMinutes) + "\"},";
  body += "\"total_hours\":{\"doubleValue\":" + String(totalHours, 2) + "},";
  body += "\"last_active\":{\"stringValue\":\"" + currentTimeStr + "\"},";
  body += "\"last_timestamp\":{\"integerValue\":\"" + String(currentEpoch) + "\"},";
  body += "\"current_session\":{\"stringValue\":\"" + sessionID + "\"},";
  body += "\"session_start\":{\"stringValue\":\"" + sessionStartStr + "\"},";
  body += "\"session_minutes\":{\"integerValue\":\"" + String(sessionMinutes) + "\"},";
  body += "\"powerStatus\":{\"stringValue\":\"online\"}";
  body += "}}";

  http.begin(client, firestoreUrl);
  http.addHeader("Content-Type", "application/json");
  int httpCode1 = http.PATCH(body);
  http.end();

  // บันทึกประวัติการเล่นรายรอบ (Session History)
  String sessionUrl = "https://firestore.googleapis.com/v1/projects/" + FIREBASE_PROJECT_ID +
                      "/databases/(default)/documents/ps4_tracker/" + CONSOLE_ID +
                      "/sessions/" + sessionID + "?key=" + FIREBASE_API_KEY;

  String sessionBody = "{";
  sessionBody += "\"fields\":{";
  sessionBody += "\"start_time\":{\"stringValue\":\"" + sessionStartStr + "\"},";
  sessionBody += "\"last_seen\":{\"stringValue\":\"" + currentTimeStr + "\"},";
  sessionBody += "\"duration_minutes\":{\"integerValue\":\"" + String(sessionMinutes) + "\"}";
  sessionBody += "}}";

  http.begin(client, sessionUrl);
  http.addHeader("Content-Type", "application/json");
  int httpCode2 = http.PATCH(sessionBody);
  http.end();

  // ไฟสีฟ้ากะพริบ 1 ครั้งเมื่อส่งข้อมูลสำเร็จ
  if (httpCode1 == 200 && httpCode2 == 200) {
    Serial.printf("[TakeIT Firebase Updated] Console: %s | Total: %d mins (%.2f hrs) | Session: %d mins\n",
                  CONSOLE_ID.c_str(), totalMinutes, totalHours, sessionMinutes);
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
  sessionMinutes = 0;

  // ส่งสถานะตอนเปิดเครื่องรอบนี้ทันที
  updateFirebase(true);
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

  // ส่งข้อมูลอัปเดตทุกๆ 1 นาที
  if (millis() - lastUpdate >= updateInterval) {
    lastUpdate = millis();
    updateFirebase(false);
  }
}
