# BẢNG ĐIỀU KHIỂN VÀ POPUP (MỤC B) - QUY TRÌNH XỬ LÝ 3.0

> Thống kê toàn bộ điều khiển tương tác (ô lọc, dropdown, checkbox, nút bấm, modal/popup) qua 4 bước.

---

| Bước | Nhãn hiển thị | Selector ổn định | Loại control | Hành vi khi thao tác | Ghi chú |
|:---:|---|---|---|---|---|
| **1 & 2** | Mã bưu gửi | `#txtLadingCode` | `input[type="text"]` | Nhập mã bưu gửi để tìm kiếm | Cho phép tìm 1 hoặc danh sách |
| **1 & 2** | Lọc dữ liệu | `#search_key` | `button` | Gọi `SearchInventory_V2(false)` | Lấy dữ liệu qua `GET /Lading/Inventory/ListInventory_V2` |
| **1 & 2** | Check All bảng 6.2 | `#chkAll` | `input[type="checkbox"]` | Tích chọn/bỏ chọn tất cả dòng | Toàn bộ dòng trên bảng (`pageLen: -1`) |
| **1 & 2** | Checkbox từng dòng 6.2 | `#ck-` + `Id` | `input[type="checkbox"]` | Chọn bưu gửi riêng lẻ | `Id` là định danh kho của bưu gửi |
| **1** | Nút Vu hồi | `button:contains("Vu hồi")` | `button.dt-button` | Mở popup `#confirmQuestion` | Kiểm tra ít nhất 1 dòng được chọn |
| **1** | Popup xác nhận Vu hồi | `#confirmQuestion` | Bootstrap Modal | Hiển thị: "Bạn chắc chắn muốn vu hồi X bưu gửi?" | Nút xác nhận có class `.confirm` |
| **1** | Nút Đồng ý (Vu hồi) | `#confirmQuestion .confirm` | `button` | Đóng modal, gọi `POST /Lading/Inventory/Recovered` | Payload: `{ Id: [{ IdWarehouse, IdLadingToPostman }] }` |
| **2** | Nút Giao lại bưu gửi vu hồi | `button:contains("Giao lại bưu gửi vu hồi")` | `button.dt-button` | Gọi `RefreshRecoveredView()`, mở modal `#modal_refresh_recovered` | Bắt buộc các BG đã chọn có `StatusCode == 'R'` |
| **2** | Modal Giao lại | `#modal_refresh_recovered` | Bootstrap Modal | Chứa các tùy chọn giao lại | Tiêu đề: "Giao lại bưu gửi vu hồi" |
| **2** | Radio Giữ tuyến bưu tá | `input[name="ckRefreshRecoveredKeepRoute"][value="1"]` | `input[type="radio"]` | Chọn chế độ giữ nguyên tuyến | Mặc định đã được chọn `checked: true` |
| **2** | Nút Giao lại (trong modal) | `#modal_refresh_recovered button:contains("Giao lại")` | `button` | Gọi `RefreshRecovered()` ➔ `POST /Lading/Inventory/DivideRecovered` | Payload: `{ data, keepRoute: 1 }` |
| **3** | Dropdown Tuyến phát | `#Route` | `select` | Chọn tuyến phát | Tìm option có text chứa `"Chuyển tiếp"` |
| **3** | Dropdown Bưu tá | `#cbPostman` | `select` | Chọn bưu tá | Để mặc định value `""` ("--- Tất cả ---") |
| **3** | Nút Lọc dữ liệu 3.2 | `#search_key` | `button` | Gọi `SearchBD13ForPostman()` | Nạp bảng HTML vào `#contentLading` |
| **3** | Cột "SL bưu gửi chưa lập BD13" | `#contentLading tbody tr td:nth-child(7) a` (cột thứ 7, tìm theo `th:contains("chưa lập")`) | `a[onclick*="GetDetail"]` | Gọi `GetDetail(...)`, nạp modal `#modal_lading_divided_detail` | Tìm dòng có số lượng > 0 (khác '-') |
| **3** | Modal Danh sách bưu gửi | `#modal_lading_divided_detail` | Bootstrap Modal | Hiển thị danh sách bưu gửi trong tuyến | Tiêu đề: "Danh sách bưu gửi" |
| **3** | Check All chi tiết BĐ13 | `#chkAllDetail` | `input[type="checkbox"]` | Tích chọn tất cả bưu gửi trong modal | Selector chuẩn trong HTML modal |
| **3** | Nút Lập bản kê BĐ13 | `#btnCreateBD13` hoặc nút gọi `CreateBd13()` | `button` | Mở popup `#confirmCancelOrder` ➔ gọi `POST /Lading/Home/CreateBD13Multi` | Payload chứa danh sách bưu gửi |
| **3** | Popup in BĐ13 | `#confirmQuestion` | Bootstrap Modal | Tiêu đề: "Xác nhận dịch vụ in BD13" | Nút Hủy: `.btn-danger[data-dismiss="modal"]` |
| **4** | Nút Tải mẫu file | `button:contains("Tải mẫu file")` | `button` | Gọi `DownloadFileExcel()` | Link: `/Lading/LadingDivided/DownLoadFileSearchForLadingDividedRouteByExcel` |
| **4** | Nút Import Excel | `button:contains("Import Excel")` | `button` | Kích hoạt click vào `#btnImportExcel` | Đọc file bằng SheetJS |
| **4** | Input file ẩn | `#btnImportExcel` | `input[type="file"]` | Nhận file Excel và kích hoạt event `change` | Đọc Sheet1, cột `MaVanDon` |
| **4** | Check All bảng 3.8.1 | `#chkAll` | `input[type="checkbox"]` | Chọn tất cả bưu gửi sau khi import | Bảng `#tblcontentSearchDeliveryMulti` |
| **4** | Nút Chuyển bưu gửi | `button:contains("Chuyển bưu gửi")` | `button.dt-button` | Gọi `AddBackMailTrip()`, nạp modal `#add_mail_trip` | Kiểm tra `warehouse_status != 'I' && != 'P'` |
| **4** | Modal Chuyển bưu gửi | `#add_mail_trip` | Bootstrap Modal | Tiêu đề: "Chuyển X bưu gửi" | Chứa dropdown bưu cục nhận |
| **4** | Nút "Chuyển … bưu gửi" | `#add_mail_trip button[onclick="AcceptAddBackMailTripMulti()"]` | `button` | Gọi `AcceptAddBackMailTripMulti()` | Thực thi chuyển bưu gửi về 3.0 |

