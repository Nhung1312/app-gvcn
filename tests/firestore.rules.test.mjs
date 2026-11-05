import { before, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, addDoc, deleteDoc, updateDoc, collection, serverTimestamp } from 'firebase/firestore';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const projectId = 'demo-gvcn-rbac-tests';
let env;
const teacherUid = 'gvcn-teacher-uid';
const validDate = '2026-11-05';

function ctx(uid, email) {
  return env.authenticatedContext(uid, {
    email,
    email_verified: true
  }).firestore();
}
function action(studentId, overrides = {}) {
  return {
    type: 'attendance', studentId: String(studentId), date: validDate,
    status: 'present', actorUid: 'officer-uid',
    createdAt: serverTimestamp(),
    ...overrides
  };
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: { rules, host: '127.0.0.1', port: 8080 }
  });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const admin = context.firestore();
    await setDoc(doc(admin, 'DuLieuGVCN', teacherUid), {
      teacherUid, teacherEmail: 'teacher@gmail.com',
      students: [{ id: 1, name: 'HS 1', phone: 'not-for-officers' }, { id: 2, name: 'HS 2' }]
    });
    await setDoc(doc(admin, 'GVCNOfficer', teacherUid), {
      className: 'Lớp thử', students: [{ id: 1, name: 'HS 1', fixedGroup: 1 }, { id: 2, name: 'HS 2', fixedGroup: 2 }],
      memberGroups: { '1': 1, '2': 2 }
    });
    await setDoc(doc(admin, 'CanBoLop', 'leader@gmail.com'), {
      teacherUid, role: 'class_leader', studentId: 1, studentName: 'HS 1', fixedGroup: 1
    });
    await setDoc(doc(admin, 'CanBoLop', 'vice@gmail.com'), {
      teacherUid, role: 'class_vice', studentId: 1, studentName: 'HS 1', fixedGroup: 1
    });
    await setDoc(doc(admin, 'CanBoLop', 'group@gmail.com'), {
      teacherUid, role: 'group_leader', studentId: 1, studentName: 'HS 1', fixedGroup: 1
    });
    await setDoc(doc(admin, 'DuLieuGVBM', teacherUid), { owner: teacherUid });
  });
});
after(async () => {
  if (env) await env.cleanup();
});

test('GVCN đọc và ghi tài liệu lớp chính chủ', async () => {
  const teacher = ctx(teacherUid, 'teacher@gmail.com');
  await assertSucceeds(getDoc(doc(teacher, 'DuLieuGVCN', teacherUid)));
  await assertSucceeds(setDoc(doc(teacher, 'DuLieuGVCN', teacherUid), { teacherUid, updated: true }));
});

test('Học sinh không đọc hoặc sửa tài liệu lớp', async () => {
  const officer = ctx('officer-uid', 'leader@gmail.com');
  await assertFails(getDoc(doc(officer, 'DuLieuGVCN', teacherUid)));
  await assertFails(setDoc(doc(officer, 'DuLieuGVCN', teacherUid), { teacherUid, tamper: true }));
});

test('Cán bộ lớp hợp lệ đọc danh sách tối thiểu', async () => {
  const officer = ctx('officer-uid', 'leader@gmail.com');
  const snapshot = await assertSucceeds(getDoc(doc(officer, 'GVCNOfficer', teacherUid)));
  if (!snapshot.exists()) throw new Error('Không có danh sách');
  if ('phone' in snapshot.data()) throw new Error('Danh sách chứa số điện thoại không cần thiết');
});

test('Học sinh bình thường và email chưa xác minh không đọc được danh sách', async () => {
  const ordinary = ctx('ordinary-uid', 'ordinary@gmail.com');
  await assertFails(getDoc(doc(ordinary, 'GVCNOfficer', teacherUid)));
  const unverified = env.authenticatedContext('unverified-uid', { email: 'leader@gmail.com', email_verified: false }).firestore();
  await assertFails(getDoc(doc(unverified, 'GVCNOfficer', teacherUid)));
});

test('Chủ lớp cấp chỉ mục mới; học sinh không được tự cấp quyền', async () => {
  const teacher = ctx(teacherUid, 'teacher@gmail.com');
  const outsider = ctx('outsider-uid', 'outsider@gmail.com');
  const index = {
    teacherUid, role: 'group_leader', studentId: 2, studentName: 'HS 2', fixedGroup: 2
  };
  await assertSucceeds(setDoc(doc(teacher, 'CanBoLop', 'newgroup@gmail.com'), index));
  await assertFails(setDoc(doc(outsider, 'CanBoLop', 'outsider@gmail.com'), index));
});

test('Lớp trưởng được gửi báo cáo điểm danh ở cả 2 tổ', async () => {
  const db = ctx('officer-uid', 'leader@gmail.com');
  await assertSucceeds(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), action(1)));
  await assertSucceeds(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), action(2)));
});

test('Lớp phó được gửi báo cáo nề nếp toàn lớp', async () => {
  const db = ctx('officer-uid', 'vice@gmail.com');
  await assertSucceeds(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), {
    type: 'behavior', studentId: '2', actorUid: 'officer-uid',
    tagId: 't1', note: 'Kiểm tra', createdAt: serverTimestamp()
  }));
});

test('Tổ trưởng chỉ gửi điểm danh thuộc tổ của mình', async () => {
  const db = ctx('officer-uid', 'group@gmail.com');
  await assertSucceeds(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), action(1)));
  await assertFails(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), action(2)));
});

test('Tổ trưởng không được giả mạo actorUid', async () => {
  const db = ctx('officer-uid', 'group@gmail.com');
  await assertFails(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), action(1, { actorUid: teacherUid })));
});

test('Học sinh chưa ủy quyền không gửi được bản ghi', async () => {
  const db = ctx('ordinary-uid', 'ordinary@gmail.com');
  await assertFails(addDoc(collection(db, 'GVCNOfficer', teacherUid, 'activity'), action(1, { actorUid: 'ordinary-uid' })));
});

test('Cán bộ lớp không được sửa hoặc xóa báo cáo đã gửi', async () => {
  let id;
  await env.withSecurityRulesDisabled(async context => {
    const ref = await addDoc(collection(context.firestore(), 'GVCNOfficer', teacherUid, 'activity'), action(1));
    id = ref.id;
  });
  const officer = ctx('officer-uid', 'leader@gmail.com');
  const ref = doc(officer, 'GVCNOfficer', teacherUid, 'activity', id);
  await assertFails(updateDoc(ref, { status: 'unexcused' }));
  await assertFails(deleteDoc(ref));
  const teacher = ctx(teacherUid, 'teacher@gmail.com');
  await assertSucceeds(deleteDoc(doc(teacher, 'GVCNOfficer', teacherUid, 'activity', id)));
});

test('Thu hồi quyền chặn truy cập danh sách và gửi báo cáo', async () => {
  const teacher = ctx(teacherUid, 'teacher@gmail.com');
  await assertSucceeds(deleteDoc(doc(teacher, 'CanBoLop', 'group@gmail.com')));
  const group = ctx('officer-uid', 'group@gmail.com');
  await assertFails(getDoc(doc(group, 'GVCNOfficer', teacherUid)));
  await assertFails(addDoc(collection(group, 'GVCNOfficer', teacherUid, 'activity'), action(1)));
});

test('Không thay quyền sở hữu app GVBM', async () => {
  const teacher = ctx(teacherUid, 'teacher@gmail.com');
  const other = ctx('other-uid', 'other@gmail.com');
  await assertSucceeds(getDoc(doc(teacher, 'DuLieuGVBM', teacherUid)));
  await assertFails(getDoc(doc(other, 'DuLieuGVBM', teacherUid)));
});

test('Không thay quyền đọc app Dạy thêm bản thường', async () => {
  await env.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'DuLieuDayThem', teacherUid), { name: 'lớp thêm thử' });
  });
  const teacher = ctx(teacherUid, 'teacher@gmail.com');
  const other = ctx('other-uid', 'other@gmail.com');
  await assertSucceeds(getDoc(doc(teacher, 'DuLieuDayThem', teacherUid)));
  await assertFails(getDoc(doc(other, 'DuLieuDayThem', teacherUid)));
});

test('Cán bộ lớp đăng nhập đọc được chính chỉ mục CanBoLop theo email đã xác minh', async () => {
  const leader = ctx('officer-uid', 'leader@gmail.com');
  const index = await assertSucceeds(getDoc(doc(leader, 'CanBoLop', 'leader@gmail.com')));
  if (!index.exists() || index.data().role !== 'class_leader') {
    throw new Error('Không đọc được vai trò lớp trưởng đã được cấp.');
  }
  const unrelated = ctx('unrelated-uid', 'other@gmail.com');
  await assertFails(getDoc(doc(unrelated, 'CanBoLop', 'leader@gmail.com')));
});

test('Chỉ chủ lớp và cán bộ có quyền xem danh sách GVCNOfficer', async () => {
  const leader = ctx('officer-uid', 'leader@gmail.com');
  const roster = await assertSucceeds(getDoc(doc(leader, 'GVCNOfficer', teacherUid)));
  if (!roster.exists() || !roster.data().students.some(s => s.id === 1)) {
    throw new Error('Chưa tạo danh sách cán bộ lớp.');
  }
});
