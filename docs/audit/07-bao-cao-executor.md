# BÁO CÁO BỘ THỰC THI TRONG TRANG (WP3 — EXECUTOR)

> **Vị trí tệp:** `extension/page/executor.js`  
> **Ngữ cảnh thực thi:** `world: "MAIN"` trên tab `packnsend.vnpost.vn`  
> **Tuân thủ quy tắc an toàn:** Chỉ chạy thử ở chế độ **CHỈ ĐỌC (DRY RUN)**. Tuyệt đối **không gọi hàm `post`** khi chưa có sự cho phép bằng văn bản từ người dùng.

---

## 1. Mục tiêu và Kiến trúc Kỹ thuật

Tệp `extension/page/executor.js` đóng vai trò là cầu nối giao tiếp trực tiếp với hệ thống backend của VNPost Pack & Send thông qua phiên đăng nhập (Cookie) và thư viện jQuery 1.10.2 sẵn có của trang.

Theo đúng hợp đồng tại Mục 2 của `docs/PROMPT-ANTIGRAVITY-WP3-WP5.md`, executor cung cấp **4 hàm nguyên thủy gọi mạng**:

| Hàm nguyên thủy | Phương thức & URL | Nhiệm vụ | Định dạng trả về chuẩn hợp đồng |
|---|---|---|---|
| **`getLading(maBG)`** | `POST /Lading/Home/GetLading` | Tra cứu trạng thái bưu gửi trên bảng vận đơn | `{ ok: true, data: { found, statusCode, statusText, hasForwardButton, receiverName, receiverAddress } }` |
| **`getForm(maBG, name, addr)`** | `GET /Lading/LadingJourney/GetByLadingCode` | Mở form và trích xuất model `_newModel` | `{ ok: true, data: { model } }` (hoặc `model: null` nếu không tìm thấy) |
| **`getWard(provinceId)`** | `GET /Order/Home/GetWard` | Nạp danh mục phường/xã theo tỉnh | `{ ok: true, data: [ { value, text }, ... ] }` |
| **`post(model)`** | `POST /Lading/LadingJourney/UpdateItemForward` | Lưu thông tin chuyển tiếp *(Được bảo vệ nghiêm ngặt)* | `{ ok: true, data: { Code, Message } }` |

---

## 2. Chi tiết Xử lý Kỹ thuật trong `executor.js`

### 2.1. Nhận diện hết phiên đăng nhập (`isSessionExpired`)
- Bắt trạng thái HTTP `401 Unauthorized` hoặc chuyển hướng `redirected` về trang đăng nhập.
- Kiểm tra nội dung phản hồi chứa chuỗi đặc trưng: `Account/Login`, `Đăng nhập hệ thống`, hoặc `<form ... id="fLogin">`.
- Trả về đối tượng chuẩn: `{ ok: false, kind: "SESSION_EXPIRED", message: "Hết phiên đăng nhập" }`.

### 2.2. Phân tích bưu gửi từ bảng `GetLading` (`parseGetLadingHtml`)
- Tìm kiếm chính xác thẻ `tr#tr_[maBG]` hoặc dòng bảng chứa mã bưu gửi.
- Nếu không có dòng nào: trả về `{ found: false }` (để core đánh mã `E10_BG_KHONG_TON_TAI`).
- Đọc nút `GetUpdateItemForward`:
  - Trích xuất tham số thứ hai là `statusCode` (ví dụ `'C39'`).
  - Ghi nhận `hasForwardButton: true/false` và nhãn `statusText` (ví dụ `"Bưu gửi chuyển tiếp"`).
  - Trích xuất người nhận và địa chỉ cũ (nếu có trên onclick).
- Nếu trạng thái khác `C39` hoặc không có nút chuyển tiếp, core tự động dừng và thông báo rõ mã `E11_BG_KHONG_PHAI_C39`.

### 2.3. Bóc tách `_newModel` từ `GetByLadingCode` (`parseGetByLadingCodeHtml`)
- Trích xuất biểu thức JavaScript `var _newModel = {...};` từ HTML response và parse thành Object 93 trường nguyên vẹn.
- Nếu server không trả về form hoặc bưu gửi không khớp: trả về `model: null` (core sẽ đánh lỗi `E11` và không tiếp tục).

### 2.4. Cơ chế bảo vệ Chế độ Chỉ Đọc (Dry Run)
- Trong chế độ Chạy thử (`mode: "dry"`), hàm `processOne` của `VNPCore` **tuyệt đối không bao giờ gọi hàm `post`**.
- Mọi thao tác chỉ dừng ở mức: Tra cứu (`getLading`) ➔ Mở form (`getForm`) ➔ Tra cứu xã (`getWard`) ➔ Dựng model (`model-builder`) ➔ Trả về `DRY_OK` hoặc `DRY_FAIL`.
- Hàm `post(model)` chỉ được phép kích hoạt trong chế độ Chạy thật khi người dùng đã xác nhận qua hộp thoại cảnh báo và cho phép bằng văn bản trong chat.

---

## 3. Kết quả Kiểm thử (Unit Tests)

Đã bổ sung bộ kiểm thử `tests/executor.test.js` sử dụng fixture dữ liệu thật từ hệ thống VNPost PNS đã làm sạch:
- `parseGetLadingHtml: trích xuất đúng bưu gửi C39 từ fixture thật đã làm sạch` ➔ **PASS**
- `parseGetLadingHtml: bưu gửi không có trong bảng trả về found=false` ➔ **PASS**
- `parseGetByLadingCodeHtml: trích xuất trọn vẹn _newModel từ fixture HTML` ➔ **PASS**
- `parseGetByLadingCodeHtml: HTML không có form hoặc rỗng trả về null` ➔ **PASS**
- `isSessionExpired: phát hiện chính xác khi hết phiên đăng nhập` ➔ **PASS**

Tổng số bài kiểm thử toàn hệ thống: **89/89 tests passed (100% đạt)**.
