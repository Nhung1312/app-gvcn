// ================= FIREBASE AUTH & DATABASE GVCN V5 =================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { initializeFirestore, doc, setDoc, getDoc, collection, addDoc, getDocs, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// THÔNG TIN USER VÀ VAI TRÒ HIỆN TẠI
let currentUser = null;
let currentRole = "student"; // teacher, class_leader, vice_leader, group_leader, student
let currentStudentProfile = null; // null nếu là GVCN
let currentTeacherUid = null;     // UID của GVCN chủ lớp

const loginScreen = document.getElementById('login-screen');
const btnLogin = document.getElementById('btn-login');

if(btnLogin) {
    btnLogin.addEventListener('click', () => {
        document.getElementById('login-status-msg').innerText = "Đang kết nối Google...";
        signInWithPopup(auth, provider).catch((error) => {
            alert("Lỗi đăng nhập: " + error.message);
            document.getElementById('login-status-msg').innerText = "";
        });
    });
}

// ================= HỆ THỐNG MIGRATION & DỮ LIỆU APP V5 =================
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
        // Tự động Migration từ v4 hoặc v3 sang v5
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
                role: s.role || "student", // teacher, class_leader, vice_leader, group_leader, student
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
            groups: oldData.groups || [
                { id: "1", name: "Tổ 1", leaderStudentId: null },
                { id: "2", name: "Tổ 2", leaderStudentId: null },
                { id: "3", name: "Tổ 3", leaderStudentId: null },
                { id: "4", name: "Tổ 4", leaderStudentId: null }
            ],
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
    }
    return v5Data;
}

let appData = initData();
let syncTimeout = null;

// ================= QUYỀN HẠN & HÀM KIỂM TRA =================
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

// Lưu dữ liệu an toàn & đồng bộ theo vai trò
window.saveData = function() {
    localStorage.setItem('gvcnData_v5', JSON.stringify(appData));
    window.updateDashboardInfo();

    if (currentUser && currentTeacherUid) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(async () => {
            try {
                if (window.isTeacher()) {
                    // GVCN ghi toàn quyền vào kho dữ liệu chính
                    const docRef = doc(firestoreDb, "DuLieuGVCN", currentTeacherUid);
                    await setDoc(docRef, appData);
                    console.log("☁️ GVCN đã đồng bộ dữ liệu lớp lên Cloud.");
                } else {
                    // Cán sự ghi nhận xét / nề nếp sẽ đẩy bản ghi lên Cloud
                    console.log("☁️ Cán sự lưu cục bộ và gửi cập nhật.");
                }
            } catch (e) {
                console.error("Lỗi đồng bộ Cloud:", e);
            }
        }, 2000);
    }
};

// ================= AUTH STATE & ĐĂNG NHẬP THÔNG MINH =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const statusMsg = document.getElementById('login-status-msg');
        if (statusMsg) statusMsg.innerText = "Đang kiểm tra vai trò tài khoản...";

        try {
            const userEmail = (user.email || "").toLowerCase().trim();
            const teacherRef = doc(firestoreDb, 'khach_hang_gvcn', user.uid);
            const teacherSnap = await getDoc(teacherRef);

            // KIỂM TRA 1: NẾU LÀ TÀI KHOẢN GVCN ĐÃ CÓ
            if (teacherSnap.exists()) {
                currentRole = "teacher";
                currentTeacherUid = user.uid;
                currentStudentProfile = null;
                
                // Tải dữ liệu lớp GVCN
                const docRef = doc(firestoreDb, "DuLieuGVCN", user.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    appData = docSnap.data();
                    localStorage.setItem('gvcnData_v5', JSON.stringify(appData));
                } else {
                    await setDoc(docRef, appData);
                }

                finishLogin(`Chào mừng GVCN ${appData.settings.teacherName}`);
                return;
            }

            // KIỂM TRA 2: NẾU LÀ HỌC SINH / CÁN SỰ ĐÃ ĐƯỢC LIÊN KẾT GMAIL
            // Tìm trong bảng mapping thành viên lớp
            const memberQuery = query(collection(firestoreDb, "class_members"), where("email", "==", userEmail), limit(1));
            const memberSnap = await getDocs(memberQuery);

            if (!memberSnap.empty) {
                const memberData = memberSnap.docs[0].data();
                currentTeacherUid = memberData.teacherUid;
                
                // Tải dữ liệu lớp của GVCN tương ứng
                const docRef = doc(firestoreDb, "DuLieuGVCN", currentTeacherUid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    appData = docSnap.data();
                    localStorage.setItem('gvcnData_v5', JSON.stringify(appData));
                }

                // Khớp học sinh trong danh sách
                const matchedStudent = appData.students.find(s => (s.email || "").toLowerCase() === userEmail);
                if (matchedStudent) {
                    currentRole = matchedStudent.role || "student";
                    currentStudentProfile = matchedStudent;
                    
                    let roleTitle = currentRole === 'class_leader' ? 'Lớp trưởng' : (currentRole === 'vice_leader' ? 'Lớp phó' : (currentRole === 'group_leader' ? `Tổ trưởng Tổ ${matchedStudent.team}` : 'Học sinh'));
                    finishLogin(`Chào mừng ${roleTitle} ${matchedStudent.name}`);
                    return;
                }
            }

            // KIỂM TRA 3: NẾU LẦN ĐẦU TIÊN VÀ LÀ CHỦ TÀI KHOẢN MỚI
            // Nếu email chưa tồn tại trong bất kỳ lớp nào, mở tạo lớp GVCN mới
            const allMembersCheck = await getDocs(query(collection(firestoreDb, "class_members"), where("email", "==", userEmail), limit(1)));
            if (allMembersCheck.empty && !teacherSnap.exists()) {
                // Tạo tài khoản GVCN mới
                let ngayHetHan = new Date();
                ngayHetHan.setDate(ngayHetHan.getDate() + 30);
                await setDoc(teacherRef, { email: userEmail, ngay_dang_ky: new Date().toISOString(), ngay_het_han: ngayHetHan.toISOString() });
                
                currentRole = "teacher";
                currentTeacherUid = user.uid;
                currentStudentProfile = null;
                await setDoc(doc(firestoreDb, "DuLieuGVCN", user.uid), appData);
                finishLogin(`Chào mừng GVCN ${user.displayName || ""}`);
                return;
            }

            // KIỂM TRA 4: TÀI KHOẢN CHƯA ĐƯỢC CẤP QUYỀN
            document.getElementById('unauth-email').innerText = userEmail;
            document.getElementById('unauthorized-screen').style.display = 'flex';
            if (loginScreen) loginScreen.style.display = 'none';

        } catch (err) {
            console.error("Lỗi xác thực:", err);
            // Chế độ offline: Dựa vào data cục bộ
            let matched = appData.students.find(s => (s.email || "").toLowerCase() === (user.email || "").toLowerCase());
            if (matched) {
                currentRole = matched.role || "student";
                currentStudentProfile = matched;
            } else {
                currentRole = "teacher";
            }
            finishLogin("Đăng nhập hoàn tất (Ngoại tuyến)");
        }
    } else {
        currentUser = null;
        if(loginScreen) loginScreen.style.display = 'flex';
        document.getElementById('unauthorized-screen').style.display = 'none';
    }
});

function finishLogin(welcomeMsg) {
    if(loginScreen) loginScreen.style.display = 'none';
    document.getElementById('unauthorized-screen').style.display = 'none';
    window.applyRoleUI();
    window.initAppUI();
    window.showToast(welcomeMsg);
}

// ================= ADAPTIVE UI THEO VAI TRÒ =================
window.applyRoleUI = function() {
    const roleBadge = document.getElementById('current-user-role-badge');
    const groupBadge = document.getElementById('current-user-group-badge');
    const userNameEl = document.getElementById('dash-user-name');
    const avatarEl = document.getElementById('user-avatar-img');

    // Cập nhật Avatar & Tên
    if (window.isTeacher()) {
        userNameEl.innerText = appData.settings.teacherName;
        roleBadge.className = "role-badge badge-teacher";
        roleBadge.innerText = "👨‍🏫 GVCN";
        groupBadge.style.display = "none";
    } else if (currentStudentProfile) {
        userNameEl.innerText = currentStudentProfile.name;
        avatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentStudentProfile.name)}&background=e0ecff&color=0d6efd&bold=true`;
        
        if (window.isClassLeader()) {
            roleBadge.className = "role-badge badge-leader";
            roleBadge.innerText = "⭐ Lớp trưởng";
            groupBadge.style.display = "none";
        } else if (window.isViceLeader()) {
            roleBadge.className = "role-badge badge-vice";
            roleBadge.innerText = "📚 Lớp phó";
            groupBadge.style.display = "none";
        } else if (window.isGroupLeader()) {
            roleBadge.className = "role-badge badge-groupleader";
            roleBadge.innerText = "👥 Tổ trưởng";
            groupBadge.style.display = "inline-block";
            groupBadge.innerText = `Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`;
        } else {
            roleBadge.className = "role-badge badge-student";
            roleBadge.innerText = "🎓 Học sinh";
            groupBadge.style.display = "inline-block";
            groupBadge.innerText = `Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`;
        }
    }

    // Ẩn/Hiện Menu và Nút chức năng chỉ dành cho GVCN
    const isT = window.isTeacher();
    document.querySelectorAll('.teacher-only').forEach(el => {
        el.style.display = isT ? '' : 'none';
    });

    // Ẩn menu phân quyền với học sinh/cán sự
    const permMenu = document.getElementById('menu-item-permissions');
    if (permMenu) permMenu.style.display = isT ? 'flex' : 'none';

    // Ẩn nhật ký hoạt động nếu không phải GVCN hoặc Lớp trưởng
    const logMenu = document.getElementById('menu-item-activity-logs');
    if (logMenu) logMenu.style.display = (isT || window.isClassLeader()) ? 'flex' : 'none';

    // Điều chỉnh Dashboard theo vai trò
    if (window.isGroupLeader()) {
        document.getElementById('group-leader-banner').style.display = 'block';
        document.getElementById('main-class-hero').style.display = 'none';
        document.getElementById('student-banner').style.display = 'none';
        document.getElementById('gl-banner-group-title').innerText = `⭐ Quản lý Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`;
        document.getElementById('gl-banner-class').innerText = `Lớp ${appData.settings.className}`;
    } else if (window.isStudent()) {
        document.getElementById('student-banner').style.display = 'block';
        document.getElementById('group-leader-banner').style.display = 'none';
        document.getElementById('main-class-hero').style.display = 'none';
        document.getElementById('stu-banner-team').innerText = `Tổ ${currentStudentProfile.team || currentStudentProfile.groupId}`;
    } else {
        document.getElementById('main-class-hero').style.display = 'block';
        document.getElementById('group-leader-banner').style.display = 'none';
        document.getElementById('student-banner').style.display = 'none';
    }

    // Ẩn thanh bottom nav các mục cấm
    if (document.getElementById('nav-settings')) {
        document.getElementById('nav-settings').style.display = isT ? 'flex' : 'none';
    }
    if (document.getElementById('nav-attendance')) {
        document.getElementById('nav-attendance').style.display = (isT || window.hasPermission('manageAttendance')) ? 'flex' : 'none';
    }
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
    
    // Kiểm tra quyền ghi nề nếp
    if (!window.isTeacher() && !window.hasPermission('manageDiscipline')) {
        if (!window.isGroupLeader()) {
            return window.showToast("Bạn không có quyền ghi nhận nề nếp!", "error");
        }
    }

    // Kiểm tra Tổ trưởng chỉ được ghi nề nếp cho tổ của mình
    if (window.isGroupLeader()) {
        if (!window.canManageStudent(stuId)) {
            return window.showToast("Bạn chỉ có quyền ghi nhận cho thành viên trong Tổ của mình!", "error");
        }
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

    // Ghi vào Sub-collection hoạt động trên Firestore để GVCN theo dõi realtime
    if (currentTeacherUid) {
        try {
            await addDoc(collection(firestoreDb, `classes/${currentTeacherUid}/activityLogs`), {
                ...newRecord,
                desc: `${operatorName} (${getRoleVietnamese(operatorRole)}) đã ghi nhận: ${targetStudent ? targetStudent.name : ""} - ${tag.name} (${pts > 0 ? '+' : ''}${pts}đ)`
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

function getRoleVietnamese(role) {
    const map = {
        teacher: "GVCN",
        class_leader: "Lớp trưởng",
        vice_leader: "Lớp phó",
        group_leader: "Tổ trưởng",
        student: "Học sinh"
    };
    return map[role] || "Thành viên";
}

// ================= RENDER NHẬT KÝ HOẠT ĐỘNG CHO GVCN =================
window.renderActivityLogs = function() {
    const container = document.getElementById('activity-logs-container');
    if (!container) return;
    container.innerHTML = '';

    const filterRole = document.getElementById('filter-log-role').value;
    const filterDate = document.getElementById('filter-log-date').value;

    let records = (appData.behaviorRecords || []).slice().reverse();

    if (filterRole !== 'all') {
        records = records.filter(r => r.createdByRole === filterRole);
    }
    if (filterDate) {
        records = records.filter(r => r.date === filterDate);
    }

    if (records.length === 0) {
        container.innerHTML = '<div class="empty-state">Chưa có nhật ký hoạt động nào phù hợp.</div>';
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

// ================= RENDER NỀ NẾP & HỌC SINH THEO VAI TRÒ =================
window.renderDisciplineStudents = function() {
    const txt = (document.getElementById('search-disc-student')?.value || '').toLowerCase();
    const list = document.getElementById('discipline-student-list');
    if (!list) return;
    list.innerHTML = '';

    let ptsMap = {};
    appData.behaviorRecords.forEach(r => { 
        ptsMap[r.studentId] = (ptsMap[r.studentId] || 0) + Number(r.snapshotPoints); 
    });

    let displayStudents = appData.students.filter(s => s.name.toLowerCase().includes(txt));

    // NẾU LÀ TỔ TRƯỞNG: CHỈ HIỂN THỊ THÀNH VIÊN TRONG TỔ CỦA MÌNH
    if (window.isGroupLeader() && currentStudentProfile) {
        displayStudents = displayStudents.filter(s => String(s.team || s.groupId) === String(currentStudentProfile.team || currentStudentProfile.groupId));
    }

    if (displayStudents.length === 0) {
        list.innerHTML = '<div class="empty-state">Không có học sinh nào trong phạm vi quản lý.</div>';
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
        return window.showToast("Tổ trưởng không được ghi nhận cho học sinh tổ khác!", "error");
    }
    if (window.isStudent()) {
        return window.showToast("Học sinh không có quyền ghi nhận nề nếp!", "error");
    }

    window.currentDiscStuId = stuId; 
    document.getElementById('behavior-target-name').innerText = `Đang chọn: ${stuName}`; 
    window.renderQuickTags(); 
    window.openModal('modal-record-behavior'); 
};

// ================= RENDER MÀN HÌNH PHÂN QUYỀN CÁN SỰ =================
window.renderPermissionsView = function() {
    if (!window.isTeacher()) return;

    const cadresList = document.getElementById('cadres-list');
    const groupLeadersList = document.getElementById('group-leaders-list');
    if (!cadresList || !groupLeadersList) return;

    cadresList.innerHTML = '';
    groupLeadersList.innerHTML = '';

    const cadres = appData.students.filter(s => s.role === 'class_leader' || s.role === 'vice_leader');
    if (cadres.length === 0) {
        cadresList.innerHTML = '<div class="text-muted" style="font-size:0.85rem; padding:10px;">Chưa phân công Lớp trưởng & Lớp phó. Bấm vào học sinh trong danh sách để cấp vai trò.</div>';
    } else {
        cadres.forEach(s => {
            cadresList.innerHTML += `
                <div class="list-item">
                    <div class="list-item-info">
                        <strong>${s.name} <span class="role-badge ${s.role==='class_leader'?'badge-leader':'badge-vice'}">${getRoleVietnamese(s.role)}</span></strong>
                        <small><i class="fab fa-google text-blue"></i> ${s.email || 'Chưa liên kết Gmail'}</small>
                    </div>
                    <button class="btn-outline-action text-blue" onclick="editStudent(${s.id})" title="Chỉnh sửa quyền"><i class="fas fa-user-edit"></i></button>
                </div>
            `;
        });
    }

    for (let t = 1; t <= 4; t++) {
        const leader = appData.students.find(s => s.role === 'group_leader' && String(s.team || s.groupId) === String(t));
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

// ================= HỒ SƠ HỌC SINH & GÁN GMAIL PHÂN QUYỀN =================
window.saveStudent = async function() {
    if (!window.isTeacher()) {
        return window.showToast("Chỉ GVCN mới có quyền chỉnh sửa học sinh!", "error");
    }

    const id = document.getElementById('stu-id').value;
    const name = document.getElementById('stu-name').value.trim();
    const gender = document.getElementById('stu-gender').value;
    const team = parseInt(document.getElementById('stu-team').value) || 1;
    const dob = document.getElementById('stu-dob').value;
    const phone = document.getElementById('stu-phone').value.trim();
    const email = document.getElementById('stu-email').value.trim().toLowerCase();
    const role = document.getElementById('stu-role').value;

    if(!name) return window.showToast("Vui lòng nhập họ và tên!", "error");

    // Quyền hạn bổ sung
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

    // ĐỒNG BỘ MAPPING LÊN BẢNG CLOUD `class_members` ĐỂ HỌC SINH ĐĂNG NHẬP
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
            console.log("☁️ Đã liên kết mapping Gmail thành công:", email);
        } catch (e) {
            console.error("Lỗi liên kết Gmail trên Cloud:", e);
        }
    }

    window.saveData(); 
    window.renderStudents(); 
    window.renderPermissionsView();
    window.closeModal('modal-add-student');
};

window.editStudent = function(id) { 
    const stu = appData.students.find(s => s.id === id); 
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

        // Toggle quyền chi tiết
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
    if (!window.isTeacher()) {
        return window.showToast("Chỉ GVCN mới có quyền xóa danh sách lớp!", "error");
    }
    if (!appData.students || appData.students.length === 0) {
        return window.showToast("Danh sách học sinh của lớp đang trống!", "error");
    }
    if (confirm(`⚠️ CẢNH BÁO NGUY HIỂM:\nBạn có chắc chắn muốn XÓA TOÀN BỘ ${appData.students.length} học sinh của lớp không?\nThao tác này giúp bạn dọn sạch dữ liệu cũ để tải file danh sách mới lên.`)) {
        appData.students = [];
        appData.activityGroups = [];
        window.saveData();
        window.renderStudents();
        window.renderPermissionsView();
        window.showToast("✅ Đã xóa sạch danh sách học sinh của lớp!", "success");
    }
};

// ================= RENDER HỌC SINH =================
window.renderStudents = function() {
    const list = document.getElementById('student-list'); 
    if(!list) return;
    list.innerHTML = ''; 

    const searchInput = document.getElementById('search-student');
    const filterText = searchInput ? searchInput.value.toLowerCase() : "";
    let filtered = appData.students.filter(s => s.name.toLowerCase().includes(filterText));

    // NẾU LÀ TỔ TRƯỞNG: CHỈ XEM HỌC SINH TỔ MÌNH
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
        appData.students.forEach(st => {
            let t = st.team || 1;
            if(!teams[t]) teams[t] = [];
            teams[t].push(st);
        });

        // Nếu là tổ trưởng: Chỉ xem tổ của mình
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

// ================= ĐIỂM DANH =================
window.renderAttendance = function() {
    const date = document.getElementById('attendance-date').value; 
    const list = document.getElementById('attendance-list'); 
    if(!list) return;
    list.innerHTML = '';

    if(!appData.attendance[date]) { 
        appData.attendance[date] = {}; 
        appData.students.forEach(s => appData.attendance[date][s.id] = 'present'); 
    }
    
    let stats = { present: 0, excused: 0, unexcused: 0 }; 
    const records = appData.attendance[date];

    appData.students.forEach((stu, index) => {
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

// Khởi chạy App UI
window.initAppUI = function() {
    window.updateDashboardInfo();
    window.renderStudents();
    window.renderPermissionsView();
    window.renderSetupData();
};