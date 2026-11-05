import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const script = readFileSync(new URL('../script.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');

function between(start, end) {
  const a = script.indexOf(start);
  const b = script.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, 'Không tìm thấy hàm cần kiểm thử: ' + start);
  return script.slice(a, b);
}

const roleCode = between('window.hasPermission = function(action, target = null) {', 'window.resolveUserRole = function(');
function permissions(role, options = {}) {
  const students = [{ id: 1, fixedGroup: 1 }, { id: 2, fixedGroup: 2 }];
  const fakeWindow = { authRole: { role, fixedGroup: 1, isTestRole: !!options.testMode } };
  const make = new Function('window', 'appData', 'currentUser', 'delegatedOfficer', roleCode + '\nreturn window.hasPermission;');
  return { can: make(fakeWindow, { students }, options.delegated ? { uid: 'student' } : null, !!options.delegated), students };
}

test('Chỉ GVCN quản trị hệ thống và phân quyền', () => {
  assert.equal(permissions('teacher').can('manage_permissions'), true);
  for (const role of ['class_leader', 'class_vice', 'group_leader', 'none']) {
    assert.equal(permissions(role).can('manage_permissions'), false);
    assert.equal(permissions(role).can('delete_student'), false);
    assert.equal(permissions(role).can('edit_tkb'), false);
  }
});

test('Lớp trưởng được điểm danh và ghi nề nếp cả lớp', () => {
  const { can, students } = permissions('class_leader', { delegated: true });
  for (const student of students) {
    assert.equal(can('attendance:mark', student), true);
    assert.equal(can('behavior:record', student), true);
  }
});

test('Lớp phó được điểm danh và ghi nề nếp cả lớp', () => {
  const { can, students } = permissions('class_vice', { delegated: true });
  for (const student of students) {
    assert.equal(can('attendance:mark', student), true);
    assert.equal(can('behavior:record', student), true);
  }
});

test('Tổ trưởng không thao tác học sinh tổ khác', () => {
  const { can, students } = permissions('group_leader', { delegated: true });
  assert.equal(can('attendance:mark', students[0]), true);
  assert.equal(can('attendance:mark', students[1]), false);
  assert.equal(can('behavior:record', students[0]), true);
  assert.equal(can('behavior:record', students[1]), false);
});

test('Tổ trưởng không ghi được học sinh không tồn tại', () => {
  const { can } = permissions('group_leader', { delegated: true });
  assert.equal(can('attendance:mark', 123456789), false);
  assert.equal(can('behavior:record', null), false);
});

test('Học sinh chưa cấp quyền không được ghi', () => {
  const { can, students } = permissions('none');
  assert.equal(can('attendance:mark', students[0]), false);
  assert.equal(can('attendance:save'), false);
  assert.equal(can('behavior:record', students[1]), false);
});

test('Chế độ thử vẫn kiểm tra giới hạn theo tổ', () => {
  const { can, students } = permissions('group_leader', { testMode: true });
  assert.equal(can('attendance:mark', students[0]), true);
  assert.equal(can('attendance:mark', students[1]), false);
  assert.match(script, /permissionTestSnapshot/);
  assert.match(script, /isTestRole\) return Promise\.resolve\(true\)/);
});

test('ID màn hình cấp quyền khớp mã JavaScript', () => {
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
  const referenced = [...script.matchAll(/getElementById\(['"](perm-[^'"]+)['"]\)/g)].map(match => match[1]);
  for (const id of referenced) assert.ok(ids.has(id), 'Thiếu ID ' + id);
  assert.ok(ids.has('perm-student-email'));
  assert.ok(ids.has('perm-student-role'));
  assert.ok(ids.has('assigned-accounts-list'));
});

test('Danh sách cán bộ lớp không chứa dữ liệu riêng tư', () => {
  const src = between('function emptyOfficerView() {', 'function officerRosterPayload() {');
  const safeView = new Function('defaultSettings', src + '\nreturn safeOfficerView;')({
    teacherName: 'GV', className: '7A1', apiKey: 'SECRET_KEY'
  });
  const result = safeView({
    teacherName: 'GV', className: '7A1',
    students: [{ id: 1, name: 'Học sinh thử', fixedGroup: 1, dob: '2011-01-01', phone: '123', accountEmail: 'student@example.com' }],
    fixedGroups: [{ id: 1, name: 'Tổ 1' }], behaviorTags: []
  }, 'teacherUid');
  assert.deepEqual(result.students, [{ id: 1, name: 'Học sinh thử', fixedGroup: 1 }]);
  assert.equal(result.settings.apiKey, '');
  assert.equal(result.teacherUid, 'teacherUid');
});

test('Rules chỉ chủ lớp đọc và ghi dữ liệu lớp đầy đủ', () => {
  assert.match(rules, /match \/DuLieuGVCN\/\{userId\} \{\s*allow get, create, update, delete: if request\.auth != null\s*&& request\.auth\.uid == userId;\s*allow list: if false;/);
  assert.match(rules, /match \/CanBoLop\/\{email\}/);
  assert.match(rules, /email_verified == true/);
  assert.match(rules, /match \/GVCNOfficer\/\{teacherUid\}/);
  assert.match(rules, /memberGroups\.get/);
  assert.match(rules, /match \/activity\/\{actionId\}/);
});

test('Rules các ứng dụng khác được giữ nguyên về đường dẫn', () => {
  for (const path of ['DuLieuDayThem', 'nguoi_dung', 'ban_quyen_thuong', 'DuLieuGVBM', 'khach_hang_gvbm']) {
    assert.ok(rules.includes('match /' + path + '/{userId}'), 'Không có ' + path);
  }
  assert.match(rules, /request\.time < timestamp\.date\(2026, 11, 17\)/);
});

test('Tài khoản cán bộ lớp không gửi nguyên tài liệu DuLieuGVCN', () => {
  assert.match(script, /function sendOfficerAction\(action\)/);
  assert.match(script, /collection\(firestoreDb, 'GVCNOfficer', appData\.teacherUid, 'activity'\)/);
  assert.match(script, /if \(currentUser && \(!cloudRoleVerified \|\| delegatedOfficer \|\| !window\.isTeacher\(\)/);
  assert.match(script, /safeOfficerView\(safeSnap\.data\(\), targetTeacherUid\)/);
});

test('GVCN nhận báo cáo khi mở điểm danh hoặc nề nếp', () => {
  assert.match(script, /viewId === 'view-attendance' \|\| viewId === 'view-discipline'/);
  assert.match(script, /void importOfficerActions\(\)/);
});

function makePermissionFormHarness(overrides = {}) {
  const js = between('async function commitPermissionChanges(', 'window.renderAssignedAccountsList = function() {');
  const appData = {
    students: [{ id: 11, name: 'Học sinh kiểm thử', fixedGroup: 1, accountEmail: 'old@gmail.com', accountRole: 'class_vice' }],
    lastUpdated: 7, teacherUid: 'teacherUid', teacherEmail: 'teacher@gmail.com'
  };
  const writes = [];
  const toasts = [];
  const inputs = {
    'perm-student-select': { value: '11' },
    'perm-student-email': { value: overrides.email ?? 'new@gmail.com', focus(){} },
    'perm-student-role': { value: overrides.role ?? 'group_leader' }
  };
  const button = { disabled: false };
  const document = {
    getElementById(id) { return inputs[id] || null; },
    querySelector() { return button; }
  };
  const window = {
    authRole: { isTestRole: !!overrides.testMode },
    isTeacher: () => overrides.isTeacher !== false,
    showToast(msg) { toasts.push(msg); },
    renderStudents(){}, renderAssignedAccountsList(){},
    onPermRoleChanged(){}, onSelectPermStudent(){}, updateDashboardInfo(){}
  };
  const batch = {
    set(ref, payload) { writes.push(['set', ref.path, structuredClone(payload)]); },
    delete(ref) { writes.push(['delete', ref.path]); },
    async commit() {
      if (overrides.failCommit) throw new Error('permission denied');
      writes.push(['commit']);
    }
  };
  const localStorage = { setItem() {} };
  const factory = new Function(
    'window', 'document', 'appData', 'currentUser', 'cloudRoleVerified',
    'firestoreDb', 'doc', 'writeBatch', 'officerRosterPayload',
    'localStorage', 'confirm', 'console', js +
    '\nreturn { grant: window.saveStudentPermission, revoke: window.revokeStudentPermissionById };'
  );
  const funcs = factory(
    window, document, appData,
    overrides.loggedOut ? null : { uid: 'teacherUid' },
    true, {},
    (_db, col, id) => ({ path: col + '/' + id }),
    () => batch, () => ({ students: [] }), localStorage, () => true, { error(){} }
  );
  return { ...funcs, appData, writes, toasts, button };
}

test('Cấp quyền cập nhật hồ sơ lớp và chỉ mục bằng một batch', async () => {
  const h = makePermissionFormHarness();
  await h.grant();
  assert.equal(h.appData.students[0].accountRole, 'group_leader');
  assert.equal(h.appData.students[0].accountEmail, 'new@gmail.com');
  assert.deepEqual(h.writes.map(w => w[0]), ['set', 'set', 'set', 'delete', 'commit']);
  assert.ok(h.writes.some(w => w[1] === 'CanBoLop/new@gmail.com'));
  assert.ok(h.writes.some(w => w[1] === 'CanBoLop/old@gmail.com'));
  assert.equal(h.button.disabled, false);
});

test('Email sai định dạng không tạo bất kỳ lượt ghi Firebase nào', async () => {
  const h = makePermissionFormHarness({ email: 'khong-phai-email' });
  await h.grant();
  assert.equal(h.writes.length, 0);
  assert.equal(h.appData.students[0].accountRole, 'class_vice');
});

test('Không cấp quyền tổ trưởng cho học sinh chưa được xếp tổ', async () => {
  const h = makePermissionFormHarness();
  h.appData.students[0].fixedGroup = 0;
  await h.grant();
  assert.equal(h.writes.length, 0);
  assert.equal(h.appData.students[0].accountRole, 'class_vice');
});

test('Firebase từ chối thì trả về quyền cũ và không báo cấp thành công', async () => {
  const h = makePermissionFormHarness({ failCommit: true });
  await h.grant();
  assert.equal(h.appData.students[0].accountEmail, 'old@gmail.com');
  assert.equal(h.appData.students[0].accountRole, 'class_vice');
  assert.equal(h.appData.lastUpdated, 7);
  assert.equal(h.button.disabled, false);
  assert.ok(h.toasts.some(x => x.includes('thất bại') || x.includes('từ chối')));
});

test('Thu hồi quyền xóa chỉ mục và cập nhật hồ sơ trong một batch', async () => {
  const h = makePermissionFormHarness();
  await h.revoke(11);
  assert.equal(h.appData.students[0].accountRole, 'none');
  assert.equal(h.appData.students[0].accountEmail, '');
  assert.ok(h.writes.some(w => w[0] === 'delete' && w[1] === 'CanBoLop/old@gmail.com'));
  assert.equal(h.writes[h.writes.length-1][0], 'commit');
});

test('Tài khoản chưa đăng nhập hoặc chế độ thử không được cấp quyền thật', async () => {
  for (const settings of [{ loggedOut: true }, { testMode: true }, { isTeacher: false }]) {
    const h = makePermissionFormHarness(settings);
    await h.grant();
    assert.equal(h.writes.length, 0);
  }
});

test('Bộ đếm tài khoản cập nhật sau cấp và thu hồi quyền', () => {
  const listMarkup = between('window.renderAssignedAccountsList = function() {', 'window.applyNotifyTemplate = function() {');
  const list = { innerHTML: '' };
  const badge = { textContent: '0 tài khoản' };
  const document = { getElementById(id) {
    if (id === 'assigned-accounts-list') return list;
    if (id === 'perm-count-badge') return badge;
    return null;
  }};
  const appData = { students: [] };
  const window = {};
  new Function('window', 'document', 'appData', listMarkup)(window, document, appData);
  window.renderAssignedAccountsList();
  assert.equal(badge.textContent, '0 tài khoản');
  appData.students.push({ id: 1, name: 'Học sinh giả', accountRole: 'class_leader', accountEmail: 'test@example.com', fixedGroup: 1 });
  window.renderAssignedAccountsList();
  assert.equal(badge.textContent, '1 tài khoản');
  assert.match(list.innerHTML, /Lớp trưởng/);
  appData.students[0].accountRole = 'none';
  window.renderAssignedAccountsList();
  assert.equal(badge.textContent, '0 tài khoản');
});


function makeRoleLookup(docResult, options = {}) {
  const js = between('// Tra quyền cán bộ lớp từ máy chủ, không lấy từ bộ nhớ đệm.', 'onAuthStateChanged(auth, async (user) => {');
  const reads = [];
  const doc = (_db, collection, email) => ({ collection, email });
  const getDocFromServer = async ref => {
    reads.push(ref);
    if (options.networkError) throw new Error('offline');
    return {
      exists: () => docResult !== null,
      data: () => docResult
    };
  };
  const lookup = new Function('doc', 'firestoreDb', 'getDocFromServer', js +
    '\nreturn readVerifiedGvcnRole;')(doc, {}, getDocFromServer);
  return { lookup, reads };
}

test('Gmail từng làm giáo viên nhưng được cấp Lớp trưởng phải ưu tiên ủy quyền', async () => {
  const h = makeRoleLookup({
    teacherUid: 'teacher-main-uid', role: 'class_leader',
    studentId: 12, studentName: 'Học sinh kiểm thử', fixedGroup: 1
  });
  const result = await h.lookup({ uid: 'old-teacher-account-uid', email: 'CLASSLEADER@gmail.com' });
  assert.equal(result.delegated, true);
  assert.equal(result.teacherUid, 'teacher-main-uid');
  assert.equal(result.officerIndex.role, 'class_leader');
  assert.equal(h.reads[0].email, 'classleader@gmail.com');
});

test('Không tìm thấy chỉ mục mới được mở lớp chính chủ cũ', async () => {
  const h = makeRoleLookup(null);
  const result = await h.lookup({ uid: 'old-teacher-account-uid', email: 'old@gmail.com' });
  assert.deepEqual(result, { teacherUid: 'old-teacher-account-uid', delegated: false, officerIndex: null });
});

test('Không thể mở quyền giáo viên khi Firebase lỗi tra cứu cán bộ lớp', async () => {
  const h = makeRoleLookup(null, { networkError: true });
  await assert.rejects(() => h.lookup({ uid: 'old-teacher-account-uid', email: 'old@gmail.com' }), /offline/);
  assert.match(script, /const verifiedAccount = await readVerifiedGvcnRole\(user\)/);
  assert.doesNotMatch(
    between('// Ưu tiên phân quyền lớp được giáo viên ủy quyền', 'if (delegatedOfficer) {'),
    /catch\s*\(e\)\s*\{\s*\}/
  );
});

test('Không chấp nhận chỉ mục vai trò sai hoặc tự cấp lớp trưởng cho chủ lớp', async () => {
  const h = makeRoleLookup({ teacherUid: 'teacher-main-uid', role: 'teacher' });
  await assert.rejects(() => h.lookup({ uid: 'old-account', email: 'old@gmail.com' }), /không hợp lệ/);
  const self = makeRoleLookup({ teacherUid: 'self-uid', role: 'class_leader' });
  await assert.rejects(() => self.lookup({ uid: 'self-uid', email: 'self@gmail.com' }), /Không thể tự cấp/);
});

test('Lần đăng nhập mới không kế thừa vai trò test và ưu tiên server', () => {
  const auth = between('onAuthStateChanged(auth, async (user) => {', 'window.logoutApp = function() {');
  assert.match(auth, /permissionTestSnapshot = null/);
  assert.match(auth, /role: 'none'/);
  assert.match(auth, /getDocFromServer\(safeRef\)/);
  assert.match(auth, /if \(cloudRoleVerified && delegatedOfficer/);
});

test('Chế độ thử không thể biến tài khoản lớp trưởng thành giáo viên', () => {
  const src = between('window.switchTestRole = function(testRole, targetGroup = 1) {', 'const loginScreen = document.getElementById(');
  assert.match(src, /if \(currentUser && \(!cloudRoleVerified \|\| delegatedOfficer \|\| appData\.teacherUid !== currentUser\.uid\)\)/);
});
