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
                    }
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
            localStorage.removeItem('gvcnData_v4'); 
            location.reload();
        });
    }
};

function initData() {
    let saved = JSON.parse(localStorage.getItem('gvcnData_v4'));
    if (!saved) {
        saved = {
            settings: { className: "9A", teacherName: "Thầy/Cô", schoolYear: "2025-2026", seatRows: 5, seatCols: 4 },
            students: [],
            attendance: {},
            discipline: [],
            fundLogs: [],
            fundCampaigns: [],
            scheduleSetup: { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] },
            scheduleRecords: []
        };
    } else {
        if (!saved.scheduleSetup) saved.scheduleSetup = { week1Start: "", ppct: [], tkb: [], holidays: [], mathRatios: [] };
        if (!saved.scheduleSetup.mathRatios) saved.scheduleSetup.mathRatios = [];
        if (!saved.scheduleRecords) saved.scheduleRecords = [];
    }
    return saved;
}

let appData = initData();
let syncTimeout = null;

window.saveData = function() {
    localStorage.setItem('gvcnData_v4', JSON.stringify(appData));
    if (currentUser) {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => {
            const docRef = doc(firestoreDb, "DuLieuGVCN", currentUser.uid);
            setDoc(docRef, appData).then(() => { console.log("☁️ Đã đồng bộ mây GVCN!"); }).catch(e => console.error(e));
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
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-20px)';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

window.toggleDrawer = function(open) {
    document.getElementById('drawer').classList.toggle('active', open);
    document.getElementById('drawer-overlay').classList.toggle('active', open);
};

window.switchView = function(viewId, navEl = null) {
    document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
    window.scrollTo(0, 0);

    document.querySelectorAll('.drawer-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if(navEl) navEl.classList.add('active');

    if(viewId === 'view-dashboard') renderDashboard();
    if(viewId === 'view-students') renderStudentsList();
    if(viewId === 'view-attendance') loadAttendanceByDate();
    if(viewId === 'view-discipline') renderDisciplineRecords();
    if(viewId === 'view-fees') renderFundSummary();
    if(viewId === 'view-lesson-log') initLessonLogView();
    if(viewId === 'view-settings') loadSettingsToUI();
};

window.openModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'flex'; 
};
window.closeModal = function(id) { 
    const el = document.getElementById(id);
    if(el) el.style.display = 'none'; 
};

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

function renderDashboard() {
    const s = appData.settings;
    document.getElementById('dash-school-year').innerText = s.schoolYear;
    document.getElementById('dash-class-name').innerText = 'Lớp ' + s.className;
    document.getElementById('dash-teacher-name').innerText = s.teacherName;
    document.getElementById('dash-total-students').innerText = appData.students.length;

    let today = getTodayStr();
    let att = appData.attendance[today] || {};
    let present = 0, absent = 0;
    appData.students.forEach(st => {
        let status = att[st.id] || 'present';
        if(status === 'present') present++; else absent++;
    });
    document.getElementById('dash-present-today').innerText = present;
    document.getElementById('dash-absent-today').innerText = absent;

    let balance = calculateFundBalance();
    document.getElementById('dash-fund-balance').innerText = balance.toLocaleString('vi-VN') + 'đ';

    const alertsContainer = document.getElementById('dash-alerts-container');
    alertsContainer.innerHTML = '';
    let alertsCount = 0;

    if(absent > 0) {
        alertsCount++;
        alertsContainer.innerHTML += `
            <div class="alert-item red">
                <div class="alert-icon"><i class="fas fa-user-times"></i></div>
                <div class="alert-info"><h4>Vắng mặt hôm nay (${absent} HS)</h4><p>Kiểm tra liên hệ phụ huynh các em vắng tiết.</p></div>
            </div>`;
    }

    let unpaidStudents = getUnpaidCampaignsCount();
    if(unpaidStudents > 0) {
        alertsCount++;
        alertsContainer.innerHTML += `
            <div class="alert-item yellow">
                <div class="alert-icon"><i class="fas fa-coins"></i></div>
                <div class="alert-info"><h4>Khoản thu chưa hoàn tất</h4><p>Còn ${unpaidStudents} lượt chưa nộp các khoản quỹ.</p></div>
            </div>`;
    }

    if(alertsCount === 0) {
        alertsContainer.innerHTML = `<div class="alert-item green"><div class="alert-icon"><i class="fas fa-check-circle"></i></div><div class="alert-info"><h4>Tất cả ổn định!</h4><p>Chưa có vấn đề gì cần lưu ý hôm nay.</p></div></div>`;
    }
    document.getElementById('dash-badge-alerts').innerText = alertsCount + ' việc';

    const llList = document.getElementById('dash-ll-list');
    if (llList) {
        llList.innerHTML = '';
        let todaysLessons = (appData.scheduleRecords || []).filter(r => r.date === today);
        document.getElementById('dash-ll-date').innerText = new Date().toLocaleDateString('vi-VN');
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
        document.getElementById('dash-ll-week-count').innerText = weekLessons;
    }
}

function calculateFundBalance() {
    let tin = 0, tout = 0;
    appData.fundLogs.forEach(l => {
        if(l.type === 'in') tin += l.amount; else tout += l.amount;
    });
    return tin - tout;
}

function getUnpaidCampaignsCount() {
    let count = 0;
    appData.fundCampaigns.forEach(c => {
        let paidCount = Object.values(c.paid || {}).filter(v => v).length;
        count += (appData.students.length - paidCount);
    });
    return count;
}

let isSeatmapView = false;
window.toggleStudentSubView = function() {
    isSeatmapView = !isSeatmapView;
    document.getElementById('subview-students-list').style.display = isSeatmapView ? 'none' : 'block';
    document.getElementById('subview-seatmap').style.display = isSeatmapView ? 'block' : 'none';
    document.getElementById('btn-toggle-subview-icon').className = isSeatmapView ? 'fas fa-list' : 'fas fa-th';
    if(isSeatmapView) renderSeatmap(); else renderStudentsList();
};

window.renderStudentsList = function() {
    const container = document.getElementById('students-container');
    container.innerHTML = '';
    const query = (document.getElementById('search-student-input')?.value || '').toLowerCase();
    const list = appData.students.filter(s => s.name.toLowerCase().includes(query));

    if(list.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Không tìm thấy học sinh nào.</div>';
        return;
    }

    list.forEach((st, idx) => {
        let initials = st.name.split(' ').map(n=>n[0]).slice(-2).join('').toUpperCase();
        let item = document.createElement('div');
        item.className = 'student-card';
        item.innerHTML = `
            <div class="student-avatar ${st.gender === 'Nữ' ? 'female' : ''}">${initials}</div>
            <div class="student-info">
                <h4>${st.name}</h4>
                <p>Tổ ${st.team} | ${st.gender} | Sinh: ${st.dob || '--'}</p>
            </div>
            <div class="student-actions">
                ${st.parentPhone ? `<a href="tel:${st.parentPhone}" class="btn-outline-action text-blue"><i class="fas fa-phone"></i></a>` : ''}
                <button class="btn-outline-action text-red" onclick="deleteStudent(${st.id})"><i class="fas fa-trash"></i></button>
            </div>
        `;
        container.appendChild(item);
    });
};

window.saveNewStudent = function() {
    let name = document.getElementById('add-stu-name').value.trim();
    let gender = document.getElementById('add-stu-gender').value;
    let team = document.getElementById('add-stu-team').value;
    let dob = document.getElementById('add-stu-dob').value;
    let phone = document.getElementById('add-stu-parent-phone').value.trim();
    let note = document.getElementById('add-stu-note').value.trim();

    if(!name) return window.showToast('Vui lòng nhập họ và tên!', 'error');

    appData.students.push({
        id: Date.now(),
        name: name,
        gender: gender,
        team: parseInt(team),
        dob: dob,
        parentPhone: phone,
        note: note,
        seatIndex: -1
    });

    window.saveData();
    window.closeModal('modal-add-student');
    window.renderStudentsList();
    window.showToast('Đã thêm học sinh thành công!');
    document.getElementById('add-stu-name').value = '';
};

window.deleteStudent = function(id) {
    if(confirm('Bạn có chắc chắn muốn xóa học sinh này khỏi danh sách lớp?')) {
        appData.students = appData.students.filter(s => s.id !== id);
        window.saveData();
        window.renderStudentsList();
        window.showToast('Đã xóa học sinh.');
    }
};

window.renderSeatmap = function() {
    const grid = document.getElementById('seatmap-grid-container');
    grid.innerHTML = '';
    const s = appData.settings;
    grid.style.gridTemplateColumns = `repeat(${s.seatCols}, 1fr)`;

    let totalSeats = s.seatRows * s.seatCols;
    for(let i = 0; i < totalSeats; i++) {
        let student = appData.students.find(st => st.seatIndex === i);
        let cell = document.createElement('div');
        cell.className = `seat-cell ${student ? 'occupied' : ''}`;
        cell.innerHTML = student ? `<strong>${student.name}</strong><br><small>Tổ ${student.team}</small>` : `<span>Bàn ${i+1}</span>`;
        cell.onclick = () => assignSeat(i);
        grid.appendChild(cell);
    }
};

function assignSeat(seatIdx) {
    let options = ['-- Bỏ trống chỗ này --', ...appData.students.map((st, i) => `${i+1}. ${st.name}`)];
    let choice = prompt(`Sắp chỗ Bàn số ${seatIdx+1}:\nNhập STT học sinh (hoặc 0 để bỏ trống):`);
    if(choice === null) return;
    let num = parseInt(choice);
    if(isNaN(num) || num < 0 || num > appData.students.length) return alert('Lựa chọn không hợp lệ!');

    appData.students.forEach(st => { if(st.seatIndex === seatIdx) st.seatIndex = -1; });
    if(num > 0) {
        appData.students[num-1].seatIndex = seatIdx;
    }
    window.saveData();
    window.renderSeatmap();
}

window.updateSeatmapDimensions = function() {
    appData.settings.seatCols = parseInt(document.getElementById('seatmap-cols').value) || 4;
    appData.settings.seatRows = parseInt(document.getElementById('seatmap-rows').value) || 5;
    window.saveData();
    window.renderSeatmap();
};

window.loadAttendanceByDate = function() {
    let inputDate = document.getElementById('attendance-current-date');
    if(!inputDate.value) inputDate.value = getTodayStr();
    let curDate = inputDate.value;

    if(!appData.attendance[curDate]) {
        appData.attendance[curDate] = {};
        appData.students.forEach(st => { appData.attendance[curDate][st.id] = 'present'; });
    }

    let att = appData.attendance[curDate];
    const container = document.getElementById('attendance-container');
    container.innerHTML = '';
    let present = 0, absent = 0;

    appData.students.forEach((st, idx) => {
        let status = att[st.id] || 'present';
        if(status === 'present') present++; else absent++;

        let row = document.createElement('div');
        row.className = 'attendance-row';
        row.innerHTML = `
            <div style="flex:1;">
                <strong>${idx+1}. ${st.name}</strong>
                <p style="font-size:0.75rem; color:var(--text-muted); margin:0;">Tổ ${st.team}</p>
            </div>
            <div class="att-status-buttons">
                <button class="btn-att ${status === 'present' ? 'present' : ''}" onclick="setStudentAttStatus('${curDate}', ${st.id}, 'present')"><i class="fas fa-check"></i></button>
                <button class="btn-att ${status === 'permitted' ? 'permitted' : ''}" onclick="setStudentAttStatus('${curDate}', ${st.id}, 'permitted')">P</button>
                <button class="btn-att ${status === 'absent' ? 'absent' : ''}" onclick="setStudentAttStatus('${curDate}', ${st.id}, 'absent')"><i class="fas fa-times"></i></button>
            </div>
        `;
        container.appendChild(row);
    });

    document.getElementById('att-summary-total').innerText = appData.students.length;
    document.getElementById('att-summary-present').innerText = present;
    document.getElementById('att-summary-absent').innerText = absent;
};

window.setStudentAttStatus = function(dateStr, stId, status) {
    if(!appData.attendance[dateStr]) appData.attendance[dateStr] = {};
    appData.attendance[dateStr][stId] = status;
    window.saveData();
    window.loadAttendanceByDate();
};

window.changeAttendanceDate = function(offset) {
    let d = new Date(document.getElementById('attendance-current-date').value);
    d.setDate(d.getDate() + offset);
    document.getElementById('attendance-current-date').value = d.toISOString().split('T')[0];
    window.loadAttendanceByDate();
};

window.saveAttendance = function() {
    window.saveData();
    window.showToast('Đã lưu điểm danh ngày hôm nay!');
};

window.switchDisciplineTab = function(tab, btn) {
    document.querySelectorAll('#view-discipline .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-discipline-violations').style.display = tab === 'violations' ? 'block' : 'none';
    document.getElementById('tab-discipline-leaderboard').style.display = tab === 'leaderboard' ? 'block' : 'none';
    if(tab === 'violations') renderDisciplineRecords(); else renderDisciplineLeaderboard();
};

function renderDisciplineRecords() {
    const container = document.getElementById('discipline-records-container');
    container.innerHTML = '';
    if(appData.discipline.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Lớp chưa có ghi nhận vi phạm nào.</div>';
        return;
    }
    appData.discipline.slice().reverse().forEach((d, idx) => {
        let st = appData.students.find(s => s.id === d.studentId);
        let item = document.createElement('div');
        item.className = 'record-card';
        item.innerHTML = `
            <div style="flex:1;">
                <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
                    <strong>${st ? st.name : 'Đã xóa'}</strong>
                    <span class="badge ${d.type === 'violation' ? 'badge-red' : 'badge-green'}">${d.type === 'violation' ? '-' : '+'}${d.points}đ</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-main); margin:0;">${d.reason}</p>
                <small style="color:var(--text-muted); font-size:0.75rem;">${d.date}</small>
            </div>
            <button class="btn-outline-action text-red" style="margin-left:10px;" onclick="deleteDiscipline(${d.id})"><i class="fas fa-trash"></i></button>
        `;
        container.appendChild(item);
    });
}

function renderDisciplineLeaderboard() {
    const container = document.getElementById('discipline-leaderboard-container');
    container.innerHTML = '';
    let scores = {};
    appData.students.forEach(st => { scores[st.id] = 100; });
    appData.discipline.forEach(d => {
        if(scores[d.studentId] !== undefined) {
            if(d.type === 'violation') scores[d.studentId] -= d.points;
            else scores[d.studentId] += d.points;
        }
    });

    let sorted = appData.students.map(st => ({ student: st, score: scores[st.id] })).sort((a,b) => b.score - a.score);

    sorted.forEach((item, i) => {
        let row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
            <div class="lb-rank ${i<3 ? 'top text-orange' : ''}">#${i+1}</div>
            <div style="flex:1;"><strong>${item.student.name}</strong><br><small class="text-muted">Tổ ${item.student.team}</small></div>
            <div class="lb-score ${item.score < 80 ? 'text-red' : 'text-green'}">${item.score}đ</div>
        `;
        container.appendChild(row);
    });
}

window.saveDisciplineRecord = function() {
    let stId = parseInt(document.getElementById('disc-student-select').value);
    let type = document.getElementById('disc-type').value;
    let points = parseInt(document.getElementById('disc-points').value) || 2;
    let reason = document.getElementById('disc-reason').value.trim();
    let date = document.getElementById('disc-date').value || getTodayStr();

    if(!stId || !reason) return window.showToast('Vui lòng nhập đủ thông tin!', 'error');

    appData.discipline.push({ id: Date.now(), studentId: stId, type: type, points: points, reason: reason, date: date });
    window.saveData();
    window.closeModal('modal-add-discipline');
    renderDisciplineRecords();
    window.showToast('Đã lưu ghi nhận kỷ luật!');
    document.getElementById('disc-reason').value = '';
};

window.deleteDiscipline = function(id) {
    appData.discipline = appData.discipline.filter(d => d.id !== id);
    window.saveData();
    renderDisciplineRecords();
};

window.switchFundTab = function(tab, btn) {
    document.querySelectorAll('#view-fees .tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-fund-campaigns').style.display = tab === 'campaigns' ? 'block' : 'none';
    document.getElementById('tab-fund-logs').style.display = tab === 'logs' ? 'block' : 'none';
    if(tab === 'campaigns') renderFundCampaigns(); else renderFundLogs();
};

function renderFundSummary() {
    let tin = 0, tout = 0;
    appData.fundLogs.forEach(l => { if(l.type === 'in') tin += l.amount; else tout += l.amount; });
    document.getElementById('fund-total-balance').innerText = (tin - tout).toLocaleString('vi-VN') + ' VNĐ';
    document.getElementById('fund-total-in').innerText = tin.toLocaleString('vi-VN') + 'đ';
    document.getElementById('fund-total-out').innerText = tout.toLocaleString('vi-VN') + 'đ';
    renderFundCampaigns();
}

function renderFundCampaigns() {
    const container = document.getElementById('fund-campaigns-container');
    container.innerHTML = '';
    if(appData.fundCampaigns.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có đợt thu nào. Bấm tạo đợt thu mới!</div>';
        return;
    }
    appData.fundCampaigns.slice().reverse().forEach(c => {
        let paidCount = Object.values(c.paid || {}).filter(v => v).length;
        let card = document.createElement('div');
        card.className = 'campaign-card';
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                <div>
                    <h4>${c.title}</h4>
                    <p class="text-blue">Mức thu: ${c.amount.toLocaleString('vi-VN')}đ / HS</p>
                </div>
                <span class="badge ${paidCount === appData.students.length ? 'badge-green' : 'badge-yellow'}">${paidCount}/${appData.students.length} đã nộp</span>
            </div>
            <div class="action-row mt-10">
                <button class="btn-outline text-blue" onclick="openCampaignDetails(${c.id})"><i class="fas fa-list-check"></i> Xem danh sách thu</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderFundLogs() {
    const container = document.getElementById('fund-logs-container');
    container.innerHTML = '';
    if(appData.fundLogs.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có nhật ký thu chi.</div>';
        return;
    }
    appData.fundLogs.slice().reverse().forEach(l => {
        let item = document.createElement('div');
        item.className = 'fund-log-item';
        item.innerHTML = `
            <div><strong>${l.desc}</strong><br><small class="text-muted">${l.date}</small></div>
            <div class="${l.type === 'in' ? 'text-green' : 'text-red'}"><strong>${l.type === 'in' ? '+' : '-'}${l.amount.toLocaleString('vi-VN')}đ</strong></div>
        `;
        container.appendChild(item);
    });
}

window.saveFundLog = function() {
    let type = document.getElementById('fund-log-type').value;
    let amount = parseInt(document.getElementById('fund-log-amount').value);
    let desc = document.getElementById('fund-log-desc').value.trim();
    let date = document.getElementById('fund-log-date').value || getTodayStr();

    if(isNaN(amount) || amount <= 0 || !desc) return window.showToast('Vui lòng nhập đủ thông tin!', 'error');

    appData.fundLogs.push({ id: Date.now(), type: type, amount: amount, desc: desc, date: date });
    window.saveData();
    window.closeModal('modal-add-fund');
    renderFundSummary();
    renderFundLogs();
    window.showToast('Đã lưu giao dịch thu chi!');
};

window.createFundCampaign = function() {
    let title = document.getElementById('camp-title').value.trim();
    let amount = parseInt(document.getElementById('camp-amount').value);
    let deadline = document.getElementById('camp-deadline').value;

    if(!title || isNaN(amount)) return window.showToast('Nhập đủ tên và số tiền!', 'error');

    appData.fundCampaigns.push({ id: Date.now(), title: title, amount: amount, deadline: deadline, paid: {} });
    window.saveData();
    window.closeModal('modal-create-campaign');
    renderFundCampaigns();
    window.showToast('Đã tạo đợt thu mới thành công!');
};

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
    document.getElementById('setup-week1-date').value = stp.week1Start || '';
    document.getElementById('setup-tkb-count').innerText = (stp.tkb || []).length + " bản ghi";
    document.getElementById('setup-ppct-count').innerText = (stp.ppct || []).length + " bài dạy";
    document.getElementById('setup-holidays-count').innerText = (stp.holidays || []).length + " sự kiện";
    document.getElementById('setup-math-ratio-count').innerText = stp.mathRatios.length + " cấu hình";

    const tbodyTKB = document.getElementById('tkb-tbody'); 
    if(tbodyTKB) {
        tbodyTKB.innerHTML = '';
        (stp.tkb || []).forEach((t, i) => { tbodyTKB.innerHTML += `<tr><td>${t.dayOfWeek}</td><td>${t.period}</td><td>${t.className}</td><td>${t.subject}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('tkb', ${i})"><i class="fas fa-times"></i></button></td></tr>`; });
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
        (stp.holidays || []).forEach((h, i) => { tbodyHol.innerHTML += `<tr><td>${h.start}</td><td>${h.end}</td><td>${h.name}</td><td><button class="btn-outline-action text-red" style="width:25px;height:25px;" onclick="delSetupData('holidays', ${i})"><i class="fas fa-times"></i></button></td></tr>`; });
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

window.addMathRatio = function() {
    let grade = document.getElementById('add-math-grade').value.trim();
    let fw = parseInt(document.getElementById('add-math-from-week').value);
    let tw = parseInt(document.getElementById('add-math-to-week').value);
    let dai = parseInt(document.getElementById('add-math-dai').value);
    let hinh = parseInt(document.getElementById('add-math-hinh').value);
    
    if(!grade || isNaN(fw) || isNaN(tw) || isNaN(dai) || isNaN(hinh)) return window.showToast("Điền đủ thông tin!", "error");
    grade = extractGrade(grade);
    appData.scheduleSetup.mathRatios.push({ grade: grade, fromWeek: fw, toWeek: tw, dai: dai, hinh: hinh });
    window.saveData(); window.renderSetupData(); window.showToast(`Đã thêm tỉ lệ Khối ${grade}!`);
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
        const reader = new FileReader();
        reader.onload = (ev) => {
            mammoth.convertToHtml({arrayBuffer: ev.target.result}).then(function(result) {
                let doc = new DOMParser().parseFromString(result.value, 'text/html'); let tables = doc.querySelectorAll('table'); let count = 0;
                tables.forEach(table => {
                    let rows = table.querySelectorAll('tr'); let tietIdx = -1, ndIdx = -1;
                    rows.forEach(tr => {
                        let cells = Array.from(tr.querySelectorAll('th, td')).map(c => c.innerText.trim());
                        if (tietIdx === -1) {
                            cells.forEach((txt, i) => { if(txt.toLowerCase().includes('tiết')) tietIdx = i; else if(txt.toLowerCase().includes('bài') || txt.toLowerCase().includes('nội dung')) ndIdx = i; });
                        } else if (cells.length > Math.max(tietIdx, ndIdx)) {
                            let tiet = parseInt(cells[tietIdx]); let nd = cells[ndIdx];
                            if(!isNaN(tiet) && nd) { appData.scheduleSetup.ppct.push({ className: "9A", subject: "Toán", ppct: tiet, content: nd }); count++; }
                        }
                    });
                });
                window.saveData(); window.renderSetupData(); window.showToast(`Đã import ${count} bài dạy từ Word!`);
            });
        };
        reader.readAsArrayBuffer(file);
    } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const data = new Uint8Array(ev.target.result); const workbook = XLSX.read(data, { type: 'array' }); let rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]); let count = 0;
                rows.forEach(r => {
                    if(currentImportType === 'tkb' && r['Thứ'] && r['Tiết'] && r['Lớp']) {
                        appData.scheduleSetup.tkb.push({ dayOfWeek: parseInt(r['Thứ']), period: parseInt(r['Tiết']), className: String(r['Lớp']), subject: String(r['Môn']) }); count++;
                    } else if(currentImportType === 'ppct' && r['Tiết']) {
                        let p = parseInt(r['Tiết']); let n = String(r['Nội dung'] || r['Tên bài'] || '');
                        if(!isNaN(p) && n) { appData.scheduleSetup.ppct.push({ className: String(r['Lớp'] || "9"), subject: String(r['Môn'] || "Toán"), branch: String(r['Phân môn'] || ''), ppct: p, content: n }); count++; }
                    } else if(currentImportType === 'holidays' && r['Từ ngày'] && r['Đến ngày']) {
                        appData.scheduleSetup.holidays.push({ start: r['Từ ngày'], end: r['Đến ngày'], name: r['Sự kiện'] || "Nghỉ lễ" }); count++;
                    }
                });
                window.saveData(); window.renderSetupData(); window.showToast(`Đã import ${count} dòng!`);
            } catch(e) { window.showToast("Lỗi định dạng file Excel!", "error"); }
        };
        reader.readAsArrayBuffer(file);
    }
    event.target.value = "";
};

window.checkIsHoliday = function(dateStr) {
    let d = new Date(dateStr);
    for(let h of (appData.scheduleSetup.holidays || [])) { if(d >= new Date(h.start) && d <= new Date(h.end)) return h; } return null;
};

window.generateAutoSchedule = function() {
    let startDate = document.getElementById('setup-week1-date').value;
    if(!startDate) return window.showToast("Chọn ngày bắt đầu Tuần 1!", "error");
    appData.scheduleSetup.week1Start = startDate;
    let records = [];

    let ppctMaster = {};
    (appData.scheduleSetup.ppct || []).slice().sort((a,b) => a.ppct - b.ppct).forEach(p => {
        let grade = extractGrade(p.className); let subj = p.subject.trim().toLowerCase(); let branch = (p.branch || '').trim();
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
            let sLower = sName.toLowerCase(); let cLower = cName.toLowerCase();
            if(sLower.includes('toán')) {
                classQueues[`${sLower}-${cLower}-Đại`] = ppctMaster[`${sLower}-${grade}-Đại`] ? JSON.parse(JSON.stringify(ppctMaster[`${sLower}-${grade}-Đại`])) : [];
                classQueues[`${sLower}-${cLower}-Hình`] = ppctMaster[`${sLower}-${grade}-Hình`] ? JSON.parse(JSON.stringify(ppctMaster[`${sLower}-${grade}-Hình`])) : [];
            } else {
                classQueues[`${sLower}-${cLower}`] = ppctMaster[`${sLower}-${grade}`] ? JSON.parse(JSON.stringify(ppctMaster[`${sLower}-${grade}`])) : [];
            }
        });
    });

    let currentDate = new Date(startDate);
    for(let w = 1; w <= 35; w++) {
        let mathCountInWeek = {};
        for(let d = 2; d <= 7; d++) {
            let dateStr = currentDate.toISOString().split('T')[0];
            let holiday = window.checkIsHoliday(dateStr);
            let dayTKB = (appData.scheduleSetup.tkb || []).filter(t => t.dayOfWeek == d).sort((a,b) => a.period - b.period);

            dayTKB.forEach(tItem => {
                let sLower = tItem.subject.trim().toLowerCase(); let cLower = tItem.className.trim().toLowerCase();
                let grade = extractGrade(tItem.className); let isMath = sLower.includes('toán');
                let targetBranch = '';
                if(isMath) {
                    if (mathCountInWeek[cLower] === undefined) mathCountInWeek[cLower] = 0;
                    targetBranch = (mathCountInWeek[cLower] < 3) ? 'Đại' : 'Hình';
                }
                let qKey = (isMath && targetBranch) ? `${sLower}-${cLower}-${targetBranch}` : `${sLower}-${cLower}`;

                if(holiday) {
                    records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: "-", content: "NGHỈ LỄ - " + holiday.name, status: "off" });
                } else if(classQueues[qKey] && classQueues[qKey].length > 0) {
                    let lesson = classQueues[qKey].shift();
                    records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: lesson.ppct, content: lesson.content, status: "scheduled" });
                    if(isMath) mathCountInWeek[cLower]++;
                } else {
                    records.push({ id: Date.now() + Math.random(), week: w, date: dateStr, dayOfWeek: d, period: tItem.period, className: tItem.className, subject: tItem.subject, ppct: "-", content: "Ôn tập / Tự chọn", status: "scheduled" });
                }
            });
            currentDate.setDate(currentDate.getDate() + 1);
        }
        currentDate.setDate(currentDate.getDate() + 1);
    }
    appData.scheduleRecords = records;
    window.saveData();
    window.closeModal('modal-setup-lesson-log');
    initLessonLogView();
    window.showToast("🎉 Đã tạo Sổ Báo Giảng tự động thành công!");
};

function initLessonLogView() {
    const sel = document.getElementById('ll-week-select'); if(!sel) return;
    sel.innerHTML = '';
    let maxWeek = 1;
    (appData.scheduleRecords || []).forEach(r => { if(r.week > maxWeek) maxWeek = r.week; });
    for(let i = 1; i <= maxWeek; i++) sel.innerHTML += `<option value="${i}">Sổ báo giảng - Tuần ${i}</option>`;
    let today = getTodayStr();
    let todayRecord = (appData.scheduleRecords || []).find(r => r.date === today);
    if(todayRecord) sel.value = todayRecord.week;
    renderSchedule();
}

window.renderSchedule = function() {
    const sel = document.getElementById('ll-week-select'); if (!sel) return;
    const w = parseInt(sel.value) || 1;
    const list = document.getElementById('ll-schedule-list'); list.innerHTML = '';
    let records = (appData.scheduleRecords || []).filter(r => r.week == w);
    
    let total = records.filter(r => r.status !== 'off').length;
    let completed = records.filter(r => r.status === 'completed').length;
    let offCount = records.filter(r => r.status === 'off').length;
    document.getElementById('ll-stats-container').innerHTML = `
        <span class="text-blue">Tổng: ${total} tiết</span>
        <span class="text-green">Đã xong: ${completed}</span>
        <span class="text-orange">Còn: ${total - completed}</span>
        ${offCount > 0 ? `<span class="text-red">Nghỉ: ${offCount}</span>` : ''}
    `;

    if(records.length === 0) { list.innerHTML = '<div style="text-align:center; padding:30px; color:var(--text-muted);">Chưa có dữ liệu tuần này. Bấm Cấu hình và Tự động tạo sổ!</div>'; return; }

    let byDate = {};
    records.forEach(r => { if(!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });
    let daysOfWeek = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

    Object.keys(byDate).sort().forEach(dateStr => {
        let dObj = new Date(dateStr); let dayName = daysOfWeek[dObj.getDay()];
        list.innerHTML += `<div style="background:var(--primary); color:white; padding:8px 15px; border-radius:10px; font-weight:700; font-size:0.9rem; margin-top:10px;">📅 ${dayName} - ${dObj.toLocaleDateString('vi-VN')}</div>`;

        byDate[dateStr].sort((a,b) => a.period - b.period).forEach(r => {
            let isOff = r.status === 'off'; let isCompleted = r.status === 'completed';
            let cardClass = isOff ? 'status-off' : (isCompleted ? 'status-completed' : 'status-scheduled');
            let statusBtn = isOff ? '' : `<button class="btn-outline-action ${isCompleted ? 'text-green' : 'text-muted'}" onclick="toggleScheduleStatus(${r.id})"><i class="${isCompleted ? 'fas fa-check-circle' : 'far fa-circle'}"></i></button>`;
            let editBtn = isOff ? '' : `<button class="btn-outline-action text-orange" onclick="openAdjustSchedule(${r.id})"><i class="fas fa-exchange-alt"></i></button>`;

            list.innerHTML += `
                <div class="sched-card ${cardClass}">
                    <div class="sched-top"><span>Tiết ${r.period} | ${r.className}</span> <span style="background:#f1f5f9; padding:2px 8px; border-radius:8px;">PPCT: ${r.ppct}</span></div>
                    <div class="sched-mid"><h4>${r.subject}</h4><p>${r.content}</p></div>
                    ${r.note ? `<div class="sched-note">${r.note}</div>` : ''}
                    <div class="sched-bot">${statusBtn}<div style="display:flex; gap:8px;">${editBtn}</div></div>
                </div>`;
        });
    });
};

window.toggleScheduleStatus = function(id) {
    let r = (appData.scheduleRecords || []).find(x => x.id == id);
    if(r) { r.status = (r.status === 'completed') ? 'scheduled' : 'completed'; window.saveData(); renderSchedule(); }
};

window.openAdjustSchedule = function(id) {
    let r = (appData.scheduleRecords || []).find(x => x.id == id); if(!r) return;
    document.getElementById('adj-sched-id').value = r.id; 
    document.getElementById('adj-sched-info').innerHTML = `Đổi lịch: <b>${r.subject} ${r.className} (Tiết ${r.period})</b>`; 
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
        r.note = document.getElementById('adj-sched-note').value || 'Dạy bù';
        r.date = nDate;
        r.period = parseInt(nPeriod);
        window.saveData(); window.closeModal('modal-adjust-schedule'); renderSchedule(); window.showToast("Đã cập nhật lịch!");
    }
};

window.exportScheduleExcel = function() {
    const sel = document.getElementById('ll-week-select'); if(!sel) return;
    const w = parseInt(sel.value) || 1;
    let records = (appData.scheduleRecords || []).filter(r => r.week == w);
    if(records.length === 0) return window.showToast("Tuần này trống!", "error");
    let ws_data = [["Tuần", "Ngày", "Thứ", "Tiết", "Lớp", "Môn", "PPCT", "Nội dung", "Trạng thái", "Ghi chú"]];
    records.sort((a,b) => new Date(a.date) - new Date(b.date)).forEach(r => {
        ws_data.push([r.week, r.date, r.dayOfWeek, r.period, r.className, r.subject, r.ppct, r.content, r.status, r.note||""]);
    });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ws_data), "SoBaoGiang");
    XLSX.writeFile(wb, `So_Bao_Giang_Tuan_${w}.xlsx`);
};

window.downloadTemplateTKB = function() {
    const data = [
        ["Thứ", "Tiết", "Lớp", "Môn"],
        [2, 1, "9A", "Toán"],
        [2, 2, "9A", "Toán"],
        ["(Chú ý: Xóa 2 dòng mẫu này đi và nhập dữ liệu của bạn vào)", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch: 10}, {wch: 10}, {wch: 15}, {wch: 20}];
    XLSX.utils.book_append_sheet(wb, ws, "TKB_Mau");
    XLSX.writeFile(wb, "Mau_Thoi_Khoa_Bieu_GVCN.xlsx");
    window.showToast("Đã tải xuống File Mẫu TKB!", "success");
};

window.downloadTemplatePPCT = function() {
    const data = [
        ["Khối", "Môn", "Phân môn", "Tiết", "Tên bài học / Chuyên đề", "Số tiết", "Thiết bị dạy học", "Địa điểm"],
        ["9", "Toán", "Đại", 1, "Bài 1: Căn bậc hai", 1, "Máy chiếu", "Lớp học"],
        ["9", "Toán", "Đại", 2, "Bài 2: Căn thức bậc hai", 1, "Bảng phụ", "Lớp học"],
        ["9", "Toán", "Hình", 1, "Bài 1: Một số hệ thức về cạnh và đường cao", 1, "Thước kẻ, compa", "Lớp học"],
        ["(Chú ý: Cột Phân môn dành cho môn Toán điền Đại hoặc Hình)", "", "", "", "", "", "", ""]
    ];
    var wb = XLSX.utils.book_new(); 
    var ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{wch: 10}, {wch: 12}, {wch: 12}, {wch: 10}, {wch: 40}, {wch: 10}, {wch: 25}, {wch: 15}];
    XLSX.utils.book_append_sheet(wb, ws, "PPCT_Mau");
    XLSX.writeFile(wb, "Mau_Phan_Phoi_CT_GVCN.xlsx");
    window.showToast("Đã tải xuống File Mẫu PPCT!", "success");
};

window.initAppUI = function() {
    renderDashboard();
    populateStudentSelects();
    renderSetupData();
};

function populateStudentSelects() {
    const select = document.getElementById('disc-student-select');
    if(select) {
        select.innerHTML = '<option value="">-- Chọn học sinh --</option>';
        appData.students.forEach(st => { select.innerHTML += `<option value="${st.id}">${st.name} (Tổ ${st.team})</option>`; });
    }
}

function loadSettingsToUI() {
    const s = appData.settings;
    document.getElementById('set-class-name').value = s.className;
    document.getElementById('set-teacher-name').value = s.teacherName;
    document.getElementById('set-school-year').value = s.schoolYear;
}

window.saveSettingsInfo = function() {
    appData.settings.className = document.getElementById('set-class-name').value.trim() || '9A';
    appData.settings.teacherName = document.getElementById('set-teacher-name').value.trim() || 'Thầy/Cô';
    appData.settings.schoolYear = document.getElementById('set-school-year').value.trim() || '2025-2026';
    window.saveData();
    window.showToast('Đã lưu thông tin cài đặt!');
};

window.resetClassData = function() {
    if(confirm("CẢNH BÁO: Thao tác này sẽ XÓA SẠCH toàn bộ học sinh, điểm danh, quỹ lớp để làm lại từ đầu!")) {
        localStorage.removeItem('gvcnData_v4');
        location.reload();
    }
};

window.exportAllDataBackup = function() {
    let dataStr = JSON.stringify(appData);
    let blob = new Blob([dataStr], {type: "application/json"});
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Backup_GVCN_${appData.settings.className}_${getTodayStr()}.json`;
    a.click();
};

window.triggerExcelImport = function() { document.getElementById('excel-import-file').click(); };
window.handleExcelImport = function(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            let count = 0;
            rows.forEach((r, idx) => {
                let name = r['Họ và tên'] || r['Họ tên'] || r['Tên'] || r['Name'];
                if(name) {
                    appData.students.push({
                        id: Date.now() + idx,
                        name: String(name).trim(),
                        gender: r['Giới tính'] || 'Nam',
                        team: parseInt(r['Tổ']) || (idx % 4 + 1),
                        dob: r['Ngày sinh'] || '',
                        parentPhone: r['SĐT'] || r['Số điện thoại'] || '',
                        note: '',
                        seatIndex: -1
                    });
                    count++;
                }
            });
            window.saveData();
            renderStudentsList();
            populateStudentSelects();
            window.showToast(`Đã nạp thành công ${count} học sinh!`);
        } catch(err) { window.showToast("Lỗi đọc file Excel!", "error"); }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
};

window.exportStudentsExcel = function() {
    if(appData.students.length === 0) return window.showToast("Chưa có học sinh để xuất!", "error");
    let ws_data = [["STT", "Họ và tên", "Giới tính", "Tổ", "Ngày sinh", "SĐT Phụ huynh", "Ghi chú"]];
    appData.students.forEach((st, i) => {
        ws_data.push([i+1, st.name, st.gender, st.team, st.dob, st.parentPhone, st.note]);
    });
    var wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws_data, "HocSinh");
    XLSX.writeFile(wb, `Danh_Sach_Lop_${appData.settings.className}.xlsx`);
};

window.onload = () => {
    window.initAppUI();
};