# TÀI LIỆU KIỂM TOÁN: QUAN SÁT TÍNH NĂNG LIÊN QUAN TRONG HỆ THỐNG (MỤC E)

> **Mục tiêu:** Rà soát các tính năng liên quan trong menu (đặc biệt là Module 3.8 Quản lý BG chuyển tuyến và 3.13 Quản lý chuyển hoàn) để xem hệ thống Pack & Send có sẵn tính năng nhập hàng loạt, import Excel hoặc file mẫu tham chiếu nào có thể tái sử dụng không.

---

## 1. Khảo sát Module 3.13: Quản lý chuyển hoàn

Trong phân hệ `3. PHÁT`, menu `3.13. Quản lý chuyển hoàn` bao gồm các chức năng con:
- `3.13.1. Quản lý chuyển hoàn`
- `3.13.2. Chuyển hoàn số lượng lớn`
- `3.13.3. Chuyển hoàn, chuyển tiếp SLL` (Đường dẫn: `/nhập-thông-tin-chuyển-hoàn-chuyển-tiếp.html`)

### Chi tiết trang `3.13.3. Chuyển hoàn, chuyển tiếp SLL`:
- **Giao diện và chức năng thực tế:**
  - Trang này hỗ trợ nhập thông tin xử lý tập trung cho các bưu gửi thuộc diện chuyển hoàn hoặc xử lý kho.
  - Qua rà soát mã nguồn trang và các liên kết hành động, trang **KHÔNG có nút Import Excel** nào dành cho việc nhập thông tin chuyển tiếp hàng loạt.
  - Các nút liên quan đến Excel trên trang thực chất là các đường dẫn báo cáo xuất dữ liệu:
    - `6.1. Danh sách bưu gửi chờ nhập kho`
    - `6.3. Danh sách bưu gửi đã nhập kho`
    - `6.6. Báo cáo sản lượng xuất nhập kho`
- **Kết luận tại Module 3.13:** Không có cấu trúc file Excel mẫu nhập liệu sẵn nào của VNPost để tái sử dụng.

---

## 2. Khảo sát Module 3.8: Quản lý bưu gửi chuyển tuyến

- **Đường dẫn chức năng:** Phân hệ `3. PHÁT` ➔ `3.8. Quản lý BG chuyển tuyến`.
- **Mục đích nghiệp vụ:** Xử lý điều chuyển luồng bưu gửi giữa các tuyến phát trong cùng bưu cục hoặc chuyển tuyến liên bưu cục.
- **Tính năng xử lý file:**
  - Module 3.8 chủ yếu hỗ trợ quét mã vạch (Barcode Scanner) từng bưu gửi vào danh sách bảng kê hoặc chọn hàng loạt các bưu gửi đã hiển thị trên bảng để bấm nút "Chuyển tuyến".
  - Có nút **"Xuất Excel"** danh sách bảng kê bưu gửi để in ấn hoặc đối soát.
  - **Không có tính năng "Nhập từ Excel" (Import)** để tự động điền thông tin địa chỉ/người nhận mới cho từng bưu gửi chuyển tiếp.

---

## 3. Khảo sát Module 3.9: Quản lý vận đơn (`van-don.html`)

- Trang chính `van-don.html` có 3 nút chức năng hàng loạt phía trên bảng danh sách:
  1. `Tạo Ticket` (`#create_ticket_multi`): Tạo yêu cầu hỗ trợ tập trung.
  2. `Gửi SMS` (`#send_sms_multi`): Gửi tin nhắn SMS thông báo cho nhiều bưu gửi được tích chọn (`checkbox.checkMe`).
  3. `Xuất Excel` (`#export_excel`): Xuất danh sách các bưu gửi đang hiển thị ra file `.xlsx` / `.xls` để theo dõi.
- **Không có nút "Nhập Excel" (Import)** để cập nhật dữ liệu vận đơn.

---

## 4. Kết luận tổng thể

1. **Thực trạng hệ thống:**
   Hệ thống Pack & Send của VNPost hiện tại **hoàn toàn chưa có tính năng Import Excel để cập nhật thông tin chuyển tiếp bưu gửi hàng loạt**.
2. **Quy trình thủ công hiện tại:**
   Bưu tá hoặc giao dịch viên khi muốn chuyển tiếp phải:
   - Tìm kiếm từng bưu gửi.
   - Nhấp vào nút "Thêm thông tin chuyển tiếp".
   - Gõ lại bằng tay họ tên, địa chỉ, số điện thoại người nhận mới và chọn bưu cục/tỉnh thành.
   - Bấm "Cập nhật" rồi lặp lại cho bưu gửi tiếp theo.
   Điều này gây tốn rất nhiều thời gian và dễ nhầm lẫn khi số lượng bưu gửi chuyển tiếp trong ngày lớn.
3. **Ý nghĩa của Chrome Extension:**
   Việc xây dựng Chrome Extension với file Excel mẫu được chuẩn hóa (như thiết kế ở Mục F) là **hoàn toàn đúng đắn, giải quyết triệt để nút thắt cổ chai** trong quy trình vận hành thực tế tại các bưu cục.
