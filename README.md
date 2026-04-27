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


## Clean start from v6.6
- Removed Google Login UI and Firebase Google provider code.
- Email/password login and register remain.


## v6.6 Dashboard Pro
- Improved Dashboard readability on mobile.
- Stronger contrast for cards, labels, buttons, empty states, and list items.
- Scoped changes to Dashboard only; login and data logic untouched.


## v6.6 Watchlist No API Fix
- Fixed platform dropdown for Anime / Documentary.
- Added no-API poster resolver using public Wikipedia thumbnails with local cache.
- Keeps existing fallback poster if no public match is found.


## v6.6 Watch Dropdown 100% Click Fix
- Rebuilt Watch type/platform dropdowns with direct button handlers.
- Fixed platform dropdown click on mobile and desktop by bypassing old overlay/event issues.
