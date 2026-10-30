# TÀI LIỆU KIỂM TOÁN: BẢNG DANH SÁCH TRƯỜNG TAB CHUYỂN TIẾP (MỤC B)

> **Form đối tượng:** Modal `#md_update_item_forward` / Form `#fUpdateItemForward`  
> **Nguồn nạp:** `GET /Lading/LadingJourney/GetByLadingCode`  
> **Thư viện validate client:** jQuery ValidationEngine (`#fUpdateItemForward.validationEngine('validate')`)  

---

## 1. Bảng đặc tả chi tiết mọi trường trên Form Chuyển tiếp

| STT | Nhãn hiển thị | Selector ổn định | Loại control | Bắt buộc? | Định dạng / Độ dài tối đa / Regex | Giá trị mặc định | Phụ thuộc trường khác | Ghi chú |
|:---:|---|---|:---:|:---:|---|---|---|---|
| 1 | Mã vận đơn (*) | `input#LadingCode` | `input[type="text"]` | Bắt buộc (Readonly) | Chuỗi mã bưu gửi, 13 ký tự (VD: `CH371143235VN`) | Trích xuất từ bưu gửi gốc | Không | Bị khóa (`disabled`), chỉ đọc |
| 2 | Bưu cục phát (*) | `input#PosName` | `input[type="text"]` | Bắt buộc (Readonly) | Text tên bưu cục | Tên bưu cục hiện tại | Không | Bị khóa (`disabled`), chỉ đọc |
| 3 | Tuyến phát (*) | `input#RouteName` | `input[type="text"]` | Bắt buộc (Readonly) | Text (VD: `533140 - Chuyển tiếp`) | Trích xuất từ bưu gửi gốc | Không | Bị khóa (`disabled`), chỉ đọc |
| 4 | Bưu tá phát (*) | `input#PostManName` | `input[type="text"]` | Bắt buộc (Readonly) | Text (VD: `53A152 - MAI QUANG VINH`) | Bưu tá đang giữ BG | Không | Bị khóa (`disabled`), chỉ đọc |
| 5 | Lý do (*) | `input#ReasonName` | `input[type="text"]` | Bắt buộc (Readonly) | Text (VD: `21. Bưu gửi lạc hướng`) | Mã lý do gốc (`ReasonCode`) | Không | Bị khóa (`disabled`), chỉ đọc |
| 6 | Hướng xử lí (*) | `input#SolutionName` | `input[type="text"]` | Bắt buộc (Readonly) | Text (VD: `3.Chuyển tiếp sang địa chỉ mới`) | Mã hướng xử lý (`SolutionCode`) | Không | Bị khóa (`disabled`), chỉ đọc |
| 7 | Họ tên người nhận (*) | `input#ReceiverNameReturn` | `input[type="text"]` | **BẮT BUỘC** (`validate[required]`) | Chuỗi ký tự tự do, tối đa 250 ký tự | Trống | Không | Người dùng/Extension phải nhập. Lớp CSS: `form-control validate[required]` |
| 8 | Địa chỉ người nhận (*) | `input#ReceiverAddressReturn` | `input[type="text"]` | **BẮT BUỘC** (`validate[required]`) | Chuỗi địa chỉ chi tiết | Trống | Không | Người dùng/Extension phải nhập. Lớp CSS: `form-control validate[required]` |
| 9 | Điện thoại (*) | `input#NextPhone` | `input[type="text"]` | **BẮT BUỘC** (`validate[required]`) | Số điện thoại VN (10 số, bắt đầu số 0) | Trống | Không | Kiểm tra hợp lệ bằng regex thư viện validationEngine |
| 10 | Email | `input#NextEmail` | `input[type="text"]` | Không (Tùy chọn) | Định dạng email chuẩn: `^[\w.-]+@[\w.-]+\.\w+$` | Trống | Không | Nếu nhập sai định dạng sẽ báo lỗi |
| 11 | Ngày chuyển (*) | `input#ReturnDate` | `input[type="text"]` | Bắt buộc (Readonly) | `dd/MM/yyyy HH:mm:ss` (VD: `29/10/2026 08:07:06`) | Thời điểm mở modal | Không | Bị khóa (`disabled`). Hệ thống tự sinh |
| 12 | Bưu cục khác | `input[name="ckAddressReturnType"][value="2"]` | `input[type="radio"]` | Bắt buộc chọn 1 trong 2 | Giá trị `"2"` | Mặc định được chọn (`checked`) | Điều khiển `txtOtherPostOffice` | Khi chọn, kích hoạt ô `txtOtherPostOffice`, khóa `cbProvince` và `cbWard` |
| 13 | Bưu cục chuyển đến | `input#txtOtherPostOffice` | `input[type="text"]` | **BẮT BUỘC** khi chọn Radio 2 | Mã hoặc tên bưu cục đích | Trống | Phụ thuộc Radio 2 (`ckAddressReturnType == 2`) | Khi submit với Radio 2, JS động thêm `validate[required]` |
| 14 | Địa chỉ | `input[name="ckAddressReturnType"][value="3"]` | `input[type="radio"]` | Bắt buộc chọn 1 trong 2 | Giá trị `"3"` | Không chọn ban đầu | Điều khiển `cbProvince`, `cbWard` | Khi chọn, mở khóa `cbProvince` & `cbWard`, khóa `txtOtherPostOffice` |
| 15 | Tỉnh/Thành chuyển đến | `select#cbProvince` | `select` | **BẮT BUỘC** khi chọn Radio 3 | Mã số tỉnh (Ví dụ: `53` - Huế, `10` - Hà Nội) | `""` (`--- Tỉnh ---`) | Phụ thuộc Radio 3 (`ckAddressReturnType == 3`) | Gồm 34 tỉnh/thành. Khi change gọi `ProvinceChange(this.value)` |
| 16 | Phường/Xã chuyển đến | `select#cbWard` | `select` | **BẮT BUỘC** khi chọn Radio 3 | Mã số phường/xã | `""` (`---Phường, xã---`) | Phụ thuộc `cbProvince` | Nạp động qua API `GET /Order/Home/GetWard?ProvinceId=...` |
| 17 | Ghi chú | `textarea#NoteReturn` | `textarea` | Không (Tùy chọn) | Chuỗi văn bản tự do | Trống | Không | Ghi chú thêm lý do hoặc hướng dẫn phát |
| 18 | Nút In BĐ30 | `button#printBD30ItemForward` | `button` | Không | N/A | N/A | Không | In ấn phẩm BĐ30 |
| 19 | Nút Cập nhật | `button.btn-primary:not(#printBD30ItemForward)` | `button` | Thao tác chính | N/A | N/A | Không | Gọi hàm `UpdateItemForward()`. Submit dữ liệu lên server |
| 20 | Nút Hủy | `button.btn-default[data-dismiss="modal"]` | `button` | Đóng modal | N/A | N/A | Không | Hủy thao tác và đóng popup |

---

## 2. Chi tiết danh mục Tỉnh / Thành phố (`cbProvince`)

Hệ thống Pack & Send cấu hình danh sách 34 đơn vị hành chính cấp tỉnh được định nghĩa sẵn trong `select#cbProvince`:

| STT | Mã Tỉnh (`Value`) | Tên hiển thị (`Text`) | STT | Mã Tỉnh (`Value`) | Tên hiển thị (`Text`) |
|:---:|:---:|---|:---:|:---:|---|
| 1 | `88` | An Giang | 18 | `46` | Nghệ An |
| 2 | `22` | Bắc Ninh | 19 | `43` | Ninh Bình |
| 3 | `27` | Cao Bằng | 20 | `29` | Phú Thọ |
| 4 | `97` | Cà Mau | 21 | `57` | Quảng Ngãi |
| 5 | `90` | Cần Thơ | 22 | `20` | Quảng Ninh |
| 6 | `60` | Gia Lai | 23 | `52` | Quảng Trị |
| 7 | `53` | Huế | 24 | `36` | Sơn La |
| 8 | `10` | Hà Nội | 25 | `44` | Thanh Hóa |
| 9 | `48` | Hà Tĩnh | 26 | `25` | Thái Nguyên |
| 10 | `16` | Hưng Yên | 27 | `30` | Tuyên Quang |
| 11 | `18` | Hải Phòng | 28 | `84` | Tây Ninh |
| 12 | `70` | Hồ Chí Minh | 29 | `89` | Vĩnh Long |
| 13 | `65` | Khánh Hòa | 30 | `38` | Điện Biên |
| 14 | `39` | Lai Châu | 31 | `55` | Đà Nẵng |
| 15 | `33` | Lào Cai | 32 | `63` | Đắk Lắk |
| 16 | `67` | Lâm Đồng | 33 | `81` | Đồng Nai |
| 17 | `24` | Lạng Sơn | 34 | `87` | Đồng Tháp |

---

## 3. Cơ chế tải động Phường / Xã (`cbWard`)

- Khi người dùng thay đổi giá trị tại `select#cbProvince`, sự kiện `onchange="ProvinceChange(this.value)"` được kích hoạt.
- Hàm gọi AJAX:
  - **URL:** `/Order/Home/GetWard`
  - **Method:** `GET`
  - **Tham số:** `{ ProvinceId: provinceId }`
  - **Định dạng dữ liệu trả về:** Mảng JSON các đối tượng:
    ```json
    [
      { "Disabled": false, "Group": null, "Selected": false, "Text": "--- Phường, xã ---", "Value": "" },
      { "Disabled": false, "Group": null, "Selected": false, "Text": "A Lưới 1", "Value": "53764" },
      { "Disabled": false, "Group": null, "Selected": false, "Text": "A Lưới 2", "Value": "53766" }
    ]
    ```
- Khi hoàn tất, các tùy chọn `<option value="Value">Text</option>` được gán lại vào `#cbWard`.
- **Ràng buộc lưu trữ khi chọn Địa chỉ:** 
  Hệ thống ghép giá trị tỉnh và phường/xã theo công thức:
  ```javascript
  _newModel.AddressReturn = $('#cbProvince').val() + ";" + $('#cbWard').val();
  ```
