# KỸ THUẬT GỬI DỮ LIỆU VÀ KẾT LUẬN KIẾN TRÚC (MỤC C)

> Phân tích kỹ thuật các Request, Headers, Payload, Serialization và đề xuất phương án thực thi tối ưu cho Extension trong quy trình "Xử lý 3.0".

---

## 1. Chi tiết Kỹ thuật Gửi Dữ liệu từng Bước

### Bước 1: Vu hồi (Module 6.2)
- **Hành động:** Vu hồi danh sách bưu gửi đang chờ.
- **Phương thức & URL:** `POST /Lading/Inventory/Recovered`
- **Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`
- **Xác thực:** Kế thừa Cookie phiên ASP.NET (không sử dụng Anti-Forgery Token).
- **Payload:**
  ```javascript
  {
    Id: [
      { IdWarehouse: -1, IdLadingToPostman: "3354025042" }
    ]
  }
  ```
  *(Được serialize theo chuẩn jQuery: `Id[0][IdWarehouse]=-1&Id[0][IdLadingToPostman]=3354025042`)*.
- **Phản hồi từ Server:**
  ```json
  {
    "Code": "00",
    "Message": "Cập nhập dữ liệu thành công 1/1"
  }
  ```

### Bước 2: Giao lại bưu gửi vu hồi (Module 6.2)
- **Hành động:** Giao lại bưu gửi đã vu hồi về tuyến bưu tá.
- **Phương thức & URL:** `POST /Lading/Inventory/DivideRecovered`
- **Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`
- **Payload:**
  ```javascript
  {
    data: [
      {
        LadingCode: "EL533240444VN",
        LTPId: 3354025042,     // WarehouseId lấy từ bảng
        WarehouseId: 8189812   // Id lấy từ bảng
      }
    ],
    keepRoute: 1
  }
  ```
- **Phản hồi từ Server:**
  ```json
  {
    "Code": "00",
    "Message": "Cập nhập dữ liệu thành công."
  }
  ```

### Bước 3: Lập bản kê BĐ13 (Module 3.2)
- **Hành động:** Tạo bản kê BĐ13 cho danh sách bưu gửi của tuyến "Chuyển tiếp".
- **Phương thức & URL:** `POST /Lading/Home/CreateBD13Multi`
- **Content-Type:** `application/x-www-form-urlencoded; charset=UTF-8`
- **Payload:**
  ```javascript
  {
    fromDate: "30/10/2026",
    toDate: "30/10/2026",
    jsonValue: JSON.stringify({
      listLadingId: [
        {
          RouteCode: "53547017",
          PostmanCode: "53B037",
          RejectId: "..." // Trích xuất từ tableLadingDivided row data
        }
      ]
    })
  }
  ```
- **Phản hồi từ Server:**
  ```json
  {
    "Code": "00",
    "Message": "Lập bản kê thành công",
    "Data": "BD13_CODE_SAMPLE"
  }
  ```
- **Xử lý popup in:** Sau khi nhận response `Code == "00"`, hệ thống gọi hàm `PrintBD13()` mở modal in. Thao tác an toàn: chỉ cần gọi `$('#confirmQuestion').modal('hide')` hoặc bấm nút Hủy.

### Bước 4: Chuyển bưu gửi về 3.0 (Module 3.8.1)
- **Cơ chế Import & Vẽ bảng (Xác thực từ mã nguồn thật):**
  - Trang sử dụng biến cờ toàn cục `_isExcell = true;`
  - Đọc file Excel thành mảng: `XL_row_object = [ { "MaVanDon": "EL533085492VN" }, ... ]`.
  - Gửi request nạp bảng:
    - **URL:** `POST /Lading/Home/SearchManageMailtripByExcel`
    - **Payload:** `{ data: XL_row_object, routeCode: _routeCode, postmanCode: _postmanCode }`
    - **Vẽ bảng DataTables:** Sau khi response trả về `{ Code: "00", Data: [...] }`, trang gọi:
      ```javascript
      _isExcell = true;
      table.clear();
      table.rows.add(data.Data).draw(false);
      ```
      *(Biến `table` là đối tượng DataTable toàn cục của trang 3.8.1)*.
- **Hành động Thực thi chuyển bưu gửi:**
  - Check All trên bảng: `#chkAll`
  - Bấm nút **"Chuyển bưu gửi"** ➔ Mở modal `#add_mail_trip`.
  - Bấm nút **"Chuyển … bưu gửi"** ➔ Gọi endpoint: `POST /Lading/LadingDivided/AcceptAddBackMailTripMulti`.

---

## 2. Kết luận Đề xuất Kiến trúc cho Extension

1. **Phương thức tương tác:**
   - Kết hợp linh hoạt: **Điều khiển DOM (Automation)** cho các thao tác chuyển trang và mở modal, kết hợp **gọi trực tiếp hàm nội bộ của trang (`world: MAIN`)** bằng JavaScript injection.
   - Tại sao?
     - Tại 6.2: Gọi trực tiếp các hàm `SearchInventory_V2`, `Recovered()`, `RefreshRecovered()` đảm bảo 100% đồng bộ phiên và logic kiểm tra trạng thái của trang.
     - Tại 3.2: Tự động chọn `#Route`, gọi `SearchBD13ForPostman()`, sau đó gọi `CreateBd13()`.
     - Tại 3.8.1: Không cần upload file nhị phân phức tạp! Extension chỉ cần gọi `POST /Lading/Home/SearchManageMailtripByExcel` với danh sách JSON mã bưu gửi, sau đó gọi `AcceptAddBackMailTripMulti()`.
2. **Quản lý phiên đăng nhập:**
   - Mọi request đều dùng Session Cookie trình duyệt. Nếu gặp response HTTP 401 hoặc redirect về trang Login, Extension lập tức dừng ngay tiến trình và cảnh báo hết phiên.
3. **Kích thước lô an toàn (Batch Size):**
   - Đề xuất kích thước mỗi lô: **30 – 50 bưu gửi/lần chạy**.
   - Nghỉ an toàn (Throttling Delay): **1.000ms – 1.500ms** giữa các bước chuyển màn hình.

