# DANH MỤC THÔNG BÁO LỖI VÀ MÃ LỖI CHUẨN HÓA (MỤC D)

> Phân loại các thông báo phản hồi từ hệ thống và chuẩn hóa bộ mã lỗi phục vụ báo cáo kết quả của Extension.

---

## 1. Danh mục Mã lỗi Chuẩn hóa cho "Xử lý 3.0"

| Mã lỗi chuẩn | Tên lỗi nghiệp vụ | Mô tả nguyên văn / Hành vi hệ thống | Bước xuất hiện | Hướng xử lý của Extension |
|---|---|---|:---:|---|
| **`E40_KHONG_TIM_THAY_BG`** | Không tìm thấy bưu gửi | Ô tìm kiếm trả về 0 bản ghi hoặc danh sách rỗng | Bước 1 (6.2) | Ghi nhận lỗi, bỏ qua BG này |
| **`E41_VU_HOI_THAT_BAI`** | Vu hồi thất bại | Server trả về `Code != "00"` khi gọi `Recovered` | Bước 1 (6.2) | Dừng xử lý BG này ở các bước sau |
| **`E42_CHUA_VU_HOI`** | BG chưa thực hiện vu hồi | "Chỉ được giao lại các bưu gửi đã thực hiện vu hồi" (`StatusCode != "R"`) | Bước 2 (6.2) | Loại khỏi danh sách giao lại |
| **`E42_GIAO_LAI_THAT_BAI`** | Giao lại thất bại | Server trả về `Code != "00"` khi gọi `DivideRecovered` | Bước 2 (6.2) | Dừng xử lý BG này ở Bước 3 & 4 |
| **`E43_KHONG_THAY_TUYEN_CT`** | Không tìm thấy tuyến Chuyển tiếp | Dropdown `#Route` không có option chứa chữ "Chuyển tiếp" | Bước 3 (3.2) | Dừng tiến trình, cảnh báo người dùng |
| **`E43_SAI_LECH_SO_LUONG`** | Số lượng BĐ13 không khớp | Cột "SL bưu gửi chưa lập BD13" ≠ số BG đã giao lại thành công ở Bước 2 | Bước 3 (3.2) | Dừng an toàn (theo quyết định PO) |
| **`E43_LAP_BD13_THAT_BAI`** | Lập BĐ13 thất bại | Server trả về lỗi khi gọi `CreateBD13Multi` | Bước 3 (3.2) | Báo lỗi lập bản kê |
| **`E44_IMPORT_381_THAT_BAI`** | Nạp bưu gửi lên 3.8.1 lỗi | Bưu gửi bị từ chối khi gọi `SearchManageMailtripByExcel` | Bước 4 (3.8.1) | Báo lỗi import |
| **`E44_CHUYEN_30_THAT_BAI`** | Chuyển về 3.0 thất bại | Server từ chối chuyển (`warehouse_status == "I" \|\| "P"` hoặc lỗi khác) | Bước 4 (3.8.1) | Ghi nhận nguyên nhân cụ thể |
| **`E90_HET_PHIEN`** | Hết phiên đăng nhập | HTTP 401 hoặc redirect về trang Login | Xuyên suốt | Dừng khẩn cấp, yêu cầu đăng nhập lại |

---

## 2. Thông báo Thành công Thực tế từng Bước (Đã kiểm chứng 100%)

- **Bước 1 (Vu hồi 6.2):** Toast/Popup `Cập nhập dữ liệu thành công X/X`.
- **Bước 2 (Giao lại 6.2):** Toast/Popup `Cập nhập dữ liệu thành công.` (Code `00`).
- **Bước 3 (BĐ13 3.2):** Modal xác nhận `Bạn có chắc chắn muốn lập bản kê BD13 cho X bưu gửi không?` ➔ Server trả về `Code: "00"` và popup in BĐ13.
- **Bước 4 (Chuyển 3.0 3.8.1):** Popup thành công: `Cập nhật thành công X/X bưu gửi.` (Code `00`).

