// ================= FIREBASE AUTH & DATABASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAQz-4TAujSNhDV8wQY82-wnCTGJtdxhsM", 
  authDomain: "quan-ly-day-them-f7b1e.firebaseapp.com",
  projectId: "quan-ly-day-them-f7b1e",
  storageBucket: "quan-ly-day-them-f7b1e.firebasestorage.app",
  messagingSenderId: "613673074776",
  appId: "1:613673074776:web:639fe0c51ae83b56a8ca2d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const firestoreDb = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

const loginScreen = document.getElementById('login-screen');
const btnLogin = document.getElementById('btn-login');

if(btnLogin) {
    btnLogin.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch((error) => alert("Lỗi đăng nhập: " + error.message));
    });
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        if(loginScreen) loginScreen.style.display = 'none';

        const userRef = doc(firestoreDb, 'khach_hang_gvcn', user.uid);
        let hasAccess = true;

        try {
            const docUserSnap = await getDoc(userRef);
            const ngayHienTai = new Date();

            if (!docUserSnap.exists()) {
                let ngayHetHan = new Date();
                ngayHetHan.setDate(ngayHienTai.getDate() + 30);
                await setDoc(userRef, { email: user.email, ngay_dang_ky: ngayHienTai.toISOString(), ngay_het_han: ngayHetHan.toISOString() });
            } else {
                const duLieu = docUserSnap.data();
                const ngayHetHan = new Date(duLieu.ngay_het_han);
                if (ngayHienTai > ngayHetHan) {
                    hasAccess = false;
                    document.getElementById('man-hinh-thu-phi').style.display = 'block';
                    let emailElements = document.getElementsByClassName('email-user');
                    for (let i = 0; i < emailElements.length; i++) emailElements[i].innerText = user.email.split('@')[0];
                }
            }
        } catch (error) { console.log("Lỗi kiểm tra bản quyền:", error); }

        if (hasAccess) {
            try {
                const docRef = doc(firestoreDb, "DuLieuGVCN", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    appData = docSnap.data(); 
                } else {
                    await setDoc(docRef, appData); 
                }
            } catch(e) {
                console.warn("Lỗi tải mây:", e);
            }
            window.updateDashboardInfo(); window.renderStudents(); window.loadSettings(); window.renderKanban(); window.renderDocs(); window.renderSetupData();
        }
    } else {
        currentUser = null;
        if(loginScreen) loginScreen.style.display = 'flex';
    }
});

window.logoutApp = function() {
    if(confirm("Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này?")) {
        signOut(auth).then(() => {
            localStorage.removeItem('gvcnData_v4'); 
            location.reload();
        });
    }
};

// ================= DATA STRUCTURE =================
const defaultTags = [
    { id: "t1", name: "Đi học muộn", type: "negative", defaultPoints: -1, currentPoints: -1, isSystem: true, enabled: true, icon: "fa-clock", color: "qt-negative" },
    { id: "t2", name: "Không thuộc bài", type: "negative", defaultPoints: -1, currentPoints: -1, isSystem: true, enabled: true, icon: "fa-book-open", color: "qt-negative" },
    { id: "t3", name: "Mất trật tự", type: "negative", defaultPoints: -1, currentPoints: -1, isSystem: true, enabled: true, icon: "fa-volume-up", color: "qt-negative" },
    { id: "t4", name: "Vi phạm nội quy", type: "negative", defaultPoints: -2, currentPoints: -2, isSystem: true, enabled: true, icon: "fa-exclamation-triangle", color: "qt-negative" },
    { id: "t5", name: "Tích cực phát biểu", type: "positive", defaultPoints: 1, currentPoints: 1, isSystem: true, enabled: true, icon: "fa-hand-paper", color: "qt-positive" },
    { id: "t6", name: "Làm việc tốt", type: "positive", defaultPoints: 2, currentPoints: 2, isSystem: true, enabled: true, icon: "fa-heart", color: "qt-positive" },
    { id: "t7", name: "Đạt thành tích", type: "positive", defaultPoints: 3, currentPoints: 3, isSystem: true, enabled: true, icon: "fa-medal", color: "qt-positive" }
];
const defaultSettings = { teacherName: "Nguyễn Thu Hà", className: "8A1", year: "2026-2027", autoAbsentDisc: false, autoLateDisc: false, warnAbsent: 3, warnBehavior: -5, theme: "default", apiKey: "" };

function initData() {
    let v4Data = JSON.parse(localStorage.getItem('gvcnData_v4'));
    if (!v4Data) {
        let v3Data = JSON.parse(localStorage.getItem('gvcnData_v3')) || JSON.parse(localStorage.getItem('gvcnData_v2'));
        v4Data = {
            settings: v3Data ? { ...defaultSettings, ...v3Data.settings } : defaultSettings,
            students: v3Data ? v3Data.students : [], attendance: v3Data ? v3Data.attendance : {},
            behaviorTags: defaultTags, behaviorRecords: v3Data ? v3Data.behaviorRecords||[] : [], tasks: v3Data ? v3Data.tasks||[] : [], 
            notifications: v3Data ? v3Data.notifications||[] : [], documents: v3Data ? v3Data.documents||[] : [],
            scheduleSetup: v3Data && v3Data.scheduleSetup ? v3Data.scheduleSetup : { week1Start: "", ppct: [], tkb: [], holidays: [] },
            scheduleRecords: v3Data && v3Data.scheduleRecords ? v3Data.scheduleRecords : [],
            monthlyThemes: v3Data && v3Data.settings && v3Data.settings.monthlyThemes ? v3Data.settings.monthlyThemes : { "8": "VĂN MINH - XANH - AN TOÀN" }
        };
        localStorage.setItem('gvcnData_v4', JSON.stringify(v4Data));
    } else {
        if (!v4Data.settings.monthlyThemes) { v4Data.settings.monthlyThemes = { "8": "VĂN MINH - XANH - AN TOÀN" }; }
        if (!v4Data.settings.theme) { v4Data.settings.theme = "default"; }
    }
    return v4Data;
}

let appData = initData();
let syncTimeout = null;

window.saveData = function() { 
    localStorage.setItem('gvcnData_v4', JSON.stringify(appData)); 
    window.updateDashboardInfo(); 
    if (currentUser) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const docRef = doc(firestoreDb, "DuLieuGVCN", currentUser.uid);
            setDoc(docRef, appData).then(() => { console.log("☁️ Đã đồng bộ nền lên Firebase thành công!"); }).catch(e => console.error("Lỗi đồng bộ mây:", e));
        }, 3000);
    }
}

function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function formatDateTime() { const d = new Date(); return `${d.toLocaleDateString('vi-VN')} ${d.getHours()}:${d.getMinutes()}`; }

const DB_NAME = 'GVCN_Docs_DB'; const DB_VERSION = 1; let db;
function initIndexedDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onerror = () => reject(); request.onsuccess = (e) => { db = e.target.result; resolve(db); }; request.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' }); }; }); }
window.saveFileToDB = function(id, file) { return new Promise((resolve, reject) => { const req = db.transaction(['files'], 'readwrite').objectStore('files').put({ id: id, blob: file }); req.onsuccess = resolve; req.onerror = reject; }); }
window.getFileFromDB = function(id) { return new Promise((resolve, reject) => { const req = db.transaction(['files'], 'readonly').objectStore('files').get(id); req.onsuccess = (e) => resolve(e.target.result ? e.target.result.blob : null); req.onerror = reject; }); }
window.deleteFileFromDB = function(id) { return new Promise((resolve, reject) => { const req = db.transaction(['files'], 'readwrite').objectStore('files').delete(id); req.onsuccess = resolve; req.onerror = reject; }); }

window.onload = async () => {
    await initIndexedDB(); 
    document.getElementById('today-date').innerText = new Date().toLocaleDateString('vi-VN');
    document.getElementById('attendance-date').value = getTodayStr();
    window.updateDashboardInfo(); window.renderStudents(); window.loadSettings(); window.renderKanban(); window.renderDocs(); window.renderSetupData();
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err)); }
};

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${message}</span>`; container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

window.switchView = function(viewId, navElement = null) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active'); window.scrollTo(0, 0);
    if (navElement) { document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); navElement.classList.add('active'); }
    if(viewId === 'view-settings') window.loadSettings(); if(viewId === 'view-attendance') window.renderAttendance(); if(viewId === 'view-discipline') window.renderDisciplineStudents();
    if(viewId === 'view-announcements') window.renderNotifies(); if(viewId === 'view-plans') window.renderKanban(); if(viewId === 'view-docs') window.renderDocs();
    if(viewId === 'view-lesson-log') window.initLessonLogView();
}
window.openModal = function(id) { document.getElementById(id).style.display = 'flex'; }
window.closeModal = function(id) { document.getElementById(id).style.display = 'none'; }

// ================= TÍNH NĂNG ĐỔI GIAO DIỆN =================
window.changeTheme = function(themeName, element) {
    document.body.className = themeName === 'default' ? '' : themeName;
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    if(element) element.classList.add('active');
    appData.settings.theme = themeName;
    window.saveData();
    window.showToast("Đã đổi màu giao diện!", "success");
}

window.loadSettings = function() { 
    const s = appData.settings; 
    document.getElementById('set-teacher').value = s.teacherName || ''; 
    document.getElementById('set-class').value = s.className || ''; 
    document.getElementById('set-year').value = s.year || ''; 
    document.getElementById('set-auto-absent').checked = s.autoAbsentDisc || false; 
    document.getElementById('set-auto-late').checked = s.autoLateDisc || false; 
    document.getElementById('set-warn-absent').value = s.warnAbsent || 3; 
    document.getElementById('set-warn-behavior').value = s.warnBehavior || -5; 
    
    if(document.getElementById('set-api-key')) {
        document.getElementById('set-api-key').value = s.apiKey || '';
    }

    let currentTheme = s.theme || 'default';
    document.body.className = currentTheme === 'default' ? '' : currentTheme;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick').includes(currentTheme)) btn.classList.add('active');
    });
}

window.saveSettings = function() { 
    appData.settings.teacherName = document.getElementById('set-teacher').value; 
    appData.settings.className = document.getElementById('set-class').value; 
    appData.settings.year = document.getElementById('set-year').value; 
    
    if(document.getElementById('set-api-key')) {
        appData.settings.apiKey = document.getElementById('set-api-key').value.trim();
    }
    
    window.saveData(); 
    window.showToast("✅ Đã lưu cài đặt!"); 
}

window.saveConfig = function() { appData.settings.autoAbsentDisc = document.getElementById('set-auto-absent').checked; appData.settings.autoLateDisc = document.getElementById('set-auto-late').checked; appData.settings.warnAbsent = parseInt(document.getElementById('set-warn-absent').value) || 3; appData.settings.warnBehavior = parseInt(document.getElementById('set-warn-behavior').value) || -5; window.saveData(); window.showToast("Đã lưu cấu hình tự động!"); }
window.resetData = function() { if(confirm("XÓA TOÀN BỘ CSDL CỤC BỘ? LƯU Ý: Thao tác này chỉ xóa bộ nhớ tạm, dữ liệu mây vẫn còn.")) { localStorage.removeItem('gvcnData_v4'); localStorage.removeItem('gvcnData_v3'); location.reload(); } }


// ================= DASHBOARD =================
window.updateDashboardInfo = function() {
    const s = appData.settings;
    document.getElementById('dash-teacher').innerText = s.teacherName; document.getElementById('dash-class').innerText = s.className; document.getElementById('dash-year').innerText = s.year;
    
    const totalStu = appData.students.length; document.getElementById('dash-count').innerText = totalStu + " HS"; document.getElementById('stat-total').innerText = totalStu;
    const today = getTodayStr(); let presentCount = totalStu, absentCount = 0;
    if(appData.attendance[today]) { presentCount = 0; absentCount = 0; Object.values(appData.attendance[today]).forEach(st => { if(st === 'present') presentCount++; if(st === 'excused' || st === 'unexcused') absentCount++; }); }
    document.getElementById('dash-attendance-percent').innerText = (totalStu > 0 ? Math.round((presentCount / totalStu) * 100) : 100) + "%";
    document.getElementById('stat-present').innerText = presentCount; document.getElementById('stat-absent').innerText = absentCount;
    document.getElementById('stat-good').innerText = appData.behaviorRecords.filter(r => r.date === today && r.type === 'positive').length;

    document.getElementById('dash-notify-count').innerText = appData.notifications.length + " TB";
    document.getElementById('dash-task-count').innerText = appData.tasks.length + " việc";
    document.getElementById('dash-doc-count').innerText = appData.documents.length + " file";

    const llList = document.getElementById('dash-ll-list'); llList.innerHTML = '';
    let todaysLessons = appData.scheduleRecords.filter(r => r.date === today);
    document.getElementById('dash-ll-date').innerText = new Date().toLocaleDateString('vi-VN');
    if(todaysLessons.length === 0) {
        llList.innerHTML = `<div class="text-center w-full" style="font-size:0.85rem; opacity:0.8; color: white;">Hôm nay không có tiết dạy nào.</div>`;
    } else {
        todaysLessons.sort((a,b) => a.period - b.period).forEach(l => {
            let stIcon = l.status === 'off' ? 'fa-times text-red' : (l.status === 'completed' ? 'fa-check text-green' : 'fa-clock text-blue');
            llList.innerHTML += `<div class="ll-item"><div class="ll-period"><span>Tiết</span>${l.period}</div><div class="ll-content"><h4>${l.subject} - ${l.className}</h4><p>${l.content}</p></div><i class="fas ${stIcon}" style="background: white; padding: 5px; border-radius: 50%;"></i></div>`;
        });
    }
    
    let currentWeek = todaysLessons.length > 0 ? todaysLessons[0].week : 1;
    let weekLessons = appData.scheduleRecords.filter(r => r.week == currentWeek && r.status !== 'off').length;
    document.getElementById('dash-ll-week-count').innerText = weekLessons;

    const alertsHtml = document.getElementById('dash-alerts'); 
    if (alertsHtml) {
        alertsHtml.innerHTML = '';
        let stuMap = {}; appData.students.forEach(st => { stuMap[st.id] = { name: st.name, absent: 0, points: 0 }; });
        Object.values(appData.attendance).forEach(day => { Object.keys(day).forEach(sid => { if(day[sid] === 'unexcused' && stuMap[sid]) stuMap[sid].absent++; }); });
        appData.behaviorRecords.forEach(r => { if(stuMap[r.studentId]) stuMap[r.studentId].points += Number(r.snapshotPoints); });
        let hasAlert = false;
        Object.keys(stuMap).forEach(sid => {
            let stu = stuMap[sid];
            if(stu.absent >= s.warnAbsent) { hasAlert = true; alertsHtml.innerHTML += `<div class="alert-item yellow"><div class="alert-icon"><i class="fas fa-calendar-times"></i></div><div class="alert-info"><strong>${stu.name}</strong><p>Nghỉ không phép ${stu.absent} buổi</p></div></div>`; }
            if(stu.points <= s.warnBehavior) { hasAlert = true; alertsHtml.innerHTML += `<div class="alert-item red"><div class="alert-icon"><i class="fas fa-exclamation"></i></div><div class="alert-info"><strong>${stu.name}</strong><p>Điểm thi đua chạm mốc ${stu.points} điểm</p></div></div>`; }
        });
        if(!hasAlert) alertsHtml.innerHTML = '<div class="text-center text-muted" style="padding: 10px;">Lớp đang hoạt động rất tốt! 🎉</div>';
    }

    window.updateLeaderboard();
}

window.initLessonLogView = function() {
    const sel = document.getElementById('ll-week-select'); sel.innerHTML = '';
    let maxWeek = 1;
    appData.scheduleRecords.forEach(r => { if(r.week > maxWeek) maxWeek = r.week; });
    for(let i=1; i<=maxWeek; i++) { sel.innerHTML += `<option value="${i}">Sổ báo giảng - Tuần ${i}</option>`; }
    let today = getTodayStr(); let todayRecord = appData.scheduleRecords.find(r => r.date === today);
    if(todayRecord) sel.value = todayRecord.week;
    window.renderSchedule();
}

window.renderSchedule = function() {
    const w = parseInt(document.getElementById('ll-week-select').value) || 1;
    const list = document.getElementById('ll-schedule-list'); list.innerHTML = '';
    let records = appData.scheduleRecords.filter(r => r.week == w);
    
    let total = records.filter(r => r.status !== 'off').length;
    let completed = records.filter(r => r.status === 'completed').length;
    let offCount = records.filter(r => r.status === 'off').length;
    document.getElementById('ll-stats-container').innerHTML = `
        <span class="text-blue">Tổng: ${total} tiết</span>
        <span class="text-green">Đã xong: ${completed}</span>
        <span class="text-orange">Còn: ${total - completed}</span>
        ${offCount > 0 ? `<span class="text-red">Nghỉ: ${offCount}</span>` : ''}
    `;

    if(records.length === 0) { list.innerHTML = '<div class="empty-state">Chưa có dữ liệu tuần này. Vui lòng cấu hình và Tự động tạo sổ!</div>'; return; }

    let byDate = {};
    records.forEach(r => { if(!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });
    let daysOfWeek = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

    Object.keys(byDate).sort().forEach(dateStr => {
        let dObj = new Date(dateStr); let dayName = daysOfWeek[dObj.getDay()];
        let dateHeader = `<div style="background:var(--primary); color:white; padding:8px 15px; border-radius:10px; font-weight:700; font-size:0.9rem; margin-top:10px; box-shadow: var(--shadow-sm);">📅 ${dayName} - ${dObj.toLocaleDateString('vi-VN')}</div>`;
        list.innerHTML += dateHeader;

        byDate[dateStr].sort((a,b) => a.period - b.period).forEach(r => {
            let isOff = r.status === 'off'; let isCompleted = r.status === 'completed';
            let cardClass = isOff ? 'status-off' : (isCompleted ? 'status-completed' : 'status-scheduled');
            let statusBtn = isOff ? '' : (isCompleted ? `<button class="btn-outline-action text-green" onclick="toggleScheduleStatus(${r.id})"><i class="fas fa-check-circle"></i></button>` : `<button class="btn-outline-action text-muted" onclick="toggleScheduleStatus(${r.id})"><i class="far fa-circle"></i></button>`);
            let editBtn = isOff ? '' : `<button class="btn-outline-action text-orange" onclick="openAdjustSchedule(${r.id})"><i class="fas fa-exchange-alt"></i></button>`;

            list.innerHTML += `
                <div class="sched-card ${cardClass}">
                    <div class="sched-top"><span>Tiết ${r.period} | ${r.className}</span> <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 8px;">PPCT: ${r.ppct}</span></div>
                    <div class="sched-mid">
                        <div class="sched-info"><h4>${r.subject}</h4><p>${r.content}</p></div>
                    </div>
                    ${r.note ? `<div class="sched-note"><i class="fas fa-info-circle"></i> ${r.note}</div>` : ''}
                    <div class="sched-bot">
                        ${statusBtn}
                        <div style="display:flex; gap:8px;">${editBtn}</div>
                    </div>
                </div>`;
        });
    });
}

window.toggleScheduleStatus = function(id) {
    let r = appData.scheduleRecords.find(x => x.id == id);
    if(r) { r.status = (r.status === 'completed') ? 'scheduled' : 'completed'; window.saveData(); window.renderSchedule(); }
}
window.openAdjustSchedule = function(id) {
    let r = appData.scheduleRecords.find(x => x.id == id); if(!r) return;
    document.getElementById('adj-sched-id').value = r.id; document.getElementById('adj-sched-info').innerHTML = `Đang chỉnh sửa: <b>${r.subject} ${r.className} (Tiết ${r.period})</b> - PPCT: ${r.ppct}`; document.getElementById('adj-sched-date').value = r.date; document.getElementById('adj-sched-period').value = r.period; document.getElementById('adj-sched-note').value = r.note || '';
    window.openModal('modal-adjust-schedule');
}
window.saveAdjustedSchedule = function() {
    let id = document.getElementById('adj-sched-id').value; let r = appData.scheduleRecords.find(x => x.id == id);
    if(r) {
        let nDate = document.getElementById('adj-sched-date').value; let nPeriod = document.getElementById('adj-sched-period').value;
        if(!nDate || !nPeriod) return window.showToast("Nhập đủ ngày và tiết!", "error");
        let dObj = new Date(nDate); let dow = dObj.getDay() === 0 ? 8 : dObj.getDay() + 1; 
        if(nDate !== r.date) { r.note = `${document.getElementById('adj-sched-note').value || 'Dạy bù'} (Dời từ ${new Date(r.date).toLocaleDateString('vi-VN')})`; r.date = nDate; r.dayOfWeek = dow; }
        else { r.note = document.getElementById('adj-sched-note').value; }
        r.period = parseInt(nPeriod);
        window.saveData(); window.closeModal('modal-adjust-schedule'); window.renderSchedule(); window.showToast("Đã cập nhật lịch dạy!");
    }
}
window.exportScheduleExcel = function() {
    const w = parseInt(document.getElementById('ll-week-select').value);
    let records = appData.scheduleRecords.filter(r => r.week == w);
    if(records.length === 0) return window.showToast("Tuần này trống!", "error");
    let ws_data = [["Tuần", "Ngày", "Thứ", "Tiết", "Lớp", "Môn", "PPCT", "Nội dung", "Trạng thái", "Ghi chú"]];
    records.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(r => {
        let st = r.status==='off'?'Nghỉ':(r.status==='completed'?'Đã xong':'Chưa dạy');
        ws_data.push([r.week, new Date(r.date).toLocaleDateString('vi-VN'), r.dayOfWeek, r.period, r.className, r.subject, r.ppct, r.content, st, r.note||""]);
    });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "SoBaoGiang");
    XLSX.writeFile(wb, `So_Bao_Giang_Tuan_${w}.xlsx`); window.showToast("Đã xuất Excel!");
}

window.renderSetupData = function() {
    let stp = appData.scheduleSetup;
    document.getElementById('setup-week1-date').value = stp.week1Start;
    document.getElementById('setup-tkb-count').innerText = stp.tkb.length + " bản ghi";
    document.getElementById('setup-ppct-count').innerText = stp.ppct.length + " bài dạy";
    document.getElementById('setup-holidays-count').innerText = stp.holidays.length + " sự kiện";

    const tbodyTKB = document.getElementById('tkb-tbody'); tbodyTKB.innerHTML = '';
    stp.tkb.forEach((t, i) => { tbodyTKB.innerHTML += `<tr><td>${t.dayOfWeek}</td><td>${t.period}</td><td>${t.className}</td><td>${t.subject}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('tkb', ${i})"><i class="fas fa-times"></i></button></td></tr>`; });
    
    const tbodyPPCT = document.getElementById('ppct-tbody'); tbodyPPCT.innerHTML = '';
    stp.ppct.forEach((p, i) => { tbodyPPCT.innerHTML += `<tr><td>${p.className}</td><td>${p.subject}</td><td>${p.ppct}</td><td>${p.content.substring(0,20)}...</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('ppct', ${i})"><i class="fas fa-times"></i></button></td></tr>`; });

    const tbodyHol = document.getElementById('hol-tbody'); tbodyHol.innerHTML = '';
    stp.holidays.forEach((h, i) => { tbodyHol.innerHTML += `<tr><td>${h.start}</td><td>${h.end}</td><td>${h.name}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('holidays', ${i})"><i class="fas fa-times"></i></button></td></tr>`; });
}

window.delSetupData = function(type, index) { appData.scheduleSetup[type].splice(index, 1); window.saveData(); window.renderSetupData(); }
window.addTKB = function() {
    let d = document.getElementById('add-tkb-day').value, p = document.getElementById('add-tkb-period').value, c = document.getElementById('add-tkb-class').value, s = document.getElementById('add-tkb-subject').value;
    if(!d || !p || !c || !s) return window.showToast("Nhập đủ thông tin!", "error");
    appData.scheduleSetup.tkb.push({ dayOfWeek: parseInt(d), period: parseInt(p), className: c.trim(), subject: s.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm TKB!");
}
window.addPPCT = function() {
    let c = document.getElementById('add-ppct-class').value, s = document.getElementById('add-ppct-subject').value, p = document.getElementById('add-ppct-period').value, n = document.getElementById('add-ppct-content').value;
    if(!c || !s || !p || !n) return window.showToast("Nhập đủ thông tin!", "error");
    appData.scheduleSetup.ppct.push({ className: c.trim(), subject: s.trim(), ppct: parseInt(p), content: n.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm PPCT!");
}
window.addHoliday = function() {
    let s = document.getElementById('add-hol-start').value, e = document.getElementById('add-hol-end').value, n = document.getElementById('add-hol-name').value;
    if(!s || !e || !n) return window.showToast("Nhập đủ thông tin!", "error");
    appData.scheduleSetup.holidays.push({ start: s, end: e, name: n.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm ngày nghỉ!");
}

let currentImportType = '';
window.triggerImport = function(type) { currentImportType = type; document.getElementById('general-import-file').click(); }
window.handleGeneralImport = function(event) {
    const file = event.target.files[0]; if (!file) return; const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'docx') {
        if (typeof mammoth === 'undefined') { window.showToast("Thư viện Word chưa được tải!", "error"); return; }
        const reader = new FileReader();
        reader.onload = (ev) => {
            mammoth.convertToHtml({arrayBuffer: ev.target.result}).then(function(result) {
                let html = result.value; let parser = new DOMParser(); let doc = parser.parseFromString(html, 'text/html'); let tables = doc.querySelectorAll('table'); let count = 0;
                let targetClass = document.getElementById('add-ppct-class').value || "Chung"; let targetSubject = document.getElementById('add-ppct-subject').value || "Chung";
                
                tables.forEach(table => {
                    let rows = table.querySelectorAll('tr'); let tietIdx = -1, ndIdx = -1;
                    rows.forEach((tr) => {
                        let cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.innerText.trim());
                        if (tietIdx === -1) {
                            cells.forEach((txt, i) => { let low = txt.toLowerCase(); if(low === 'tiết' || low === 'tiết ppct' || low === 'tiết học') tietIdx = i; else if(low.includes('nội dung') || low.includes('tên bài') || low.includes('bài dạy')) ndIdx = i; });
                            if(tietIdx === -1 && cells.length >= 2) { if(cells[0].toLowerCase().includes('tiết')) { tietIdx = 0; ndIdx = 1; } else if(cells[1].toLowerCase().includes('tiết')) { tietIdx = 1; ndIdx = 2; } }
                        } else {
                            if (cells.length > Math.max(tietIdx, ndIdx) && ndIdx !== -1) {
                                let tiet = parseInt(cells[tietIdx]); let nd = cells[ndIdx];
                                if(!isNaN(tiet) && nd) { appData.scheduleSetup.ppct.push({ className: targetClass, subject: targetSubject, ppct: tiet, content: nd }); count++; }
                            }
                        }
                    });
                });
                window.saveData(); window.renderSetupData(); window.showToast(`Đã import thành công ${count} tiết PPCT từ Word!`);
            }).catch(e => { window.showToast("Lỗi đọc file Word!", "error"); });
        };
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result); const workbook = XLSX.read(data, { type: 'array' }); let rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); let count = 0;
                let targetClass = document.getElementById('add-ppct-class').value || "Chung"; let targetSubject = document.getElementById('add-ppct-subject').value || "Chung";

                rows.forEach(r => {
                    if(currentImportType === 'tkb' && (r['Thứ'] || r['Thu']) && (r['Tiết'] || r['Tiet']) && r['Lớp']) {
                        appData.scheduleSetup.tkb.push({ dayOfWeek: parseInt(r['Thứ']||r['Thu']), period: parseInt(r['Tiết']||r['Tiet']), className: String(r['Lớp']||r['Lop']), subject: String(r['Môn']||r['Mon']) }); count++;
                    }
                    else if(currentImportType === 'ppct' && (r['Tiết'] || r['Tiet'])) {
                        let p = parseInt(r['Tiết'] || r['Tiet']); let n = String(r['Nội dung'] || r['Noi dung'] || r['Tên bài'] || r['Ten bai'] || r['Chủ đề'] || '');
                        if(!isNaN(p) && n) { appData.scheduleSetup.ppct.push({ className: String(r['Lớp']||r['Lop']||targetClass), subject: String(r['Môn']||r['Mon']||targetSubject), ppct: p, content: n }); count++; }
                    }
                    else if(currentImportType === 'holidays' && r['Từ ngày'] && r['Đến ngày'] && r['Sự kiện']) {
                        let sd = new Date(r['Từ ngày']); let ed = new Date(r['Đến ngày']);
                        if(!isNaN(sd)) { appData.scheduleSetup.holidays.push({ start: sd.toISOString().split('T')[0], end: ed.toISOString().split('T')[0], name: r['Sự kiện'] }); count++; }
                    }
                });
                window.saveData(); window.renderSetupData(); window.showToast(`Đã import thành công ${count} dòng!`); 
            } catch (error) { window.showToast("Lỗi định dạng file Excel!", "error"); }
        };
        reader.readAsArrayBuffer(file);
    }
    event.target.value = "";
}

window.checkIsHoliday = function(dateStr) {
    let d = new Date(dateStr);
    for(let h of appData.scheduleSetup.holidays) { if(d >= new Date(h.start) && d <= new Date(h.end)) return h; } return null;
}

window.generateAutoSchedule = function() {
    let startDate = document.getElementById('setup-week1-date').value;
    if(!startDate) return window.showToast("Vui lòng thiết lập Ngày bắt đầu Tuần 1!", "error");
    if(appData.scheduleRecords.length > 0) { if(!confirm("CẢNH BÁO: Thao tác này sẽ TẠO LẠI TOÀN BỘ SỔ BÁO GIẢNG và ghi đè các tiết chưa hoàn thành. Các tiết Đã Dạy sẽ được bảo lưu. Bạn chắc chắn chứ?")) return; }

    appData.scheduleSetup.week1Start = startDate; let records = []; let ppctQueues = {}; 
    appData.scheduleSetup.ppct.sort((a,b) => a.ppct - b.ppct).forEach(p => { let key = `${p.subject.toLowerCase()}-${p.className.toLowerCase()}`; if(!ppctQueues[key]) ppctQueues[key] = []; ppctQueues[key].push({...p}); });

    let currentDate = new Date(startDate);
    for(let w = 1; w <= 35; w++) {
        for(let d = 2; d <= 7; d++) {
            let dateStr = currentDate.toISOString().split('T')[0]; let holiday = window.checkIsHoliday(dateStr);
            let dayTKB = appData.scheduleSetup.tkb.filter(t => t.dayOfWeek == d); dayTKB.sort((a,b) => a.period - b.period);

            dayTKB.forEach(tItem => {
                let qKey = `${tItem.subject.toLowerCase()}-${tItem.className.toLowerCase()}`;
                let oldR = appData.scheduleRecords.find(x => x.date === dateStr && x.period === tItem.period && x.className === tItem.className);
                if(oldR && (oldR.status === 'completed' || oldR.note)) {
                    records.push(oldR);
                    if(oldR.status === 'completed' && ppctQueues[qKey] && ppctQueues[qKey].length>0 && ppctQueues[qKey][0].ppct == oldR.ppct) { ppctQueues[qKey].shift(); } return; 
                }
                if (holiday) { records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: "-", content: "NGHỈ LỄ - " + holiday.name, status: "off" }); } 
                else {
                    if (ppctQueues[qKey] && ppctQueues[qKey].length > 0) { let lesson = ppctQueues[qKey].shift(); records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: lesson.ppct, content: lesson.content, status: "scheduled" }); } 
                    else { records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: "-", content: "Ôn tập / Tự chọn (Hết PPCT)", status: "scheduled" }); }
                }
            });
            currentDate.setDate(currentDate.getDate() + 1); 
        }
        currentDate.setDate(currentDate.getDate() + 1); 
    }
    appData.scheduleRecords = records; window.saveData(); window.closeModal('modal-setup-lesson-log'); window.initLessonLogView(); window.showToast("🎉 Đã tự động sinh Sổ Báo Giảng cho cả năm học!");
}

window.generateReportCard = async function(stuId) {
    window.showToast("Đang tạo ảnh Phiếu liên lạc...", "success");
    const stu = appData.students.find(s => s.id == stuId); if (!stu) return;

    let currentMonth = new Date().getMonth() + 1; let points = 0; let absent = 0;
    appData.behaviorRecords.forEach(r => { let rMonth = new Date(r.date).getMonth() + 1; if (rMonth === currentMonth && r.studentId == stu.id) points += Number(r.snapshotPoints); });
    Object.values(appData.attendance).forEach(dayRecord => { if (dayRecord[stu.id] === 'unexcused') absent++; });

    let classification = "Đạt"; let badgeBg = "#ffc107"; let feedback = "Con hoàn thành nhiệm vụ học tập. Cần cố gắng phát huy thêm trong tháng tới.";
    if (points >= 15) { classification = "Xuất sắc"; badgeBg = "#198754"; feedback = "Con đi học chuyên cần, ngoan ngoãn và hăng hái phát biểu xây dựng bài. Thành tích rất đáng tự hào!"; } 
    else if (points >= 5) { classification = "Khá"; badgeBg = "#0d6efd"; feedback = "Con có ý thức học tập tốt, ngoan ngoãn. Gia đình tiếp tục động viên con nhé!"; } 
    else if (points < 0) { classification = "Cần cố gắng"; badgeBg = "#dc3545"; feedback = "Tháng này con còn vi phạm một số nội quy và chưa tập trung. Gia đình cần phối hợp nhắc nhở con sát sao hơn."; }
    if (absent >= 3) { feedback += " (Lưu ý: Số buổi vắng không phép của con đang hơi nhiều)."; }

    document.getElementById('rc-month-class').innerText = `Tháng ${currentMonth} - Lớp ${appData.settings.className}`;
    document.getElementById('rc-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(stu.name)}&background=e0ecff&color=0d6efd&bold=true`;
    document.getElementById('rc-name').innerText = stu.name; document.getElementById('rc-classification').innerText = `Xếp loại: ${classification}`; document.getElementById('rc-classification').style.background = badgeBg;
    document.getElementById('rc-points').innerText = points > 0 ? `+${points}` : points; document.getElementById('rc-absent').innerText = `${absent} buổi`; document.getElementById('rc-feedback').innerText = `"${feedback}"`; document.getElementById('rc-teacher').innerText = appData.settings.teacherName;

    const cardEl = document.getElementById('report-card-template'); cardEl.style.left = '0px'; cardEl.style.zIndex = '-1';
    try {
        const canvas = await html2canvas(cardEl, { scale: 2, backgroundColor: null });
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const link = document.createElement('a'); link.download = `Phieu_Lien_Lac_${stu.name.replace(/ /g, '_')}_T${currentMonth}.jpg`; link.href = imgData; link.click();
        window.showToast("✅ Đã tải ảnh Phiếu liên lạc thành công!");
    } catch(e) { console.error(e); window.showToast("Lỗi khi tạo ảnh!", "error"); } finally { cardEl.style.left = '-9999px'; }
}

// Gọi giao diện Soạn bằng AI cho Học sinh
window.openAIForStudent = function(studentName) {
    document.getElementById('ai-prompt').value = `Viết một đoạn nhận xét ngắn gọn, tích cực để gửi cho phụ huynh về tình hình học tập và nề nếp của em ${studentName}.`;
    window.openModal('modal-compose-notify');
}

window.renderStudents = function() {
    const list = document.getElementById('student-list'); list.innerHTML = ''; 
    const searchInput = document.getElementById('search-student');
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";
    let filtered = appData.students.filter(s => s.name.toLowerCase().includes(filterText));
    if(filtered.length === 0) { list.innerHTML = '<div class="empty-state"><h4>Không tìm thấy!</h4></div>'; return; }
    filtered.forEach((stu, index) => { 
        let cleanPhone = stu.phone ? String(stu.phone).replace(/[^0-9]/g, '') : '';
        let zaloBtn = cleanPhone ? `<button class="btn-outline-action" style="color:white; background:#0068ff; border-color:#0068ff; box-shadow: 0 4px 10px rgba(0,104,255,0.3);" onclick="window.open('https://zalo.me/${cleanPhone}', '_blank')" title="Nhắn Zalo cho Phụ huynh"><i class="fas fa-comment-dots"></i></button>` : '';
        
        // NÚT TRỢ LÝ AI ĐƯỢC GẮN CLASS MỚI ĐỂ NHẤP NHÁY
        let aiBtn = `<button class="btn-ai-magic" onclick="openAIForStudent('${stu.name}')" title="Nhờ AI nhận xét"><i class="fas fa-magic"></i></button>`;
        
        list.innerHTML += `<div class="list-item"><div class="list-item-info"><strong>${index + 1}. ${stu.name}</strong><small><i class="fas fa-venus-mars"></i> ${stu.gender} • <i class="fas fa-phone"></i> ${stu.phone || 'Trống'}</small></div><div class="list-item-actions">${aiBtn}${zaloBtn}<button class="btn-outline-action" style="color:white; background:var(--primary);" onclick="generateReportCard(${stu.id})" title="Tạo phiếu liên lạc ảnh"><i class="fas fa-camera-retro"></i></button><button class="btn-outline-action" style="color:var(--text-main);" onclick="editStudent(${stu.id})"><i class="fas fa-pen"></i></button><button class="btn-outline-action" style="color:var(--danger);" onclick="deleteStudent(${stu.id})"><i class="fas fa-trash"></i></button></div></div>`; 
    });
}

window.saveStudent = function() {
    const id = document.getElementById('stu-id').value; const name = document.getElementById('stu-name').value;
    if(!name) return window.showToast("Nhập tên!", "error");
    const obj = { id: id ? parseInt(id) : Date.now(), name: name, gender: document.getElementById('stu-gender').value, dob: document.getElementById('stu-dob').value, phone: document.getElementById('stu-phone').value };
    if(id) { appData.students[appData.students.findIndex(s => s.id == id)] = obj; window.showToast("Đã cập nhật!"); } else { appData.students.push(obj); window.showToast("Đã thêm!"); }
    window.saveData(); window.renderStudents(); window.closeModal('modal-add-student');
}
window.editStudent = function(id) { const stu = appData.students.find(s => s.id === id); if(stu) { document.getElementById('stu-id').value = stu.id; document.getElementById('stu-name').value = stu.name; document.getElementById('stu-gender').value = stu.gender || 'Nam'; let fDob = stu.dob || ''; if(fDob.includes('/')) { const p = fDob.split('/'); if(p.length===3) fDob = `${p[2]}-${p[1]}-${p[0]}`; } document.getElementById('stu-dob').value = fDob; document.getElementById('stu-phone').value = stu.phone || ''; window.openModal('modal-add-student'); } }
window.deleteStudent = function(id) { if(confirm("Xác nhận xóa?")) { appData.students = appData.students.filter(s => s.id !== id); window.saveData(); window.renderStudents(); window.showToast("Đã xóa"); } }

let rawExcelData = [], parsedStudents = [], excelHeaders = []; let currentHeaderRowIndex = 0; 
window.openImportModal = function() { document.getElementById('import-step-1').style.display = 'block'; document.getElementById('import-step-2').style.display = 'none'; document.getElementById('import-step-2-footer').style.display = 'none'; document.getElementById('excel-file').value = ""; rawExcelData = []; parsedStudents = []; currentHeaderRowIndex = 0; window.openModal('modal-import-excel'); }

window.handleExcelUpload = function(event) {
    const file = event.target.files[0]; if (!file) return; const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result); const workbook = XLSX.read(data, { type: 'array' }); 
            rawExcelData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, raw: false, defval: "" });
            if (rawExcelData.length < 2) return window.showToast("File trống!", "error");
            currentHeaderRowIndex = 0;
            for(let i = 0; i < Math.min(15, rawExcelData.length); i++) {
                let rowStr = rawExcelData[i].join('').toLowerCase();
                if(rowStr.includes('họ và tên') || rowStr.includes('họ tên') || rowStr.includes('stt')) { currentHeaderRowIndex = i; break; }
            }
            excelHeaders = rawExcelData[currentHeaderRowIndex].map(h => (h || '').toString().trim());
            const selects = ['map-name', 'map-gender', 'map-dob', 'map-phone'];
            selects.forEach(id => { const sel = document.getElementById(id); sel.innerHTML = '<option value="-1">-- Bỏ qua --</option>'; excelHeaders.forEach((h, i) => { if(h) sel.innerHTML += `<option value="${i}">${h}</option>`; }); });
            excelHeaders.forEach((h, i) => { 
                if(!h) return; let low = h.toLowerCase(); 
                if(low.includes('tên')||low.includes('name')) document.getElementById('map-name').value = i; 
                else if(low.includes('giới')||low==='gt') document.getElementById('map-gender').value = i; 
                else if(low.includes('sinh')||low.includes('date')) document.getElementById('map-dob').value = i; 
                else if(low.includes('sđt')||low.includes('thoại')||low.includes('sll')) document.getElementById('map-phone').value = i; 
            });
            document.getElementById('import-step-1').style.display = 'none'; document.getElementById('import-step-2').style.display = 'block'; document.getElementById('import-step-2-footer').style.display = 'flex'; window.processParsedData();
        } catch (error) { window.showToast("Lỗi đọc file!", "error"); console.error(error); }
    }; reader.readAsArrayBuffer(file);
}

window.processParsedData = function() {
    const mapName = parseInt(document.getElementById('map-name').value), mapGender = parseInt(document.getElementById('map-gender').value), mapDob = parseInt(document.getElementById('map-dob').value), mapPhone = parseInt(document.getElementById('map-phone').value);
    parsedStudents = []; let dupCount = 0;
    for (let i = currentHeaderRowIndex + 1; i < rawExcelData.length; i++) {
        const row = rawExcelData[i]; if (!row || !row.length) continue;
        let name = mapName !== -1 ? (row[mapName] || '').toString().trim() : ''; 
        if (!name || name === '' || name.toLowerCase().includes('tổng')) continue;
        let phoneVal = mapPhone !== -1 ? (row[mapPhone] || '').toString().trim() : '';
        if(phoneVal.endsWith('.0')) phoneVal = phoneVal.replace('.0', ''); 
        let stu = { name: name, gender: mapGender !== -1 ? (row[mapGender] || 'Nam').toString().trim() : 'Nam', dob: mapDob !== -1 ? (row[mapDob] || '').toString().trim() : '', phone: phoneVal };
        stu.isDup = appData.students.some(s => s.name.toLowerCase() === stu.name.toLowerCase()); if(stu.isDup) dupCount++; parsedStudents.push(stu);
    }
    const tbody = document.getElementById('preview-tbody'); tbody.innerHTML = '';
    parsedStudents.slice(0, 20).forEach((stu, i) => { tbody.innerHTML += `<tr ${stu.isDup?'style="background:#fef3c7"':''}><td>${i+1}</td><td>${stu.name}</td><td>${stu.phone}</td></tr>`; });
    if(parsedStudents.length>20) tbody.innerHTML += `<tr><td colspan="3" class="text-center text-muted">... và ${parsedStudents.length-20} HS khác</td></tr>`;
    document.getElementById('btn-confirm-import').disabled = parsedStudents.length === 0; document.getElementById('import-warnings').innerHTML = dupCount > 0 ? `<div style="color:var(--warning); font-size:0.85rem; margin-bottom:10px;">⚠️ Có ${dupCount} HS trùng tên sẽ được cộng dồn.</div>` : '';
}

window.confirmImport = function() { let c = 0; parsedStudents.forEach(stu => { appData.students.push({ id: Date.now() + c, name: stu.name, gender: stu.gender, dob: stu.dob, phone: stu.phone, note: "" }); c++; }); window.saveData(); window.renderStudents(); window.closeModal('modal-import-excel'); window.showToast(`Đã nhập ${c} HS!`); }
window.exportExcel = function() { if(appData.students.length === 0) return window.showToast("Lớp trống!", "error"); let ws_data = [["STT", "Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại"]]; appData.students.forEach((stu, i) => { ws_data.push([i+1, stu.name, stu.dob||"", stu.gender||"", stu.phone||""]); }); XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet(ws_data), "DS"), `DS_Lop.xlsx`); window.showToast("Đã xuất Excel!"); }
window.downloadTemplate = function() { XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet([["Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại"]]), "Mau"), `File_Mau.xlsx`); window.showToast("Đã tải!"); }

window.renderAttendance = function() {
    const date = document.getElementById('attendance-date').value; const list = document.getElementById('attendance-list'); list.innerHTML = '';
    if(!appData.attendance[date]) { appData.attendance[date] = {}; appData.students.forEach(s => appData.attendance[date][s.id] = 'present'); }
    let stats = { present: 0, excused: 0, unexcused: 0 }; const records = appData.attendance[date];
    appData.students.forEach((stu, index) => {
        const status = records[stu.id] || 'present'; stats[status]++;
        list.innerHTML += `<div class="list-item"><div class="list-item-info"><strong>${index + 1}. ${stu.name}</strong></div><div class="attendance-opts"><button class="att-btn ${status === 'present' ? 'active' : ''}" data-status="present" onclick="setAtt(this, ${stu.id}, 'present')"><i class="fas fa-check"></i></button><button class="att-btn ${status === 'excused' ? 'active' : ''}" data-status="excused" onclick="setAtt(this, ${stu.id}, 'excused')"><i class="fas fa-exclamation"></i></button><button class="att-btn ${status === 'unexcused' ? 'active' : ''}" data-status="unexcused" onclick="setAtt(this, ${stu.id}, 'unexcused')"><i class="fas fa-times"></i></button></div></div>`;
    });
    document.getElementById('attendance-summary').innerHTML = `<span style="color:var(--success)"><i class="fas fa-check-circle"></i> Có mặt: ${stats.present}</span><span style="color:var(--warning)"><i class="fas fa-exclamation-circle"></i> Phép: ${stats.excused}</span><span style="color:var(--danger)"><i class="fas fa-times-circle"></i> K.Phép: ${stats.unexcused}</span>`;
}
window.setAtt = function(btn, stuId, status) {
    const parent = btn.parentElement; parent.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active');
    const date = document.getElementById('attendance-date').value; appData.attendance[date][stuId] = status;
    if(status === 'unexcused' && appData.settings.autoAbsentDisc) { let tag = appData.behaviorTags.find(t => t.name.toLowerCase().includes('nội quy') || t.name.toLowerCase().includes('vắng')); if(tag) window.autoCreateBehavior(stuId, tag, date, "Hệ thống tự ghi nhận vắng không phép"); }
    window.renderAttendance(); 
}
window.saveAttendance = function() { window.saveData(); window.showToast("✅ Đã lưu Điểm danh!"); window.switchView('view-home'); }

let currentDiscStuId = null, currentBehaviorTab = 'negative';
window.renderDisciplineStudents = function() {
    const txt = document.getElementById('search-disc-student').value.toLowerCase(); const list = document.getElementById('discipline-student-list'); list.innerHTML = '';
    let ptsMap = {}; appData.behaviorRecords.forEach(r => { ptsMap[r.studentId] = (ptsMap[r.studentId] || 0) + Number(r.snapshotPoints); });
    appData.students.filter(s => s.name.toLowerCase().includes(txt)).forEach(stu => {
        let pts = ptsMap[stu.id] || 0; let color = pts > 0 ? 'var(--success)' : (pts < 0 ? 'var(--danger)' : 'var(--text-muted)');
        list.innerHTML += `<div class="list-item" style="cursor:pointer;" onclick="openRecordBehavior(${stu.id}, '${stu.name}')"><div class="list-item-info"><strong>${stu.name}</strong></div><div><span style="color:${color}; font-weight:800; font-size:1.1rem;">${pts > 0 ? '+'+pts : pts} đ</span> <i class="fas fa-chevron-right text-muted ml-2"></i></div></div>`;
    });
}
window.openRecordBehavior = function(stuId, stuName) { currentDiscStuId = stuId; document.getElementById('behavior-target-name').innerText = `Đang chọn: ${stuName}`; window.renderQuickTags(); window.openModal('modal-record-behavior'); }
window.switchBehaviorTab = function(type, element) { currentBehaviorTab = type; document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); element.classList.add('active'); window.renderQuickTags(); }
window.renderQuickTags = function() {
    const grid = document.getElementById('quick-tag-list'); grid.innerHTML = '';
    appData.behaviorTags.filter(t => t.type === currentBehaviorTab && t.enabled).forEach(t => { grid.innerHTML += `<div class="quick-tag-btn ${t.color}" onclick="confirmTagRecord('${t.id}')"><div class="tag-icon"><i class="fas ${t.icon}"></i></div><div class="tag-name">${t.name}</div><div class="tag-pts">${t.currentPoints > 0 ? '+' : ''}${t.currentPoints}</div></div>`; });
}
window.confirmTagRecord = function(tagId) { const tag = appData.behaviorTags.find(t => t.id === tagId); if(!tag) return; document.getElementById('conf-tag-id').value = tag.id; document.getElementById('conf-stu-id').value = currentDiscStuId; document.getElementById('conf-tag-display').innerHTML = `<strong>Hành vi:</strong> ${tag.name} (Gốc: ${tag.currentPoints})`; document.getElementById('conf-points').value = tag.currentPoints; document.getElementById('conf-note').value = ''; window.openModal('modal-confirm-tag'); }
window.submitBehaviorRecord = function() {
    const tag = appData.behaviorTags.find(t => t.id === document.getElementById('conf-tag-id').value);
    appData.behaviorRecords.push({ id: Date.now(), studentId: parseInt(document.getElementById('conf-stu-id').value), tagId: tag.id, snapshotName: tag.name, snapshotPoints: parseInt(document.getElementById('conf-points').value), type: tag.type, date: getTodayStr(), time: formatDateTime(), note: document.getElementById('conf-note').value });
    window.saveData(); window.closeModal('modal-confirm-tag'); window.closeModal('modal-record-behavior'); window.showToast(`✅ Đã ghi nhận: ${tag.name}`); window.renderDisciplineStudents(); 
}
window.autoCreateBehavior = function(stuId, tag, date, note) { if(!appData.behaviorRecords.find(r => r.studentId === stuId && r.date === date && r.tagId === tag.id && r.note.includes("Hệ thống"))) { appData.behaviorRecords.push({ id: Date.now() + Math.random(), studentId: stuId, tagId: tag.id, snapshotName: tag.name, snapshotPoints: tag.currentPoints, type: tag.type, date: date, time: formatDateTime(), note: note }); window.saveData(); } }
window.renderManageTags = function() {
    const list = document.getElementById('manage-tag-list'); list.innerHTML = '';
    appData.behaviorTags.forEach(t => {
        let toggleClr = t.enabled ? 'var(--success)' : '#cbd5e1'; let actionBtn = !t.isSystem ? `<button class="btn-outline-action ml-2" style="color:var(--danger)" onclick="deleteTag('${t.id}')"><i class="fas fa-trash"></i></button>` : '';
        list.innerHTML += `<div class="list-item"><div class="list-item-info"><strong>${t.name}</strong><small>Điểm: <b>${t.currentPoints}</b> | ${t.type==='negative'?'Trừ':'Cộng'}</small></div><div class="list-item-actions"><button class="btn-outline-action" style="color:${toggleClr}" onclick="toggleTag('${t.id}')"><i class="fas ${t.enabled ? 'fa-eye' : 'fa-eye-slash'}"></i></button>${actionBtn}</div></div>`;
    });
}
window.toggleTag = function(id) { const t = appData.behaviorTags.find(x => x.id === id); if(t) { t.enabled = !t.enabled; window.saveData(); window.renderManageTags(); } }
window.deleteTag = function(id) { if(confirm("Xóa hành vi này?")) { appData.behaviorTags = appData.behaviorTags.filter(x => x.id !== id); window.saveData(); window.renderManageTags(); } }
window.saveTag = function() { const name = document.getElementById('tag-name').value; const type = document.getElementById('tag-type').value; const pts = parseInt(document.getElementById('tag-points').value) || (type==='negative'? -1:1); if(!name) return window.showToast("Nhập tên!", "error"); appData.behaviorTags.push({ id: "cus_" + Date.now(), name: name, type: type, defaultPoints: pts, currentPoints: pts, isSystem: false, enabled: true, icon: type==='negative' ? 'fa-exclamation' : 'fa-star', color: type==='negative' ? 'qt-negative' : 'qt-positive' }); window.saveData(); window.renderManageTags(); window.closeModal('modal-add-tag'); window.showToast("Đã thêm!"); }

window.applyNotifyTemplate = function() { const val = document.getElementById('notify-template').value; const t = document.getElementById('notify-title'); const c = document.getElementById('notify-content'); if(val === 'T1') { t.value = "Thông báo khoản thu"; c.value = "Kính gửi quý PH,\nGVCN thông báo các khoản phí tháng này gồm: ..."; } else if(val === 'T2') { t.value = "Mời họp phụ huynh"; c.value = "Kính mời quý PH dự họp đầu năm lúc 8h00 Chủ nhật tại lớp."; } else if(val === 'T3') { t.value = "Nhắc nhở nề nếp"; c.value = "Xin quý PH nhắc các con mặc đúng đồng phục khi đến trường.\nXin cảm ơn!"; } else { t.value = ""; c.value = ""; } }

// HÀM GỌI API GOOGLE GEMINI TÍCH HỢP QUÉT LỖI
window.generateAINotify = async function() { 
    const prompt = document.getElementById('ai-prompt').value;
    if(!prompt) return window.showToast("Nhập nội dung cần nhờ AI", "error"); 
    
    const apiKey = appData.settings.apiKey;
    if(!apiKey) {
        document.getElementById('notify-content').value = "⚠️ Chưa có API Key. Vui lòng vào tab Cài đặt để nhập mã API Key Google Gemini.";
        return window.showToast("Thiếu API Key!", "error");
    }

    window.showToast("🤖 AI đang soạn thảo...", "success");
    document.getElementById('notify-content').value = "Đang tạo nội dung, thầy cô chờ một chút nhé...";

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Đóng vai một giáo viên chủ nhiệm, hãy soạn một thông báo gửi vào nhóm Zalo cho phụ huynh học sinh với nội dung cốt lõi sau: ${prompt}. Yêu cầu: Giọng văn lịch sự, chuyên nghiệp, súc tích, có biểu tượng cảm xúc (emoji) cho sinh động.` }] }]
            })
        });
        
        const data = await response.json();
        
        if(!response.ok) {
            console.error("🔍 BẮT ĐƯỢC LỖI TỪ GOOGLE:", data);
            throw new Error(data.error?.message || "Lỗi kết nối API");
        }

        if(data.candidates && data.candidates.length > 0) {
            document.getElementById('notify-content').value = data.candidates[0].content.parts[0].text.trim();
            window.showToast("✅ AI đã soạn xong!");
        } else {
            throw new Error("AI không trả về nội dung");
        }
    } catch(err) {
        console.error("Chi tiết lỗi:", err);
        document.getElementById('notify-content').value = `Lỗi AI: ${err.message}\nVui lòng kiểm tra lại API Key xem có chính xác và còn hoạt động không nhé!`;
        window.showToast("Lỗi kết nối AI!", "error");
    }
}

window.copyNotifyToZalo = function() { const t = document.getElementById('notify-title').value; const c = document.getElementById('notify-content').value; if(!t || !c) return window.showToast("Nhập đủ nội dung!", "error"); navigator.clipboard.writeText(`📢 [${appData.settings.className}] - ${t}\n\n${c}`).then(() => { window.showToast("✅ Đã copy! Đang tự động mở Zalo..."); setTimeout(() => { window.open('https://chat.zalo.me', '_blank'); }, 1000); }); }
window.saveNotify = function() { const t = document.getElementById('notify-title').value; const c = document.getElementById('notify-content').value; if(!t || !c) return window.showToast("Nhập đủ thông tin!", "error"); appData.notifications.push({ id: Date.now(), title: t, content: c, createdAt: formatDateTime() }); window.saveData(); window.closeModal('modal-compose-notify'); window.renderNotifies(); window.showToast("Đã lưu TB!"); }
window.renderNotifies = function() { const list = document.getElementById('notify-list'); list.innerHTML = ''; let arr = [...appData.notifications].reverse(); if(arr.length===0) list.innerHTML = '<div class="empty-state">Chưa có thông báo</div>'; arr.forEach(n => { list.innerHTML += `<div class="list-item" style="flex-direction:column; align-items:flex-start; gap:10px;"><div class="w-full" style="display:flex; justify-content:space-between;"><strong>📢 ${n.title}</strong><small class="text-muted">${n.createdAt}</small></div><div style="font-size:0.85rem; color:var(--text-muted); white-space:pre-wrap;">${n.content}</div></div>`; }); }

window.saveTask = function() { const id = document.getElementById('task-id').value; const title = document.getElementById('task-title').value; const status = document.getElementById('task-status').value; const prio = document.getElementById('task-priority').value; if(!title) return window.showToast("Nhập tiêu đề!", "error"); if(id) { let t = appData.tasks.find(x => x.id == id); t.title = title; t.status = status; t.priority = prio; } else { appData.tasks.push({ id: Date.now(), title: title, status: status, priority: prio }); } window.saveData(); window.closeModal('modal-add-task'); window.renderKanban(); }
window.moveTask = function(id, newStatus) { let t = appData.tasks.find(x => x.id == id); if(t) { t.status = newStatus; window.saveData(); window.renderKanban(); } }
window.renderKanban = function() { const todo = document.getElementById('kb-todo'), doing = document.getElementById('kb-doing'), done = document.getElementById('kb-done'); todo.innerHTML = ''; doing.innerHTML = ''; done.innerHTML = ''; appData.tasks.forEach(t => { let prioIcon = t.priority==='high' ? '🔴' : (t.priority==='medium'?'🟡':'🟢'); let nextBtn = t.status === 'todo' ? `<button class="btn-outline-action text-blue" onclick="moveTask(${t.id}, 'doing')"><i class="fas fa-arrow-right"></i></button>` : (t.status === 'doing' ? `<button class="btn-outline-action text-green" onclick="moveTask(${t.id}, 'done')"><i class="fas fa-check"></i></button>` : `<button class="btn-outline-action text-muted" onclick="moveTask(${t.id}, 'todo')"><i class="fas fa-undo"></i></button>`); let html = `<div class="kanban-card"><h4>${t.title}</h4><div class="kanban-meta"><span>Ưu tiên: ${prioIcon}</span></div><div class="kanban-actions"><button class="btn-outline-action text-red" onclick="deleteTask(${t.id})"><i class="fas fa-trash"></i></button>${nextBtn}</div></div>`; if(t.status === 'todo') todo.innerHTML += html; else if(t.status === 'doing') doing.innerHTML += html; else done.innerHTML += html; }); }
window.deleteTask = function(id) { if(confirm("Xóa công việc này?")) { appData.tasks = appData.tasks.filter(x => x.id != id); window.saveData(); window.renderKanban(); } }

window.saveDoc = async function() { const folder = document.getElementById('doc-folder').value; const fileInput = document.getElementById('doc-file'); if(fileInput.files.length === 0) return window.showToast("Chưa chọn file!", "error"); const file = fileInput.files[0]; if (file.size > 20 * 1024 * 1024) return window.showToast("File quá lớn (>20MB)!", "error"); const docId = Date.now(); try { await window.saveFileToDB(docId, file); appData.documents.push({ id: docId, name: file.name, folder: folder, type: file.type || file.name.split('.').pop(), size: (file.size / 1024 / 1024).toFixed(2) + ' MB', date: getTodayStr() }); window.saveData(); window.closeModal('modal-upload-doc'); window.renderDocs(); window.showToast("Đã tải lên và lưu file an toàn!"); fileInput.value = ""; } catch (err) { window.showToast("Lỗi lưu file!", "error"); } }
let currentFolderFilter = 'all'; window.filterDocs = function(folder, el) { currentFolderFilter = folder; document.querySelectorAll('.doc-folder').forEach(x => x.classList.remove('active')); el.classList.add('active'); window.renderDocs(); }
window.renderDocs = function() { const txt = document.getElementById('search-doc') ? document.getElementById('search-doc').value.toLowerCase() : ''; const list = document.getElementById('doc-list'); if(!list) return; list.innerHTML = ''; let docs = appData.documents.filter(d => d.name.toLowerCase().includes(txt)); if(currentFolderFilter !== 'all') docs = docs.filter(d => d.folder === currentFolderFilter); if(docs.length === 0) { list.innerHTML = '<div class="empty-state">Thư mục trống</div>'; return; } docs.forEach(d => { let icon = d.name.toLowerCase().includes('.pdf') ? 'fa-file-pdf text-red' : (d.name.toLowerCase().includes('.xls') ? 'fa-file-excel text-green' : (d.name.toLowerCase().includes('.doc') ? 'fa-file-word text-blue' : 'fa-file-alt')); let isViewable = d.type.includes('pdf') || d.type.includes('image') || d.name.toLowerCase().endsWith('.png') || d.name.toLowerCase().endsWith('.jpg'); let viewBtn = isViewable ? `<button class="btn-outline-action text-blue" onclick="previewDoc(${d.id})" title="Xem file"><i class="fas fa-eye"></i></button>` : ''; list.innerHTML += `<div class="doc-card"><div class="doc-card-header"><div class="doc-icon"><i class="fas ${icon}"></i></div><div class="doc-info"><h4>${d.name}</h4><p>${d.size} • ${d.folder} • ${d.date}</p></div></div><div class="doc-actions">${viewBtn}<button class="btn-outline-action text-green" onclick="downloadDoc(${d.id})" title="Tải xuống"><i class="fas fa-download"></i></button><button class="btn-outline-action text-orange" onclick="renameDocUI(${d.id})" title="Đổi tên"><i class="fas fa-pen"></i></button><button class="btn-outline-action text-red" onclick="deleteDoc(${d.id})" title="Xóa"><i class="fas fa-trash"></i></button></div></div>`; }); }
let currentObjectURL = null; window.previewDoc = async function(id) { const docInfo = appData.documents.find(d => d.id === id); if (!docInfo) return; const blob = await window.getFileFromDB(id); if (!blob) return window.showToast("Không tìm thấy file gốc!", "error"); if (currentObjectURL) URL.revokeObjectURL(currentObjectURL); currentObjectURL = URL.createObjectURL(blob); const previewContainer = document.getElementById('preview-container'); previewContainer.innerHTML = ''; if (docInfo.type.includes('pdf') || docInfo.name.toLowerCase().endsWith('.pdf')) { previewContainer.innerHTML = `<iframe src="${currentObjectURL}#toolbar=0" style="width:100%; flex:1; border:none; display:block;"></iframe>`; } else { previewContainer.innerHTML = `<img src="${currentObjectURL}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:10px; display:block; margin: auto;">`; } document.getElementById('preview-doc-title').innerText = docInfo.name; window.openModal('modal-preview-doc'); }
window.closePreviewModal = function() { window.closeModal('modal-preview-doc'); document.getElementById('preview-container').innerHTML = ''; }
window.downloadDoc = async function(id) { const docInfo = appData.documents.find(d => d.id === id); if (!docInfo) return; const blob = await window.getFileFromDB(id); if (!blob) return window.showToast("Không tìm thấy file gốc!", "error"); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = docInfo.name; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); window.showToast(`Đang tải: ${docInfo.name}`); }
window.renameDocUI = function(id) { const docInfo = appData.documents.find(d => d.id === id); if (!docInfo) return; document.getElementById('rename-doc-id').value = id; document.getElementById('rename-doc-name').value = docInfo.name; window.openModal('modal-rename-doc'); }
window.saveRenameDoc = function() { const id = parseInt(document.getElementById('rename-doc-id').value); const newName = document.getElementById('rename-doc-name').value.trim(); if (!newName) return window.showToast("Nhập tên file!", "error"); const docInfo = appData.documents.find(d => d.id === id); if (docInfo) { docInfo.name = newName; window.saveData(); window.renderDocs(); window.closeModal('modal-rename-doc'); window.showToast("Đã cập nhật!"); } }
window.deleteDoc = async function(id) { if(confirm("Xóa tài liệu vĩnh viễn?")) { appData.documents = appData.documents.filter(x => x.id != id); window.saveData(); window.renderDocs(); try { await window.deleteFileFromDB(id); window.showToast("Đã xóa file!"); } catch(e) {} } }

window.backupData = function() { let dataStr = JSON.stringify(appData); let blob = new Blob([dataStr], {type: "application/json"}); let url = URL.createObjectURL(blob); let a = document.createElement('a'); a.href = url; let date = new Date().toISOString().split('T')[0]; a.download = `DuLieu_GVCN_${date}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); window.showToast("Đã tải bản sao lưu (File .json) xuống máy!"); }
window.restoreData = function(event) { let file = event.target.files[0]; if(!file) return; let reader = new FileReader(); reader.onload = function(e) { try { let parsed = JSON.parse(e.target.result); if(parsed.students && parsed.settings && parsed.attendance) { if(confirm("CẢNH BÁO: Dữ liệu hiện tại trên trình duyệt sẽ bị GHI ĐÈ hoàn toàn bởi dữ liệu từ file này. Bạn có chắc chắn muốn khôi phục?")) { appData = parsed; window.saveData(); window.showToast("Khôi phục thành công! Đang tải lại..."); setTimeout(() => location.reload(), 1500); } } else { window.showToast("File khôi phục không hợp lệ!", "error"); } } catch(err) { window.showToast("Lỗi đọc file!", "error"); } }; reader.readAsText(file); event.target.value = ''; }

window.renderMonthlyTheme = function() { let currentMonth = new Date().getMonth() + 1; let selectedMonth = document.getElementById('rank-month-select') ? document.getElementById('rank-month-select').value : currentMonth; if(document.getElementById('rank-month-select') && !document.getElementById('rank-month-select').getAttribute('data-init')) { document.getElementById('rank-month-select').value = currentMonth; document.getElementById('rank-month-select').setAttribute('data-init', 'true'); selectedMonth = currentMonth; } let themes = appData.settings.monthlyThemes || {}; let themeName = themes[selectedMonth] || "RÈN LUYỆN CHĂM NGOAN"; if(document.getElementById('theme-month-display')) document.getElementById('theme-month-display').innerText = selectedMonth; if(document.getElementById('theme-name-display')) document.getElementById('theme-name-display').innerText = themeName; }
window.saveMonthlyTheme = function() { let m = document.getElementById('edit-theme-month').value; let n = document.getElementById('edit-theme-name').value; if(!m || !n) return window.showToast("Vui lòng nhập đủ thông tin!", "error"); if(!appData.settings.monthlyThemes) appData.settings.monthlyThemes = {}; appData.settings.monthlyThemes[m] = n.toUpperCase(); window.saveData(); window.closeModal('modal-edit-theme'); document.getElementById('rank-month-select').value = m; window.updateLeaderboard(); window.showToast("Đã cập nhật Chủ điểm!"); }
window.updateLeaderboard = function() { window.renderMonthlyTheme(); let month = parseInt(document.getElementById('rank-month-select').value); const list = document.getElementById('honor-roll-list'); list.innerHTML = ''; let stuPoints = {}; appData.students.forEach(s => { stuPoints[s.id] = { id: s.id, name: s.name, points: 0, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=e0ecff&color=0d6efd&bold=true` }; }); appData.behaviorRecords.forEach(r => { let recordMonth = new Date(r.date).getMonth() + 1; if(recordMonth === month && stuPoints[r.studentId]) { stuPoints[r.studentId].points += Number(r.snapshotPoints); } }); let rankedStudents = Object.values(stuPoints).sort((a, b) => b.points - a.points); let topStudents = rankedStudents.slice(0, 5); if(topStudents.length === 0 || topStudents[0].points === 0) { list.innerHTML = '<div class="text-center text-muted w-full" style="padding: 20px; font-size: 0.9rem; background:#f8fafc; border-radius:12px;">Tháng này chưa có dữ liệu thi đua.</div>'; return; } let top1 = topStudents[0]; let htmlContent = ` <div class="star-top1"> <img src="${top1.avatar}" class="star-avatar-1"> <div class="star-info-1"> <div class="star-badge">Hạng 1</div> <div class="star-name-1">${top1.name}</div> <div class="star-pts-1"><i class="fas fa-arrow-up"></i> ${top1.points} điểm</div> </div> </div> <div class="star-list-others"> `; for(let i = 1; i < topStudents.length; i++) { let stu = topStudents[i]; if (stu.points > 0) { let rank = i + 1; htmlContent += `<div class="star-item"><div class="star-rank r${rank}">${rank}</div><img src="${stu.avatar}" class="star-avatar"><div class="star-name">${stu.name}</div><div class="star-pts">+${stu.points}</div></div>`; } } htmlContent += `</div>`; list.innerHTML = htmlContent; }
window.renderRankingList = function() { let period = document.getElementById('full-rank-period-select').value; const list = document.getElementById('full-ranking-list'); list.innerHTML = ''; let stuPoints = {}; appData.students.forEach(s => { stuPoints[s.id] = { id: s.id, name: s.name, points: 0 }; }); appData.behaviorRecords.forEach(r => { let recordMonth = new Date(r.date).getMonth() + 1; let inPeriod = false; if (period === 'HK1' && (recordMonth >= 8 || recordMonth <= 12)) inPeriod = true; else if (period === 'HK2' && (recordMonth >= 1 && recordMonth <= 5)) inPeriod = true; else if (period === 'CA_NAM') inPeriod = true; else if (parseInt(period) === recordMonth) inPeriod = true; if (inPeriod && stuPoints[r.studentId]) { stuPoints[r.studentId].points += Number(r.snapshotPoints); } }); let rankedStudents = Object.values(stuPoints).sort((a, b) => b.points - a.points); if (rankedStudents.length === 0) { list.innerHTML = '<div class="empty-state">Chưa có học sinh nào.</div>'; return; } rankedStudents.forEach((stu, index) => { let rank = index + 1; let classification = "Đạt"; let badgeClass = "bg-orange"; if (stu.points >= 15) { classification = "Tốt"; badgeClass = "bg-green"; } else if (stu.points >= 5) { classification = "Khá"; badgeClass = "bg-blue"; } else if (stu.points >= 0) { classification = "Đạt"; badgeClass = "bg-orange"; } else { classification = "Cần cố gắng"; badgeClass = "bg-red"; } list.innerHTML += ` <div class="list-item" style="display:flex; align-items:center; gap:12px; padding: 12px 15px;"> <div style="width: 25px; font-weight:900; font-size: 1.1rem; color: ${rank <= 3 ? 'var(--warning)' : 'var(--text-muted)'}; text-align:center;">#${rank}</div> <div style="flex:1;"><strong style="font-size:0.95rem; color:var(--text-main);">${stu.name}</strong><div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Tổng điểm: <b class="${stu.points >= 0 ? 'text-green' : 'text-red'}">${stu.points > 0 ? '+'+stu.points : stu.points}</b></div></div> <div class="star-badge ${badgeClass}" style="margin:0; padding:6px 12px; font-size:0.75rem; border-radius: 8px; color:white;">${classification}</div> </div> `; }); }
window.exportRankingExcel = function() { let selectEl = document.getElementById('full-rank-period-select'); let periodName = selectEl.options[selectEl.selectedIndex].text; let periodVal = selectEl.value; if (appData.students.length === 0) return window.showToast("Lớp chưa có học sinh!", "error"); let stuPoints = {}; appData.students.forEach(s => { stuPoints[s.id] = { id: s.id, name: s.name, points: 0 }; }); appData.behaviorRecords.forEach(r => { let recordMonth = new Date(r.date).getMonth() + 1; let inPeriod = false; if (periodVal === 'HK1' && (recordMonth >= 8 || recordMonth <= 12)) inPeriod = true; else if (periodVal === 'HK2' && (recordMonth >= 1 && recordMonth <= 5)) inPeriod = true; else if (periodVal === 'CA_NAM') inPeriod = true; else if (parseInt(periodVal) === recordMonth) inPeriod = true; if (inPeriod && stuPoints[r.studentId]) stuPoints[r.studentId].points += Number(r.snapshotPoints); }); let rankedStudents = Object.values(stuPoints).sort((a, b) => b.points - a.points); let ws_data = [ [`BẢNG TỔNG HỢP XẾP LOẠI THI ĐUA - ${periodName.toUpperCase()}`], ["Lớp: " + appData.settings.className, "GVCN: " + appData.settings.teacherName], [""], ["Xếp hạng", "Họ và tên", "Tổng điểm thi đua", "Xếp loại", "Ghi chú GVCN"] ]; rankedStudents.forEach((stu, index) => { let classification = "Đạt"; if (stu.points >= 15) classification = "Tốt"; else if (stu.points >= 5) classification = "Khá"; else if (stu.points >= 0) classification = "Đạt"; else classification = "Cần cố gắng"; ws_data.push([index + 1, stu.name, stu.points, classification, ""]); }); var wb = XLSX.utils.book_new(); var ws = XLSX.utils.aoa_to_sheet(ws_data); XLSX.utils.book_append_sheet(wb, ws, "Xep_Loai"); XLSX.writeFile(wb, `Bang_Xep_Loai_${periodVal}.xlsx`); window.showToast("Đã xuất file Excel Báo Cáo!"); }