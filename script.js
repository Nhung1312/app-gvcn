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

// ================= HỆ THỐNG PHÂN QUYỀN CÁN BỘ LỚP (RBAC) =================
// 4 Vai trò: 'teacher' (Giáo viên), 'class_leader' (Lớp trưởng), 'class_vice' (Lớp phó), 'group_leader' (Tổ trưởng)
// 'none': Học sinh chưa được cấp quyền
window.authRole = {
    role: 'teacher',
    email: '',
    studentId: null,
    studentName: '',
    fixedGroup: null,
    isTestRole: false
};

window.isTeacher = function() {
    return window.authRole.role === 'teacher';
};

window.isClassLeader = function() {
    return window.authRole.role === 'class_leader';
};

window.isClassVice = function() {
    return window.authRole.role === 'class_vice';
};

window.isGroupLeader = function(targetGroupId = null) {
    if (window.authRole.role !== 'group_leader') return false;
    if (targetGroupId !== null && targetGroupId !== undefined) {
        return String(window.authRole.fixedGroup) === String(targetGroupId);
    }
    return true;
};

window.hasPermission = function(action, target = null) {
    const role = window.authRole.role;
    if (role === 'teacher') return true;
    if (role === 'none') return false;

    // Các tác vụ CHỈ DÀNH RIÊNG CHO GIÁO VIÊN CHỦ NHIỆM
    const teacherOnlyActions = [
        'manage_permissions',
        'assign_role',
        'revoke_role',
        'edit_settings',
        'edit_ppct',
        'edit_tkb',
        'edit_holidays',
        'delete_student',
        'add_student',
        'edit_student_profile',
        'manage_groups',
        'manage_tags',
        'system_config',
        'import_data',
        'export_excel'
    ];
    if (teacherOnlyActions.includes(action)) return false;

    // Tác vụ Điểm danh và Nề nếp
    if (action === 'attendance:mark' || action === 'behavior:record') {
        if (role === 'class_leader' || role === 'class_vice') {
            return true; // Lớp trưởng và Lớp phó được thao tác toàn lớp
        }
        if (role === 'group_leader') {
            if (!target) return false;
            let stu = typeof target === 'object' ? target : (appData.students || []).find(s => s.id == target);
            if (!stu) return false;
            // Chỉ thao tác trên học sinh cùng tổ cố định với Tổ trưởng
            return String(stu.fixedGroup) === String(window.authRole.fixedGroup);
        }
        return false;
    }

    if (action === 'attendance:save') {
        return role === 'class_leader' || role === 'class_vice' || role === 'group_leader';
    }

    if (action === 'view_students') {
        return true;
    }

    return false;
};

window.resolveUserRole = function(user = currentUser) {
    if (window.authRole && window.authRole.isTestRole) {
        window.updateRoleUI();
        return;
    }

    if (!user) {
        // Chế độ Khách / Cục bộ: Giữ quyền Giáo viên để không gián đoạn
        window.authRole = {
            role: 'teacher',
            email: 'giaovien@gvcn.local',
            studentId: null,
            studentName: (appData.settings && appData.settings.teacherName) ? appData.settings.teacherName : 'Giáo viên',
            fixedGroup: null,
            isTestRole: false
        };
        window.updateRoleUI();
        return;
    }

    const email = (user.email || '').toLowerCase().trim();

    // 1. Nếu chưa lưu email giáo viên, lưu email đầu tiên đăng nhập làm Giáo viên
    if (!appData.teacherEmail) {
        appData.teacherEmail = email;
        appData.teacherUid = user.uid;
        window.saveData();
    }

    // 2. Nếu là Giáo viên
    if (appData.teacherEmail && appData.teacherEmail.toLowerCase() === email) {
        window.authRole = {
            role: 'teacher',
            email: email,
            studentId: null,
            studentName: (appData.settings && appData.settings.teacherName) ? appData.settings.teacherName : 'Giáo viên',
            fixedGroup: null,
            isTestRole: false
        };
        window.updateRoleUI();
        return;
    }

    // 3. Kiểm tra xem có phải học sinh được cấp quyền cán bộ lớp không
    const assignedStu = (appData.students || []).find(s => 
        s.accountEmail && s.accountEmail.toLowerCase().trim() === email
    );

    if (assignedStu && assignedStu.accountRole && assignedStu.accountRole !== 'none') {
        window.authRole = {
            role: assignedStu.accountRole,
            email: email,
            studentId: assignedStu.id,
            studentName: assignedStu.name,
            fixedGroup: assignedStu.fixedGroup || null,
            isTestRole: false
        };
        window.updateRoleUI();
        return;
    }

    // 4. Tài khoản bình thường chưa được cấp quyền
    window.authRole = {
        role: 'none',
        email: email,
        studentId: null,
        studentName: user.displayName || email.split('@')[0],
        fixedGroup: null,
        isTestRole: false
    };
    window.updateRoleUI();
};

window.updateRoleUI = function() {
    const roleBadge = document.getElementById('user-role-badge');
    const teacherNameEl = document.getElementById('dash-teacher');
    
    let badgeLabel = "Giáo viên";
    let badgeBg = "#e0e7ff";
    let badgeColor = "#4338ca";
    let badgeBorder = "#c7d2fe";
    let iconClass = "fa-user-shield";
    let displayName = (appData.settings && appData.settings.teacherName) ? appData.settings.teacherName : "Cô/Thầy";

    if (window.authRole.role === 'teacher') {
        badgeLabel = "Giáo viên";
        badgeBg = "#e0e7ff";
        badgeColor = "#4338ca";
        badgeBorder = "#c7d2fe";
        iconClass = "fa-user-shield";
        displayName = (appData.settings && appData.settings.teacherName) ? appData.settings.teacherName : "Cô/Thầy";
    } else if (window.authRole.role === 'class_leader') {
        badgeLabel = "Lớp trưởng";
        badgeBg = "#dcfce7";
        badgeColor = "#15803d";
        badgeBorder = "#bbf7d0";
        iconClass = "fa-star";
        displayName = window.authRole.studentName || "Lớp trưởng";
    } else if (window.authRole.role === 'class_vice') {
        badgeLabel = "Lớp phó";
        badgeBg = "#e0f2fe";
        badgeColor = "#0369a1";
        badgeBorder = "#bae6fd";
        iconClass = "fa-medal";
        displayName = window.authRole.studentName || "Lớp phó";
    } else if (window.authRole.role === 'group_leader') {
        badgeLabel = `Tổ trưởng – Tổ ${window.authRole.fixedGroup || 1}`;
        badgeBg = "#fef3c7";
        badgeColor = "#b45309";
        badgeBorder = "#fde68a";
        iconClass = "fa-users";
        displayName = window.authRole.studentName || `Tổ trưởng Tổ ${window.authRole.fixedGroup || 1}`;
    } else if (window.authRole.role === 'none') {
        badgeLabel = "Chưa cấp quyền";
        badgeBg = "#f1f5f9";
        badgeColor = "#64748b";
        badgeBorder = "#cbd5e1";
        iconClass = "fa-ban";
        displayName = window.authRole.studentName || "Học sinh";
    }

    if (roleBadge) {
        roleBadge.style.background = badgeBg;
        roleBadge.style.color = badgeColor;
        roleBadge.style.borderColor = badgeBorder;
        roleBadge.innerHTML = `<i class="fas ${iconClass}"></i> <span id="user-role-text">${badgeLabel}</span>`;
    }
    if (teacherNameEl) {
        teacherNameEl.innerText = displayName;
    }
};

window.switchTestRole = function(testRole, targetGroup = 1) {
    if (testRole === 'teacher') {
        window.authRole = {
            role: 'teacher',
            email: currentUser ? currentUser.email : 'giaovien@gvcn.local',
            studentId: null,
            studentName: (appData.settings && appData.settings.teacherName) ? appData.settings.teacherName : 'Giáo viên',
            fixedGroup: null,
            isTestRole: false
        };
        window.showToast("Đã chuyển vai trò: GIÁO VIÊN (Toàn quyền)");
    } else if (testRole === 'class_leader') {
        const sampleStu = (appData.students || []).find(s => s.accountRole === 'class_leader') || (appData.students && appData.students[0]);
        window.authRole = {
            role: 'class_leader',
            email: sampleStu ? (sampleStu.accountEmail || 'lop_truong@lop.edu') : 'lop_truong@lop.edu',
            studentId: sampleStu ? sampleStu.id : 99991,
            studentName: sampleStu ? sampleStu.name : 'Lớp trưởng (Xem thử)',
            fixedGroup: sampleStu ? sampleStu.fixedGroup : 1,
            isTestRole: true
        };
        window.showToast("Đã chuyển vai trò: LỚP TRƯỞNG (Thao tác toàn lớp, không sửa hệ thống)");
    } else if (testRole === 'class_vice') {
        const sampleStu = (appData.students || []).find(s => s.accountRole === 'class_vice') || (appData.students && appData.students[1]);
        window.authRole = {
            role: 'class_vice',
            email: sampleStu ? (sampleStu.accountEmail || 'lop_pho@lop.edu') : 'lop_pho@lop.edu',
            studentId: sampleStu ? sampleStu.id : 99992,
            studentName: sampleStu ? sampleStu.name : 'Lớp phó (Xem thử)',
            fixedGroup: sampleStu ? sampleStu.fixedGroup : 1,
            isTestRole: true
        };
        window.showToast("Đã chuyển vai trò: LỚP PHÓ (Thao tác toàn lớp, không sửa hệ thống)");
    } else if (testRole === 'group_leader') {
        const grpId = parseInt(targetGroup) || 1;
        const sampleStu = (appData.students || []).find(s => s.fixedGroup == grpId && s.accountRole === 'group_leader') || 
                          (appData.students || []).find(s => s.fixedGroup == grpId) || 
                          (appData.students && appData.students[0]);
        window.authRole = {
            role: 'group_leader',
            email: sampleStu ? (sampleStu.accountEmail || `to_truong_t${grpId}@lop.edu`) : `to_truong_t${grpId}@lop.edu`,
            studentId: sampleStu ? sampleStu.id : 99993,
            studentName: sampleStu ? sampleStu.name : `Tổ trưởng Tổ ${grpId}`,
            fixedGroup: grpId,
            isTestRole: true
        };
        window.showToast(`Đã chuyển vai trò: TỔ TRƯỞNG (Chỉ thao tác thành viên Tổ ${grpId})`);
    } else if (testRole === 'none') {
        window.authRole = {
            role: 'none',
            email: 'chua_cap_quyen@hocsinh.edu',
            studentId: null,
            studentName: 'Học sinh chưa cấp quyền',
            fixedGroup: null,
            isTestRole: true
        };
        window.showToast("Đã chuyển vai trò: CHƯA CẤP QUYỀN (Không có quyền thao tác)");
    }
    window.updateRoleUI();
    window.renderStudents();
    window.renderAttendance();
    window.renderDisciplineStudents();
};

const loginScreen = document.getElementById('login-screen');
const btnLogin = document.getElementById('btn-login');

window.continueAsGuest = function() {
    localStorage.setItem('gvcn_guest_mode', 'true');
    if (loginScreen) loginScreen.style.display = 'none';
};

if(btnLogin) {
    btnLogin.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch((error) => {
            console.warn("Lỗi đăng nhập:", error);
            if (window.showToast) {
                window.showToast("Lỗi đăng nhập: " + (error.code || error.message), "error");
            } else {
                alert("Lỗi đăng nhập: " + error.message);
            }
        });
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
                
                // TÍNH SỐ NGÀY CÒN LẠI
                const timeDiff = ngayHetHan.getTime() - ngayHienTai.getTime();
                const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

                if (daysLeft <= 0) {
                    // Đã hết hạn -> Khóa màn hình
                    hasAccess = false;
                    document.getElementById('man-hinh-thu-phi').style.display = 'block';
                    let emailElements = document.getElementsByClassName('email-user');
                    for (let i = 0; i < emailElements.length; i++) emailElements[i].innerText = user.email.split('@')[0];
                } else if (daysLeft <= 5) {
                    // CÒN 5 NGÀY HOẶC ÍT HƠN -> HIỆN BANNER CẢNH BÁO
                    const banner = document.getElementById('trial-warning-banner');
                    if (banner) {
                        banner.style.display = 'flex';
                        document.getElementById('trial-days-left').innerText = daysLeft;
                        // Điền sẵn cú pháp chuyển khoản vào Modal
                        document.getElementById('upgrade-email-prefix').innerText = user.email.split('@')[0];
                    }
                }
            }
        } catch (error) { console.log("Lỗi kiểm tra bản quyền:", error); }

        if (hasAccess) {
            try {
                // Kiểm tra xem đây có phải tài khoản cán bộ lớp được giáo viên ủy quyền không
                let targetTeacherUid = user.uid;
                const cleanEmail = (user.email || '').toLowerCase().trim();
                try {
                    const officerSnap = await getDoc(doc(firestoreDb, "CanBoLop", cleanEmail));
                    if (officerSnap.exists()) {
                        const offData = officerSnap.data();
                        if (offData.teacherUid) {
                            targetTeacherUid = offData.teacherUid;
                        }
                    }
                } catch(e) {}

                const docRef = doc(firestoreDb, "DuLieuGVCN", targetTeacherUid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const cloudData = docSnap.data();
                    const localUpdated = (appData && appData.lastUpdated) ? appData.lastUpdated : 0;
                    const cloudUpdated = cloudData.lastUpdated || 0;

                    // Chỉ ghi đè dữ liệu thiết bị nếu dữ liệu đám mây thực sự mới hơn
                    if (cloudUpdated >= localUpdated) {
                        appData = {
                            ...cloudData,
                            settings: { ...defaultSettings, ...(cloudData.settings || {}) }
                        };
                        localStorage.setItem('gvcnData_v4', JSON.stringify(appData));
                    } else {
                        console.log("☁️ Dữ liệu thiết bị mới hơn đám mây, tiến hành đồng bộ lên mây...");
                        await setDoc(docRef, appData);
                    }
                } else {
                    await setDoc(docRef, appData); 
                }
            } catch(e) {
                console.warn("Lỗi tải mây:", e);
            }
            window.resolveUserRole(user);
            window.updateDashboardInfo(); 
            window.renderStudents(); 
            window.loadSettings(); 
            window.renderKanban(); 
            window.renderDocs(); 
            window.renderSetupData();
        }
    } else {
        currentUser = null;
        const isGuest = localStorage.getItem('gvcn_guest_mode') === 'true';
        if(loginScreen) loginScreen.style.display = isGuest ? 'none' : 'flex';
        window.resolveUserRole(null);
    }
});

window.logoutApp = function() {
    if(confirm("Bạn có chắc chắn muốn đăng xuất khỏi thiết bị này?")) {
        localStorage.removeItem('gvcn_guest_mode');
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
const defaultFixedGroups = [
    { id: 1, name: "Tổ 1", leaderId: null, viceLeaderId: null },
    { id: 2, name: "Tổ 2", leaderId: null, viceLeaderId: null },
    { id: 3, name: "Tổ 3", leaderId: null, viceLeaderId: null },
    { id: 4, name: "Tổ 4", leaderId: null, viceLeaderId: null }
];
const defaultSettings = { teacherName: "Nguyễn Thu Hà", className: "7/1", grade: "7", year: "2026 - 2027", autoAbsentDisc: false, autoLateDisc: false, warnAbsent: 3, warnBehavior: -5, theme: "default", apiKey: "" };

function initData() {
    let v4Data = null;
    try {
        v4Data = JSON.parse(localStorage.getItem('gvcnData_v4'));
    } catch(e) {
        console.error("Lỗi đọc dữ liệu localStorage:", e);
    }
    if (!v4Data) {
        let v3Data = null;
        try {
            v3Data = JSON.parse(localStorage.getItem('gvcnData_v3')) || JSON.parse(localStorage.getItem('gvcnData_v2'));
        } catch(e) {}
        v4Data = {
            settings: v3Data ? { ...defaultSettings, ...v3Data.settings } : { ...defaultSettings },
            students: v3Data ? v3Data.students : [], attendance: v3Data ? v3Data.attendance : {},
            behaviorTags: [...defaultTags], behaviorRecords: v3Data ? v3Data.behaviorRecords||[] : [], tasks: v3Data ? v3Data.tasks||[] : [], 
            notifications: v3Data ? v3Data.notifications||[] : [], documents: v3Data ? v3Data.documents||[] : [],
            scheduleSetup: v3Data && v3Data.scheduleSetup ? v3Data.scheduleSetup : { week1Start: "", ppct: [], tkb: [], holidays: [] },
            scheduleRecords: v3Data && v3Data.scheduleRecords ? v3Data.scheduleRecords : [],
            monthlyThemes: v3Data && v3Data.settings && v3Data.settings.monthlyThemes ? v3Data.settings.monthlyThemes : { "8": "VĂN MINH - XANH - AN TOÀN" },
            fixedGroups: JSON.parse(JSON.stringify(defaultFixedGroups)),
            flexibleGroups: [],
            classGradeMap: {},
            lastUpdated: v3Data ? Date.now() : 0
        };
        localStorage.setItem('gvcnData_v4', JSON.stringify(v4Data));
    } else {
        if (!v4Data.settings) { v4Data.settings = { ...defaultSettings }; }
        v4Data.settings = { ...defaultSettings, ...v4Data.settings };
        if (!v4Data.settings.monthlyThemes) { v4Data.settings.monthlyThemes = { "8": "VĂN MINH - XANH - AN TOÀN" }; }
        if (!v4Data.settings.theme) { v4Data.settings.theme = "default"; }
        if (!v4Data.fixedGroups || !Array.isArray(v4Data.fixedGroups) || v4Data.fixedGroups.length === 0) {
            v4Data.fixedGroups = JSON.parse(JSON.stringify(defaultFixedGroups));
        }
        if (!v4Data.flexibleGroups) { v4Data.flexibleGroups = []; }
        if (!v4Data.classGradeMap) { v4Data.classGradeMap = {}; }
        if (!v4Data.teacherEmail) { v4Data.teacherEmail = ""; }
        if (!v4Data.teacherUid) { v4Data.teacherUid = ""; }
        if (v4Data.students && Array.isArray(v4Data.students)) {
            v4Data.students.forEach(s => {
                if (s.accountRole === undefined) s.accountRole = 'none';
                if (s.accountEmail === undefined) s.accountEmail = '';
            });
        }
        if (!v4Data.settings.grade) {
            const m = String(v4Data.settings.className || '').match(/\d+/);
            v4Data.settings.grade = m ? m[0] : "7";
        }
        if (typeof v4Data.lastUpdated !== 'number') { v4Data.lastUpdated = 0; }
    }
    return v4Data;
}

let appData = initData();
let syncTimeout = null;

window.saveData = function(immediateSync = false) { 
    appData.lastUpdated = Date.now();
    localStorage.setItem('gvcnData_v4', JSON.stringify(appData)); 
    window.updateDashboardInfo(); 
    if (currentUser) {
        if (syncTimeout) clearTimeout(syncTimeout);
        const doSync = () => {
            const targetUid = appData.teacherUid || currentUser.uid;
            const docRef = doc(firestoreDb, "DuLieuGVCN", targetUid);
            setDoc(docRef, appData).then(() => { 
                console.log("☁️ Đã đồng bộ nền lên Firebase thành công!"); 
            }).catch(e => console.error("Lỗi đồng bộ mây:", e));
        };
        if (immediateSync) {
            doSync();
        } else {
            syncTimeout = setTimeout(doSync, 1000);
        }
    }
};

window.addEventListener('beforeunload', () => {
    if (currentUser && syncTimeout) {
        clearTimeout(syncTimeout);
        try {
            const targetUid = appData.teacherUid || currentUser.uid;
            const docRef = doc(firestoreDb, "DuLieuGVCN", targetUid);
            setDoc(docRef, appData);
        } catch(e) {}
    }
});

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
    window.resolveUserRole(currentUser);
    window.updateRoleUI();
    window.updateDashboardInfo(); window.renderStudents(); window.loadSettings(); window.renderKanban(); window.renderDocs(); window.renderSetupData();
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err)); }
};

window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i> <span>${message}</span>`; container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateY(-20px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}

window.switchView = function(viewId, navElement = null) {
    // Tự động lưu tức thì các trường cài đặt nếu người dùng đang nhập dở trong mục Cài đặt rồi bấm chuyển tab
    const viewSettingsEl = document.getElementById('view-settings');
    if (viewSettingsEl && viewSettingsEl.classList.contains('active')) {
        const setTeacher = document.getElementById('set-teacher');
        const setClass = document.getElementById('set-class');
        const setYear = document.getElementById('set-year');
        if (setTeacher && setClass && setYear) {
            if (!appData.settings) appData.settings = { ...defaultSettings };
            appData.settings.teacherName = setTeacher.value.trim();
            appData.settings.className = setClass.value.trim();
            appData.settings.year = setYear.value.trim();
            appData.lastUpdated = Date.now();
            localStorage.setItem('gvcnData_v4', JSON.stringify(appData));
            window.updateDashboardInfo();
        }
    }
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active'); window.scrollTo(0, 0);
    if (navElement) { document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active')); navElement.classList.add('active'); }
    if(viewId === 'view-settings') window.loadSettings(); if(viewId === 'view-attendance') window.renderAttendance(); if(viewId === 'view-discipline') window.renderDisciplineStudents();
    if(viewId === 'view-announcements') window.renderNotifies(); if(viewId === 'view-plans') window.renderKanban(); if(viewId === 'view-docs') window.renderDocs();
    if(viewId === 'view-lesson-log') window.initLessonLogView();
}
window.openModal = function(id) { 
    const modalEl = document.getElementById(id);
    if (modalEl) {
        modalEl.style.display = 'flex'; 
        if (id === 'modal-setup-tkb') {
            const tkbClass = document.getElementById('add-tkb-class');
            if (tkbClass && !tkbClass.value && appData.settings && appData.settings.className) {
                tkbClass.value = appData.settings.className;
            }
        }
        if (id === 'modal-setup-ppct') {
            const ppctGrade = document.getElementById('add-ppct-grade');
            if (ppctGrade && appData.settings && appData.settings.className) {
                ppctGrade.value = window.inferGrade(appData.settings.className);
            }
        }
        if (id === 'modal-add-student') {
            const grpSelect = document.getElementById('stu-group');
            if (grpSelect) {
                let currentVal = grpSelect.value || '0';
                let opts = '<option value="0">-- Chưa phân tổ --</option>';
                if (appData.fixedGroups) {
                    appData.fixedGroups.forEach(g => {
                        opts += `<option value="${g.id}">${g.name}</option>`;
                    });
                }
                grpSelect.innerHTML = opts;
                grpSelect.value = currentVal;
            }
        }
    }
};
window.closeModal = function(id) { 
    const modalEl = document.getElementById(id);
    if (modalEl) modalEl.style.display = 'none'; 
};

// ================= TÍNH NĂNG ĐỔI GIAO DIỆN =================
window.changeTheme = function(themeName, element) {
    document.body.className = themeName === 'default' ? '' : themeName;
    document.querySelectorAll('.theme-btn').forEach(btn => btn.classList.remove('active'));
    if(element) element.classList.add('active');
    appData.settings.theme = themeName;
    window.saveData();
    window.showToast("Đã đổi màu giao diện!", "success");
}

window.inferGrade = function(className) {
    if (!className) return "7";
    const clean = String(className).trim();
    const m = clean.match(/\d+/);
    return m ? m[0] : "7";
};

window.getGradeOfClass = function(className) {
    return window.inferGrade(className);
};

window.getPpct = function(subject, grade) {
    if (!appData.scheduleSetup || !Array.isArray(appData.scheduleSetup.ppct)) return [];
    const cleanSubj = String(subject || '').trim().toLowerCase();
    const targetGrade = String(grade || '').trim();

    const matched = appData.scheduleSetup.ppct.filter(p => {
        const pSubj = String(p.subject || '').trim().toLowerCase();
        if (pSubj !== cleanSubj) return false;
        
        let pGrade = (p.grade !== undefined && p.grade !== null && String(p.grade).trim() !== '')
            ? String(p.grade).trim()
            : window.inferGrade(p.className);

        return String(pGrade) === targetGrade;
    });

    matched.sort((a, b) => parseInt(a.ppct) - parseInt(b.ppct));
    return matched;
};

window.renderClassGradeList = function() {};
window.setClassGrade = function() {};

window.loadSettings = function() { 
    if (!appData.settings) appData.settings = { ...defaultSettings };
    const s = appData.settings; 
    
    const setTeacher = document.getElementById('set-teacher');
    const setClass = document.getElementById('set-class');
    const setYear = document.getElementById('set-year');
    
    if (setTeacher) setTeacher.value = s.teacherName || ''; 
    if (setClass) setClass.value = s.className || ''; 
    if (setYear) setYear.value = s.year || ''; 

    // Kiểm tra quyền: Nếu không phải Giáo viên thì khóa các trường cài đặt
    const isT = window.isTeacher();
    if (setTeacher) setTeacher.disabled = !isT;
    if (setClass) setClass.disabled = !isT;
    if (setYear) setYear.disabled = !isT;

    const btnSaveSettings = document.querySelector('#view-settings .btn-primary');
    if (btnSaveSettings) {
        btnSaveSettings.style.display = isT ? '' : 'none';
    }
    
    if (document.getElementById('set-auto-absent')) document.getElementById('set-auto-absent').checked = s.autoAbsentDisc || false; 
    if (document.getElementById('set-auto-late')) document.getElementById('set-auto-late').checked = s.autoLateDisc || false; 
    if (document.getElementById('set-warn-absent')) document.getElementById('set-warn-absent').value = s.warnAbsent || 3; 
    if (document.getElementById('set-warn-behavior')) document.getElementById('set-warn-behavior').value = s.warnBehavior || -5; 
    
    if (document.getElementById('set-api-key')) {
        document.getElementById('set-api-key').value = s.apiKey || '';
    }

    let currentTheme = s.theme || 'default';
    document.body.className = currentTheme === 'default' ? '' : currentTheme;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        const onclickAttr = btn.getAttribute('onclick');
        if (onclickAttr && onclickAttr.includes(currentTheme)) btn.classList.add('active');
    });
};

window.saveSettings = function() { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền lưu Cài đặt hệ thống!", "error");
        return;
    }

    if (!appData.settings) appData.settings = { ...defaultSettings };
    
    const setTeacher = document.getElementById('set-teacher');
    const setClass = document.getElementById('set-class');
    const setYear = document.getElementById('set-year');
    
    if (setTeacher) appData.settings.teacherName = setTeacher.value.trim(); 
    if (setClass) {
        appData.settings.className = setClass.value.trim(); 
        appData.settings.grade = window.inferGrade(appData.settings.className);
    }
    if (setYear) appData.settings.year = setYear.value.trim(); 
    
    if (document.getElementById('set-auto-absent')) appData.settings.autoAbsentDisc = document.getElementById('set-auto-absent').checked; 
    if (document.getElementById('set-auto-late')) appData.settings.autoLateDisc = document.getElementById('set-auto-late').checked; 
    if (document.getElementById('set-warn-absent')) appData.settings.warnAbsent = parseInt(document.getElementById('set-warn-absent').value) || 3; 
    if (document.getElementById('set-warn-behavior')) appData.settings.warnBehavior = parseInt(document.getElementById('set-warn-behavior').value) || -5; 
    
    if (document.getElementById('set-api-key')) {
        appData.settings.apiKey = document.getElementById('set-api-key').value.trim();
    }
    
    appData.lastUpdated = Date.now();
    window.saveData(true); 
    
    const displayTeacher = appData.settings.teacherName || 'GV';
    const displayClass = appData.settings.className || '';
    const displayYear = appData.settings.year || '';
    window.showToast(`✅ Đã lưu: ${displayTeacher}${displayClass ? ' - Lớp ' + displayClass : ''}${displayYear ? ' (' + displayYear + ')' : ''}`); 
};

window.autoSaveSettingsField = function(field, val) {
    if (!window.isTeacher()) return;

    if (!appData.settings) appData.settings = { ...defaultSettings };
    appData.settings[field] = val ? val.trim() : '';
    if (field === 'className') {
        appData.settings.grade = window.inferGrade(val);
    }
    appData.lastUpdated = Date.now();
    localStorage.setItem('gvcnData_v4', JSON.stringify(appData));
    window.updateDashboardInfo();
    if (currentUser) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const targetUid = appData.teacherUid || currentUser.uid;
            const docRef = doc(firestoreDb, "DuLieuGVCN", targetUid);
            setDoc(docRef, appData).catch(e => console.error("Lỗi đồng bộ mây:", e));
        }, 1200);
    }
};

window.saveConfig = function() { 
    window.saveSettings(); 
};

window.resetData = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền đặt lại dữ liệu!", "error");
        return;
    }
    if(confirm("XÓA TOÀN BỘ CSDL CỤC BỘ? LƯU Ý: Thao tác này chỉ xóa bộ nhớ tạm, dữ liệu mây vẫn còn.")) { localStorage.removeItem('gvcnData_v4'); localStorage.removeItem('gvcnData_v3'); location.reload(); }
}


// ================= DASHBOARD =================
window.updateDashboardInfo = function() {
    if (!appData.settings) appData.settings = { ...defaultSettings };
    const s = appData.settings;
    
    const dashTeacher = document.getElementById('dash-teacher');
    if (dashTeacher) dashTeacher.innerText = s.teacherName || 'Cô/Thầy';
    
    const dashClass = document.getElementById('dash-class');
    if (dashClass) dashClass.innerText = s.className || 'Chưa đặt';
    
    const dashYear = document.getElementById('dash-year');
    if (dashYear) dashYear.innerText = s.year || '2026 - 2027';

    // Cập nhật avatar theo tên giáo viên
    const avatarImg = document.querySelector('.avatar');
    if (avatarImg && s.teacherName) {
        avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(s.teacherName)}&background=e0e7ff&color=4f46e5&bold=true`;
    }

    // Cập nhật mẫu Phiếu liên lạc
    const rcTeacher = document.getElementById('rc-teacher');
    if (rcTeacher && s.teacherName) rcTeacher.innerText = s.teacherName;
    const rcMonthClass = document.getElementById('rc-month-class');
    if (rcMonthClass && s.className) {
        const curMonth = new Date().getMonth() + 1;
        rcMonthClass.innerText = `Tháng ${curMonth} - Lớp ${s.className}`;
    }
    
    const totalStu = appData.students.length; 
    const dashCount = document.getElementById('dash-count');
    if (dashCount) dashCount.innerText = totalStu + " HS"; 
    const statTotal = document.getElementById('stat-total');
    if (statTotal) statTotal.innerText = totalStu;
    
    const today = getTodayStr(); 
    let presentCount = totalStu, absentCount = 0;
    if(appData.attendance[today]) { 
        presentCount = 0; absentCount = 0; 
        Object.values(appData.attendance[today]).forEach(st => { 
            if(st === 'present') presentCount++; 
            if(st === 'excused' || st === 'unexcused') absentCount++; 
        }); 
    }
    const dashAttendance = document.getElementById('dash-attendance-percent');
    if (dashAttendance) dashAttendance.innerText = (totalStu > 0 ? Math.round((presentCount / totalStu) * 100) : 100) + "%";
    
    const statPresent = document.getElementById('stat-present');
    if (statPresent) statPresent.innerText = presentCount; 
    const statAbsent = document.getElementById('stat-absent');
    if (statAbsent) statAbsent.innerText = absentCount;
    
    const statGood = document.getElementById('stat-good');
    if (statGood) statGood.innerText = appData.behaviorRecords.filter(r => r.date === today && r.type === 'positive').length;

    const dashNotify = document.getElementById('dash-notify-count');
    if (dashNotify) dashNotify.innerText = appData.notifications.length + " TB";
    
    const dashTask = document.getElementById('dash-task-count');
    if (dashTask) dashTask.innerText = appData.tasks.length + " việc";
    
    const dashDoc = document.getElementById('dash-doc-count');
    if (dashDoc) dashDoc.innerText = appData.documents.length + " file";

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
            let periodLabel = r.period <= 5 ? `Sáng - Tiết ${r.period}` : `Chiều - Tiết ${r.period - 5}`;

            list.innerHTML += `
                <div class="sched-card ${cardClass}">
                    <div class="sched-top"><span><b>${periodLabel}</b> | ${r.className}</span> <span style="background: #f1f5f9; padding: 2px 8px; border-radius: 8px; font-weight:600;">PPCT: ${r.ppct}</span></div>
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
    let periodDesc = r.period <= 5 ? `Sáng Tiết ${r.period}` : `Chiều Tiết ${r.period - 5} (Tiết ${r.period})`;
    document.getElementById('adj-sched-id').value = r.id; 
    document.getElementById('adj-sched-info').innerHTML = `Đang chỉnh sửa: <b>${r.subject} ${r.className} (${periodDesc})</b> - PPCT: ${r.ppct}`; 
    document.getElementById('adj-sched-date').value = r.date; 
    document.getElementById('adj-sched-period').value = r.period; 
    document.getElementById('adj-sched-note').value = r.note || '';
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
    let ws_data = [["Tuần", "Ngày", "Thứ", "Buổi", "Tiết", "Lớp", "Môn", "PPCT", "Nội dung bài dạy", "Trạng thái", "Ghi chú"]];
    records.sort((a,b) => new Date(a.date) - new Date(b.date) || a.period - b.period).forEach(r => {
        let st = r.status==='off'?'Nghỉ':(r.status==='completed'?'Đã xong':'Chưa dạy');
        let buoiStr = r.period <= 5 ? 'Sáng' : 'Chiều';
        let tietStr = r.period <= 5 ? r.period : (r.period - 5);
        ws_data.push([r.week, new Date(r.date).toLocaleDateString('vi-VN'), `Thứ ${r.dayOfWeek}`, buoiStr, tietStr, r.className, r.subject, r.ppct, r.content, st, r.note||""]);
    });
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(ws_data);
    ws['!cols'] = [{wch: 6}, {wch: 12}, {wch: 8}, {wch: 8}, {wch: 6}, {wch: 10}, {wch: 12}, {wch: 8}, {wch: 35}, {wch: 12}, {wch: 20}];
    XLSX.utils.book_append_sheet(wb, ws, "SoBaoGiang");
    XLSX.writeFile(wb, `So_Bao_Giang_Tuan_${w}.xlsx`); 
    window.showToast("Đã xuất Excel Sổ Báo Giảng!");
}

window.togglePpctScopeUI = function() {};

window.renderPPCTTable = function() {
    window.renderSetupData();
};

window.clearAllPPCT = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền chỉnh sửa PPCT!", "error");
        return;
    }
    if(confirm("Bạn có chắc muốn xóa tất cả bài dạy trong Phân phối chương trình?")) {
        appData.scheduleSetup.ppct = [];
        window.saveData();
        window.renderSetupData();
        window.showToast("Đã xóa sạch danh sách PPCT!");
    }
};

window.renderSetupData = function() {
    let stp = appData.scheduleSetup;
    document.getElementById('setup-week1-date').value = stp.week1Start;
    document.getElementById('setup-tkb-count').innerText = stp.tkb.length + " bản ghi";
    document.getElementById('setup-ppct-count').innerText = stp.ppct.length + " bài dạy";
    document.getElementById('setup-holidays-count').innerText = stp.holidays.length + " sự kiện";

    const tbodyTKB = document.getElementById('tkb-tbody'); tbodyTKB.innerHTML = '';
    stp.tkb.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period).forEach((t, i) => { 
        let isAfternoon = t.period > 5;
        let pText = isAfternoon ? `Chiều - Tiết ${t.period - 5}` : `Sáng - Tiết ${t.period}`;
        let badgeStyle = isAfternoon ? "background:#fef3c7; color:#b45309; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:600;" : "background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-size:0.75rem; font-weight:600;";
        tbodyTKB.innerHTML += `<tr><td>Thứ ${t.dayOfWeek}</td><td><span style="${badgeStyle}">${pText}</span></td><td><b>${t.className}</b></td><td>${t.subject}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('tkb', ${i})"><i class="fas fa-times"></i></button></td></tr>`; 
    });
    
    const tbodyPPCT = document.getElementById('ppct-tbody'); tbodyPPCT.innerHTML = '';
    const filterGradeEl = document.getElementById('filter-ppct-grade');
    const currentGradeFilter = filterGradeEl ? filterGradeEl.value : 'all';

    stp.ppct.forEach((p, i) => { 
        let gradeStr = (p.grade !== undefined && p.grade !== null && String(p.grade).trim() !== '')
            ? String(p.grade).trim()
            : window.inferGrade(p.className);
        if (!gradeStr) gradeStr = "7";
        
        if (currentGradeFilter !== 'all' && String(gradeStr) !== String(currentGradeFilter)) {
            return;
        }

        let scopeBadge = `<span class="badge-grade" style="background:#e0f2fe; color:#0369a1; padding:3px 8px; border-radius:6px; font-weight:700; font-size:0.75rem;">Khối ${gradeStr}</span>`;

        tbodyPPCT.innerHTML += `<tr><td>${scopeBadge}</td><td><b>${p.subject}</b></td><td>${p.ppct}</td><td>${(p.content||'').substring(0,35)}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('ppct', ${i})"><i class="fas fa-times"></i></button></td></tr>`; 
    });

    const tbodyHol = document.getElementById('hol-tbody'); tbodyHol.innerHTML = '';
    stp.holidays.forEach((h, i) => { tbodyHol.innerHTML += `<tr><td>${h.start}</td><td>${h.end}</td><td>${h.name}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('holidays', ${i})"><i class="fas fa-times"></i></button></td></tr>`; });
}

window.delSetupData = function(type, index) {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xóa dữ liệu cấu hình TKB / PPCT!", "error");
        return;
    }
    appData.scheduleSetup[type].splice(index, 1);
    window.saveData();
    window.renderSetupData();
}

window.addTKB = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền chỉnh sửa Thời khóa biểu!", "error");
        return;
    }
    let d = document.getElementById('add-tkb-day').value;
    let sess = document.getElementById('add-tkb-session') ? document.getElementById('add-tkb-session').value : 'morning';
    let p = parseInt(document.getElementById('add-tkb-period').value);
    let c = document.getElementById('add-tkb-class').value;
    let s = document.getElementById('add-tkb-subject').value;
    if(!d || isNaN(p) || !c || !s) return window.showToast("Nhập đủ thông tin!", "error");
    
    let realPeriod = (sess === 'afternoon' && p <= 5) ? (p + 5) : p;
    appData.scheduleSetup.tkb.push({ dayOfWeek: parseInt(d), period: realPeriod, className: c.trim(), subject: s.trim() });
    appData.scheduleSetup.tkb.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period);
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm TKB!");
}

window.clearAllTKB = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xóa Thời khóa biểu!", "error");
        return;
    }
    if(confirm("Bạn có chắc muốn xóa tất cả các tiết trong Thời khóa biểu?")) {
        appData.scheduleSetup.tkb = [];
        window.saveData(); window.renderSetupData(); window.showToast("Đã xóa sạch danh sách TKB!");
    }
}

window.addPPCT = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền thêm Phân phối chương trình!", "error");
        return;
    }
    let g = document.getElementById('add-ppct-grade') ? document.getElementById('add-ppct-grade').value : "7";
    let s = document.getElementById('add-ppct-subject') ? document.getElementById('add-ppct-subject').value.trim() : "";
    let p = document.getElementById('add-ppct-period') ? document.getElementById('add-ppct-period').value : "";
    let n = document.getElementById('add-ppct-content') ? document.getElementById('add-ppct-content').value.trim() : "";
    if(!s || !p || !n) return window.showToast("Nhập đủ môn, tiết và nội dung!", "error");

    const gradeVal = String(g).trim() || "7";
    const periodNum = parseInt(p);

    let existing = appData.scheduleSetup.ppct.find(item => {
        let ig = (item.grade !== undefined && item.grade !== null && String(item.grade).trim() !== '')
            ? String(item.grade).trim()
            : window.inferGrade(item.className);
        let is = String(item.subject || '').trim().toLowerCase();
        return is === s.toLowerCase() && String(ig) === gradeVal && parseInt(item.ppct) === periodNum;
    });

    if (existing) {
        existing.content = n;
        existing.grade = gradeVal;
        existing.subject = s;
        existing.ppct = periodNum;
    } else {
        appData.scheduleSetup.ppct.push({
            grade: gradeVal,
            subject: s,
            ppct: periodNum,
            content: n
        });
    }

    window.saveData(); 
    window.renderSetupData(); 
    window.showToast(`Đã thêm PPCT: ${s} Khối ${gradeVal} - Tiết ${periodNum}!`);

    if (document.getElementById('add-ppct-period')) document.getElementById('add-ppct-period').value = periodNum + 1;
    if (document.getElementById('add-ppct-content')) document.getElementById('add-ppct-content').value = "";
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
                let targetGrade = document.getElementById('add-ppct-grade') ? document.getElementById('add-ppct-grade').value : "7";
                let targetSubject = document.getElementById('add-ppct-subject') ? document.getElementById('add-ppct-subject').value.trim() : "Toán";
                
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
                                if(!isNaN(tiet) && nd) {
                                    let existing = appData.scheduleSetup.ppct.find(item => {
                                        let ig = (item.grade !== undefined && item.grade !== null && String(item.grade).trim() !== '')
                                            ? String(item.grade).trim()
                                            : window.inferGrade(item.className);
                                        let is = String(item.subject || '').trim().toLowerCase();
                                        return is === targetSubject.toLowerCase() && String(ig) === String(targetGrade) && parseInt(item.ppct) === tiet;
                                    });
                                    if (existing) {
                                        existing.content = nd;
                                    } else {
                                        appData.scheduleSetup.ppct.push({ grade: String(targetGrade), subject: targetSubject, ppct: tiet, content: nd });
                                        count++;
                                    }
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
                let formGrade = document.getElementById('add-ppct-grade') ? document.getElementById('add-ppct-grade').value : "7";
                let formSubject = document.getElementById('add-ppct-subject') ? document.getElementById('add-ppct-subject').value.trim() : "Toán";

                rows.forEach(r => {
                    if (currentImportType === 'tkb') {
                        let thuRaw = r['Thứ'] || r['Thu'] || r['Thứ trong tuần'] || r['Day'] || r['THỨ'];
                        let tietRaw = r['Tiết'] || r['Tiet'] || r['Tiết học'] || r['Period'] || r['TIẾT'];
                        let buoiRaw = r['Buổi'] || r['Buoi'] || r['Ca'] || r['Session'] || r['BUỔI'] || '';
                        let lopRaw = r['Lớp'] || r['Lop'] || r['Class'] || r['LỚP'] || '';
                        let monRaw = r['Môn'] || r['Mon'] || r['Môn học'] || r['Subject'] || r['MÔN'] || '';

                        // 1. Nhận diện dạng danh sách chuẩn (List format)
                        if (thuRaw !== undefined && tietRaw !== undefined && lopRaw) {
                            let dayNum = parseInt(String(thuRaw).replace(/\D/g, ''));
                            if (String(thuRaw).toLowerCase().includes('chủ nhật') || String(thuRaw).toLowerCase().includes('cn')) dayNum = 8;
                            let pNum = parseInt(String(tietRaw).replace(/\D/g, ''));
                            let buoiLower = String(buoiRaw).toLowerCase();
                            if ((buoiLower.includes('chiều') || buoiLower.includes('chieu') || buoiLower === 'c') && pNum <= 5) {
                                pNum += 5;
                            }
                            if (!isNaN(dayNum) && !isNaN(pNum) && lopRaw) {
                                appData.scheduleSetup.tkb.push({
                                    dayOfWeek: dayNum,
                                    period: pNum,
                                    className: String(lopRaw).trim(),
                                    subject: String(monRaw).trim() || 'Chung'
                                });
                                count++;
                                return;
                            }
                        }

                        // 2. Nhận diện dạng bảng ma trận (Matrix columns: Sáng - Tiết 1, Chiều - Tiết 2, ...)
                        if (thuRaw !== undefined) {
                            let dayNum = parseInt(String(thuRaw).replace(/\D/g, ''));
                            if (String(thuRaw).toLowerCase().includes('chủ nhật') || String(thuRaw).toLowerCase().includes('cn')) dayNum = 8;
                            if (!isNaN(dayNum)) {
                                Object.keys(r).forEach(colKey => {
                                    let colLower = colKey.toLowerCase();
                                    if (colLower.includes('tiết') || colLower.includes('tiet')) {
                                        let isAfternoon = colLower.includes('chiều') || colLower.includes('chieu');
                                        let pMatches = colKey.match(/\d+/);
                                        if (pMatches && r[colKey]) {
                                            let pNum = parseInt(pMatches[0]);
                                            if (isAfternoon && pNum <= 5) pNum += 5;
                                            let cellText = String(r[colKey]).trim();
                                            if (cellText && cellText !== '-' && !cellText.toLowerCase().includes('nghỉ') && cellText !== 'x') {
                                                let parts = cellText.split(/[\n\-\(\)]+/).map(x => x.trim()).filter(Boolean);
                                                let cls = parts[0] || '';
                                                let sbj = parts[1] || 'Toán';
                                                if (cls) {
                                                    appData.scheduleSetup.tkb.push({
                                                        dayOfWeek: dayNum,
                                                        period: pNum,
                                                        className: cls,
                                                        subject: sbj
                                                    });
                                                    count++;
                                                }
                                            }
                                        }
                                    }
                                });
                            }
                        }
                    }
                    else if(currentImportType === 'ppct') {
                        let pVal = r['Tiết'] || r['Tiet'] || r['Tiết PPCT'] || r['Tiết học'] || r['Period'];
                        if (pVal !== undefined) {
                            let p = parseInt(String(pVal).replace(/\D/g, '')); 
                            let n = String(r['Nội dung'] || r['Noi dung'] || r['Tên bài'] || r['Ten bai'] || r['Tên bài học / Chuyên đề'] || r['Chủ đề'] || r['Bài học'] || '');
                            if(!isNaN(p) && n) {
                                let rowGrade = r['Khối'] || r['Khoi'] || r['Grade'];
                                let rowClass = r['Lớp'] || r['Lop'] || r['Class'];
                                
                                let finalGrade = formGrade;
                                if (rowGrade) {
                                    finalGrade = window.inferGrade(rowGrade);
                                } else if (rowClass) {
                                    finalGrade = window.inferGrade(rowClass);
                                }

                                let rowSubj = r['Môn'] || r['Mon'] || r['Môn học'] || r['Subject'] || formSubject;
                                let finalSubj = String(rowSubj || formSubject).trim();

                                let existing = appData.scheduleSetup.ppct.find(item => {
                                    let ig = (item.grade !== undefined && item.grade !== null && String(item.grade).trim() !== '')
                                        ? String(item.grade).trim()
                                        : window.inferGrade(item.className);
                                    let is = String(item.subject || '').trim().toLowerCase();
                                    return is === finalSubj.toLowerCase() && String(ig) === String(finalGrade) && parseInt(item.ppct) === p;
                                });

                                if (existing) {
                                    existing.content = n;
                                    existing.grade = String(finalGrade);
                                    existing.subject = finalSubj;
                                } else {
                                    appData.scheduleSetup.ppct.push({
                                        grade: String(finalGrade),
                                        subject: finalSubj,
                                        ppct: p,
                                        content: n
                                    });
                                    count++;
                                }
                            }
                        }
                    }
                    else if(currentImportType === 'holidays' && r['Từ ngày'] && r['Đến ngày'] && r['Sự kiện']) {
                        let sd = new Date(r['Từ ngày']); let ed = new Date(r['Đến ngày']);
                        if(!isNaN(sd)) { appData.scheduleSetup.holidays.push({ start: sd.toISOString().split('T')[0], end: ed.toISOString().split('T')[0], name: r['Sự kiện'] }); count++; }
                    }
                });
                if (currentImportType === 'tkb') {
                    appData.scheduleSetup.tkb.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period);
                }
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

    appData.scheduleSetup.week1Start = startDate; 
    let records = []; 
    let ppctQueues = {}; 

    const getQueueKey = (cls, sbj) => `${sbj.trim().toLowerCase()}__${cls.trim().toLowerCase()}`;

    // Tạo hàng đợi bài dạy độc lập cho từng lớp:
    // Bước 1: Lớp (ví dụ: 7A2, 7/1) -> Khối 7
    // Bước 2: Tìm PPCT theo Môn + Khối (ví dụ: Toán + 7) qua getPpct(subject, grade)
    // Bước 3: Gán bản sao cho hàng đợi của lớp để tiến độ từng lớp độc lập
    appData.scheduleSetup.tkb.forEach(tItem => {
        let qKey = getQueueKey(tItem.className, tItem.subject);
        if (!ppctQueues[qKey]) {
            let classGrade = window.getGradeOfClass(tItem.className);
            let matched = window.getPpct(tItem.subject, classGrade);

            // Dự phòng nếu tên môn có sai lệch nhỏ
            if (matched.length === 0) {
                matched = appData.scheduleSetup.ppct.filter(p => {
                    return String(p.subject || '').trim().toLowerCase() === String(tItem.subject || '').trim().toLowerCase();
                });
                matched.sort((a, b) => parseInt(a.ppct) - parseInt(b.ppct));
            }

            ppctQueues[qKey] = matched.map(x => ({ ...x }));
        }
    });

    let currentDate = new Date(startDate);
    for(let w = 1; w <= 35; w++) {
        for(let d = 2; d <= 7; d++) {
            let dateStr = currentDate.toISOString().split('T')[0]; 
            let holiday = window.checkIsHoliday(dateStr);
            let dayTKB = appData.scheduleSetup.tkb.filter(t => t.dayOfWeek == d); 
            dayTKB.sort((a,b) => a.period - b.period);

            dayTKB.forEach(tItem => {
                let qKey = getQueueKey(tItem.className, tItem.subject);
                let oldR = appData.scheduleRecords.find(x => x.date === dateStr && x.period === tItem.period && x.className === tItem.className);
                if(oldR && (oldR.status === 'completed' || oldR.note)) {
                    records.push(oldR);
                    if(oldR.status === 'completed' && ppctQueues[qKey] && ppctQueues[qKey].length > 0 && ppctQueues[qKey][0].ppct == oldR.ppct) { 
                        ppctQueues[qKey].shift(); 
                    } 
                    return; 
                }
                if (holiday) { 
                    records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: "-", content: "NGHỈ LỄ - " + holiday.name, status: "off" }); 
                } else {
                    if (ppctQueues[qKey] && ppctQueues[qKey].length > 0) { 
                        let lesson = ppctQueues[qKey].shift(); 
                        records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: lesson.ppct, content: lesson.content, status: "scheduled" }); 
                    } else { 
                        records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: "-", content: "Ôn tập / Tự chọn (Hết PPCT)", status: "scheduled" }); 
                    }
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
    window.showToast("🎉 Đã sinh Sổ Báo Giảng: PPCT dùng chung theo Khối & tiến độ độc lập từng lớp!");
};

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

// ================= QUẢN LÝ HỌC SINH, TỔ CỐ ĐỊNH & NHÓM HOẠT ĐỘNG =================
let currentStudentTab = 'all';
let currentFixedGroupFilter = 'all';
let lastPickerMode = 'group'; // 'group' | 'student' | 'member'
let lastPickerGroupId = null;

// Âm thanh chúc mừng & quay số bằng Web Audio API
function playChime(type) {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (type === 'tick') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.frequency.setValueAtTime(440, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.05);
        } else if (type === 'win') {
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.1);
                gain.gain.setValueAtTime(0.12, audioCtx.currentTime + idx * 0.1);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.1 + 0.25);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start(audioCtx.currentTime + idx * 0.1);
                osc.stop(audioCtx.currentTime + idx * 0.1 + 0.25);
            });
        }
    } catch(e) {}
}

window.switchStudentTab = function(tab) {
    currentStudentTab = tab;
    document.querySelectorAll('.sub-tab-item').forEach(el => el.classList.remove('active'));

    const tabAll = document.getElementById('subtab-content-all');
    const tabFixed = document.getElementById('subtab-content-fixed');
    const tabAct = document.getElementById('subtab-content-activity');

    if (tabAll) tabAll.style.display = 'none';
    if (tabFixed) tabFixed.style.display = 'none';
    if (tabAct) tabAct.style.display = 'none';

    if (tab === 'all') {
        const btn = document.getElementById('tab-btn-students-all');
        if (btn) btn.classList.add('active');
        if (tabAll) tabAll.style.display = 'block';
        window.renderStudents();
    } else if (tab === 'fixed') {
        const btn = document.getElementById('tab-btn-students-fixed');
        if (btn) btn.classList.add('active');
        if (tabFixed) tabFixed.style.display = 'block';
        window.renderFixedGroups();
    } else if (tab === 'activity') {
        const btn = document.getElementById('tab-btn-students-activity');
        if (btn) btn.classList.add('active');
        if (tabAct) tabAct.style.display = 'block';
        window.renderActivityGroups();
    }
};

window.filterStudentsByGroup = function(groupId) {
    currentFixedGroupFilter = groupId;
    window.renderStudents();
};

window.renderStudents = function() {
    const list = document.getElementById('student-list'); 
    if (!list) return;
    list.innerHTML = ''; 

    // Render bộ lọc theo Tổ cố định
    const filterContainer = document.getElementById('student-group-filters');
    if (filterContainer) {
        let filterHtml = '<div class="group-filter-grid">';
        filterHtml += `
            <div class="group-filter-chip ${currentFixedGroupFilter === 'all' ? 'active' : ''}" onclick="window.filterStudentsByGroup('all')">
                <i class="fas fa-layer-group"></i> <span>Tất cả (${appData.students.length})</span>
            </div>
        `;
        if (appData.fixedGroups && Array.isArray(appData.fixedGroups)) {
            appData.fixedGroups.forEach(g => {
                const count = appData.students.filter(s => s.fixedGroup == g.id).length;
                const isActive = String(currentFixedGroupFilter) === String(g.id);
                filterHtml += `
                    <div class="group-filter-chip ${isActive ? 'active' : ''}" onclick="window.filterStudentsByGroup('${g.id}')">
                        <span>${g.name} (${count})</span>
                        <span class="chip-delete-btn" onclick="event.stopPropagation(); window.deleteFixedGroup(${g.id})" title="Xóa ${g.name} (nếu lỡ tạo nhầm)">
                            <i class="fas fa-times"></i>
                        </span>
                    </div>
                `;
            });
        }
        const unassignedCount = appData.students.filter(s => !s.fixedGroup || s.fixedGroup == 0).length;
        filterHtml += `
            <div class="group-filter-chip chip-unassigned ${currentFixedGroupFilter === 'unassigned' ? 'active' : ''}" onclick="window.filterStudentsByGroup('unassigned')">
                <i class="fas fa-user-clock"></i> <span>Chưa có tổ (${unassignedCount})</span>
            </div>
        `;
        filterHtml += '</div>';

        // Nút Thêm tổ và Xóa tổ nhanh ngay trên thanh lọc (Hàng 3 riêng biệt)
        filterHtml += `
            <div class="group-filter-actions">
                <div class="group-filter-chip chip-action-add" onclick="window.addNewFixedGroup()" title="Thêm tổ mới">
                    <i class="fas fa-plus"></i> <span>Thêm tổ</span>
                </div>
                <div class="group-filter-chip chip-action-del" onclick="window.openDeleteFixedGroupModal()" title="Mở danh sách xóa các tổ tạo nhầm">
                    <i class="fas fa-trash-alt"></i> <span>Xóa tổ...</span>
                </div>
            </div>
        `;

        filterContainer.innerHTML = filterHtml;
    }

    const searchInput = document.getElementById('search-student');
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";

    let filtered = appData.students.filter(s => {
        const matchName = s.name.toLowerCase().includes(filterText);
        if (!matchName) return false;
        if (currentFixedGroupFilter === 'all') return true;
        if (currentFixedGroupFilter === 'unassigned') return !s.fixedGroup || s.fixedGroup == 0;
        return String(s.fixedGroup) === String(currentFixedGroupFilter);
    });

    if(filtered.length === 0) { 
        list.innerHTML = '<div class="empty-state"><h4>Không tìm thấy học sinh phù hợp!</h4></div>'; 
        return; 
    }

    filtered.forEach((stu, index) => { 
        let cleanPhone = stu.phone ? String(stu.phone).replace(/[^0-9]/g, '') : '';
        let zaloBtn = cleanPhone ? `<button class="btn-outline-action" style="color:white; background:#0068ff; border-color:#0068ff; box-shadow: 0 4px 10px rgba(0,104,255,0.3);" onclick="window.open('https://zalo.me/${cleanPhone}', '_blank')" title="Nhắn Zalo cho Phụ huynh"><i class="fas fa-comment-dots"></i></button>` : '';
        let aiBtn = `<button class="btn-ai-magic" onclick="openAIForStudent('${stu.name}')" title="Nhờ AI nhận xét"><i class="fas fa-magic"></i></button>`;
        
        // Nhãn Tổ cố định & Vai trò
        let groupBadge = '';
        if (stu.fixedGroup && stu.fixedGroup != 0) {
            const gObj = (appData.fixedGroups || []).find(g => g.id == stu.fixedGroup);
            const gName = gObj ? gObj.name : `Tổ ${stu.fixedGroup}`;
            if (stu.fixedRole === 'leader') {
                groupBadge = `<span class="group-tag" style="background:#fef3c7; color:#b45309; border-color:#fde68a;"><i class="fas fa-star text-orange"></i> ${gName} (Tổ trưởng)</span>`;
            } else if (stu.fixedRole === 'vice') {
                groupBadge = `<span class="group-tag" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;"><i class="fas fa-medal"></i> ${gName} (Tổ phó)</span>`;
            } else {
                groupBadge = `<span class="group-tag"><i class="fas fa-users"></i> ${gName}</span>`;
            }
        }

        // Nhãn tài khoản cán bộ lớp (RBAC App)
        let accountBadge = '';
        if (stu.accountRole && stu.accountRole !== 'none') {
            if (stu.accountRole === 'class_leader') {
                accountBadge = `<span class="group-tag" style="background:#dcfce7; color:#15803d; border-color:#bbf7d0;" title="${stu.accountEmail || 'Chưa gắn email'}"><i class="fas fa-user-shield"></i> App: Lớp trưởng</span>`;
            } else if (stu.accountRole === 'class_vice') {
                accountBadge = `<span class="group-tag" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;" title="${stu.accountEmail || 'Chưa gắn email'}"><i class="fas fa-medal"></i> App: Lớp phó</span>`;
            } else if (stu.accountRole === 'group_leader') {
                const gNum = stu.fixedGroup || 1;
                accountBadge = `<span class="group-tag" style="background:#fef3c7; color:#b45309; border-color:#fde68a;" title="${stu.accountEmail || 'Chưa gắn email'}"><i class="fas fa-users-cog"></i> App: Tổ trưởng T${gNum}</span>`;
            }
        }

        const isTeacher = window.isTeacher();
        let groupSelectOptions = `<option value="0" ${(!stu.fixedGroup || stu.fixedGroup == 0) ? 'selected' : ''}>-- Chưa phân tổ --</option>`;
        if (appData.fixedGroups && Array.isArray(appData.fixedGroups)) {
            appData.fixedGroups.forEach(g => {
                groupSelectOptions += `<option value="${g.id}" ${stu.fixedGroup == g.id ? 'selected' : ''}>${g.name}</option>`;
            });
        }

        const transferDisabled = isTeacher ? '' : 'disabled style="background:#f1f5f9; cursor:not-allowed;"';
        const teacherActionBtns = isTeacher ? `
            <button class="btn-outline-action" style="color:var(--text-main);" onclick="editStudent(${stu.id})" title="Chỉnh sửa hồ sơ"><i class="fas fa-pen"></i></button>
            <button class="btn-outline-action" style="color:var(--danger);" onclick="deleteStudent(${stu.id})" title="Xóa học sinh"><i class="fas fa-trash"></i></button>
        ` : '';

        list.innerHTML += `
            <div class="list-item">
                <div class="list-item-info">
                    <div style="display:flex; flex-wrap:wrap; align-items:center; gap:6px;">
                        <strong>${index + 1}. ${stu.name}</strong> 
                        ${groupBadge}
                        ${accountBadge}
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; margin: 4px 0;">
                        <span style="font-size: 0.78rem; font-weight: 700; color: #64748b;">Tổ:</span>
                        <select onchange="window.transferStudentToGroup(${stu.id}, this.value, this)" ${transferDisabled} style="font-size: 0.8rem; font-weight: 600; padding: 2px 8px; border-radius: 6px; border: 1px solid #cbd5e1; background: #fff; cursor: pointer; color: var(--text-main); outline: none;">
                            ${groupSelectOptions}
                        </select>
                    </div>
                    <small><i class="fas fa-venus-mars"></i> ${stu.gender} • <i class="fas fa-phone"></i> ${stu.phone || 'Chưa có SĐT'}${stu.accountEmail ? ' • <i class="fas fa-envelope"></i> ' + stu.accountEmail : ''}</small>
                </div>
                <div class="list-item-actions">
                    ${aiBtn}
                    ${zaloBtn}
                    <button class="btn-outline-action" style="color:white; background:var(--primary);" onclick="generateReportCard(${stu.id})" title="Tạo phiếu liên lạc ảnh"><i class="fas fa-camera-retro"></i></button>
                    ${teacherActionBtns}
                </div>
            </div>`; 
    });
};

window.openAddStudentModal = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền thêm học sinh mới!", "error");
        return;
    }
    document.getElementById('stu-id').value = ''; 
    document.getElementById('stu-name').value = ''; 
    document.getElementById('stu-gender').value = 'Nam'; 
    document.getElementById('stu-dob').value = ''; 
    document.getElementById('stu-phone').value = ''; 
    document.getElementById('stu-role').value = 'member';
    if (document.getElementById('stu-account-email')) document.getElementById('stu-account-email').value = '';
    if (document.getElementById('stu-account-role')) document.getElementById('stu-account-role').value = 'none';

    const grpSelect = document.getElementById('stu-group');
    if (grpSelect) {
        let opts = '<option value="0">-- Chưa phân tổ --</option>';
        if (appData.fixedGroups) {
            appData.fixedGroups.forEach(g => {
                opts += `<option value="${g.id}">${g.name}</option>`;
            });
        }
        grpSelect.innerHTML = opts;
        grpSelect.value = '0';
    }
    window.openModal('modal-add-student');
};

window.saveStudent = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền lưu thông tin học sinh!", "error");
        return;
    }

    const id = document.getElementById('stu-id').value; 
    const name = document.getElementById('stu-name').value;
    if(!name) return window.showToast("Vui lòng nhập họ tên học sinh!", "error");

    const fixedGroup = parseInt(document.getElementById('stu-group').value) || 0;
    const fixedRole = document.getElementById('stu-role').value || 'member';

    const accountEmailInput = document.getElementById('stu-account-email');
    const accountRoleInput = document.getElementById('stu-account-role');
    const accountEmail = accountEmailInput ? accountEmailInput.value.trim().toLowerCase() : '';
    const accountRole = accountRoleInput ? accountRoleInput.value : 'none';

    if(id) { 
        const existingStu = appData.students.find(s => s.id == id);
        if (existingStu) {
            const oldFixedGroup = existingStu.fixedGroup || 0;
            // Nếu chuyển sang tổ khác và đang giữ vai trò Tổ trưởng/Tổ phó
            if (oldFixedGroup && oldFixedGroup !== fixedGroup && (existingStu.fixedRole === 'leader' || existingStu.fixedRole === 'vice')) {
                const confirmMsg = "Học sinh này đang giữ vai trò Tổ trưởng/Tổ phó. Nếu chuyển tổ, vai trò hiện tại sẽ được gỡ bỏ. Bạn có chắc chắn muốn chuyển không?";
                if (!confirm(confirmMsg)) {
                    return;
                }
                // Gỡ vai trò ở tổ cũ
                const oldG = (appData.fixedGroups || []).find(g => g.id == oldFixedGroup);
                if (oldG) {
                    if (oldG.leaderId == existingStu.id) oldG.leaderId = null;
                    if (oldG.viceLeaderId == existingStu.id) oldG.viceLeaderId = null;
                }
            }
        }
    }

    const obj = { 
        id: id ? parseInt(id) : Date.now(), 
        name: name.trim(), 
        gender: document.getElementById('stu-gender').value, 
        dob: document.getElementById('stu-dob').value, 
        phone: document.getElementById('stu-phone').value,
        fixedGroup: fixedGroup,
        fixedRole: fixedGroup ? fixedRole : 'member',
        accountEmail: accountEmail,
        accountRole: accountRole
    };

    if(id) { 
        const existingIdx = appData.students.findIndex(s => s.id == id);
        if (existingIdx !== -1) {
            appData.students[existingIdx] = { ...appData.students[existingIdx], ...obj };
        }
        window.showToast("Đã cập nhật thông tin học sinh!"); 
    } else { 
        appData.students.push(obj); 
        window.showToast("Đã thêm học sinh mới!"); 
    }

    // Đồng bộ vai trò Tổ trưởng / Tổ phó trong tổ
    if (fixedGroup && appData.fixedGroups) {
        const grp = appData.fixedGroups.find(g => g.id == fixedGroup);
        if (grp) {
            if (obj.fixedRole === 'leader') {
                if (grp.viceLeaderId == obj.id) grp.viceLeaderId = null;
                appData.students.forEach(s => {
                    if (s.fixedGroup == fixedGroup && s.id != obj.id && s.fixedRole === 'leader') {
                        s.fixedRole = 'member';
                    }
                });
                grp.leaderId = obj.id;
            } else if (obj.fixedRole === 'vice') {
                if (grp.leaderId == obj.id) grp.leaderId = null;
                appData.students.forEach(s => {
                    if (s.fixedGroup == fixedGroup && s.id != obj.id && s.fixedRole === 'vice') {
                        s.fixedRole = 'member';
                    }
                });
                grp.viceLeaderId = obj.id;
            } else {
                if (grp.leaderId == obj.id) grp.leaderId = null;
                if (grp.viceLeaderId == obj.id) grp.viceLeaderId = null;
            }
        }
    }

    // Đồng bộ index ủy quyền Firestore cho cán bộ lớp nếu có tài khoản
    if (accountEmail && currentUser) {
        try {
            setDoc(doc(firestoreDb, "CanBoLop", accountEmail), {
                teacherUid: currentUser.uid,
                role: accountRole,
                studentId: obj.id,
                studentName: obj.name,
                fixedGroup: obj.fixedGroup || null
            }).catch(e => console.warn("Lỗi sync CanBoLop:", e));
        } catch(e) {}
    }

    window.saveData(); 
    window.renderStudents(); 
    if (currentStudentTab === 'fixed') window.renderFixedGroups();
    window.closeModal('modal-add-student');
};

window.editStudent = function(id) { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền chỉnh sửa hồ sơ học sinh!", "error");
        return;
    }
    const stu = appData.students.find(s => s.id === id); 
    if(stu) { 
        document.getElementById('stu-id').value = stu.id; 
        document.getElementById('stu-name').value = stu.name; 
        document.getElementById('stu-gender').value = stu.gender || 'Nam'; 
        let fDob = stu.dob || ''; 
        if(fDob.includes('/')) { 
            const p = fDob.split('/'); 
            if(p.length===3) fDob = `${p[2]}-${p[1]}-${p[0]}`; 
        } 
        document.getElementById('stu-dob').value = fDob; 
        document.getElementById('stu-phone').value = stu.phone || ''; 

        if (document.getElementById('stu-account-email')) {
            document.getElementById('stu-account-email').value = stu.accountEmail || '';
        }
        if (document.getElementById('stu-account-role')) {
            document.getElementById('stu-account-role').value = stu.accountRole || 'none';
        }

        // Nạp danh sách tổ vào select
        const grpSelect = document.getElementById('stu-group');
        if (grpSelect) {
            let opts = '<option value="0">-- Chưa phân tổ --</option>';
            if (appData.fixedGroups) {
                appData.fixedGroups.forEach(g => {
                    opts += `<option value="${g.id}">${g.name}</option>`;
                });
            }
            grpSelect.innerHTML = opts;
            grpSelect.value = stu.fixedGroup || 0;
        }

        const roleSelect = document.getElementById('stu-role');
        if (roleSelect) {
            roleSelect.value = stu.fixedRole || 'member';
        }

        window.openModal('modal-add-student'); 
    } 
};

window.deleteStudent = function(id) { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xóa học sinh!", "error");
        return;
    }
    if(confirm("Xác nhận xóa học sinh này?")) { 
        appData.students = appData.students.filter(s => s.id !== id); 
        window.saveData(); 
        window.renderStudents(); 
        if (currentStudentTab === 'fixed') window.renderFixedGroups();
        window.showToast("Đã xóa học sinh"); 
    } 
};

// ================= HỆ THỐNG TỔ CỐ ĐỊNH =================
window.renderFixedGroups = function() {
    const container = document.getElementById('fixed-groups-list') || document.getElementById('fixed-groups-container');
    if (!container) return;

    if (!appData.fixedGroups || !Array.isArray(appData.fixedGroups)) {
        appData.fixedGroups = JSON.parse(JSON.stringify(defaultFixedGroups));
    }

    if (appData.fixedGroups.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 35px 20px; background: white; border-radius: 16px; border: 2px dashed #cbd5e1;">
                <i class="fas fa-users-slash" style="font-size: 2.2rem; color: #94a3b8; margin-bottom: 10px;"></i>
                <h4 style="color: var(--text-main); margin-bottom: 6px;">Chưa có tổ nào</h4>
                <p style="color: var(--text-muted); font-size: 0.85rem; margin-bottom: 16px;">Tạo các tổ cố định để quản lý nề nếp lớp học lâu dài.</p>
                <button class="btn-primary" onclick="addNewFixedGroup()"><i class="fas fa-plus"></i> + Thêm tổ mới</button>
            </div>`;
        return;
    }

    let html = '';
    appData.fixedGroups.forEach(g => {
        const members = appData.students.filter(s => s.fixedGroup == g.id);
        const leader = members.find(s => s.id == g.leaderId || s.fixedRole === 'leader');
        const vice = members.find(s => s.id == g.viceLeaderId || s.fixedRole === 'vice');

        // Tính tổng điểm thi đua của cả tổ trong tháng hiện tại
        let totalPoints = 0;
        const currentMonth = new Date().getMonth() + 1;
        members.forEach(m => {
            (appData.behaviorRecords || []).forEach(r => {
                const rMonth = new Date(r.date).getMonth() + 1;
                if (rMonth === currentMonth && r.studentId == m.id) {
                    totalPoints += Number(r.snapshotPoints || 0);
                }
            });
        });

        const pointsBadgeClass = totalPoints >= 0 ? 'bg-green-soft text-green' : 'bg-red-soft text-danger';
        const pointsSign = totalPoints > 0 ? `+${totalPoints}` : totalPoints;

        html += `
            <div class="fixed-group-card" id="fixed-group-card-${g.id}" style="margin-bottom: 16px;">
                <div class="fixed-group-header">
                    <div class="fixed-group-title">
                        <i class="fas fa-shield-alt text-primary"></i>
                        <span>${g.name.toUpperCase()}</span>
                        <span class="group-badge" style="background:#eff6ff; color:#1d4ed8; font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:12px;">
                            ${members.length} học sinh
                        </span>
                        <span class="group-badge ${pointsBadgeClass}" style="font-size:0.75rem; font-weight:700; padding:2px 8px; border-radius:12px;" title="Điểm thi đua tháng này">
                            ${pointsSign} điểm TĐ
                        </span>
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button class="btn-outline-action" onclick="window.quickRewardFixedGroup(${g.id})" title="Cộng/Trừ điểm thi đua cả tổ" style="color:var(--primary); width:34px; height:34px;"><i class="fas fa-award"></i></button>
                        <button class="btn-outline-action" onclick="window.renameFixedGroup(${g.id})" title="Sửa tên tổ" style="width:34px; height:34px;"><i class="fas fa-pen"></i></button>
                        <button class="btn-outline text-danger" onclick="window.deleteFixedGroup(${g.id})" title="Xóa tổ này" style="padding: 5px 10px; font-size: 0.78rem; font-weight: 700; border-color: #fecaca; background: #fff5f5; border-radius: 8px;">
                            <i class="fas fa-trash-alt"></i> Xóa tổ
                        </button>
                    </div>
                </div>

                <!-- KHU VỰC CÁN SỰ TỔ: TỔ TRƯỞNG & TỔ PHÓ -->
                <div class="fixed-group-meta" style="margin-bottom: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;">
                    <div class="fixed-group-meta-item">
                        <span class="fixed-group-meta-label" style="display:flex; align-items:center; gap:4px; color:#d97706; font-weight:700;">
                            <i class="fas fa-star text-orange"></i> Tổ trưởng:
                        </span>
                        <select onchange="window.setFixedGroupRole(${g.id}, this.value, 'leader')" style="width:100%; margin-top:3px; font-weight:700; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:var(--text-main); font-size:0.82rem; padding:4px 6px; cursor:pointer;">
                            <option value="">-- Chưa chọn Tổ trưởng --</option>
                            ${members.map(m => `<option value="${m.id}" ${(leader && leader.id === m.id) ? 'selected' : ''}>${m.name} (${m.gender})</option>`).join('')}
                        </select>
                    </div>
                    <div class="fixed-group-meta-item">
                        <span class="fixed-group-meta-label" style="display:flex; align-items:center; gap:4px; color:#0284c7; font-weight:700;">
                            <i class="fas fa-medal text-primary"></i> Tổ phó:
                        </span>
                        <select onchange="window.setFixedGroupRole(${g.id}, this.value, 'vice')" style="width:100%; margin-top:3px; font-weight:700; border:1px solid #cbd5e1; border-radius:6px; background:#fff; color:var(--text-main); font-size:0.82rem; padding:4px 6px; cursor:pointer;">
                            <option value="">-- Chưa chọn Tổ phó --</option>
                            ${members.map(m => `<option value="${m.id}" ${(vice && vice.id === m.id) ? 'selected' : ''}>${m.name} (${m.gender})</option>`).join('')}
                        </select>
                    </div>
                </div>

                <!-- NÚT THAO TÁC THÊM HỌC SINH -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <span style="font-size: 0.8rem; font-weight: 700; color: #475569;">Danh sách thành viên:</span>
                    <button class="btn-outline text-blue" style="padding: 4px 10px; font-size: 0.8rem; font-weight: 700; border-radius: 8px;" onclick="window.openAddStudentsToGroupModal(${g.id})">
                        <i class="fas fa-user-plus"></i> + Thêm học sinh
                    </button>
                </div>

                <!-- DANH SÁCH HỌC SINH ĐƯỢC ĐÁNH SỐ THỨ TỰ -->
                <div class="fixed-group-members" style="display: flex; flex-direction: column; gap: 6px;">
                    ${members.length === 0 ? `
                        <div style="text-align: center; padding: 16px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1; color: #64748b; font-size: 0.82rem;">
                            Chưa có học sinh trong tổ. Bấm <b>"+ Thêm học sinh"</b> ở trên để chọn học sinh vào tổ.
                        </div>
                    ` : members.map((m, idx) => {
                        let roleTag = '';
                        if (leader && leader.id === m.id) {
                            roleTag = `<span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:0.75rem; padding:2px 6px; border-radius:6px; font-weight:700;"><i class="fas fa-star"></i> Tổ trưởng</span>`;
                        } else if (vice && vice.id === m.id) {
                            roleTag = `<span class="badge" style="background:#e0f2fe; color:#0369a1; border:1px solid #bae6fd; font-size:0.75rem; padding:2px 6px; border-radius:6px; font-weight:700;"><i class="fas fa-medal"></i> Tổ phó</span>`;
                        }

                        return `
                            <div class="fixed-group-member-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 0.85rem;">
                                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                    <span style="font-weight: 700; color: #64748b; min-width: 22px;">${idx + 1}.</span>
                                    <strong style="color: var(--text-main);">${m.name}</strong>
                                    ${roleTag}
                                    <small style="color: #64748b;">(${m.gender})</small>
                                </div>
                                <button class="btn-outline-action text-danger" onclick="window.removeStudentFromGroup(${m.id})" title="Rút học sinh khỏi tổ" style="width:26px; height:26px; font-size:0.75rem; border-color:#fee2e2;">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

// Chuyển một học sinh sang tổ khác (Áp dụng cho cả Chọn từ danh sách và Modal)
window.transferStudentToGroup = function(studentId, targetGroupId, selectEl = null) {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền chuyển tổ cho học sinh!", "error");
        const curStu = (appData.students || []).find(s => s.id == studentId);
        if (selectEl && curStu) selectEl.value = String(curStu.fixedGroup || 0);
        return false;
    }

    const stu = appData.students.find(s => s.id == studentId);
    if (!stu) return false;

    const oldGroupId = stu.fixedGroup || 0;
    const newGroupId = parseInt(targetGroupId) || 0;

    if (oldGroupId === newGroupId) return false;

    // Cảnh báo nếu học sinh đang giữ vai trò Tổ trưởng hoặc Tổ phó
    if (oldGroupId !== 0 && (stu.fixedRole === 'leader' || stu.fixedRole === 'vice')) {
        const confirmMsg = "Học sinh này đang giữ vai trò Tổ trưởng/Tổ phó. Nếu chuyển tổ, vai trò hiện tại sẽ được gỡ bỏ. Bạn có chắc chắn muốn chuyển không?";
        if (!confirm(confirmMsg)) {
            if (selectEl) selectEl.value = String(oldGroupId);
            return false;
        }
        // Xóa vai trò ở tổ cũ
        const oldGrp = (appData.fixedGroups || []).find(g => g.id == oldGroupId);
        if (oldGrp) {
            if (oldGrp.leaderId == stu.id) oldGrp.leaderId = null;
            if (oldGrp.viceLeaderId == stu.id) oldGrp.viceLeaderId = null;
        }
    }

    // Đặt tổ mới và chuyển vai trò về học sinh bình thường
    stu.fixedGroup = newGroupId;
    stu.fixedRole = 'member';

    // Đảm bảo không bị trùng vai trò ở tổ mới
    if (newGroupId) {
        const newGrp = (appData.fixedGroups || []).find(g => g.id == newGroupId);
        if (newGrp) {
            if (newGrp.leaderId == stu.id) newGrp.leaderId = null;
            if (newGrp.viceLeaderId == stu.id) newGrp.viceLeaderId = null;
        }
    }

    window.saveData();
    window.renderStudents();
    window.renderFixedGroups();

    const targetName = newGroupId ? ((appData.fixedGroups || []).find(g => g.id == newGroupId)?.name || `Tổ ${newGroupId}`) : 'Chưa phân tổ';
    window.showToast(`Đã chuyển em ${stu.name} sang ${targetName}!`);
    return true;
};

// Tạo tổ mới
window.addNewFixedGroup = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền tạo tổ mới!", "error");
        return;
    }
    if (!appData.fixedGroups) appData.fixedGroups = [];
    const newId = appData.fixedGroups.length > 0 ? Math.max(...appData.fixedGroups.map(g => g.id)) + 1 : 1;
    const newName = `Tổ ${newId}`;
    appData.fixedGroups.push({
        id: newId,
        name: newName,
        leaderId: null,
        viceLeaderId: null
    });
    window.saveData();
    window.renderFixedGroups();
    window.renderStudents();
    window.showToast(`Đã thêm ${newName}!`);
};

// Xóa tổ (từ thẻ tổ)
window.deleteFixedGroup = function(groupId) {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xóa tổ!", "error");
        return;
    }
    const grp = (appData.fixedGroups || []).find(g => g.id == groupId);
    const grpName = grp ? grp.name : `Tổ ${groupId}`;
    const members = (appData.students || []).filter(s => s.fixedGroup == groupId);

    let confirmMsg = `Xác nhận xóa ${grpName}?`;
    if (members.length > 0) {
        confirmMsg += `\nLưu ý: Có ${members.length} học sinh đang thuộc tổ này. Khi xóa, các em sẽ tự động chuyển về trạng thái "Chưa phân tổ".`;
    }

    if (confirm(confirmMsg)) {
        appData.fixedGroups = appData.fixedGroups.filter(g => g.id != groupId);
        appData.students.forEach(s => {
            if (s.fixedGroup == groupId) {
                s.fixedGroup = 0;
                s.fixedRole = 'member';
            }
        });
        window.saveData();
        window.renderFixedGroups();
        window.renderStudents();
        window.showToast(`Đã xóa ${grpName}!`);

        const deleteModal = document.getElementById('modal-delete-fixed-group');
        if (deleteModal && deleteModal.style.display === 'flex') {
            if (appData.fixedGroups.length === 0) {
                window.closeModal('modal-delete-fixed-group');
            } else {
                window.renderDeleteFixedGroupsModal();
            }
        }
    }
};

// ================= MODAL XÓA TỔ CỐ ĐỊNH =================
window.openDeleteFixedGroupModal = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền mở quản lý xóa tổ!", "error");
        return;
    }
    if (!appData.fixedGroups || appData.fixedGroups.length === 0) {
        window.showToast("Hiện tại lớp chưa có tổ nào để xóa!", "warning");
        return;
    }
    window.renderDeleteFixedGroupsModal();
    window.openModal('modal-delete-fixed-group');
};

window.deleteEmptyFixedGroups = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xóa tổ trống!", "error");
        return;
    }
    if (!appData.fixedGroups || appData.fixedGroups.length === 0) return;
    const emptyGroups = appData.fixedGroups.filter(g => {
        const count = (appData.students || []).filter(s => s.fixedGroup == g.id).length;
        return count === 0;
    });

    if (emptyGroups.length === 0) {
        window.showToast("Không có tổ trống nào (tất cả các tổ đều đang có học sinh)!", "info");
        return;
    }

    const groupNames = emptyGroups.map(g => g.name).join(', ');
    if (confirm(`Bạn có chắc chắn muốn xóa ${emptyGroups.length} tổ trống (${groupNames}) tạo nhầm không?`)) {
        appData.fixedGroups = appData.fixedGroups.filter(g => !emptyGroups.some(eg => eg.id === g.id));
        window.saveData();
        window.renderFixedGroups();
        window.renderStudents();
        window.showToast(`Đã xóa sạch ${emptyGroups.length} tổ trống tạo nhầm!`);

        const deleteModal = document.getElementById('modal-delete-fixed-group');
        if (deleteModal && deleteModal.style.display === 'flex') {
            if (appData.fixedGroups.length === 0) {
                window.closeModal('modal-delete-fixed-group');
            } else {
                window.renderDeleteFixedGroupsModal();
            }
        }
    }
};

window.renderDeleteFixedGroupsModal = function() {
    const container = document.getElementById('delete-fixed-groups-list');
    if (!container) return;

    if (!appData.fixedGroups || appData.fixedGroups.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 25px 15px; color: #64748b;">
                <i class="fas fa-check-circle" style="font-size: 2rem; color: var(--success); margin-bottom: 8px;"></i>
                <p style="font-weight: 600;">Không còn tổ nào trong danh sách.</p>
            </div>
        `;
        return;
    }

    const emptyCount = appData.fixedGroups.filter(g => (appData.students || []).filter(s => s.fixedGroup == g.id).length === 0).length;

    let html = '';
    if (emptyCount > 0) {
        html += `
            <button class="btn-outline text-danger mb-15 w-full" style="padding: 10px; font-size: 0.85rem; font-weight: 700; border-color: #fecaca; background: #fff1f2;" onclick="window.deleteEmptyFixedGroups()">
                <i class="fas fa-broom"></i> Xóa nhanh ${emptyCount} tổ trống (0 học sinh) tạo nhầm
            </button>
        `;
    }

    appData.fixedGroups.forEach(g => {
        const memberCount = (appData.students || []).filter(s => s.fixedGroup == g.id).length;
        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 14px; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: var(--shadow-sm);">
                <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
                        <i class="fas fa-shield-alt text-primary"></i> ${g.name}
                    </div>
                    <div style="font-size: 0.8rem; color: #64748b; margin-top: 3px;">
                        ${memberCount > 0 ? `<b style="color:var(--primary);">${memberCount}</b> học sinh trong tổ` : `<span style="color:#ef4444; font-weight:600;">Tổ trống (0 học sinh)</span>`}
                    </div>
                </div>
                <button class="btn-outline text-danger" style="padding: 7px 12px; font-size: 0.82rem; font-weight: 700; border-color: #fecaca; background: #fff5f5; border-radius: 8px;" onclick="window.deleteFixedGroup(${g.id})">
                    <i class="fas fa-trash-alt"></i> Xóa tổ
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
};

// Sửa tên tổ
window.renameFixedGroup = function(groupId) {
    const grp = appData.fixedGroups.find(g => g.id == groupId);
    if (!grp) return;
    const newName = prompt("Nhập tên mới cho tổ:", grp.name);
    if (newName && newName.trim()) {
        grp.name = newName.trim();
        window.saveData();
        window.renderFixedGroups();
        window.renderStudents();
        window.showToast("Đã đổi tên tổ!");
    }
};

// Phân công Tổ trưởng và Tổ phó với đầy đủ quy tắc kiểm tra ràng buộc
window.setFixedGroupRole = function(groupId, studentId, role) {
    const grp = appData.fixedGroups.find(g => g.id == groupId);
    if (!grp) return;

    const sId = studentId ? parseInt(studentId) : null;
    const members = appData.students.filter(s => s.fixedGroup == groupId);

    if (sId) {
        const candidate = members.find(s => s.id == sId);
        if (!candidate) {
            window.showToast("Học sinh này không thuộc tổ!", "error");
            return;
        }

        if (role === 'leader') {
            // Quy tắc: 1 học sinh không được đồng thời là Tổ trưởng và Tổ phó
            if (grp.viceLeaderId == sId) {
                grp.viceLeaderId = null;
            }
            grp.leaderId = sId;
        } else if (role === 'vice') {
            // Quy tắc: 1 học sinh không được đồng thời là Tổ trưởng và Tổ phó
            if (grp.leaderId == sId) {
                grp.leaderId = null;
            }
            grp.viceLeaderId = sId;
        }
    } else {
        // Gỡ bỏ vai trò
        if (role === 'leader') grp.leaderId = null;
        if (role === 'vice') grp.viceLeaderId = null;
    }

    // Đồng bộ vai trò fixedRole cho từng học sinh trong tổ
    members.forEach(s => {
        if (s.id == grp.leaderId) {
            s.fixedRole = 'leader';
        } else if (s.id == grp.viceLeaderId) {
            s.fixedRole = 'vice';
        } else {
            s.fixedRole = 'member';
        }
    });

    window.saveData();
    window.renderFixedGroups();
    window.renderStudents();
    window.showToast("Đã cập nhật cán sự tổ!");
};

// Rút một học sinh khỏi tổ
window.removeStudentFromGroup = function(studentId) {
    const stu = appData.students.find(s => s.id == studentId);
    if (!stu) return;

    if (stu.fixedRole === 'leader' || stu.fixedRole === 'vice') {
        const confirmMsg = "Học sinh này đang giữ vai trò Tổ trưởng/Tổ phó. Bạn có chắc chắn muốn rút em khỏi tổ không?";
        if (!confirm(confirmMsg)) return;
    }

    const oldGrp = (appData.fixedGroups || []).find(g => g.id == stu.fixedGroup);
    if (oldGrp) {
        if (oldGrp.leaderId == stu.id) oldGrp.leaderId = null;
        if (oldGrp.viceLeaderId == stu.id) oldGrp.viceLeaderId = null;
    }

    stu.fixedGroup = 0;
    stu.fixedRole = 'member';

    window.saveData();
    window.renderFixedGroups();
    window.renderStudents();
    window.showToast(`Đã rút em ${stu.name} khỏi tổ!`);
};

// ================= MODAL THÊM HỌC SINH VÀO TỔ =================
window.currentAddGroupTargetId = null;

window.openAddStudentsToGroupModal = function(groupId) {
    const grp = (appData.fixedGroups || []).find(g => g.id == groupId);
    if (!grp) return;

    window.currentAddGroupTargetId = groupId;
    const targetInput = document.getElementById('add-students-target-group-id');
    if (targetInput) targetInput.value = groupId;

    const titleEl = document.getElementById('add-students-group-title');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-user-plus text-primary"></i> Thêm học sinh vào ${grp.name}`;

    const searchInput = document.getElementById('search-student-for-group');
    if (searchInput) searchInput.value = '';

    window.renderStudentsForGroupModal();
    window.openModal('modal-add-students-to-group');
};

window.renderStudentsForGroupModal = function() {
    const listContainer = document.getElementById('add-students-group-list');
    if (!listContainer) return;

    const targetGroupId = window.currentAddGroupTargetId;
    const query = (document.getElementById('search-student-for-group')?.value || '').toLowerCase().trim();

    // Lấy tất cả học sinh KHÔNG thuộc tổ hiện tại
    let eligibleStudents = appData.students.filter(s => s.fixedGroup != targetGroupId);

    if (query) {
        eligibleStudents = eligibleStudents.filter(s => s.name.toLowerCase().includes(query));
    }

    const infoEl = document.getElementById('add-students-count-info');
    if (infoEl) {
        infoEl.innerText = `Có ${eligibleStudents.length} học sinh có thể thêm vào:`;
    }

    if (eligibleStudents.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align:center; padding:20px; color:#64748b; font-size:0.85rem;">
                Không tìm thấy học sinh phù hợp.
            </div>`;
        return;
    }

    let html = '';
    eligibleStudents.forEach(stu => {
        let statusBadge = '';
        if (!stu.fixedGroup || stu.fixedGroup == 0) {
            statusBadge = `<span class="badge" style="background:#f1f5f9; color:#475569; font-size:0.72rem; padding:2px 6px; border-radius:4px;">Chưa phân tổ</span>`;
        } else {
            const currentG = (appData.fixedGroups || []).find(g => g.id == stu.fixedGroup);
            const gName = currentG ? currentG.name : `Tổ ${stu.fixedGroup}`;
            let roleNote = '';
            if (stu.fixedRole === 'leader') roleNote = ' (⭐ Tổ trưởng)';
            else if (stu.fixedRole === 'vice') roleNote = ' (🎖️ Tổ phó)';
            statusBadge = `<span class="badge" style="background:#e0f2fe; color:#0369a1; font-size:0.72rem; padding:2px 6px; border-radius:4px;">Đang ở ${gName}${roleNote}</span>`;
        }

        html += `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1; margin-bottom: 0;">
                    <input type="checkbox" class="chk-add-student-to-grp" value="${stu.id}" style="width: 16px; height: 16px; cursor: pointer;">
                    <div>
                        <strong>${stu.name}</strong> <small style="color:#64748b;">(${stu.gender})</small>
                        <div style="margin-top: 2px;">${statusBadge}</div>
                    </div>
                </label>
                <button class="btn-outline text-blue" style="font-size: 0.75rem; padding: 4px 8px; font-weight: 700;" onclick="window.quickAddSingleStudentToGroup(${stu.id})">
                    + Thêm ngay
                </button>
            </div>
        `;
    });

    listContainer.innerHTML = html;
};

window.toggleSelectAllStudentsForGroup = function() {
    const checkboxes = document.querySelectorAll('.chk-add-student-to-grp');
    if (checkboxes.length === 0) return;
    const allChecked = Array.from(checkboxes).every(c => c.checked);
    checkboxes.forEach(c => c.checked = !allChecked);
};

window.quickAddSingleStudentToGroup = function(studentId) {
    if (!window.currentAddGroupTargetId) return;
    const ok = window.transferStudentToGroup(studentId, window.currentAddGroupTargetId);
    if (ok) {
        window.renderStudentsForGroupModal();
    }
};

window.confirmBatchAddStudentsToGroup = function() {
    const targetGroupId = window.currentAddGroupTargetId;
    if (!targetGroupId) return;

    const checkboxes = document.querySelectorAll('.chk-add-student-to-grp:checked');
    if (checkboxes.length === 0) {
        return window.showToast("Vui lòng chọn ít nhất một học sinh!", "error");
    }

    let addedCount = 0;
    for (const chk of checkboxes) {
        const stuId = parseInt(chk.value);
        const ok = window.transferStudentToGroup(stuId, targetGroupId);
        if (ok) addedCount++;
    }

    if (addedCount > 0) {
        window.closeModal('modal-add-students-to-group');
        window.showToast(`🎉 Đã thêm ${addedCount} học sinh vào tổ thành công!`);
    }
};

window.quickRewardFixedGroup = function(groupId) {
    const grp = appData.fixedGroups.find(g => g.id == groupId);
    if (!grp) return;
    const members = appData.students.filter(s => s.fixedGroup == groupId);
    if (members.length === 0) return window.showToast("Tổ này chưa có thành viên!", "error");

    const ptsStr = prompt(`Cộng/Trừ điểm thi đua cho TẤT CẢ ${members.length} học sinh ${grp.name}:\n(Nhập số dương VD: 2 để cộng điểm, số âm VD: -1 để trừ điểm)`, "1");
    if (ptsStr === null) return;
    const pts = parseInt(ptsStr);
    if (isNaN(pts) || pts === 0) return window.showToast("Số điểm không hợp lệ!", "error");

    const note = prompt("Lý do ghi nhận thi đua:", pts > 0 ? "Khen ngợi nề nếp tổ" : "Vi phạm nề nếp tổ") || "Thi đua tổ";

    members.forEach(stu => {
        appData.behaviorRecords.push({
            id: Date.now() + Math.random(),
            studentId: stu.id,
            tagId: "custom_group",
            tagName: `[${grp.name}] ${note}`,
            type: pts > 0 ? 'positive' : 'negative',
            snapshotPoints: pts,
            note: note,
            date: getTodayStr()
        });
    });

    window.saveData();
    window.renderFixedGroups();
    window.showToast(`🎉 Đã ${pts > 0 ? 'cộng' : 'trừ'} ${Math.abs(pts)} điểm cho toàn bộ ${grp.name}!`);
};

window.openAutoGroupModal = function() {
    window.openModal('modal-auto-fixed-groups');
};

window.executeAutoFixedGroups = function() {
    if (appData.students.length === 0) {
        return window.showToast("Chưa có học sinh nào trong danh sách lớp!", "error");
    }

    const count = parseInt(document.getElementById('auto-group-count').value) || 4;
    const method = document.getElementById('auto-group-method').value;

    if (!appData.fixedGroups) appData.fixedGroups = [];
    while (appData.fixedGroups.length < count) {
        const nextId = appData.fixedGroups.length + 1;
        appData.fixedGroups.push({ id: nextId, name: `Tổ ${nextId}`, leaderId: null, viceLeaderId: null });
    }
    const activeGroups = appData.fixedGroups.slice(0, count);

    let sortedStudents = [...appData.students];

    if (method === 'balanced_gender') {
        const males = sortedStudents.filter(s => (s.gender || 'Nam').toLowerCase() === 'nam').sort(() => Math.random() - 0.5);
        const females = sortedStudents.filter(s => (s.gender || 'Nam').toLowerCase() !== 'nam').sort(() => Math.random() - 0.5);
        
        males.forEach((stu, idx) => {
            const targetGroup = activeGroups[idx % count];
            stu.fixedGroup = targetGroup.id;
            stu.fixedRole = 'member';
        });
        females.forEach((stu, idx) => {
            const targetGroup = activeGroups[(count - 1 - (idx % count)) % count];
            stu.fixedGroup = targetGroup.id;
            stu.fixedRole = 'member';
        });
    } else if (method === 'random') {
        sortedStudents.sort(() => Math.random() - 0.5).forEach((stu, idx) => {
            const targetGroup = activeGroups[idx % count];
            stu.fixedGroup = targetGroup.id;
            stu.fixedRole = 'member';
        });
    } else {
        // sequential
        sortedStudents.forEach((stu, idx) => {
            const targetGroup = activeGroups[idx % count];
            stu.fixedGroup = targetGroup.id;
            stu.fixedRole = 'member';
        });
    }

    window.saveData();
    window.closeModal('modal-auto-fixed-groups');
    window.renderFixedGroups();
    window.renderStudents();
    window.showToast(`🎉 Đã tự động chia ${appData.students.length} học sinh thành ${count} tổ!`);
};

// ================= HỆ THỐNG NHÓM HOẠT ĐỘNG LINH HOẠT TRONG GIỜ HỌC =================
window.updateActivitySplitLabel = function() {
    const mode = document.getElementById('act-split-mode').value;
    const label = document.getElementById('act-split-label');
    const input = document.getElementById('act-split-num');
    if (mode === 'by_group_count') {
        label.innerText = 'Số lượng nhóm cần tạo';
        input.value = 4;
        input.min = 2;
        input.max = 12;
    } else {
        label.innerText = 'Số học sinh mỗi nhóm';
        input.value = 5;
        input.min = 2;
        input.max = 20;
    }
};

const coolGroupNames = [
    "Đại Bàng Vàng", "Rồng Thần Tốc", "Sư Tử Trẻ", "Phượng Hoàng Lửa", 
    "Chiến Binh Ánh Sáng", "Đoàn Kết Vững Vàng", "Tia Chớp Xanh", "Bứt Phá Vươn Xa",
    "Khám Phá Tri Thức", "Sáng Tạo Đỉnh Cao", "Vô Địch", "Ngôi Sao Hy Vọng"
];

window.generateFlexibleGroups = function() {
    if (appData.students.length === 0) {
        return window.showToast("Chưa có học sinh nào trong lớp!", "error");
    }

    const mode = document.getElementById('act-split-mode').value;
    const num = parseInt(document.getElementById('act-split-num').value) || 4;
    const criteria = document.getElementById('act-split-criteria').value;
    const naming = document.getElementById('act-naming-style').value;

    let totalStudents = appData.students.length;
    let groupCount = 4;

    if (mode === 'by_group_count') {
        groupCount = Math.max(1, Math.min(num, totalStudents));
    } else {
        groupCount = Math.max(1, Math.ceil(totalStudents / Math.max(1, num)));
    }

    let studentsToDistribute = [...appData.students];

    if (criteria === 'random') {
        studentsToDistribute.sort(() => Math.random() - 0.5);
    } else if (criteria === 'balanced_gender') {
        const males = studentsToDistribute.filter(s => (s.gender || 'Nam').toLowerCase() === 'nam').sort(() => Math.random() - 0.5);
        const females = studentsToDistribute.filter(s => (s.gender || 'Nam').toLowerCase() !== 'nam').sort(() => Math.random() - 0.5);
        studentsToDistribute = [];
        let maxLen = Math.max(males.length, females.length);
        for(let i = 0; i < maxLen; i++) {
            if (i < males.length) studentsToDistribute.push(males[i]);
            if (i < females.length) studentsToDistribute.push(females[i]);
        }
    } else if (criteria === 'balanced_points') {
        // Cân bằng theo điểm thi đua
        const currentMonth = new Date().getMonth() + 1;
        studentsToDistribute.forEach(s => {
            let pts = 0;
            (appData.behaviorRecords || []).forEach(r => {
                if (new Date(r.date).getMonth() + 1 === currentMonth && r.studentId == s.id) {
                    pts += Number(r.snapshotPoints || 0);
                }
            });
            s._tmpPoints = pts;
        });
        studentsToDistribute.sort((a, b) => b._tmpPoints - a._tmpPoints);
    }

    const newGroups = [];
    for(let i = 0; i < groupCount; i++) {
        let gName = `Nhóm ${i + 1}`;
        if (naming === 'letters') {
            gName = `Nhóm ${String.fromCharCode(65 + i)}`;
        } else if (naming === 'cool_names') {
            gName = coolGroupNames[i % coolGroupNames.length];
        }
        newGroups.push({
            id: i + 1,
            name: gName,
            members: []
        });
    }

    studentsToDistribute.forEach((stu, idx) => {
        let targetGroupIdx = idx % groupCount;
        newGroups[targetGroupIdx].members.push(stu.id);
    });

    appData.flexibleGroups = newGroups;
    window.saveData();
    window.renderActivityGroups();
    playChime('win');
    window.showToast(`🎉 Đã chia ${totalStudents} học sinh thành ${newGroups.length} nhóm hoạt động!`);
};

window.reshuffleFlexibleGroups = function() {
    if (!appData.flexibleGroups || appData.flexibleGroups.length === 0) {
        return window.generateFlexibleGroups();
    }
    const groupCount = appData.flexibleGroups.length;
    const shuffledStudents = [...appData.students].sort(() => Math.random() - 0.5);

    appData.flexibleGroups.forEach(g => g.members = []);
    shuffledStudents.forEach((stu, idx) => {
        appData.flexibleGroups[idx % groupCount].members.push(stu.id);
    });

    window.saveData();
    window.renderActivityGroups();
    playChime('win');
    window.showToast("🎲 Đã xáo trộn ngẫu nhiên thành viên các nhóm!");
};

window.renderActivityGroups = function() {
    const container = document.getElementById('activity-groups-container');
    if (!container) return;

    if (!appData.flexibleGroups || appData.flexibleGroups.length === 0) {
        container.innerHTML = `
            <div class="empty-state" style="padding: 30px; background:white; border-radius:16px; border:2px dashed #cbd5e1; text-align:center;">
                <div style="font-size:3rem; margin-bottom:10px;">🎲</div>
                <h4>Chưa tạo nhóm hoạt động</h4>
                <p class="text-sm text-muted">Chọn tiêu chí ở bảng trên rồi bấm <b>"Tạo nhóm hoạt động"</b> để chia nhóm tức thì trong giờ học!</p>
            </div>
        `;
        return;
    }

    let html = '';
    appData.flexibleGroups.forEach(g => {
        const memberList = appData.students.filter(s => (g.members || []).includes(s.id));
        html += `
            <div class="act-group-card">
                <div class="act-group-header">
                    <div class="act-group-title">
                        <i class="fas fa-users-cog"></i> ${g.name}
                        <span class="group-badge" style="background:white; color:var(--text-main); font-weight:700;">${memberList.length} bạn</span>
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-outline-action" style="color:white; border-color:rgba(255,255,255,0.4);" onclick="window.pickRandomMemberOfGroup(${g.id})" title="Bốc thăm 1 bạn đại diện nhóm"><i class="fas fa-dice"></i></button>
                        <button class="btn-outline-action" style="color:white; border-color:rgba(255,255,255,0.4);" onclick="window.rewardFlexibleGroup(${g.id}, 1)" title="Thưởng +1 điểm cả nhóm"><i class="fas fa-plus"></i>1</button>
                        <button class="btn-outline-action" style="color:white; border-color:rgba(255,255,255,0.4);" onclick="window.rewardFlexibleGroup(${g.id}, 2)" title="Thưởng +2 điểm cả nhóm"><i class="fas fa-plus"></i>2</button>
                    </div>
                </div>
                <div class="act-members-box">
                    ${memberList.length === 0 ? '<div class="text-sm text-muted">Trống</div>' : ''}
                    ${memberList.map(m => `
                        <div class="member-pill">
                            <span><b>${m.name}</b> <small style="color:#64748b;">(${m.gender})</small></span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.rewardFlexibleGroup = function(groupId, points = 1) {
    const grp = (appData.flexibleGroups || []).find(g => g.id == groupId);
    if (!grp) return;
    const memberList = appData.students.filter(s => (grp.members || []).includes(s.id));
    if (memberList.length === 0) return window.showToast("Nhóm không có học sinh nào!", "error");

    memberList.forEach(stu => {
        appData.behaviorRecords.push({
            id: Date.now() + Math.random(),
            studentId: stu.id,
            tagId: "act_group_reward",
            tagName: `[${grp.name}] Hoạt động nhóm tích cực`,
            type: 'positive',
            snapshotPoints: points,
            note: `Thưởng hoạt động nhóm: ${grp.name}`,
            date: getTodayStr()
        });
    });

    window.saveData();
    playChime('win');
    window.showToast(`🎉 Đã thưởng +${points} điểm cho ${memberList.length} thành viên ${grp.name}!`);
};

// VÒNG QUAY BỐC THĂM / QUAY SỐ TRONG GIỜ HỌC
window.pickRandomGroup = function() {
    if (!appData.flexibleGroups || appData.flexibleGroups.length === 0) {
        return window.showToast("Chưa có nhóm hoạt động nào! Hãy bấm Tạo nhóm trước.", "error");
    }
    lastPickerMode = 'group';
    window.startLotteryAnimation(
        '🎯 Bốc thăm Nhóm lên bảng',
        'Đang chọn nhóm ngẫu nhiên...',
        appData.flexibleGroups.map(g => ({ title: g.name, extra: `${(g.members||[]).length} thành viên`, obj: g }))
    );
};

window.pickRandomStudentAnywhere = function() {
    if (appData.students.length === 0) {
        return window.showToast("Chưa có học sinh trong danh sách!", "error");
    }
    lastPickerMode = 'student';
    window.startLotteryAnimation(
        '🌟 Vòng quay may mắn gọi học sinh',
        'Đang chọn bạn ngẫu nhiên...',
        appData.students.map(s => {
            const gObj = (appData.fixedGroups || []).find(g => g.id == s.fixedGroup);
            return {
                title: s.name,
                extra: `${s.gender} • ${gObj ? gObj.name : 'Chưa phân tổ'}`,
                obj: s
            };
        })
    );
};

window.pickRandomMemberOfGroup = function(groupId) {
    const grp = (appData.flexibleGroups || []).find(g => g.id == groupId);
    if (!grp) return;
    const memberList = appData.students.filter(s => (grp.members || []).includes(s.id));
    if (memberList.length === 0) return window.showToast("Nhóm này trống!", "error");

    lastPickerMode = 'member';
    lastPickerGroupId = groupId;
    window.startLotteryAnimation(
        `🎯 Đại diện ${grp.name}`,
        `Đang chọn đại diện của ${grp.name}...`,
        memberList.map(s => ({
            title: s.name,
            extra: `Đại diện phát biểu cho ${grp.name}`,
            obj: s
        }))
    );
};

window.retriggerPicker = function() {
    if (lastPickerMode === 'group') window.pickRandomGroup();
    else if (lastPickerMode === 'member') window.pickRandomMemberOfGroup(lastPickerGroupId);
    else window.pickRandomStudentAnywhere();
};

window.startLotteryAnimation = function(title, subtext, items) {
    document.getElementById('random-picker-title').innerText = title;
    document.getElementById('lottery-subtext').innerText = subtext;
    const winnerEl = document.getElementById('lottery-winner');
    const extraEl = document.getElementById('lottery-extra');
    const iconEl = document.getElementById('lottery-icon');
    const spinBtn = document.getElementById('btn-spin-again');

    winnerEl.innerText = 'Đang quay...';
    extraEl.innerText = '';
    iconEl.innerText = '🎲';
    spinBtn.disabled = true;

    window.openModal('modal-random-picker');

    let rollCount = 0;
    const totalRolls = 18;
    const interval = setInterval(() => {
        rollCount++;
        playChime('tick');
        const randItem = items[Math.floor(Math.random() * items.length)];
        winnerEl.innerText = randItem.title;
        extraEl.innerText = randItem.extra || '';

        if (rollCount >= totalRolls) {
            clearInterval(interval);
            const finalPick = items[Math.floor(Math.random() * items.length)];
            winnerEl.innerText = `✨ ${finalPick.title} ✨`;
            extraEl.innerText = finalPick.extra || '';
            iconEl.innerText = '🎉';
            spinBtn.disabled = false;
            playChime('win');
        }
    }, 85);
};

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

window.confirmImport = function() { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền nhập dữ liệu từ Excel!", "error");
        return;
    }
    let c = 0; parsedStudents.forEach(stu => { appData.students.push({ id: Date.now() + c, name: stu.name, gender: stu.gender, dob: stu.dob, phone: stu.phone, note: "", accountRole: 'none', accountEmail: '' }); c++; }); window.saveData(); window.renderStudents(); window.closeModal('modal-import-excel'); window.showToast(`Đã nhập ${c} HS!`); 
}
window.exportExcel = function() { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xuất dữ liệu Excel!", "error");
        return;
    }
    if(appData.students.length === 0) return window.showToast("Lớp trống!", "error"); let ws_data = [["STT", "Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại"]]; appData.students.forEach((stu, i) => { ws_data.push([i+1, stu.name, stu.dob||"", stu.gender||"", stu.phone||""]); }); XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet(ws_data), "DS"), `DS_Lop.xlsx`); window.showToast("Đã xuất Excel!"); 
}
window.downloadTemplate = function() { XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet([["Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại"]]), "Mau"), `File_Mau.xlsx`); window.showToast("Đã tải!"); }

window.renderAttendance = function() {
    const date = document.getElementById('attendance-date').value; 
    const list = document.getElementById('attendance-list'); 
    list.innerHTML = '';
    
    if(!appData.attendance[date]) { 
        appData.attendance[date] = {}; 
        appData.students.forEach(s => appData.attendance[date][s.id] = 'present'); 
    }
    
    let stats = { present: 0, excused: 0, unexcused: 0 }; 
    const records = appData.attendance[date];

    // Banner hướng dẫn nếu là Cán bộ lớp / Tổ trưởng
    if (window.isGroupLeader()) {
        const myG = window.authRole.fixedGroup || 1;
        list.innerHTML += `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 14px; margin-bottom:12px; font-size:0.83rem; color:#b45309; font-weight:700; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-shield-alt" style="font-size:1.1rem;"></i>
                <span>Bạn đang đăng nhập vai trò: <b>Tổ trưởng Tổ ${myG}</b>. Bạn chỉ có quyền điểm danh học sinh thuộc Tổ ${myG}.</span>
            </div>`;
    } else if (window.isClassLeader() || window.isClassVice()) {
        const titleRole = window.isClassLeader() ? "Lớp trưởng" : "Lớp phó";
        list.innerHTML += `
            <div style="background:#ecfdf5; border:1px solid #a7f3d0; border-radius:10px; padding:10px 14px; margin-bottom:12px; font-size:0.83rem; color:#047857; font-weight:700; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-user-check" style="font-size:1.1rem;"></i>
                <span>Bạn đang đăng nhập vai trò: <b>${titleRole}</b>. Bạn có quyền điểm danh toàn bộ học sinh trong lớp.</span>
            </div>`;
    }

    appData.students.forEach((stu, index) => {
        const status = records[stu.id] || 'present'; 
        stats[status]++;

        const canMark = window.hasPermission('attendance:mark', stu);
        const disabledStyle = canMark ? '' : 'opacity: 0.35; cursor: not-allowed;';
        
        let gInfo = '';
        if (stu.fixedGroup && stu.fixedGroup != 0) {
            const grp = (appData.fixedGroups || []).find(g => g.id == stu.fixedGroup);
            gInfo = `<span style="font-size:0.75rem; color:#64748b; margin-left:6px;">(${grp ? grp.name : 'Tổ ' + stu.fixedGroup})</span>`;
        }

        const lockIcon = canMark ? '' : `<i class="fas fa-lock" style="font-size:0.75rem; color:#94a3b8; margin-left:6px;" title="Không thuộc phân quyền của bạn"></i>`;

        list.innerHTML += `
            <div class="list-item" style="align-items:center;">
                <div class="list-item-info">
                    <div style="display:flex; align-items:center;">
                        <strong>${index + 1}. ${stu.name}</strong> 
                        ${gInfo} 
                        ${lockIcon}
                    </div>
                </div>
                <div class="attendance-opts">
                    <button class="att-btn ${status === 'present' ? 'active' : ''}" style="${disabledStyle}" data-status="present" onclick="setAtt(this, ${stu.id}, 'present')"><i class="fas fa-check"></i></button>
                    <button class="att-btn ${status === 'excused' ? 'active' : ''}" style="${disabledStyle}" data-status="excused" onclick="setAtt(this, ${stu.id}, 'excused')"><i class="fas fa-exclamation"></i></button>
                    <button class="att-btn ${status === 'unexcused' ? 'active' : ''}" style="${disabledStyle}" data-status="unexcused" onclick="setAtt(this, ${stu.id}, 'unexcused')"><i class="fas fa-times"></i></button>
                </div>
            </div>`;
    });
    document.getElementById('attendance-summary').innerHTML = `<span style="color:var(--success)"><i class="fas fa-check-circle"></i> Có mặt: ${stats.present}</span><span style="color:var(--warning)"><i class="fas fa-exclamation-circle"></i> Phép: ${stats.excused}</span><span style="color:var(--danger)"><i class="fas fa-times-circle"></i> K.Phép: ${stats.unexcused}</span>`;
}

window.setAtt = function(btn, stuId, status) {
    const stu = (appData.students || []).find(s => s.id == stuId);
    if (!window.hasPermission('attendance:mark', stu)) {
        if (window.isGroupLeader()) {
            window.showToast(`Từ chối: Bạn là Tổ trưởng Tổ ${window.authRole.fixedGroup}, không thể điểm danh học sinh Tổ khác!`, "error");
        } else if (window.authRole.role === 'none') {
            window.showToast("Từ chối: Tài khoản của bạn chưa được cấp quyền điểm danh!", "error");
        } else {
            window.showToast("Từ chối: Bạn không có quyền điểm danh học sinh này!", "error");
        }
        return;
    }

    const parent = btn.parentElement; 
    parent.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active')); 
    btn.classList.add('active');
    
    const date = document.getElementById('attendance-date').value; 
    appData.attendance[date][stuId] = status;
    
    if(status === 'unexcused' && appData.settings.autoAbsentDisc) { 
        let tag = appData.behaviorTags.find(t => t.name.toLowerCase().includes('nội quy') || t.name.toLowerCase().includes('vắng')); 
        if(tag) window.autoCreateBehavior(stuId, tag, date, "Hệ thống tự ghi nhận vắng không phép"); 
    }
    window.renderAttendance(); 
}

window.saveAttendance = function() { 
    if (!window.hasPermission('attendance:save')) {
        window.showToast("Từ chối: Tài khoản của bạn không có quyền lưu điểm danh!", "error");
        return;
    }
    window.saveData(); 
    window.showToast("✅ Đã lưu Điểm danh!"); 
    window.switchView('view-home'); 
}

let currentDiscStuId = null, currentBehaviorTab = 'negative';
window.renderDisciplineStudents = function() {
    const txt = document.getElementById('search-disc-student').value.toLowerCase(); 
    const list = document.getElementById('discipline-student-list'); 
    list.innerHTML = '';
    
    if (window.isGroupLeader()) {
        const myG = window.authRole.fixedGroup || 1;
        list.innerHTML += `
            <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:10px 14px; margin-bottom:12px; font-size:0.83rem; color:#b45309; font-weight:700; display:flex; align-items:center; gap:8px;">
                <i class="fas fa-shield-alt" style="font-size:1.1rem;"></i>
                <span>Bạn đang đăng nhập: <b>Tổ trưởng Tổ ${myG}</b>. Bạn chỉ có quyền ghi nhận nề nếp cho thành viên Tổ ${myG}.</span>
            </div>`;
    }

    let ptsMap = {}; 
    appData.behaviorRecords.forEach(r => { ptsMap[r.studentId] = (ptsMap[r.studentId] || 0) + Number(r.snapshotPoints); });
    
    appData.students.filter(s => s.name.toLowerCase().includes(txt)).forEach(stu => {
        let pts = ptsMap[stu.id] || 0; 
        let color = pts > 0 ? 'var(--success)' : (pts < 0 ? 'var(--danger)' : 'var(--text-muted)');
        const canRecord = window.hasPermission('behavior:record', stu);

        let gInfo = '';
        if (stu.fixedGroup && stu.fixedGroup != 0) {
            const grp = (appData.fixedGroups || []).find(g => g.id == stu.fixedGroup);
            gInfo = `<span style="font-size:0.75rem; color:#64748b; margin-left:6px;">(${grp ? grp.name : 'Tổ ' + stu.fixedGroup})</span>`;
        }

        const lockBadge = canRecord ? '' : `<span style="font-size:0.7rem; background:#f1f5f9; color:#94a3b8; padding:2px 6px; border-radius:4px; margin-left:6px;"><i class="fas fa-lock"></i> Khóa</span>`;
        const rowOpacity = canRecord ? '1' : '0.55';

        list.innerHTML += `
            <div class="list-item" style="cursor:pointer; opacity:${rowOpacity};" onclick="openRecordBehavior(${stu.id}, '${stu.name.replace(/'/g, "\\'")}')">
                <div class="list-item-info">
                    <div style="display:flex; align-items:center;">
                        <strong>${stu.name}</strong> 
                        ${gInfo} 
                        ${lockBadge}
                    </div>
                </div>
                <div>
                    <span style="color:${color}; font-weight:800; font-size:1.1rem;">${pts > 0 ? '+'+pts : pts} đ</span> 
                    <i class="fas fa-chevron-right text-muted ml-2"></i>
                </div>
            </div>`;
    });
}

window.openRecordBehavior = function(stuId, stuName) { 
    const stu = (appData.students || []).find(s => s.id == stuId);
    if (!window.hasPermission('behavior:record', stu)) {
        if (window.isGroupLeader()) {
            window.showToast(`Từ chối: Bạn là Tổ trưởng Tổ ${window.authRole.fixedGroup}, không thể ghi nhận nề nếp cho học sinh Tổ khác!`, "error");
        } else if (window.authRole.role === 'none') {
            window.showToast("Từ chối: Tài khoản của bạn chưa được cấp quyền ghi nhận nề nếp!", "error");
        } else {
            window.showToast("Từ chối thao tác: Không đủ quyền hạn!", "error");
        }
        return;
    }
    currentDiscStuId = stuId; 
    document.getElementById('behavior-target-name').innerText = `Đang chọn: ${stuName}`; 
    window.renderQuickTags(); 
    window.openModal('modal-record-behavior'); 
}

window.switchBehaviorTab = function(type, element) { currentBehaviorTab = type; document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); element.classList.add('active'); window.renderQuickTags(); }
window.renderQuickTags = function() {
    const grid = document.getElementById('quick-tag-list'); grid.innerHTML = '';
    appData.behaviorTags.filter(t => t.type === currentBehaviorTab && t.enabled).forEach(t => { grid.innerHTML += `<div class="quick-tag-btn ${t.color}" onclick="confirmTagRecord('${t.id}')"><div class="tag-icon"><i class="fas ${t.icon}"></i></div><div class="tag-name">${t.name}</div><div class="tag-pts">${t.currentPoints > 0 ? '+' : ''}${t.currentPoints}</div></div>`; });
}
window.confirmTagRecord = function(tagId) { const tag = appData.behaviorTags.find(t => t.id === tagId); if(!tag) return; document.getElementById('conf-tag-id').value = tag.id; document.getElementById('conf-stu-id').value = currentDiscStuId; document.getElementById('conf-tag-display').innerHTML = `<strong>Hành vi:</strong> ${tag.name} (Gốc: ${tag.currentPoints})`; document.getElementById('conf-points').value = tag.currentPoints; document.getElementById('conf-note').value = ''; window.openModal('modal-confirm-tag'); }
window.submitBehaviorRecord = function() {
    const stuId = parseInt(document.getElementById('conf-stu-id').value);
    const stu = (appData.students || []).find(s => s.id == stuId);
    if (!window.hasPermission('behavior:record', stu)) {
        window.showToast("Từ chối: Bạn không có quyền ghi nhận nề nếp cho học sinh này!", "error");
        return;
    }
    const tag = appData.behaviorTags.find(t => t.id === document.getElementById('conf-tag-id').value);
    appData.behaviorRecords.push({ id: Date.now(), studentId: stuId, tagId: tag.id, snapshotName: tag.name, snapshotPoints: parseInt(document.getElementById('conf-points').value), type: tag.type, date: getTodayStr(), time: formatDateTime(), note: document.getElementById('conf-note').value });
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
window.toggleTag = function(id) { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền bật/tắt hành vi nề nếp!", "error");
        return;
    }
    const t = appData.behaviorTags.find(x => x.id === id); if(t) { t.enabled = !t.enabled; window.saveData(); window.renderManageTags(); } 
}
window.deleteTag = function(id) { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền xóa hành vi nề nếp!", "error");
        return;
    }
    if(confirm("Xóa hành vi này?")) { appData.behaviorTags = appData.behaviorTags.filter(x => x.id !== id); window.saveData(); window.renderManageTags(); } 
}
window.saveTag = function() { 
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền tạo hành vi nề nếp!", "error");
        return;
    }
    const name = document.getElementById('tag-name').value; const type = document.getElementById('tag-type').value; const pts = parseInt(document.getElementById('tag-points').value) || (type==='negative'? -1:1); if(!name) return window.showToast("Nhập tên!", "error"); appData.behaviorTags.push({ id: "cus_" + Date.now(), name: name, type: type, defaultPoints: pts, currentPoints: pts, isSystem: false, enabled: true, icon: type==='negative' ? 'fa-exclamation' : 'fa-star', color: type==='negative' ? 'qt-negative' : 'qt-positive' }); window.saveData(); window.renderManageTags(); window.closeModal('modal-add-tag'); window.showToast("Đã thêm!"); 
}

// ================= GIAO DIỆN QUẢN LÝ PHÂN QUYỀN TÀI KHOẢN (RBAC) =================
window.openAccountPermissionsModal = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền mở quản lý phân quyền tài khoản!", "error");
        return;
    }

    const selectEl = document.getElementById('perm-student-select');
    if (!selectEl) return;

    if (!appData.students || appData.students.length === 0) {
        window.showToast("Lớp chưa có học sinh nào. Hãy thêm học sinh trước khi phân quyền!", "warning");
        return;
    }

    let opts = '';
    appData.students.forEach(s => {
        let gName = '';
        if (s.fixedGroup && s.fixedGroup != 0) {
            const gObj = (appData.fixedGroups || []).find(g => g.id == s.fixedGroup);
            gName = gObj ? ` (${gObj.name})` : ` (Tổ ${s.fixedGroup})`;
        }
        let roleBadge = '';
        if (s.accountRole === 'class_leader') roleBadge = ' [Lớp trưởng]';
        else if (s.accountRole === 'class_vice') roleBadge = ' [Lớp phó]';
        else if (s.accountRole === 'group_leader') roleBadge = ' [Tổ trưởng]';

        opts += `<option value="${s.id}">${s.name}${gName}${roleBadge}</option>`;
    });

    selectEl.innerHTML = opts;
    
    // Nạp học sinh đầu tiên
    const firstStuId = appData.students[0].id;
    selectEl.value = firstStuId;
    window.onSelectPermStudent(firstStuId);
    window.renderAssignedAccountsList();
    window.openModal('modal-account-permissions');
};

window.onSelectPermStudent = function(studentId) {
    const stu = (appData.students || []).find(s => s.id == studentId);
    if (!stu) return;

    const emailEl = document.getElementById('perm-account-email');
    const roleEl = document.getElementById('perm-role-select');
    
    if (emailEl) emailEl.value = stu.accountEmail || '';
    if (roleEl) roleEl.value = stu.accountRole || 'none';

    window.onPermRoleChanged();
};

window.onPermRoleChanged = function() {
    const roleEl = document.getElementById('perm-role-select');
    const stuSelectEl = document.getElementById('perm-student-select');
    const descEl = document.getElementById('perm-role-desc');
    if (!roleEl || !descEl) return;

    const role = roleEl.value;
    const stuId = stuSelectEl ? stuSelectEl.value : null;
    const stu = stuId ? (appData.students || []).find(s => s.id == stuId) : null;

    let descText = "";
    if (role === 'teacher') {
        descText = "👑 <b>Giáo viên chủ nhiệm:</b> Toàn quyền quản trị, sửa Cài đặt, PPCT, TKB, thêm xóa học sinh và phân quyền cán bộ lớp.";
    } else if (role === 'class_leader') {
        descText = "⭐ <b>Lớp trưởng:</b> Được điểm danh và ghi nhận nề nếp cho <b>toàn bộ học sinh trong lớp</b>. KHÔNG được sửa Cài đặt, PPCT, TKB, chia tổ hay xóa học sinh.";
    } else if (role === 'class_vice') {
        descText = "🎖️ <b>Lớp phó:</b> Được điểm danh và ghi nhận nề nếp cho <b>toàn bộ học sinh trong lớp</b>. KHÔNG được sửa Cài đặt, PPCT, TKB hay xóa học sinh.";
    } else if (role === 'group_leader') {
        const grpId = (stu && stu.fixedGroup) ? stu.fixedGroup : 0;
        const grpObj = (appData.fixedGroups || []).find(g => g.id == grpId);
        const grpName = grpObj ? grpObj.name : (grpId ? `Tổ ${grpId}` : 'Chưa phân tổ');
        
        if (grpId === 0) {
            descText = `⚠️ <b>Tổ trưởng:</b> Em <b>${stu ? stu.name : 'này'}</b> hiện <b>chưa được phân vào tổ cố định nào</b>. Vui lòng xếp tổ cho em trước để em có thể điểm danh các bạn trong tổ!`;
        } else {
            descText = `👥 <b>Tổ trưởng:</b> Chỉ có quyền điểm danh và ghi nhận nề nếp cho thành viên trong <b>${grpName}</b>. Không thao tác được học sinh tổ khác.`;
        }
    } else {
        descText = "ℹ️ <b>Chưa cấp quyền:</b> Tài khoản học sinh bình thường, không có quyền ghi điểm danh hay nề nếp trên hệ thống.";
    }

    descEl.innerHTML = descText;
};

window.saveStudentPermission = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền lưu phân quyền!", "error");
        return;
    }

    const stuSelectEl = document.getElementById('perm-student-select');
    const emailEl = document.getElementById('perm-account-email');
    const roleEl = document.getElementById('perm-role-select');

    if (!stuSelectEl || !emailEl || !roleEl) return;

    const stuId = stuSelectEl.value;
    const stu = (appData.students || []).find(s => s.id == stuId);
    if (!stu) return window.showToast("Chưa chọn học sinh!", "error");

    const email = emailEl.value.trim().toLowerCase();
    const role = roleEl.value;

    if (role !== 'none' && !email) {
        window.showToast("Vui lòng nhập Email Google đăng nhập của học sinh để cấp quyền!", "error");
        emailEl.focus();
        return;
    }

    stu.accountEmail = email;
    stu.accountRole = role;

    // Đồng bộ Firestore
    if (currentUser) {
        if (email) {
            try {
                setDoc(doc(firestoreDb, "CanBoLop", email), {
                    teacherUid: currentUser.uid,
                    role: role,
                    studentId: stu.id,
                    studentName: stu.name,
                    fixedGroup: stu.fixedGroup || null
                }).catch(e => console.warn("Lỗi đồng bộ CanBoLop:", e));
            } catch(e) {}
        }
    }

    window.saveData(true);
    window.renderStudents();
    window.renderAssignedAccountsList();
    
    let roleText = "Học sinh";
    if (role === 'class_leader') roleText = "Lớp trưởng";
    else if (role === 'class_vice') roleText = "Lớp phó";
    else if (role === 'group_leader') roleText = `Tổ trưởng Tổ ${stu.fixedGroup || 1}`;

    window.showToast(`✅ Đã phân quyền cho em ${stu.name}: [${roleText}]!`);
};

window.revokeStudentPermission = function() {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền gỡ phân quyền!", "error");
        return;
    }

    const stuSelectEl = document.getElementById('perm-student-select');
    if (!stuSelectEl) return;
    const stuId = stuSelectEl.value;
    window.revokeStudentPermissionById(stuId);
};

window.revokeStudentPermissionById = function(stuId) {
    if (!window.isTeacher()) {
        window.showToast("Từ chối: Chỉ Giáo viên mới có quyền gỡ phân quyền!", "error");
        return;
    }

    const stu = (appData.students || []).find(s => s.id == stuId);
    if (!stu) return;

    if (confirm(`Bạn có chắc chắn muốn gỡ quyền cán bộ lớp của học sinh ${stu.name}?`)) {
        const oldEmail = stu.accountEmail;
        stu.accountRole = 'none';
        
        if (oldEmail && currentUser) {
            try {
                deleteDoc(doc(firestoreDb, "CanBoLop", oldEmail.toLowerCase().trim())).catch(e => {});
            } catch(e) {}
        }

        const emailEl = document.getElementById('perm-account-email');
        const roleEl = document.getElementById('perm-role-select');
        const selectEl = document.getElementById('perm-student-select');

        if (selectEl && selectEl.value == stuId) {
            if (roleEl) roleEl.value = 'none';
            window.onPermRoleChanged();
        }

        window.saveData(true);
        window.renderStudents();
        window.renderAssignedAccountsList();
        window.showToast(`Đã gỡ quyền cán bộ lớp của em ${stu.name}!`);
    }
};

window.renderAssignedAccountsList = function() {
    const container = document.getElementById('perm-assigned-list');
    if (!container) return;

    const assigned = (appData.students || []).filter(s => s.accountRole && s.accountRole !== 'none');
    if (assigned.length === 0) {
        container.innerHTML = `<div style="text-align:center; padding:18px; color:#94a3b8; font-size:0.88rem; font-style:italic;">Chưa có cán bộ lớp nào được cấp quyền tài khoản.</div>`;
        return;
    }

    let html = '';
    assigned.forEach(stu => {
        let badgeBg = '#f1f5f9';
        let badgeColor = '#475569';
        let roleName = 'Học sinh';

        if (stu.accountRole === 'class_leader') {
            badgeBg = '#dcfce7'; badgeColor = '#15803d'; roleName = 'Lớp trưởng';
        } else if (stu.accountRole === 'class_vice') {
            badgeBg = '#e0f2fe'; badgeColor = '#0369a1'; roleName = 'Lớp phó';
        } else if (stu.accountRole === 'group_leader') {
            badgeBg = '#fef3c7'; badgeColor = '#b45309'; roleName = `Tổ trưởng Tổ ${stu.fixedGroup || 1}`;
        }

        let gInfo = stu.fixedGroup ? ` (Tổ ${stu.fixedGroup})` : '';

        html += `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:1px solid #f1f5f9;">
                <div>
                    <div style="font-weight:700; color:var(--text-main); font-size:0.92rem;">
                        ${stu.name}${gInfo}
                        <span style="font-size:0.75rem; font-weight:700; background:${badgeBg}; color:${badgeColor}; padding:2px 8px; border-radius:6px; margin-left:6px;">${roleName}</span>
                    </div>
                    <div style="font-size:0.8rem; color:#64748b; margin-top:2px;">
                        <i class="fas fa-envelope"></i> ${stu.accountEmail || 'Chưa gắn email'}
                    </div>
                </div>
                <button class="btn-outline-action text-danger" onclick="window.revokeStudentPermissionById(${stu.id})" title="Gỡ phân quyền" style="font-size:0.8rem; padding:4px 8px; border-radius:6px; border-color:#fee2e2;">
                    <i class="fas fa-user-times"></i> Gỡ
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
};

window.applyNotifyTemplate = function() { const val = document.getElementById('notify-template').value; const t = document.getElementById('notify-title'); const c = document.getElementById('notify-content'); if(val === 'T1') { t.value = "Thông báo khoản thu"; c.value = "Kính gửi quý PH,\nGVCN thông báo các khoản phí tháng này gồm: ..."; } else if(val === 'T2') { t.value = "Mời họp phụ huynh"; c.value = "Kính mời quý PH dự họp đầu năm lúc 8h00 Chủ nhật tại lớp."; } else if(val === 'T3') { t.value = "Nhắc nhở nề nếp"; c.value = "Xin quý PH nhắc các con mặc đúng đồng phục khi đến trường.\nXin cảm ơn!"; } else { t.value = ""; c.value = ""; } }

// HÀM GỌI API GOOGLE GEMINI (HỖ TRỢ CẢ MÁY CHỦ BẢO MẬT & API KEY CÀI ĐẶT)
window.generateAINotify = async function() { 
    const prompt = document.getElementById('ai-prompt').value;
    if(!prompt) return window.showToast("Nhập nội dung cần nhờ AI", "error"); 
    
    window.showToast("🤖 AI đang soạn thảo...", "success");
    document.getElementById('notify-content').value = "Đang tạo nội dung, thầy cô chờ một chút nhé...";

    try {
        // Thử gọi qua endpoint máy chủ an toàn trước
        try {
            const serverRes = await fetch('/api/generate-ai-notify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt })
            });

            if (serverRes.ok) {
                const data = await serverRes.json();
                if (data.result) {
                    document.getElementById('notify-content').value = data.result;
                    window.showToast("✅ AI đã soạn xong!");
                    return;
                }
            }
        } catch (e) {
            console.log("Server AI endpoint bypassed, falling back:", e);
        }

        // Dự phòng nếu chưa có biến môi trường máy chủ: dùng API key từ Cài đặt
        const apiKey = appData.settings.apiKey;
        if(!apiKey) {
            document.getElementById('notify-content').value = "⚠️ Chưa cấu hình GEMINI_API_KEY trên máy chủ. Thầy cô có thể vào tab Cài đặt để nhập mã Google Gemini API Key.";
            return window.showToast("Thiếu API Key!", "error");
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
        document.getElementById('notify-content').value = `Lỗi AI: ${err.message}\nVui lòng kiểm tra lại cấu hình hoặc API Key nhé!`;
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

// ================= TẢI FILE MẪU TKB & PPCT =================
window.downloadTemplateTKB = function() {
    const dataList = [
        ["Thứ", "Buổi", "Tiết", "Lớp", "Môn", "Khung giờ / Ghi chú"],
        [3, "Sáng", 1, "7A1", "Toán", "7h30 - 8h15"],
        [3, "Sáng", 2, "8A3", "Toán", "8h20 - 9h05"],
        [3, "Sáng", 3, "7A2", "Toán", "9h10 - 9h55"],
        [3, "Sáng", 4, "7A3", "GDĐP", "10h00 - 10h45"],
        [4, "Chiều", 2, "8A3", "Toán", "14h35 - 15h20"],
        [4, "Chiều", 3, "8A3", "GDĐP", "15h25 - 16h10"],
        [6, "Chiều", 1, "7A3", "HĐTN&HN", "13h45 - 14h30"],
        ["(Hướng dẫn: Cột Thứ điền 2-7; Cột Buổi điền 'Sáng' hoặc 'Chiều'; Cột Tiết điền 1, 2, 3, 4, 5. Xóa các dòng mẫu này và nhập TKB của bạn)", "", "", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(dataList);
    ws['!cols'] = [{wch: 8}, {wch: 10}, {wch: 8}, {wch: 12}, {wch: 16}, {wch: 25}];
    XLSX.utils.book_append_sheet(wb, ws, "TKB_Mau_Sang_Chieu");
    XLSX.writeFile(wb, "Mau_Thoi_Khoa_Bieu_Sang_Chieu.xlsx");
    window.showToast("Đã tải xuống File Mẫu TKB (Sáng/Chiều)!", "success");
};

window.downloadCoNhungTKB = function() {
    // 20 tiết chuẩn theo ảnh của Cô Nhung
    const dataList = [
        ["Thứ", "Buổi", "Tiết", "Lớp", "Môn", "Khung giờ"],
        // Thứ 3
        [3, "Sáng", 1, "7A1", "Toán", "7h30 - 8h15"],
        [3, "Sáng", 2, "8A3", "Toán", "8h20 - 9h05"],
        [3, "Sáng", 3, "7A2", "Toán", "9h10 - 9h55"],
        [3, "Sáng", 4, "7A3", "GDĐP", "10h00 - 10h45"],
        // Thứ 4
        [4, "Sáng", 1, "7A1", "Toán", "7h30 - 8h15"],
        [4, "Sáng", 3, "8A2", "GDĐP", "9h10 - 9h55"],
        [4, "Sáng", 4, "7A2", "Toán", "10h00 - 10h45"],
        [4, "Chiều", 2, "8A3", "Toán", "14h35 - 15h20"],
        [4, "Chiều", 3, "8A3", "GDĐP", "15h25 - 16h10"],
        // Thứ 5
        [5, "Sáng", 1, "7A2", "Toán", "7h30 - 8h15"],
        [5, "Sáng", 2, "8A3", "Toán", "8h20 - 9h05"],
        [5, "Sáng", 3, "7A1", "GDĐP", "9h10 - 9h55"],
        [5, "Sáng", 4, "7A1", "Toán", "10h00 - 10h45"],
        // Thứ 6
        [6, "Sáng", 1, "7A2", "Toán", "7h30 - 8h15"],
        [6, "Sáng", 2, "8A3", "Toán", "8h20 - 9h05"],
        [6, "Sáng", 3, "7A1", "Toán", "9h10 - 9h55"],
        [6, "Sáng", 4, "7A2", "GDĐP", "10h00 - 10h45"],
        [6, "Chiều", 1, "7A3", "HĐTN&HN", "13h45 - 14h30"],
        [6, "Chiều", 2, "7A3", "HĐTN&HN", "14h35 - 15h20"],
        [6, "Chiều", 3, "7A3", "HĐTN&HN", "15h25 - 16h10"]
    ];

    // Sheet 2: Bảng Ma Trận trực quan giống hệt ảnh của cô
    const dataMatrix = [
        ["THỜI KHÓA BIỂU CÔ NHUNG - 20 TIẾT / TUẦN (SÁNG & CHIỀU)"],
        ["THỨ", "SÁNG - Tiết 1", "SÁNG - Tiết 2", "SÁNG - Tiết 3", "SÁNG - Tiết 4", "CHIỀU - Tiết 1", "CHIỀU - Tiết 2", "CHIỀU - Tiết 3"],
        ["Thứ 2", "Nghỉ cả ngày", "", "", "", "", "", ""],
        ["Thứ 3", "7A1 (Toán)", "8A3 (Toán)", "7A2 (Toán)", "7A3 (GDĐP)", "-", "-", "-"],
        ["Thứ 4", "7A1 (Toán)", "-", "8A2 (GDĐP)", "7A2 (Toán)", "-", "8A3 (Toán)", "8A3 (GDĐP)"],
        ["Thứ 5", "7A2 (Toán)", "8A3 (Toán)", "7A1 (GDĐP)", "7A1 (Toán)", "-", "-", "-"],
        ["Thứ 6", "7A2 (Toán)", "8A3 (Toán)", "7A1 (Toán)", "7A2 (GDĐP)", "7A3 (HĐTN&HN)", "7A3 (HĐTN&HN)", "7A3 (HĐTN&HN)"]
    ];

    var wb = XLSX.utils.book_new(); 
    var wsList = XLSX.utils.aoa_to_sheet(dataList);
    wsList['!cols'] = [{wch: 8}, {wch: 10}, {wch: 8}, {wch: 10}, {wch: 15}, {wch: 20}];
    XLSX.utils.book_append_sheet(wb, wsList, "TKB_Co_Nhung_DanhSach");

    var wsMat = XLSX.utils.aoa_to_sheet(dataMatrix);
    wsMat['!cols'] = [{wch: 10}, {wch: 16}, {wch: 16}, {wch: 16}, {wch: 16}, {wch: 16}, {wch: 16}, {wch: 16}];
    XLSX.utils.book_append_sheet(wb, wsMat, "Bang_Thoi_Khoa_Bieu");

    XLSX.writeFile(wb, "Thoi_Khoa_Bieu_Co_Nhung_20_Tiet.xlsx");
    window.showToast("Đã tải xuống file Excel TKB Cô Nhung!", "success");
};

window.loadCoNhungTKB = function() {
    if (confirm("Nạp 20 tiết Thời khóa biểu của Cô Nhung (Toán 12 tiết, GDĐP 5 tiết, HĐTN&HN 3 tiết) vào danh sách?")) {
        const coNhungList = [
            // Thứ 3
            { dayOfWeek: 3, period: 1, className: "7A1", subject: "Toán" },
            { dayOfWeek: 3, period: 2, className: "8A3", subject: "Toán" },
            { dayOfWeek: 3, period: 3, className: "7A2", subject: "Toán" },
            { dayOfWeek: 3, period: 4, className: "7A3", subject: "GDĐP" },
            // Thứ 4
            { dayOfWeek: 4, period: 1, className: "7A1", subject: "Toán" },
            { dayOfWeek: 4, period: 3, className: "8A2", subject: "GDĐP" },
            { dayOfWeek: 4, period: 4, className: "7A2", subject: "Toán" },
            { dayOfWeek: 4, period: 7, className: "8A3", subject: "Toán" }, // Chiều tiết 2
            { dayOfWeek: 4, period: 8, className: "8A3", subject: "GDĐP" }, // Chiều tiết 3
            // Thứ 5
            { dayOfWeek: 5, period: 1, className: "7A2", subject: "Toán" },
            { dayOfWeek: 5, period: 2, className: "8A3", subject: "Toán" },
            { dayOfWeek: 5, period: 3, className: "7A1", subject: "GDĐP" },
            { dayOfWeek: 5, period: 4, className: "7A1", subject: "Toán" },
            // Thứ 6
            { dayOfWeek: 6, period: 1, className: "7A2", subject: "Toán" },
            { dayOfWeek: 6, period: 2, className: "8A3", subject: "Toán" },
            { dayOfWeek: 6, period: 3, className: "7A1", subject: "Toán" },
            { dayOfWeek: 6, period: 4, className: "7A2", subject: "GDĐP" },
            { dayOfWeek: 6, period: 6, className: "7A3", subject: "HĐTN&HN" }, // Chiều tiết 1
            { dayOfWeek: 6, period: 7, className: "7A3", subject: "HĐTN&HN" }, // Chiều tiết 2
            { dayOfWeek: 6, period: 8, className: "7A3", subject: "HĐTN&HN" }  // Chiều tiết 3
        ];
        appData.scheduleSetup.tkb = coNhungList;
        appData.scheduleSetup.tkb.sort((a,b) => a.dayOfWeek - b.dayOfWeek || a.period - b.period);
        window.saveData();
        window.renderSetupData();
        window.showToast("🎉 Đã nạp thành công 20 tiết TKB của Cô Nhung!");
    }
};

window.downloadTemplatePPCT = function() {
    const data = [
        ["Tuần", "Tiết PPCT", "Tên bài học / Chuyên đề", "Số tiết", "Thiết bị dạy học & NLS", "Địa điểm"],
        [1, 1, "Bài 1: Tập hợp các số hữu tỉ", 1, "Slide bài giảng, Máy chiếu", "Lớp học"],
        [1, 2, "Bài 1: (Tiếp theo)", 1, "Trò chơi Quizizz", "Lớp học"],
        ["(Chú ý: Xóa các dòng mẫu này đi và copy PPCT 5512 của bạn vào. KHÔNG sửa tên cột ở hàng 1)", "", "", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(data);
    
    // Tự động chỉnh độ rộng cột cho PPCT
    ws['!cols'] = [{wch: 10}, {wch: 15}, {wch: 40}, {wch: 10}, {wch: 30}, {wch: 15}];
    
    XLSX.utils.book_append_sheet(wb, ws, "PPCT_Mau");
    XLSX.writeFile(wb, "Mau_Phan_Phoi_CT.xlsx");
    window.showToast("Đã tải xuống File Mẫu PPCT!", "success");
}

// Khởi tạo ngay lập tức thông tin hiển thị lên giao diện
try {
    window.updateDashboardInfo();
    window.loadSettings();
} catch(e) {
    console.warn("Khởi tạo nhanh:", e);
}