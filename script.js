// ================= FIREBASE AUTH & DATABASE GVBM =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// SỬ DỤNG LONG-POLLING ĐỂ TRÁNH LỖI ĐỎ CONSOLE 400 TRÊN TRÌNH DUYỆT
const firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true
});
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

        const userRef = doc(firestoreDb, 'khach_hang_gvbm', user.uid);
        let hasAccess = true;

        try {
            const docUserSnap = await getDoc(userRef);
            const ngayHienTai = new Date();

            if (!docUserSnap.exists()) {
                // RÚT NGẮN THỜI GIAN TRẢI NGHIỆM DÙNG THỬ XUỐNG 15 NGÀY
                let ngayHetHan = new Date();
                ngayHetHan.setDate(ngayHienTai.getDate() + 15);
                await setDoc(userRef, { email: user.email, ngay_dang_ky: ngayHienTai.toISOString(), ngay_het_han: ngayHetHan.toISOString() });
            } else {
                const duLieu = docUserSnap.data();
                const ngayHetHan = new Date(duLieu.ngay_het_han);
                const timeDiff = ngayHetHan.getTime() - ngayHienTai.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (daysLeft <= 0) {
                    hasAccess = false;
                    document.getElementById('man-hinh-thu-phi').style.display = 'block';
                    let emailElements = document.getElementsByClassName('email-user');
                    for (let i = 0; i < emailElements.length; i++) emailElements[i].innerText = user.email.split('@')[0];
                } else if (daysLeft <= 5) {
                    const banner = document.getElementById('trial-warning-banner');
                    if (banner) {
                        banner.style.display = 'flex';
                        document.getElementById('trial-days-left').innerText = daysLeft;
                        if(document.getElementById('upgrade-email-prefix')) {
                            document.getElementById('upgrade-email-prefix').innerText = user.email.split('@')[0];
                        }
                    }
                }
            }
        } catch (error) { console.log("Lỗi kiểm tra bản quyền:", error); }

        if (hasAccess) {
            try {
                const docRef = doc(firestoreDb, "DuLieuGVBM", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    appData = docSnap.data(); 
                } else {
                    await setDoc(docRef, appData); 
                }
            } catch(e) {
                console.warn("Lỗi tải mây:", e);
            }
            window.initAppUI();
        }
    } else {
        currentUser = null;
        if(loginScreen) loginScreen.style.display = 'flex';
    }
});

window.logoutApp = function() {
    if(confirm("Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này?")) {
        signOut(auth).then(() => {
            localStorage.removeItem('gvbmData_v1'); 
            location.reload();
        });
    }
};

// ================= DỮ LIỆU MẶC ĐỊNH & KHỞI TẠO =================
const defaultCommentRules = [
    { min: 9.0, max: 10.0, text: "Nắm vững kiến thức, tiếp tục phát huy." },
    { min: 8.0, max: 8.9, text: "Nắm khá vững kiến thức, cần phát huy." },
    { min: 6.5, max: 7.9, text: "Nắm được kiến thức, cần cố gắng thêm." },
    { min: 5.0, max: 6.4, text: "Đạt yêu cầu, cần củng cố kiến thức." },
    { min: 3.5, max: 4.9, text: "Chưa đạt yêu cầu, cần cố gắng hơn." },
    { min: 0.0, max: 3.4, text: "Chưa nắm vững kiến thức, cần củng cố thêm." }
];

function initData() {
    let saved = JSON.parse(localStorage.getItem('gvbmData_v1'));
    if (!saved) {
        saved = {
            settings: {
                teacherName: "Thầy / Cô",
                subject: "Toán học",
                year: "2025-2026",
                semester: "HK1",
                currentClass: "TOÁN HỌC - 6A",
                txColumns: 4,
                commentRules: defaultCommentRules
            },
            classes: {},
            activityGroups: {}, // Lưu danh sách nhóm hoạt động linh hoạt
            scheduleSetup: { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] },
            scheduleRecords: []
        };
    } else {
        if (!saved.activityGroups) saved.activityGroups = {};
        if (!saved.scheduleSetup) saved.scheduleSetup = { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] };
        if (!saved.scheduleSetup.mathRatios) saved.scheduleSetup.mathRatios = [];
        if (!saved.scheduleRecords) saved.scheduleRecords = [];
    }
    return saved;
}

let appData = initData();
let syncTimeout = null;

window.saveData = function() { 
    localStorage.setItem('gvbmData_v1', JSON.stringify(appData)); 
    window.refreshAllViews();
    if (currentUser) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const docRef = doc(firestoreDb, "DuLieuGVBM", currentUser.uid);
            setDoc(docRef, appData).then(() => { console.log("☁️ Đã đồng bộ nền lên Firebase!"); }).catch(e => console.error(e));
        }, 2000);
    }
};

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container'); 
    if(!container) return;
    const toast = document.createElement('div'); 
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle text-green' : 'fa-exclamation-circle text-red'}"></i> <span>${message}</span>`; 
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => toast.remove(), 300); }, 3000);
};

// ================= ĐIỀU HƯỚNG VIEW & DRAWER =================
window.toggleDrawer = function(open) {
    document.getElementById('drawer').classList.toggle('active', open);
    document.getElementById('drawer-overlay').classList.toggle('active', open);
};

window.switchView = function(viewId, navEl = null) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    window.scrollTo(0, 0);

    const titleMap = {
        'view-overview': 'Tổng quan',
        'view-students': 'Học sinh',
        'view-groups': 'Chia tổ / nhóm',
        'view-in-class': 'Trong tiết',
        'view-gradebook': 'Sổ điểm',
        'view-lesson-log': 'Sổ báo giảng',
        'view-statistics': 'Thống kê',
        'view-settings': 'Cài đặt'
    };
    document.getElementById('page-title').innerText = titleMap[viewId] || 'GVBM Pro';

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(navEl) navEl.classList.add('active');
    if(viewId === 'view-lesson-log') window.initLessonLogView();
    if(viewId === 'view-groups') window.renderGroupsView();
    
    window.refreshAllViews();
};

window.openModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex'; 
};

window.closeModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'none'; 
};

// ================= TỰ ĐỘNG TÍNH TOÁN & NHẬN XÉT =================
window.calculateDTB = function(txArr, gk, ck) {
    let allGrades = [...txArr, gk, ck];
    if (allGrades.some(g => typeof g === 'string' && (g.toUpperCase() === 'Đ' || g.toUpperCase() === 'CĐ'))) {
        if (ck) return ck;
        if (gk) return gk;
        let lastTx = [...txArr].reverse().find(g => g);
        return lastTx || "";
    }

    let validTx = txArr.filter(x => x !== "" && x !== null && !isNaN(Number(x))).map(Number);
    let numGk = (gk !== "" && gk !== null && !isNaN(Number(gk))) ? Number(gk) : null;
    let numCk = (ck !== "" && ck !== null && !isNaN(Number(ck))) ? Number(ck) : null;

    if (validTx.length === 0 && numGk === null && numCk === null) return "";

    let sum = validTx.reduce((a, b) => a + b, 0);
    let count = validTx.length;

    if (numGk !== null) { sum += numGk * 2; count += 2; }
    if (numCk !== null) { sum += numCk * 3; count += 3; }

    if (count === 0) return "";
    return (sum / count).toFixed(1);
};

window.getAutoComment = function(dtb) {
    if (dtb === "" || dtb === null) return "";
    
    if (typeof dtb === 'string') {
        let d = dtb.toUpperCase();
        if (d === 'Đ' || d === 'ĐẠT') return "Đạt yêu cầu môn học.";
        if (d === 'CĐ' || d === 'CHƯA ĐẠT') return "Chưa đạt yêu cầu, cần cố gắng thêm.";
    }

    let val = Number(dtb);
    if (isNaN(val)) return "";
    
    let rules = appData.settings.commentRules || defaultCommentRules;
    for (let r of rules) {
        if (val >= r.min && val <= r.max) return r.text;
    }
    return "Cần cố gắng nhiều hơn.";
};

// ================= RENDER CÁC MÀN HÌNH =================
window.initAppUI = function() {
    window.renderClassSelector();
    window.refreshAllViews();
};

window.renderClassSelector = function() {
    const select = document.getElementById('global-class-select');
    if(!select) return;
    select.innerHTML = '';
    const classList = Object.keys(appData.classes);
    if(classList.length === 0) {
        appData.classes["TOÁN HỌC - 6A"] = [];
        classList.push("TOÁN HỌC - 6A");
    }
    if(!appData.classes[appData.settings.currentClass]) {
        appData.settings.currentClass = classList[0];
    }
    classList.forEach(c => {
        let opt = document.createElement('option');
        opt.value = c; opt.innerText = c; 
        if(c === appData.settings.currentClass) opt.selected = true;
        select.appendChild(opt);
    });
};

window.changeCurrentClass = function(newClass) {
    appData.settings.currentClass = newClass;
    window.saveData();
    window.showToast(`Đã chuyển sang ${newClass}`);
};

window.refreshAllViews = function() {
    const s = appData.settings;
    const currentList = appData.classes[s.currentClass] || [];

    let keyParts = s.currentClass.split(' - ');
    let displaySubject = keyParts.length > 1 ? keyParts[0] : s.subject;
    let displayClass = keyParts.length > 1 ? keyParts[1] : s.currentClass;

    if(document.getElementById('dash-teacher-name')) document.getElementById('dash-teacher-name').innerText = s.teacherName;
    if(document.getElementById('drawer-teacher-name')) document.getElementById('drawer-teacher-name').innerText = s.teacherName;
    if(document.getElementById('drawer-subject-name')) document.getElementById('drawer-subject-name').innerText = `${displaySubject} • Lớp ${displayClass}`;
    
    let parts = s.teacherName.trim().split(' ');
    let avatarText = "GV";
    if (parts.length > 0 && parts[parts.length-1]) {
        avatarText = parts[parts.length-1].substring(0,2).toUpperCase();
    }
    if(document.getElementById('drawer-avatar')) document.getElementById('drawer-avatar').innerText = avatarText;

    // 1. Dashboard Metrics
    const totalStudents = currentList.length;
    if(document.getElementById('stat-class-size')) document.getElementById('stat-class-size').innerText = totalStudents;

    let validScores = currentList.map(st => Number(st.dtb)).filter(v => !isNaN(v) && v > 0);
    let avgScore = validScores.length > 0 ? (validScores.reduce((a,b)=>a+b, 0) / validScores.length).toFixed(1) : "0.0";
    if(document.getElementById('stat-class-avg')) document.getElementById('stat-class-avg').innerText = avgScore;

    let goodCount = validScores.filter(sc => sc >= 8.0).length;
    let goodRate = totalStudents > 0 ? Math.round((goodCount / totalStudents) * 100) : 0;
    if(document.getElementById('stat-good-rate')) document.getElementById('stat-good-rate').innerText = `${goodRate}%`;
    if(document.getElementById('stat-tx-count')) document.getElementById('stat-tx-count').innerText = `${s.txColumns || 4} cột`;

    // Phân bố kết quả
    let cXuatSac = validScores.filter(sc => sc >= 9.0).length;
    let cTot = validScores.filter(sc => sc >= 8.0 && sc < 9.0).length;
    let cKha = validScores.filter(sc => sc >= 6.5 && sc < 8.0).length;
    let cCanCoGang = validScores.filter(sc => sc < 6.5).length;

    if(document.getElementById('count-xuat-sac')) document.getElementById('count-xuat-sac').innerText = cXuatSac;
    if(document.getElementById('count-tot')) document.getElementById('count-tot').innerText = cTot;
    if(document.getElementById('count-kha')) document.getElementById('count-kha').innerText = cKha;
    if(document.getElementById('count-can-co-gang')) document.getElementById('count-can-co-gang').innerText = cCanCoGang;

    if (totalStudents > 0) {
        if(document.getElementById('bar-xuat-sac')) document.getElementById('bar-xuat-sac').style.width = `${(cXuatSac/totalStudents)*100}%`;
        if(document.getElementById('bar-tot')) document.getElementById('bar-tot').style.width = `${(cTot/totalStudents)*100}%`;
        if(document.getElementById('bar-kha')) document.getElementById('bar-kha').style.width = `${(cKha/totalStudents)*100}%`;
        if(document.getElementById('bar-can-co-gang')) document.getElementById('bar-can-co-gang').style.width = `${(cCanCoGang/totalStudents)*100}%`;
    }

    // Danh sách cần chú ý
    const attList = document.getElementById('attention-student-list');
    if(attList) {
        attList.innerHTML = '';
        let attentionStudents = currentList.filter(st => {
            let isLowScore = (Number(st.dtb) > 0 && Number(st.dtb) < 6.5);
            let isCD = (typeof st.dtb === 'string' && st.dtb.toUpperCase() === 'CĐ');
            return isLowScore || isCD || (st.violationCount > 0);
        });
        
        if (attentionStudents.length === 0) {
            attList.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 15px;">Lớp đang học tập rất tốt! 🎉</div>`;
        } else {
            attentionStudents.slice(0, 5).forEach(st => {
                let initials = st.name.split(' ').map(n=>n[0]).slice(-2).join('').toUpperCase();
                let isDanger = (Number(st.dtb) > 0 && Number(st.dtb) < 5.0) || (typeof st.dtb === 'string' && st.dtb.toUpperCase() === 'CĐ');
                let scoreClass = isDanger ? 'danger' : 'warn';
                attList.innerHTML += `
                    <div class="attention-item" onclick="openStudentProfile(${st.id})">
                        <div class="att-left">
                            <div class="avatar-circle-sm">${initials}</div>
                            <div class="att-info">
                                <strong>${st.name}</strong>
                                <span>Tổ ${st.team || 1} • ${st.violationCount || 0} lần vi phạm • ${st.callCount || 0} lần gọi</span>
                            </div>
                        </div>
                        <span class="score-pill ${scoreClass}">${st.dtb || '--'}</span>
                    </div>
                `;
            });
        }
    }

    if(document.getElementById('stat-view-classname')) document.getElementById('stat-view-classname').innerText = displayClass;
    if(document.getElementById('stat-view-subject')) document.getElementById('stat-view-subject').innerText = displaySubject;
    if(document.getElementById('stat-view-year')) document.getElementById('stat-view-year').innerText = s.year;
    if(document.getElementById('stat-total-stu')) document.getElementById('stat-total-stu').innerText = totalStudents;
    if(document.getElementById('stat-avg-all')) document.getElementById('stat-avg-all').innerText = avgScore;
    
    let maxS = validScores.length > 0 ? Math.max(...validScores) : 0;
    let minS = validScores.length > 0 ? Math.min(...validScores) : 0;
    if(document.getElementById('stat-max-score')) document.getElementById('stat-max-score').innerText = maxS;
    if(document.getElementById('stat-min-score')) document.getElementById('stat-min-score').innerText = minS;

    window.renderStudentsView();
    window.renderGradebookTable();
    window.renderInClassView();

    if(document.getElementById('set-teacher-name')) document.getElementById('set-teacher-name').value = s.teacherName || '';
    if(document.getElementById('set-subject-name')) document.getElementById('set-subject-name').value = s.subject || '';
    if(document.getElementById('set-school-year')) document.getElementById('set-school-year').value = s.year || '';
    if(document.getElementById('set-semester')) document.getElementById('set-semester').value = s.semester || 'HK1';
    window.renderCommentRulesSettings();

    // Render Lịch dạy hôm nay trên Dashboard Tổng quan
    const llList = document.getElementById('dash-ll-list');
    if (llList) {
        llList.innerHTML = '';
        let today = getTodayStr();
        let todaysLessons = (appData.scheduleRecords || []).filter(r => r.date === today);
        if(document.getElementById('dash-ll-date')) document.getElementById('dash-ll-date').innerText = new Date().toLocaleDateString('vi-VN');
        if(todaysLessons.length === 0) {
            llList.innerHTML = `<div style="text-align:center; font-size:0.85rem; opacity:0.85; color:white; padding:5px;">Hôm nay không có tiết dạy nào.</div>`;
        } else {
            todaysLessons.sort((a,b) => a.period - b.period).forEach(l => {
                let stIcon = l.status === 'off' ? 'fa-times text-red' : (l.status === 'completed' ? 'fa-check text-green' : 'fa-clock text-blue');
                llList.innerHTML += `
                    <div class="ll-item">
                        <div class="ll-period"><span>Tiết</span>${l.period}</div>
                        <div class="ll-content">
                            <h4>${l.subject} - Lớp ${l.className}</h4>
                            <p>${l.content}</p>
                        </div>
                        <i class="fas ${stIcon}" style="background:white; padding:6px; border-radius:50%; font-size:0.8rem;"></i>
                    </div>
                `;
            });
        }
        let currentWeek = todaysLessons.length > 0 ? todaysLessons[0].week : 1;
        let weekLessons = (appData.scheduleRecords || []).filter(r => r.week == currentWeek && r.status !== 'off').length;
        if(document.getElementById('dash-ll-week-count')) document.getElementById('dash-ll-week-count').innerText = weekLessons;
    }
    window.renderSetupData();
};

// ================= RENDER DANH SÁCH HỌC SINH =================
window.renderStudentsView = function() {
    const listEl = document.getElementById('students-card-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const searchTxt = (document.getElementById('search-student-input')?.value || '').toLowerCase();

    let filtered = currentList.filter(s => s.name.toLowerCase().includes(searchTxt));
    if(filtered.length === 0) {
        listEl.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 20px;">Không tìm thấy học sinh nào.</div>`;
        return;
    }

    filtered.forEach((st, idx) => {
        let initials = st.name.split(' ').map(n=>n[0]).slice(-2).join('').toUpperCase();
        
        let evalBadge = 'good';
        if (typeof st.dtb === 'string') {
            let d = st.dtb.toUpperCase();
            if (d === 'CĐ' || d === 'CHƯA ĐẠT') evalBadge = 'danger';
            else if (d !== 'Đ' && d !== 'ĐẠT' && isNaN(Number(d))) evalBadge = 'warn'; 
        } else {
            let dtb = Number(st.dtb) || 0;
            evalBadge = dtb >= 8 ? 'good' : (dtb >= 5 ? 'warn' : 'danger');
        }
        if (st.dtb === "" || st.dtb === null) evalBadge = 'warn'; 

        listEl.innerHTML += `
            <div class="stat-card-modern" style="cursor: pointer;" onclick="openStudentProfile(${st.id})">
                <div class="avatar-circle-sm">${initials}</div>
                <div style="flex: 1;">
                    <strong style="font-size: 0.95rem; color: var(--text-main); display: block;">${idx + 1}. ${st.name} <span style="font-size:0.75rem; background:#f1f5f9; padding:2px 8px; border-radius:6px; color:var(--primary); font-weight:800;">Tổ ${st.team || 1}</span></strong>
                    <small style="color: var(--text-muted);">${st.dob || 'Chưa có ngày sinh'} • Gọi: ${st.callCount || 0} • Lỗi: ${st.violationCount || 0}</small>
                </div>
                <span class="score-pill ${evalBadge}">${st.dtb || '--'}</span>
            </div>
        `;
    });
};

// ================= HỒ SƠ HỌC SINH (MODAL PROFILE) =================
let editingStudentId = null;
window.openStudentProfile = function(id) {
    editingStudentId = id;
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const st = currentList.find(x => x.id === id);
    if (!st) return;

    const stt = currentList.findIndex(x => x.id === id) + 1;
    let keyParts = appData.settings.currentClass.split(' - ');
    let displayClass = keyParts.length > 1 ? keyParts[1] : appData.settings.currentClass;

    document.getElementById('prof-student-id').value = st.id;
    document.getElementById('prof-header-name').innerText = st.name;
    document.getElementById('prof-name').value = st.name;
    document.getElementById('prof-fixed-team').value = st.team || 1;
    document.getElementById('prof-header-class').innerText = displayClass;
    document.getElementById('prof-header-stt').innerText = stt;
    document.getElementById('prof-header-dtb').innerText = st.dtb || '--';
    document.getElementById('prof-avatar').innerText = st.name.split(' ').map(n=>n[0]).slice(-2).join('').toUpperCase();

    document.getElementById('prof-calls').innerText = st.callCount || 0;
    document.getElementById('prof-violations').innerText = st.violationCount || 0;

    const txContainer = document.getElementById('prof-tx-container');
    txContainer.innerHTML = '';
    const numCols = appData.settings.txColumns || 4;
    for(let i=0; i<numCols; i++) {
        let val = st.tx && st.tx[i] !== undefined ? st.tx[i] : '';
        txContainer.innerHTML += `
            <div class="tx-box">
                <span>TX${i+1}</span>
                <input type="text" class="prof-tx-input" data-idx="${i}" value="${val}" oninput="recalcProfileScores()">
            </div>
        `;
    }

    document.getElementById('prof-gk').value = st.gk !== undefined ? st.gk : '';
    document.getElementById('prof-ck').value = st.ck !== undefined ? st.ck : '';
    document.getElementById('prof-dtb').value = st.dtb || '';
    document.getElementById('prof-comment').value = st.comment || '';

    window.recalcProfileScores();
    window.openModal('modal-student-profile');
};

window.stepCounter = function(elementId, delta) {
    const el = document.getElementById(elementId);
    let val = Math.max(0, parseInt(el.innerText || 0) + delta);
    el.innerText = val;
};

window.recalcProfileScores = function() {
    let txInputs = document.querySelectorAll('.prof-tx-input');
    let txArr = Array.from(txInputs).map(inp => inp.value);
    let gk = document.getElementById('prof-gk').value;
    let ck = document.getElementById('prof-ck').value;

    let dtb = window.calculateDTB(txArr, gk, ck);
    document.getElementById('prof-dtb').value = dtb;
    document.getElementById('prof-header-dtb').innerText = dtb || '--';

    let autoComment = window.getAutoComment(dtb);
    if(autoComment) {
        document.getElementById('prof-comment').value = autoComment;
    }
};

window.saveStudentProfile = function() {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const st = currentList.find(x => x.id === editingStudentId);
    if(!st) return;

    st.name = document.getElementById('prof-name').value.trim();
    st.team = parseInt(document.getElementById('prof-fixed-team').value) || 1;
    st.callCount = parseInt(document.getElementById('prof-calls').innerText) || 0;
    st.violationCount = parseInt(document.getElementById('prof-violations').innerText) || 0;

    let txInputs = document.querySelectorAll('.prof-tx-input');
    st.tx = Array.from(txInputs).map(inp => inp.value !== "" ? (isNaN(Number(inp.value)) ? inp.value : Number(inp.value)) : "");
    st.gk = document.getElementById('prof-gk').value !== "" ? (isNaN(Number(document.getElementById('prof-gk').value)) ? document.getElementById('prof-gk').value : Number(document.getElementById('prof-gk').value)) : "";
    st.ck = document.getElementById('prof-ck').value !== "" ? (isNaN(Number(document.getElementById('prof-ck').value)) ? document.getElementById('prof-ck').value : Number(document.getElementById('prof-ck').value)) : "";
    st.dtb = document.getElementById('prof-dtb').value;
    st.comment = document.getElementById('prof-comment').value.trim();

    window.saveData();
    window.closeModal('modal-student-profile');
    window.showToast("✅ Đã lưu hồ sơ học sinh thành công!");
};

// ================= RENDER SỔ ĐIỂM (GRADEBOOK TABLE) =================
window.renderGradebookTable = function() {
    const tbody = document.getElementById('score-table-body');
    const theadRow = document.getElementById('score-table-header');
    if(!tbody || !theadRow) return;

    const numTx = appData.settings.txColumns || 4;
    let headerHtml = `<th>STT</th><th class="text-left">Họ và tên</th>`;
    for(let i=1; i<=numTx; i++) headerHtml += `<th>TX${i}</th>`;
    headerHtml += `<th>GK</th><th>CK</th><th>ĐTB</th><th class="text-left">Nhận xét</th>`;
    theadRow.innerHTML = headerHtml;

    tbody.innerHTML = '';
    const currentList = appData.classes[appData.settings.currentClass] || [];

    currentList.forEach((st, idx) => {
        let tr = document.createElement('tr');
        let txCells = '';
        for(let i=0; i<numTx; i++) {
            let val = (st.tx && st.tx[i] !== undefined) ? st.tx[i] : '';
            txCells += `<td><input type="text" class="score-input" value="${val}" onchange="quickUpdateScore(${st.id}, 'tx', ${i}, this.value)"></td>`;
        }

        tr.innerHTML = `
            <td>${idx + 1}</td>
            <td class="text-left"><strong style="cursor:pointer; color:var(--primary);" onclick="openStudentProfile(${st.id})">${st.name}</strong></td>
            ${txCells}
            <td><input type="text" class="score-input" value="${st.gk !== undefined ? st.gk : ''}" onchange="quickUpdateScore(${st.id}, 'gk', 0, this.value)"></td>
            <td><input type="text" class="score-input" value="${st.ck !== undefined ? st.ck : ''}" onchange="quickUpdateScore(${st.id}, 'ck', 0, this.value)"></td>
            <td><strong style="color:var(--primary);">${st.dtb || '--'}</strong></td>
            <td class="text-left"><input type="text" value="${st.comment || ''}" style="width:160px; padding:4px 8px; border:1px solid #cbd5e1; border-radius:6px; font-weight:600; font-size:0.8rem;" onchange="quickUpdateScore(${st.id}, 'comment', 0, this.value)"></td>
        `;
        tbody.appendChild(tr);
    });
};

window.quickUpdateScore = function(studentId, field, txIdx, value) {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const st = currentList.find(x => x.id === studentId);
    if(!st) return;

    if (field === 'tx') {
        if(!st.tx) st.tx = [];
        st.tx[txIdx] = value.trim() !== "" ? (isNaN(Number(value)) ? value : Number(value)) : "";
    } else if (field === 'gk') {
        st.gk = value.trim() !== "" ? (isNaN(Number(value)) ? value : Number(value)) : "";
    } else if (field === 'ck') {
        st.ck = value.trim() !== "" ? (isNaN(Number(value)) ? value : Number(value)) : "";
    } else if (field === 'comment') {
        st.comment = value.trim();
    }

    st.dtb = window.calculateDTB(st.tx || [], st.gk, st.ck);
    if (field !== 'comment') {
        st.comment = window.getAutoComment(st.dtb);
    }

    window.saveData();
};

window.addNewTxColumn = function() {
    appData.settings.txColumns = (appData.settings.txColumns || 4) + 1;
    window.saveData();
    window.showToast(`Đã thêm cột TX${appData.settings.txColumns}!`);
};

// ================= ĐỒNG BỘ & XUẤT FILE EDU =================
window.triggerEduImport = function() {
    document.getElementById('edu-import-input').click();
};

window.handleEduImportFile = function(event) {
    const file = event.target.files[0];
    if(!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            let totalImportedCount = 0;

            workbook.SheetNames.forEach(sheetName => {
                const sheet = workbook.Sheets[sheetName];
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
                if(rows.length < 7) return;

                let targetClass = "CHUNG";
                let classRowStr = (rows[3] || []).join(' ');
                let classMatch = classRowStr.match(/Lớp\s*([0-9]+[A-Za-z0-9]*)/i);
                if (classMatch && classMatch[1]) {
                    targetClass = classMatch[1].toUpperCase();
                } else if (sheetName.includes('_')) {
                    let parts = sheetName.split('_');
                    targetClass = parts[parts.length - 1].toUpperCase();
                }

                let targetSubject = appData.settings.subject.toUpperCase();
                let subjectRowStr = (rows[2] || []).join(' ');
                let subjectMatch = subjectRowStr.match(/MÔN\s+([^-]+)\s+-/i);
                if (subjectMatch && subjectMatch[1]) {
                    targetSubject = subjectMatch[1].trim().toUpperCase();
                }

                let listKey = `${targetSubject} - ${targetClass}`;

                if (!appData.classes[listKey]) appData.classes[listKey] = [];
                let classList = appData.classes[listKey];

                for (let r = 7; r < rows.length; r++) {
                    let row = rows[r];
                    let stt = row[0];
                    if (!stt || isNaN(parseInt(stt))) continue;

                    let maHs = String(row[1]).trim();
                    let hoDem = String(row[2]).trim();
                    let ten = String(row[3]).trim();
                    let fullName = `${hoDem} ${ten}`.trim();
                    let dob = String(row[4]).trim();

                    let tx1 = row[5], tx2 = row[6], tx3 = row[7], tx4 = row[8];
                    let gk = row[9], ck = row[10], dtb = row[11], comment = String(row[12]).trim();

                    let existing = classList.find(x => x.maHs === maHs || (maHs && x.maHs == maHs));
                    if (existing) {
                        existing.hoDem = hoDem; existing.ten = ten; existing.name = fullName; existing.dob = dob;
                        existing.tx = [tx1, tx2, tx3, tx4].filter(x => x !== "");
                        existing.gk = gk; existing.ck = ck; existing.dtb = dtb;
                        existing.comment = comment || window.getAutoComment(dtb);
                    } else {
                        classList.push({
                            id: Date.now() + Math.random(),
                            maHs: maHs,
                            hoDem: hoDem,
                            ten: ten,
                            name: fullName,
                            dob: dob,
                            gender: "Nam",
                            team: (totalImportedCount % 4) + 1, // Gán tổ mặc định 1-4
                            tx: [tx1, tx2, tx3, tx4].filter(x => x !== ""),
                            gk: gk,
                            ck: ck,
                            dtb: dtb,
                            comment: comment || window.getAutoComment(dtb),
                            callCount: 0,
                            violationCount: 0
                        });
                    }
                    totalImportedCount++;
                }
            });

            window.renderClassSelector();
            
            if (!appData.classes[appData.settings.currentClass]) {
                 appData.settings.currentClass = Object.keys(appData.classes)[0];
                 document.getElementById('global-class-select').value = appData.settings.currentClass;
            }

            window.saveData();
            window.showToast(`🎉 Đồng bộ EDU thành công ${totalImportedCount} học sinh!`);
        } catch (error) {
            console.error(error);
            window.showToast("Lỗi cấu trúc file EDU!", "error");
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = "";
};

window.exportEduFile = function() {
    const s = appData.settings;
    const currentList = appData.classes[s.currentClass] || [];
    if(currentList.length === 0) return window.showToast("Lớp chưa có dữ liệu!", "error");

    let keyParts = s.currentClass.split(' - ');
    let expSubject = keyParts.length > 1 ? keyParts[0] : s.subject.toUpperCase();
    let expClass = keyParts.length > 1 ? keyParts[1] : s.currentClass;

    let ws_data = [
        ["ỦY BAN NHÂN DÂN PHƯỜNG TĨNH GIA"],
        ["TRƯỜNG TH & THCS LƯƠNG CHÍ"],
        [`BẢNG ĐIỂM CHI TIẾT - MÔN ${expSubject} - ${s.semester.toUpperCase()} - NĂM HỌC ${s.year}`],
        [`Khối ${expClass.replace(/[^0-9]/g, '')} - Lớp ${expClass}`],
        [],
        ["STT", "Mã học sinh", "Họ và tên", "", "Ngày sinh", "ĐĐGtx", "", "", "ĐĐGtx", "ĐĐGgk", "ĐĐGck", "ĐTB \nmhk", "Nhận xét"],
        ["", "", "", "", "", "TX1", "TX2", "TX3", "TX4", "GK1", "CK1", "", ""]
    ];

    currentList.forEach((st, idx) => {
        let tx = st.tx || [];
        ws_data.push([
            idx + 1,
            st.maHs || "",
            st.hoDem || st.name.split(' ').slice(0, -1).join(' '),
            st.ten || st.name.split(' ').pop(),
            st.dob || "",
            tx[0] !== undefined ? tx[0] : "",
            tx[1] !== undefined ? tx[1] : "",
            tx[2] !== undefined ? tx[2] : "",
            tx[3] !== undefined ? tx[3] : "",
            st.gk !== undefined ? st.gk : "",
            st.ck !== undefined ? st.ck : "",
            st.dtb !== undefined ? st.dtb : "",
            st.comment || ""
        ]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, `so_diem_${expClass}`);
    XLSX.writeFile(wb, `So_Diem_${expSubject}_${expClass}.xlsx`);
    window.showToast("✅ Đã xuất File EDU thành công!");
};

// ================= TRONG TIẾT =================
let lastPickedStudent = null;
window.pickRandomStudent = function() {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    if(currentList.length === 0) return window.showToast("Lớp trống!", "error");

    const display = document.getElementById('random-picker-display');
    let count = 0;
    let interval = setInterval(() => {
        let randomStu = currentList[Math.floor(Math.random() * currentList.length)];
        display.innerText = randomStu.name;
        count++;
        if(count > 15) {
            clearInterval(interval);
            lastPickedStudent = randomStu;
            document.getElementById('btn-plus-call').style.display = 'inline-flex';
        }
    }, 80);
};

window.confirmAddCall = function() {
    if(!lastPickedStudent) return;
    lastPickedStudent.callCount = (lastPickedStudent.callCount || 0) + 1;
    window.saveData();
    document.getElementById('btn-plus-call').style.display = 'none';
    window.showToast(`Đã +1 lần gọi cho em ${lastPickedStudent.name}!`);
};

window.renderInClassView = function() {
    const listEl = document.getElementById('in-class-student-list');
    if(!listEl) return;
    listEl.innerHTML = '';
    const currentList = appData.classes[appData.settings.currentClass] || [];

    currentList.forEach(st => {
        listEl.innerHTML += `
            <div class="attention-item">
                <div>
                    <strong>${st.name} <span style="font-size:0.75rem; color:var(--primary); font-weight:800;">(Tổ ${st.team || 1})</span></strong>
                    <small style="color:var(--text-muted); display:block;">Gọi: ${st.callCount || 0} • Vi phạm: ${st.violationCount || 0}</small>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn-outline" style="padding: 6px 10px; color: var(--success);" onclick="quickAddPlusPoint(${st.id})">+1 Điểm tốt</button>
                    <button class="btn-outline" style="padding: 6px 10px; color: var(--danger);" onclick="quickAddViolation(${st.id})">+1 Vi phạm</button>
                </div>
            </div>
        `;
    });
};

window.quickAddViolation = function(id) {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const st = currentList.find(x => x.id === id);
    if(st) {
        st.violationCount = (st.violationCount || 0) + 1;
        window.saveData();
        window.showToast(`Đã ghi nhận 1 vi phạm cho em ${st.name}`);
    }
};

window.quickAddPlusPoint = function(id) {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const st = currentList.find(x => x.id === id);
    if(st) {
        st.callCount = (st.callCount || 0) + 1;
        window.saveData();
        window.showToast(`Đã ghi nhận phát biểu cho em ${st.name}`);
    }
};

// ================= CHỨC NĂNG CHIA TỔ CỐ ĐỊNH & NHÓM HOẠT ĐỘNG =================
let currentGroupSubMode = 'teams'; // 'teams' (Tổ cố định) hoặc 'activity' (Nhóm học tập)

window.switchGroupSubMode = function(mode) {
    currentGroupSubMode = mode;
    document.getElementById('tab-btn-teams').classList.toggle('active', mode === 'teams');
    document.getElementById('tab-btn-activity').classList.toggle('active', mode === 'activity');
    document.getElementById('submode-teams-panel').style.display = (mode === 'teams') ? 'block' : 'none';
    document.getElementById('submode-activity-panel').style.display = (mode === 'activity') ? 'block' : 'none';
    window.renderGroupsView();
};

window.toggleGroupInputMode = function() {
    const mode = document.getElementById('group-divide-type').value;
    const label = document.getElementById('group-param-label');
    const input = document.getElementById('group-param-value');
    if (mode === 'byGroupCount') {
        label.innerText = 'Số nhóm cần tạo';
        input.value = 4;
        input.min = 2;
    } else {
        label.innerText = 'Số HS mỗi nhóm';
        input.value = 5;
        input.min = 2;
    }
};

// 1. Chia đều Tổ cố định (1 -> 4) cho cả lớp
window.autoDivideFixedTeams = function() {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    if(currentList.length === 0) return window.showToast("Lớp chưa có học sinh nào!", "error");

    if(!confirm("Chia đều học sinh hiện tại vào 4 Tổ cố định? (Bạn có thể bấm vào từng em để đổi tổ thủ công sau này)")) return;

    currentList.forEach((st, idx) => {
        st.team = (idx % 4) + 1;
    });

    window.saveData();
    window.renderGroupsView();
    window.showToast("🎉 Đã chia đều 4 Tổ cố định cho lớp!");
};

// 2. Chia nhóm hoạt động tức thì (linh hoạt)
window.generateActivityGroups = function() {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    if(currentList.length === 0) return window.showToast("Lớp chưa có học sinh nào!", "error");

    const divideType = document.getElementById('group-divide-type').value;
    const paramVal = parseInt(document.getElementById('group-param-value').value) || 4;
    const balanceMode = document.getElementById('group-balance-mode').value;

    let numGroups = 4;
    if (divideType === 'byGroupCount') {
        numGroups = Math.max(2, Math.min(currentList.length, paramVal));
    } else {
        numGroups = Math.max(2, Math.ceil(currentList.length / paramVal));
    }

    let groups = [];
    for(let i = 1; i <= numGroups; i++) {
        groups.push({ id: i, name: `Nhóm ${i}`, members: [] });
    }

    let stuPool = JSON.parse(JSON.stringify(currentList));

    if (balanceMode === 'balance') {
        // Cân bằng học lực: Xếp theo ĐTB giảm dần rồi phân zic-zac
        stuPool.sort((a, b) => (parseFloat(b.dtb) || 0) - (parseFloat(a.dtb) || 0));
        stuPool.forEach((st, idx) => {
            let cycle = Math.floor(idx / numGroups);
            let rem = idx % numGroups;
            let groupIndex = (cycle % 2 === 0) ? rem : (numGroups - 1 - rem);
            groups[groupIndex].members.push(st);
        });
    } else {
        // Ngẫu nhiên hoàn toàn
        for (let i = stuPool.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [stuPool[i], stuPool[j]] = [stuPool[j], stuPool[i]];
        }
        stuPool.forEach((st, idx) => {
            groups[idx % numGroups].members.push(st);
        });
    }

    if (!appData.activityGroups) appData.activityGroups = {};
    appData.activityGroups[appData.settings.currentClass] = groups;

    window.saveData();
    window.renderGroupsView();
    window.showToast(`🎉 Đã chia thành công ${numGroups} nhóm học tập!`);
};

window.renderGroupsView = function() {
    const container = document.getElementById('groups-container');
    if(!container) return;
    container.innerHTML = '';
    const currentList = appData.classes[appData.settings.currentClass] || [];

    if (currentGroupSubMode === 'teams') {
        // RENDER TỔ CỐ ĐỊNH (Tổ 1 - 4)
        if(currentList.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 10px;">Lớp chưa có học sinh nào. Hãy thêm học sinh trước!</div>`;
            return;
        }

        let teams = { 1: [], 2: [], 3: [], 4: [] };
        currentList.forEach(st => {
            let t = st.team || 1;
            if(!teams[t]) teams[t] = [];
            teams[t].push(st);
        });

        for(let t = 1; t <= 4; t++) {
            let membersHtml = '';
            teams[t].forEach((m, mIdx) => {
                let initials = m.name.split(' ').map(n=>n[0]).slice(-2).join('').toUpperCase();
                membersHtml += `
                    <div class="group-member-row">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); width: 20px;">${mIdx + 1}.</span>
                            <div class="avatar-circle-mini">${initials}</div>
                            <div>
                                <strong style="font-size: 0.9rem; color: var(--text-main); cursor:pointer;" onclick="openStudentProfile(${m.id})">${m.name}</strong>
                                <small style="display: block; color: var(--text-muted); font-size: 0.75rem;">ĐTB: ${m.dtb || '--'} • Lỗi: ${m.violationCount || 0}</small>
                            </div>
                        </div>
                        <select onchange="changeStudentFixedTeam(${m.id}, this.value)" style="padding: 4px 8px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 0.8rem; color: var(--primary); background: white;">
                            <option value="1" ${t===1?'selected':''}>Tổ 1</option>
                            <option value="2" ${t===2?'selected':''}>Tổ 2</option>
                            <option value="3" ${t===3?'selected':''}>Tổ 3</option>
                            <option value="4" ${t===4?'selected':''}>Tổ 4</option>
                        </select>
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="group-card">
                    <div class="group-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="group-badge" style="background: #e0f2fe; color: #0369a1;"><i class="fas fa-flag"></i> Tổ ${t}</span>
                            <small style="color: var(--text-muted); font-weight: 700;">(${teams[t].length} Học sinh)</small>
                        </div>
                    </div>
                    <div class="group-member-list">
                        ${membersHtml || '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px; text-align:center;">Tổ chưa có học sinh</div>'}
                    </div>
                </div>
            `;
        }

    } else {
        // RENDER NHÓM HOẠT ĐỘNG LINH HOẠT
        const groups = (appData.activityGroups && appData.activityGroups[appData.settings.currentClass]) || [];
        if(groups.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 40px 10px; font-size: 0.9rem;">Chưa có nhóm nào. Bấm "Tạo nhóm ngay" để sinh nhóm tự động!</div>`;
            return;
        }

        groups.forEach((grp, gIdx) => {
            let membersHtml = '';
            grp.members.forEach((m, mIdx) => {
                let initials = m.name.split(' ').map(n=>n[0]).slice(-2).join('').toUpperCase();
                membersHtml += `
                    <div class="group-member-row">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); width: 20px;">${mIdx + 1}.</span>
                            <div class="avatar-circle-mini">${initials}</div>
                            <div>
                                <strong style="font-size: 0.9rem; color: var(--text-main);">${m.name}</strong>
                                <small style="display: block; color: var(--text-muted); font-size: 0.75rem;">ĐTB: ${m.dtb || '--'}</small>
                            </div>
                        </div>
                        <button class="btn-icon-mini text-red" title="Chuyển nhóm" onclick="moveMemberOutOfActivityGroup(${gIdx}, ${mIdx})"><i class="fas fa-arrows-alt-h"></i></button>
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="group-card">
                    <div class="group-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="group-badge">${grp.name}</span>
                            <small style="color: var(--text-muted); font-weight: 700;">(${grp.members.length} HS)</small>
                        </div>
                        <button class="btn-outline-action" style="width: 30px; height: 30px;" title="Đổi tên nhóm" onclick="renameActivityGroup(${gIdx})"><i class="fas fa-pen"></i></button>
                    </div>
                    <div class="group-member-list">
                        ${membersHtml || '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px; text-align:center;">Nhóm trống</div>'}
                    </div>
                </div>
            `;
        });
    }
};

window.changeStudentFixedTeam = function(studentId, newTeamVal) {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    const st = currentList.find(x => x.id === studentId);
    if(st) {
        st.team = parseInt(newTeamVal) || 1;
        window.saveData();
        window.showToast(`Đã chuyển em ${st.name} sang Tổ ${st.team}!`);
    }
};

window.renameActivityGroup = function(gIdx) {
    const groups = appData.activityGroups[appData.settings.currentClass];
    if(!groups || !groups[gIdx]) return;
    let newName = prompt("Nhập tên mới cho nhóm:", groups[gIdx].name);
    if(newName && newName.trim()) {
        groups[gIdx].name = newName.trim();
        window.saveData();
        window.renderGroupsView();
        window.showToast("Đã đổi tên nhóm!");
    }
};

window.moveMemberOutOfActivityGroup = function(gIdx, mIdx) {
    const groups = appData.activityGroups[appData.settings.currentClass];
    if(!groups || !groups[gIdx]) return;
    
    let otherGroups = groups.map((g, idx) => `${idx + 1}. ${g.name}`).join('\n');
    let target = prompt(`Chọn số thứ tự nhóm muốn chuyển em này sang:\n${otherGroups}`);
    if(target === null) return;

    let targetIdx = parseInt(target) - 1;
    if (targetIdx >= 0 && targetIdx < groups.length && targetIdx !== gIdx) {
        let [movedStudent] = groups[gIdx].members.splice(mIdx, 1);
        groups[targetIdx].members.push(movedStudent);
        window.saveData();
        window.renderGroupsView();
        window.showToast(`Đã chuyển em ${movedStudent.name} sang ${groups[targetIdx].name}!`);
    } else {
        window.showToast("Số nhóm không hợp lệ!", "error");
    }
};

window.exportFixedTeamsExcel = function() {
    const currentList = appData.classes[appData.settings.currentClass] || [];
    if(currentList.length === 0) return window.showToast("Lớp chưa có dữ liệu!", "error");

    let ws_data = [
        [`DANH SÁCH CÁC TỔ CỐ ĐỊNH - LỚP ${appData.settings.currentClass}`],
        [`Giáo viên: ${appData.settings.teacherName} • Năm học: ${appData.settings.year}`],
        [],
        ["Tổ", "STT", "Mã HS", "Họ và tên", "Ngày sinh", "Điểm TB", "Ghi chú"]
    ];

    for(let t = 1; t <= 4; t++) {
        let teamMembers = currentList.filter(st => (st.team || 1) === t);
        teamMembers.forEach((m, idx) => {
            ws_data.push([`Tổ ${t}`, idx + 1, m.maHs || "", m.name, m.dob || "", m.dtb || "", ""]);
        });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_To");
    XLSX.writeFile(wb, `Danh_Sach_To_${appData.settings.currentClass.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    window.showToast("✅ Đã xuất danh sách Tổ cố định ra Excel!");
};

window.exportActivityGroupsExcel = function() {
    const groups = (appData.activityGroups && appData.activityGroups[appData.settings.currentClass]) || [];
    if(groups.length === 0) return window.showToast("Lớp chưa có nhóm để xuất!", "error");

    let ws_data = [
        [`DANH SÁCH NHÓM HỌC TẬP - LỚP ${appData.settings.currentClass}`],
        [`Môn: ${appData.settings.subject} • Giáo viên: ${appData.settings.teacherName}`],
        [],
        ["Tên Nhóm", "STT", "Họ và tên", "Ngày sinh", "Điểm TB", "Ghi chú"]
    ];

    groups.forEach(g => {
        g.members.forEach((m, idx) => {
            ws_data.push([g.name, idx + 1, m.name, m.dob || "", m.dtb || "", ""]);
        });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Nhom_Hoc_Tap");
    XLSX.writeFile(wb, `Nhom_Hoc_Tap_${appData.settings.currentClass.replace(/[^a-zA-Z0-9]/g, '_')}.xlsx`);
    window.showToast("✅ Đã xuất danh sách Nhóm học tập ra Excel!");
};

// ================= CÀI ĐẶT & BẢO TRÌ DỮ LIỆU =================
window.renderCommentRulesSettings = function() {
    const container = document.getElementById('comment-rules-container');
    if(!container) return;
    container.innerHTML = '';
    const rules = appData.settings.commentRules || defaultCommentRules;

    rules.forEach((r, idx) => {
        container.innerHTML += `
            <div style="display: flex; gap: 8px; align-items: center; background: #f8fafc; padding: 10px; border-radius: 10px; border: 1px solid #e2e8f0;">
                <input type="number" value="${r.min}" step="0.1" style="width: 55px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; text-align: center;" onchange="updateCommentRule(${idx}, 'min', this.value)">
                <span>-</span>
                <input type="number" value="${r.max}" step="0.1" style="width: 55px; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: bold; text-align: center;" onchange="updateCommentRule(${idx}, 'max', this.value)">
                <input type="text" value="${r.text}" style="flex: 1; padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; font-size: 0.85rem;" onchange="updateCommentRule(${idx}, 'text', this.value)">
                <button class="btn-icon" style="width: 32px; height: 32px; color: var(--danger);" onclick="deleteCommentRule(${idx})"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
};

window.updateCommentRule = function(idx, field, val) {
    if (field === 'min' || field === 'max') {
        appData.settings.commentRules[idx][field] = Number(val);
    } else {
        appData.settings.commentRules[idx].text = val.trim();
    }
    window.saveData();
};

window.addNewCommentRule = function() {
    if(!appData.settings.commentRules) appData.settings.commentRules = [];
    appData.settings.commentRules.push({ min: 0, max: 10, text: "Nhận xét mới..." });
    window.saveData();
};

window.deleteCommentRule = function(idx) {
    appData.settings.commentRules.splice(idx, 1);
    window.saveData();
};

window.resetDefaultCommentRules = function() {
    if(confirm("Khôi phục toàn bộ bảng nhận xét mặc định của Bộ GDĐT?")) {
        appData.settings.commentRules = JSON.parse(JSON.stringify(defaultCommentRules));
        window.saveData();
        window.showToast("Đã khôi phục mẫu mặc định!");
    }
};

window.saveTeacherSettings = function() {
    appData.settings.teacherName = document.getElementById('set-teacher-name').value.trim();
    appData.settings.subject = document.getElementById('set-subject-name').value.trim();
    appData.settings.year = document.getElementById('set-school-year').value.trim();
    appData.settings.semester = document.getElementById('set-semester').value;
    window.saveData();
    window.showToast("✅ Đã lưu cấu hình giảng dạy!");
};

window.confirmAddNewStudent = function() {
    const name = document.getElementById('add-stu-name').value.trim();
    if(!name) return window.showToast("Vui lòng nhập tên học sinh!", "error");

    const dob = document.getElementById('add-stu-dob').value.trim();
    const gender = document.getElementById('add-stu-gender').value;
    const team = parseInt(document.getElementById('add-stu-team').value) || 1;

    const currentList = appData.classes[appData.settings.currentClass] || [];
    currentList.push({
        id: Date.now(),
        maHs: "",
        name: name,
        dob: dob,
        gender: gender,
        team: team,
        tx: [],
        gk: "",
        ck: "",
        dtb: "",
        comment: "",
        callCount: 0,
        violationCount: 0
    });

    window.saveData();
    window.closeModal('modal-add-student');
    document.getElementById('add-stu-name').value = '';
    window.showToast(`Đã thêm em ${name}!`);
};

window.backupAppDataJSON = function() {
    let dataStr = JSON.stringify(appData);
    let blob = new Blob([dataStr], {type: "application/json"});
    let url = URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.href = url;
    a.download = `DuLieu_GVBM_${appData.settings.year}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.showToast("Đã tải bản sao lưu dữ liệu!");
};

window.resetData = function() {
    if(confirm("XÓA SẠCH DỮ LIỆU CÁC LỚP? Thao tác này sẽ xóa vĩnh viễn dữ liệu trên máy và trên Đám mây để bạn nhập lại từ đầu.")) {
        appData.classes = {};
        appData.activityGroups = {};
        appData.settings.currentClass = "";
        
        localStorage.setItem('gvbmData_v1', JSON.stringify(appData));
        
        if (currentUser) {
            const docRef = doc(firestoreDb, "DuLieuGVBM", currentUser.uid);
            setDoc(docRef, appData).then(() => {
                window.showToast("Đã dọn dẹp sạch sẽ!", "success");
                setTimeout(() => location.reload(), 1000);
            }).catch(e => {
                console.error("Lỗi dọn dẹp:", e);
                location.reload();
            });
        } else {
            location.reload();
        }
    }
};

window.onload = () => {
    window.initAppUI();
    window.checkAppUpdateAnnouncement();
};

// ==================== CÁC HÀM SỔ BÁO GIẢNG ====================
function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function extractGrade(className) {
    if (!className) return "";
    let str = String(className).trim();
    let match = str.match(/(?:Khối\s*)?([1-9]|1[0-2])/i);
    return match ? match[1] : str.toLowerCase();
}

window.renderSetupData = function() {
    let stp = appData.scheduleSetup;
    if (!stp) { stp = { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] }; appData.scheduleSetup = stp; }
    if (!stp.mathRatios) stp.mathRatios = [];
    if(document.getElementById('setup-week1-date')) document.getElementById('setup-week1-date').value = stp.week1Start || '';
    if(document.getElementById('setup-tkb-count')) document.getElementById('setup-tkb-count').innerText = (stp.tkb || []).length + " bản ghi";
    if(document.getElementById('setup-ppct-count')) document.getElementById('setup-ppct-count').innerText = (stp.ppct || []).length + " bài dạy";
    if(document.getElementById('setup-holidays-count')) document.getElementById('setup-holidays-count').innerText = (stp.holidays || []).length + " sự kiện";
    if (document.getElementById('setup-math-ratio-count')) {
        document.getElementById('setup-math-ratio-count').innerText = stp.mathRatios.length + " cấu hình";
    }

    const tbodyTKB = document.getElementById('tkb-tbody'); 
    if(tbodyTKB) {
        tbodyTKB.innerHTML = '';
        (stp.tkb || []).forEach((t, i) => { 
            tbodyTKB.innerHTML += `<tr><td>${t.dayOfWeek}</td><td>${t.period}</td><td>${t.className}</td><td>${t.subject}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('tkb', ${i})"><i class="fas fa-times"></i></button></td></tr>`; 
        });
    }
    
    const tbodyPPCT = document.getElementById('ppct-tbody'); 
    if(tbodyPPCT) {
        tbodyPPCT.innerHTML = '';
        (stp.ppct || []).forEach((p, i) => { 
            let br = p.branch ? `<span style="background:#e0f2fe; color:#0369a1; padding:2px 6px; border-radius:6px; font-weight:bold;">${p.branch}</span>` : '-';
            tbodyPPCT.innerHTML += `<tr><td>${p.className}</td><td>${p.subject}</td><td>${br}</td><td>${p.ppct}</td><td>${p.content.substring(0,20)}...</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('ppct', ${i})"><i class="fas fa-times"></i></button></td></tr>`; 
        });
    }

    const tbodyHol = document.getElementById('hol-tbody'); 
    if(tbodyHol) {
        tbodyHol.innerHTML = '';
        (stp.holidays || []).forEach((h, i) => { 
            tbodyHol.innerHTML += `<tr><td>${h.start}</td><td>${h.end}</td><td>${h.name}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('holidays', ${i})"><i class="fas fa-times"></i></button></td></tr>`; 
        });
    }

    const tbodyMath = document.getElementById('math-ratio-tbody');
    if (tbodyMath) {
        tbodyMath.innerHTML = '';
        stp.mathRatios.forEach((m, i) => {
            tbodyMath.innerHTML += `<tr><td><b>Khối ${m.grade}</b></td><td>Tuần ${m.fromWeek} - ${m.toWeek}</td><td><b>${m.dai} Đại - ${m.hinh} Hình</b></td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('mathRatios', ${i})"><i class="fas fa-times"></i></button></td></tr>`;
        });
    }
};

window.delSetupData = function(type, index) { 
    appData.scheduleSetup[type].splice(index, 1); 
    window.saveData(); 
    window.renderSetupData(); 
};

window.clearAllSetupData = function(type) {
    let typeName = (type === 'tkb') ? 'Thời khóa biểu' : ((type === 'ppct') ? 'Phân phối chương trình' : ((type === 'holidays') ? 'Lịch nghỉ lễ' : 'Cấu hình tỉ lệ'));
    let currentCount = (appData.scheduleSetup[type] || []).length;
    if (currentCount === 0) {
        return window.showToast(`Danh sách ${typeName} đang trống!`, "error");
    }
    if (confirm(`⚠️ Bạn có chắc chắn muốn XÓA TẤT CẢ ${currentCount} dòng dữ liệu của ${typeName} không? (Thao tác này không thể hoàn tác)`)) {
        appData.scheduleSetup[type] = [];
        window.saveData();
        window.renderSetupData();
        window.showToast(`✅ Đã xóa toàn bộ ${typeName}!`, "success");
    }
};

window.addTKB = function() {
    let d = document.getElementById('add-tkb-day').value, p = document.getElementById('add-tkb-period').value, c = document.getElementById('add-tkb-class').value, s = document.getElementById('add-tkb-subject').value;
    if(!d || !p || !c || !s) return window.showToast("Nhập đủ thông tin!", "error");
    appData.scheduleSetup.tkb.push({ dayOfWeek: parseInt(d), period: parseInt(p), className: c.trim(), subject: s.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm TKB!");
};

window.addPPCT = function() {
    let c = document.getElementById('add-ppct-class').value, s = document.getElementById('add-ppct-subject').value, p = document.getElementById('add-ppct-period').value, n = document.getElementById('add-ppct-content').value;
    let br = document.getElementById('add-ppct-branch') ? document.getElementById('add-ppct-branch').value.trim() : '';
    if(!c || !s || !p || !n) return window.showToast("Nhập đủ thông tin!", "error");
    
    if(!br && s.toLowerCase().includes('toán')) {
        let lowN = n.toLowerCase();
        if(lowN.includes('hình') || lowN.includes('góc') || lowN.includes('tam giác') || lowN.includes('đo lường')) br = 'Hình';
        else br = 'Đại';
    }
    
    appData.scheduleSetup.ppct.push({ className: c.trim(), subject: s.trim(), branch: br, ppct: parseInt(p), content: n.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm PPCT!");
};

window.addMathRatio = function() {
    let grade = document.getElementById('add-math-grade').value.trim();
    let fw = parseInt(document.getElementById('add-math-from-week').value);
    let tw = parseInt(document.getElementById('add-math-to-week').value);
    let dai = parseInt(document.getElementById('add-math-dai').value);
    let hinh = parseInt(document.getElementById('add-math-hinh').value);
    
    if(!grade || isNaN(fw) || isNaN(tw) || isNaN(dai) || isNaN(hinh)) {
        return window.showToast("Vui lòng điền đủ thông tin cấu hình!", "error");
    }
    if(fw > tw || fw < 1 || tw > 35) {
        return window.showToast("Khoảng tuần không hợp lệ (từ 1 đến 35)!", "error");
    }
    
    grade = extractGrade(grade);
    if (!appData.scheduleSetup.mathRatios) appData.scheduleSetup.mathRatios = [];
    
    appData.scheduleSetup.mathRatios.push({ grade: grade, fromWeek: fw, toWeek: tw, dai: dai, hinh: hinh });
    appData.scheduleSetup.mathRatios.sort((a,b) => (a.grade === b.grade) ? (a.fromWeek - b.fromWeek) : a.grade.localeCompare(b.grade));
    
    window.saveData(); 
    window.renderSetupData(); 
    window.showToast(`Đã thêm cấu hình Khối ${grade} (Tuần ${fw}-${tw}: ${dai} Đại - ${hinh} Hình)!`);
};

window.addHoliday = function() {
    let s = document.getElementById('add-hol-start').value, e = document.getElementById('add-hol-end').value, n = document.getElementById('add-hol-name').value;
    if(!s || !e || !n) return window.showToast("Nhập đủ thông tin!", "error");
    appData.scheduleSetup.holidays.push({ start: s, end: e, name: n.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm ngày nghỉ!");
};

let currentImportType = '';
window.triggerImport = function(type) { currentImportType = type; document.getElementById('general-import-file').click(); };

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
                            cells.forEach((txt, i) => { 
                                let low = txt.toLowerCase(); 
                                if(low === 'tiết' || low === 'tiết ppct' || low === 'tiết học') tietIdx = i; 
                                else if(low.includes('nội dung') || low.includes('tên bài') || low.includes('bài dạy')) ndIdx = i; 
                            });
                            if(tietIdx === -1 && cells.length >= 2) { 
                                if(cells[0].toLowerCase().includes('tiết')) { tietIdx = 0; ndIdx = 1; } 
                                else if(cells[1].toLowerCase().includes('tiết')) { tietIdx = 1; ndIdx = 2; } 
                            }
                        } else {
                            if (cells.length > Math.max(tietIdx, ndIdx) && ndIdx !== -1) {
                                let tiet = parseInt(cells[tietIdx]); let nd = cells[ndIdx];
                                if(!isNaN(tiet) && nd) { 
                                    appData.scheduleSetup.ppct.push({ className: targetClass, subject: targetSubject, ppct: tiet, content: nd }); 
                                    count++; 
                                }
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
                        let p = parseInt(r['Tiết'] || r['Tiet']); 
                        let n = String(r['Nội dung'] || r['Noi dung'] || r['Tên bài'] || r['Ten bai'] || r['Chủ đề'] || r['Tên bài học / Chuyên đề'] || '');
                        let subj = String(r['Môn'] || r['Mon'] || targetSubject);
                        let br = String(r['Phân môn'] || r['Phan mon'] || r['Nhánh'] || r['Phân nhánh'] || '').trim();
                        
                        if(!br && subj.toLowerCase().includes('toán')) {
                            let lowN = n.toLowerCase();
                            if(lowN.includes('hình') || lowN.includes('góc') || lowN.includes('tam giác') || lowN.includes('đo lường') || lowN.includes('mặt phẳng')) br = 'Hình';
                            else br = 'Đại';
                        }
                        
                        if(!isNaN(p) && n) { 
                            appData.scheduleSetup.ppct.push({ 
                                className: String(r['Lớp'] || r['Lop'] || r['Khối'] || r['Khoi'] || targetClass), 
                                subject: subj, 
                                branch: br,
                                ppct: p, 
                                content: n 
                            }); 
                            count++; 
                        }
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
};

window.checkIsHoliday = function(dateStr) {
    let d = new Date(dateStr);
    for(let h of (appData.scheduleSetup.holidays || [])) { if(d >= new Date(h.start) && d <= new Date(h.end)) return h; } return null;
};

function getMathBranchForPeriod(grade, week, mathIndexInWeek) {
    let ratios = appData.scheduleSetup.mathRatios || [];
    let config = ratios.find(r => r.grade === grade && week >= r.fromWeek && week <= r.toWeek);
    if (!config) {
        config = ratios.find(r => week >= r.fromWeek && week <= r.toWeek);
    }
    let numDai = config ? config.dai : 3;
    return (mathIndexInWeek < numDai) ? 'Đại' : 'Hình';
}

window.generateAutoSchedule = function() {
    let startDate = document.getElementById('setup-week1-date').value;
    if(!startDate) return window.showToast("Vui lòng thiết lập Ngày bắt đầu Tuần 1!", "error");
    if((appData.scheduleRecords || []).length > 0) { 
        if(!confirm("CẢNH BÁO: Thao tác này sẽ TẠO LẠI TOÀN BỘ SỔ BÁO GIẢNG và ghi đè các tiết chưa hoàn thành. Các tiết Đã Dạy sẽ được bảo lưu. Bạn chắc chắn chứ?")) return; 
    }

    appData.scheduleSetup.week1Start = startDate; 
    let records = []; 

    let ppctMaster = {}; 
    (appData.scheduleSetup.ppct || []).slice().sort((a,b) => a.ppct - b.ppct).forEach(p => { 
        let grade = extractGrade(p.className);
        let subj = p.subject.trim().toLowerCase();
        let branch = (p.branch || '').trim();
        
        let key = branch ? `${subj}-${grade}-${branch}` : `${subj}-${grade}`;
        if(!ppctMaster[key]) ppctMaster[key] = []; 
        ppctMaster[key].push({...p}); 
    });

    let classQueues = {};
    let classes = [...new Set((appData.scheduleSetup.tkb || []).map(t => t.className.trim()))];
    let subjects = [...new Set((appData.scheduleSetup.tkb || []).map(t => t.subject.trim()))];

    classes.forEach(cName => {
        let grade = extractGrade(cName);
        subjects.forEach(sName => {
            let sLower = sName.toLowerCase();
            let cLower = cName.toLowerCase();
            if (sLower.includes('toán')) {
                let kDai = `${sLower}-${cLower}-Đại`;
                let kHinh = `${sLower}-${cLower}-Hình`;
                let mDai = `${sLower}-${grade}-Đại`;
                let mHinh = `${sLower}-${grade}-Hình`;

                classQueues[kDai] = ppctMaster[mDai] ? JSON.parse(JSON.stringify(ppctMaster[mDai])) : [];
                classQueues[kHinh] = ppctMaster[mHinh] ? JSON.parse(JSON.stringify(ppctMaster[mHinh])) : [];
            } else {
                let kGen = `${sLower}-${cLower}`;
                let mGen = `${sLower}-${grade}`;
                classQueues[kGen] = ppctMaster[mGen] ? JSON.parse(JSON.stringify(ppctMaster[mGen])) : [];
            }
        });
    });

    let currentDate = new Date(startDate);
    for(let w = 1; w <= 35; w++) {
        let mathCountInWeek = {};

        for(let d = 2; d <= 7; d++) {
            let dateStr = currentDate.toISOString().split('T')[0]; 
            let holiday = window.checkIsHoliday(dateStr);
            let dayTKB = (appData.scheduleSetup.tkb || []).filter(t => t.dayOfWeek == d); 
            dayTKB.sort((a,b) => a.period - b.period);

            dayTKB.forEach(tItem => {
                let sLower = tItem.subject.trim().toLowerCase();
                let cLower = tItem.className.trim().toLowerCase();
                let grade = extractGrade(tItem.className);
                let isMath = sLower.includes('toán');
                let targetBranch = '';

                if (isMath) {
                    if (mathCountInWeek[cLower] === undefined) mathCountInWeek[cLower] = 0;
                    targetBranch = getMathBranchForPeriod(grade, w, mathCountInWeek[cLower]);
                }

                let qKey = (isMath && targetBranch) ? `${sLower}-${cLower}-${targetBranch}` : `${sLower}-${cLower}`;
                let oldR = (appData.scheduleRecords || []).find(x => x.date === dateStr && x.period === tItem.period && x.className === tItem.className);
                
                if(oldR && (oldR.status === 'completed' || oldR.note)) {
                    records.push(oldR);
                    if(oldR.status === 'completed' && classQueues[qKey] && classQueues[qKey].length > 0 && classQueues[qKey][0].ppct == oldR.ppct) { 
                        classQueues[qKey].shift(); 
                    }
                    if (isMath) mathCountInWeek[cLower]++;
                    return; 
                }
                
                if (holiday) { 
                    records.push({ 
                        id: Date.now() + Math.random(), 
                        week: w, date: dateStr, dayOfWeek: d, 
                        period: tItem.period, className: tItem.className, subject: tItem.subject, 
                        branch: targetBranch, ppct: "-", content: "NGHỈ LỄ - " + holiday.name, status: "off" 
                    }); 
                } else {
                    if (classQueues[qKey] && classQueues[qKey].length > 0) { 
                        let lesson = classQueues[qKey].shift(); 
                        records.push({ 
                            id: Date.now() + Math.random(), 
                            week: w, date: dateStr, dayOfWeek: d, 
                            period: tItem.period, className: tItem.className, subject: tItem.subject, 
                            branch: targetBranch,
                            ppct: lesson.ppct, 
                            content: (targetBranch ? `[${targetBranch}] ` : '') + lesson.content, 
                            status: "scheduled" 
                        }); 
                    } else { 
                        records.push({ 
                            id: Date.now() + Math.random(), 
                            week: w, date: dateStr, dayOfWeek: d, 
                            period: tItem.period, className: tItem.className, subject: tItem.subject, 
                            branch: targetBranch,
                            ppct: "-", content: "Ôn tập / Tự chọn (Hết PPCT)", status: "scheduled" 
                        }); 
                    }
                    if (isMath) mathCountInWeek[cLower]++;
                }
            });
            currentDate.setDate(currentDate.getDate() + 1); 
        }
        currentDate.setDate(currentDate.getDate() + 1); 
    }
    appData.scheduleRecords = records; 
    window.saveData(); 
    window.closeModal('modal-setup-lesson-log'); 
    window.initLessonLogView(); 
    window.showToast("🎉 Đã tự động sinh Sổ Báo Giảng chuẩn phân môn Đại & Hình!");
};

window.initLessonLogView = function() {
    const sel = document.getElementById('ll-week-select'); 
    if(!sel) return;
    sel.innerHTML = '';
    let maxWeek = 1;
    (appData.scheduleRecords || []).forEach(r => { if(r.week > maxWeek) maxWeek = r.week; });
    for(let i=1; i<=maxWeek; i++) { sel.innerHTML += `<option value="${i}">Sổ báo giảng - Tuần ${i}</option>`; }
    let today = getTodayStr(); 
    let todayRecord = (appData.scheduleRecords || []).find(r => r.date === today);
    if(todayRecord) sel.value = todayRecord.week;
    window.renderSchedule();
};

window.renderSchedule = function() {
    const sel = document.getElementById('ll-week-select');
    if (!sel) return;
    const w = parseInt(sel.value) || 1;
    const list = document.getElementById('ll-schedule-list'); 
    if(!list) return;
    list.innerHTML = '';
    let records = (appData.scheduleRecords || []).filter(r => r.week == w);
    
    let total = records.filter(r => r.status !== 'off').length;
    let completed = records.filter(r => r.status === 'completed').length;
    let offCount = records.filter(r => r.status === 'off').length;
    const statsContainer = document.getElementById('ll-stats-container');
    if(statsContainer) {
        statsContainer.innerHTML = `
            <span class="text-blue">Tổng: ${total} tiết</span>
            <span class="text-green">Đã xong: ${completed}</span>
            <span class="text-orange">Còn: ${total - completed}</span>
            ${offCount > 0 ? `<span class="text-red">Nghỉ: ${offCount}</span>` : ''}
        `;
    }

    if(records.length === 0) { list.innerHTML = '<div style="text-align:center; padding:30px 10px; color:var(--text-muted); font-size:0.9rem;">Chưa có dữ liệu tuần này. Vui lòng bấm Cấu hình (bánh răng) và Tự động tạo sổ!</div>'; return; }

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
};

window.toggleScheduleStatus = function(id) {
    let r = (appData.scheduleRecords || []).find(x => x.id == id);
    if(r) { r.status = (r.status === 'completed') ? 'scheduled' : 'completed'; window.saveData(); window.renderSchedule(); }
};

window.openAdjustSchedule = function(id) {
    let r = (appData.scheduleRecords || []).find(x => x.id == id); if(!r) return;
    document.getElementById('adj-sched-id').value = r.id; 
    document.getElementById('adj-sched-info').innerHTML = `Đang chỉnh sửa: <b>${r.subject} ${r.className} (Tiết ${r.period})</b> - PPCT: ${r.ppct}`; 
    document.getElementById('adj-sched-date').value = r.date; 
    document.getElementById('adj-sched-period').value = r.period; 
    document.getElementById('adj-sched-note').value = r.note || '';
    window.openModal('modal-adjust-schedule');
};

window.saveAdjustedSchedule = function() {
    let id = document.getElementById('adj-sched-id').value; 
    let r = (appData.scheduleRecords || []).find(x => x.id == id);
    if(r) {
        let nDate = document.getElementById('adj-sched-date').value; 
        let nPeriod = document.getElementById('adj-sched-period').value;
        if(!nDate || !nPeriod) return window.showToast("Nhập đủ ngày và tiết!", "error");
        let dObj = new Date(nDate); let dow = dObj.getDay() === 0 ? 8 : dObj.getDay() + 1; 
        if(nDate !== r.date) { r.note = `${document.getElementById('adj-sched-note').value || 'Dạy bù'} (Dời từ ${new Date(r.date).toLocaleDateString('vi-VN')})`; r.date = nDate; r.dayOfWeek = dow; }
        else { r.note = document.getElementById('adj-sched-note').value; }
        r.period = parseInt(nPeriod);
        window.saveData(); window.closeModal('modal-adjust-schedule'); window.renderSchedule(); window.showToast("Đã cập nhật lịch dạy!");
    }
};

window.exportScheduleExcel = function() {
    const sel = document.getElementById('ll-week-select');
    if(!sel) return;
    const w = parseInt(sel.value) || 1;
    let records = (appData.scheduleRecords || []).filter(r => r.week == w);
    if(records.length === 0) return window.showToast("Tuần này trống!", "error");
    let ws_data = [["Tuần", "Ngày", "Thứ", "Tiết", "Lớp", "Môn", "PPCT", "Nội dung", "Trạng thái", "Ghi chú"]];
    records.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(r => {
        let st = r.status==='off'?'Nghỉ':(r.status==='completed'?'Đã xong':'Chưa dạy');
        ws_data.push([r.week, new Date(r.date).toLocaleDateString('vi-VN'), r.dayOfWeek, r.period, r.className, r.subject, r.ppct, r.content, st, r.note||""]);
    });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "SoBaoGiang");
    XLSX.writeFile(wb, `So_Bao_Giang_Tuan_${w}.xlsx`); window.showToast("Đã xuất Excel Sổ báo giảng!");
};

window.downloadTemplateTKB = function() {
    const data = [
        ["Thứ", "Tiết", "Lớp", "Môn"],
        [2, 1, "6A", "Toán"],
        [2, 2, "6A", "Toán"],
        ["(Chú ý: Xóa 2 dòng mẫu này đi và nhập dữ liệu thật của bạn vào. KHÔNG sửa tên cột ở hàng 1)", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch: 10}, {wch: 10}, {wch: 15}, {wch: 20}];
    XLSX.utils.book_append_sheet(wb, ws, "TKB_Mau");
    XLSX.writeFile(wb, "Mau_Thoi_Khoa_Bieu.xlsx");
    window.showToast("Đã tải xuống File Mẫu TKB!", "success");
};

window.downloadTemplatePPCT = function() {
    const data = [
        ["Khối", "Môn", "Phân môn", "Tiết", "Tên bài học / Chuyên đề", "Số tiết", "Thiết bị dạy học", "Địa điểm"],
        ["6", "Toán", "Đại", 1, "Bài 1: Tập hợp", 1, "Slide bài giảng, Máy chiếu", "Lớp học"],
        ["6", "Toán", "Đại", 2, "Bài 2: Tập hợp các số tự nhiên", 1, "Trò chơi Quizizz", "Lớp học"],
        ["6", "Toán", "Hình", 1, "Bài 1: Tam giác đều, hình vuông, lục giác đều", 1, "Mô hình hình học", "Lớp học"],
        ["(Chú ý: Cột Phân môn dành cho môn Toán điền Đại hoặc Hình. Xóa các dòng mẫu này đi và dán PPCT của bạn vào. KHÔNG sửa tên cột ở hàng 1)", "", "", "", "", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch: 10}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 25}, {wch: 15}];
    XLSX.utils.book_append_sheet(wb, ws, "PPCT_Mau");
    XLSX.writeFile(wb, "Mau_Phan_Phoi_CT.xlsx");
    window.showToast("Đã tải xuống File Mẫu PPCT chuẩn phân môn!", "success");
};

// ==================== CẢNH BÁO CẬP NHẬT PHIÊN BẢN MỚI ====================
const CURRENT_APP_VERSION = 'v4.2_gvbm_lesson_log_and_groups';

window.checkAppUpdateAnnouncement = function() {
    let lastSeenVersion = localStorage.getItem('gvbm_seen_version');
    if (lastSeenVersion !== CURRENT_APP_VERSION) {
        setTimeout(() => {
            if (document.getElementById('modal-update-announcement')) {
                window.openModal('modal-update-announcement');
            }
        }, 1200);
    }
};

window.dismissUpdateAnnouncement = function() {
    localStorage.setItem('gvbm_seen_version', CURRENT_APP_VERSION);
    window.closeModal('modal-update-announcement');
};