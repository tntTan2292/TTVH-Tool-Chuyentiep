# TÀI LIỆU KIỂM TOÁN: THÔNG BÁO LỖI VÀ BẢNG MÃ LỖI CHUẨN HÓA (MỤC D)

> **Mục tiêu:** Thu thập nguyên văn mọi thông báo lỗi và thành công từ client & server, phân loại và chuẩn hóa thành danh mục mã lỗi để Extension ghi nhận vào file Excel báo cáo kết quả.

---

## 1. Thông báo lỗi phía Client (jQuery ValidationEngine)

Hệ thống Pack & Send sử dụng thư viện `jQuery.validationEngine` kèm bộ ngôn ngữ tiếng Việt `allRules`. Khi người dùng để trống hoặc nhập sai định dạng, thư viện sẽ hiển thị các thẻ thông báo tooltip ngay tại ô nhập liệu:

| Trường kiểm tra | Loại lỗi | Nguyên văn câu thông báo hiển thị |
|---|---|---|
| `ReceiverNameReturn` (Họ tên người nhận) | Bỏ trống trường bắt buộc | `* Trường này bắt buộc` |
| `ReceiverAddressReturn` (Địa chỉ người nhận) | Bỏ trống trường bắt buộc | `* Trường này bắt buộc` |
| `NextPhone` (Điện thoại người nhận mới) | Bỏ trống trường bắt buộc | `* Trường này bắt buộc` |
| `NextPhone` (Điện thoại người nhận mới) | Nhập sai cấu trúc số điện thoại | `* Số điện thoại sai` |
| `NextEmail` (Email người nhận mới) | Nhập chuỗi không đúng chuẩn email | `* Địa chỉ thư điện tử sai` |
| `txtOtherPostOffice` (khi chọn Bưu cục khác) | Bỏ trống tên/mã bưu cục | `* Trường này bắt buộc` |
| `cbProvince` (khi chọn Địa chỉ) | Chưa chọn Tỉnh/Thành phố | `* Trường này bắt buộc` |
| `cbWard` (khi chọn Địa chỉ) | Chưa chọn Phường/Xã | `* Trường này bắt buộc` |

---

## 2. Thông báo từ Server và Hệ thống

### 2.1. Thông báo Thành công
- **Nguyên văn hiển thị:** `common.Message("Thành công", data.Message, "success")`
- **Dữ liệu trả về:** JSON có `data.Code == "00"`
- **Vị trí và hành vi:** Hiển thị hộp thông báo/Toast nổi góc màn hình màu xanh lá, tự động đóng modal `md_update_item_forward`.

### 2.2. Thông báo Lỗi Nghiệp vụ từ Server
- **Nguyên văn hiển thị:** `common.Message("Không thành công - " + data.Code, data.Message, "error")`
- **Dữ liệu trả về:** JSON có `data.Code != "00"` (Ví dụ `01`, `02`...)
- **Nguyên nhân thường gặp:**
  - Bưu gửi đã được chuyển tiếp trước đó hoặc trạng thái trên hệ thống đã thay đổi.
  - Mã bưu cục nhận không tồn tại trong danh bạ bưu điện.
  - Bưu tá hoặc tuyến phát không có quyền thao tác trên bưu gửi này.

### 2.3. Lỗi Mạng / Hệ thống / Hết phiên
- **Lỗi kết nối / Server 500:** 
  `common.Message("Lỗi", "Hãy kiểm tra lại đường truyền trước khi thực hiện thao tác.", "error")`
- **Hết phiên đăng nhập:** Phản hồi mã HTTP 401 hoặc điều hướng về `/Account/Login`.

---

## 3. Danh mục Mã lỗi Chuẩn hóa cho Báo cáo Extension

Để file Excel xuất ra báo cáo rõ ràng, dễ lọc và người dùng hiểu ngay lý do thất bại, các kết quả xử lý được chuẩn hóa thành bộ mã sau:

| Mã lỗi chuẩn | Tên lỗi | Giải thích nguyên nhân | Hướng dẫn khắc phục cho người dùng |
|---|---|---|---|
| **`SUCCESS`** | Thành công | Bưu gửi đã được chuyển tiếp thành công trên hệ thống PNS (`Code: "00"`). | Không cần thao tác thêm. |
| **`E01_THIEU_HO_TEN`** | Thiếu họ tên người nhận | Cột `HO_TEN_NGUOI_NHAN` trong file Excel bị bỏ trống. | Điền họ tên người nhận mới vào file Excel. |
| **`E02_THIEU_DIA_CHI`** | Thiếu địa chỉ người nhận | Cột `DIA_CHI_NGUOI_NHAN` trong file Excel bị bỏ trống. | Điền địa chỉ nhận mới chi tiết. |
| **`E03_THIEU_SO_DT`** | Thiếu số điện thoại | Cột `SO_DIEN_THOAI` trong file Excel bị bỏ trống. | Điền số điện thoại liên hệ của người nhận mới. |
| **`E04_SAI_SO_DT`** | Sai định dạng điện thoại | Số điện thoại không đủ 10 số hoặc chứa ký tự đặc biệt/chữ cái. | Sửa lại số điện thoại chuẩn 10 chữ số (bắt đầu bằng 0). |
| **`E05_SAI_EMAIL`** | Sai định dạng email | Email có nhập nhưng sai cấu trúc (thiếu `@`, thiếu domain...). | Kiểm tra hoặc để trống cột email nếu không có. |
| **`E06_THIEU_BUU_CUC`** | Thiếu bưu cục chuyển đến | Chọn loại `BUU_CUC` nhưng để trống ô tên/mã bưu cục. | Điền tên/mã bưu cục đích cần chuyển tới. |
| **`E07_THIEU_TINH_XA`** | Thiếu Tỉnh hoặc Xã | Chọn loại `DIA_CHI` nhưng chưa chọn mã Tỉnh hoặc mã Xã hợp lệ. | Chọn mã Tỉnh và mã Xã tương ứng từ danh mục. |
| **`E10_BG_KHONG_TON_TAI`** | Bưu gửi không tìm thấy | Mã vận đơn không tồn tại trên hệ thống Pack & Send bưu cục hiện tại. | Kiểm tra lại tính chính xác của mã bưu gửi. |
| **`E11_BG_KHONG_PHAI_C39`** | Bưu gửi chưa đủ điều kiện | Bưu gửi không ở trạng thái `C39 - Bưu gửi chuyển tiếp` (ví dụ đang phát hoặc đã gạch nợ). | Kiểm tra và chuyển trạng thái bưu gửi sang C39 trước khi chuyển tiếp. |
| **`E20_LOI_NGHIEP_VU`** | Lỗi xử lý từ hệ thống | Server trả về mã lỗi `data.Code != "00"` kèm thông báo cụ thể. | Đọc chi tiết cột `NGUYEN_NHAN` để biết lý do hệ thống từ chối. |
| **`E90_HET_PHIEN`** | Hết phiên đăng nhập | Phiên làm việc trên PNS đã hết hạn (timeout). | Đăng nhập lại trên tab VNPost rồi chạy lại Extension. |
| **`E99_LOI_KET_NOI`** | Lỗi đường truyền / Server | Mất kết nối internet hoặc máy chủ VNPost bị gián đoạn (HTTP 500/Timeout). | Kiểm tra mạng internet và thử lại sau ít phút. |
