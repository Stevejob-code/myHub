# MyHub v3

Web App ส่วนตัวสำหรับมือถือ: Dashboard, รายรับรายจ่าย, งาน, Watchlist, Notes/Links และ Profile

## สิ่งที่เพิ่มใน v2
- Quick Add แบบ Bottom Sheet
- แก้ไข / ลบข้อมูลทุกโมดูล
- Filter รายรับ/รายจ่าย
- Filter งานทั้งหมด/ค้าง/เสร็จแล้ว
- ค้นหาหนัง/ซีรีส์ และโน้ต/ลิงก์
- UI มือถือเนียนขึ้น

## วิธี deploy
ใช้ Cloudflare Pages:
- Framework preset: None
- Build command: เว้นว่าง
- Build output directory: /

## Firebase
ไฟล์ config อยู่ที่ `src/js/firebase.js`
เปิดใช้งาน:
- Authentication > Email/Password
- Firestore Database

## Firestore Rules
ดูตัวอย่างได้ใน `firestore.rules`


## สิ่งที่เพิ่มใน v3
- PWA ติดตั้งเป็นแอปได้
- Dashboard มีกราฟรายจ่าย 7 วัน
- สรุปหมวดใช้เงินเยอะสุด งานเลยกำหนด Watchlist และโน้ต
- Profile มีสถิติส่วนตัว
- สลับธีมมืด/สว่าง


## v4 Phase 1

เพิ่มฟีเจอร์:
- Smart Insights บน Dashboard
- Quick Add อัจฉริยะจากข้อความ เช่น `กินข้าว 80 #อาหาร`
- Tag system สำหรับ Money, Tasks, Watchlist, Notes
- แสดงแท็กใต้รายการ
- Insight จากงานค้าง รายจ่าย หมวดที่ใช้เยอะ และแท็กยอดนิยม

ตัวอย่าง Quick Add:
- `กินข้าว 80 #อาหาร`
- `พรุ่งนี้ประชุม 10 โมง #งาน`
- `ดู One Piece #anime`
- `https://example.com เครื่องมือ dev #dev`
