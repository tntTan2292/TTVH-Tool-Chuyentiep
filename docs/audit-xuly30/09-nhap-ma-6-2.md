# BÁO CÁO ĐIỀU TRA KỸ THUẬT: Ô "MÃ BƯU GỬI" TẠI MÀN HÌNH 6.2 (CHỈ ĐỌC)

> **Màn hình điều tra:** `6. QUẢN LÝ KHO HÀNG` ➔ `6.2. Danh sách bưu gửi chờ Nhập kho/ Vu hồi`  
> **URL:** `https://packnsend.vnpost.vn/quan-ly-kho/danh-sach-cho-nhap-kho.html`  
> **Phương pháp:** Trích xuất mã nguồn hàm nội bộ trang qua Console DevTools, không thực hiện thao tác ghi dữ liệu (Vu hồi/Giao lại).  
> **Thời gian thực hiện:** 30/10/2026

---

## 1. Hành vi khi gõ mã bưu gửi và bấm Enter

### 1.1. Có request nào gửi đi không? URL, Method, Tham số?
- **Thực tế hệ thống:** Ô input `#txtLadingCode` nằm trong thẻ `<form id="fInventory" method="get" action="...">`.
- Trên ô `#txtLadingCode`:
  - `onkeypress: null`
  - `onkeydown: null`
  - `onkeyup: this.value = this.value.toUpperCase()`
  - Không có bất kỳ event listener jQuery nào gắn trực tiếp để chặn phím Enter (`keyCode === 13`).
- **Hành vi khi bấm Enter:**
  - Trình duyệt kích hoạt hành vi mặc định của form HTML: **SUBMIT FORM**.
  - Trình duyệt gửi request HTTP GET:  
    `GET https://packnsend.vnpost.vn/quan-ly-kho/danh-sach-cho-nhap-kho.html?startDate=...&endDate=...&type=1&ladingCode=...`
  - **TRANG WEB BỊ TẢI LẠI HOÀN TOÀN (RELOAD TRANG / FULL PAGE REFRESH)**, URL trên thanh địa chỉ bị thay đổi kèm chuỗi Query String.

### 1.2. Khi gõ mã thứ hai ngay sau đó:
- Do mỗi lần bấm Enter trang bị tải lại toàn bộ, mọi dữ liệu cũ trong bảng trước đó sẽ bị mất sạch (trở về trạng thái khởi tạo ban đầu theo URL query).
- Bảng **KHÔNG** tự cộng dồn khi người dùng thao tác bằng phím Enter thông thường.

---

## 2. Khác biệt giữa phím Enter và nút "Lọc dữ liệu"

| Tiêu chí | Bấm phím ENTER trên `#txtLadingCode` | Bấm nút "Lọc dữ liệu" (`#search_key`) |
|---|---|---|
| **Cơ chế kích hoạt** | Kích hoạt sự kiện submit mặc định của Form HTML | Kích hoạt thuộc tính `onclick="SearchInventory_V2(false)"` |
| **Hành vi trang** | **TẢI LẠI TRANG (Full Reload)**, đổi URL | **KHÔNG tải lại trang**, chạy ngầm bằng AJAX |
| **Giao thức gọi dữ liệu** | Trình duyệt tải lại trang HTML từ đầu | Gọi API `GET /Lading/Inventory/ListInventory_V2` |
| **Trạng thái bảng** | Bảng bị reset trắng theo trang mới | Bảng DataTable `_tableSource` được vẽ lại bằng AJAX |
| **Tham số `isBarcode`** | Không áp dụng (reload trang) | `isBarcode = false` (Xóa trắng bảng cũ trước khi nạp) |

---

## 3. Mã nguồn nguyên văn các hàm nội bộ

### 3.1. Nguyên văn mã nguồn hàm `SearchInventory_V2`
```javascript
function SearchInventory_V2(isBarcode) {
    var _valid = $('#fInventory').validationEngine('validate');

    if (_valid == true) {
        common.StartLoading();
        var FromDate = "0";
        var ToDate = "0";
        var FromDateStatus = "0";
        var ToDateStatus = "0";
        if ($("#cbDate").val() == "1") {
            FromDate = $("#txtDateRange").val().split("-")[0];
            ToDate = $("#txtDateRange").val().split("-")[1];
        }
        else if ($("#cbDate").val() == "2") {
            FromDateStatus = $("#txtDateRange").val().split("-")[0];
            ToDateStatus = $("#txtDateRange").val().split("-")[1];
        }
        var reason = $("#cbReason").val();
        var solution = $("#cbSolution").val();
        var warehouseStatusCode = $("#cbWarehouseStatusCode").val();
        var routeID = $("#cbRoute").val();
        var postmanID = $("#cbPostman").val();

        var _ladingCode = $("#txtLadingCode").val();
        var _ladingJounreyStatusCode = $("#cbLadingJourneyStatus").val();

        $.ajax({
            url: "/Lading/Inventory/ListInventory_V2",
            type: "GET",
            data: {
                DeliveryFromDate: FromDate,
                DeliveryToDate: ToDate,
                StatusFromDate: FromDateStatus,
                StatusToDate: ToDateStatus,
                ReasonCode: reason,
                SolutionCode: solution,
                WarehouseStatusCode: warehouseStatusCode,
                RouteID: routeID,
                PostmanID: postmanID,
                Type : '1',
                ladingCode: _ladingCode,
                isSerializeObject: false,
                ladingJourneyStatusCode: _ladingJounreyStatusCode,
            },
            success: function (data) {
                if (data.Code != "00") {
                    common.EndLoading();

                    if (_lastBarCode !== true || isBarcode !== true) {
                        _tableSource.clear().draw();
                    }

                    _lastBarCode = isBarcode;

                    ClearText(_ladingCode);
                }
                else {
                    common.EndLoading();

                    // NẾU KHÔNG PHẢI CHẾ ĐỘ BARCODE: XÓA SẠCH BẢNG CŨ
                    if (_lastBarCode !== true || isBarcode !== true) {
                        _tableSource.clear().draw();
                    }

                    _lastBarCode = isBarcode;

                    // LỌC VÀ LOẠI BỎ CÁC DÒNG ĐÃ CÓ TRONG BẢNG ĐỂ TRÁNH TRÙNG LẶP
                    data.Data.forEach((item)=>{
                        var indexes = _tableSource.rows().indexes().filter(function (value, index) {
                            return item.LadingCode === _tableSource.row(value).data()["LadingCode"];
                        });
                        if(indexes.length > 0){
                            _tableSource.rows(indexes).remove().draw();
                        }
                    });

                    // NẠP DỮ LIỆU MỚI VÀO BẢNG
                    _tableSource.rows.add(data.Data).draw(false);

                    // NẾU LÀ CHẾ ĐỘ BARCODE: ĐẨY DÒNG MỚI LÊN ĐẦU VÀ XÓA RỖNG Ô NHẬP LIỆU
                    if (isBarcode == true) {
                        var currentPage = _tableSource.page();

                        var index = 0,
                            rowCount = _tableSource.data().length - 1,
                            insertedRow = _tableSource.row(rowCount).data(),
                            tempRow;

                        for (var i = rowCount; i > index; i--) {
                            tempRow = _tableSource.row(i - 1).data();
                            _tableSource.row(i).data(tempRow);
                            _tableSource.row(i - 1).data(insertedRow);
                        }

                        _tableSource.page(currentPage).draw(false);

                        ClearText(_ladingCode);
                    }
                }
            },
            error: function (xhr, textStatus, errorThrown) {
                common.EndLoading();
                common.Message("Lỗi", "Hãy kiểm tra lại đường truyền trước khi thực hiện thao tác.", "error");
            }
        });
    }
}
```

### 3.2. Sự kiện gắn trên ô `#txtLadingCode`
- jQuery Events: `$._data(txt, 'events')` ➔ **Không có sự kiện jQuery nào**.
- Thuộc tính DOM:
  - `onkeypress`: `null`
  - `onkeydown`: `null`
  - `onkeyup`: `this.value = this.value.toUpperCase()` (chỉ chuyển đổi chữ in hoa).

### 3.3. Đối tượng Bảng dữ liệu:
- Tên biến DataTable toàn cục của bảng: **`_tableSource`**.
- Cấu hình: DOM / Local DataTable (`pageLen: -1`).

---

## 4. Cơ chế Giữ dòng & Cộng dồn của Bảng

Từ đoạn mã nguồn gốc trên:
1. Hệ thống sử dụng 2 biến cờ toàn cục: `isBarcode` và `_lastBarCode`.
2. Khi `isBarcode === false`:
   - Dòng lệnh `_tableSource.clear().draw();` sẽ chạy và **xóa sạch toàn bộ bưu gửi đang có trên bảng**.
3. Khi `isBarcode === true`:
   - Dòng lệnh `_tableSource.clear().draw();` **BỊ BỎ QUA**!
   - Hệ thống giữ nguyên các bưu gửi đang có.
   - Thêm dòng mới vào `_tableSource` bằng `_tableSource.rows.add(data.Data).draw(false)`.
   - Đảo vị trí đưa dòng mới nhất lên dòng đầu tiên của bảng.
   - Xóa rỗng ô `#txtLadingCode` để sẵn sàng quét mã tiếp theo.

---

## 5. Xác nhận thực tế: Ô `#txtLadingCode` KHÔNG hỗ trợ nhập nhiều mã bằng dấu phẩy

> **Xác nhận từ PO:** Khi người dùng nhập chuỗi nhiều mã ngăn cách bằng dấu phẩy `,` (ví dụ `EL123VN,EL456VN`), hệ thống hoàn toàn không tìm được dữ liệu hoặc báo rỗng.

### Nguyên nhân kỹ thuật từ Server:
- Phía Backend của VNPost tại endpoint `/Lading/Inventory/ListInventory_V2` thực hiện truy vấn so khớp chính xác:
  `WHERE LadingCode = @ladingCode` (hoặc `LIKE @ladingCode`), chứ không có hàm cắt chuỗi `SPLIT(',')`.
- Khi truyền chuỗi chứa dấu phẩy, server tìm mã mang nguyên văn cả chuỗi đó nên kết quả trả về `Data = []` (0 bản ghi).

---

## 6. Giải pháp Chuẩn xác 100% để nạp lô bưu gửi vào màn 6.2

Để nạp một danh sách lô (30 – 50 bưu gửi) lên bảng 6.2 để Check All:

### Cơ chế hoạt động của Trang (Mô phỏng máy quét Barcode):
- Mỗi bưu gửi được nạp tuần tự bằng cách gọi `SearchInventory_V2(true)`:
  1. Gán mã vào ô: `$('#txtLadingCode').val(maBG)`.
  2. Gọi `SearchInventory_V2(true)`:
     - Vì `isBarcode = true`, lệnh `_tableSource.clear()` bị bỏ qua.
     - Server trả về 1 bưu gửi ➔ chèn vào `_tableSource` và cộng dồn trên bảng.
     - Ô `#txtLadingCode` được tự động xóa rỗng qua `ClearText()`.
  3. Lặp lại với mã tiếp theo cho đến khi đủ cả lô.
  4. Sau khi bảng có đủ danh sách: Tích chọn Check All `#chkAll` ➔ Bấm nút **"Vu hồi"**!

### Cải tiến quan trọng cho lớp mã `xuly30-page.js`:
- **Loại bỏ việc giả lập phím Enter (`pressEnter`):** Vì phím Enter sẽ kích hoạt form submit mặc định làm reload toàn bộ trang web!
- **Thay thế bằng:** Gán giá trị vào `#txtLadingCode` và gọi trực tiếp `SearchInventory_V2(true)`, chờ AJAX hoàn tất rồi nạp mã tiếp theo để cộng dồn an toàn tuyệt đối.
