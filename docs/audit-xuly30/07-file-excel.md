# THIẾT KẾ VÀ PHÂN TÍCH FILE EXCEL (MỤC G)

---

## 1. File Excel mẫu của Module 3.8.1 (`mau-import-3.8.1.xlsx`)
- **Nguồn gốc:** Tải trực tiếp từ hệ thống VNPost Pack & Send qua endpoint `/Lading/LadingDivided/DownLoadFileSearchForLadingDividedRouteByExcel`.
- **Định dạng file:** OpenXML Spreadsheet (.xlsx).
- **Tên sheet:** `Sheet1`.
- **Cấu trúc cột:** Duy nhất **1 cột**:
  - Dòng 1, Cột A (ô `A1`): **`MaVanDon`**
  - Dòng 2 trở đi: Danh sách các mã bưu gửi.
- **Quy tắc cho Extension:** Khi sinh file hoặc gửi dữ liệu lên 3.8.1, Extension chỉ cần truyền mảng đối tượng:
  ```json
  [
    { "MaVanDon": "EL533240444VN" },
    { "MaVanDon": "EM123456789VN" }
  ]
  ```
  qua endpoint `POST /Lading/Home/SearchManageMailtripByExcel`.

---

## 2. File đầu vào và đầu ra của chức năng "Xử lý 3.0"

### File đầu vào:
- Người dùng nạp trực tiếp **file Excel kết quả từ chức năng Chuyển tiếp** trước đó (không cần sửa đổi).
- Extension tự động lọc các dòng có cột `KET_QUA` = `"Thành công"` để lấy danh sách mã bưu gửi đưa vào quy trình Xử lý 3.0.

### File đầu ra (Báo cáo kết quả Xử lý 3.0):
- Các cột được xuất ra:
  1. `MA_BG`: Mã bưu gửi.
  2. `KQ_VU_HOI`: Kết quả Bước 1 (Thành công / Thất bại).
  3. `KQ_GIAO_LAI`: Kết quả Bước 2 (Thành công / Thất bại).
  4. `KQ_BD13`: Kết quả Bước 3 (Thành công / Thất bại).
  5. `KQ_CHUYEN_30`: Kết quả Bước 4 (Thành công / Thất bại).
  6. `KET_QUA_CHUNG`: Thành công (nếu qua đủ 4 bước) / Thất bại.
  7. `MA_LOI`: Mã lỗi chuẩn hóa (ví dụ `E41_VU_HOI_THAT_BAI`).
  8. `NGUYEN_NHAN`: Thông báo nguyên văn của hệ thống.
  9. `THOI_GIAN_XU_LY`: Thời điểm xử lý.

