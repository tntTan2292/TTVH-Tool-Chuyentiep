# PROMPT ANTIGRAVITY — WP5 (GIAO DIỆN) VÀ WP3 (BỘ THỰC THI TRONG TRANG)

> Chỉ bắt đầu khi PO/người dùng đã xác nhận duyệt phương án. Đọc trước: `docs/PHUONG-AN-TRIEN-KHAI.md` (mục 3, 4, 8, 10) và `docs/audit/*`.
> Phía còn lại (Claude) làm lõi xử lý `extension/core/*` (đọc Excel, kiểm tra, đổi tên Tỉnh/Xã → mã, dựng model, mã lỗi) và bộ điều phối `runner.js`. **Bạn không sửa các tệp trong `core/`.** Hai bên gặp nhau ở hợp đồng ở mục 3.

## 0. Phía kia đã xong (dùng luôn, không viết lại, không sửa)

`extension/core/` gồm `prepare.js` (đọc dữ liệu Excel dạng mảng dòng → danh sách dòng + lỗi kiểm tra trước), `runner.js` (bộ điều phối thật: `createRunner({executor})`, `start/pause/resume/stop`, sự kiện `state/progress/row/done/sessionExpired/circuitOpen`, `getSummary()` cho popup tổng kết, `getResults()`), `exporter.js` (`buildResultAoa`, `makeFileName`, `toWorkbook`), `process-one.js`, `validator.js`, `address-resolver.js`, `errors.js`. Tất cả là JS thuần, nạp bằng thẻ `<script>` theo thứ tự: `errors, text-utils, provinces, validator, address-resolver, model-builder, process-one, prepare, runner, exporter`; chúng gắn vào `window.VNPCore`. Chạy `npm test` để kiểm tra (75 test đang đạt). Xem tên hàm và dạng dữ liệu trong chính các tệp đó và trong `tests/`.

Với giao diện (WP5) bạn **không cần `runner.mock.js` nữa**: dùng `runner.js` thật với một executor giả (hàm `processOne` trả kết quả theo hợp đồng mục 3) để chụp ảnh các trạng thái. Việc đọc file `.xlsx` bằng SheetJS và tải file kết quả nằm ở giao diện: đọc bằng `XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '' })` rồi đưa vào `VNPCore.prepare.prepareFromAoa`. SheetJS cần đóng gói cục bộ trong `extension/vendor/` (dùng bản chính thức 0.20.x từ cdn.sheetjs.com, **không** dùng gói `xlsx` 0.18 trên npm vì đã cũ và có lỗ hổng); nếu không tải được thì báo người dùng.

## 1. WP5 — Giao diện Side Panel (làm ngay, không cần site)

Manifest V3, Chrome/Edge, **Side Panel** (không dùng popup vì popup đóng khi mất focus). Giao diện tiếng Việt, rõ ràng, người dùng không rành kỹ thuật, bảng nhiều dòng phải cuộn mượt với 500 dòng.

Màn hình và trạng thái:

1. **Chọn file Excel** (kéo thả hoặc nút). Hiện tên file, số dòng đọc được. Có link tải file mẫu.
2. **Báo cáo kiểm tra trước**: số dòng hợp lệ / lỗi, danh sách dòng lỗi (số dòng, mã BG, nguyên nhân). Dòng lỗi không được chạy.
3. Hai nút chính: **Chạy thử (không lưu)** và **Chạy thật**. Chạy thật bắt buộc qua hộp xác nhận: "Sẽ chuyển tiếp N bưu gửi. Thao tác này ghi vào hệ thống và không hoàn tác được." Cài đặt nhỏ: khoảng nghỉ (mặc định 1000 ms, cho chọn 500–3000).
4. **Đang chạy**: thanh tiến độ; bộ đếm **Tổng / Đã xử lý / Thành công / Thất bại / Chưa xử lý**; nút **Tạm dừng / Tiếp tục / Dừng**; bảng log từng BG (STT, mã BG, kết quả, mã lỗi, nguyên nhân, thời gian), tô màu theo kết quả, tự cuộn tới dòng mới nhất, lọc "chỉ xem thất bại".
5. **Popup tổng kết khi kết thúc** (yêu cầu của PO): tiêu đề "Hoàn tất", dòng lớn **"Thành công X / Tổng N — Thất bại Y"**, hộp cuộn liệt kê **từng BG thất bại kèm nguyên nhân**, thống kê theo mã lỗi, và nút **Tải file kết quả**. Cũng hiện khi bị dừng giữa chừng (ghi rõ số "chưa xử lý").
6. **Cảnh báo cần chú ý**: hết phiên đăng nhập ("Hãy đăng nhập lại trên tab Pack & Send rồi bấm Tiếp tục"); không thấy tab Pack & Send đang mở; không đúng trang 3.9.
7. **Khôi phục**: mở lại panel thấy tiến độ đang lưu, có nút **Tiếp tục** hoặc **Bắt đầu lại**.

Yêu cầu kỹ thuật: không gọi mạng ngoài trang `packnsend.vnpost.vn`; không dùng thư viện nạp từ CDN (đóng gói cục bộ); HTML/CSS/JS thuần hoặc framework nhẹ, không cần bước build phức tạp; thiết kế trạng thái trống/lỗi/tải đầy đủ.

Làm trên executor giả (đặt ở `extension/sidepanel/dev/fake-executor.js`, chỉ dùng khi phát triển): giả lập thành công, thất bại với nhiều mã lỗi khác nhau, hết phiên và dừng giữa chừng để chụp ảnh các trạng thái.

## 2. WP3 — Bộ thực thi trong trang `extension/page/executor.js`

**Chỉ bắt đầu sau khi WP1 hoàn tất** (`docs/audit/06-xac-minh-bo-sung.md`). Nội dung WP1 quyết định chi tiết các hàm dưới đây; nếu kết luận WP1 mâu thuẫn với mô tả ở đây, **theo WP1 và báo lại**.

Chạy trong `world: "MAIN"` của tab `packnsend.vnpost.vn` (qua `chrome.scripting.executeScript` hoặc khai báo content script `world: MAIN`) để dùng trực tiếp `$.ajax` / `$.param` / cookie của trang. Cung cấp:

**Bạn chỉ viết 4 hàm nguyên thủy gọi mạng.** Logic ghép bước (kiểm tra dòng, C39, đổi tên Tỉnh/Xã → mã, dựng model, chạy thử, thử lại GET, phân loại lỗi) **đã viết và có test sẵn** ở `extension/core/process-one.js` (do phía kia làm, không sửa). Mỗi hàm trả `{ ok:true, data }` hoặc `{ ok:false, kind, httpStatus, message }` với `kind` là `"SESSION_EXPIRED"` | `"NETWORK"` | `"HTTP"`. Không ném lỗi ra ngoài, **không tự thử lại** (core tự thử lại GET tối đa 2 lần).

- `getLading(maBG)` → tra BG qua `POST /Lading/Home/GetLading`, `data = { found, statusCode, statusText, hasForwardButton, receiverName, receiverAddress }` (bóc từ HTML dòng `tr_<mã>`). `statusText` là chữ trong nhãn trạng thái (ví dụ "Bưu gửi chuyển tiếp"), dùng để báo lỗi dễ hiểu. `statusCode` chỉ có khi có nút `GetUpdateItemForward(..., 'C39', ...)` (lấy tham số thứ hai), còn lại để `null`. `hasForwardButton` = có nút đó. `receiverName`/`receiverAddress` để `''` nếu không đọc được (server không bắt buộc, đã xác minh G2). Không tìm thấy dòng nào → `found:false` (vẫn `ok:true`).
- `getForm(maBG, receiverName, receiverAddress)` → `GET /Lading/LadingJourney/GetByLadingCode?ladingCode=..&statusCode=C39` (hai tham số người nhận có thể rỗng), `data = { model }`. `model` là đối tượng `_newModel` (script `var _newModel = {...};` trong HTML, JSON hợp lệ). Nếu HTML **không có** form/`_newModel` và **không phải** trang đăng nhập → `data = { model: null }` (core báo E11). Phát hiện hết phiên (redirect `/Account/Login`, HTTP 401, HTML trang đăng nhập) → `{ ok:false, kind:"SESSION_EXPIRED" }`.
- `getWard(provinceId)` → `GET /Order/Home/GetWard`, `data = [ { value, text }, ... ]` (đổi từ `Value`/`Text` của server).
- `post(model)` → `POST /Lading/LadingJourney/UpdateItemForward` dùng `$.ajax` với `data: { value: model }` đúng như trang, `data = { Code, Message }` (JSON server trả về, giữ nguyên). **Không tự thử lại POST.** Lỗi mạng/timeout → `{ ok:false, kind:"NETWORK" }` (core sẽ ghi `E98`: không rõ đã lưu hay chưa). Hết phiên → `kind:"SESSION_EXPIRED"`.

Ghép vào trang: nạp các tệp `extension/core/*.js` (trừ `runner.js`, `prepare.js`, `exporter.js`) vào cùng ngữ cảnh MAIN trước `executor.js`, rồi expose:

```js
window.VNPExecutor = {
  api: { getLading, getForm, getWard, post },
  processOne: (command) => VNPCore.processOne.processOne(api, command, ctx) // ctx = { wardCache: {} } dùng chung cả lượt chạy
};
```

`processOne` chế độ `dry` **không bao giờ gọi `post`**; đã có test ở `tests/process-one.test.js`, bạn thêm test cho 4 hàm nguyên thủy của mình (chỉ-đọc, không gọi `post` thật).

Quy tắc: không hiện popup/toast của trang, không mở modal của trang, không đổi giao diện trang; không ghi gì lên DOM của trang; không `console.log` dữ liệu khách hàng.

## 3. Hợp đồng với bộ điều phối (cố định, không đổi nếu chưa thống nhất)

Bộ thực thi nhận/trả (qua `chrome.runtime`/`window.postMessage` tùy thiết kế, nêu rõ cách chọn trong tài liệu):

```
Lệnh:     { type:"PROCESS_ONE", rowId, mode:"dry"|"real", row:{ maBG, hoTen, diaChi, soDT, email, loai:2|3, buuCuc, tinh, phuongXa, ghiChu } }
Kết quả:  { rowId, status:"SUCCESS"|"FAIL"|"DRY_OK"|"DRY_FAIL"|"SESSION_EXPIRED"|"UNKNOWN",
            code:"SUCCESS"|"E10_..."|..., message, serverCode, httpStatus, durationMs }
```

Bộ điều phối là `extension/core/runner.js` (đã xong). Giao diện đăng ký sự kiện bằng `runner.on('progress' | 'row' | 'done' | 'state' | 'sessionExpired' | 'circuitOpen', fn)` và gọi `runner.start(items, { mode, delayMs, previous })`, `pause()`, `resume()`, `stop()`, `getSummary()`. `executor.processOne(command)` của runner trong side panel sẽ gửi lệnh sang tab Pack & Send (qua `chrome.tabs.sendMessage` / `chrome.scripting`) và trả kết quả của `window.VNPExecutor.processOne`.

## 4. Sản phẩm bàn giao

- `extension/sidepanel/*` (+ `extension/manifest.json`, `extension/vendor/`) + ảnh chụp màn hình các trạng thái ở mục 1 (đã che dữ liệu).
- Sau WP1: `extension/page/executor.js` kèm test chế độ **chỉ đọc** trên site (không gọi `post`), và `docs/audit/07-bao-cao-executor.md` mô tả đã chạy gì, kết quả ra sao.
- Danh sách điểm lệch so với hợp đồng hoặc mô tả (nếu có) kèm lý do.

## 5. An toàn

- Người dùng tự đăng nhập; không lưu thông tin đăng nhập.
- Chỉ gọi `post` thật sau khi người dùng gửi trong chat mã BG được phép và câu "Cho phép ghi thử". Mỗi BG một lần.
- Dữ liệu dùng trong ảnh, fixture, test phải là dữ liệu giả.
- Không thêm quyền thừa trong manifest (chỉ `host_permissions` cho `https://packnsend.vnpost.vn/*`, `sidePanel`, `storage`, `scripting`, `activeTab`).
