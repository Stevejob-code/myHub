# MyHub v1 Firebase Ready

เว็บแอป Personal Life Hub สำหรับมือถือเป็นหลัก

## มีอะไรใน v1
- Login / Register ด้วย Firebase Authentication
- Dashboard
- Bottom Navigation
- รายรับรายจ่าย
- งาน / เตือนความจำ
- หนัง / ซีรีส์
- โน้ต / ลิงก์
- Profile แก้ชื่อและรูปด้วย URL ได้
- แยกข้อมูลตาม userId ใน Firestore

## ก่อนเปิดใช้งาน
ใน Firebase Console ของโปรเจค `myhub-jobz` ให้เปิด:

1. Authentication > Sign-in method > Email/Password
2. Firestore Database > Create database
3. Firestore Rules ให้ใช้ไฟล์ `firestore.rules`

## วิธีเปิดทดสอบบนเครื่อง
แนะนำให้เปิดผ่าน local server ไม่ใช่ดับเบิลคลิกไฟล์โดยตรง

### ถ้ามี Python
```bash
cd myhub-v1-ready
python -m http.server 5500
```
แล้วเปิด:
```text
http://localhost:5500
```

## Deploy Cloudflare Pages
- Build command: เว้นว่าง
- Output directory: `/`

