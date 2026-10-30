# BÀN GIAO LÕI "XỬ LÝ 3.0" CHO ANTIGRAVITY (GIAO DIỆN + KIỂM CHỨNG THỰC TẾ)

Backend đã xong và qua 119 test tự động (`npm test`). Chưa chạy thử trên PNS thật.

## Tệp mới / sửa
| Tệp | Vai trò |
|---|---|
| `extension/core/xuly30.js` | Lõi: `parseInput`, `createController`, `buildReportAoa`, `makeReportFileName`, `STEPS` |
| `extension/page/xuly30-page.js` | Chạy trong trang PNS (MAIN world, đã thêm vào `manifest.json`): `window.VNPXuLy30.runStep(bước, mãBG[])` |
| `extension/sidepanel/xuly30-bridge.js` | `VNPXuLy30Bridge.check()` và `.createDriver()`: tự chuyển tab sang 6.2 / 3.2 / 3.8.1 |
| `extension/core/errors.js` | Thêm mã `E40`–`E44` |
| `tests/xuly30.test.js` | Test lõi và hàm thuần |

## Cách nối giao diện
Nạp thêm vào `sidepanel/index.html` (sau `core/exporter.js`): `core/xuly30.js`, `sidepanel/xuly30-bridge.js`.

```js
const X = VNPCore.xuly30;
const input = X.parseInput(aoa);                 // aoa = sheet_to_json(ws,{header:1,raw:false,defval:''}) của file kết quả Chuyển tiếp
// input.ok, input.fatal[], input.warnings[], input.codes[], input.skipped[], input.duplicates[]
const chk = await VNPXuLy30Bridge.check();       // {ok, message}
const ctl = X.createController({
  driver: VNPXuLy30Bridge.createDriver(),
  batchSize: 40,                                 // tối đa 50
  onProgressUpdate: p => {},                     // {step 1-4, stepName, done, total, batch, batches, counts:{total,success,fail,unknown,notProcessed,running}, finished?}
  onError: e => {},                              // {fatal, step, stepName, code, message, maBG?}  fatal=true là dừng cả lượt (E43_*, E90)
  onSuccess: s => {}                             // tổng kết {total, success, fail, unknown, notProcessed, halted, failures[], byCode}
});
// ctl.on('row', rec) cũng có (mỗi BG khi có kết quả cuối). ctl.stop() để dừng giữa chừng.
const summary = await ctl.run(input.codes);
const aoa2 = X.buildReportAoa(ctl.getResults()); // xuất bằng VNPCore.exporter.toWorkbook(XLSX, aoa2) và X.makeReportFileName()
```
Mỗi bản ghi từ `getResults()`: `{maBG, steps:{vuHoi,giaoLai,bd13,chuyen30}: 'OK'|'FAIL'|'UNKNOWN'|'', status: SUCCESS|FAIL|UNKNOWN|NOT_PROCESSED, code, message, failedStep, finishedAt}`.

Gợi ý giao diện: màn hình riêng cho Xử lý 3.0, cảnh báo trước khi chạy rằng thao tác **ghi thật và không hoàn tác**, không có chế độ chạy thử; hiện tiến độ theo 4 bước; khi `fatal` thì hiện rõ nguyên nhân và các BG đã xong đến bước nào.

## VIỆC CẦN ANTIGRAVITY KIỂM CHỨNG TRÊN PNS THẬT (tôi chưa xác minh được)
Dùng 1–2 BG test, người dùng cho phép từng bước. Ghi kết quả vào `docs/audit-xuly30/08-kiem-chung-lop-ma.md`.
1. **Ký tự ngăn cách nhiều mã ở ô `#txtLadingCode` (6.2)**: mặc định `,` (`VNPXuLy30.config.separator`). Thử 2–3 mã; nếu sai, đổi thành `\n` hoặc khoảng trắng.
2. **Tên trường dữ liệu bảng 6.2**: mã đọc `data.LadingCode` và `data.StatusCode` từ DataTable, nếu thiếu thì lấy mã bằng regex trên dòng. Kiểm tra `StatusCode == 'R'` sau vu hồi có đúng như audit.
3. **Bước 2**: nút "Giao lại bưu gửi vu hồi", nút "Giao lại" trong modal (tìm theo chữ), radio giữ tuyến.
4. **Bước 3**: nút xác nhận được tìm là nút tên **"Đồng ý"** trong modal đang hiện; nút lập bản kê là `#btnCreateBD13` hoặc `[onclick*=CreateBd13]`; đóng popup in bằng `.modal('hide')`. Kiểm tra bảng 3.2 có thể có **nhiều dòng (mỗi bưu tá một dòng)**: lõi lập lần lượt từng dòng và dừng nếu tổng ≠ số BG đã giao lại.
5. **Bước 4**: biến toàn cục `table`, `_isExcell`; ô `#Route`/`#cbPostman` trên 3.8.1 mặc định có giá trị gì (lõi lấy phần trước dấu `-` của tuyến đang chọn như mã nguồn trang); tên trường trong `Data` trả về (lõi tìm mã BG trong mọi trường chuỗi, và đọc `warehouse_status`).
6. **Thành công một phần ở bước 4** ("Cập nhật thành công X/Y" với X<Y): lõi đánh dấu cả lô là *Không rõ* vì chưa biết BG nào lỗi. Nếu popup/response có danh sách thất bại, báo lại để tôi đọc chính xác.
7. **Popup native (`alert/confirm`)** nếu xuất hiện thì sẽ treo lô; ghi lại nếu gặp.
