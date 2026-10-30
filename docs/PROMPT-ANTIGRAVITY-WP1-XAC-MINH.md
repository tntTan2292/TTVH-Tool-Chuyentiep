# PROMPT ANTIGRAVITY — WP1: XÁC MINH BỔ SUNG TRÊN HỆ THỐNG THẬT

> Vai trò: QA/BA kỹ thuật. Chỉ xác minh và ghi tài liệu. **Không viết code extension.**
> Đọc trước: `docs/PHUONG-AN-TRIEN-KHAI.md` (đặc biệt mục 2 và 10) và `docs/audit/*`.
> Kết quả của việc này quyết định thiết kế lõi xử lý và bộ thực thi, nên **đừng suy đoán**: không xác minh được thì ghi "KHÔNG XÁC MINH ĐƯỢC" kèm lý do.

## Quy tắc an toàn (bắt buộc)

1. Người dùng tự đăng nhập. Không lưu hay ghi lại tài khoản, mật khẩu, captcha.
2. **Phần 1 (chỉ đọc)** làm được ngay. **Phần 2 (ghi thử)** chỉ làm khi người dùng đã gửi trong chat: danh sách mã BG được thử, giá trị người nhận mới dùng khi thử, và câu "Cho phép ghi thử trên các BG này". Thiếu một trong ba thì dừng và hỏi.
3. Chuyển tiếp là ghi thật và không có hoàn tác trong hồ sơ audit. Mỗi BG chỉ thử **một lần**, ghi lại kết quả ngay sau mỗi lần, rồi mới sang lần kế. Có kết quả bất ngờ thì **dừng và hỏi người dùng**.
4. Không bấm Cập nhật trên BG không nằm trong danh sách được phép. Không gửi nhiều request liên tiếp; nghỉ ít nhất 1 giây giữa các request.
5. Mọi tệp lưu lại (ảnh, HAR, JSON, HTML) phải **che**: cookie, token, số điện thoại, họ tên, địa chỉ khách hàng, tên bưu tá. Thay bằng dữ liệu giả có cấu trúc giống thật. Không để mã BG thật trong tệp bàn giao, thay bằng `BG_TEST_01`, `BG_TEST_02`…

## Phần 1 — Chỉ đọc (làm ngay sau khi người dùng đăng nhập)

Người dùng sẽ mở 3.9 Quản lý vận đơn. Dùng DevTools (Network, Console) ở chế độ quan sát.

**G2 — Request `GetLading` và tham số `GetByLadingCode`**
- Tìm 1 mã BG, ghi lại request `POST /Lading/Home/GetLading`: các tham số, kiểu dữ liệu, phản hồi HTML (cấu trúc bảng, vị trí mã BG, badge trạng thái, nút chuyển tiếp).
- Với 1 BG đang ở C39: gọi `GET /Lading/LadingJourney/GetByLadingCode` bằng `fetch` từ Console **ba lần** (mỗi lần cách nhau ≥1 giây): (a) đủ 4 tham số; (b) `receiverName` và `receiverAddress` để rỗng; (c) bỏ hẳn hai tham số. Ghi lại phản hồi mỗi lần. Đây là yêu cầu GET, không ghi dữ liệu.

**G1 — Server có tự quyết định trạng thái hay chỉ lặp lại `statusCode` của client?**
- Nếu người dùng cung cấp 1 BG **không** ở C39: gọi `GetByLadingCode` với `statusCode=C39` và so sánh `StatusCode` trong `_newModel` với trạng thái thật trong bảng. Kết luận rõ: server **tự lấy từ CSDL** hay **chỉ trả lại giá trị đã truyền**.
- Nếu không có BG như vậy: ghi "CHƯA XÁC MINH" và đề xuất phương án kiểm tra C39 chắc chắn dựa trên kết quả `GetLading`.

**G3 — Mô hình đầy đủ và cách tuần tự hóa**
- Trích **toàn bộ** `_newModel` (không dùng dấu `...`), đã che. Liệt kê từng khóa, kiểu giá trị, khóa nào là null.
- Trong Console, chạy `$.param({ value: _newModel })` (chỉ in ra, **không gửi**) và lưu nguyên chuỗi kết quả đã che. Ghi phiên bản jQuery của trang.
- Có hàm/biến nào của trang can thiệp vào dữ liệu trước khi gửi không (`ajaxSetup`, `beforeSend`)? Kiểm tra `$.ajaxSettings` và `$.ajaxSetup`.

**G6 — Phát hiện BG đã nhập chuyển tiếp**
- So sánh `_newModel` của một BG đã có thông tin chuyển tiếp với một BG chưa có (nếu người dùng có cả hai). Trường nào khác nhau? Có trường nào dùng được để nhận biết "đã chuyển tiếp"?
- `ReturnDate`, `StatusDate`, `StatusTime` có sẵn trong HTML trả về (do server) hay được trang gán lúc bấm Cập nhật (do client)?

**G7 — Luật kiểm tra SĐT và email**
- Trong Console in ra quy tắc `$.validationEngineLanguage.allRules.phone`, `.email`, `.required` (regex và thông báo).

**G8 (một phần) — Giới hạn và phiên**
- Ô `#LadingCode` nhận tối đa bao nhiêu mã một lần? Thử tăng dần 1, 10, 50 mã (mã bất kỳ, tìm kiếm là thao tác đọc).
- Ghi các dấu hiệu nhận biết hết phiên: chỉ khi trang tự cho thấy (không chủ động chờ hết phiên). Nếu gặp tình cờ thì ghi lại dạng phản hồi.

**Tỉnh/Xã (G5, chỉ đọc)**
- Gọi `GET /Order/Home/GetWard?ProvinceId=` cho 3 tỉnh (ví dụ 53, 10, 70). Với mỗi tỉnh: số xã, và **có tên xã trùng nhau trong cùng tỉnh không** (kiểm tra bằng đoạn mã đếm, in kết quả). Ghi các kiểu tên (ví dụ có tiền tố "Phường/Xã"/"Thị trấn", dấu, số thứ tự như "A Lưới 1").

## Phần 2 — Ghi thử (CHỈ khi đã có phép theo quy tắc 2)

Mỗi mục dùng **một BG riêng**. Trước mỗi lần bấm, nói rõ với người dùng sẽ làm gì và với mã nào, chờ "OK".

| Ca | Mục đích | Cách làm | Ghi lại |
|---|---|---|---|
| T1 | G3/G4: ghi thành công theo **Bưu cục khác**, nhập **mã** bưu cục | Thao tác bằng giao diện, bắt request POST đã che | URL, headers, body thật (đã che), response |
| T2 | G4: Bưu cục khác, nhập **tên** bưu cục (BG khác) | Như trên | Server nhận hay từ chối? Message nguyên văn |
| T3 | G5: **Địa chỉ mới**: Tỉnh + Phường/Xã | Như trên | `AddressReturn` thực tế gửi đi (`tỉnh;xã`), response |
| T4 | G8: ca lỗi nghiệp vụ | Chỉ khi người dùng đồng ý: ví dụ nhập mã bưu cục không tồn tại | `Code` và `Message` nguyên văn của server |
| T5 | G6: BG vừa ghi xong có thể mở lại form không? Nút chuyển tiếp còn không? Server có chặn ghi lần hai không? | **Chỉ quan sát bằng giao diện, không ghi lần hai** | Hành vi trên giao diện, `_newModel` sau khi ghi |

## Sản phẩm bàn giao

- `docs/audit/06-xac-minh-bo-sung.md`: mỗi G1–G8 có **Kết luận một câu**, bằng chứng, và mức chắc chắn (Đã kiểm chứng / Suy luận / Không xác minh được).
- `docs/audit/fixtures/`: mẫu đã che để dùng làm dữ liệu kiểm thử: `getlading_response.html`, `getbyladingcode_response.html`, `newmodel_full.json`, `param_sample.txt`, `getward_53.json` (3 tỉnh), `updateitemforward_success.json`, và các phản hồi lỗi bắt được.
- Cuối tệp 06: danh sách **mã lỗi nghiệp vụ mới** thu được (nguyên văn `Code`, `Message`) và đề xuất ánh xạ vào bảng mã lỗi chuẩn hóa.

## Định nghĩa hoàn thành

- G1–G4 có kết luận rõ hoặc ghi lý do không thể xác minh.
- Mọi fixture đã che, không còn thông tin cá nhân hay mã BG thật.
- Không có chuyển tiếp nào được ghi ngoài danh sách được phép; nhật ký ghi thử liệt kê đúng từng lần ghi (mã giả, thời điểm, kết quả).
- Không có dòng code extension nào.
