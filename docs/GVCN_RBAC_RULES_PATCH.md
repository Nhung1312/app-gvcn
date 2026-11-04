# ĐỀ XUẤT RULES CHO APP GVCN — CHƯA ĐƯỢC PUBLISH

Áp dụng cho Firebase `quan-ly-day-them-f7b1e`. Tài liệu này chỉ chứa phần bổ sung/thay thế của **App GVCN**. Không dán đè toàn bộ Rules đang chạy, vì dự án đang dùng chung với app Dạy thêm và GVBM.

## 1. Hai hàm đặt ngay trong `match /databases/{database}/documents {`

```firestore-rules
function officerPath() {
  return /databases/$(database)/documents/CanBoLop/$(request.auth.token.email);
}
function officerFor(teacherUid) {
  return request.auth != null
    && request.auth.token.email_verified == true
    && request.auth.token.email is string
    && exists(officerPath())
    && get(officerPath()).data.teacherUid == teacherUid
    && get(officerPath()).data.role in ['class_leader', 'class_vice', 'group_leader'];
}
```

## 2. THAY THẾ hoàn toàn `match /DuLieuGVCN/{userId}` cũ

```firestore-rules
match /DuLieuGVCN/{userId} {
  allow get, create, update, delete: if request.auth != null
    && request.auth.uid == userId;
  allow list: if false;
}
```

Không cho học sinh đọc toàn bộ hồ sơ lớp (số điện thoại, ngày sinh, hồ sơ khác).

## 3. THÊM HAI MATCH mới (bên trong `match /databases/{database}/documents`)

```firestore-rules
match /CanBoLop/{email} {
  allow get: if request.auth != null
    && (resource.data.teacherUid == request.auth.uid
      || (request.auth.token.email_verified == true
        && request.auth.token.email == email));
  allow list: if false;
  allow create: if request.auth != null
    && request.resource.data.teacherUid == request.auth.uid
    && exists(/databases/$(database)/documents/DuLieuGVCN/$(request.auth.uid))
    && request.resource.data.keys().hasAll(['teacherUid','role','studentId','studentName','fixedGroup'])
    && request.resource.data.keys().hasOnly(['teacherUid','role','studentId','studentName','fixedGroup'])
    && request.resource.data.role in ['class_leader','class_vice','group_leader']
    && request.resource.data.studentName is string
    && (request.resource.data.studentId is int || request.resource.data.studentId is string)
    && (request.resource.data.fixedGroup == null || request.resource.data.fixedGroup is int);
  allow update: if request.auth != null
    && resource.data.teacherUid == request.auth.uid
    && request.resource.data.teacherUid == request.auth.uid
    && request.resource.data.keys().hasAll(['teacherUid','role','studentId','studentName','fixedGroup'])
    && request.resource.data.keys().hasOnly(['teacherUid','role','studentId','studentName','fixedGroup'])
    && request.resource.data.role in ['class_leader','class_vice','group_leader']
    && request.resource.data.studentName is string
    && (request.resource.data.studentId is int || request.resource.data.studentId is string)
    && (request.resource.data.fixedGroup == null || request.resource.data.fixedGroup is int);
  allow delete: if request.auth != null
    && resource.data.teacherUid == request.auth.uid;
}

match /GVCNOfficer/{teacherUid} {
  // Danh sách tối thiểu: ID, họ tên, tổ; không có số điện thoại/ngày sinh.
  allow get: if request.auth != null
    && (request.auth.uid == teacherUid || officerFor(teacherUid));
  allow list: if false;
  allow create, update, delete: if request.auth != null
    && request.auth.uid == teacherUid;

  match /activity/{actionId} {
    // Báo cáo của cán bộ lớp là bản ghi riêng, không ghi nguyên dữ liệu GVCN.
    allow get, list, delete: if request.auth != null
      && request.auth.uid == teacherUid;
    allow update: if false;
    allow create: if officerFor(teacherUid)
      && request.resource.data.actorUid == request.auth.uid
      && request.resource.data.createdAt == request.time
      && request.resource.data.studentId is string
      && exists(/databases/$(database)/documents/GVCNOfficer/$(teacherUid))
      && get(/databases/$(database)/documents/GVCNOfficer/$(teacherUid))
        .data.memberGroups.get(request.resource.data.studentId, -1) != -1
      && (
        get(officerPath()).data.role in ['class_leader', 'class_vice']
        || (get(officerPath()).data.role == 'group_leader'
          && get(officerPath()).data.fixedGroup is int
          && get(officerPath()).data.fixedGroup > 0
          && get(/databases/$(database)/documents/GVCNOfficer/$(teacherUid))
            .data.memberGroups.get(request.resource.data.studentId, -1)
            == get(officerPath()).data.fixedGroup)
      )
      && (
        (request.resource.data.type == 'attendance'
          && request.resource.data.keys().hasOnly(['actorUid','createdAt','studentId','type','date','status'])
          && request.resource.data.keys().hasAll(['actorUid','createdAt','studentId','type','date','status'])
          && request.resource.data.date is string
          && request.resource.data.date.matches('^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
          && request.resource.data.status in ['present','excused','unexcused'])
        || (request.resource.data.type == 'behavior'
          && request.resource.data.keys().hasOnly(['actorUid','createdAt','studentId','type','tagId','note'])
          && request.resource.data.keys().hasAll(['actorUid','createdAt','studentId','type','tagId','note'])
          && request.resource.data.tagId is string
          && request.resource.data.tagId.size() <= 100
          && request.resource.data.note is string
          && request.resource.data.note.size() <= 400)
      );
  }
}
```

## 4. Các quy tắc KHÔNG chỉnh trong bản đề xuất này

Giữ nguyên: `DuLieuDayThem`, `nguoi_dung`, `ban_quyen_thuong`, `khach_hang_gvcn`, `DuLieuGVBM`, `khach_hang_gvbm`.

**CẦN KIỂM TRA TRƯỚC KHI PUBLISH:** `class_members/{memberId}` vẫn cho mọi tài khoản đăng nhập đọc/ghi; `classes/{teacherUid}/activityLogs/{logId}` vẫn cho mọi tài khoản đăng nhập đọc/tạo. Chưa thể thắt chặt hai đường dẫn này một cách an toàn khi chưa xác minh app nào đang dùng và cấu trúc dữ liệu. Không được coi Rules tổng thể an toàn tuyệt đối cho đến khi kiểm tra chúng.

## 5. Ma trận bắt buộc kiểm thử trong Firebase Emulator với dữ liệu giả

| Kiểm thử | Kết quả mong muốn |
|---|---|
| GVCN đọc/ghi `DuLieuGVCN/{uid}` của mình | ALLOW |
| Học sinh đăng nhập đọc `DuLieuGVCN/{teacherUid}` | DENY |
| GVCN ghi index `CanBoLop/{email}` của lớp mình | ALLOW |
| Tài khoản đã xác minh đúng email đọc index của mình | ALLOW |
| Học sinh chưa được ủy quyền đọc `GVCNOfficer/{teacherUid}` | DENY |
| Lớp trưởng/lớp phó đọc danh sách tối thiểu và tạo báo cáo trong lớp | ALLOW |
| Tổ trưởng tạo báo cáo cho học sinh khác tổ | DENY |
| Học sinh bình thường tạo báo cáo | DENY |
| Cán bộ lớp sửa/xóa báo cáo đã gửi | DENY |
| Học sinh đọc hoặc ghi tài liệu lớp đầy đủ | DENY |
| Thu hồi `CanBoLop` xong: cán bộ lớp không còn truy cập | DENY |
| App Dạy thêm và GVBM vẫn chạy như trước | PASS |

Bản vá GitHub liên quan: https://github.com/Nhung1312/app-gvcn/pull/1

**Không triển khai tự động.** Cần kiểm thử Emulator, bản sao lưu Rules hiện tại và xác nhận các kết nối đang sử dụng trước khi Publish.
