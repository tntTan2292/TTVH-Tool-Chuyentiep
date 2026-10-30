# TÀI LIỆU KIỂM TOÁN: LUỒNG THAO TÁC 4 BƯỚC "XỬ LÝ 3.0" (MỤC A)

> **Hệ thống:** Pack & Send - Tổng công ty Bưu điện Việt Nam (VNPost)  
> **Chức năng:** Tự động đưa bưu gửi đã chuyển tiếp thành công quay về xử lý tại 3.0  
> **Phạm vi kiểm toán:** Module 6.2, Module 3.2, Module 3.8.1

---

## Sơ đồ Tổng quan 4 Bước Nghiệp vụ

```
[Danh sách mã BG chuyển tiếp thành công từ file kết quả 3.9]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Bước 1: Vu hồi tại Module 6.2                               │
│ URL: /quan-ly-kho/danh-sach-cho-nhap-kho.html               │
│ - Điền mã vào #txtLadingCode ➔ Lọc (#search_key)            │
│ - Check All (#chkAll) ➔ Bấm "Vu hồi" ➔ Popup "Đồng ý"       │
│ - Trạng thái bưu gửi chuyển sang StatusCode = 'R'           │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Bước 2: Giao lại bưu gửi vu hồi (Module 6.2)                │
│ - Check All (#chkAll) ➔ Bấm "Giao lại bưu gửi vu hồi"       │
│ - Modal: chọn radio "Giữ tuyến bưu tá" (val = 1)            │
│ - Bấm "Giao lại" (DivideRecovered)                          │
│ - Bưu gửi chuyển sang tuyến "Chuyển tiếp"                   │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Bước 3: Lập bản kê BĐ13 tại Module 3.2                     │
│ URL: /lap-ban-ke-bd13.html                                  │
│ - Tuyến phát: chọn option chứa chuỗi "Chuyển tiếp"          │
│ - Bưu tá: mặc định "--- Tất cả ---" ➔ Bấm "Lọc dữ liệu"     │
│ - Cột "SL bưu gửi chưa lập BD13": bấm vào số lượng          │
│ - Modal Danh sách bưu gửi: Check All (#chkAllDetail)        │
│ - Bấm "Lập bản kê BĐ13" ➔ Popup in BĐ13 bấm "Hủy" ➔ F5       │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Bước 4: Chuyển BG về 3.0 tại Module 3.8.1                   │
│ URL: /thêm-mới-vu-hồi-chuyến-thư.html                        │
│ - Nạp danh sách BG vào file Excel mẫu (cột MaVanDon)        │
│ - Bấm "Import Excel" (#btnImportExcel)                      │
│ - Bảng kết quả: Check All (#chkAll)                         │
│ - Bấm "Chuyển bưu gửi" ➔ Modal xác nhận                     │
│ - Bấm "Chuyển … Bưu gửi" ➔ Hoàn tất quy trình              │
└─────────────────────────────────────────────────────────────┘
```

---

## Chi tiết từng bước kiểm toán

### Bước 1: Vu hồi (Module 6.2)
- **Menu truy cập:** `6. QUẢN LÝ KHO HÀNG` ➔ `6.2. Danh sách bưu gửi chờ Nhập kho/ Vu hồi`.
- **URL:** `https://packnsend.vnpost.vn/quan-ly-kho/danh-sach-cho-nhap-kho.html`.
- **Thao tác:**
  1. Nhập danh sách mã bưu gửi vào ô `#txtLadingCode`.
  2. Bấm nút `#search_key` ("Lọc dữ liệu", gọi `SearchInventory_V2(false)`).
  3. Bảng dữ liệu `#tbl_inventory` hiển thị (không phân trang, `pageLen: -1`).
  4. Tích chọn Check All `#chkAll` hoặc từng checkbox `#ck-[Id]`.
  5. Bấm nút **Vu hồi** (nút DataTables class `dt-button customButton`).
  6. Modal xác nhận `#confirmQuestion` hiện lên: *"Bạn chắc chắn muốn vu hồi X bưu gửi?"*. Bấm **Đồng ý** (`.confirm`).
- **Kết quả:** Hệ thống gọi `POST /Lading/Inventory/Recovered` và trả về thông báo: `Cập nhập dữ liệu thành công X/X`. Trạng thái bưu gửi chuyển thành `StatusCode = "R"`.

### Bước 2: Giao lại bưu gửi vu hồi (Module 6.2)
- **Vị trí:** Vẫn tại Module 6.2 sau khi vu hồi xong.
- **Thao tác:**
  1. Kiểm tra lại danh sách bưu gửi ở trạng thái `StatusCode == "R"`.
  2. Tích chọn Check All `#chkAll`.
  3. Bấm nút **Giao lại bưu gửi vu hồi** ➔ Modal `#modal_refresh_recovered` hiện ra.
  4. Đảm bảo radio `input[name="ckRefreshRecoveredKeepRoute"][value="1"]` ("Giữ tuyến bưu tá") đang được chọn.
  5. Bấm nút **Giao lại** (gọi hàm `RefreshRecovered()`).
- **Kết quả:** Hệ thống gọi `POST /Lading/Inventory/DivideRecovered`. Bưu gửi được giải phóng khỏi kho, tự động phân về tuyến "Chuyển tiếp" và biến mất khỏi bảng chờ 6.2.

### Bước 3: Lập bản kê BĐ13 (Module 3.2)
- **Menu truy cập:** `3. PHÁT` ➔ `3.2. Lập bản kê BD13`.
- **URL:** `https://packnsend.vnpost.vn/lap-ban-ke-bd13.html`.
- **Thao tác:**
  1. Dropdown `#Route`: Chọn option có tên chứa chữ **"Chuyển tiếp"** (mỗi bưu cục chỉ có duy nhất 1 tuyến này, ví dụ: `53547017 - 535470 - Chuyển tiếp`).
  2. Dropdown `#cbPostman`: Giữ nguyên giá trị mặc định `""` ("--- Tất cả ---").
  3. Bấm nút `#search_key` ("Lọc dữ liệu", gọi `SearchBD13ForPostman()`).
  4. Bảng tổng hợp hiện ra. Tại cột 6 (**"SL bưu gửi chưa lập BD13"**): đối chiếu số lượng bưu gửi phải khớp chính xác số lượng vừa giao lại ở Bước 2.
  5. Click vào con số đó để kích hoạt hàm `GetDetail(routeCode, postmanCode, rowIndex)` mở modal `#modal_lading_divided_detail` ("Danh sách bưu gửi").
  6. Trong modal: Tích chọn Check All `#chkAllDetail`.
  7. Bấm nút **Lập bản kê BĐ13** (gọi `CreateBd13()`).
  8. Popup xác nhận in `#confirmQuestion` ("Xác nhận dịch vụ in BD13"): Bấm nút **HỦY** (`.btn-danger[data-dismiss="modal"]`).
- **Kết quả:** Bản kê BĐ13 đã được lập thành công qua endpoint `POST /Lading/Home/CreateBD13Multi`. Cột "chưa lập BĐ13" giảm về 0 sau khi tải lại trang.

### Bước 4: Chuyển bưu gửi về 3.0 (Module 3.8.1)
- **Menu truy cập:** `3. PHÁT` ➔ `3.8. Quản lý BG chuyển tuyến` ➔ `3.8.1. Tạo yêu cầu chuyển bưu gửi trên PNS`.
- **URL:** `https://packnsend.vnpost.vn/thêm-mới-vu-hồi-chuyến-thư.html`.
- **Thao tác:**
  1. Chuẩn bị file Excel: chỉ gồm 1 cột duy nhất với tiêu đề tại A1 là `MaVanDon`, các dòng dưới là danh sách bưu gửi.
  2. Bấm nút **Import Excel** để đưa dữ liệu vào input `#btnImportExcel`. Client đọc nội dung bằng thư viện SheetJS rồi POST lên `POST /Lading/Home/SearchManageMailtripByExcel`.
  3. Dữ liệu nạp vào bảng `#tblcontentSearchDeliveryMulti`.
  4. Tích chọn Check All `#chkAll`.
  5. Bấm nút **Chuyển bưu gửi** (gọi hàm `AddBackMailTrip()`).
  6. Modal xác nhận `#add_mail_trip` mở ra, hiển thị đúng số lượng bưu gửi: *"Chuyển X bưu gửi"*.
  7. Bấm nút **"Chuyển … bưu gửi"** (gọi hàm `AcceptAddBackMailTripMulti()`).
- **Kết quả:** Hệ thống gọi `POST /Lading/LadingDivided/AcceptAddBackMailTripMulti` và thông báo hoàn tất chuyển bưu gửi về xử lý 3.0.

