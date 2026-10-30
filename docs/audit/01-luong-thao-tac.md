# TÀI LIỆU KIỂM TOÁN: LUỒNG THAO TÁC ĐẾN TAB CHUYỂN TIẾP (MỤC A)

> **Hệ thống:** Pack & Send - Tổng công ty Bưu điện Việt Nam (VNPost)  
> **Module kiểm toán:** 3.9 - Quản lý vận đơn (`van-don.html`)  
> **Đối tượng:** Chức năng "Thêm thông tin chuyển tiếp" cho bưu gửi  

---

## 1. Các bước thao tác từ màn hình chính

```
[Đăng nhập thủ công (có Captcha)]
              │
              ▼
[Menu trái: 3. PHÁT ➔ 3.9 Quản lý vận đơn]
              │
              ▼
[Nhập mã bưu gửi vào ô 'Mã Vận đơn' (#LadingCode) ➔ Bấm Tìm kiếm (#search_key)]
              │
              ▼
[Bảng danh sách bưu gửi nạp kết quả từ POST /Lading/Home/GetLading]
              │
              ▼
[Kiểm tra cột Trạng thái: có huy hiệu 'Bưu gửi chuyển tiếp' (C39)]
              │
              ▼
[Bấm nút '✏ Thêm thông tin chuyển tiếp' trên dòng bưu gửi]
              │
              ▼
[Hệ thống gọi GET /Lading/LadingJourney/GetByLadingCode và mở Modal 'Bưu gửi chuyển tiếp']
```

### Chi tiết từng bước:

### Bước 1: Đăng nhập
- Người dùng tự đăng nhập tài khoản nhân viên bưu điện tại `https://packnsend.vnpost.vn/`.
- Hệ thống yêu cầu Username, Password và Captcha hình ảnh.
- Phiên đăng nhập được quản lý bằng Session Cookie của ASP.NET (không sử dụng CSRF token trên form).

### Bước 2: Điều hướng vào Module 3.9
- Tại menu điều hướng bên trái: Chọn **`3. PHÁT`** ➔ bấm chọn **`3.9. Quản lý vận đơn`**.
- URL trang: `https://packnsend.vnpost.vn/van-don.html`

### Bước 3: Tìm kiếm bưu gửi cần chuyển tiếp
- **Ô nhập liệu:** `#LadingCode` (Placeholder: *"MÃ VẬN ĐƠN NGĂN CÁCH NHAU BẰNG DẤU ,"*).
- **Quy tắc tìm kiếm:** 
  - Cho phép nhập 1 hoặc nhiều mã bưu gửi cách nhau bằng dấu phẩy `,` (ví dụ: `CH371143235VN, EM123456789VN`).
  - Hàm tìm kiếm tự động chuyển toàn bộ mã thành chữ in hoa (`.toUpperCase()`).
- **Thực thi tìm kiếm:** Bấm nút tìm kiếm `#search_key` hoặc nhấn Enter.
- Hệ thống gọi hàm `Lading.GetLading(1)`:
  - Endpoint: `POST /Lading/Home/GetLading`
  - Trả về đoạn HTML chứa bảng `#table_lading` và chèn trực tiếp vào `#contentLading`.

### Bước 4: Kiểm tra điều kiện bưu gửi được phép chuyển tiếp
- **Điều kiện trạng thái:** Bưu gửi **bắt buộc** phải ở trạng thái **`C39` - Bưu gửi chuyển tiếp**.
- **Hiển thị trên bảng:**
  - Cột "Trạng thái" hiển thị nhãn màu xanh: `Bưu gửi chuyển tiếp`.
  - Bên dưới nhãn xuất hiện nút:
    ```html
    <a class="btn btn-xs btn-primary" href="#" 
       onclick="GetUpdateItemForward('MÃ_BG', 'C39', 'TÊN_NGƯỜI_NHẬN', 'ĐỊA_CHỈ_NGƯỜI_NHẬN')">
       <i class="fa fa-pencil"></i> Thêm thông tin chuyển tiếp
    </a>
    ```
- **Khi nào nút bị ẩn/khóa?**
  - Nếu bưu gửi chưa được cập nhật trạng thái `C39` (ví dụ đang ở trạng thái phát bình thường, đã phát thành công C44, hoặc hủy báo phát C40), nút "Thêm thông tin chuyển tiếp" sẽ **hoàn toàn không xuất hiện**.
  - Nếu tài khoản không có quyền phát/quản lý vận đơn tại bưu cục tương ứng, nút cũng không hiển thị.

### Bước 5: Mở form Chuyển tiếp
- Khi click nút "Thêm thông tin chuyển tiếp", trình duyệt gọi hàm:
  `GetUpdateItemForward(ladingCode, statusCode, receiverName, receiverAddress)`
- Request AJAX gửi đi:
  - `GET /Lading/LadingJourney/GetByLadingCode`
  - Tham số: `ladingCode`, `statusCode='C39'`, `receiverName`, `receiverAddress`.
- Phản hồi từ server:
  - Trả về nội dung HTML của modal.
  - Chèn vào vùng chứa: `$("#md_update_item_forward_container").html(data);`
  - Kích hoạt hiển thị Bootstrap Modal: `$('#md_update_item_forward').modal('toggle');`
- **Đặc điểm kiến trúc:**
  - **Không sử dụng iframe**.
  - Toàn bộ modal nằm ngay trong cấu trúc DOM của trang chính `van-don.html`.
  - Có thể truy cập và tương tác trực tiếp với các phần tử input bằng DOM thông thường hoặc gọi trực tiếp hàm JavaScript `UpdateItemForward()`.

---

## 2. Ảnh minh họa luồng màn hình (Đã làm sạch thông tin)

1. **Màn hình tìm kiếm bưu gửi (Module 3.9):**
   - Vị trí nút "Thêm thông tin chuyển tiếp" tại cột "Trạng thái" của bưu gửi có trạng thái `C39`.
2. **Modal popup "Bưu gửi chuyển tiếp":**
   - Tiêu đề modal: `Bưu gửi chuyển tiếp`
   - Nhóm thông tin cố định: Mã vận đơn, Bưu cục phát, Tuyến phát, Bưu tá phát, Lý do, Hướng xử lí, Ngày chuyển.
   - Nhóm thông tin nhập liệu: Họ tên người nhận, Địa chỉ, Điện thoại, Email, Lựa chọn Bưu cục khác / Địa chỉ, Ghi chú.
   - Nút hành động cuối modal: Hủy, In BĐ30, Cập nhật.
