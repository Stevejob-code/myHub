# วิธีแก้ Google Login: auth/unauthorized-domain

โค้ด Google Login พร้อมใช้งานแล้ว แต่ Firebase ต้องอนุญาตโดเมนที่นำเว็บไปเปิดก่อน

ให้เข้า Firebase Console > Authentication > Settings > Authorized domains แล้วเพิ่มโดเมนที่ใช้งานจริง เช่น:

- localhost สำหรับทดสอบในเครื่อง
- 127.0.0.1 สำหรับทดสอบในเครื่อง
- โดเมนเว็บจริง เช่น your-domain.com
- โดเมน hosting เช่น *.web.app หรือ *.firebaseapp.com

จากนั้นเปิด Authentication > Sign-in method แล้วเปิดใช้งาน Google Provider
