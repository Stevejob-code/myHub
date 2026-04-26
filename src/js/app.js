import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js';
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updateProfile
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
const db = getFirestore(app);

const $ = (id) => document.getElementById(id);
const baht = new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', maximumFractionDigits: 0 });
const todayISO = () => new Date().toISOString().slice(0, 10);

const state = {
  mode: 'login',
  user: null,
  profile: null,
  transactions: [],
  tasks: [],
  watchlist: [],
  notes: [],
  unsubscribers: []
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
  Object.entries(pages).forEach(([key, el]) => el.classList.toggle('active-page', key === name));
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
  }));

  const bind = (key, path, sorter = 'createdAt') => {
    const q = query(collection(db, 'users', uid, path), orderBy(sorter, 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      state[key] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderAll();
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
  $('todayText').textContent = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'short' });
  const month = now.getMonth();
  const year = now.getFullYear();
  const thisMonth = state.transactions.filter((tx) => {
    const d = tx.date?.toDate ? tx.date.toDate() : new Date(tx.date || tx.createdAt?.toDate?.() || Date.now());
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const income = thisMonth.filter((x) => x.type === 'income').reduce((sum, x) => sum + Number(x.amount || 0), 0);
  const expense = thisMonth.filter((x) => x.type === 'expense').reduce((sum, x) => sum + Number(x.amount || 0), 0);
  $('incomeTotal').textContent = baht.format(income);
  $('expenseTotal').textContent = baht.format(expense);
  $('balanceTotal').textContent = baht.format(income - expense);
  $('pendingTasks').textContent = state.tasks.filter((t) => !t.done).length;

  const todays = state.tasks.filter((t) => !t.done && t.dueDate === todayISO()).slice(0, 3);
  renderList($('todayTasks'), todays, renderTaskItem, 'ยังไม่มีงานวันนี้');
  renderList($('recentNotes'), state.notes.slice(0, 3), renderNoteItem, 'ยังไม่มีโน้ต');
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
  if (!state.user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  return collection(db, 'users', state.user.uid, name);
}

function userDoc(colName, id) {
  if (!state.user) throw new Error('ยังไม่ได้เข้าสู่ระบบ');
  return doc(db, 'users', state.user.uid, colName, id);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}
function escapeAttr(value = '') { return escapeHtml(value); }

$('loginTab').addEventListener('click', () => setMode('login'));
$('registerTab').addEventListener('click', () => setMode('register'));
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
  toast('บันทึกรายการแล้ว');
});

$('taskForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await addDoc(userCol('tasks'), {
    title: $('taskTitle').value.trim(),
    dueDate: $('taskDue').value,
    priority: $('taskPriority').value,
    done: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  event.target.reset();
  toast('เพิ่มงานแล้ว');
});

$('watchForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  await addDoc(userCol('watchlist'), {
    title: $('watchTitle').value.trim(),
    type: $('watchType').value,
    status: $('watchStatus').value,
    note: $('watchNote').value.trim(),
    createdAt: serverTimestamp()
  });
  event.target.reset();
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
  state.user = user;
  if (user) {
    await ensureUserProfile(user);
    $('authScreen').classList.add('hidden');
    $('mainApp').classList.remove('hidden');
    subscribeUserData(user.uid);
    navTo('dashboard');
  } else {
    clearSubscriptions();
    state.profile = null;
    $('authScreen').classList.remove('hidden');
    $('mainApp').classList.add('hidden');
  }
});

// ===== MyHub v2: Quick Add, Filters, Search, Edit =====
state.filters = { tx: 'all', task: 'all', watch: '', note: '' };
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
  return `<article class="item-card">
    <div class="item-row">
      <div><div class="item-title">${escapeHtml(item.title)}</div><div class="item-meta">${escapeHtml(item.type)} · ${escapeHtml(item.status)}</div>${item.note ? `<div class="item-meta">${escapeHtml(item.note)}</div>` : ''}</div>
      <div class="item-actions"><button class="icon-btn edit-btn" data-edit="watchlist" data-id="${item.id}">แก้</button><button class="icon-btn delete" data-delete="watchlist" data-id="${item.id}">ลบ</button></div>
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
  const watches = state.watchlist.filter((w) => !watchTerm || `${w.title} ${w.type} ${w.status} ${w.note}`.toLowerCase().includes(watchTerm));
  const noteTerm = state.filters.note.toLowerCase();
  const notes = state.notes.filter((n) => !noteTerm || `${n.title} ${n.body} ${n.url}`.toLowerCase().includes(noteTerm));
  renderList($('transactionList'), txs, renderTransactionItem, 'ยังไม่มีรายการ');
  renderList($('taskList'), tasks, renderTaskItem, 'ยังไม่มีงาน');
  renderList($('watchList'), watches, renderWatchItem, 'ยังไม่มีรายการ');
  renderList($('noteList'), notes, renderNoteItem, 'ยังไม่มีโน้ต');
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
    f.innerHTML = `<input id="editWatchTitle" value="${escapeAttr(item.title)}" required /><select id="editWatchType"><option>หนัง</option><option>ซีรีส์</option><option>อนิเมะ</option></select><select id="editWatchStatus"><option>อยากดู</option><option>กำลังดู</option><option>ดูจบแล้ว</option></select><input id="editWatchNote" value="${escapeAttr(item.note || '')}" placeholder="โน้ต" /><button class="primary-btn" type="submit">บันทึกการแก้ไข</button>`;
    $('editWatchType').value = item.type || 'หนัง'; $('editWatchStatus').value = item.status || 'อยากดู';
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
  if (editing.col === 'watchlist') data = { ...data, title: $('editWatchTitle').value.trim(), type: $('editWatchType').value, status: $('editWatchStatus').value, note: $('editWatchNote').value.trim() };
  if (editing.col === 'notes') data = { ...data, title: $('editNoteTitle').value.trim(), url: $('editNoteUrl').value.trim(), body: $('editNoteBody').value.trim() };
  await updateDoc(userDoc(editing.col, editing.id), data);
  closeEditModal();
  toast('แก้ไขแล้ว');
});
