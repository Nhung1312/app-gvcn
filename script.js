// ================= FIREBASE AUTH & DATABASE =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const firestoreDb = initializeFirestore(app, {
    experimentalForceLongPolling: true
});
const provider = new GoogleAuthProvider();

let currentUser = null;
let currentRole = "teacher"; // teacher, class_leader, vice_leader, group_leader, student
let currentStudentProfile = null;
let currentTeacherUid = null;

// ================= TIỆN ÍCH TOÀN CỤC & MODAL =================
window.showToast = function(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if(!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle text-green' : 'fa-exclamation-circle text-red'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.openModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex'; 
};

window.closeModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'none'; 
};

window.toggleDrawer = function(open) {
    const d = document.getElementById('drawer');
    const ov = document.getElementById('drawer-overlay');
    if(d) d.classList.toggle('active', open);
    if(ov) ov.classList.toggle('active', open);
};

function getTodayStr() { return new Date().toISOString().split('T')[0]; }
function formatDateTime() { const d = new Date(); return `${d.toLocaleDateString('vi-VN')} ${d.getHours()}:${d.getMinutes()}`; }

// ================= DỮ LIỆU APP & MIGRATION =================
const defaultTags = [
    { id: "t1", name: "Đi học muộn", type: "negative", defaultPoints: -1, currentPoints: -1, isSystem: true, enabled: true, icon: "fa-clock", color: "qt-negative" },
    { id: "t2", name: "Không thuộc bài", type: "negative", defaultPoints: -1, currentPoints: -1, isSystem: true, enabled: true, icon: "fa-book-open", color: "qt-negative" },
    { id: "t3", name: "Mất trật tự", type: "negative", defaultPoints: -1, currentPoints: -1, isSystem: true, enabled: true, icon: "fa-volume-up", color: "qt-negative" },
    { id: "t4", name: "Vi phạm nội quy", type: "negative", defaultPoints: -2, currentPoints: -2, isSystem: true, enabled: true, icon: "fa-exclamation-triangle", color: "qt-negative" },
    { id: "t5", name: "Tích cực phát biểu", type: "positive", defaultPoints: 1, currentPoints: 1, isSystem: true, enabled: true, icon: "fa-hand-paper", color: "qt-positive" },
    { id: "t6", name: "Làm việc tốt", type: "positive", defaultPoints: 2, currentPoints: 2, isSystem: true, enabled: true, icon: "fa-heart", color: "qt-positive" },
    { id: "t7", name: "Đạt thành tích", type: "positive", defaultPoints: 3, currentPoints: 3, isSystem: true, enabled: true, icon: "fa-medal", color: "qt-positive" }
];

const defaultSettings = { 
    teacherName: "Nguyễn Thu Hà", 
    className: "8A1", 
    year: "2026-2027", 
    autoAbsentDisc: false, 
    autoLateDisc: false, 
    warnAbsent: 3, 
    warnBehavior: -5, 
    theme: "default", 
    apiKey: "" 
};

function initData() {
    let v5Data = JSON.parse(localStorage.getItem('gvcnData_v5'));
    if (!v5Data) {
        let oldData = JSON.parse(localStorage.getItem('gvcnData_v4')) || JSON.parse(localStorage.getItem('gvcnData_v3')) || {};
        v5Data = {
            settings: oldData.settings ? { ...defaultSettings, ...oldData.settings } : defaultSettings,
            students: (oldData.students || []).map((s, idx) => ({
                id: s.id || Date.now() + idx,
                name: s.name || "",
                gender: s.gender || "Nam",
                team: parseInt(s.team) || ((idx % 4) + 1),
                dob: s.dob || "",
                phone: s.phone || "",
                email: s.email || "",
                role: s.role || "student",
                groupId: s.groupId || String(s.team || ((idx % 4) + 1)),
                permissions: s.permissions || {
                    viewClass: false,
                    manageDiscipline: false,
                    manageAttendance: false,
                    manageTasks: false,
                    sendReports: false
                },
                active: s.active !== undefined ? s.active : true,
                note: s.note || ""
            })),
            attendance: oldData.attendance || {},
            behaviorTags: oldData.behaviorTags || defaultTags,
            behaviorRecords: oldData.behaviorRecords || [],
            tasks: oldData.tasks || [],
            notifications: oldData.notifications || [],
            documents: oldData.documents || [],
            activityGroups: oldData.activityGroups || [],
            scheduleSetup: oldData.scheduleSetup || { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] },
            scheduleRecords: oldData.scheduleRecords || [],
            monthlyThemes: oldData.settings && oldData.settings.monthlyThemes ? oldData.settings.monthlyThemes : { "8": "VĂN MINH - XANH - AN TOÀN" }
        };
        localStorage.setItem('gvcnData_v5', JSON.stringify(v5Data));
    } else {
        if (!v5Data.activityGroups) v5Data.activityGroups = [];
        if (!v5Data.settings.monthlyThemes) v5Data.settings.monthlyThemes = { "8": "VĂN MINH - XANH - AN TOÀN" };
        if (!v5Data.settings.theme) v5Data.settings.theme = "default";
        if (!v5Data.scheduleSetup) v5Data.scheduleSetup = { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] };
        if (!v5Data.scheduleSetup.mathRatios) v5Data.scheduleSetup.mathRatios = [];
    }
    return v5Data;
}

let appData = initData();
let syncTimeout = null;

window.saveData = function() {
    localStorage.setItem('gvcnData_v5', JSON.stringify(appData));
    window.updateDashboardInfo();

    if (currentUser && currentTeacherUid) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            try {
                if (window.isTeacher()) {
                    const docRef = doc(firestoreDb, "DuLieuGVCN", currentTeacherUid);
                    await setDoc(docRef, appData);
                    console.log("☁️ Đã đồng bộ dữ liệu GVCN lên Firebase.");
                }
            } catch (e) {
                console.error("Lỗi đồng bộ Firebase:", e);
            }
        }, 2000);
    }
};

// ================= KIỂM TRA VAI TRÒ & PHÂN QUYỀN =================
window.isTeacher = () => currentRole === "teacher";
window.isClassLeader = () => currentRole === "class_leader";
window.isViceLeader = () => currentRole === "vice_leader";
window.isGroupLeader = () => currentRole === "group_leader";
window.isStudent = () => currentRole === "student";

window.hasPermission = function(permName) {
    if (window.isTeacher()) return true;
    if (!currentStudentProfile || !currentStudentProfile.permissions) return false;
    return !!currentStudentProfile.permissions[permName];
};

window.canManageStudent = function(studentId) {
    if (window.isTeacher() || window.isClassLeader()) return true;
    if (window.isGroupLeader()) {
        const target = appData.students.find(s => s.id == studentId);
        return target && String(target.team || target.groupId) === String(currentStudentProfile.groupId || currentStudentProfile.team);
    }
    return false;
};

function getRoleVietnamese(role) {
    const map = { teacher: "GVCN", class_leader: "Lớp trưởng", vice_leader: "Lớp phó", group_leader: "Tổ trưởng", student: "Học sinh" };
    return map[role] || "Thành viên";
}

// ================= CHUYỂN VIEW (ĐƯỢC ĐỊNH NGHĨA TOÀN CỤC) =================
window.switchView = function(viewId, navElement = null) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    const target = document.getElementById(viewId);
    if(target) target.classList.add('active');
    window.scrollTo(0, 0);

    if (navElement) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        navElement.classList.add('active');
    }

    if(viewId === 'view-home') window.updateDashboardInfo();
    if(viewId === 'view-students') window.renderStudents();
    if(viewId === 'view-groups') window.renderGroupsView();
    if(viewId === 'view-permissions') window.renderPermissionsView();
    if(viewId === 'view-activity-logs') window.renderActivityLogs();
    if(viewId === 'view-settings') window.loadSettings();
    if(viewId === 'view-attendance') window.renderAttendance();
    if(viewId === 'view-discipline') window.renderDisciplineStudents();
    if(viewId === 'view-announcements') window.renderNotifies();
    if(viewId === 'view-plans') window.renderKanban();
    if(viewId === 'view-docs') window.renderDocs();
    if(viewId === 'view-lesson-log') window.initLessonLogView();
};

// ================= CẬP NHẬT DASHBOARD =================
window.updateDashboardInfo = function() {
    const s = appData.settings;
    if(document.getElementById('dash-teacher')) document.getElementById('dash-teacher').innerText = s.teacherName; 
    if(document.getElementById('dash-class')) document.getElementById('dash-class').innerText = s.className; 
    if(document.getElementById('dash-year')) document.getElementById('dash-year').innerText = s.year;
    
    const totalStu = (appData.students || []).length; 
    if(document.getElementById('dash-count')) document.getElementById('dash-count').innerText = totalStu + " HS"; 
    if(document.getElementById('stat-total')) document.getElementById('stat-total').innerText = totalStu;
    
    const today = getTodayStr(); 
    let presentCount = totalStu, absentCount = 0;
    if(appData.attendance && appData.attendance[today]) { 
        presentCount = 0; absentCount = 0; 
        Object.values(appData.attendance[today]).forEach(st => { 
            if(st === 'present') presentCount++; 
            if(st === 'excused' || st === 'unexcused') absentCount++; 
        }); 
    }
    if(document.getElementById('dash-attendance-percent')) document.getElementById('dash-attendance-percent').innerText = (totalStu > 0 ? Math.round((presentCount / totalStu) * 100) : 100) + "%";
    if(document.getElementById('stat-present')) document.getElementById('stat-present').innerText = presentCount; 
    if(document.getElementById('stat-absent')) document.getElementById('stat-absent').innerText = absentCount;
    if(document.getElementById('stat-good')) document.getElementById('stat-good').innerText = (appData.behaviorRecords || []).filter(r => r.date === today && r.type === 'positive').length;

    if(document.getElementById('dash-notify-count')) document.getElementById('dash-notify-count').innerText = (appData.notifications || []).length + " TB";
    if(document.getElementById('dash-task-count')) document.getElementById('dash-task-count').innerText = (appData.tasks || []).length + " việc";
    if(document.getElementById('dash-doc-count')) document.getElementById('dash-doc-count').innerText = (appData.documents || []).length + " file";

    const llList = document.getElementById('dash-ll-list'); 
    if(llList) {
        llList.innerHTML = '';
        let todaysLessons = (appData.scheduleRecords || []).filter(r => r.date === today);
        if(document.getElementById('dash-ll-date')) document.getElementById('dash-ll-date').innerText = new Date().toLocaleDateString('vi-VN');
        if(todaysLessons.length === 0) {
            llList.innerHTML = `<div class="text-center w-full" style="font-size:0.85rem; opacity:0.8; color: white;">Hôm nay không có tiết dạy nào.</div>`;
        } else {
            todaysLessons.sort((a,b) => a.period - b.period).forEach(l => {
                let stIcon = l.status === 'off' ? 'fa-times text-red' : (l.status === 'completed' ? 'fa-check text-green' : 'fa-clock text-blue');
                llList.innerHTML += `<div class="ll-item"><div class="ll-period"><span>Tiết</span>${l.period}</div><div class="ll-content"><h4>${l.subject} - ${l.className}</h4><p>${l.content}</p></div><i class="fas ${stIcon}" style="background: white; padding: 5px; border-radius: 50%;"></i></div>`;
            });
        }
        let currentWeek = todaysLessons.length > 0 ? todaysLessons[0].week : 1;
        let weekLessons = (appData.scheduleRecords || []).filter(r => r.week == currentWeek && r.status !== 'off').length;
        if(document.getElementById('dash-ll-week-count')) document.getElementById('dash-ll-week-count').innerText = weekLessons;
    }

    window.updateLeaderboard();
};

// ================= ADAPTIVE UI THEO VAI TRÒ =================
window.applyRoleUI = function() {
    const roleBadge = document.getElementById('current-user-role-badge');
    const groupBadge = document.getElementById('current-user-group-badge');
    const userNameEl = document.getElementById('dash-user-name');
    const avatarEl = document.getElementById('user-avatar-img');

    if (window.isTeacher()) {
        if(userNameEl) userNameEl.innerText = appData.settings.teacherName;
        if(roleBadge) { roleBadge.className = "role-badge badge-teacher"; roleBadge.innerText = "👨‍🏫 GVCN"; }
        if(groupBadge) groupBadge.style.display = "none";
    } else if (currentStudentProfile) {
        if(userNameEl) userNameEl.innerText = currentStudentProfile.name;
        if(avatarEl) avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentStudentProfile.name)}&background=e0ecff&color=0d6efd&bold=true`;
        
        if (window.isClassLeader()) {
            if(roleBadge) { roleBadge.className = "role-badge badge-leader"; roleBadge.innerText = "⭐ Lớp trưởng"; }
            if(groupBadge) groupBadge.style.display = "none";
        } else if (window.isViceLeader()) {
            if(roleBadge) { roleBadge.className = "role-badge badge-vice"; roleBadge.innerText = "📚 Lớp phó"; }
            if(groupBadge) groupBadge.style.display = "none";
        } else if (window.isGroupLeader()) {
            if(roleBadge) { roleBadge.className = "role-badge badge-groupleader"; roleBadge.innerText = "👥 Tổ trưởng"; }
            if(groupBadge) { groupBadge.style.display = "inline-block"; groupBadge.innerText = `Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`; }
        } else {
            if(roleBadge) { roleBadge.className = "role-badge badge-student"; roleBadge.innerText = "🎓 Học sinh"; }
            if(groupBadge) { groupBadge.style.display = "inline-block"; groupBadge.innerText = `Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`; }
        }
    }

    const isT = window.isTeacher();
    document.querySelectorAll('.teacher-only').forEach(el => {
        el.style.display = isT ? '' : 'none';
    });

    const permMenu = document.getElementById('menu-item-permissions');
    if (permMenu) permMenu.style.display = isT ? 'flex' : 'none';

    const logMenu = document.getElementById('menu-item-activity-logs');
    if (logMenu) logMenu.style.display = (isT || window.isClassLeader()) ? 'flex' : 'none';

    if (window.isGroupLeader()) {
        if(document.getElementById('group-leader-banner')) document.getElementById('group-leader-banner').style.display = 'block';
        if(document.getElementById('main-class-hero')) document.getElementById('main-class-hero').style.display = 'none';
        if(document.getElementById('student-banner')) document.getElementById('student-banner').style.display = 'none';
        if(document.getElementById('gl-banner-group-title')) document.getElementById('gl-banner-group-title').innerText = `⭐ Quản lý Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`;
        if(document.getElementById('gl-banner-class')) document.getElementById('gl-banner-class').innerText = `Lớp ${appData.settings.className}`;
    } else if (window.isStudent()) {
        if(document.getElementById('student-banner')) document.getElementById('student-banner').style.display = 'block';
        if(document.getElementById('group-leader-banner')) document.getElementById('group-leader-banner').style.display = 'none';
        if(document.getElementById('main-class-hero')) document.getElementById('main-class-hero').style.display = 'none';
        if(document.getElementById('stu-banner-team')) document.getElementById('stu-banner-team').innerText = `Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`;
    } else {
        if(document.getElementById('main-class-hero')) document.getElementById('main-class-hero').style.display = 'block';
        if(document.getElementById('group-leader-banner')) document.getElementById('group-leader-banner').style.display = 'none';
        if(document.getElementById('student-banner')) document.getElementById('student-banner').style.display = 'none';
    }

    if (document.getElementById('nav-settings')) document.getElementById('nav-settings').style.display = isT ? 'flex' : 'none';
    if (document.getElementById('nav-attendance')) document.getElementById('nav-attendance').style.display = (isT || window.hasPermission('manageAttendance')) ? 'flex' : 'none';
};

window.openThemeEditorIfAllowed = function() {
    if (window.isTeacher()) {
        window.openModal('modal-edit-theme');
    } else {
        window.showToast("Chỉ GVCN mới có quyền sửa chủ điểm tháng!", "error");
    }
};

// ================= GHI NHẬN NỀ NẾP CÓ ĐỊNH DANH (AUDIT TRAIL) =================
window.submitBehaviorRecord = async function() {
    const stuId = parseInt(document.getElementById('conf-stu-id').value);
    
    if (!window.isTeacher() && !window.hasPermission('manageDiscipline')) {
        if (!window.isGroupLeader()) return window.showToast("Bạn không có quyền ghi nhận nề nếp!", "error");
    }

    if (window.isGroupLeader() && !window.canManageStudent(stuId)) {
        return window.showToast("Tổ trưởng chỉ được ghi nhận cho thành viên Tổ của mình!", "error");
    }

    const tag = appData.behaviorTags.find(t => t.id === document.getElementById('conf-tag-id').value);
    const targetStudent = appData.students.find(s => s.id === stuId);
    const pts = parseInt(document.getElementById('conf-points').value) || tag.currentPoints;
    const note = document.getElementById('conf-note').value;

    const operatorName = window.isTeacher() ? appData.settings.teacherName : (currentStudentProfile ? currentStudentProfile.name : "Cán sự");
    const operatorRole = currentRole;
    const operatorEmail = currentUser ? currentUser.email : "";

    const newRecord = {
        id: Date.now(),
        studentId: stuId,
        studentName: targetStudent ? targetStudent.name : "",
        groupId: targetStudent ? String(targetStudent.team || targetStudent.groupId) : "",
        tagId: tag.id,
        snapshotName: tag.name,
        snapshotPoints: pts,
        type: tag.type,
        date: getTodayStr(),
        time: formatDateTime(),
        note: note,
        createdByUid: currentUser ? currentUser.uid : "local",
        createdByEmail: operatorEmail,
        createdByRole: operatorRole,
        createdByName: operatorName,
        createdAt: new Date().toISOString()
    };

    appData.behaviorRecords.push(newRecord);

    if (currentTeacherUid) {
        try {
            await addDoc(collection(firestoreDb, `classes/${currentTeacherUid}/activityLogs`), {
                ...newRecord,
                desc: `${operatorName} (${getRoleVietnamese(operatorRole)}) đã ghi: ${targetStudent ? targetStudent.name : ""} - ${tag.name} (${pts > 0 ? '+' : ''}${pts}đ)`
            });
        } catch (e) {
            console.log("Log saved locally");
        }
    }

    window.saveData();
    window.closeModal('modal-confirm-tag');
    window.closeModal('modal-record-behavior');
    window.showToast(`✅ Đã ghi nhận: ${tag.name} cho em ${targetStudent ? targetStudent.name : ""}`);
    window.renderDisciplineStudents();
};

window.renderActivityLogs = function() {
    const container = document.getElementById('activity-logs-container');
    if (!container) return;
    container.innerHTML = '';

    const filterRole = document.getElementById('filter-log-role').value;
    const filterDate = document.getElementById('filter-log-date').value;

    let records = (appData.behaviorRecords || []).slice().reverse();
    if (filterRole !== 'all') records = records.filter(r => r.createdByRole === filterRole);
    if (filterDate) records = records.filter(r => r.date === filterDate);

    if (records.length === 0) {
        container.innerHTML = '<div class="empty-state">Chưa có nhật ký hoạt động nào.</div>';
        return;
    }

    records.forEach(r => {
        let badgeClass = r.createdByRole === 'teacher' ? 'badge-teacher' : (r.createdByRole === 'group_leader' ? 'badge-groupleader' : 'badge-leader');
        let ptsClass = r.snapshotPoints > 0 ? 'text-green' : 'text-red';

        container.innerHTML += `
            <div class="list-item" style="flex-direction: column; align-items: flex-start; gap: 6px;">
                <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
                    <div>
                        <strong style="font-size: 0.95rem;">${r.createdByName || 'Người dùng'}</strong>
                        <span class="role-badge ${badgeClass}" style="font-size: 0.65rem; padding: 2px 6px;">${getRoleVietnamese(r.createdByRole)}</span>
                    </div>
                    <small class="text-muted">${r.time || r.date}</small>
                </div>
                <div style="font-size: 0.9rem; color: var(--text-main);">
                    Đã ghi: <b>${r.studentName || 'Học sinh'}</b> (Tổ ${r.groupId || 1}) - <span class="${ptsClass}">${r.snapshotName} (${r.snapshotPoints > 0 ? '+' : ''}${r.snapshotPoints}đ)</span>
                </div>
                ${r.note ? `<small style="color: var(--text-muted); font-style: italic;">Lý do: "${r.note}"</small>` : ''}
            </div>
        `;
    });
};

window.renderDisciplineStudents = function() {
    const txt = (document.getElementById('search-disc-student')?.value || '').toLowerCase();
    const list = document.getElementById('discipline-student-list');
    if (!list) return;
    list.innerHTML = '';

    let ptsMap = {};
    (appData.behaviorRecords || []).forEach(r => { 
        ptsMap[r.studentId] = (ptsMap[r.studentId] || 0) + Number(r.snapshotPoints); 
    });

    let displayStudents = (appData.students || []).filter(s => s.name.toLowerCase().includes(txt));

    if (window.isGroupLeader() && currentStudentProfile) {
        displayStudents = displayStudents.filter(s => String(s.team || s.groupId) === String(currentStudentProfile.team || currentStudentProfile.groupId));
    }

    if (displayStudents.length === 0) {
        list.innerHTML = '<div class="empty-state">Không có học sinh trong phạm vi quản lý.</div>';
        return;
    }

    displayStudents.forEach(stu => {
        let pts = ptsMap[stu.id] || 0;
        let color = pts > 0 ? 'var(--success)' : (pts < 0 ? 'var(--danger)' : 'var(--text-muted)');
        list.innerHTML += `
            <div class="list-item" style="cursor:pointer;" onclick="openRecordBehavior(${stu.id}, '${stu.name}')">
                <div class="list-item-info">
                    <strong>${stu.name}</strong>
                    <small>Tổ ${stu.team || 1} • ${getRoleVietnamese(stu.role)}</small>
                </div>
                <div>
                    <span style="color:${color}; font-weight:800; font-size:1.1rem;">${pts > 0 ? '+'+pts : pts} đ</span>
                    <i class="fas fa-chevron-right text-muted ml-2"></i>
                </div>
            </div>
        `;
    });
};

window.openRecordBehavior = function(stuId, stuName) { 
    if (window.isGroupLeader() && !window.canManageStudent(stuId)) {
        return window.showToast("Tổ trưởng chỉ được ghi nhận cho học sinh tổ mình!", "error");
    }
    if (window.isStudent()) {
        return window.showToast("Học sinh không có quyền ghi nhận nề nếp!", "error");
    }

    window.currentDiscStuId = stuId; 
    document.getElementById('behavior-target-name').innerText = `Đang chọn: ${stuName}`; 
    window.renderQuickTags(); 
    window.openModal('modal-record-behavior'); 
};

window.switchBehaviorTab = function(type, element) {
    window.currentBehaviorTab = type;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
    window.renderQuickTags();
};

window.renderQuickTags = function() {
    const grid = document.getElementById('quick-tag-list');
    if(!grid) return;
    grid.innerHTML = '';
    const curTab = window.currentBehaviorTab || 'negative';
    (appData.behaviorTags || []).filter(t => t.type === curTab && t.enabled).forEach(t => {
        grid.innerHTML += `<div class="quick-tag-btn ${t.color}" onclick="confirmTagRecord('${t.id}')"><div class="tag-icon"><i class="fas ${t.icon}"></i></div><div class="tag-name">${t.name}</div><div class="tag-pts">${t.currentPoints > 0 ? '+' : ''}${t.currentPoints}</div></div>`;
    });
};

window.confirmTagRecord = function(tagId) {
    const tag = (appData.behaviorTags || []).find(t => t.id === tagId);
    if(!tag) return;
    document.getElementById('conf-tag-id').value = tag.id;
    document.getElementById('conf-stu-id').value = window.currentDiscStuId;
    document.getElementById('conf-tag-display').innerHTML = `<strong>Hành vi:</strong> ${tag.name} (Gốc: ${tag.currentPoints})`;
    document.getElementById('conf-points').value = tag.currentPoints;
    document.getElementById('conf-note').value = '';
    window.openModal('modal-confirm-tag');
};

// ================= PHÂN QUYỀN CÁN SỰ =================
window.renderPermissionsView = function() {
    if (!window.isTeacher()) return;

    const cadresList = document.getElementById('cadres-list');
    const groupLeadersList = document.getElementById('group-leaders-list');
    if (!cadresList || !groupLeadersList) return;

    cadresList.innerHTML = '';
    groupLeadersList.innerHTML = '';

    const cadres = (appData.students || []).filter(s => s.role === 'class_leader' || s.role === 'vice_leader');
    if (cadres.length === 0) {
        cadresList.innerHTML = '<div class="text-muted" style="font-size:0.85rem; padding:10px;">Chưa có Lớp trưởng/Lớp phó. Mở hồ sơ học sinh để cấp vai trò.</div>';
    } else {
        cadres.forEach(s => {
            cadresList.innerHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <strong>${s.name} <span class="role-badge ${s.role==='class_leader'?'badge-leader':'badge-vice'}">${getRoleVietnamese(s.role)}</span></strong>
                        <small><i class="fab fa-google text-blue"></i> ${s.email || 'Chưa liên kết Gmail'}</small>
                    </div>
                    <button class="btn-outline-action text-blue" onclick="editStudent(${s.id})"><i class="fas fa-user-edit"></i></button>
                </div>
            `;
        });
    }

    for (let t = 1; t <= 4; t++) {
        const leader = (appData.students || []).find(s => s.role === 'group_leader' && String(s.team || s.groupId) === String(t));
        groupLeadersList.innerHTML += `
            <div class="list-item">
                <div class="list-item-info">
                    <strong>Tổ ${t}: ${leader ? leader.name : '<span class="text-muted">Chưa có tổ trưởng</span>'}</strong>
                    <small>${leader && leader.email ? `<i class="fab fa-google text-blue"></i> ${leader.email}` : 'Chưa liên kết Gmail'}</small>
                </div>
                <div>
                    ${leader ? `<button class="btn-outline-action text-orange" onclick="editStudent(${leader.id})"><i class="fas fa-pen"></i></button>` : `<button class="btn-outline text-blue" style="padding:6px 12px; font-size:0.8rem;" onclick="switchView('view-students')">+ Chọn HS</button>`}
                </div>
            </div>
        `;
    }
};

// ================= HỒ SƠ HỌC SINH & GÁN GMAIL =================
window.saveStudent = async function() {
    if (!window.isTeacher()) return window.showToast("Chỉ GVCN mới có quyền sửa học sinh!", "error");

    const id = document.getElementById('stu-id').value;
    const name = document.getElementById('stu-name').value.trim();
    const gender = document.getElementById('stu-gender').value;
    const team = parseInt(document.getElementById('stu-team').value) || 1;
    const dob = document.getElementById('stu-dob').value;
    const phone = document.getElementById('stu-phone').value.trim();
    const email = document.getElementById('stu-email').value.trim().toLowerCase();
    const role = document.getElementById('stu-role').value;

    if(!name) return window.showToast("Vui lòng nhập họ và tên!", "error");

    const permissions = {
        viewClass: role === 'class_leader' || role === 'vice_leader',
        manageDiscipline: role !== 'student' || document.getElementById('perm-discipline').checked,
        manageAttendance: document.getElementById('perm-attendance').checked,
        manageTasks: document.getElementById('perm-tasks').checked,
        sendReports: role !== 'student'
    };

    const studentObj = { 
        id: id ? parseInt(id) : Date.now(), 
        name: name, 
        gender: gender, 
        team: team,
        groupId: String(team),
        dob: dob, 
        phone: phone,
        email: email,
        role: role,
        permissions: permissions,
        active: true,
        note: ""
    };

    if(id) { 
        let idx = appData.students.findIndex(s => s.id == id);
        appData.students[idx] = { ...appData.students[idx], ...studentObj }; 
        window.showToast("Đã cập nhật học sinh!"); 
    } else { 
        appData.students.push(studentObj); 
        window.showToast("Đã thêm học sinh mới!"); 
    }

    if (email && currentTeacherUid) {
        try {
            await setDoc(doc(firestoreDb, "class_members", email.replace(/[^a-zA-Z0-9]/g, '_')), {
                email: email,
                teacherUid: currentTeacherUid,
                studentId: studentObj.id,
                name: studentObj.name,
                role: studentObj.role,
                groupId: studentObj.groupId,
                updatedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error(e);
        }
    }

    window.saveData(); 
    window.renderStudents(); 
    window.renderPermissionsView();
    window.closeModal('modal-add-student');
};

window.editStudent = function(id) { 
    const stu = (appData.students || []).find(s => s.id === id); 
    if(stu) { 
        document.getElementById('stu-id').value = stu.id; 
        document.getElementById('stu-name').value = stu.name; 
        document.getElementById('stu-gender').value = stu.gender || 'Nam'; 
        document.getElementById('stu-team').value = stu.team || 1;
        document.getElementById('stu-email').value = stu.email || '';
        document.getElementById('stu-role').value = stu.role || 'student';
        
        let fDob = stu.dob || ''; 
        if(fDob.includes('/')) { 
            const p = fDob.split('/'); 
            if(p.length===3) fDob = `${p[2]}-${p[1]}-${p[0]}`; 
        } 
        document.getElementById('stu-dob').value = fDob; 
        document.getElementById('stu-phone').value = stu.phone || ''; 

        const permBox = document.getElementById('stu-permissions-box');
        if (permBox) {
            permBox.style.display = (stu.role === 'vice_leader' || stu.role === 'student') ? 'block' : 'none';
            document.getElementById('perm-discipline').checked = !!(stu.permissions && stu.permissions.manageDiscipline);
            document.getElementById('perm-attendance').checked = !!(stu.permissions && stu.permissions.manageAttendance);
            document.getElementById('perm-notify').checked = !!(stu.permissions && stu.permissions.sendReports);
            document.getElementById('perm-tasks').checked = !!(stu.permissions && stu.permissions.manageTasks);
        }

        window.openModal('modal-add-student'); 
    } 
};

// ================= XÓA HẾT DANH SÁCH LỚP =================
window.clearAllStudents = function() {
    if (!window.isTeacher()) return window.showToast("Chỉ GVCN mới có quyền xóa lớp!", "error");
    if (!appData.students || appData.students.length === 0) return window.showToast("Danh sách đang trống!", "error");
    
    if (confirm(`⚠️ CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn XÓA TOÀN BỘ ${appData.students.length} học sinh của lớp không?\nThao tác này giúp bạn làm sạch dữ liệu cũ để tải file danh sách mới lên.`)) {
        appData.students = [];
        appData.activityGroups = [];
        window.saveData();
        window.renderStudents();
        window.renderPermissionsView();
        window.showToast("✅ Đã xóa sạch danh sách học sinh!", "success");
    }
};

window.renderStudents = function() {
    const list = document.getElementById('student-list'); 
    if(!list) return;
    list.innerHTML = ''; 

    const searchInput = document.getElementById('search-student');
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";
    let filtered = (appData.students || []).filter(s => s.name.toLowerCase().includes(filterText));

    if (window.isGroupLeader() && currentStudentProfile) {
        filtered = filtered.filter(s => String(s.team || s.groupId) === String(currentStudentProfile.team || currentStudentProfile.groupId));
    }

    if(filtered.length === 0) { 
        list.innerHTML = '<div class="empty-state"><h4>Chưa có học sinh nào!</h4></div>'; 
        return; 
    }

    filtered.forEach((stu, index) => { 
        let cleanPhone = stu.phone ? String(stu.phone).replace(/[^0-9]/g, '') : '';
        let zaloBtn = cleanPhone ? `<button class="btn-outline-action" style="color:white; background:#0068ff; border-color:#0068ff;" onclick="window.open('https://zalo.me/${cleanPhone}', '_blank')" title="Nhắn Zalo"><i class="fas fa-comment-dots"></i></button>` : '';
        let aiBtn = window.isTeacher() ? `<button class="btn-ai-magic" onclick="openAIForStudent('${stu.name}')" title="Nhờ AI nhận xét"><i class="fas fa-magic"></i></button>` : '';
        let editBtn = window.isTeacher() ? `<button class="btn-outline-action" onclick="editStudent(${stu.id})"><i class="fas fa-pen"></i></button>` : '';
        let delBtn = window.isTeacher() ? `<button class="btn-outline-action text-red" onclick="deleteStudent(${stu.id})"><i class="fas fa-trash"></i></button>` : '';
        
        let roleBadge = `<span class="role-badge ${stu.role==='class_leader'?'badge-leader':(stu.role==='group_leader'?'badge-groupleader':'badge-student')}">${getRoleVietnamese(stu.role)}</span>`;

        list.innerHTML += `
            <div class="list-item">
                <div class="list-item-info">
                    <strong>${index + 1}. ${stu.name} ${roleBadge}</strong>
                    <small>Tổ ${stu.team || 1} • ${stu.email ? `<span class="text-blue">${stu.email}</span>` : 'Chưa có Gmail'}</small>
                </div>
                <div class="list-item-actions">
                    ${aiBtn}${zaloBtn}
                    <button class="btn-outline-action" style="color:white; background:var(--primary);" onclick="generateReportCard(${stu.id})" title="Tạo phiếu ảnh"><i class="fas fa-camera-retro"></i></button>
                    ${editBtn}${delBtn}
                </div>
            </div>
        `; 
    });
};

window.deleteStudent = function(id) { 
    if (!window.isTeacher()) return window.showToast("Bạn không có quyền xóa học sinh!", "error");
    if(confirm("Xác nhận xóa học sinh này?")) { 
        appData.students = appData.students.filter(s => s.id !== id); 
        window.saveData(); 
        window.renderStudents(); 
        window.renderPermissionsView();
        window.showToast("Đã xóa học sinh."); 
    } 
};

// ================= TỔ CỐ ĐỊNH & NHÓM HOẠT ĐỘNG =================
let currentGroupSubMode = 'teams';

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
    } else {
        label.innerText = 'Số HS mỗi nhóm';
        input.value = 5;
    }
};

window.autoDivideFixedTeams = function() {
    if (!window.isTeacher()) return window.showToast("Chỉ GVCN mới có quyền chia tổ cố định!", "error");
    if(!appData.students || appData.students.length === 0) return window.showToast("Lớp chưa có học sinh nào!", "error");
    if(!confirm("Chia đều học sinh hiện tại vào 4 Tổ cố định?")) return;

    appData.students.forEach((st, idx) => {
        st.team = (idx % 4) + 1;
        st.groupId = String(st.team);
    });

    window.saveData();
    window.renderGroupsView();
    window.showToast("🎉 Đã chia đều 4 Tổ cố định cho lớp!");
};

window.generateActivityGroups = function() {
    if(!appData.students || appData.students.length === 0) return window.showToast("Lớp chưa có học sinh!", "error");

    const divideType = document.getElementById('group-divide-type').value;
    const paramVal = parseInt(document.getElementById('group-param-value').value) || 4;

    let numGroups = divideType === 'byGroupCount' ? Math.max(2, Math.min(appData.students.length, paramVal)) : Math.max(2, Math.ceil(appData.students.length / paramVal));

    let groups = [];
    for(let i = 1; i <= numGroups; i++) groups.push({ id: i, name: `Nhóm ${i}`, members: [] });

    let stuPool = JSON.parse(JSON.stringify(appData.students));
    for (let i = stuPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [stuPool[i], stuPool[j]] = [stuPool[j], stuPool[i]];
    }

    stuPool.forEach((st, idx) => groups[idx % numGroups].members.push(st));

    appData.activityGroups = groups;
    window.saveData();
    window.renderGroupsView();
    window.showToast(`🎉 Đã chia ${numGroups} nhóm học tập!`);
};

window.renderGroupsView = function() {
    const container = document.getElementById('groups-container');
    if(!container) return;
    container.innerHTML = '';

    if (currentGroupSubMode === 'teams') {
        let teams = { 1: [], 2: [], 3: [], 4: [] };
        (appData.students || []).forEach(st => {
            let t = st.team || 1;
            if(!teams[t]) teams[t] = [];
            teams[t].push(st);
        });

        let teamKeys = [1, 2, 3, 4];
        if (window.isGroupLeader() && currentStudentProfile) {
            teamKeys = [parseInt(currentStudentProfile.team || currentStudentProfile.groupId) || 1];
        }

        teamKeys.forEach(t => {
            let membersHtml = '';
            (teams[t] || []).forEach((m, mIdx) => {
                let changeTeamSelect = window.isTeacher() ? `
                    <select onchange="changeStudentFixedTeam(${m.id}, this.value)" style="padding: 4px 8px; border-radius: 8px; border: 1.5px solid #cbd5e1; font-weight: 800; font-size: 0.8rem; color: var(--primary);">
                        <option value="1" ${t===1?'selected':''}>Tổ 1</option>
                        <option value="2" ${t===2?'selected':''}>Tổ 2</option>
                        <option value="3" ${t===3?'selected':''}>Tổ 3</option>
                        <option value="4" ${t===4?'selected':''}>Tổ 4</option>
                    </select>
                ` : `<span class="role-badge badge-student">${getRoleVietnamese(m.role)}</span>`;

                membersHtml += `
                    <div class="group-member-row">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); width: 20px;">${mIdx + 1}.</span>
                            <div>
                                <strong style="font-size: 0.9rem; color: var(--text-main);">${m.name}</strong>
                                <small style="display: block; color: var(--text-muted); font-size: 0.75rem;">${m.gender} • ${m.phone || 'Trống SĐT'}</small>
                            </div>
                        </div>
                        ${changeTeamSelect}
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="group-card">
                    <div class="group-card-header">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span class="group-badge" style="background: #e0f2fe; color: #0369a1;"><i class="fas fa-flag"></i> Tổ ${t}</span>
                            <small style="color: var(--text-muted); font-weight: 700;">(${(teams[t]||[]).length} Học sinh)</small>
                        </div>
                    </div>
                    <div class="group-member-list">
                        ${membersHtml || '<div style="color: var(--text-muted); font-size: 0.85rem; padding: 10px; text-align:center;">Tổ chưa có học sinh</div>'}
                    </div>
                </div>
            `;
        });
    } else {
        const groups = appData.activityGroups || [];
        if(groups.length === 0) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có nhóm nào. Bấm "Tạo nhóm ngay" ở trên!</div>';
            return;
        }

        groups.forEach((grp, gIdx) => {
            let membersHtml = '';
            grp.members.forEach((m, mIdx) => {
                membersHtml += `
                    <div class="group-member-row">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: var(--text-muted); width: 20px;">${mIdx + 1}.</span>
                            <div>
                                <strong style="font-size: 0.9rem; color: var(--text-main);">${m.name}</strong>
                                <small style="display: block; color: var(--text-muted); font-size: 0.75rem;">${m.gender}</small>
                            </div>
                        </div>
                    </div>
                `;
            });

            container.innerHTML += `
                <div class="group-card">
                    <div class="group-card-header">
                        <span class="group-badge">${grp.name}</span>
                        <small style="color: var(--text-muted); font-weight: 700;">(${grp.members.length} HS)</small>
                    </div>
                    <div class="group-member-list">${membersHtml}</div>
                </div>
            `;
        });
    }
};

window.changeStudentFixedTeam = function(studentId, newTeamVal) {
    if (!window.isTeacher()) return window.showToast("Chỉ GVCN mới có quyền đổi tổ!", "error");
    const st = appData.students.find(x => x.id === studentId);
    if(st) {
        st.team = parseInt(newTeamVal) || 1;
        st.groupId = String(st.team);
        window.saveData();
        window.renderGroupsView();
        window.showToast(`Đã chuyển em ${st.name} sang Tổ ${st.team}!`);
    }
};

window.exportFixedTeamsExcel = function() {
    if(!appData.students || appData.students.length === 0) return window.showToast("Lớp chưa có học sinh!", "error");

    let ws_data = [
        [`DANH SÁCH CÁC TỔ LỚP ${appData.settings.className}`],
        [`Giáo viên chủ nhiệm: ${appData.settings.teacherName} • Năm học: ${appData.settings.year}`],
        [],
        ["Tổ", "STT", "Họ và tên", "Giới tính", "Ngày sinh", "SĐT Phụ huynh"]
    ];

    for(let t = 1; t <= 4; t++) {
        let teamMembers = appData.students.filter(st => (st.team || 1) === t);
        teamMembers.forEach((m, idx) => {
            ws_data.push([`Tổ ${t}`, idx + 1, m.name, m.gender, m.dob || "", m.phone || ""]);
        });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_To");
    XLSX.writeFile(wb, `Danh_Sach_To_Lop_${appData.settings.className}.xlsx`);
    window.showToast("✅ Đã xuất danh sách Tổ ra Excel!");
};

window.exportActivityGroupsExcel = function() {
    const groups = appData.activityGroups || [];
    if(groups.length === 0) return window.showToast("Chưa có nhóm thảo luận để xuất!", "error");

    let ws_data = [
        [`DANH SÁCH NHÓM HỌC TẬP - LỚP ${appData.settings.className}`],
        [`Giáo viên: ${appData.settings.teacherName}`],
        [],
        ["Tên Nhóm", "STT", "Họ và tên", "Giới tính"]
    ];

    groups.forEach(g => {
        g.members.forEach((m, idx) => {
            ws_data.push([g.name, idx + 1, m.name, m.gender]);
        });
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    XLSX.utils.book_append_sheet(wb, ws, "Nhom_Thao_Luan");
    XLSX.writeFile(wb, `Nhom_Thao_Luan_Lop_${appData.settings.className}.xlsx`);
    window.showToast("✅ Đã xuất danh sách Nhóm ra Excel!");
};

// ================= ĐIỂM DANH =================
window.renderAttendance = function() {
    const date = document.getElementById('attendance-date').value; 
    const list = document.getElementById('attendance-list'); 
    if(!list) return;
    list.innerHTML = '';

    if(!appData.attendance) appData.attendance = {};
    if(!appData.attendance[date]) { 
        appData.attendance[date] = {}; 
        (appData.students || []).forEach(s => appData.attendance[date][s.id] = 'present'); 
    }
    
    let stats = { present: 0, excused: 0, unexcused: 0 }; 
    const records = appData.attendance[date];

    (appData.students || []).forEach((stu, index) => {
        const status = records[stu.id] || 'present'; 
        stats[status]++;
        list.innerHTML += `
            <div class="list-item">
                <div class="list-item-info">
                    <strong>${index + 1}. ${stu.name}</strong>
                    <small>Tổ ${stu.team || 1}</small>
                </div>
                <div class="attendance-opts">
                    <button class="att-btn ${status === 'present' ? 'active' : ''}" data-status="present" onclick="setAtt(this, ${stu.id}, 'present')"><i class="fas fa-check"></i></button>
                    <button class="att-btn ${status === 'excused' ? 'active' : ''}" data-status="excused" onclick="setAtt(this, ${stu.id}, 'excused')"><i class="fas fa-exclamation"></i></button>
                    <button class="att-btn ${status === 'unexcused' ? 'active' : ''}" data-status="unexcused" onclick="setAtt(this, ${stu.id}, 'unexcused')"><i class="fas fa-times"></i></button>
                </div>
            </div>
        `;
    });

    document.getElementById('attendance-summary').innerHTML = `
        <span style="color:var(--success)"><i class="fas fa-check-circle"></i> Có mặt: ${stats.present}</span>
        <span style="color:var(--warning)"><i class="fas fa-exclamation-circle"></i> Phép: ${stats.excused}</span>
        <span style="color:var(--danger)"><i class="fas fa-times-circle"></i> K.Phép: ${stats.unexcused}</span>
    `;
};

window.setAtt = function(btn, stuId, status) {
    if (!window.isTeacher() && !window.hasPermission('manageAttendance')) {
        return window.showToast("Bạn không có quyền điểm danh!", "error");
    }
    const parent = btn.parentElement; 
    parent.querySelectorAll('.att-btn').forEach(b => b.classList.remove('active')); 
    btn.classList.add('active');
    
    const date = document.getElementById('attendance-date').value; 
    appData.attendance[date][stuId] = status;
    window.renderAttendance(); 
};

window.saveAttendance = function() { 
    if (!window.isTeacher() && !window.hasPermission('manageAttendance')) {
        return window.showToast("Bạn không có quyền lưu điểm danh!", "error");
    }
    window.saveData(); 
    window.showToast("✅ Đã lưu Điểm danh!"); 
    window.switchView('view-home'); 
};

// ================= IMPORT / EXPORT EXCEL HỌC SINH =================
let rawExcelData = [], parsedStudents = [], excelHeaders = []; let currentHeaderRowIndex = 0; 
window.openImportModal = function() { 
    document.getElementById('import-step-1').style.display = 'block'; 
    document.getElementById('import-step-2').style.display = 'none'; 
    document.getElementById('import-step-2-footer').style.display = 'none'; 
    document.getElementById('excel-file').value = ""; 
    rawExcelData = []; parsedStudents = []; currentHeaderRowIndex = 0; 
    window.openModal('modal-import-excel'); 
};

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
};

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
};

window.confirmImport = function() { 
    let c = 0; 
    parsedStudents.forEach(stu => { 
        appData.students.push({ 
            id: Date.now() + c, 
            name: stu.name, 
            gender: stu.gender, 
            team: (c % 4) + 1,
            groupId: String((c % 4) + 1),
            dob: stu.dob, 
            phone: stu.phone, 
            email: "",
            role: "student",
            permissions: { viewClass: false, manageDiscipline: false, manageAttendance: false, manageTasks: false, sendReports: false },
            active: true,
            note: "" 
        }); 
        c++; 
    }); 
    window.saveData(); 
    window.renderStudents(); 
    window.closeModal('modal-import-excel'); 
    window.showToast(`Đã nhập ${c} HS thành công!`); 
};

window.exportExcel = function() { 
    if(!appData.students || appData.students.length === 0) return window.showToast("Lớp trống!", "error"); 
    let ws_data = [["STT", "Họ và tên", "Ngày sinh", "Giới tính", "Tổ", "Số điện thoại"]]; 
    appData.students.forEach((stu, i) => { 
        ws_data.push([i+1, stu.name, stu.dob||"", stu.gender||"", stu.team || 1, stu.phone||""]); 
    }); 
    XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet(ws_data), "DS"), `DS_Lop.xlsx`); 
    window.showToast("Đã xuất Excel!"); 
};

window.downloadTemplate = function() { 
    XLSX.writeFile(XLSX.utils.book_append_sheet(XLSX.utils.book_new(), XLSX.utils.aoa_to_sheet([["Họ và tên", "Ngày sinh", "Giới tính", "Số điện thoại"]]), "Mau"), `File_Mau.xlsx`); 
    window.showToast("Đã tải file mẫu!"); 
};

// ================= THÔNG BÁO & AI =================
window.applyNotifyTemplate = function() { 
    const val = document.getElementById('notify-template').value; 
    const t = document.getElementById('notify-title'); 
    const c = document.getElementById('notify-content'); 
    if(val === 'T1') { t.value = "Thông báo khoản thu"; c.value = "Kính gửi quý PH,\nGVCN thông báo các khoản phí tháng này gồm: ..."; } 
    else if(val === 'T2') { t.value = "Mời họp phụ huynh"; c.value = "Kính mời quý PH dự họp đầu năm lúc 8h00 Chủ nhật tại lớp."; } 
    else if(val === 'T3') { t.value = "Nhắc nhở nề nếp"; c.value = "Xin quý PH nhắc các con mặc đúng đồng phục khi đến trường.\nXin cảm ơn!"; } 
    else { t.value = ""; c.value = ""; } 
};

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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `Đóng vai một giáo viên chủ nhiệm, hãy soạn một thông báo gửi vào nhóm Zalo cho phụ huynh học sinh với nội dung cốt lõi sau: ${prompt}. Yêu cầu: Giọng văn lịch sự, chuyên nghiệp, súc tích, có biểu tượng cảm xúc (emoji) cho sinh động.` }] }]
            })
        });
        
        const data = await response.json();
        if(!response.ok) throw new Error(data.error?.message || "Lỗi kết nối API");

        if(data.candidates && data.candidates.length > 0) {
            document.getElementById('notify-content').value = data.candidates[0].content.parts[0].text.trim();
            window.showToast("✅ AI đã soạn xong!");
        }
    } catch(err) {
        console.error(err);
        document.getElementById('notify-content').value = `Lỗi AI: ${err.message}`;
        window.showToast("Lỗi kết nối AI!", "error");
    }
};

window.copyNotifyToZalo = function() { 
    const t = document.getElementById('notify-title').value; 
    const c = document.getElementById('notify-content').value; 
    if(!t || !c) return window.showToast("Nhập đủ nội dung!", "error"); 
    navigator.clipboard.writeText(`📢 [${appData.settings.className}] - ${t}\n\n${c}`).then(() => { 
        window.showToast("✅ Đã copy! Đang mở Zalo..."); 
        setTimeout(() => { window.open('https://chat.zalo.me', '_blank'); }, 800); 
    }); 
};

window.saveNotify = function() { 
    const t = document.getElementById('notify-title').value; 
    const c = document.getElementById('notify-content').value; 
    if(!t || !c) return window.showToast("Nhập đủ thông tin!", "error"); 
    appData.notifications.push({ id: Date.now(), title: t, content: c, createdAt: formatDateTime() }); 
    window.saveData(); 
    window.closeModal('modal-compose-notify'); 
    window.renderNotifies(); 
    window.showToast("Đã lưu thông báo!"); 
};

window.renderNotifies = function() { 
    const list = document.getElementById('notify-list'); 
    if(!list) return;
    list.innerHTML = ''; 
    let arr = [...(appData.notifications || [])].reverse(); 
    if(arr.length===0) list.innerHTML = '<div class="empty-state">Chưa có thông báo</div>'; 
    arr.forEach(n => { 
        list.innerHTML += `<div class="list-item" style="flex-direction:column; align-items:flex-start; gap:10px;"><div class="w-full" style="display:flex; justify-content:space-between;"><strong>📢 ${n.title}</strong><small class="text-muted">${n.createdAt}</small></div><div style="font-size:0.85rem; color:var(--text-muted); white-space:pre-wrap;">${n.content}</div></div>`; 
    }); 
};

// ================= KẾ HOẠCH KANBAN =================
window.saveTask = function() { 
    const id = document.getElementById('task-id').value; 
    const title = document.getElementById('task-title').value; 
    const status = document.getElementById('task-status').value; 
    const prio = document.getElementById('task-priority').value; 
    if(!title) return window.showToast("Nhập tiêu đề!", "error"); 
    if(id) { 
        let t = appData.tasks.find(x => x.id == id); 
        if(t) { t.title = title; t.status = status; t.priority = prio; }
    } else { 
        appData.tasks.push({ id: Date.now(), title: title, status: status, priority: prio }); 
    } 
    window.saveData(); 
    window.closeModal('modal-add-task'); 
    window.renderKanban(); 
};

window.moveTask = function(id, newStatus) { 
    let t = appData.tasks.find(x => x.id == id); 
    if(t) { t.status = newStatus; window.saveData(); window.renderKanban(); } 
};

window.renderKanban = function() { 
    const todo = document.getElementById('kb-todo'), doing = document.getElementById('kb-doing'), done = document.getElementById('kb-done'); 
    if(!todo || !doing || !done) return;
    todo.innerHTML = ''; doing.innerHTML = ''; done.innerHTML = ''; 
    (appData.tasks || []).forEach(t => { 
        let prioIcon = t.priority==='high' ? '🔴' : (t.priority==='medium'?'🟡':'🟢'); 
        let nextBtn = t.status === 'todo' ? `<button class="btn-outline-action text-blue" onclick="moveTask(${t.id}, 'doing')"><i class="fas fa-arrow-right"></i></button>` : (t.status === 'doing' ? `<button class="btn-outline-action text-green" onclick="moveTask(${t.id}, 'done')"><i class="fas fa-check"></i></button>` : `<button class="btn-outline-action text-muted" onclick="moveTask(${t.id}, 'todo')"><i class="fas fa-undo"></i></button>`); 
        let html = `<div class="kanban-card"><h4>${t.title}</h4><div class="kanban-meta"><span>Ưu tiên: ${prioIcon}</span></div><div class="kanban-actions"><button class="btn-outline-action text-red" onclick="deleteTask(${t.id})"><i class="fas fa-trash"></i></button>${nextBtn}</div></div>`; 
        if(t.status === 'todo') todo.innerHTML += html; else if(t.status === 'doing') doing.innerHTML += html; else done.innerHTML += html; 
    }); 
};

window.deleteTask = function(id) { 
    if(confirm("Xóa công việc này?")) { 
        appData.tasks = appData.tasks.filter(x => x.id != id); 
        window.saveData(); 
        window.renderKanban(); 
    } 
};

// ================= TÀI LIỆU INDEXEDDB =================
const DB_NAME = 'GVCN_Docs_DB'; const DB_VERSION = 1; let db;
function initIndexedDB() { return new Promise((resolve, reject) => { const request = indexedDB.open(DB_NAME, DB_VERSION); request.onerror = () => reject(); request.onsuccess = (e) => { db = e.target.result; resolve(db); }; request.onupgradeneeded = (e) => { const db = e.target.result; if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' }); }; }); }
window.saveFileToDB = function(id, file) { return new Promise((resolve, reject) => { const req = db.transaction(['files'], 'readwrite').objectStore('files').put({ id: id, blob: file }); req.onsuccess = resolve; req.onerror = reject; }); };
window.getFileFromDB = function(id) { return new Promise((resolve, reject) => { const req = db.transaction(['files'], 'readonly').objectStore('files').get(id); req.onsuccess = (e) => resolve(e.target.result ? e.target.result.blob : null); req.onerror = reject; }); };
window.deleteFileFromDB = function(id) { return new Promise((resolve, reject) => { const req = db.transaction(['files'], 'readwrite').objectStore('files').delete(id); req.onsuccess = resolve; req.onerror = reject; }); };

window.saveDoc = async function() { 
    const folder = document.getElementById('doc-folder').value; 
    const fileInput = document.getElementById('doc-file'); 
    if(fileInput.files.length === 0) return window.showToast("Chưa chọn file!", "error"); 
    const file = fileInput.files[0]; 
    if (file.size > 20 * 1024 * 1024) return window.showToast("File quá lớn (>20MB)!", "error"); 
    const docId = Date.now(); 
    try { 
        await window.saveFileToDB(docId, file); 
        appData.documents.push({ id: docId, name: file.name, folder: folder, type: file.type || file.name.split('.').pop(), size: (file.size / 1024 / 1024).toFixed(2) + ' MB', date: getTodayStr() }); 
        window.saveData(); 
        window.closeModal('modal-upload-doc'); 
        window.renderDocs(); 
        window.showToast("Đã lưu file thành công!"); 
        fileInput.value = ""; 
    } catch (err) { window.showToast("Lỗi lưu file!", "error"); } 
};

let currentFolderFilter = 'all'; 
window.filterDocs = function(folder, el) { 
    currentFolderFilter = folder; 
    document.querySelectorAll('.doc-folder').forEach(x => x.classList.remove('active')); 
    el.classList.add('active'); 
    window.renderDocs(); 
};

window.renderDocs = function() { 
    const txt = document.getElementById('search-doc') ? document.getElementById('search-doc').value.toLowerCase() : ''; 
    const list = document.getElementById('doc-list'); 
    if(!list) return; 
    list.innerHTML = ''; 
    let docs = (appData.documents || []).filter(d => d.name.toLowerCase().includes(txt)); 
    if(currentFolderFilter !== 'all') docs = docs.filter(d => d.folder === currentFolderFilter); 
    if(docs.length === 0) { list.innerHTML = '<div class="empty-state">Thư mục trống</div>'; return; } 
    docs.forEach(d => { 
        let icon = d.name.toLowerCase().includes('.pdf') ? 'fa-file-pdf text-red' : (d.name.toLowerCase().includes('.xls') ? 'fa-file-excel text-green' : (d.name.toLowerCase().includes('.doc') ? 'fa-file-word text-blue' : 'fa-file-alt')); 
        list.innerHTML += `<div class="doc-card"><div class="doc-card-header"><div class="doc-icon"><i class="fas ${icon}"></i></div><div class="doc-info"><h4>${d.name}</h4><p>${d.size} • ${d.folder} • ${d.date}</p></div></div><div class="doc-actions"><button class="btn-outline-action text-green" onclick="downloadDoc(${d.id})" title="Tải xuống"><i class="fas fa-download"></i></button><button class="btn-outline-action text-red" onclick="deleteDoc(${d.id})" title="Xóa"><i class="fas fa-trash"></i></button></div></div>`; 
    }); 
};

window.downloadDoc = async function(id) { 
    const docInfo = appData.documents.find(d => d.id === id); 
    if (!docInfo) return; 
    const blob = await window.getFileFromDB(id); 
    if (!blob) return window.showToast("Không tìm thấy file gốc!", "error"); 
    const url = URL.createObjectURL(blob); 
    const a = document.createElement('a'); 
    a.href = url; a.download = docInfo.name; 
    document.body.appendChild(a); a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url); 
    window.showToast(`Đang tải: ${docInfo.name}`); 
};

window.deleteDoc = async function(id) { 
    if(confirm("Xóa tài liệu vĩnh viễn?")) { 
        appData.documents = appData.documents.filter(x => x.id != id); 
        window.saveData(); 
        window.renderDocs(); 
        try { await window.deleteFileFromDB(id); window.showToast("Đã xóa file!"); } catch(e) {} 
    } 
};

// ================= CÀI ĐẶT & SAO LƯU =================
window.loadSettings = function() { 
    const s = appData.settings; 
    if(document.getElementById('set-teacher')) document.getElementById('set-teacher').value = s.teacherName || ''; 
    if(document.getElementById('set-class')) document.getElementById('set-class').value = s.className || ''; 
    if(document.getElementById('set-year')) document.getElementById('set-year').value = s.year || ''; 
    if(document.getElementById('set-auto-absent')) document.getElementById('set-auto-absent').checked = s.autoAbsentDisc || false; 
    if(document.getElementById('set-auto-late')) document.getElementById('set-auto-late').checked = s.autoLateDisc || false; 
    if(document.getElementById('set-warn-absent')) document.getElementById('set-warn-absent').value = s.warnAbsent || 3; 
    if(document.getElementById('set-warn-behavior')) document.getElementById('set-warn-behavior').value = s.warnBehavior || -5; 
    if(document.getElementById('set-api-key')) document.getElementById('set-api-key').value = s.apiKey || '';

    let currentTheme = s.theme || 'default';
    document.body.className = currentTheme === 'default' ? '' : currentTheme;
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(currentTheme)) btn.classList.add('active');
    });
};

window.saveSettings = function() { 
    appData.settings.teacherName = document.getElementById('set-teacher').value; 
    appData.settings.className = document.getElementById('set-class').value; 
    appData.settings.year = document.getElementById('set-year').value; 
    if(document.getElementById('set-api-key')) {
        appData.settings.apiKey = document.getElementById('set-api-key').value.trim();
    }
    window.saveData(); 
    window.showToast("✅ Đã lưu cài đặt!"); 
};

window.saveConfig = function() { 
    appData.settings.autoAbsentDisc = document.getElementById('set-auto-absent').checked; 
    appData.settings.autoLateDisc = document.getElementById('set-auto-late').checked; 
    appData.settings.warnAbsent = parseInt(document.getElementById('set-warn-absent').value) || 3; 
    appData.settings.warnBehavior = parseInt(document.getElementById('set-warn-behavior').value) || -5; 
    window.saveData(); 
    window.showToast("Đã lưu cấu hình tự động!"); 
};

window.backupData = function() { 
    let dataStr = JSON.stringify(appData); 
    let blob = new Blob([dataStr], {type: "application/json"}); 
    let url = URL.createObjectURL(blob); 
    let a = document.createElement('a'); 
    a.href = url; a.download = `DuLieu_GVCN_${getTodayStr()}.json`; 
    document.body.appendChild(a); a.click(); 
    document.body.removeChild(a); 
    URL.revokeObjectURL(url); 
    window.showToast("Đã tải bản sao lưu (.json) xuống máy!"); 
};

window.restoreData = function(event) { 
    let file = event.target.files[0]; if(!file) return; 
    let reader = new FileReader(); 
    reader.onload = function(e) { 
        try { 
            let parsed = JSON.parse(e.target.result); 
            if(parsed.students && parsed.settings) { 
                if(confirm("Khôi phục toàn bộ dữ liệu từ file này?")) { 
                    appData = parsed; 
                    window.saveData(); 
                    window.showToast("Khôi phục thành công! Đang tải lại..."); 
                    setTimeout(() => location.reload(), 1200); 
                } 
            } else { 
                window.showToast("File không hợp lệ!", "error"); 
            } 
        } catch(err) { window.showToast("Lỗi đọc file!", "error"); } 
    }; 
    reader.readAsText(file); 
    event.target.value = ''; 
};

window.resetData = function() { 
    if(confirm("XÓA TOÀN BỘ CSDL CỤC BỘ?")) { 
        localStorage.removeItem('gvcnData_v5'); 
        location.reload(); 
    } 
};

// ================= CHỦ ĐIỂM & BẢNG XẾP LOẠI =================
window.renderMonthlyTheme = function() { 
    let currentMonth = new Date().getMonth() + 1; 
    let selMonthEl = document.getElementById('rank-month-select');
    let selectedMonth = selMonthEl ? selMonthEl.value : currentMonth; 
    let themes = appData.settings.monthlyThemes || {}; 
    let themeName = themes[selectedMonth] || "RÈN LUYỆN CHĂM NGOAN"; 
    if(document.getElementById('theme-month-display')) document.getElementById('theme-month-display').innerText = selectedMonth; 
    if(document.getElementById('theme-name-display')) document.getElementById('theme-name-display').innerText = themeName; 
};

window.saveMonthlyTheme = function() { 
    let m = document.getElementById('edit-theme-month').value; 
    let n = document.getElementById('edit-theme-name').value; 
    if(!m || !n) return window.showToast("Vui lòng nhập đủ thông tin!", "error"); 
    if(!appData.settings.monthlyThemes) appData.settings.monthlyThemes = {}; 
    appData.settings.monthlyThemes[m] = n.toUpperCase(); 
    window.saveData(); 
    window.closeModal('modal-edit-theme'); 
    document.getElementById('rank-month-select').value = m; 
    window.updateLeaderboard(); 
    window.showToast("Đã cập nhật Chủ điểm!"); 
};

window.updateLeaderboard = function() { 
    window.renderMonthlyTheme(); 
    let rankEl = document.getElementById('rank-month-select');
    let month = rankEl ? parseInt(rankEl.value) : (new Date().getMonth() + 1); 
    const list = document.getElementById('honor-roll-list'); 
    if(!list) return;
    list.innerHTML = ''; 
    let stuPoints = {}; 
    (appData.students || []).forEach(s => { 
        stuPoints[s.id] = { id: s.id, name: s.name, points: 0, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&background=e0ecff&color=0d6efd&bold=true` }; 
    }); 
    (appData.behaviorRecords || []).forEach(r => { 
        let recordMonth = new Date(r.date).getMonth() + 1; 
        if(recordMonth === month && stuPoints[r.studentId]) { 
            stuPoints[r.studentId].points += Number(r.snapshotPoints); 
        } 
    }); 
    let rankedStudents = Object.values(stuPoints).sort((a, b) => b.points - a.points); 
    let topStudents = rankedStudents.slice(0, 5); 
    if(topStudents.length === 0 || topStudents[0].points === 0) { 
        list.innerHTML = '<div class="text-center text-muted w-full" style="padding: 15px; font-size: 0.85rem; background:#f8fafc; border-radius:12px;">Tháng này chưa có dữ liệu thi đua.</div>'; 
        return; 
    } 
    let top1 = topStudents[0]; 
    let htmlContent = ` <div class="star-top1"> <img src="${top1.avatar}" class="star-avatar-1"> <div class="star-info-1"> <div class="star-badge">Hạng 1</div> <div class="star-name-1">${top1.name}</div> <div class="star-pts-1"><i class="fas fa-arrow-up"></i> ${top1.points} điểm</div> </div> </div> <div class="star-list-others"> `; 
    for(let i = 1; i < topStudents.length; i++) { 
        let stu = topStudents[i]; 
        if (stu.points > 0) { 
            let rank = i + 1; 
            htmlContent += `<div class="star-item"><div class="star-rank r${rank}">${rank}</div><img src="${stu.avatar}" class="star-avatar"><div class="star-name">${stu.name}</div><div class="star-pts">+${stu.points}</div></div>`; 
        } 
    } 
    htmlContent += `</div>`; 
    list.innerHTML = htmlContent; 
};

window.renderRankingList = function() { 
    let period = document.getElementById('full-rank-period-select').value; 
    const list = document.getElementById('full-ranking-list'); 
    if(!list) return;
    list.innerHTML = ''; 
    let stuPoints = {}; 
    (appData.students || []).forEach(s => { stuPoints[s.id] = { id: s.id, name: s.name, points: 0 }; }); 
    (appData.behaviorRecords || []).forEach(r => { 
        let recordMonth = new Date(r.date).getMonth() + 1; 
        let inPeriod = false; 
        if (period === 'HK1' && (recordMonth >= 8 || recordMonth <= 12)) inPeriod = true; 
        else if (period === 'HK2' && (recordMonth >= 1 && recordMonth <= 5)) inPeriod = true; 
        else if (period === 'CA_NAM') inPeriod = true; 
        else if (parseInt(period) === recordMonth) inPeriod = true; 
        if (inPeriod && stuPoints[r.studentId]) { 
            stuPoints[r.studentId].points += Number(r.snapshotPoints); 
        } 
    }); 
    let rankedStudents = Object.values(stuPoints).sort((a, b) => b.points - a.points); 
    if (rankedStudents.length === 0) { 
        list.innerHTML = '<div class="empty-state">Chưa có học sinh nào.</div>'; 
        return; 
    } 
    rankedStudents.forEach((stu, index) => { 
        let rank = index + 1; 
        let classification = "Đạt"; 
        let badgeClass = "bg-orange"; 
        if (stu.points >= 15) { classification = "Tốt"; badgeClass = "bg-green"; } 
        else if (stu.points >= 5) { classification = "Khá"; badgeClass = "bg-blue"; } 
        else if (stu.points >= 0) { classification = "Đạt"; badgeClass = "bg-orange"; } 
        else { classification = "Cần cố gắng"; badgeClass = "bg-red"; } 
        list.innerHTML += ` <div class="list-item" style="display:flex; align-items:center; gap:12px; padding: 12px 15px;"> <div style="width: 25px; font-weight:900; font-size: 1.1rem; color: ${rank <= 3 ? 'var(--warning)' : 'var(--text-muted)'}; text-align:center;">#${rank}</div> <div style="flex:1;"><strong style="font-size:0.95rem; color:var(--text-main);">${stu.name}</strong><div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Tổng điểm: <b class="${stu.points >= 0 ? 'text-green' : 'text-red'}">${stu.points > 0 ? '+'+stu.points : stu.points}</b></div></div> <div class="star-badge ${badgeClass}" style="margin:0; padding:6px 12px; font-size:0.75rem; border-radius: 8px; color:white;">${classification}</div> </div> `; 
    }); 
};

window.exportRankingExcel = function() { 
    let selectEl = document.getElementById('full-rank-period-select'); 
    let periodName = selectEl.options[selectEl.selectedIndex].text; 
    let periodVal = selectEl.value; 
    if (appData.students.length === 0) return window.showToast("Lớp chưa có học sinh!", "error"); 
    let stuPoints = {}; 
    appData.students.forEach(s => { stuPoints[s.id] = { id: s.id, name: s.name, points: 0 }; }); 
    appData.behaviorRecords.forEach(r => { 
        let recordMonth = new Date(r.date).getMonth() + 1; 
        let inPeriod = false; 
        if (periodVal === 'HK1' && (recordMonth >= 8 || recordMonth <= 12)) inPeriod = true; 
        else if (periodVal === 'HK2' && (recordMonth >= 1 && recordMonth <= 5)) inPeriod = true; 
        else if (periodVal === 'CA_NAM') inPeriod = true; 
        else if (parseInt(periodVal) === recordMonth) inPeriod = true; 
        if (inPeriod && stuPoints[r.studentId]) stuPoints[r.studentId].points += Number(r.snapshotPoints); 
    }); 
    let rankedStudents = Object.values(stuPoints).sort((a, b) => b.points - a.points); 
    let ws_data = [ [`BẢNG TỔNG HỢP XẾP LOẠI THI ĐUA - ${periodName.toUpperCase()}`], ["Lớp: " + appData.settings.className, "GVCN: " + appData.settings.teacherName], [""], ["Xếp hạng", "Họ và tên", "Tổng điểm thi đua", "Xếp loại", "Ghi chú GVCN"] ]; 
    rankedStudents.forEach((stu, index) => { 
        let classification = "Đạt"; 
        if (stu.points >= 15) classification = "Tốt"; 
        else if (stu.points >= 5) classification = "Khá"; 
        else if (stu.points >= 0) classification = "Đạt"; 
        else classification = "Cần cố gắng"; 
        ws_data.push([index + 1, stu.name, stu.points, classification, ""]); 
    }); 
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(ws_data); 
    XLSX.utils.book_append_sheet(wb, ws, "Xep_Loai"); 
    XLSX.writeFile(wb, `Bang_Xep_Loai_${periodVal}.xlsx`); 
    window.showToast("Đã xuất file Excel Báo Cáo!"); 
};

// ================= PHIẾU LIÊN LẠC ẢNH =================
window.generateReportCard = async function(stuId) {
    window.showToast("Đang tạo ảnh Phiếu liên lạc...", "success");
    const stu = appData.students.find(s => s.id == stuId); if (!stu) return;

    let currentMonth = new Date().getMonth() + 1; let points = 0; let absent = 0;
    (appData.behaviorRecords || []).forEach(r => { 
        let rMonth = new Date(r.date).getMonth() + 1; 
        if (rMonth === currentMonth && r.studentId == stu.id) points += Number(r.snapshotPoints); 
    });
    Object.values(appData.attendance || {}).forEach(dayRecord => { if (dayRecord[stu.id] === 'unexcused') absent++; });

    let classification = "Đạt"; let badgeBg = "#ffc107"; let feedback = "Con hoàn thành nhiệm vụ học tập. Cần cố gắng phát huy thêm trong tháng tới.";
    if (points >= 15) { classification = "Xuất sắc"; badgeBg = "#198754"; feedback = "Con đi học chuyên cần, ngoan ngoãn và hăng hái phát biểu xây dựng bài. Thành tích rất đáng tự hào!"; } 
    else if (points >= 5) { classification = "Khá"; badgeBg = "#0d6efd"; feedback = "Con có ý thức học tập tốt, ngoan ngoãn. Gia đình tiếp tục động viên con nhé!"; } 
    else if (points < 0) { classification = "Cần cố gắng"; badgeBg = "#dc3545"; feedback = "Tháng này con còn vi phạm một số nội quy và chưa tập trung. Gia đình cần phối hợp nhắc nhở con sát sao hơn."; }
    if (absent >= 3) { feedback += " (Lưu ý: Số buổi vắng không phép của con đang hơi nhiều)."; }

    document.getElementById('rc-month-class').innerText = `Tháng ${currentMonth} - Lớp ${appData.settings.className}`;
    document.getElementById('rc-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(stu.name)}&background=e0ecff&color=0d6efd&bold=true`;
    document.getElementById('rc-name').innerText = stu.name; 
    document.getElementById('rc-classification').innerText = `Xếp loại: ${classification}`; 
    document.getElementById('rc-classification').style.background = badgeBg;
    document.getElementById('rc-points').innerText = points > 0 ? `+${points}` : points; 
    document.getElementById('rc-absent').innerText = `${absent} buổi`; 
    document.getElementById('rc-feedback').innerText = `"${feedback}"`; 
    document.getElementById('rc-teacher').innerText = appData.settings.teacherName;

    const cardEl = document.getElementById('report-card-template'); 
    cardEl.style.left = '0px'; cardEl.style.zIndex = '-1';
    try {
        const canvas = await html2canvas(cardEl, { scale: 2, backgroundColor: null });
        const imgData = canvas.toDataURL("image/jpeg", 1.0);
        const link = document.createElement('a'); 
        link.download = `Phieu_Lien_Lac_${stu.name.replace(/ /g, '_')}_T${currentMonth}.jpg`; 
        link.href = imgData; link.click();
        window.showToast("✅ Đã tải ảnh Phiếu liên lạc thành công!");
    } catch(e) { 
        console.error(e); 
        window.showToast("Lỗi khi tạo ảnh!", "error"); 
    } finally { 
        cardEl.style.left = '-9999px'; 
    }
};

window.openAIForStudent = function(studentName) {
    document.getElementById('ai-prompt').value = `Viết một đoạn nhận xét ngắn gọn, tích cực để gửi cho phụ huynh về tình hình học tập và nề nếp của em ${studentName}.`;
    window.openModal('modal-compose-notify');
};

// ================= TẢI FILE MẪU =================
window.downloadTemplateTKB = function() {
    const data = [
        ["Thứ", "Tiết", "Lớp", "Môn"],
        [2, 1, "8A1", "Toán"],
        [2, 2, "8A1", "Văn"],
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
        ["8", "Toán", "Đại", 1, "Bài 1: Đơn thức", 1, "Máy chiếu", "Lớp học"],
        ["8", "Toán", "Đại", 2, "Bài 2: Đa thức", 1, "Bảng phụ", "Lớp học"],
        ["8", "Toán", "Hình", 1, "Bài 1: Hình chóp tam giác đều", 1, "Mô hình hình học", "Lớp học"],
        ["(Chú ý: Cột Phân môn dành cho môn Toán điền Đại hoặc Hình. Xóa các dòng mẫu này đi)", "", "", "", "", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch: 10}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 25}, {wch: 15}];
    XLSX.utils.book_append_sheet(wb, ws, "PPCT_Mau");
    XLSX.writeFile(wb, "Mau_Phan_Phoi_CT.xlsx");
    window.showToast("Đã tải xuống File Mẫu PPCT chuẩn phân môn!", "success");
};

// ================= HÀM KHỞI TẠO APP UI =================
window.initAppUI = function() {
    window.updateDashboardInfo();
    window.renderStudents();
    window.renderPermissionsView();
    window.renderSetupData();
};

window.onload = async () => {
    await initIndexedDB(); 
    if(document.getElementById('today-date')) document.getElementById('today-date').innerText = new Date().toLocaleDateString('vi-VN');
    if(document.getElementById('attendance-date')) document.getElementById('attendance-date').value = getTodayStr();
    window.initAppUI();
    if ('serviceWorker' in navigator) { 
        navigator.serviceWorker.register('sw.js').catch(err => console.log('SW registration failed:', err)); 
    }
    window.checkAppUpdateAnnouncement();
};

const CURRENT_APP_VERSION = 'v4.2_gvcn_complete_fixed_init';
window.checkAppUpdateAnnouncement = function() {
    let lastSeenVersion = localStorage.getItem('gvcn_seen_version');
    if (lastSeenVersion !== CURRENT_APP_VERSION) {
        setTimeout(() => {
            if (document.getElementById('modal-update-announcement')) {
                window.openModal('modal-update-announcement');
            }
        }, 1200);
    }
};

window.dismissUpdateAnnouncement = function() {
    localStorage.setItem('gvcn_seen_version', CURRENT_APP_VERSION);
    window.closeModal('modal-update-announcement');
};
