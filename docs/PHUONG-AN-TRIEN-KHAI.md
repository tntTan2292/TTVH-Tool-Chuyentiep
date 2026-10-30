# PHƯƠNG ÁN TRIỂN KHAI — CHROME EXTENSION CHUYỂN TIẾP BƯU GỬI HÀNG LOẠT

> Trạng thái (29/10/2026): PO đã trả lời 6 quyết định (mục 10). Đã có code lõi, giao diện và bộ thực thi. Chạy thử không lưu 5/5 đạt; **chạy thật 1 bưu gửi thành công** (server nhận mã bưu cục 6 số, tức G4 đã rõ cho trường hợp nhập mã). Tra cứu bưu gửi phải đi qua `Lading.GetLading` của chính trang. Còn lại: lưu/tiếp tục tiến độ trong giao diện, file Excel mẫu bản 2, hướng dẫn sử dụng, chạy pilot.
> Căn cứ: hồ sơ audit `docs/audit/` (Antigravity lập ngày 29/10/2026), đã được rà soát lại ở mục 2.
> Hệ thống: VNPost Pack & Send, module 3.9 Quản lý vận đơn.

---

## 1. Mục tiêu và phạm vi

**Mục tiêu:** người dùng tự đăng nhập → mở extension → nạp file Excel → extension tự chuyển tiếp từng bưu gửi (BG) → báo cáo chính xác **thành công X / thất bại Y, kèm nguyên nhân từng BG**.

| Trong phạm vi | Ngoài phạm vi (bản 1) |
|---|---|
| Nhập thông tin chuyển tiếp cho BG **đã ở trạng thái C39** | Tự chuyển BG sang C39 (chờ PO quyết, câu hỏi Q1) |
| Đọc Excel, kiểm tra trước khi chạy, chạy tuần tự có tạm dừng/dừng/tiếp tục | Chạy song song nhiều BG |
| Xuất file kết quả Excel | Đăng nhập hộ, vượt captcha, lưu mật khẩu |
| Chạy trên Chrome/Edge (Manifest V3) | In BĐ30, gửi SMS, tạo ticket |

---

## 2. Rà soát hồ sơ audit

**Điểm tốt:** có mã nguồn thật của `GetUpdateItemForward` / `UpdateItemForward` / `ProvinceChange`, xác định được endpoint, payload `{ value: _newModel }`, không có CSRF token, phản hồi `Code "00"`, phân biệt hai loại chuyển tiếp (Bưu cục = 2, Địa chỉ = 3). File Excel mẫu mở được, cột Text (`@`) đúng, có dropdown cho loại chuyển tiếp và tỉnh.

**Lỗ hổng cần xác minh trước khi code** (xếp theo mức nguy hiểm):

| # | Lỗ hổng | Vì sao quan trọng | Cách xác minh |
|---|---|---|---|
| G1 | Audit đề xuất kiểm tra C39 bằng `_newModel.StatusCode`, nhưng `GetByLadingCode` **nhận `statusCode` do client truyền vào**. Nếu server chỉ trả lại giá trị đó thì kiểm tra này vô nghĩa và BG sai trạng thái vẫn bị POST. | Có thể ghi sai vào BG không đủ điều kiện | Gọi `GetByLadingCode` với một BG **không** ở C39 (chỉ GET) và xem `StatusCode` trả về. Cách chắc hơn: kiểm tra trạng thái từ kết quả `POST /Lading/Home/GetLading` (nơi hệ thống tự quyết định hiện nút) |
| G2 | `GetByLadingCode` cần `receiverName`, `receiverAddress` của BG hiện tại, nhưng Excel không có hai giá trị này. Chưa biết server có bắt buộc hay không. Payload của `GetLading` cũng **chưa được ghi lại**. | Không gọi được bước 1 nếu thiếu | Ghi lại request/response `GetLading`; thử `GetByLadingCode` với hai tham số rỗng |
| G3 | Cách `$.ajax` tuần tự hóa `{ value: _newModel }` (khóa dạng `value[Id]=…`, giá trị null, ngày tháng) chưa được ghi. Model đầy đủ bị cắt bằng `...`. Dùng `fetch` tự dựng body rất dễ lệch. | Server từ chối hoặc ghi thiếu trường | Chạy trong ngữ cảnh trang và dùng chính `$.ajax`/`$.param` của site (xem mục 4); lưu một bản HAR POST thật đã làm sạch để đối chiếu |
| G4 | Ô "Bưu cục chuyển đến" là text tự do. Chưa biết server nhận **mã** (6 số) hay **tên**, có kiểm tra tồn tại không. | Ảnh hưởng thiết kế cột Excel và mã lỗi | Thử trên BG test: một lần nhập mã, một lần nhập tên |
| G5 | Mã Phường/Xã là số 5 chữ số, nạp động theo tỉnh; sheet `DanhMuc` chỉ có tỉnh, **không có xã**. Người dùng không thể tự biết mã xã. | Excel khó dùng, dễ nhập sai | Đổi sang nhập **tên** Tỉnh/Phường-Xã, extension tự đổi sang mã (mục 5); cần kiểm tra tên xã có trùng trong cùng tỉnh không |
| G6 | `ReturnDate`, `StatusDate/Time` do client hay server sinh? Có trường nào trong `_newModel` cho biết BG **đã được nhập chuyển tiếp** (để tránh nhập đè)? | Tránh nhập trùng, ghi sai ngày | Đối chiếu `_newModel` của một BG đã nhập chuyển tiếp với một BG chưa nhập |
| G7 | Luật kiểm tra SĐT thực tế của validationEngine ("`* Số điện thoại sai`") chưa được ghi, audit chỉ giả định "10 số bắt đầu bằng 0". | Kiểm tra trước của extension chặn nhầm hoặc lọt | Đọc quy tắc `custom[phone]` trong mã nguồn trang |
| G8 | Giới hạn số mã khi tìm, thời hạn phiên, mã lỗi nghiệp vụ `Code != "00"` đều chưa biết (audit đã tự ghi là CHƯA XÁC MINH). | Mã lỗi `E20` chỉ là mã chung | Thu thập dần ở giai đoạn thử nghiệm có kiểm soát |

Ghi chú nhỏ: `00-tong-hop-va-rui-ro.md` nhảy số mục từ 2 sang 4 (không có mục 3); các ví dụ trong audit có mã BG và tên bưu tá thật (`CH371143235VN`, `MAI QUANG VINH`), nên **không đưa hồ sơ audit ra ngoài tổ chức** khi chưa che.

---

## 3. Quy trình

### 3.1. Quy trình nghiệp vụ (người dùng)

1. Đăng nhập Pack & Send (tự nhập, có captcha) và vào 3.9 Quản lý vận đơn.
2. Mở extension (Side Panel) → bấm **Chọn file Excel**.
3. Extension kiểm tra trước toàn bộ file và hiện báo cáo: số dòng hợp lệ / lỗi, mã BG trùng, dòng thiếu dữ liệu. Dòng lỗi **không** được gửi.
4. Người dùng bấm **Chạy thử (không lưu)**: extension làm đủ bước tra cứu và dựng dữ liệu nhưng **không POST**, báo trước dòng nào sẽ lỗi (không phải C39, không tìm thấy mã xã…).
5. Người dùng xác nhận số lượng ("Sẽ chuyển tiếp N BG") rồi bấm **Chạy thật**.
6. Theo dõi tiến độ; có thể **Tạm dừng / Dừng / Tiếp tục**.
7. Kết thúc: **hiện popup tổng kết**: "Thành công X / Tổng N — Thất bại Y", kèm danh sách từng BG thất bại và nguyên nhân (cuộn được). Người dùng bấm **Tải file kết quả** để lưu về kiểm tra. Cũng hiện popup này (ghi rõ "chưa xử lý") khi chạy bị dừng giữa chừng.

### 3.2. Quy trình kỹ thuật cho mỗi BG (đã sửa so với prompt bàn giao)

```
[Excel row] ──> (a) Kiểm tra dòng (client)
                 └ lỗi E01–E07, E04/E05 → ghi kết quả, bỏ qua, KHÔNG gọi server
              ──> (b) Tra BG:  POST /Lading/Home/GetLading (mã BG)
                 └ không có kết quả → E10;  không có nút chuyển tiếp / không C39 → E11
              ──> (c) Mở form:  GET /Lading/LadingJourney/GetByLadingCode
                 └ lấy HTML, trích _newModel; hết phiên (302/401/HTML login) → E90 + DỪNG TOÀN BỘ
              ──> (d) Dựng model: gán họ tên, địa chỉ, SĐT, email, loại, AddressReturn, ghi chú
                 └ DIA_CHI: đổi tên Tỉnh/Xã → mã (GET /Order/Home/GetWard, có cache theo tỉnh);
                   không khớp hoặc khớp nhiều → E07
              ──> (e) Nếu chế độ "Chạy thử" → dừng ở đây, ghi "SẼ THÀNH CÔNG/SẼ LỖI"
              ──> (f) POST /Lading/LadingJourney/UpdateItemForward  { value: model }
                 └ Code "00" → SUCCESS;  Code khác → E20 (kèm Message nguyên văn)
                   HTTP lỗi / timeout → E98 (xem 7.3), KHÔNG tự thử lại POST
              ──> (g) Ghi KET_QUA, MA_LOI, NGUYEN_NHAN, THOI_GIAN_XU_LY; nghỉ 800–1200 ms; sang BG sau
```

Khác prompt bàn giao: (1) kiểm tra C39 dựa trên bước (b) chứ không chỉ `_newModel` (G1); (2) có chế độ chạy thử và bước xác nhận; (3) POST không tự thử lại; (4) tên → mã cho Tỉnh/Xã.

---

## 4. Kiến trúc đề xuất

**Nguyên tắc:** vẫn theo Hướng 2 (gọi endpoint nội bộ, kế thừa cookie), nhưng chia vai để không vướng giới hạn của Manifest V3 và của trình duyệt.

| Thành phần | Chạy ở đâu | Nhiệm vụ | Lý do |
|---|---|---|---|
| **Side Panel (UI + bộ điều phối)** | Trang của extension | Đọc Excel, kiểm tra, vòng lặp từng BG, delay, tạm dừng/dừng, lưu tiến độ, xuất kết quả | Popup đóng khi mất focus; service worker MV3 bị tắt khi nhàn rỗi; tab nền bị trình duyệt hãm timer (có thể còn 1 lần/phút sau ~5 phút). Side panel đang hiển thị thì không bị hãm |
| **Bộ thực thi trong trang (`world: MAIN`)** | Tab `packnsend.vnpost.vn` | Nhận lệnh "xử lý 1 dòng", gọi `$.ajax`/`$.param` của chính site rồi trả kết quả | Dùng đúng jQuery và cookie của trang → giảm sai lệch tuần tự hóa (G3); content script thường (isolated) không thấy biến/hàm của trang |
| **Service worker (mỏng)** | Nền | Mở side panel, chuyển tin nhắn nếu cần | Không chứa vòng lặp dài |
| **Lưu trữ** | `chrome.storage.local` | Tiến độ từng dòng để **tiếp tục sau khi đóng/mở lại**, cài đặt delay | Chống mất kết quả khi lỡ đóng |

Quyền tối thiểu: `host_permissions: https://packnsend.vnpost.vn/*`, `sidePanel`, `storage`, `scripting`, `activeTab`. Không dùng quyền `cookies`, không gửi dữ liệu ra ngoài, **không có máy chủ trung gian**. Thư viện đọc Excel (SheetJS) **đóng gói sẵn trong extension** (MV3 không cho nạp mã từ xa).

**Cấu trúc thư mục dự kiến**

```
Tool-Chuyentiep/
├─ extension/
│  ├─ manifest.json
│  ├─ background/service-worker.js
│  ├─ sidepanel/ (index.html, app.js, styles.css)
│  ├─ page/executor.js            # chạy world MAIN: getLading, getForm, post
│  ├─ core/                       # thuần JS, test được bằng Node
│  │   ├─ excel-reader.js         # đọc sheet, bỏ dòng mô tả, chuẩn hóa chuỗi
│  │   ├─ validator.js            # E01–E07, trùng mã, SĐT, email
│  │   ├─ address-resolver.js     # tên Tỉnh/Xã → mã, bỏ dấu, tiền tố Phường/Xã
│  │   ├─ model-builder.js        # dựng _newModel mới
│  │   ├─ error-map.js            # mã lỗi chuẩn hóa
│  │   └─ runner.js               # máy trạng thái: idle/running/paused/stopped/done
│  └─ vendor/xlsx.full.min.js
├─ tests/ (unit test cho core/, fixture HTML mẫu của GetByLadingCode)
└─ docs/
```

---

## 5. File Excel mẫu — đề xuất bản 2

Bản hiện tại dùng được. Đề xuất thay đổi:

| Thay đổi | Lý do |
|---|---|
| Thay `MA_TINH`, `MA_PHUONG_XA` bằng **`TINH`, `PHUONG_XA` nhập tên** (tỉnh vẫn có dropdown từ `DanhMuc`); extension tự đổi sang mã | Người dùng không nhớ được mã xã 5 số (G5). Vẫn **chấp nhận** nhập mã để tương thích |
| Thêm cột **`GHI_CHU_KIEM_TRA`** chỉ để extension ghi ở chế độ chạy thử | Phân biệt kết quả thử và kết quả thật |
| Giữ dòng 2 (mô tả cột) nhưng extension phải **bỏ qua dòng này** khi đọc; dữ liệu bắt đầu từ dòng 3 | Tránh coi dòng mô tả là một BG |
| Sửa dropdown `LOAI_CHUYEN_TIEP` thành tiếng Việt dễ hiểu (`Bưu cục khác` / `Địa chỉ mới`) và ánh xạ sang mã 2/3 | Dễ dùng; nếu PO muốn giữ `BUU_CUC/DIA_CHI` thì không đổi |
| Quyết định theo G4: cột bưu cục nhận là **mã** hay **tên** | Chờ kết quả xác minh |
| Nâng giới hạn dòng (hiện chỉ đặt kiểm tra đến dòng 500) hoặc bỏ hạn mức | Danh sách trong ngày có thể dài hơn |

File kết quả: extension **xuất một file mới** `KetQua_<thời gian>.xlsx` (gồm toàn bộ cột gốc + 4 cột kết quả), **không ghi đè file gốc** của người dùng. SheetJS bản miễn phí không giữ nguyên định dạng nâng cao của file gốc, nên xuất file mới là cách an toàn hơn.

---

## 6. Báo cáo kết quả và mã lỗi

Giữ nguyên bộ mã trong `04-thong-bao-loi-va-ma-loi.md`, **bổ sung**:

| Mã | Ý nghĩa | Khi nào |
|---|---|---|
| `E08_TRUNG_MA_BG` | Mã BG trùng trong file | Kiểm tra trước; chỉ dòng đầu được xử lý |
| `E09_SAI_MA_BG` | Mã BG không đúng dạng (13 ký tự) | Kiểm tra trước |
| `E12_KHONG_KHOP_DIA_CHI` | Không tìm/khớp nhiều Tỉnh hoặc Phường/Xã theo tên | Bước (d) |
| `E13_DA_CHUYEN_TIEP` | BG đã có thông tin chuyển tiếp (nếu G6 xác nhận phát hiện được) | Bước (c) |
| `E98_KET_QUA_KHONG_RO` | POST bị timeout/lỗi mạng: **không biết server đã lưu hay chưa** | Bước (f) |
| `E91_DUNG_GIUA_CHUNG` | BG chưa xử lý vì phiên hết hoặc người dùng dừng | Dừng sớm |
| `E14_SAI_LOAI_CHUYEN_TIEP` | Loại chuyển tiếp trống hoặc không phải "Bưu cục khác"/"Địa chỉ mới" | Kiểm tra trước |

> **Nguyên tắc kiểm tra dữ liệu (PO chốt 29/10/2026):** công cụ không quản lý nội dung người dùng nhập; chỉ chặn đúng những gì chính form trên web cũng chặn (trường bắt buộc trống, SĐT/email sai theo quy tắc của trang). Không kiểm tra thêm độ dài, số chữ số hay định dạng mã bưu gửi. Vì vậy đã bỏ mã `E15`. Cột loại chuyển tiếp để trống thì tự suy ra theo cột đã điền.

Bảng tổng kết trên giao diện: Tổng / Thành công / Thất bại / **Chưa xử lý** (để tổng luôn khớp) và đếm theo từng mã lỗi.

---

## 7. An toàn và giảm rủi ro

1. **Chạy thử trước, xác nhận sau.** Chạy thật yêu cầu bấm xác nhận kèm số lượng.
2. **Tuần tự, delay 800–1200 ms** (cho phép cấu hình 500–3000 ms). Không song song.
3. **POST không tự thử lại.** Không biết `UpdateItemForward` có lặp được an toàn không; lỗi mạng ghi `E98` để người dùng tự kiểm tra trên hệ thống. Chỉ các GET (tra cứu, nạp xã) mới được thử lại tối đa 2 lần.
4. **Ngắt mạch:** gặp 5 lỗi hệ thống (`E99`/`E98`) liên tiếp thì tự dừng và báo.
5. **Hết phiên:** phát hiện bằng redirect về `/Account/Login`, HTTP 401 hoặc HTML trang đăng nhập; dừng ngay, các dòng còn lại đánh `E91`.
6. **Tiếp tục thông minh:** khi chạy lại cùng file, bỏ qua dòng đã `SUCCESS`.
7. **Không lưu dữ liệu ngoài máy**, không gửi telemetry; nhật ký chỉ nằm trong `chrome.storage` cục bộ, có nút xóa.
8. **Chính sách:** PO đã quyết không cần xin ý kiến CNTT/lãnh đạo (Q5).
9. Không có hoàn tác chuyển tiếp trong hồ sơ audit; vì vậy mọi thử nghiệm ghi thật chỉ làm trên **BG test do người dùng cho phép bằng văn bản**.

---

## 8. Phân việc

Ba bên: **Claude** (lập kế hoạch, lõi xử lý, kiểm thử, rà soát mã), **Antigravity** (có quyền vào site: xác minh thực tế, bộ thực thi trong trang, giao diện, kiểm thử trên trình duyệt), **Người dùng/PO** (duyệt, cho phép BG test, đăng nhập).

| WP | Công việc | Chủ trì | Đầu vào | Đầu ra / Tiêu chí xong | Cỡ |
|---|---|---|---|---|---|
| **WP0** | Duyệt phương án, trả lời câu hỏi mục 10 | PO | tài liệu này | Biên bản duyệt | S |
| **WP1** | Xác minh G1–G8 trên site thật: ghi `GetLading`, `_newModel` đầy đủ (đã che), thử bưu cục mã/tên, đọc luật SĐT | Antigravity (chỉ đọc) + Người dùng cho BG test cho phần ghi | audit hiện có | `06-xac-minh-bo-sung.md` + fixture HTML/JSON đã che; mỗi G có kết luận hoặc "không xác minh được" | M |
| **WP2** | Lõi xử lý `core/`: đọc Excel, kiểm tra, tên→mã địa chỉ, dựng model, bảng mã lỗi | Claude | WP1 (fixture), file Excel mẫu | Unit test chạy bằng Node đạt; có ca kiểm thử cho mọi mã E01–E13 | M |
| **WP3** | Bộ thực thi trong trang `page/executor.js`: `getLading`, `getForm` (trích `_newModel`), `getWard`, `post`; nhận diện hết phiên | Antigravity | WP1 | Chạy thật chế độ **chỉ đọc** trên site: trả đúng dữ liệu; POST chỉ khi có phép | M |
| **WP4** | Bộ điều phối `runner.js` + lưu tiến độ + dừng/tiếp tục + ngắt mạch + chạy thử | Claude | giao diện hợp đồng WP3 (mục 8.1) | Test với executor giả lập: tạm dừng, tiếp tục, dừng, hết phiên, ngắt mạch đều đúng | M |
| **WP5** | Giao diện Side Panel: chọn file, báo cáo kiểm tra, tiến độ, bảng log, **popup tổng kết cuối (thành công/tổng, danh sách thất bại + nguyên nhân)**, nút tải kết quả | Antigravity | hợp đồng dữ liệu 8.1 | Bản chạy được trên Chrome, ảnh chụp màn hình các trạng thái | M |
| **WP6** | Excel mẫu bản 2 + xuất file kết quả + trang hướng dẫn | Claude (xuất file) + Antigravity (mẫu) | mục 5 | Mẫu mở được; file kết quả đủ cột; đọc lại được | S |
| **WP7** | Kiểm thử tích hợp: (a) chạy thử toàn bộ file mẫu; (b) thử có kiểm soát 1–2 BG test; (c) pilot 20 BG | Người dùng + Antigravity | WP2–WP6 | Báo cáo khớp với dữ liệu trên hệ thống; không dòng nào lệch | M |
| **WP8** | Rà soát mã, bảo mật, hồ sơ bàn giao, hướng dẫn sử dụng | Claude | tất cả | Báo cáo rà soát, tài liệu HDSD | S |

### 8.1. Hợp đồng giữa bộ điều phối và bộ thực thi (cố định từ đầu để hai bên làm song song)

```
Lệnh:     { type: "PROCESS_ONE", rowId, row:{...}, mode: "dry" | "real" }
Kết quả:  { rowId, status: "SUCCESS"|"FAIL"|"DRY_OK"|"DRY_FAIL"|"SESSION_EXPIRED",
            code: "SUCCESS"|"E10_..."|..., message, serverCode, httpStatus, durationMs }
```

Hai nhánh làm song song được: **Claude** làm WP2 + WP4 (không cần site), **Antigravity** làm WP1 → WP3 và WP5. WP1 là điều kiện tiên quyết của WP2 phần địa chỉ và WP3.

---

## 9. Lộ trình và cổng duyệt

| Cổng | Điều kiện qua | Người quyết |
|---|---|---|
| **G-0** | PO duyệt phương án và trả lời câu hỏi mục 10 | PO |
| **G-1** | WP1 xong: các lỗ hổng G1–G4 có kết luận (G5–G8 có thể đóng sau) | PO + Claude |
| **G-2** | Chạy thử toàn bộ file mẫu (không ghi) đúng như kỳ vọng | Người dùng |
| **G-3** | Thử có kiểm soát 1–2 BG test: ghi thành công **và** thất bại đều được báo đúng | Người dùng, bằng văn bản |
| **G-4** | Pilot 20 BG thật, đối chiếu thủ công 100% | PO |
| **G-5** | Phát hành cho đơn vị | PO |

---

## 10. Quyết định của PO (đã trả lời ngày 29/10/2026)

| # | Câu hỏi | Quyết định | Hệ quả cho thiết kế |
|---|---|---|---|
| Q1 | BG chưa ở trạng thái chuyển tiếp (C39) | **A: chỉ báo lỗi `E11`, bỏ qua BG đó** | Không làm chức năng tự chuyển sang C39 |
| Q2 | Loại chuyển tiếp ưu tiên | **Không ưu tiên, hỗ trợ cả hai.** Người dùng tự nhập bưu cục hoặc địa chỉ theo địa bàn mình biết | Công cụ **không kiểm tra đúng/sai địa bàn hay bưu cục có thuộc BCVH nào**; chỉ kiểm tra định dạng, thiếu dữ liệu, và việc tên Tỉnh/Xã có tìm thấy trên hệ thống. Nếu hệ thống VNPost từ chối thì ghi nguyên văn lời nhắn vào báo cáo |
| Q3 | Hiển thị kết quả | **Hiện bảng, bấm nút tải** + **thêm popup tổng kết cuối**: thành công/tổng, thất bại và nguyên nhân từng BG | Xem mục 3.1 bước 7 và WP5 |
| Q4 | BG thử thật | **Có sẵn một số BG đủ điều kiện chuyển tiếp** | Cần người dùng đưa danh sách mã và **cho phép bằng văn bản** việc ghi thử (xem điều kiện ngay dưới) |
| Q5 | Xin ý kiến CNTT/lãnh đạo | **Không cần** | Bỏ khỏi lộ trình |
| Q6 | Số BG tối đa và tốc độ | **500 BG/lần, nghỉ ~1 giây; ưu tiên nhanh** | Mặc định 1000 ms, cho chỉnh xuống 500 ms nếu hệ thống chịu được (kiểm tra ở giai đoạn pilot) |

**Điều kiện cho Q4 (cần người dùng bổ sung trước WP1):** chuyển tiếp là thao tác ghi thật vào hệ thống và không có chức năng hoàn tác trong hồ sơ audit. Trước khi thử ghi, người dùng cần cho biết: (a) mã từng BG được phép thử; (b) giá trị người nhận mới dùng khi thử (nên là địa chỉ/bưu cục thật nhưng vô hại, vì sẽ lưu lại trên hệ thống); (c) xác nhận bằng chữ: "Cho phép ghi thử trên các BG này".

---

## 11. Phần sửa cho prompt bàn giao Antigravity (bản đã dán)

Prompt hiện có (đã đưa vào dự án) có thể dùng làm nền, nhưng cần sửa trước khi giao:

1. **Mục 3 "Tiến hành viết code hoàn chỉnh" phải bị gỡ** cho đến khi qua cổng G-0, vì PO chưa duyệt.
2. Bước 2 (kiểm tra C39) đổi thành kiểm tra từ kết quả `GetLading` (mục 3.2b), không chỉ `_newModel.StatusCode` (G1).
3. Bước 1 cần ghi rõ nguồn của `receiverName`, `receiverAddress` (G2).
4. Thêm: thực thi trong `world: MAIN` bằng `$.ajax`; vòng lặp đặt ở Side Panel, không đặt ở popup/service worker.
5. Thêm: chạy thử, xác nhận số lượng, POST không tự thử lại, ngắt mạch, mã `E08/E09/E12/E13/E91/E98`.
6. Thêm: đóng gói SheetJS cục bộ; xuất **file kết quả mới**, không ghi đè file gốc.
7. Tách việc: Antigravity chỉ làm WP1, WP3, WP5 (và phần mẫu của WP6); lõi xử lý và bộ điều phối do bên còn lại làm theo hợp đồng 8.1.
