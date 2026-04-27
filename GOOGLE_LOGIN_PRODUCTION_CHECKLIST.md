# Google Login Production Checklist

โค้ดใน ZIP นี้ใช้ `signInWithPopup` สำหรับ Google Login และตั้งค่า Firebase Project `myhub-jobz` เรียบร้อยแล้ว

ต้องเช็กใน Firebase Console:

1. Authentication > Sign-in method > Google = Enabled
2. Authentication > Settings > Authorized domains มีโดเมนเหล่านี้:
   - localhost
   - myhub-jobz.firebaseapp.com
   - myhub-jobz.web.app
   - myhub-91f.pages.dev
3. Deploy แล้วกด Hard refresh หรือเปิด Incognito เพื่อเคลียร์ service worker/cache เดิม

หมายเหตุ: `authDomain` ควรใช้ `myhub-jobz.firebaseapp.com` ตาม Firebase project เดิม ไม่ต้องเปลี่ยนเป็น pages.dev
