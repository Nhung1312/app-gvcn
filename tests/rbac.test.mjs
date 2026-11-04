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
