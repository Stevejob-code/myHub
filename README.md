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


## v6.6 Watch Native Select Final
- Replaced Watch custom dropdowns with real native select controls.
- Fixes platform/type selection on mobile and desktop.
- Keeps no-API poster resolver.


## v6.6 Platform Logo Brand Colors
- Added brand-color platform badges/logos for Netflix, YouTube, Disney+, Prime Video, HBO Max, Apple TV+, Viu, iQIYI, WeTV, TrueID, MonoMax, Crunchyroll, Bilibili.
- Fixed Netflix logo color distortion by removing incorrect global invert filter.


## v6.6 Pagination All Pages
- Added load-more pagination for Money, Tasks, selected-day Tasks, Watchlist, and Notes.
- Prevents long lists from stretching pages too far on mobile.


## v6.6 Platform Brand Badge Final Fix
- Replaced external SVG platform logos with controlled brand-color badges.
- Fixed Netflix black/red badge and inconsistent platform icons in Watchlist cards.


## v6.6 Notes & Links Pro
- Redesigned Notes & Links page with premium card UI, stronger search, better note cards, link pill, and mobile readability.
