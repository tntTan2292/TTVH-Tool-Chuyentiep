# TÀI LIỆU KIỂM TOÁN: KỸ THUẬT GỬI DỮ LIỆU & ĐỀ XUẤT GIẢI PHÁP (MỤC C)

> **Mục tiêu:** Phân tích chi tiết kiến trúc truyền nhận dữ liệu của chức năng chuyển tiếp, từ đó đề xuất giải pháp tối ưu cho Chrome Extension.

---

## 1. Phân tích các luồng Request / Response

### 1.1. Khi mở Form Chuyển tiếp (`GetUpdateItemForward`)
- **URL:** `/Lading/LadingJourney/GetByLadingCode`
- **Phương thức:** `GET`
- **Tham số (Query Params):**
  - `ladingCode`: Mã bưu gửi (ví dụ: `CH371143235VN`)
  - `statusCode`: Mã trạng thái (luôn là `"C39"`)
  - `receiverName`: Họ tên người nhận hiện tại trên bưu gửi
  - `receiverAddress`: Địa chỉ người nhận hiện tại trên bưu gửi
- **Kiểu dữ liệu phản hồi (Response):** `text/html`
- **Nội dung:** HTML Partial chứa `<form id="fUpdateItemForward">` và đoạn script nội tuyến khởi tạo đối tượng `_newModel`:
  ```javascript
  var _newModel = {
      "Id": 2286326613,
      "LadingCode": "CH371143235VN",
      "StatusCode": "C39",
      "StatusName": "Bưu gửi chuyển tiếp",
      "StatusDate": "20261028",
      "StatusTime": "170647",
      "PoCode": "533140",
      "PosName": "BCVH Thuận Hóa",
      "ReasonCode": "45",
      "ReasonName": "21. Bưu gửi lạc hướng",
      "SolutionCode": "C",
      "SolutionName": "3.Chuyển tiếp sang địa chỉ mới",
      "PostManId": 46267,
      "PostManName": "53A152 - MAI QUANG VINH",
      "RouteCode": "533140114",
      "RouteName": "533140 - Chuyển tiếp",
      ...
  };
  ```

### 1.2. Khi nạp danh sách Phường / Xã (`ProvinceChange`)
- **URL:** `/Order/Home/GetWard`
- **Phương thức:** `GET`
- **Tham số:** `ProvinceId={Mã_Tỉnh}` (ví dụ: `ProvinceId=53` cho Huế)
- **Kiểu dữ liệu phản hồi:** `application/json`
- **Cấu trúc dữ liệu:** Danh sách các object `{ Value: "Mã_Xã", Text: "Tên_Xã" }`.

### 1.3. Khi bấm Lưu / Cập nhật (`UpdateItemForward`)
- **URL:** `/Lading/LadingJourney/UpdateItemForward`
- **Phương thức:** `POST`
- **Headers:**
  - `Content-Type: application/x-www-form-urlencoded; charset=UTF-8` (chuẩn serialization jQuery ajax)
  - `X-Requested-With: XMLHttpRequest`
- **Payload:** Đối tượng `{ value: _newModel }` được cập nhật các thuộc tính mới:
  - `_newModel.ReceiverNameReturn`: Họ tên người nhận mới
  - `_newModel.ReceiverAddressReturn`: Địa chỉ người nhận mới
  - `_newModel.NextPhone`: Số điện thoại người nhận mới
  - `_newModel.NextEmail`: Email mới
  - `_newModel.AddressReturnType`: `"2"` (Bưu cục khác) hoặc `"3"` (Địa chỉ)
  - `_newModel.AddressReturn`:
    - Nếu `AddressReturnType == "2"`: Giá trị chuỗi nhập vào `txtOtherPostOffice`
    - Nếu `AddressReturnType == "3"`: Chuỗi ghép `cbProvince.val() + ";" + cbWard.val()`
  - `_newModel.NoteReturn`: Ghi chú
- **Cấu trúc phản hồi từ Server:**
  - **Khi thành công:**
    ```json
    {
      "Code": "00",
      "Message": "Cập nhật thông tin chuyển tiếp thành công!"
    }
    ```
  - **Khi thất bại nghiệp vụ:**
    ```json
    {
      "Code": "01", // hoặc mã lỗi khác != "00"
      "Message": "Thông tin lỗi từ bưu tá / trạng thái bưu gửi không hợp lệ..."
    }
    ```
  - **Khi lỗi hệ thống / đường truyền:** HTTP Status code 500 / 502 / timeout (`xhr.status != 200`).

---

## 2. Kiểm tra Token bảo mật (CSRF / Anti-Forgery) và Phiên làm việc (Session)

1. **CSRF / Anti-Forgery Token:**
   - Kết quả kiểm toán: **KHÔNG SỬ DỤNG** token chống giả mạo (`csrfTokenExists = false`).
   - Không có input ẩn `__RequestVerificationToken`, không có custom header token trong các AJAX request.
2. **Cơ chế xác thực và quản lý phiên:**
   - Hệ thống thuần túy sử dụng **Cookie phiên** (`ASP.NET_SessionId`, Cookie xác thực).
   - Khi chạy trong ngữ cảnh trình duyệt (qua Chrome Extension Content Script hoặc Background Script kế thừa Cookie của domain `packnsend.vnpost.vn`), mọi request `fetch` hoặc `$.ajax` đều **tự động mang theo đầy đủ cookie hợp lệ**.
3. **Hiện tượng khi hết phiên (Session Timeout):**
   - Khi hết phiên làm việc, server sẽ phản hồi mã chuyển hướng `302 Found` về trang đăng nhập `/Account/Login` hoặc trả về HTTP `401 Unauthorized` / chuỗi HTML trang đăng nhập.
   - Chrome Extension có thể dễ dàng nhận biết phản hồi này (kiểm tra `response.redirected` hoặc response text chứa `Account/Login`) để dừng ngay lập tức và cảnh báo người dùng đăng nhập lại, tránh gửi tiếp các bưu gửi sau.
4. **Giới hạn tốc độ (Rate Limit / Throttle):**
   - Hệ thống web nội bộ VNPost không có cơ chế chặn IP dạng Cloudflare WAF quá khắt khe đối với user đã đăng nhập. Tuy nhiên, việc gửi liên tục hàng chục request/giây có thể gây nghẽn database hoặc quá tải server IIS.
   - Khuyến nghị tốc độ: Đặt độ trễ (delay) từ **800ms đến 1500ms** giữa mỗi bưu gửi để đảm bảo an toàn tuyệt đối và server xử lý kịp thời.

---

## 3. So sánh và Kết luận Đề xuất Hướng giải pháp

### Bảng so sánh 2 hướng tiếp cận

| Tiêu chí | Hướng (1): Tự động hóa DOM (Điền form & Click nút) | Hướng (2): Gọi trực tiếp Endpoint nội bộ (`fetch` / `$.ajax`) |
|---|---|---|
| **Cơ chế thực hiện** | Tìm bưu gửi trên giao diện ➔ Bấm nút ➔ Chờ mở modal ➔ Điền từng ô ➔ Kích hoạt change Tỉnh ➔ Chờ Xã nạp ➔ Chọn Xã ➔ Bấm Cập nhật | Gọi `GET /Lading/LadingJourney/GetByLadingCode` ➔ Parse `_newModel` ➔ Gán thông tin từ Excel ➔ POST `/Lading/LadingJourney/UpdateItemForward` |
| **Tốc độ xử lý** | Chậm (khoảng 2 - 4 giây / bưu gửi do phải chờ animation modal, render DOM và chờ dropdown Xã nạp) | **Rất nhanh** (khoảng 0.8 - 1.2 giây / bưu gửi đã kèm delay an toàn) |
| **Độ ổn định** | Trung bình. Dễ bị treo/lỗi nếu mạng chập chờn, modal mở trễ, hoặc người dùng vô tình chạm chuột vào màn hình | **Rất cao**. Không phụ thuộc giao diện hiển thị, chạy ngầm ổn định kể cả khi người dùng thu nhỏ tab |
| **Độ chính xác dữ liệu** | Phụ thuộc vào việc trigger đúng các event DOM (`change`, `input`, `blur`) để thư viện validation không chặn | **Chính xác tuyệt đối**. Dữ liệu được gán trực tiếp vào schema model `_newModel` trước khi POST |
| **Tính trực quan** | Người dùng nhìn thấy màn hình tự động nhảy từng bưu gửi | Hiển thị tiến độ qua thanh Progress Bar và bảng báo cáo kết quả của Extension |

---

### KẾT LUẬN VÀ ĐỀ XUẤT:

> **ĐỀ XUẤT CHÍNH THỨC: Áp dụng HƯỚNG (2) - Gọi lại Endpoint nội bộ trong ngữ cảnh trang (kế thừa Session Cookie).**

#### Lý do:
1. Hệ thống không có CSRF token cản trở, cookie được trình duyệt tự động đính kèm.
2. Endpoint `UpdateItemForward` nhận model rất rõ ràng và trả về mã phản hồi chuẩn `Code: "00"`, giúp Extension phân loại kết quả cực kỳ chính xác.
3. Extension có thể kiểm tra trước điều kiện bưu gửi bằng cách gọi `GetByLadingCode`. Nếu bưu gửi không hợp lệ hoặc không tồn tại, có thể báo ngay lỗi mà không làm loạn giao diện người dùng.

#### Tùy chọn bổ sung (Hybrid):
Trong Extension, ta có thể xây dựng giao diện hiển thị bảng tiến độ:
- Chế độ mặc định: **Xử lý nhanh qua API nội bộ** (khuyên dùng).
- Chế độ phụ trợ: **Chế độ mô phỏng giao diện** (DOM Step-by-step) dành cho người dùng muốn theo dõi trực quan từng bưu gửi một.
