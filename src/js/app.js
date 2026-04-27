import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js';
import { firebaseConfig } from './firebase.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.useDeviceLanguage();
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});
googleProvider.addScope('email');
googleProvider.addScope('profile');

const $ = (id) => document.getElementById(id);
const baht = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
function localISODate(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
const todayISO = () => localISODate(new Date());

const state = {
  mode: 'login',
  user: null,
  profile: null,
  transactions: [],
  tasks: [],
  watchlist: [],
  notes: [],
  unsubscribers: [],
  authReady: false,
  dataReady: false,
  lastPage: 'dashboard'
};

const pages = {
  dashboard: $('dashboardPage'),
  money: $('moneyPage'),
  tasks: $('tasksPage'),
  watch: $('watchPage'),
  notes: $('notesPage'),
  profile: $('profilePage')
};

const pageTitles = {
  dashboard: 'Dashboard',
  money: 'Money',
  tasks: 'Tasks',
  watch: 'Watchlist',
  notes: 'Notes & Links',
  profile: 'Profile'
};

function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.remove('hidden');
  window.clearTimeout(window.__toastTimer);
  window.__toastTimer = window.setTimeout(() => $('toast').classList.add('hidden'), 2600);
}

function setMode(mode) {
  state.mode = mode;
  const isRegister = mode === 'register';
  $('nameField').classList.toggle('hidden', !isRegister);
  $('authSubmit').textContent = isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ';
  $('forgotPasswordBtn').classList.toggle('hidden', isRegister);
  $('loginTab').classList.toggle('active', !isRegister);
  $('registerTab').classList.toggle('active', isRegister);
}

function navTo(name) {
  state.lastPage = name || state.lastPage || 'dashboard';
  Object.entries(pages).forEach(([key, el]) => el && el.classList.toggle('active-page', key === name));
  document.querySelectorAll('.nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.nav === name));
  $('pageTitle').textContent = pageTitles[name] || 'MyHub';
}

function profileInitial() {
  const name = state.profile?.displayName || state.user?.displayName || state.user?.email || 'M';
  return name.trim().charAt(0).toUpperCase();
}

function setAvatar(imgEl, textEl, url) {
  textEl.textContent = profileInitial();
  if (url) {
    imgEl.src = url;
    imgEl.classList.remove('hidden');
    textEl.classList.add('hidden');
  } else {
    imgEl.classList.add('hidden');
    textEl.classList.remove('hidden');
  }
}

async function ensureUserProfile(user, displayName = '') {
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      displayName: displayName || user.displayName || user.email?.split('@')[0] || 'MyHub User',
      email: user.email,
      photoURL: user.photoURL || '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

function clearSubscriptions() {
  state.unsubscribers.forEach((unsub) => unsub && unsub());
  state.unsubscribers = [];
}

function subscribeUserData(uid) {
  clearSubscriptions();

  state.unsubscribers.push(onSnapshot(doc(db, 'users', uid), (snap) => {
    state.profile = snap.data() || {};
    renderProfile();
    renderDashboard();
  }, (error) => {
    console.warn('Profile listener failed:', error);
  }));

  const bind = (key, path) => {
    const ref = collection(db, 'users', uid, path);
    const unsub = onSnapshot(ref, (snapshot) => {
      state[key] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
    }, (error) => {
      console.error(`Listener failed: ${path}`, error);
      toast(`โหลดข้อมูล ${path} ไม่สำเร็จ`);
    });
    state.unsubscribers.push(unsub);
  };

  bind('transactions', 'transactions');
  bind('tasks', 'tasks');
  bind('watchlist', 'watchlist');
  bind('notes', 'notes');
}

function renderProfile() {
  const name = state.profile?.displayName || state.user?.displayName || 'MyHub User';
  const email = state.profile?.email || state.user?.email || '';
  const photoURL = state.profile?.photoURL || state.user?.photoURL || '';
  $('welcomeName').textContent = name;
  $('profileName').textContent = name;
  $('profileEmail').textContent = email;
  $('profileDisplayName').value = name;
  $('profilePhotoUrl').value = photoURL;
  setAvatar($('headerAvatar'), $('headerAvatarText'), photoURL);
  setAvatar($('profileAvatar'), $('profileAvatarText'), photoURL);
}

function renderDashboard() {
  const now = new Date();
  const today = todayISO();
  safeSetText('todayText', now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' }));
  safeSetText('dashHeroDate', now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));

  const month = now.getMonth();
  const year = now.getFullYear();
  const txDate = (tx) => toDateValue(tx.date) || toDateValue(tx.createdAt) || now;
  const thisMonth = state.transactions.filter((tx) => {
    const d = txDate(tx);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const income = thisMonth.filter((x) => x.type === 'income').reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const expense = thisMonth.filter((x) => x.type === 'expense').reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const todaySpend = state.transactions.filter((tx) => tx.type === 'expense' && localISODate(txDate(tx)) === today).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  const pending = state.tasks.filter((t) => !t.done).length;
  const done = state.tasks.filter((t) => t.done).length;
  const focusScore = state.tasks.length ? Math.round((done / state.tasks.length) * 100) : 0;
  safeSetText('dashTodaySpend', baht.format(todaySpend));
  safeSetText('dashMonthBalance', baht.format(income - expense));
  safeSetText('dashMonthSpend', `รายจ่าย ${baht.format(expense)}`);
  safeSetText('dashPendingTasks', pending);
  safeSetText('dashFocusScore', `${focusScore}%`);

  const monthCats = {};
  thisMonth.filter((x) => x.type === 'expense').forEach((tx) => {
    const cat = tx.category || 'อื่น ๆ';
    monthCats[cat] = (monthCats[cat] || 0) + Number(tx.amount || 0);
  });
  const topCat = Object.entries(monthCats).sort((a,b)=>b[1]-a[1])[0];
  safeSetText('dashTopCategory', topCat ? `หมวดสูงสุด: ${topCat[0]}` : 'ยังไม่มีหมวดสูงสุด');

  const todays = state.tasks.filter((t) => !t.done && t.dueDate === today).slice(0, 4);
  const watchPreview = state.watchlist.filter((w) => w.status === 'กำลังดู' || w.status === 'อยากดู').slice(0, 4);
  renderList($('todayTasks'), todays, renderDashboardTaskItem, '<div class="dash-empty">วันนี้ยังโล่งอยู่ กด + เพื่อเพิ่มงาน</div>');
  renderList($('dashboardWatchPreview'), watchPreview, renderDashboardWatchItem, '<div class="dash-empty">ยังไม่มีรายการดูต่อ</div>');
  renderList($('recentNotes'), state.notes.slice(0, 3), renderDashboardNoteItem, '<div class="dash-empty">ยังไม่มีโน้ตล่าสุด</div>');
}

function renderDashboardTaskItem(task) {
  const due = task.dueDate === todayISO() ? 'วันนี้' : (task.dueDate || 'ไม่กำหนดวัน');
  return `<article class="dash-mini-item task ${task.priority === 'important' ? 'important' : ''}">
    <span class="dash-mini-icon">${task.priority === 'important' ? '🔥' : '✓'}</span>
    <div><strong>${escapeHtml(task.title || 'ไม่มีชื่อ')}</strong><small>${escapeHtml(due)}</small></div>
  </article>`;
}

function renderDashboardWatchItem(item) {
  const poster = item.poster ? `<img src="${escapeAttr(item.poster)}" alt="" loading="lazy" />` : `<span>${escapeHtml((item.title || '?').charAt(0))}</span>`;
  return `<article class="dash-mini-item watch">
    <div class="dash-watch-poster">${poster}</div>
    <div><strong>${escapeHtml(item.title || 'ไม่มีชื่อ')}</strong><small>${escapeHtml(item.status || 'อยากดู')} · ${escapeHtml(item.platform || item.type || '')}</small></div>
  </article>`;
}

function renderDashboardNoteItem(note) {
  return `<article class="dash-mini-item note">
    <span class="dash-mini-icon">✎</span>
    <div><strong>${escapeHtml(note.title || 'ไม่มีหัวข้อ')}</strong><small>${escapeHtml(note.body || note.url || 'แตะเปิดในหน้าโน้ต')}</small></div>
  </article>`;
}

function renderList(el, items, itemRenderer, emptyText) {
  el.classList.toggle('empty-box', items.length === 0);
  el.innerHTML = items.length ? items.map(itemRenderer).join('') : emptyText;
}

function renderTransactionItem(tx) {
  const sign = tx.type === 'income' ? '+' : '-';
  return `<article class="item-card">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(tx.title)}</div><div class="item-meta">${escapeHtml(tx.category || 'อื่น ๆ')} · ${tx.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</div></div>
      <strong>${sign}${baht.format(Number(tx.amount || 0))}</strong>
    </div>
    <div class="item-actions"><button class="icon-btn delete" data-delete="transactions" data-id="${tx.id}">ลบ</button></div>
  </article>`;
}

function renderTaskItem(task) {
  return `<article class="item-card ${task.done ? 'done' : ''}">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(task.title)}</div><div class="item-meta">${task.dueDate || 'ไม่กำหนดวัน'} · ${task.priority === 'important' ? 'สำคัญ' : 'ปกติ'}</div></div>
      <div class="item-actions">
        <button class="icon-btn" data-done="tasks" data-id="${task.id}" data-value="${!task.done}">${task.done ? '↺' : '✓'}</button>
        <button class="icon-btn delete" data-delete="tasks" data-id="${task.id}">ลบ</button>
      </div>
    </div>
  </article>`;
}

function renderWatchItem(item) {
  return `<article class="item-card">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.type)} · ${escapeHtml(item.status)}</div>${item.note ? `<div class="item-meta">${escapeHtml(item.note)}</div>` : ''}</div>
      <button class="icon-btn delete" data-delete="watchlist" data-id="${item.id}">ลบ</button>
    </div>
  </article>`;
}

function renderNoteItem(note) {
  return `<article class="item-card">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(note.title)}</div>${note.body ? `<div class="item-meta">${escapeHtml(note.body)}</div>` : ''}${note.url ? `<a class="item-meta" href="${escapeAttr(note.url)}" target="_blank" rel="noopener">เปิดลิงก์</a>` : ''}</div>
      <button class="icon-btn delete" data-delete="notes" data-id="${note.id}">ลบ</button>
    </div>
  </article>`;
}

function renderAll() {
  renderDashboard();
  renderList($('transactionList'), state.transactions, renderTransactionItem, 'ยังไม่มีรายการ');
  renderList($('taskList'), state.tasks, renderTaskItem, 'ยังไม่มีงาน');
  renderList($('watchList'), state.watchlist, renderWatchItem, 'ยังไม่มีรายการ');
  renderList($('noteList'), state.notes, renderNoteItem, 'ยังไม่มีโน้ต');
}

function userCol(name) {
  const user = auth.currentUser || state.user;
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  state.user = user;
  return collection(db, 'users', user.uid, name);
}

function userDoc(colName, id) {
  const user = auth.currentUser || state.user;
  if (!user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  state.user = user;
  return doc(db, 'users', user.uid, colName, id);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function escapeAttr(value = '') { return escapeHtml(value); }

$('loginTab').addEventListener('click', () => setMode('login'));
$('registerTab').addEventListener('click', () => setMode('register'));

$('passwordToggle')?.addEventListener('click', () => {
  const input = $('password');
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  $('passwordToggle').textContent = isPassword ? '🙈' : '👁';
});
$('openProfileBtn').addEventListener('click', () => navTo('profile'));

document.querySelectorAll('[data-nav]').forEach((btn) => btn.addEventListener('click', () => navTo(btn.dataset.nav)));

document.body.addEventListener('click', async (event) => {
  const deleteBtn = event.target.closest('[data-delete]');
  if (deleteBtn) {
    await deleteDoc(userDoc(deleteBtn.dataset.delete, deleteBtn.dataset.id));
    toast('ลบแล้ว');
  }
  const doneBtn = event.target.closest('[data-done]');
  if (doneBtn) {
    await updateDoc(userDoc(doneBtn.dataset.done, doneBtn.dataset.id), { done: doneBtn.dataset.value === 'true', updatedAt: serverTimestamp() });
  }

  const watchStatusBtn = event.target.closest('[data-watch-set-status]');
  if (watchStatusBtn) {
    await updateDoc(userDoc('watchlist', watchStatusBtn.dataset.id), { status: watchStatusBtn.dataset.watchSetStatus, updatedAt: serverTimestamp() });
    toast(`เปลี่ยนเป็น ${watchStatusBtn.dataset.watchSetStatus} แล้ว`);
  }
});

$('authForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('email').value.trim();
  const password = $('password').value;
  const displayName = $('displayName').value.trim();
  try {
    if (state.mode === 'register') {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      await ensureUserProfile(cred.user, displayName);
      toast('สมัครสมาชิกสำเร็จ');
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      toast('เข้าสู่ระบบแล้ว');
    }
  } catch (error) {
    toast(error.message);
  }
});



function getFirebaseAuthDomainHelp() {
  const host = window.location.hostname || 'localhost';
  return `โดเมน ${host} ยังไม่ได้รับอนุญาตใน Firebase Auth > Settings > Authorized domains`;
}

function showGoogleAuthError(message) {
  toast(message);
  const btn = $('googleLoginBtn');
  if (btn) btn.dataset.error = message;
}

function handleGoogleLoginError(error) {
  console.warn('Google login failed:', error);
  const code = error?.code || '';
  const message = error?.message || '';

  if (code === 'auth/unauthorized-domain' || message.includes('unauthorized-domain')) {
    showGoogleAuthError(getFirebaseAuthDomainHelp());
    return;
  }
  if (code === 'auth/operation-not-allowed') {
    showGoogleAuthError('ต้องเปิด Google Provider ใน Firebase Authentication > Sign-in method ก่อน');
    return;
  }
  if (code === 'auth/popup-blocked') {
    showGoogleAuthError('เบราว์เซอร์บล็อก Popup: กดอนุญาต Popup แล้วลองใหม่');
    return;
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    showGoogleAuthError('ยกเลิกการเข้าสู่ระบบ Google');
    return;
  }
  if (code === 'auth/network-request-failed') {
    showGoogleAuthError('เชื่อมต่อ Firebase ไม่สำเร็จ กรุณาเช็กอินเทอร์เน็ตแล้วลองใหม่');
    return;
  }
  showGoogleAuthError(message || 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
}

$('googleLoginBtn')?.addEventListener('click', async () => {
  const btn = $('googleLoginBtn');
  if (!btn) return;
  try {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.dataset.error = '';
    btn.innerHTML = '<span class="google-g">G</span>กำลังเปิด Google...';
    const cred = await signInWithPopup(auth, googleProvider);
    await ensureUserProfile(cred.user, cred.user.displayName || 'MyHub User');
    toast('เข้าสู่ระบบด้วย Google แล้ว');
  } catch (error) {
    handleGoogleLoginError(error);
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
    btn.innerHTML = '<span class="google-g">G</span>เข้าสู่ระบบด้วย Google';
  }
});

$('forgotPasswordBtn').addEventListener('click', async () => {
  const email = $('email').value.trim();
  if (!email) return toast('กรอกอีเมลก่อนนะครับ');
  try {
    await sendPasswordResetEmail(auth, email);
    toast('ส่งลิงก์รีเซ็ตรหัสผ่านแล้ว');
  } catch (error) { toast(error.message); }
});

$('transactionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await addDoc(userCol('transactions'), {
    title: $('txTitle').value.trim(),
    amount: Number($('txAmount').value),
    type: $('txType').value,
    category: $('txCategory').value,
    date: new Date(),
    createdAt: serverTimestamp()
  });
  event.target.reset();
  $('moneyAddCard')?.classList.add('collapsed');
  $('moneyAddCard')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  toast('บันทึกรายการแล้ว');
});

$('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const subtasks = (($('taskSubtasks')?.value || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((title) => ({ title, done: false })));
  await addDoc(userCol('tasks'), {
    title: $('taskTitle').value.trim(),
    dueDate: $('taskDue').value,
    priority: $('taskPriority').value,
    subtasks,
    order: Date.now(),
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  event.target.reset();
  $('taskPriority').value = 'normal';
  toast('เพิ่มงานแล้ว');
});

$('watchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await addDoc(userCol('watchlist'), {
    title: $('watchTitle').value.trim(),
    poster: await resolvePosterUrl($('watchTitle').value.trim(), '', ''),
    type: $('watchType')?.value || 'หนัง',
    status: $('watchStatus').value,
    genre: '',
    platform: $('watchPlatform')?.value || 'Netflix',
    year: '',
    rating: '',
    note: '',
    createdAt: serverTimestamp()
  });
  event.target.reset();
  $('watchStatus').value = 'อยากดู';
  $('watchType').value = 'หนัง';
  $('watchPlatform').value = 'Netflix';
  renderAppDropdown('watchPlatformDropdown', 'Netflix', 'platform');
  renderAppDropdown('watchTypeDropdown', 'หนัง', 'type');
  setupStatusTabs('#watchStatusTabs .status-tab', 'watchStatus', 'อยากดู');
  initAppDropdowns();
  toast('เพิ่มเข้ารายการแล้ว');
});

$('noteForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await addDoc(userCol('notes'), {
    title: $('noteTitle').value.trim(),
    url: $('noteUrl').value.trim(),
    body: $('noteBody').value.trim(),
    createdAt: serverTimestamp()
  });
  event.target.reset();
  toast('บันทึกโน้ตแล้ว');
});

$('profileForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const displayName = $('profileDisplayName').value.trim();
  const photoURL = $('profilePhotoUrl').value.trim();
  await updateProfile(state.user, { displayName, photoURL });
  await setDoc(doc(db, 'users', state.user.uid), {
    displayName,
    email: state.user.email,
    photoURL,
    updatedAt: serverTimestamp()
  }, { merge: true });
  toast('บันทึกโปรไฟล์แล้ว');
});

$('logoutBtn').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async (user) => {
  state.authReady = true;
  state.user = user || null;

  if (user) {
    try {
      await ensureUserProfile(user);
    } catch (error) {
      console.warn('ensureUserProfile failed:', error);
    }

    $('authScreen')?.classList.add('hidden');
    $('mainApp')?.classList.remove('hidden');

    try {
      subscribeUserData(user.uid);
      state.dataReady = true;
    } catch (error) {
      console.error('subscribeUserData failed:', error);
      toast('โหลดข้อมูลไม่สำเร็จ แต่ยังใช้งานต่อได้');
    }

    navTo(state.lastPage || 'dashboard');
  } else {
    clearSubscriptions();
    state.profile = null;
    state.transactions = [];
    state.tasks = [];
    state.watchlist = [];
    state.notes = [];
    state.dataReady = false;
    $('authScreen')?.classList.remove('hidden');
    $('mainApp')?.classList.add('hidden');
  }
});

// ===== Watchlist v4.1: Platforms + Auto Poster =====
const TMDB_API_KEY = ''; // ใส่ TMDB API Key ถ้าต้องการดึงโปสเตอร์อัตโนมัติ
const GOOGLE_IMAGE_API_KEY = ''; // ใส่ Google Custom Search API Key ถ้าต้องการดึงโปสเตอร์จาก Google
const GOOGLE_IMAGE_CX = ''; // ใส่ Google Programmable Search Engine CX
const WATCH_TYPES = [
  { key: 'หนัง', label: 'หนัง', icon: '🎬' },
  { key: 'ซีรีส์', label: 'ซีรีส์', icon: '📺' },
  { key: 'อนิเมะ', label: 'อนิเมะ', icon: '✨' },
  { key: 'สารคดี', label: 'สารคดี', icon: '🌎' }
];
const WATCH_PLATFORMS = [
  { key: 'YouTube', label: 'YouTube', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/youtube.svg' },
  { key: 'Netflix', label: 'Netflix', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/netflix.svg' },
  { key: 'HBO Max', label: 'HBO Max', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/hbo.svg' },
  { key: 'Disney+', label: 'Disney+', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/disneyplus.svg' },
  { key: 'Prime Video', label: 'Prime Video', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/primevideo.svg' },
  { key: 'Apple TV+', label: 'Apple TV+', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/appletv.svg' },
  { key: 'Viu', label: 'Viu', fallback: 'V' },
  { key: 'iQIYI', label: 'iQIYI', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/iqiyi.svg' },
  { key: 'WeTV', label: 'WeTV', fallback: 'W' },
  { key: 'TrueID', label: 'TrueID', fallback: 'T' },
  { key: 'MonoMax', label: 'MonoMax', fallback: 'M' },
  { key: 'Crunchyroll', label: 'Crunchyroll', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/crunchyroll.svg' },
  { key: 'Bilibili', label: 'Bilibili', icon: 'https://cdn.jsdelivr.net/npm/simple-icons@v11/icons/bilibili.svg' },
  { key: 'อื่น ๆ', label: 'อื่น ๆ', fallback: '⋯' }
];
function getPlatform(key) { return WATCH_PLATFORMS.find(p => p.key === key) || WATCH_PLATFORMS[WATCH_PLATFORMS.length - 1]; }
function platformIconHTML(p) {
  if (p.icon) return `<span class="brand-icon"><img src="${escapeAttr(p.icon)}" alt="" loading="lazy" /></span>`;
  return `<span class="brand-icon text-icon">${escapeHtml(p.fallback || p.icon || p.label[0] || '?')}</span>`;
}
function typeIconHTML(t) { return `<span class="brand-icon type-icon">${escapeHtml(t.icon)}</span>`; }
function getDropdownOptions(kind) { return kind === 'type' ? WATCH_TYPES : WATCH_PLATFORMS; }
function optionIconHTML(kind, item) { return kind === 'type' ? typeIconHTML(item) : platformIconHTML(item); }
function renderAppDropdown(dropdownId, selected, kind = 'platform') {
  const root = $(dropdownId); if (!root) return;
  const inputId = root.dataset.input;
  const input = inputId ? $(inputId) : null;
  const options = getDropdownOptions(kind);
  const current = options.find(o => o.key === selected) || options[0];
  if (input) input.value = current.key;
  root.innerHTML = `
    <button class="dropdown-trigger" type="button" aria-expanded="false">
      <span class="dropdown-current">${optionIconHTML(kind, current)}<span>${escapeHtml(current.label)}</span></span>
      <span class="dropdown-chevron">⌄</span>
    </button>
    <div class="dropdown-menu" role="listbox">
      ${options.map(o => `<button class="dropdown-option ${o.key === current.key ? 'selected' : ''}" type="button" data-value="${escapeAttr(o.key)}">${optionIconHTML(kind, o)}<span>${escapeHtml(o.label)}</span><b>✓</b></button>`).join('')}
    </div>`;
}
function initAppDropdowns() {
  document.querySelectorAll('.app-dropdown').forEach(root => {
    const kind = root.dataset.kind || 'platform';
    const input = root.dataset.input ? $(root.dataset.input) : null;
    if (!root.innerHTML.trim()) renderAppDropdown(root.id, input?.value || (kind === 'type' ? 'หนัง' : 'Netflix'), kind);
    const trigger = root.querySelector('.dropdown-trigger');
    trigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.app-dropdown.open').forEach(x => { if (x !== root) x.classList.remove('open'); });
      root.classList.toggle('open');
      trigger.setAttribute('aria-expanded', root.classList.contains('open') ? 'true' : 'false');
    });
    root.querySelectorAll('.dropdown-option').forEach(btn => btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const value = btn.dataset.value;
      if (input) input.value = value;
      renderAppDropdown(root.id, value, kind);
      root.classList.remove('open');
      initAppDropdowns();
    }));
  });
}
document.addEventListener('click', () => document.querySelectorAll('.app-dropdown.open').forEach(x => x.classList.remove('open')));
function setupStatusTabs(selector, inputId, selected = 'อยากดู', dataName = 'data-status') {
  const input = $(inputId); if (input) input.value = selected;
  document.querySelectorAll(selector).forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute(dataName) === selected);
    btn.addEventListener('click', () => {
      document.querySelectorAll(selector).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (input) input.value = btn.getAttribute(dataName);
    });
  });
}
function statusClass(status) { return status === 'กำลังดู' ? 'watching' : status === 'ดูจบแล้ว' ? 'done' : 'queued'; }
async function resolvePosterUrl(title, year = '', manualUrl = '') {
  const cleanTitle = (title || '').trim();
  if (manualUrl || !cleanTitle) return manualUrl || '';

  // Google Custom Search: ดึงรูปโปสเตอร์จาก Google แบบถูกทาง (ต้องใส่ API Key + CX)
  if (GOOGLE_IMAGE_API_KEY && GOOGLE_IMAGE_CX) {
    try {
      const params = new URLSearchParams({
        key: GOOGLE_IMAGE_API_KEY,
        cx: GOOGLE_IMAGE_CX,
        q: `${cleanTitle} movie poster`,
        searchType: 'image',
        imgType: 'photo',
        safe: 'active',
        num: '5'
      });
      const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
      if (res.ok) {
        const data = await res.json();
        const hit = (data.items || []).find(x => x?.link && /poster|movie|film|media|image|jpg|jpeg|png|webp/i.test(`${x.link} ${x.title || ''}`));
        if (hit?.link) return hit.link;
      }
    } catch (err) { console.warn('Google poster fetch failed', err); }
  }

  // ใช้ TMDB ถ้าใส่ API Key ไว้ใน app.js

  if (TMDB_API_KEY) {
    try {
      const params = new URLSearchParams({ api_key: TMDB_API_KEY, query: cleanTitle, include_adult: 'false', language: 'th-TH' });
      if (year) params.set('year', year);
      const res = await fetch(`https://api.themoviedb.org/3/search/multi?${params}`);
      if (res.ok) {
        const data = await res.json();
        const hit = (data.results || []).find(x => x.poster_path);
        if (hit?.poster_path) return `https://image.tmdb.org/t/p/w500${hit.poster_path}`;
      }
    } catch (err) { console.warn('TMDB poster fetch failed', err); }
  }

  // Fallback ไม่ต้องใช้ API Key: IMDb suggestion image
  try {
    const key = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'movie';
    const first = key[0] || 'a';
    const res = await fetch(`https://v3.sg.media-imdb.com/suggestion/${encodeURIComponent(first)}/${encodeURIComponent(key)}.json`);
    if (res.ok) {
      const data = await res.json();
      const hit = (data.d || []).find(x => x?.i?.imageUrl);
      if (hit?.i?.imageUrl) return hit.i.imageUrl;
    }
  } catch (err) { console.warn('IMDb poster fetch failed', err); }

  // Fallback ฟรีแบบไม่ต้องใช้ API Key: Wikipedia page image
  try {
    const wikiQueries = [cleanTitle, `${cleanTitle} film`, `${cleanTitle} movie`, `${cleanTitle} television series`];
    for (const q of wikiQueries) {
      const params = new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: q,
        gsrlimit: '5',
        prop: 'pageimages|pageterms',
        piprop: 'thumbnail',
        pithumbsize: '600',
        redirects: '1',
        format: 'json',
        origin: '*'
      });
      const res = await fetch(`https://en.wikipedia.org/w/api.php?${params}`);
      if (res.ok) {
        const data = await res.json();
        const pages = Object.values(data.query?.pages || {});
        const hit = pages.find(x => x?.thumbnail?.source);
        if (hit?.thumbnail?.source) return hit.thumbnail.source;
      }
    }
  } catch (err) { console.warn('Wikipedia poster fetch failed', err); }

  return '';
}

// ===== MyHub v2: Quick Add, Filters, Search, Edit =====
state.filters = { tx: 'all', task: 'all', watch: '', watchStatus: 'all', note: '' };
let editing = null;

function itemDateText(item) {
  const raw = item.date || item.createdAt || item.updatedAt;
  const d = raw?.toDate ? raw.toDate() : raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '';
}

renderTransactionItem = function(tx) {
  const isIncome = tx.type === 'income';
  const sign = isIncome ? '+' : '-';
  return `<article class="item-card">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(tx.title)}</div><div class="item-meta">${escapeHtml(tx.category || 'อื่น ๆ')} · ${isIncome ? 'รายรับ' : 'รายจ่าย'}</div><div class="inline-date">${itemDateText(tx)}</div></div>
      <strong class="${isIncome ? 'money-income' : 'money-expense'}">${sign}${baht.format(Number(tx.amount || 0))}</strong>
    </div>
    <div class="item-actions"><button class="icon-btn edit-btn" data-edit="transactions" data-id="${tx.id}">แก้</button><button class="icon-btn delete" data-delete="transactions" data-id="${tx.id}">ลบ</button></div>
  </article>`;
};

renderTaskItem = function(task) {
  return `<article class="item-card ${task.done ? 'done' : ''}">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(task.title)}</div><div class="item-meta">${task.dueDate || 'ไม่กำหนดวัน'} · ${task.priority === 'important' ? 'สำคัญ' : 'ปกติ'}</div></div>
      <div class="item-actions">
        <button class="icon-btn" data-done="tasks" data-id="${task.id}" data-value="${!task.done}">${task.done ? '↺' : '✓'}</button>
        <button class="icon-btn edit-btn" data-edit="tasks" data-id="${task.id}">แก้</button>
        <button class="icon-btn delete" data-delete="tasks" data-id="${task.id}">ลบ</button>
      </div>
    </div>
  </article>`;
};

renderWatchItem = function(item) {
  const platformData = getPlatform(item.platform);
  const hasPoster = Boolean(item.poster);
  const poster = hasPoster ? `<img src="${escapeAttr(item.poster)}" alt="${escapeAttr(item.title)}" loading="lazy" onerror="this.closest('.movie-poster').classList.add('poster-error');this.remove();" />` : `<div class="poster-fallback" data-auto-poster="${escapeAttr(item.id)}" data-title="${escapeAttr(item.title)}"><span>▶</span><small>กำลังหาโปสเตอร์</small></div>`;
  const rating = item.rating ? `<span class="movie-rating">★ ${escapeHtml(item.rating)}/10</span>` : '';
  const status = item.status || 'อยากดู';
  return `<article class="movie-card upgraded-movie-card movie-card-menu-card">
    <details class="movie-more-menu">
      <summary aria-label="จัดการรายการ">⋯</summary>
      <div class="movie-more-panel">
        <button type="button" class="more-action edit-btn" data-edit="watchlist" data-id="${item.id}">✎ แก้ไข</button>
        <button type="button" class="more-action danger" data-delete="watchlist" data-id="${item.id}">🗑 ลบ</button>
      </div>
    </details>
    <div class="movie-poster">${poster}</div>
    <div class="movie-info">
      <div class="movie-head-row"><h3>${escapeHtml(item.title)}</h3>${rating}</div>
      <div class="movie-badges"><span class="type-badge">${escapeHtml(item.type || 'หนัง')}</span><span class="status-badge status-${statusClass(status)}">${escapeHtml(status)}</span></div>
      <div class="platform-line">${platformIconHTML(platformData)}<span>${escapeHtml(platformData.label)}</span></div>
      <div class="movie-status-actions two-status-actions">
        <button class="pill-status-btn watch-btn ${status === 'กำลังดู' ? 'active' : ''}" data-watch-set-status="กำลังดู" data-id="${item.id}">▶ กำลังดู</button>
        <button class="pill-status-btn done ${status === 'ดูจบแล้ว' ? 'active' : ''}" data-watch-set-status="ดูจบแล้ว" data-id="${item.id}">✓ ดูจบแล้ว</button>
      </div>
    </div>
  </article>`;
};

renderNoteItem = function(note) {
  return `<article class="item-card">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(note.title)}</div>${note.body ? `<div class="item-meta">${escapeHtml(note.body)}</div>` : ''}${note.url ? `<a class="item-meta" href="${escapeAttr(note.url)}" target="_blank" rel="noopener">เปิดลิงก์</a>` : ''}</div>
      <div class="item-actions"><button class="icon-btn edit-btn" data-edit="notes" data-id="${note.id}">แก้</button><button class="icon-btn delete" data-delete="notes" data-id="${note.id}">ลบ</button></div>
    </div>
  </article>`;
};

renderAll = function() {
  renderDashboard();
  const txs = state.transactions.filter((x) => state.filters.tx === 'all' || x.type === state.filters.tx);
  const tasks = state.tasks.filter((t) => state.filters.task === 'all' || (state.filters.task === 'done' ? t.done : !t.done));
  const watchTerm = state.filters.watch.toLowerCase();
  const watches = state.watchlist.filter((w) => (!watchTerm || `${w.title} ${w.type || ''} ${w.status || ''} ${w.genre || ''} ${w.platform || ''} ${w.year || ''}`.toLowerCase().includes(watchTerm)) && (state.filters.watchStatus === 'all' || w.status === state.filters.watchStatus));
  const noteTerm = state.filters.note.toLowerCase();
  const notes = state.notes.filter((n) => !noteTerm || `${n.title} ${n.body} ${n.url}`.toLowerCase().includes(noteTerm));
  renderList($('transactionList'), txs, renderTransactionItem, 'ยังไม่มีรายการ');
  renderList($('taskList'), tasks, renderTaskItem, 'ยังไม่มีงาน');
  renderList($('watchList'), watches, renderWatchItem, 'ยังไม่มีรายการ');
  hydrateMissingWatchPosters(watches);
  renderList($('noteList'), notes, renderNoteItem, 'ยังไม่มีโน้ต');
};

const posterHydrationQueue = new Set();
async function hydrateMissingWatchPosters(items = []) {
  if (!state.user) return;
  const shouldRefreshExisting = Boolean(GOOGLE_IMAGE_API_KEY && GOOGLE_IMAGE_CX) || Boolean(TMDB_API_KEY);
  const missing = items.filter(x => x && x.id && x.title && (!x.poster || shouldRefreshExisting) && !posterHydrationQueue.has(x.id)).slice(0, 3);
  for (const item of missing) {
    posterHydrationQueue.add(item.id);
    try {
      const poster = await resolvePosterUrl(item.title, '', '');
      if (poster && poster !== item.poster) await updateDoc(userDoc('watchlist', item.id), { poster, updatedAt: serverTimestamp() });
    } catch (err) {
      console.warn('Auto poster update failed', err);
    } finally {
      window.setTimeout(() => posterHydrationQueue.delete(item.id), 60000);
    }
  }
};

function openQuickSheet() { $('quickSheet').classList.remove('hidden'); }
function closeQuickSheet() { $('quickSheet').classList.add('hidden'); }
function closeEditModal() { $('editModal').classList.add('hidden'); editing = null; }
function findItem(col, id) {
  const map = { transactions: state.transactions, tasks: state.tasks, watchlist: state.watchlist, notes: state.notes };
  return (map[col] || []).find((x) => x.id === id);
}

function openEditModal(col, id) {
  const item = findItem(col, id);
  if (!item) return toast('ไม่พบข้อมูล');
  editing = { col, id };
  const f = $('editForm');
  const titleMap = { transactions: 'แก้ไขรายการเงิน', tasks: 'แก้ไขงาน', watchlist: 'แก้ไขหนัง/ซีรีส์', notes: 'แก้ไขโน้ต/ลิงก์' };
  $('editTitle').textContent = titleMap[col] || 'แก้ไข';
  if (col === 'transactions') {
    f.innerHTML = `<input id="editTxTitle" value="${escapeAttr(item.title)}" required /><input id="editTxAmount" type="number" inputmode="decimal" value="${Number(item.amount || 0)}" required /><select id="editTxType"><option value="expense">รายจ่าย</option><option value="income">รายรับ</option></select><input id="editTxCategory" value="${escapeAttr(item.category || '')}" placeholder="หมวดหมู่" /><button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
    $('editTxType').value = item.type || 'expense';
  } else if (col === 'tasks') {
    f.innerHTML = `<input id="editTaskTitle" value="${escapeAttr(item.title)}" required /><input id="editTaskDue" type="date" value="${escapeAttr(item.dueDate || '')}" /><select id="editTaskPriority"><option value="normal">ปกติ</option><option value="important">สำคัญ</option></select><button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
    $('editTaskPriority').value = item.priority || 'normal';
  } else if (col === 'watchlist') {
    f.innerHTML = `<input id="editWatchTitle" value="${escapeAttr(item.title)}" required /><div class="watch-simple-grid"><input id="editWatchType" type="hidden" value="${escapeAttr(item.type || 'หนัง')}" /><div id="editWatchTypeDropdown" class="app-dropdown" data-input="editWatchType" data-kind="type"></div><input id="editWatchPlatform" type="hidden" value="${escapeAttr(item.platform || 'Netflix')}" /><div id="editWatchPlatformDropdown" class="app-dropdown" data-input="editWatchPlatform" data-kind="platform"></div></div><div class="status-tabs edit-status-tabs"><button type="button" class="status-tab" data-edit-status="อยากดู">อยากดู</button><button type="button" class="status-tab" data-edit-status="กำลังดู">กำลังดู</button><button type="button" class="status-tab" data-edit-status="ดูจบแล้ว">ดูจบแล้ว</button></div><input id="editWatchStatus" type="hidden" value="${escapeAttr(item.status || 'อยากดู')}" /><button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
    $('editWatchType').value = item.type || 'หนัง';
    renderAppDropdown('editWatchPlatformDropdown', item.platform || 'Netflix', 'platform');
    renderAppDropdown('editWatchTypeDropdown', item.type || 'หนัง', 'type');
    initAppDropdowns();
    setupStatusTabs('.edit-status-tabs .status-tab', 'editWatchStatus', item.status || 'อยากดู', 'data-edit-status');
  } else {
    f.innerHTML = `<input id="editNoteTitle" value="${escapeAttr(item.title)}" required /><input id="editNoteUrl" type="url" value="${escapeAttr(item.url || '')}" placeholder="ลิงก์" /><textarea id="editNoteBody" rows="3" placeholder="รายละเอียด">${escapeHtml(item.body || '')}</textarea><button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
  }
  $('editModal').classList.remove('hidden');
}

$('quickAddBtn').addEventListener('click', openQuickSheet);
$('closeQuickSheet').addEventListener('click', closeQuickSheet);
$('closeEditModal').addEventListener('click', closeEditModal);
$('quickSheet').addEventListener('click', (event) => { if (event.target.id === 'quickSheet') closeQuickSheet(); });
$('editModal').addEventListener('click', (event) => { if (event.target.id === 'editModal') closeEditModal(); });
document.querySelectorAll('[data-quick]').forEach((btn) => btn.addEventListener('click', () => { closeQuickSheet(); navTo(btn.dataset.quick); }));
$('txFilter').addEventListener('change', (e) => { state.filters.tx = e.target.value; renderAll(); });
document.querySelectorAll('[data-task-filter]').forEach((btn) => btn.addEventListener('click', () => { state.filters.task = btn.dataset.taskFilter; document.querySelectorAll('[data-task-filter]').forEach((b) => b.classList.toggle('active', b === btn)); renderAll(); }));
$('watchSearch').addEventListener('input', (e) => { state.filters.watch = e.target.value; renderAll(); });

$('noteSearch').addEventListener('input', (e) => { state.filters.note = e.target.value; renderAll(); });

document.body.addEventListener('click', (event) => {
  const editBtn = event.target.closest('[data-edit]');
  if (editBtn) openEditModal(editBtn.dataset.edit, editBtn.dataset.id);
});

$('editForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editing) return;
  let data = { updatedAt: serverTimestamp() };
  if (editing.col === 'transactions') data = { ...data, title: $('editTxTitle').value.trim(), amount: Number($('editTxAmount').value), type: $('editTxType').value, category: $('editTxCategory').value.trim() || 'อื่น ๆ' };
  if (editing.col === 'tasks') data = { ...data, title: $('editTaskTitle').value.trim(), dueDate: $('editTaskDue').value, priority: $('editTaskPriority').value };
  if (editing.col === 'watchlist') data = { ...data, title: $('editWatchTitle').value.trim(), poster: await resolvePosterUrl($('editWatchTitle').value.trim(), '', ''), type: $('editWatchType')?.value || 'หนัง', status: $('editWatchStatus').value, genre: '', platform: $('editWatchPlatform')?.value || 'Netflix', year: '', rating: '', note: '' };
  if (editing.col === 'notes') data = { ...data, title: $('editNoteTitle').value.trim(), url: $('editNoteUrl').value.trim(), body: $('editNoteBody').value.trim() };
  await updateDoc(userDoc(editing.col, editing.id), data);
  closeEditModal();
  toast('แก้ไขแล้ว');
});


// ===== MyHub v3: PWA, Dashboard Chart, Theme, Profile Stats =====
let deferredInstallPrompt = null;
function safeSetText(id,value){const el=$(id);if(el)el.textContent=value;}
function toDateValue(raw){if(!raw)return null;if(raw.toDate)return raw.toDate();const d=new Date(raw);return Number.isNaN(d.getTime())?null:d;}
function renderV3Dashboard(){const today=todayISO();safeSetText('overdueTasks',state.tasks.filter(t=>!t.done&&t.dueDate&&t.dueDate<today).length);safeSetText('watchPending',state.watchlist.filter(w=>w.status!=='ดูจบแล้ว').length);safeSetText('noteCount',state.notes.length);safeSetText('profileTxCount',state.transactions.length);safeSetText('profileTaskCount',state.tasks.length);safeSetText('profileWatchCount',state.watchlist.length);safeSetText('profileNoteCount',state.notes.length);renderExpenseChart();}
const previousRenderDashboardV3=renderDashboard;renderDashboard=function(){previousRenderDashboardV3();renderV3Dashboard();};
function renderExpenseChart(){const canvas=$('expenseChart');if(!canvas)return;const ctx=canvas.getContext('2d');const rect=canvas.getBoundingClientRect();const dpr=window.devicePixelRatio||1;const width=rect.width||340;const height=170;canvas.width=Math.floor(width*dpr);canvas.height=Math.floor(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return{iso:localISODate(d),label:d.toLocaleDateString('th-TH',{day:'numeric'}),total:0};});const catTotals={};state.transactions.filter(x=>x.type==='expense').forEach(tx=>{const d=toDateValue(tx.date)||toDateValue(tx.createdAt)||new Date();const iso=localISODate(d);const day=days.find(v=>v.iso===iso);if(day)day.total+=Number(tx.amount||0);const cat=tx.category||'อื่น ๆ';catTotals[cat]=(catTotals[cat]||0)+Number(tx.amount||0);});const topCat=Object.entries(catTotals).sort((a,b)=>b[1]-a[1])[0];safeSetText('dashTopCategory',topCat?`หมวดสูงสุด: ${topCat[0]}`:'ยังไม่มีหมวดสูงสุด');safeSetText('dashWeekSpend',baht.format(days.reduce((s,d)=>s+d.total,0)));const max=Math.max(...days.map(d=>d.total),1);const gap=10;const barW=(width-gap*8)/7;const baseY=136;ctx.font='12px Noto Sans Thai, sans-serif';days.forEach((d,i)=>{const x=gap+i*(barW+gap);const h=Math.max(6,(d.total/max)*92);ctx.fillStyle='rgba(79,70,229,.18)';roundRect(ctx,x,baseY-92,barW,92,8);ctx.fill();ctx.fillStyle=d.total?'rgba(79,70,229,.92)':'rgba(148,163,184,.30)';roundRect(ctx,x,baseY-h,barW,h,8);ctx.fill();ctx.fillStyle='rgba(107,114,128,.95)';ctx.textAlign='center';ctx.fillText(d.label,x+barW/2,158);});}
function roundRect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function setTheme(theme){
  const isLight = theme === 'light';
  document.body.classList.toggle('light-mode', isLight);
  localStorage.setItem('myhub-theme', theme);
  const btn = $('themeToggleBtn');
  if (btn) {
    btn.setAttribute('aria-checked', isLight ? 'true' : 'false');
    btn.title = isLight ? 'ปิดโหมดสว่าง' : 'เปิดโหมดสว่าง';
  }
}
setTheme(localStorage.getItem('myhub-theme')||'dark');$('themeToggleBtn')?.addEventListener('click',()=>setTheme(document.body.classList.contains('light-mode')?'dark':'light'));window.addEventListener('resize',()=>renderExpenseChart());if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}window.addEventListener('load',()=>{if(!window.matchMedia('(display-mode: standalone)').matches){$('installAppBtn')?.classList.remove('hidden');}});window.addEventListener('beforeinstallprompt',(event)=>{event.preventDefault();deferredInstallPrompt=event;$('installAppBtn')?.classList.remove('hidden');});$('installAppBtn')?.addEventListener('click',async()=>{if(!deferredInstallPrompt)return toast('ติดตั้งได้จากเมนูของเบราว์เซอร์');deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;$('installAppBtn')?.classList.add('hidden');});

// Close movie action menus when tapping elsewhere or opening another menu
function closeMovieMenus(except = null) {
  document.querySelectorAll('.movie-more-menu[open]').forEach(menu => {
    if (menu !== except) menu.removeAttribute('open');
  });
}

document.addEventListener('click', (event) => {
  const menu = event.target.closest('.movie-more-menu');
  if (!menu) closeMovieMenus();
});

document.addEventListener('toggle', (event) => {
  const menu = event.target;
  if (menu?.classList?.contains('movie-more-menu') && menu.open) {
    closeMovieMenus(menu);
  }
}, true);

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-edit="watchlist"], [data-delete="watchlist"], [data-watch-set-status]')) {
    closeMovieMenus();
  }
});

// Init watchlist platform and status controls
renderAppDropdown('watchPlatformDropdown', 'Netflix', 'platform');
renderAppDropdown('watchTypeDropdown', 'หนัง', 'type');
initAppDropdowns();
setupStatusTabs('#watchStatusTabs .status-tab', 'watchStatus', 'อยากดู');
document.querySelectorAll('[data-watch-status]').forEach(btn => btn.addEventListener('click', () => {
  document.querySelectorAll('[data-watch-status]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.filters.watchStatus = btn.dataset.watchStatus;
  renderAll();
}));

// ===== MyHub v5: Premium Tasks UI =====
state.filters.taskView = state.filters.taskView || 'all';
state.filters.taskSearch = state.filters.taskSearch || '';

function taskIsToday(task){ return task?.dueDate === todayISO(); }
function taskIsOverdue(task){ return Boolean(task?.dueDate && task.dueDate < todayISO() && !task.done); }
function taskDueLabel(task){
  if (!task.dueDate) return 'ไม่กำหนดวัน';
  if (task.dueDate === todayISO()) return 'วันนี้';
  if (taskIsOverdue(task)) return 'เลยกำหนด';
  try { return new Date(task.dueDate + 'T00:00:00').toLocaleDateString('th-TH', { day:'numeric', month:'short' }); } catch { return task.dueDate; }
}
function taskPriorityText(task){ return task.priority === 'important' ? 'สำคัญ' : 'ปกติ'; }
function updateTaskStats(){
  const total = state.tasks.length;
  const done = state.tasks.filter(t=>t.done).length;
  safeSetText('taskDonePercent', total ? `${Math.round(done/total*100)}%` : '0%');
  safeSetText('taskTodayCount', state.tasks.filter(t=>!t.done && taskIsToday(t)).length);
  safeSetText('taskPendingCount', state.tasks.filter(t=>!t.done).length);
  safeSetText('taskOverdueCount', state.tasks.filter(taskIsOverdue).length);
  safeSetText('taskImportantCount', state.tasks.filter(t=>!t.done && t.priority === 'important').length);
}

renderTaskItem = function(task){
  const done = Boolean(task.done);
  const overdue = taskIsOverdue(task);
  const important = task.priority === 'important';
  return `<article class="task-card-premium ${done ? 'done' : ''} ${important ? 'priority-important' : ''} ${overdue ? 'overdue' : ''}">
    <div class="task-card-main">
      <button class="task-check-btn ${done ? 'done' : ''}" data-done="tasks" data-id="${task.id}" data-value="${!done}" aria-label="เปลี่ยนสถานะงาน">${done ? '✓' : ''}</button>
      <div>
        <div class="task-card-title">${escapeHtml(task.title)}</div>
        <div class="task-meta-row">
          <span class="task-chip ${overdue ? 'overdue' : done ? 'done' : ''}">📅 ${taskDueLabel(task)}</span>
          <span class="task-chip ${important ? 'priority' : 'normal'}">${important ? '🔥' : '⚪'} ${taskPriorityText(task)}</span>
          <span class="task-chip ${done ? 'done' : 'normal'}">${done ? 'เสร็จแล้ว' : 'ยังไม่เสร็จ'}</span>
        </div>
      </div>
      <details class="task-menu">
        <summary>⋯</summary>
        <div class="task-menu-panel">
          <button type="button" data-edit="tasks" data-id="${task.id}">✎ แก้ไข</button>
          <button type="button" class="delete" data-delete="tasks" data-id="${task.id}">🗑 ลบ</button>
        </div>
      </details>
    </div>
  </article>`;
};

const renderAllBeforeTasksV5 = renderAll;
renderAll = function(){
  renderDashboard();
  const txs = state.transactions.filter((x) => state.filters.tx === 'all' || x.type === state.filters.tx);
  const term = (state.filters.taskSearch || '').toLowerCase();
  const view = state.filters.taskView || state.filters.task || 'all';
  let tasks = state.tasks.filter(t => {
    const matchesTerm = !term || `${t.title || ''} ${t.priority || ''} ${t.dueDate || ''}`.toLowerCase().includes(term);
    if (!matchesTerm) return false;
    if (view === 'today') return !t.done && taskIsToday(t);
    if (view === 'upcoming') return !t.done && t.dueDate && t.dueDate >= todayISO();
    if (view === 'done') return t.done;
    if (view === 'pending') return !t.done;
    return true;
  }).sort((a,b)=>{
    if (a.done !== b.done) return a.done ? 1 : -1;
    if ((a.priority === 'important') !== (b.priority === 'important')) return a.priority === 'important' ? -1 : 1;
    return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
  });
  const watchTerm = (state.filters.watch || '').toLowerCase();
  const watches = state.watchlist.filter((w) => (!watchTerm || `${w.title} ${w.type || ''} ${w.status || ''} ${w.genre || ''} ${w.platform || ''} ${w.year || ''}`.toLowerCase().includes(watchTerm)) && (state.filters.watchStatus === 'all' || w.status === state.filters.watchStatus));
  const noteTerm = (state.filters.note || '').toLowerCase();
  const notes = state.notes.filter((n) => !noteTerm || `${n.title} ${n.body} ${n.url}`.toLowerCase().includes(noteTerm));
  renderList($('transactionList'), txs, renderTransactionItem, 'ยังไม่มีรายการ');
  renderList($('taskList'), tasks, renderTaskItem, '<div class="task-empty-hint">ยังไม่มีงานในมุมมองนี้</div>');
  renderList($('watchList'), watches, renderWatchItem, 'ยังไม่มีรายการ');
  hydrateMissingWatchPosters(watches);
  renderList($('noteList'), notes, renderNoteItem, 'ยังไม่มีโน้ต');
  updateTaskStats();
};

$('taskSearch')?.addEventListener('input', (event)=>{ state.filters.taskSearch = event.target.value; renderAll(); });
document.querySelectorAll('[data-task-view]').forEach(btn => btn.addEventListener('click', ()=>{
  state.filters.taskView = btn.dataset.taskView;
  document.querySelectorAll('[data-task-view]').forEach(b=>b.classList.toggle('active', b===btn));
  renderAll();
}));

// keep old filter buttons compatible if any remain
document.querySelectorAll('[data-task-filter]').forEach(btn => btn.addEventListener('click', ()=>{
  state.filters.taskView = btn.dataset.taskFilter;
  renderAll();
}));

state.openTaskMenuId = null;
function closeTaskMenus(){
  if (state.openTaskMenuId) {
    state.openTaskMenuId = null;
    renderAll();
  }
}
document.addEventListener('click', (event)=>{
  const toggle = event.target.closest('[data-task-menu-toggle]');
  if (toggle) {
    event.preventDefault();
    event.stopPropagation();
    const id = toggle.dataset.taskMenuToggle;
    state.openTaskMenuId = state.openTaskMenuId === id ? null : id;
    renderAll();
    return;
  }
  if (event.target.closest('.task-menu-panel-clean')) return;
  if (event.target.closest('[data-edit="tasks"], [data-delete="tasks"], [data-done="tasks"]')) {
    state.openTaskMenuId = null;
    return;
  }
  if (state.openTaskMenuId) closeTaskMenus();
});


// ===== MyHub v5.1: Tasks UX override =====
function addDaysISO(days){
  const d = new Date();
  d.setDate(d.getDate() + days);
  return localISODate(d);
}
function initTaskQuickOptions(){
  document.querySelectorAll('[data-task-due]').forEach(btn=>btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-task-due]').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const mode = btn.dataset.taskDue;
    const input = $('taskDue');
    if (!input) return;
    input.value = mode === 'today' ? todayISO() : mode === 'tomorrow' ? addDaysISO(1) : '';
  }));
  document.querySelectorAll('[data-task-priority]').forEach(btn=>btn.addEventListener('click',()=>{
    btn.classList.toggle('active');
    const input = $('taskPriority');
    if (input) input.value = btn.classList.contains('active') ? btn.dataset.taskPriority : 'normal';
  }));
}

renderTaskItem = function(task){
  const done = Boolean(task.done);
  const overdue = taskIsOverdue(task);
  const important = task.priority === 'important';
  const open = state.openSwipeTaskId === task.id;
  return `<article class="task-card-premium task-swipe-card ${open ? 'swipe-open' : ''} ${done ? 'done' : ''} ${important ? 'priority-important' : ''} ${overdue ? 'overdue' : ''}" data-task-card="${task.id}">
    <div class="task-swipe-actions" aria-hidden="${open ? 'false' : 'true'}">
      <button type="button" class="swipe-action edit" data-edit="tasks" data-id="${task.id}">✎<span>แก้ไข</span></button>
      <button type="button" class="swipe-action delete" data-delete="tasks" data-id="${task.id}">🗑<span>ลบ</span></button>
    </div>
    <div class="task-card-surface" data-task-swipe-surface data-task-id="${task.id}">
      <div class="task-card-main">
        <div>
          <div class="task-card-title">${escapeHtml(task.title)}</div>
          <div class="task-meta-row">
            <span class="task-chip ${overdue ? 'overdue' : done ? 'done' : ''}">📅 ${taskDueLabel(task)}</span>
            ${important ? '<span class="task-chip priority">🔥 สำคัญ</span>' : ''}
            ${done ? '<span class="task-chip done">เสร็จแล้ว</span>' : ''}
          </div>
        </div>
        <button class="task-check-btn ${done ? 'done' : ''}" data-done="tasks" data-id="${task.id}" data-value="${!done}" aria-label="ทำงานให้เสร็จ">${done ? '↺' : '✓'}</button>
      </div>
    </div>
  </article>`;
};

const renderAllBeforeTasksV51 = renderAll;
renderAll = function(){
  renderDashboard();
  const txs = state.transactions.filter((x) => state.filters.tx === 'all' || x.type === state.filters.tx);
  const term = (state.filters.taskSearch || '').toLowerCase();
  const view = state.filters.taskView || state.filters.task || 'all';
  const sortedTasks = [...state.tasks].sort((a,b)=>{
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (taskIsToday(a) !== taskIsToday(b)) return taskIsToday(a) ? -1 : 1;
    if ((a.priority === 'important') !== (b.priority === 'important')) return a.priority === 'important' ? -1 : 1;
    return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
  });
  const todayTasks = sortedTasks.filter(t=>!t.done && taskIsToday(t));
  let tasks = sortedTasks.filter(t => {
    const matchesTerm = !term || `${t.title || ''} ${t.priority || ''} ${t.dueDate || ''}`.toLowerCase().includes(term);
    if (!matchesTerm) return false;
    if (view === 'today') return !t.done && taskIsToday(t);
    if (view === 'upcoming') return !t.done && t.dueDate && t.dueDate >= todayISO();
    if (view === 'done') return t.done;
    if (view === 'pending') return !t.done;
    return true;
  });
  const watchTerm = (state.filters.watch || '').toLowerCase();
  const watches = state.watchlist.filter((w) => (!watchTerm || `${w.title} ${w.type || ''} ${w.status || ''} ${w.genre || ''} ${w.platform || ''} ${w.year || ''}`.toLowerCase().includes(watchTerm)) && (state.filters.watchStatus === 'all' || w.status === state.filters.watchStatus));
  const noteTerm = (state.filters.note || '').toLowerCase();
  const notes = state.notes.filter((n) => !noteTerm || `${n.title} ${n.body} ${n.url}`.toLowerCase().includes(noteTerm));
  renderList($('transactionList'), txs, renderTransactionItem, 'ยังไม่มีรายการ');
  if ($('taskTodayList')) renderList($('taskTodayList'), todayTasks, renderTaskItem, '<div class="task-empty-hint">วันนี้ยังไม่มีงาน กด “วันนี้” ตอนเพิ่มงานเพื่อให้มาอยู่ตรงนี้</div>');
  renderList($('taskList'), tasks, renderTaskItem, '<div class="task-empty-hint">ยังไม่มีงานในมุมมองนี้</div>');
  renderList($('watchList'), watches, renderWatchItem, 'ยังไม่มีรายการ');
  hydrateMissingWatchPosters(watches);
  renderList($('noteList'), notes, renderNoteItem, 'ยังไม่มีโน้ต');
  updateTaskStats();
};

initTaskQuickOptions();

// ===== MyHub v5.4: Swipe actions for Tasks =====
state.openSwipeTaskId = state.openSwipeTaskId || null;
let taskSwipe = null;
const TASK_SWIPE_MAX = 132;
function closeTaskSwipe(){
  if (state.openSwipeTaskId) {
    state.openSwipeTaskId = null;
    renderAll();
  }
}

document.addEventListener('pointerdown', (event) => {
  const surface = event.target.closest('[data-task-swipe-surface]');
  if (!surface) {
    if (!event.target.closest('.task-swipe-actions')) closeTaskSwipe();
    return;
  }
  if (event.target.closest('button, input, select, textarea, a')) return;
  const card = surface.closest('.task-swipe-card');
  if (state.openSwipeTaskId && state.openSwipeTaskId !== surface.dataset.taskId) {
    state.openSwipeTaskId = null;
    renderAll();
    return;
  }
  taskSwipe = {
    id: surface.dataset.taskId,
    surface,
    card,
    startX: event.clientX,
    startY: event.clientY,
    dx: 0,
    dragging: false,
    wasOpen: card.classList.contains('swipe-open')
  };
});

document.addEventListener('pointermove', (event) => {
  if (!taskSwipe) return;
  const dx = event.clientX - taskSwipe.startX;
  const dy = event.clientY - taskSwipe.startY;
  if (!taskSwipe.dragging && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
  if (Math.abs(dy) > Math.abs(dx) && !taskSwipe.dragging) { taskSwipe = null; return; }
  taskSwipe.dragging = true;
  taskSwipe.card?.classList.add('swiping');
  event.preventDefault();
  const base = taskSwipe.wasOpen ? -TASK_SWIPE_MAX : 0;
  const next = Math.max(-TASK_SWIPE_MAX, Math.min(0, base + dx));
  taskSwipe.dx = next;
  taskSwipe.surface.style.transition = 'none';
  taskSwipe.surface.style.transform = `translateX(${next}px)`;
}, { passive: false });

document.addEventListener('pointerup', () => {
  if (!taskSwipe) return;
  const shouldOpen = taskSwipe.dx < -58;
  taskSwipe.surface.style.transition = '';
  taskSwipe.surface.style.transform = '';
  taskSwipe.card?.classList.remove('swiping');
  state.openSwipeTaskId = shouldOpen ? taskSwipe.id : null;
  taskSwipe = null;
  renderAll();
});

document.addEventListener('click', (event) => {
  if (event.target.closest('.task-swipe-actions')) {
    state.openSwipeTaskId = null;
    return;
  }
  const surface = event.target.closest('[data-task-swipe-surface]');
  if (surface && state.openSwipeTaskId && surface.dataset.taskId !== state.openSwipeTaskId) {
    closeTaskSwipe();
  }
});



// ===== MyHub v5.6: Drag order + Swipe right done + Subtasks =====
function taskSubtasks(task){ return Array.isArray(task.subtasks) ? task.subtasks : []; }
function subtaskProgress(task){
  const subs = taskSubtasks(task);
  if (!subs.length) return '';
  const done = subs.filter(s=>s.done).length;
  return `${done}/${subs.length}`;
}
async function toggleSubtask(taskId, index){
  const task = state.tasks.find(t=>t.id === taskId);
  if (!task) return;
  const subtasks = taskSubtasks(task).map((s,i)=> i === Number(index) ? { ...s, done: !s.done } : s);
  await updateDoc(userDoc('tasks', taskId), { subtasks, updatedAt: serverTimestamp() });
}

renderTaskItem = function(task){
  const done = Boolean(task.done);
  const overdue = taskIsOverdue(task);
  const important = task.priority === 'important';
  const open = state.openSwipeTaskId === task.id;
  const subs = taskSubtasks(task);
  const progress = subtaskProgress(task);
  return `<article class="task-card-premium task-swipe-card ${open ? 'swipe-open' : ''} ${done ? 'done' : ''} ${important ? 'priority-important' : ''} ${overdue ? 'overdue' : ''}" data-task-card="${task.id}" draggable="true">
    <div class="task-swipe-actions" aria-hidden="${open ? 'false' : 'true'}">
      <button type="button" class="swipe-action edit" data-edit="tasks" data-id="${task.id}">✎<span>แก้ไข</span></button>
      <button type="button" class="swipe-action delete" data-delete="tasks" data-id="${task.id}">🗑<span>ลบ</span></button>
    </div>
    <div class="task-card-surface" data-task-swipe-surface data-task-id="${task.id}">
      <div class="task-card-main">
        <button class="drag-handle" type="button" aria-label="ลากเพื่อจัดลำดับ">☰</button>
        <div class="task-content-block">
          <div class="task-card-title">${escapeHtml(task.title)}</div>
          <div class="task-meta-row">
            <span class="task-chip ${overdue ? 'overdue' : done ? 'done' : ''}">📅 ${taskDueLabel(task)}</span>
            ${important ? '<span class="task-chip priority">🔥 สำคัญ</span>' : ''}
            ${progress ? `<span class="task-chip subtask-progress">▦ ${progress}</span>` : ''}
          </div>
          ${subs.length ? `<div class="subtask-list">${subs.map((sub,i)=>`<button type="button" class="subtask-pill ${sub.done ? 'done' : ''}" data-subtask-toggle="${task.id}" data-subtask-index="${i}">${sub.done ? '✓' : '○'} ${escapeHtml(sub.title)}</button>`).join('')}</div>` : ''}
        </div>
        <button class="task-check-btn ${done ? 'done' : ''}" data-done="tasks" data-id="${task.id}" data-value="${!done}" aria-label="ทำงานให้เสร็จ">${done ? '↺' : '✓ เสร็จ'}</button>
      </div>
    </div>
  </article>`;
};

renderAll = function(){
  renderDashboard();
  const txs = state.transactions.filter((x) => state.filters.tx === 'all' || x.type === state.filters.tx);
  const term = (state.filters.taskSearch || '').toLowerCase();
  const view = state.filters.taskView || state.filters.task || 'all';
  const sortedTasks = [...state.tasks].sort((a,b)=>{
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ao = typeof a.order === 'number' ? a.order : (a.createdAt?.seconds || 0) * 1000;
    const bo = typeof b.order === 'number' ? b.order : (b.createdAt?.seconds || 0) * 1000;
    if (ao !== bo) return ao - bo;
    if (taskIsToday(a) !== taskIsToday(b)) return taskIsToday(a) ? -1 : 1;
    if ((a.priority === 'important') !== (b.priority === 'important')) return a.priority === 'important' ? -1 : 1;
    return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
  });
  const todayTasks = sortedTasks.filter(t=>!t.done && taskIsToday(t));
  let tasks = sortedTasks.filter(t => {
    const st = taskSubtasks(t).map(s=>s.title).join(' ');
    const matchesTerm = !term || `${t.title || ''} ${t.priority || ''} ${t.dueDate || ''} ${st}`.toLowerCase().includes(term);
    if (!matchesTerm) return false;
    if (view === 'today') return !t.done && taskIsToday(t);
    if (view === 'upcoming') return !t.done && t.dueDate && t.dueDate >= todayISO();
    if (view === 'done') return t.done;
    if (view === 'pending') return !t.done;
    return true;
  });
  const watchTerm = (state.filters.watch || '').toLowerCase();
  const watches = state.watchlist.filter((w) => (!watchTerm || `${w.title} ${w.type || ''} ${w.status || ''} ${w.genre || ''} ${w.platform || ''} ${w.year || ''}`.toLowerCase().includes(watchTerm)) && (state.filters.watchStatus === 'all' || w.status === state.filters.watchStatus));
  const noteTerm = (state.filters.note || '').toLowerCase();
  const notes = state.notes.filter((n) => !noteTerm || `${n.title} ${n.body} ${n.url}`.toLowerCase().includes(noteTerm));
  renderList($('transactionList'), txs, renderTransactionItem, 'ยังไม่มีรายการ');
  if ($('taskTodayList')) renderList($('taskTodayList'), todayTasks, renderTaskItem, '<div class="task-empty-hint">วันนี้ยังไม่มีงาน กด “วันนี้” ตอนเพิ่มงานเพื่อให้มาอยู่ตรงนี้</div>');
  renderList($('taskList'), tasks, renderTaskItem, '<div class="task-empty-hint">ยังไม่มีงานในมุมมองนี้</div>');
  renderList($('watchList'), watches, renderWatchItem, 'ยังไม่มีรายการ');
  hydrateMissingWatchPosters(watches);
  renderList($('noteList'), notes, renderNoteItem, 'ยังไม่มีโน้ต');
  updateTaskStats();
};

document.body.addEventListener('click', async (event)=>{
  const sub = event.target.closest('[data-subtask-toggle]');
  if (sub) {
    event.preventDefault();
    await toggleSubtask(sub.dataset.subtaskToggle, sub.dataset.subtaskIndex);
  }
});

// MyHub v5.7: Removed swipe-right-to-done because it conflicted with normal card gestures.
let draggedTaskId = null;
document.addEventListener('dragstart', (event)=>{
  const card = event.target.closest('.task-swipe-card');
  if (!card) return;
  draggedTaskId = card.dataset.taskCard;
  card.classList.add('dragging');
  event.dataTransfer.effectAllowed = 'move';
});
document.addEventListener('dragend', (event)=>{
  event.target.closest('.task-swipe-card')?.classList.remove('dragging');
  document.querySelectorAll('.task-swipe-card.drag-over').forEach(el=>el.classList.remove('drag-over'));
});
document.addEventListener('dragover', (event)=>{
  const card = event.target.closest('.task-swipe-card');
  if (!card || !draggedTaskId || card.dataset.taskCard === draggedTaskId) return;
  event.preventDefault();
  document.querySelectorAll('.task-swipe-card.drag-over').forEach(el=>el.classList.remove('drag-over'));
  card.classList.add('drag-over');
});
document.addEventListener('drop', async (event)=>{
  const target = event.target.closest('.task-swipe-card');
  if (!target || !draggedTaskId || target.dataset.taskCard === draggedTaskId) return;
  event.preventDefault();
  const ids = [...document.querySelectorAll('#taskList .task-swipe-card')].map(el=>el.dataset.taskCard);
  const from = ids.indexOf(draggedTaskId);
  const to = ids.indexOf(target.dataset.taskCard);
  if (from < 0 || to < 0) return;
  ids.splice(to, 0, ids.splice(from,1)[0]);
  await Promise.all(ids.map((id, index)=> updateDoc(userDoc('tasks', id), { order: index + 1, updatedAt: serverTimestamp() })));
  draggedTaskId = null;
  toast('จัดลำดับงานแล้ว');
});

renderAll();

// ===== MyHub v5.8: Premium Subtask UI =====
let taskDraftSubtasks = [];
let editTaskSubtasks = [];
function subtaskTitle(sub){ return String(sub?.title || sub?.text || '').trim(); }
function normalizeSubtasks(list){
  return (Array.isArray(list) ? list : [])
    .map((s)=> typeof s === 'string' ? { title: s.trim(), done: false } : { title: subtaskTitle(s), done: Boolean(s?.done) })
    .filter((s)=>s.title);
}
function syncTaskDraftHidden(){
  const hidden = $('taskSubtasks');
  if (hidden) hidden.value = taskDraftSubtasks.map((s)=>s.title).join(', ');
}
function renderTaskDraftSubtasks(){
  const list = $('subtaskDraftList');
  if (!list) return;
  syncTaskDraftHidden();
  if (!taskDraftSubtasks.length) {
    list.innerHTML = '<div class="subtask-empty-hint">แตะ + เพื่อเพิ่มงานย่อยได้หลายรายการ</div>';
    return;
  }
  list.innerHTML = taskDraftSubtasks.map((sub, index)=>`
    <div class="subtask-draft-chip">
      <span class="subtask-draft-dot">${index + 1}</span>
      <span class="subtask-draft-text">${escapeHtml(sub.title)}</span>
      <button type="button" class="subtask-remove-btn" data-remove-draft-subtask="${index}" aria-label="ลบงานย่อย">×</button>
    </div>`).join('');
}
function addTaskDraftSubtask(){
  const input = $('subtaskDraftInput');
  const title = (input?.value || '').trim();
  if (!title) return;
  taskDraftSubtasks.push({ title, done: false });
  input.value = '';
  renderTaskDraftSubtasks();
}
$('addSubtaskDraftBtn')?.addEventListener('click', addTaskDraftSubtask);
$('subtaskDraftInput')?.addEventListener('keydown', (event)=>{
  if (event.key === 'Enter') { event.preventDefault(); addTaskDraftSubtask(); }
});
document.body.addEventListener('click', (event)=>{
  const remove = event.target.closest('[data-remove-draft-subtask]');
  if (!remove) return;
  taskDraftSubtasks.splice(Number(remove.dataset.removeDraftSubtask), 1);
  renderTaskDraftSubtasks();
});
$('taskForm')?.addEventListener('submit', ()=>{ syncTaskDraftHidden(); }, true);
$('taskForm')?.addEventListener('submit', ()=>{
  setTimeout(()=>{ taskDraftSubtasks = []; renderTaskDraftSubtasks(); }, 80);
});
renderTaskDraftSubtasks();

function renderEditSubtasks(){
  const list = $('editSubtaskList');
  if (!list) return;
  if (!editTaskSubtasks.length) {
    list.innerHTML = '<div class="subtask-empty-hint">ยังไม่มีงานย่อย</div>';
    return;
  }
  list.innerHTML = editTaskSubtasks.map((sub, index)=>`
    <div class="edit-subtask-row ${sub.done ? 'done' : ''}">
      <button type="button" class="mini-check" data-toggle-edit-subtask="${index}">${sub.done ? '✓' : '○'}</button>
      <span class="edit-subtask-text">${escapeHtml(sub.title)}</span>
      <button type="button" class="edit-subtask-remove-btn" data-remove-edit-subtask="${index}">×</button>
    </div>`).join('');
}
function addEditSubtask(){
  const input = $('editSubtaskInput');
  const title = (input?.value || '').trim();
  if (!title) return;
  editTaskSubtasks.push({ title, done: false });
  input.value = '';
  renderEditSubtasks();
}
const originalOpenEditModalV58 = openEditModal;
openEditModal = function(col, id){
  if (col !== 'tasks') return originalOpenEditModalV58(col, id);
  const item = findItem(col, id);
  if (!item) return toast('ไม่พบข้อมูล');
  editing = { col, id };
  $('editTitle').textContent = 'แก้ไขงาน';
  editTaskSubtasks = normalizeSubtasks(item.subtasks);
  const f = $('editForm');
  f.innerHTML = `<input id="editTaskTitle" value="${escapeAttr(item.title)}" required />
    <input id="editTaskDue" type="date" value="${escapeAttr(item.dueDate || '')}" />
    <select id="editTaskPriority"><option value="normal">ปกติ</option><option value="important">สำคัญ</option></select>
    <div class="edit-subtask-builder">
      <label class="subtask-composer-label">งานย่อย</label>
      <div class="subtask-input-row">
        <input id="editSubtaskInput" class="edit-subtask-input" placeholder="เพิ่มงานย่อย" />
        <button id="addEditSubtaskBtn" type="button" class="edit-subtask-add-btn">＋</button>
      </div>
      <div id="editSubtaskList" class="edit-subtask-list"></div>
    </div>
    <button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
  $('editTaskPriority').value = item.priority || 'normal';
  $('addEditSubtaskBtn')?.addEventListener('click', addEditSubtask);
  $('editSubtaskInput')?.addEventListener('keydown', (event)=>{
    if (event.key === 'Enter') { event.preventDefault(); addEditSubtask(); }
  });
  renderEditSubtasks();
  $('editModal').classList.remove('hidden');
};
document.body.addEventListener('click', (event)=>{
  const toggle = event.target.closest('[data-toggle-edit-subtask]');
  if (toggle) {
    const i = Number(toggle.dataset.toggleEditSubtask);
    editTaskSubtasks[i].done = !editTaskSubtasks[i].done;
    renderEditSubtasks();
    return;
  }
  const remove = event.target.closest('[data-remove-edit-subtask]');
  if (remove) {
    editTaskSubtasks.splice(Number(remove.dataset.removeEditSubtask), 1);
    renderEditSubtasks();
  }
});
$('editForm')?.addEventListener('submit', async (event)=>{
  if (!editing || editing.col !== 'tasks') return;
  event.preventDefault();
  event.stopImmediatePropagation();
  await updateDoc(userDoc('tasks', editing.id), {
    title: $('editTaskTitle').value.trim(),
    dueDate: $('editTaskDue').value,
    dueTime: $('editTaskDueTime')?.value || '',
    reminderMinutes: $('editTaskReminder')?.value || 'none',
    reminderAt: getReminderAt($('editTaskDue').value, $('editTaskDueTime')?.value || '', $('editTaskReminder')?.value || 'none'),
    reminderNotified: false,
    priority: $('editTaskPriority').value,
    subtasks: normalizeSubtasks(editTaskSubtasks),
    updatedAt: serverTimestamp()
  });
  closeEditModal();
  toast('แก้ไขงานแล้ว');
}, true);

// Override task rendering with premium subtask checklist and progress bar.
renderTaskItem = function(task){
  const done = Boolean(task.done);
  const overdue = taskIsOverdue(task);
  const important = task.priority === 'important';
  const open = state.openSwipeTaskId === task.id;
  const subs = normalizeSubtasks(task.subtasks);
  const doneSubs = subs.filter((s)=>s.done).length;
  const pct = subs.length ? Math.round((doneSubs / subs.length) * 100) : 0;
  return `<article class="task-card-premium task-swipe-card ${open ? 'swipe-open' : ''} ${done ? 'done' : ''} ${important ? 'priority-important' : ''} ${overdue ? 'overdue' : ''}" data-task-card="${task.id}" draggable="true">
    <div class="task-swipe-actions" aria-hidden="${open ? 'false' : 'true'}">
      <button type="button" class="swipe-action edit" data-edit="tasks" data-id="${task.id}">✎<span>แก้ไข</span></button>
      <button type="button" class="swipe-action delete" data-delete="tasks" data-id="${task.id}">🗑<span>ลบ</span></button>
    </div>
    <div class="task-card-surface" data-task-swipe-surface data-task-id="${task.id}">
      <div class="task-card-main">
        <button class="drag-handle" type="button" aria-label="ลากเพื่อจัดลำดับ">☰</button>
        <div class="task-content-block">
          <div class="task-card-title">${escapeHtml(task.title)}</div>
          <div class="task-meta-row">
            <span class="task-chip ${overdue ? 'overdue' : done ? 'done' : ''}">📅 ${taskDueLabel(task)}</span>
            ${important ? '<span class="task-chip priority">🔥 สำคัญ</span>' : ''}
            ${subs.length ? `<span class="task-chip subtask-progress">▦ ${doneSubs}/${subs.length}</span>` : ''}
          </div>
          ${subs.length ? `<div class="task-subtask-panel">
            <div class="subtask-progress-head"><span class="subtask-progress-title">งานย่อย</span><span class="subtask-progress-count">${pct}%</span></div>
            <div class="subtask-progress-track"><div class="subtask-progress-fill" style="width:${pct}%"></div></div>
            <div class="subtask-check-list">
              ${subs.map((sub,i)=>`<button type="button" class="subtask-check-item ${sub.done ? 'done' : ''}" data-subtask-toggle="${task.id}" data-subtask-index="${i}"><span class="subtask-checkbox">✓</span><span class="subtask-check-text">${escapeHtml(sub.title)}</span></button>`).join('')}
            </div>
          </div>` : ''}
        </div>
        <button class="task-check-btn ${done ? 'done' : ''}" data-done="tasks" data-id="${task.id}" data-value="${!done}" aria-label="ทำงานให้เสร็จ">${done ? '↺' : '✓ เสร็จ'}</button>
      </div>
    </div>
  </article>`;
};

// Make legacy search include both title/text subtask formats.
const originalRenderAllV58 = renderAll;
renderAll = function(){ originalRenderAllV58(); };

// ===== MyHub v7: Money Premium UI =====
state.filters.txSearch = state.filters.txSearch || '';
const moneyCategoryIcons = {
  'อาหาร': '🍜', 'เดินทาง': '🚗', 'บิล': '🧾', 'ช้อปปิ้ง': '🛍️',
  'เงินเดือน': '💼', 'สุขภาพ': '💊', 'ความบันเทิง': '🎮', 'อื่น ๆ': '✨'
};
function txDateValue(tx){ return toDateValue(tx.date) || toDateValue(tx.createdAt) || new Date(); }
state.filters.moneyMonthOffset = state.filters.moneyMonthOffset || 0;
function selectedMoneyMonthDate(){ const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + (state.filters.moneyMonthOffset || 0)); return d; }
function monthTxs(){
  const selected = selectedMoneyMonthDate();
  return state.transactions.filter((tx)=>{ const d = txDateValue(tx); return d.getMonth() === selected.getMonth() && d.getFullYear() === selected.getFullYear(); });
}
function setMoneyMonthOffset(offset){
  state.filters.moneyMonthOffset = Math.min(0, offset);
  renderAll();
}
function setMoneyType(type){
  const select = $('txType'); if (select) select.value = type;
  document.querySelectorAll('[data-money-type]').forEach(btn=>btn.classList.toggle('active', btn.dataset.moneyType === type));
  if (type === 'income') setMoneyCategory('เงินเดือน');
}

function setMoneyCategory(cat){
  const select = $('txCategory'); if (select) select.value = cat;
  document.querySelectorAll('[data-money-category]').forEach(btn=>btn.classList.toggle('active', btn.dataset.moneyCategory === cat));
}
function setMoneyFilter(filter){
  state.filters.tx = filter;
  const select = $('txFilter'); if (select) select.value = filter;
  document.querySelectorAll('[data-money-filter]').forEach(btn=>btn.classList.toggle('active', btn.dataset.moneyFilter === filter));
  renderAll();
}
function renderMoneyPremium(){
  if (!$('moneyNetBalance')) return;
  const now = selectedMoneyMonthDate();
  safeSetText('moneyMonthLabel', now.toLocaleDateString('th-TH', { month:'long', year:'numeric' }));
  const nextBtn = $('moneyMonthNext'); if (nextBtn) nextBtn.disabled = (state.filters.moneyMonthOffset || 0) >= 0;
  const today = todayISO();
  const month = monthTxs();
  const income = month.filter(x=>x.type==='income').reduce((s,x)=>s+Number(x.amount||0),0);
  const expense = month.filter(x=>x.type==='expense').reduce((s,x)=>s+Number(x.amount||0),0);
  const todayExpense = state.transactions.filter(x=>x.type==='expense' && localISODate(txDateValue(x))===today).reduce((s,x)=>s+Number(x.amount||0),0);
  const net = income - expense;
  safeSetText('moneyNetBalance', baht.format(net));
  safeSetText('moneyMonthIncome', baht.format(income));
  safeSetText('moneyMonthExpense', baht.format(expense));
  safeSetText('moneyTodayExpense', baht.format(todayExpense));
  safeSetText('moneySaveRate', income ? `${Math.max(0, Math.round((net / income) * 100))}%` : '0%');

  const days = Array.from({length:7}, (_,i)=>{ const d = new Date(); d.setDate(d.getDate()-(6-i)); return { iso:localISODate(d), label:d.toLocaleDateString('th-TH', { day:'numeric' }), total:0 }; });
  state.transactions.filter(x=>x.type==='expense').forEach(tx=>{ const iso = localISODate(txDateValue(tx)); const day = days.find(d=>d.iso===iso); if (day) day.total += Number(tx.amount||0); });
  const weekTotal = days.reduce((s,d)=>s+d.total,0);
  safeSetText('moneyWeekTotal', baht.format(weekTotal));
  const maxDay = Math.max(1, ...days.map(d=>d.total));
  const bars = $('moneyWeekBars');
  if (bars) bars.innerHTML = days.map(d=>`<div class="money-day-bar ${d.total ? '' : 'empty'}"><div class="money-day-fill" style="height:${Math.max(12, Math.round((d.total/maxDay)*112))}px"></div><small>${d.label}</small></div>`).join('');

  const cats = {};
  month.filter(x=>x.type==='expense').forEach(tx=>{ const cat = tx.category || 'อื่น ๆ'; cats[cat] = (cats[cat] || 0) + Number(tx.amount||0); });
  const catRows = Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxCat = Math.max(1, ...catRows.map(x=>x[1]));
  const catBox = $('moneyCategoryBars');
  if (catBox) catBox.innerHTML = catRows.length ? catRows.map(([cat,total])=>`<div class="money-cat-row"><div class="money-cat-name">${moneyCategoryIcons[cat] || '✨'} ${escapeHtml(cat)}</div><div class="money-cat-track"><div class="money-cat-fill" style="width:${Math.max(8, Math.round((total/maxCat)*100))}%"></div></div><div class="money-cat-amount">${baht.format(total)}</div></div>`).join('') : '<div class="dash-empty">ยังไม่มีรายจ่ายเดือนนี้</div>';
}

renderTransactionItem = function(tx){
  const isIncome = tx.type === 'income';
  const amount = Number(tx.amount || 0);
  const cat = tx.category || 'อื่น ๆ';
  const icon = moneyCategoryIcons[cat] || (isIncome ? '💰' : '✨');
  return `<article class="money-tx-card ${isIncome ? 'income' : 'expense'}">
    <div class="money-tx-main">
      <div class="money-tx-icon">${icon}</div>
      <div class="money-tx-info">
        <h3>${escapeHtml(tx.title || 'ไม่มีชื่อรายการ')}</h3>
        <div class="money-tx-meta"><span>${escapeHtml(cat)}</span><span>${isIncome ? 'รายรับ' : 'รายจ่าย'}</span><span>${itemDateText(tx) || 'วันนี้'}</span></div>
      </div>
      <strong class="money-tx-amount">${isIncome ? '+' : '-'}${baht.format(amount)}</strong>
    </div>
    <div class="money-tx-actions">
      <button type="button" class="money-action-btn edit" data-edit="transactions" data-id="${tx.id}">✎ แก้ไข</button>
      <button type="button" class="money-action-btn delete" data-delete="transactions" data-id="${tx.id}">🗑 ลบ</button>
    </div>
  </article>`;
};

const originalRenderAllMoneyV7 = renderAll;
renderAll = function(){
  originalRenderAllMoneyV7();
  renderMoneyPremium();
  if ($('transactionList')) {
    const term = (state.filters.txSearch || '').toLowerCase();
    const txs = state.transactions
      .filter((x)=> state.filters.tx === 'all' || x.type === state.filters.tx)
      .filter((x)=> !term || `${x.title || ''} ${x.category || ''} ${x.type || ''} ${x.amount || ''}`.toLowerCase().includes(term))
      .sort((a,b)=> txDateValue(b) - txDateValue(a));
    renderList($('transactionList'), txs, renderTransactionItem, '<div class="dash-empty">ยังไม่มีรายการตามตัวกรองนี้</div>');
  }
};

document.body.addEventListener('click', (event)=>{
  const typeBtn = event.target.closest('[data-money-type]');
  if (typeBtn) { event.preventDefault(); setMoneyType(typeBtn.dataset.moneyType); return; }
  const catBtn = event.target.closest('[data-money-category]');
  if (catBtn) { event.preventDefault(); setMoneyCategory(catBtn.dataset.moneyCategory); return; }
  const filterBtn = event.target.closest('[data-money-filter]');
  if (filterBtn) { event.preventDefault(); setMoneyFilter(filterBtn.dataset.moneyFilter); return; }
  const amountBtn = event.target.closest('[data-amount-chip]');
  if (amountBtn) { event.preventDefault(); const input = $('txAmount'); if (input) input.value = Number(input.value || 0) + Number(amountBtn.dataset.amountChip || 0); return; }
});
$('txSearch')?.addEventListener('input', (event)=>{ state.filters.txSearch = event.target.value || ''; renderAll(); });
$('transactionForm')?.addEventListener('reset', ()=>{ window.setTimeout(()=>{ setMoneyType('expense'); setMoneyCategory('อาหาร'); }, 0); });
setMoneyType('expense');
setMoneyCategory('อาหาร');

// ===== MyHub v7.1: Money UX cleanup =====
$('toggleMoneyQuickAdd')?.addEventListener('click', () => {
  $('moneyAddCard')?.classList.toggle('collapsed');
  const input = $('txTitle');
  if (!$('moneyAddCard')?.classList.contains('collapsed')) setTimeout(() => input?.focus(), 120);
});
$('moneyMonthPrev')?.addEventListener('click', () => setMoneyMonthOffset((state.filters.moneyMonthOffset || 0) - 1));
$('moneyMonthNext')?.addEventListener('click', () => setMoneyMonthOffset((state.filters.moneyMonthOffset || 0) + 1));
window.addEventListener('appinstalled', () => $('installAppBtn')?.classList.add('hidden'));

// ===== MyHub Tasks v6: Calendar + Reminder =====
state.filters.taskCalendarDate = state.filters.taskCalendarDate || todayISO();

function taskDateObj(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function taskDateTextLong(iso) {
  const d = taskDateObj(iso);
  if (!d) return 'ไม่กำหนดวัน';
  if (iso === todayISO()) return 'วันนี้';
  if (iso === addDaysISO(1)) return 'พรุ่งนี้';
  return d.toLocaleDateString('th-TH', { weekday:'short', day:'numeric', month:'short' });
}
function taskFullDueText(task) {
  const date = taskDueLabel(task);
  return `${date}${task.dueTime ? ` · ${task.dueTime}` : ''}`;
}
function taskReminderText(task) {
  const r = task.reminderMinutes;
  if (r === undefined || r === null || r === '' || r === 'none') return '';
  const n = Number(r);
  if (Number.isNaN(n)) return '';
  if (n === 0) return '🔔 เตือนตรงเวลา';
  if (n === 60) return '🔔 ก่อน 1 ชม.';
  return `🔔 ก่อน ${n} นาที`;
}
function syncTaskDateUI(iso) {
  const value = iso || '';
  const hidden = $('taskDue');
  const picker = $('taskDueDatePicker');
  if (hidden) hidden.value = value;
  if (picker) picker.value = value;
  document.querySelectorAll('[data-task-due]').forEach((btn)=>{
    const mode = btn.dataset.taskDue;
    const expected = mode === 'today' ? todayISO() : mode === 'tomorrow' ? addDaysISO(1) : '';
    btn.classList.toggle('active', expected === value);
  });
}
function setTaskCalendarDate(iso) {
  state.filters.taskCalendarDate = iso || todayISO();
  renderAll();
}
function renderTaskWeekCalendar() {
  const box = $('taskWeekCalendar');
  if (!box) return;
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = localISODate(d);
    const count = state.tasks.filter(t => !t.done && t.dueDate === iso).length;
    return { iso, count, day: d.toLocaleDateString('th-TH', { weekday:'short' }), date: d.toLocaleDateString('th-TH', { day:'numeric' }) };
  });
  box.innerHTML = days.map(d => `<button type="button" class="task-day-pill ${d.iso === state.filters.taskCalendarDate ? 'active' : ''}" data-task-calendar-date="${d.iso}">
    <span>${d.day}</span><strong>${d.date}</strong>${d.count ? `<em>${d.count}</em>` : ''}
  </button>`).join('');
  safeSetText('taskSelectedDateLabel', taskDateTextLong(state.filters.taskCalendarDate));
}

// date picker + reminder controls
$('taskDueDatePicker')?.addEventListener('change', (event)=> syncTaskDateUI(event.target.value));
document.body.addEventListener('click', (event)=>{
  const day = event.target.closest('[data-task-calendar-date]');
  if (day) { event.preventDefault(); setTaskCalendarDate(day.dataset.taskCalendarDate); return; }
});
// keep old Today/Tomorrow chips and custom date picker in sync
setTimeout(()=>{
  document.querySelectorAll('[data-task-due]').forEach(btn=>btn.addEventListener('click',()=>{
    const mode = btn.dataset.taskDue;
    const value = mode === 'today' ? todayISO() : mode === 'tomorrow' ? addDaysISO(1) : '';
    setTimeout(()=>syncTaskDateUI(value), 0);
  }));
},0);
$('enableReminderBtn')?.addEventListener('click', async ()=>{
  if (!('Notification' in window)) return toast('เบราว์เซอร์นี้ยังไม่รองรับแจ้งเตือน');
  const res = await Notification.requestPermission();
  toast(res === 'granted' ? 'เปิดแจ้งเตือนแล้ว' : 'ยังไม่ได้อนุญาตแจ้งเตือน');
});

function getReminderAt(dueDate, dueTime, reminderMinutes) {
  if (!dueDate || !dueTime || reminderMinutes === 'none' || reminderMinutes === '' || reminderMinutes === undefined || reminderMinutes === null) return '';
  const date = new Date(`${dueDate}T${dueTime}:00`);
  if (Number.isNaN(date.getTime())) return '';
  date.setMinutes(date.getMinutes() - Number(reminderMinutes || 0));
  return date.toISOString();
}

// Override add task submit so time/reminder is saved and duplicate legacy submit is blocked.
$('taskForm')?.addEventListener('submit', async (event)=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const title = ($('taskTitle')?.value || '').trim();
  if (!title) return;
  if (!currentUser) return toast('กรุณาเข้าสู่ระบบก่อน');
  const dueDate = $('taskDueDatePicker')?.value || $('taskDue')?.value || '';
  const dueTime = $('taskDueTime')?.value || '';
  const reminderMinutes = $('taskReminder')?.value || 'none';
  if (reminderMinutes !== 'none' && (!dueDate || !dueTime)) {
    return toast('ตั้งแจ้งเตือนต้องเลือกวันและเวลา');
  }
  if (reminderMinutes !== 'none' && 'Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
  await addDoc(userCol('tasks'), {
    title,
    dueDate,
    dueTime,
    reminderMinutes,
    reminderAt: getReminderAt(dueDate, dueTime, reminderMinutes),
    reminderNotified: false,
    priority: $('taskPriority')?.value || 'normal',
    subtasks: normalizeSubtasks(taskDraftSubtasks),
    done: false,
    order: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  $('taskForm')?.reset();
  taskDraftSubtasks = [];
  renderTaskDraftSubtasks();
  syncTaskDateUI('');
  if ($('taskPriority')) $('taskPriority').value = 'normal';
  if ($('taskReminder')) $('taskReminder').value = 'none';
  document.querySelectorAll('[data-task-priority]').forEach(b=>b.classList.remove('active'));
  toast('เพิ่มงานแล้ว');
}, true);

// Override task cards with time + reminder chips.
renderTaskItem = function(task){
  const done = Boolean(task.done);
  const overdue = taskIsOverdue(task);
  const important = task.priority === 'important';
  const open = state.openSwipeTaskId === task.id;
  const subs = normalizeSubtasks(task.subtasks);
  const doneSubs = subs.filter((s)=>s.done).length;
  const pct = subs.length ? Math.round((doneSubs / subs.length) * 100) : 0;
  const reminder = taskReminderText(task);
  return `<article class="task-card-premium task-swipe-card ${open ? 'swipe-open' : ''} ${done ? 'done' : ''} ${important ? 'priority-important' : ''} ${overdue ? 'overdue' : ''}" data-task-card="${task.id}" draggable="true">
    <div class="task-swipe-actions" aria-hidden="${open ? 'false' : 'true'}">
      <button type="button" class="swipe-action edit" data-edit="tasks" data-id="${task.id}">✎<span>แก้ไข</span></button>
      <button type="button" class="swipe-action delete" data-delete="tasks" data-id="${task.id}">🗑<span>ลบ</span></button>
    </div>
    <div class="task-card-surface" data-task-swipe-surface data-task-id="${task.id}">
      <div class="task-card-main">
        <button class="drag-handle" type="button" aria-label="ลากเพื่อจัดลำดับ">☰</button>
        <div class="task-content-block">
          <div class="task-card-title">${escapeHtml(task.title)}</div>
          <div class="task-meta-row">
            <span class="task-chip ${overdue ? 'overdue' : done ? 'done' : ''}">📅 ${escapeHtml(taskFullDueText(task))}</span>
            ${important ? '<span class="task-chip priority">🔥 สำคัญ</span>' : ''}
            ${reminder ? `<span class="task-chip reminder">${escapeHtml(reminder)}</span>` : ''}
            ${subs.length ? `<span class="task-chip subtask-progress">▦ ${doneSubs}/${subs.length}</span>` : ''}
          </div>
          ${subs.length ? `<div class="task-subtask-panel">
            <div class="subtask-progress-head"><span class="subtask-progress-title">งานย่อย</span><span class="subtask-progress-count">${pct}%</span></div>
            <div class="subtask-progress-track"><div class="subtask-progress-fill" style="width:${pct}%"></div></div>
            <div class="subtask-check-list">
              ${subs.map((sub,i)=>`<button type="button" class="subtask-check-item ${sub.done ? 'done' : ''}" data-subtask-toggle="${task.id}" data-subtask-index="${i}"><span class="subtask-checkbox">✓</span><span class="subtask-check-text">${escapeHtml(sub.title)}</span></button>`).join('')}
            </div>
          </div>` : ''}
        </div>
        <button class="task-check-btn ${done ? 'done' : ''}" data-done="tasks" data-id="${task.id}" data-value="${!done}" aria-label="ทำงานให้เสร็จ">${done ? '↺' : '✓ เสร็จ'}</button>
      </div>
    </div>
  </article>`;
};

// Override renderAll to include calendar selected day list.
const renderAllBeforeTasksV6Calendar = renderAll;
renderAll = function(){
  renderAllBeforeTasksV6Calendar();
  renderTaskWeekCalendar();
  const selected = state.filters.taskCalendarDate || todayISO();
  const selectedTasks = [...state.tasks]
    .filter(t => !t.done && t.dueDate === selected)
    .sort((a,b)=> String(a.dueTime || '99:99').localeCompare(String(b.dueTime || '99:99')) || String(a.title || '').localeCompare(String(b.title || '')));
  if ($('taskSelectedDateList')) renderList($('taskSelectedDateList'), selectedTasks, renderTaskItem, `<div class="task-empty-hint">ไม่มีงานในวันที่ ${escapeHtml(taskDateTextLong(selected))}</div>`);
};

// Reminder checker: works while the web app/PWA is open.
async function checkTaskReminders(){
  if (!(auth.currentUser || state.user) || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  const due = state.tasks.filter(t => !t.done && t.reminderAt && !t.reminderNotified && new Date(t.reminderAt).getTime() <= now);
  for (const task of due) {
    try {
      new Notification('MyHub เตือนงาน', {
        body: `${task.title}${task.dueTime ? ` · ${task.dueTime}` : ''}`,
        icon: './icons/icon-192.svg',
        badge: './icons/icon-192.svg'
      });
      await updateDoc(userDoc('tasks', task.id), { reminderNotified: true, updatedAt: serverTimestamp() });
    } catch (e) { console.warn('Reminder failed', e); }
  }
}
setInterval(checkTaskReminders, 30000);
document.addEventListener('visibilitychange', ()=>{ if (!document.hidden) checkTaskReminders(); });
setTimeout(()=>{ syncTaskDateUI(''); renderAll(); checkTaskReminders(); }, 300);

// Task edit modal v6: add time/reminder fields.
const openEditModalBeforeTasksV6 = openEditModal;
openEditModal = function(col, id){
  if (col !== 'tasks') return openEditModalBeforeTasksV6(col, id);
  const item = findItem(col, id);
  if (!item) return toast('ไม่พบข้อมูล');
  editing = { col, id };
  $('editTitle').textContent = 'แก้ไขงาน';
  editTaskSubtasks = normalizeSubtasks(item.subtasks);
  const f = $('editForm');
  f.innerHTML = `<input id="editTaskTitle" value="${escapeAttr(item.title)}" required />
    <input id="editTaskDue" type="date" value="${escapeAttr(item.dueDate || '')}" />
    <div class="task-date-reminder-panel edit-task-reminder-panel">
      <label class="task-mini-field"><span>เวลา</span><input id="editTaskDueTime" type="time" value="${escapeAttr(item.dueTime || '')}" /></label>
      <label class="task-mini-field"><span>แจ้งเตือน</span><select id="editTaskReminder"><option value="none">ไม่เตือน</option><option value="0">ตรงเวลา</option><option value="10">ก่อน 10 นาที</option><option value="30">ก่อน 30 นาที</option><option value="60">ก่อน 1 ชั่วโมง</option></select></label>
    </div>
    <select id="editTaskPriority"><option value="normal">ปกติ</option><option value="important">สำคัญ</option></select>
    <div class="edit-subtask-builder">
      <label class="subtask-composer-label">งานย่อย</label>
      <div class="subtask-input-row">
        <input id="editSubtaskInput" class="edit-subtask-input" placeholder="เพิ่มงานย่อย" />
        <button id="addEditSubtaskBtn" type="button" class="edit-subtask-add-btn">＋</button>
      </div>
      <div id="editSubtaskList" class="edit-subtask-list"></div>
    </div>
    <button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
  $('editTaskPriority').value = item.priority || 'normal';
  if ($('editTaskReminder')) $('editTaskReminder').value = item.reminderMinutes ?? 'none';
  $('addEditSubtaskBtn')?.addEventListener('click', addEditSubtask);
  $('editSubtaskInput')?.addEventListener('keydown', (event)=>{ if (event.key === 'Enter') { event.preventDefault(); addEditSubtask(); } });
  renderEditSubtasks();
  $('editModal').classList.remove('hidden');
};


// ===== MyHub v6.10.8 Auth Flow Final =====
// Stable writes: always use auth.currentUser fallback and stop legacy duplicate submit handlers.
(function initStableAuthWrites(){
  function readyUser(){
    const user = auth.currentUser || state.user;
    if (user) state.user = user;
    return user;
  }

  function resetTaskUI(){
    if (typeof taskDraftSubtasks !== 'undefined') taskDraftSubtasks = [];
    if (typeof renderTaskDraftSubtasks === 'function') renderTaskDraftSubtasks();
    if (typeof syncTaskDateUI === 'function') syncTaskDateUI('');
    const priority = document.getElementById('taskPriority');
    const reminder = document.getElementById('taskReminder');
    if (priority) priority.value = 'normal';
    if (reminder) reminder.value = 'none';
    document.querySelectorAll('[data-task-priority]').forEach((btn)=>btn.classList.remove('active'));
  }

  async function addStable(colName, payload){
    if (!state.authReady && !auth.currentUser) {
      toast('ระบบกำลังโหลด กรุณารอสักครู่');
      throw new Error('auth-not-ready');
    }
    const user = readyUser();
    if (!user) {
      toast('กรุณาเข้าสู่ระบบก่อน');
      throw new Error('not-authenticated');
    }
    return addDoc(collection(db, 'users', user.uid, colName), payload);
  }

  document.addEventListener('submit', async function(event){
    const form = event.target;
    if (!form || !['taskForm','txForm','watchForm','noteForm'].includes(form.id)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    try {
      if (form.id === 'taskForm') {
        const title = (document.getElementById('taskTitle')?.value || '').trim();
        if (!title) return toast('กรุณาพิมพ์ชื่องาน');

        const dueDate = (document.getElementById('taskDueDatePicker')?.value || document.getElementById('taskDue')?.value || '').trim();
        const dueTime = (document.getElementById('taskDueTime')?.value || '').trim();
        const reminderMinutes = document.getElementById('taskReminder')?.value || 'none';

        if (reminderMinutes !== 'none' && (!dueDate || !dueTime)) {
          return toast('ตั้งแจ้งเตือนต้องเลือกวันและเวลา');
        }

        const rawSubtasks = typeof taskDraftSubtasks !== 'undefined' ? taskDraftSubtasks : [];
        const subtasks = (Array.isArray(rawSubtasks) ? rawSubtasks : [])
          .map((sub)=> typeof sub === 'string' ? { title: sub, done: false } : { title: sub.title, done: Boolean(sub.done) })
          .filter((sub)=> (sub.title || '').trim());

        await addStable('tasks', {
          title,
          dueDate,
          dueTime,
          reminderMinutes,
          reminderAt: typeof getReminderAt === 'function' ? getReminderAt(dueDate, dueTime, reminderMinutes) : '',
          reminderNotified: false,
          priority: document.getElementById('taskPriority')?.value || 'normal',
          subtasks,
          done: false,
          order: Date.now(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });

        form.reset();
        resetTaskUI();
        toast('เพิ่มงานแล้ว');
        return;
      }

      if (form.id === 'txForm') {
        const title = (document.getElementById('txTitle')?.value || '').trim();
        const amount = Number(document.getElementById('txAmount')?.value || 0);
        if (!title) return toast('กรุณาระบุชื่อรายการ');
        if (!amount || amount <= 0) return toast('กรุณาระบุจำนวนเงิน');

        await addStable('transactions', {
          title,
          amount,
          type: document.getElementById('txType')?.value || 'expense',
          category: document.getElementById('txCategory')?.value || 'อื่น ๆ',
          date: new Date(),
          createdAt: serverTimestamp()
        });

        form.reset();
        document.getElementById('moneyAddCard')?.classList.add('collapsed');
        toast('บันทึกรายการแล้ว');
        return;
      }

      if (form.id === 'watchForm') {
        const title = (document.getElementById('watchTitle')?.value || '').trim();
        if (!title) return toast('กรุณาระบุชื่อเรื่อง');

        await addStable('watchlist', {
          title,
          poster: typeof resolvePosterUrl === 'function' ? await resolvePosterUrl(title, '', '') : '',
          type: document.getElementById('watchType')?.value || 'หนัง',
          status: document.getElementById('watchStatus')?.value || 'อยากดู',
          genre: '',
          platform: document.getElementById('watchPlatform')?.value || 'Netflix',
          year: '',
          rating: '',
          note: '',
          createdAt: serverTimestamp()
        });

        form.reset();
        if (document.getElementById('watchStatus')) document.getElementById('watchStatus').value = 'อยากดู';
        if (document.getElementById('watchType')) document.getElementById('watchType').value = 'หนัง';
        if (document.getElementById('watchPlatform')) document.getElementById('watchPlatform').value = 'Netflix';
        if (typeof renderAppDropdown === 'function') {
          renderAppDropdown('watchPlatformDropdown', 'Netflix', 'platform');
          renderAppDropdown('watchTypeDropdown', 'หนัง', 'type');
        }
        if (typeof setupStatusTabs === 'function') setupStatusTabs('#watchStatusTabs .status-tab', 'watchStatus', 'อยากดู');
        if (typeof initAppDropdowns === 'function') initAppDropdowns();
        toast('เพิ่มเข้ารายการแล้ว');
        return;
      }

      if (form.id === 'noteForm') {
        const title = (document.getElementById('noteTitle')?.value || '').trim();
        const url = (document.getElementById('noteUrl')?.value || '').trim();
        const body = (document.getElementById('noteBody')?.value || '').trim();

        if (!title && !url && !body) return toast('กรุณากรอกโน้ตอย่างน้อย 1 ช่อง');

        await addStable('notes', {
          title,
          url,
          body,
          createdAt: serverTimestamp()
        });

        form.reset();
        toast('บันทึกโน้ตแล้ว');
        return;
      }
    } catch (error) {
      if (error?.message === 'auth-not-ready' || error?.message === 'not-authenticated') return;
      console.error('Stable form submit failed:', error);
      toast(error?.message ? `บันทึกไม่สำเร็จ: ${error.message}` : 'บันทึกไม่สำเร็จ');
    }
  }, true);

  document.addEventListener('click', function(event){
    const dueBtn = event.target.closest('[data-task-due]');
    if (!dueBtn) return;
    const mode = dueBtn.dataset.taskDue;
    const value = mode === 'today' ? todayISO() : mode === 'tomorrow' ? addDaysISO(1) : '';
    if (typeof syncTaskDateUI === 'function') syncTaskDateUI(value);
  }, true);
})();


// MyHub v6.10.10 safe realtime display patch
// Login-safe patch: do not touch auth handlers; only make renderAll defensive.
(function(){
  const previousRenderAll = typeof renderAll === 'function' ? renderAll : null;
  if (!previousRenderAll) return;

  renderAll = function(){
    try {
      previousRenderAll();
    } catch (error) {
      console.warn('renderAll failed, fallback rendering lists:', error);

      try { renderDashboard(); } catch(e) {}

      function safeRender(el, items, renderer, emptyText){
        if (!el) return;
        const list = Array.isArray(items) ? items : [];
        el.classList.toggle('empty-box', list.length === 0);
        el.innerHTML = list.length
          ? list.map((item)=>{
              try { return renderer(item); }
              catch(e) { return `<article class="item-card"><div class="item-title">${escapeHtml(item.title || 'ไม่มีชื่อ')}</div></article>`; }
            }).join('')
          : emptyText;
      }

      safeRender($('transactionList'), state.transactions, renderTransactionItem, 'ยังไม่มีรายการ');
      safeRender($('taskList'), state.tasks, renderTaskItem, '<div class="task-empty-hint">ยังไม่มีงาน</div>');
      if ($('taskTodayList')) {
        const today = todayISO();
        safeRender($('taskTodayList'), state.tasks.filter(t => !t.done && t.dueDate === today), renderTaskItem, '<div class="task-empty-hint">ยังไม่มีงานวันนี้</div>');
      }
      safeRender($('watchList'), state.watchlist, renderWatchItem, 'ยังไม่มีรายการ');
      safeRender($('noteList'), state.notes, renderNoteItem, 'ยังไม่มีโน้ต');
    }
  };
})();
