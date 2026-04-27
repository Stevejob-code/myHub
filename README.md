# MyHub - Tasks v6 Calendar + Reminder

อัปเกรดจากชุดล่าสุด พร้อมใช้งานกับ Firebase เดิม

## เพิ่มใน Tasks v6
- Calendar strip เลือกดูงานล่วงหน้า 14 วัน
- Date Picker กำหนดวันเองได้
- Time Picker สำหรับเวลางาน
- Reminder: ไม่เตือน / ตรงเวลา / ก่อน 10 นาที / ก่อน 30 นาที / ก่อน 1 ชั่วโมง
- ปุ่มเปิดแจ้งเตือนงาน
- Card งานแสดงเวลาและสถานะแจ้งเตือน
- แก้ไขงานรองรับเวลาและแจ้งเตือน

หมายเหตุ: การแจ้งเตือนทำงานเมื่อเปิดเว็บ/PWA อยู่ และต้องอนุญาต Notification ในเบราว์เซอร์ก่อน

## v6.2 Tasks Calendar Date Sync Fix
- แก้ปัญหาวันที่ในปฏิทินงานกับวันที่ในงานไม่ตรงกันบนมือถือ/โซนเวลาไทย
- เปลี่ยนการคำนวณวันที่จาก UTC เป็น local date (`YYYY-MM-DD`) เพื่อให้ Today, Calendar และ Due Date ตรงกัน


## v6.10.2
- Improved mobile readability for empty states in Dashboard cards.


## v6.10.3
- Fixed Dashboard action buttons readability: Open Library / Open Notes are no longer white/faded.
