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

// ================= DỮ LIỆU APP & MIGRATION V5 =================
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

// ================= ĐIỀU HƯỚNG VIEW =================
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

// ================= DASHBOARD =================
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
                    ${leader ? `<button class="btn-outline-action text-orange" onclick="editStudent(${leader.id})" title="Đổi quyền"><i class="fas fa-pen"></i></button>` : `<button class="btn-outline text-blue" style="padding:6px 12px; font-size:0.8rem;" onclick="switchView('view-students')">+ Chọn HS</button>`}
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

// ================= CẤU HÌNH SỔ BÁO GIẢNG (ĐÃ KHẮC PHỤC TRIỆT ĐỂ LỖI THIẾU HÀM) =================
window.renderSetupData = function() {
    let stp = appData.scheduleSetup;
    if (!stp) { 
        stp = { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] }; 
        appData.scheduleSetup = stp; 
    }
    if (!stp.mathRatios) stp.mathRatios = [];
    
    const w1DateEl = document.getElementById('setup-week1-date');
    if(w1DateEl) w1DateEl.value = stp.week1Start || '';
    
    if(document.getElementById('setup-tkb-count')) document.getElementById('setup-tkb-count').innerText = (stp.tkb || []).length + " bản ghi";
    if(document.getElementById('setup-ppct-count')) document.getElementById('setup-ppct-count').innerText = (stp.ppct || []).length + " bài dạy";
    if(document.getElementById('setup-holidays-count')) document.getElementById('setup-holidays-count').innerText = (stp.holidays || []).length + " sự kiện";
    if(document.getElementById('setup-math-ratio-count')) document.getElementById('setup-math-ratio-count').innerText = (stp.mathRatios || []).length + " cấu hình";

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
        (stp.mathRatios || []).forEach((m, i) => {
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
    let typeName = (type === 'tkb') ? 'Thời khóa biểu' : ((type === 'ppct') ? 'Phân phối chương trình' : 'Lịch nghỉ lễ');
    let currentCount = (appData.scheduleSetup[type] || []).length;
    if (currentCount === 0) return window.showToast(`Danh sách ${typeName} đang trống!`, "error");
    if (confirm(`⚠️ Bạn có chắc chắn muốn XÓA TẤT CẢ ${currentCount} dòng dữ liệu của ${typeName} không?`)) {
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
        if(lowN.includes('hình') || lowN.includes('góc') || lowN.includes('tam giác')) br = 'Hình';
        else br = 'Đại';
    }
    
    appData.scheduleSetup.ppct.push({ className: c.trim(), subject: s.trim(), branch: br, ppct: parseInt(p), content: n.trim() });
    window.saveData(); window.renderSetupData(); window.showToast("Đã thêm PPCT!");
};

function extractGrade(className) {
    if (!className) return "";
    let str = String(className).trim();
    let match = str.match(/(?:Khối\s*)?([1-9]|1[0-2])/i);
    return match ? match[1] : str.toLowerCase();
}

window.addMathRatio = function() {
    let grade = document.getElementById('add-math-grade').value.trim();
    let fw = parseInt(document.getElementById('add-math-from-week').value);
    let tw = parseInt(document.getElementById('add-math-to-week').value);
    let dai = parseInt(document.getElementById('add-math-dai').value);
    let hinh = parseInt(document.getElementById('add-math-hinh').value);
    
    if(!grade || isNaN(fw) || isNaN(tw) || isNaN(dai) || isNaN(hinh)) return window.showToast("Vui lòng điền đủ thông tin cấu hình!", "error");
    if(fw > tw || fw < 1 || tw > 35) return window.showToast("Khoảng tuần không hợp lệ (từ 1 đến 35)!", "error");
    
    grade = extractGrade(grade);
    if (!appData.scheduleSetup.mathRatios) appData.scheduleSetup.mathRatios = [];
    
    appData.scheduleSetup.mathRatios.push({ grade: grade, fromWeek: fw, toWeek: tw, dai: dai, hinh: hinh });
    appData.scheduleSetup.mathRatios.sort((a,b) => (a.grade === b.grade) ? (a.fromWeek - b.fromWeek) : a.grade.localeCompare(b.grade));
    
    window.saveData(); 
    window.renderSetupData(); 
    window.showToast(`Đã thêm cấu hình Khối ${grade}!`);
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
                let targetClass = document.getElementById('add-ppct-class') ? document.getElementById('add-ppct-class').value : "Chung"; 
                let targetSubject = document.getElementById('add-ppct-subject') ? document.getElementById('add-ppct-subject').value : "Chung";
                
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
                let targetClass = document.getElementById('add-ppct-class') ? document.getElementById('add-ppct-class').value : "Chung"; 
                let targetSubject = document.getElementById('add-ppct-subject') ? document.getElementById('add-ppct-subject').value : "Chung";

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
                            if(lowN.includes('hình') || lowN.includes('góc') || lowN.includes('tam giác') || lowN.includes('đo lường')) br = 'Hình';
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

// ================= KHỞI ĐỘNG HỆ THỐNG =================
window.initAppUI = function() {
    window.updateDashboardInfo();
    window.renderStudents();
    window.renderPermissionsView();
    window.renderSetupData();
};

window.finishLogin = function(welcomeMsg) {
    const loginSc = document.getElementById('login-screen');
    if(loginSc) loginSc.style.display = 'none';
    const unauthSc = document.getElementById('unauthorized-screen');
    if(unauthSc) unauthSc.style.display = 'none';
    window.applyRoleUI();
    window.initAppUI();
    window.showToast(welcomeMsg);
};

// ================= AUTH OBSERVER =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const statusMsg = document.getElementById('login-status-msg');
        if (statusMsg) statusMsg.innerText = "Đang kiểm tra vai trò tài khoản...";

        try {
            const userEmail = (user.email || "").toLowerCase().trim();
            const teacherRef = doc(firestoreDb, 'khach_hang_gvcn', user.uid);
            const teacherSnap = await getDoc(teacherRef);

            // 1. Nếu là GVCN chủ lớp đã có sẵn
            if (teacherSnap.exists()) {
                currentRole = "teacher";
                currentTeacherUid = user.uid;
                currentStudentProfile = null;
                
                const docRef = doc(firestoreDb, "DuLieuGVCN", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    appData = docSnap.data();
                    localStorage.setItem('gvcnData_v5', JSON.stringify(appData));
                } else {
                    await setDoc(docRef, appData);
                }

                window.finishLogin(`Chào mừng GVCN ${appData.settings.teacherName}`);
                return;
            }

            // 2. Nếu là Học sinh / Cán sự được GVCN cấp quyền
            const memberQuery = query(collection(firestoreDb, "class_members"), where("email", "==", userEmail), limit(1));
            const memberSnap = await getDocs(memberQuery);

            if (!memberSnap.empty) {
                const memberData = memberSnap.docs[0].data();
                currentTeacherUid = memberData.teacherUid;
                
                const docRef = doc(firestoreDb, "DuLieuGVCN", currentTeacherUid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    appData = docSnap.data();
                    localStorage.setItem('gvcnData_v5', JSON.stringify(appData));
                }

                const matchedStudent = (appData.students || []).find(s => (s.email || "").toLowerCase() === userEmail);
                if (matchedStudent) {
                    currentRole = matchedStudent.role || "student";
                    currentStudentProfile = matchedStudent;
                    
                    let roleTitle = currentRole === 'class_leader' ? 'Lớp trưởng' : (currentRole === 'vice_leader' ? 'Lớp phó' : (currentRole === 'group_leader' ? `Tổ trưởng Tổ ${matchedStudent.team}` : 'Học sinh'));
                    window.finishLogin(`Chào mừng ${roleTitle} ${matchedStudent.name}`);
                    return;
                }
            }

            // 3. Nếu là chủ tài khoản tạo lớp mới
            const allMembersCheck = await getDocs(query(collection(firestoreDb, "class_members"), where("email", "==", userEmail), limit(1)));
            if (allMembersCheck.empty && !teacherSnap.exists()) {
                let ngayHetHan = new Date();
                ngayHetHan.setDate(ngayHetHan.getDate() + 30);
                await setDoc(teacherRef, { email: userEmail, ngay_dang_ky: new Date().toISOString(), ngay_het_han: ngayHetHan.toISOString() });
                
                currentRole = "teacher";
                currentTeacherUid = user.uid;
                currentStudentProfile = null;
                await setDoc(doc(firestoreDb, "DuLieuGVCN", user.uid), appData);
                window.finishLogin(`Chào mừng GVCN ${user.displayName || ""}`);
                return;
            }

            // 4. Tài khoản chưa được cấp quyền
            document.getElementById('unauth-email').innerText = userEmail;
            document.getElementById('unauthorized-screen').style.display = 'flex';
            if (loginScreen) loginScreen.style.display = 'none';

        } catch (err) {
            console.error("Lỗi xác thực:", err);
            let matched = (appData.students || []).find(s => (s.email || "").toLowerCase() === (user.email || "").toLowerCase());
            if (matched) {
                currentRole = matched.role || "student";
                currentStudentProfile = matched;
            } else {
                currentRole = "teacher";
            }
            window.finishLogin("Đăng nhập hoàn tất (Ngoại tuyến)");
        }
    } else {
        currentUser = null;
        if(loginScreen) loginScreen.style.display = 'flex';
        const unauthSc = document.getElementById('unauthorized-screen');
        if(unauthSc) unauthSc.style.display = 'none';
    }
});

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
