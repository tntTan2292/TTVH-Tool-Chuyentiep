# BÁO CÁO TỔNG HỢP KIỂM TOÁN VÀ ĐÁNH GIÁ RỦI RO (MỤC TỔNG KẾT)

> **Dự án:** Chrome Extension tự động chuyển tiếp bưu gửi hàng loạt  
> **Hệ thống mục tiêu:** VNPost Pack & Send (`https://packnsend.vnpost.vn/`)  
> **Module kiểm toán:** 3.9 - Quản lý vận đơn (`van-don.html`)  
> **Người thực hiện:** QA/Technical Business Analyst (Antigravity)  
> **Ngày lập:** 29/10/2026  

---

## 1. Tóm tắt Phát hiện Chính (Key Findings)

1. **Thực trạng quy trình:**
   - Hệ thống Pack & Send hiện tại **chưa có tính năng nhập hàng loạt từ Excel** cho nghiệp vụ chuyển tiếp bưu gửi (kể cả tại module 3.8 và 3.13). Người dùng đang phải làm thủ công từng bưu gửi một cách rời rạc và tốn nhiều công sức.
2. **Điều kiện tiên quyết của bưu gửi:**
   - Bưu gửi bắt buộc phải ở trạng thái **`C39` - Bưu gửi chuyển tiếp** thì nút `✏ Thêm thông tin chuyển tiếp` mới xuất hiện trên dòng vận đơn.
3. **Cơ chế kỹ thuật cốt lõi:**
   - **Form mở qua:** `GET /Lading/LadingJourney/GetByLadingCode` ➔ trả về HTML chứa modal `#md_update_item_forward` và model dữ liệu gốc `_newModel`.
   - **Form lưu qua:** `POST /Lading/LadingJourney/UpdateItemForward` ➔ nhận payload `{ value: _newModel }` (chuẩn serialization ASP.NET MVC).
   - **Phản hồi thành công:** JSON `{ Code: "00", Message: "..." }`.
   - **Bảo mật:** Không dùng CSRF / Anti-Forgery Token. Xác thực hoàn toàn dựa trên Cookie phiên đăng nhập của trình duyệt.
4. **Đề xuất kiến trúc Extension:**
   - Sử dụng **Phương án gọi Endpoint nội bộ (API-based injection)** trong ngữ cảnh trang web VNPost. 
   - Ưu điểm vượt trội: Tốc độ xử lý nhanh (0.8 - 1.2s/bưu gửi kèm safe delay), không bị phụ thuộc vào độ trễ render DOM/Modal, hạn chế tối đa lỗi gián đoạn do thao tác chuột của người dùng.

---

## 2. Danh sách các điểm "CHƯA XÁC MINH" & Hướng giải quyết

Tuân thủ nghiêm ngặt nguyên tắc **không can thiệp hoặc thay đổi dữ liệu bưu gửi thật khi chưa có văn bản phê duyệt**, các điểm sau được ghi nhận ở trạng thái **CHƯA XÁC MINH**:

| STT | Nội dung chưa xác minh | Lý do chưa xác minh | Hướng đề xuất xác minh trong môi trường Test |
|:---:|---|---|---|
| 1 | Danh sách đầy đủ mọi mã phản hồi lỗi nghiệp vụ từ Server (ngoài mã `Code != "00"`) | Cần kịch bản gửi dữ liệu lỗi thực tế lên server (ví dụ: bưu gửi đã chuyển hoàn, bưu cục đích không hợp lệ). Hiện tại tuân thủ an toàn nên không submit dữ liệu rác. | Khi người dùng cung cấp 1-2 mã bưu gửi test được phép hủy/thay đổi, Extension sẽ gửi thử nghiệm có kiểm soát. |
| 2 | Giới hạn số lượng bưu gửi tối đa khi tìm kiếm cùng lúc tại ô `#LadingCode` | Giao diện ghi *"ngăn cách nhau bằng dấu ,"*, thử nghiệm với chuỗi 1 mã đã hoạt động bình thường. | Thử nghiệm tìm kiếm chuỗi 50 và 100 mã bưu gửi cùng lúc xem URL POST có bị giới hạn payload size không. |
| 3 | Thời gian chính xác của phiên Session Timeout | Cần giữ phiên không hoạt động để đo đạc thời điểm cookie hết hạn (thường là 20-30 phút theo chuẩn ASP.NET IIS). | Theo dõi phản hồi redirect 302 về `/Account/Login` để tự động dừng và cảnh báo đăng nhập lại. |

---

## 4. Đánh giá Rủi ro và Giải pháp Giảm thiểu

| Rủi ro kỹ thuật / nghiệp vụ | Mức độ | Hậu quả tiềm ẩn | Giải pháp khắc phục trong Extension |
|---|:---:|---|---|
| **Quá tải máy chủ VNPost khi gửi hàng loạt** | Cao | Bị server từ chối kết nối, nghẽn database hoặc tài khoản bị tạm khóa | Cấu hình bắt buộc khoảng nghỉ (Throttling / Delay) **800ms – 1500ms** giữa các bưu gửi; tuyệt đối không gửi song song hàng chục request cùng lúc. |
| **Mất phiên đăng nhập giữa chừng** | Trung bình | Một phần bưu gửi được chuyển tiếp, phần còn lại bị lỗi | Kiểm tra mã phản hồi (HTTP 401 hoặc redirect về Login); nếu phát hiện hết phiên, lập tức **dừng ngay tiến trình**, thông báo rõ bưu gửi nào đã xong và bưu gửi nào chưa xử lý. |
| **Dữ liệu trong Excel sai định dạng (mất số 0 đầu)** | Cao | Số điện thoại hoặc mã bưu gửi bị lỗi, dẫn đến thất bại hàng loạt | Thiết lập Data Validation trong file Excel mẫu định dạng kiểu Text (`@`); Extension bổ sung bộ tiền kiểm duyệt (Pre-validation) trước khi gửi request. |
| **Bưu gửi chưa chuyển sang trạng thái C39** | Trung bình | Server từ chối cập nhật | Extension tự động kiểm tra `StatusCode == 'C39'` trước khi gọi `UpdateItemForward`. Nếu chưa đúng trạng thái, báo ngay mã lỗi `E11_BG_KHONG_PHAI_C39`. |

---

## 5. Các câu hỏi cần PO / Quản trị Dự án quyết định

1. **Về luồng xử lý trạng thái bưu gửi:**
   - Nếu bưu gửi chưa ở trạng thái `C39 - Bưu gửi chuyển tiếp`, Extension chỉ báo lỗi hay cần có thêm tính năng hỗ trợ tự động chuyển bưu gửi sang `C39` trước rồi mới điền thông tin chuyển tiếp?
2. **Về loại chuyển tiếp ưu tiên:**
   - Trong thực tế tại bưu cục, người dùng chủ yếu chuyển tiếp theo **Bưu cục khác** (`BUU_CUC`) hay theo **Địa chỉ hành chính Tỉnh/Xã** (`DIA_CHI`)?
3. **Về file báo cáo kết quả:**
   - PO có muốn Extension tự động tải về file Excel kết quả ngay khi xử lý xong toàn bộ danh sách, hay hiển thị bảng xem trước trên giao diện Extension để người dùng bấm xuất thủ công?
