# PROMPT GIAO VIỆC CHO ANTIGRAVITY — AUDIT CHỨC NĂNG "XỬ LÝ 3.0" (4 BƯỚC, NHIỀU MODULE PNS)

> Vai trò: bạn là QA/Business Analyst kỹ thuật. Nhiệm vụ này CHỈ audit và tài liệu hóa. KHÔNG viết code extension.
> Cách làm, định dạng sản phẩm và quy tắc an toàn kế thừa đợt audit module 3.9 (`docs/PROMPT-ANTIGRAVITY-AUDIT.md`, `docs/audit/`). Đọc lại các tệp đó trước để dùng cùng khuôn.

## 1. Bối cảnh

Extension hiện có chức năng **Chuyển tiếp** (nhập chuyển tiếp chi tiết BG hàng loạt từ Excel ở module 3.9 trên https://packnsend.vnpost.vn/). Cần bổ sung chức năng thứ hai: **"Xử lý 3.0"** — đưa hàng loạt BG đã chuyển tiếp thành công quay về xử lý tại 3.0, qua 4 bước ở 4 module khác nhau trên PNS. Đầu vào là **danh sách mã BG đã chuyển tiếp thành công** (lấy từ kết quả chức năng Chuyển tiếp). Đầu ra là báo cáo từng BG: thành công hay thất bại ở bước nào, vì sao.

## 2. Quy trình nghiệp vụ (PO mô tả — nguồn sự thật để đối chiếu)

**Bước 1 — Vu hồi tại module 6.2 "Danh sách bưu gửi chờ nhập kho/Vu hồi"**
1. Ô *Mã bưu gửi*: điền toàn bộ mã BG của danh sách chuyển tiếp thành công.
2. Check All chọn tất cả dòng ở bảng dữ liệu.
3. Bấm chức năng **Vu hồi** → popup → bấm **Đồng ý**.
→ Vu hồi hết danh sách rồi mới sang Bước 2.

**Bước 2 — Giao lại bưu gửi vu hồi (vẫn module 6.2)**
1. Ô *Mã bưu gửi*: điền toàn bộ mã BG đã vu hồi ở Bước 1.
2. Check All.
3. Bấm **Giao lại bưu gửi vu hồi**.
4. Chọn **Giữ tuyến bưu tá**.
5. Bấm **Giao lại**.
→ Giao lại hết rồi mới sang Bước 3.

**Bước 3 — Lập bản kê BĐ13 tại menu 3.2 "Lập bản kê BĐ13"**
1. Dropdown *Tuyến phát*: chọn tuyến tên **"Chuyển tiếp"** (mỗi bưu cục chỉ có 1 tuyến này).
2. Dropdown *Bưu tá*: để mặc định "tất cả".
3. Bảng dữ liệu: chọn dòng có cột **"SL bưu gửi chưa lập BĐ13"** khớp đúng số BG vừa giao lại ở Bước 2.
4. Bấm vào con số đó → hiện bảng *Danh sách Bưu gửi* → Check All → bấm **Lập bản kê BĐ13**.
5. Popup *"Xác nhận dịch vụ in BD13"* → chọn **HỦY** → F5 tải lại trang.

**Bước 4 — Chuyển BG về 3.0 tại menu 3.8.1 "Tạo yêu cầu chuyển bưu gửi"**
1. Tải **file mẫu** của chính màn hình này.
2. Điền danh sách BG (cùng danh sách ở Bước 3) vào file mẫu.
3. **Import Excel** → popup thành công → **Đóng**.
4. Dưới bảng dữ liệu: Check All → bấm **Chuyển bưu gửi**.
5. Popup xác nhận hiện đúng số lượng BG đã chọn → bấm nút **"Chuyển … Bưu gửi"**.
6. Hệ thống hiện danh sách **thành công / thất bại**. Kết thúc quy trình.

## 2b. Quyết định của PO (đã chốt — KHÔNG cần điều tra lại các điểm này)

1. **Nguồn danh sách**: người dùng nạp file Excel **chính là file kết quả của chức năng Chuyển tiếp** (các cột `MA_BG`, `KET_QUA`, `MA_LOI`, `NGUYEN_NHAN`, `THOI_GIAN_XU_LY`). Chỉ lấy dòng `KET_QUA` = "Thành công". Không bắt người dùng làm lại file.
2. **BG thất bại ở một bước** → loại BG đó khỏi các bước sau; các BG còn lại chạy tiếp.
3. **Bước 3**: PO đảm bảo dữ liệu đã được làm sạch trước khi chạy, nên tuyến "Chuyển tiếp" **chỉ chứa BG của danh sách**. Không cần điều tra cách lọc đúng tập BG. Tool vẫn kiểm tra an toàn: nếu "SL bưu gửi chưa lập BĐ13" ≠ số BG đã giao lại thành công ở Bước 2 → **dừng và báo**, không lập.
4. **Bấm "Lập bản kê BĐ13" là bản kê đã được lập**; popup "Xác nhận dịch vụ in BD13" chỉ là hỏi in, chọn HỦY chỉ đóng popup (F5 chỉ để tải lại trang). Chỉ cần **xác nhận bằng quan sát** (số "chưa lập BĐ13" giảm về 0 sau khi lập), không cần điều tra thêm.
5. **Quy trình đúng thì BG không bị dừng ở bước nào**; không cần thiết kế cơ chế chạy tiếp từ giữa chừng. Khi có lỗi: báo cáo kết thúc phải ghi **BG lỗi, lỗi tại bước/module nào, thông báo nguyên văn của hệ thống** (nếu thu được; không thu được thì bỏ qua, không chặn tiến độ).
6. **Có giới hạn số BG mỗi lô**: tool tự chia lô. Cần điều tra **con số giới hạn cụ thể ở từng màn hình** (6.2 ô Mã bưu gửi; Check All/phân trang; 3.2; file import 3.8.1; nút Chuyển bưu gửi).

## 3. Ràng buộc an toàn (BẮT BUỘC)

Quy trình này **thay đổi dữ liệu thật và khó hoàn tác** (vu hồi, giao lại, lập bản kê, chuyển bưu gửi). Do đó:

1. **Người dùng tự đăng nhập** (có captcha). Không nhập/lưu/ghi lại tài khoản, mật khẩu, captcha.
2. **Mặc định chỉ đọc**: mở màn hình, đọc form, mở dropdown, ghi selector, quan sát Network khi tải trang và khi **tìm kiếm** (tìm kiếm không đổi dữ liệu). Tìm kiếm bằng mã BG được phép.
3. **Cấm bấm** các nút làm thay đổi dữ liệu: *Vu hồi*, *Đồng ý* (vu hồi), *Giao lại*, *Lập bản kê BĐ13*, *Chuyển bưu gửi*, *Chuyển … Bưu gửi*, import file lên 3.8.1 — **trừ khi** người dùng cho phép **bằng văn bản trong chat, từng bước một, kèm đúng mã BG test** (mục 8). Mỗi phép chỉ có hiệu lực cho 1 bước và 1 mã BG nêu trong phép đó. Không chắc → hỏi.
4. Được phép **mở popup rồi đóng/hủy** (ví dụ mở popup *Giao lại* để đọc form rồi đóng) chỉ khi chắc chắn việc mở không gửi request thay đổi. Quan sát Network xác nhận trước khi bấm nút kế tiếp.
5. Không xóa/sửa dữ liệu BG nào; không đi sang chức năng ngoài phạm vi (trừ quan sát menu).
6. Mọi bằng chứng (ảnh, HAR, log, file tải về) phải **làm sạch** trước khi lưu: xóa cookie, token (Authorization, `__RequestVerificationToken`, session id), số điện thoại/địa chỉ/tên khách hàng thật (thay giả hoặc che). File mẫu tải từ 3.8.1 nếu chứa dữ liệu thật thì chỉ giữ tiêu đề cột.
7. **Không tự suy đoán**: không xác minh được thì ghi rõ **"CHƯA XÁC MINH"** kèm cách xác minh và quyền cần xin.

## 4. Việc cần làm

Với **mỗi bước (1–4)** lập hồ sơ theo cùng khung A–E dưới đây; thêm phần F (xuyên suốt) và G (Excel).

### A. Luồng và điều kiện
- Đường vào menu (nhãn menu, URL/route, iframe/popup/modal?). Phân biệt đúng module **6.2**, **3.2**, **3.8.1** (tên menu thực tế có thể khác mô tả — ghi nguyên văn).
- Điều kiện để BG xuất hiện trong bảng ở từng màn hình (trạng thái BG, bưu cục, quyền, khoảng ngày lọc mặc định, phân trang). Ví dụ: BG vừa chuyển tiếp xong có hiện ngay ở 6.2 không? Bộ lọc nào đang mặc định ẩn BG?
- Điều kiện để mỗi nút (Vu hồi, Giao lại bưu gửi vu hồi, Lập bản kê, Chuyển bưu gửi) sáng/khóa/ẩn.

### B. Trường và điều khiển
Bảng đầy đủ các điều khiển tương tác (ô lọc, checkbox, nút, dropdown, popup, bảng), mỗi dòng: Nhãn hiển thị | Selector ổn định (id/name/data-*, tránh phụ thuộc vị trí) | Loại control (input/select/select2/checkbox/modal…) | Hành vi khi thao tác | Ghi chú. Đặc biệt:
- **Ô "Mã bưu gửi" (6.2)**: nhận nhiều mã không? Ngăn cách bằng gì (`,` / xuống dòng / khoảng trắng)? **Giới hạn số mã mỗi lần tìm**, giới hạn độ dài ô. Mã không tồn tại/không hợp lệ xử lý ra sao?
- **Check All**: chọn cả trang hiện tại hay toàn bộ kết quả? Có phân trang không (số dòng/trang, đổi được không)? Nếu phân trang, cách chọn đủ N dòng.
- **Popup** (Đồng ý vu hồi; Giao lại + "Giữ tuyến bưu tá"; "Xác nhận dịch vụ in BD13"; popup import thành công; popup "Chuyển … Bưu gửi"): selector, nội dung nguyên văn, nút nào là xác nhận/hủy, có biến số (số lượng) không.
- **Dropdown "Giữ tuyến bưu tá"** (radio, select hay checkbox?) và các lựa chọn khác kèm theo.
- **3.2**: cách nạp dropdown *Tuyến phát* và *Bưu tá* (tĩnh/API/phụ thuộc nhau); nhận diện tuyến tên "Chuyển tiếp" bằng text hay value; điều gì xảy ra nếu **không có** hoặc có **hơn 1** tuyến tên đó; cột "SL bưu gửi chưa lập BĐ13" và cách bấm vào số để mở "Danh sách Bưu gửi".
- **3.8.1**: nút tải file mẫu, nút import, cách chọn file (input type=file?), bảng dữ liệu sau import, Check All, popup xác nhận.

### C. Kỹ thuật gửi dữ liệu (quan trọng nhất)
Với mỗi hành động ghi (Vu hồi, Giao lại, Lập BĐ13, Import, Chuyển bưu gửi) và hành động tìm kiếm — chỉ quan sát khi được phép theo mục 3:
- URL, method, tham số/payload (form/JSON/multipart), headers cần thiết, anti-forgery token (lấy ở đâu), cấu trúc response khi thành công/lỗi.
- **Tìm kiếm / nạp bảng**: request nào, nhận mã BG ra sao, phân trang ra sao, response chứa định danh nội bộ nào (id dòng) mà thao tác ghi cần.
- Thao tác ghi nhận **danh sách id/mã BG** trong 1 request hay từng BG 1 request? Giới hạn kích thước lô.
- Hành động có **bất đồng bộ** không (trả "đã nhận" rồi xử lý nền)? Nếu có, cách biết khi nào xong.
- Kết luận đề xuất từng bước: (1) tự động hóa DOM, hay (2) gọi endpoint nội bộ bằng `fetch` trong ngữ cảnh trang; kèm lý do, rủi ro. Riêng **import Excel ở 3.8.1** nêu rõ cách đưa file vào input (DOM) hoặc endpoint upload (multipart), vì extension phải tự tạo file.
- Phiên đăng nhập: hết hạn thế nào, response hết phiên trông ra sao ở từng endpoint (để dừng an toàn).

### D. Thông báo, lỗi và kết quả
Thu thập nguyên văn, phân loại và đề xuất **mã lỗi chuẩn hóa** (theo khuôn `E..._...` đã dùng ở Chuyển tiếp, thêm tiền tố theo bước, ví dụ `E41_VU_HOI_THAT_BAI`):
- Thông báo thành công từng bước (vị trí: toast/modal/alert, thời gian tồn tại, cách nhận biết bằng DOM hoặc response).
- Thông báo thất bại **từng BG** (ví dụ BG không vu hồi được, BG sai trạng thái, BG không thuộc bưu cục, không giao lại được, không lập được bản kê, 3.8.1 từ chối BG) — nếu chưa kích hoạt được thì "CHƯA XÁC MINH" và đề xuất ca thử.
- **Thành công một phần**: khi lô có BG thành công và BG thất bại, hệ thống báo thế nào (đặc biệt popup kết quả cuối ở 3.8.1 "danh sách thành công, thất bại": cấu trúc, đọc bằng DOM hay response).
- Kiểm tra số lượng: sau mỗi bước, làm sao đối chiếu "số BG đã xử lý" với "số BG kỳ vọng".

### E. Phụ thuộc giữa các bước và giới hạn lô (đã rút gọn theo mục 2b)
- Ghi tên trạng thái BG sau mỗi bước (nếu nhìn thấy) — chỉ để làm tài liệu, không bắt buộc.
- **Giới hạn lô** (trọng tâm): số mã tối đa ô *Mã bưu gửi* ở 6.2; số dòng/trang và Check All có chọn cả trang hay toàn bộ kết quả; số dòng tối đa của file import 3.8.1; số BG tối đa khi bấm *Chuyển bưu gửi*; giới hạn ở 3.2. Đề xuất kích thước lô an toàn.
- Bước 3: ghi cách đọc cột "SL bưu gửi chưa lập BĐ13" của tuyến "Chuyển tiếp" (DOM/response) và số kỳ vọng sau khi lập; xác nhận sau khi bấm *Lập bản kê BĐ13* + HỦY thì số này giảm (chỉ khi được phép thử, mục 3).
- Chạy lại 1 bước cho BG đã xử lý rồi thì hệ thống báo gì (chỉ ghi nếu thu được an toàn).
- Bước 4: 3.8.1 yêu cầu BG ở trạng thái nào; file mẫu cần **chỉ mã BG** hay thêm trường khác (lý do, bưu cục nhận…).

### F. Quan sát bổ sung (chỉ đọc)
- Có màn hình tra cứu **trạng thái / lịch sử** một BG (3.9 hoặc nơi khác) đủ để extension xác minh kết quả sau mỗi bước không.
- Có chức năng hoàn tác từng bước không (chỉ mô tả; không thao tác).

### G. File Excel
1. **File mẫu của 3.8.1 (Bước 4)**: tải về (nếu tải được chỉ-đọc), ghi lại sheet, **tên cột chính xác, thứ tự, kiểu dữ liệu, cột bắt buộc, ví dụ, dòng bắt đầu dữ liệu**, ràng buộc (số dòng tối đa, định dạng mã BG, Text/Number). Lưu bản đã xóa dữ liệu vào `docs/audit-xuly30/` (chỉ tiêu đề + ví dụ giả). Extension sẽ tự **sinh file này** để import nên cần khớp tuyệt đối.
2. **File đầu vào của "Xử lý 3.0"**: đề xuất định dạng (cột `MA_BG` + các cột kết quả theo bước, ví dụ `KQ_VU_HOI`, `KQ_GIAO_LAI`, `KQ_BD13`, `KQ_CHUYEN_30`, `MA_LOI`, `NGUYEN_NHAN`, `THOI_GIAN_XU_LY`), hoặc cách nhận danh sách từ kết quả Chuyển tiếp đã có. Chỉ đề xuất; PO sẽ chốt.

## 5. Sản phẩm bàn giao (thư mục `docs/audit-xuly30/`)

| File | Nội dung |
|---|---|
| `01-luong-thao-tac.md` | Mục A, 4 bước, ảnh đã làm sạch |
| `02-dieu-khien-va-popup.csv` + `.md` | Mục B (CSV cùng nội dung) |
| `03-ky-thuat-gui-du-lieu.md` | Mục C, kết luận hướng DOM/fetch từng bước |
| `04-thong-bao-loi-va-ma-loi.md` | Mục D |
| `05-phu-thuoc-va-chay-lai.md` | Mục E (đặc biệt bước 3 và HỦY in BĐ13) |
| `06-quan-sat-bo-sung.md` | Mục F |
| `mau-import-3.8.1.xlsx` + `07-file-excel.md` | Mục G |
| `fixtures/` | HTML/JSON response đã làm sạch (tìm kiếm 6.2, bảng 3.2, danh sách BG, kết quả 3.8.1…) để dùng làm fixture test |
| `evidence/` | Ảnh chụp, HAR đã làm sạch |
| `00-tong-hop-va-rui-ro.md` | 1 trang: phát hiện chính, danh sách "CHƯA XÁC MINH", rủi ro, câu hỏi cần PO quyết |

## 6. Định nghĩa hoàn thành
- Mỗi bước 1–4 có đủ: điều khiển với selector đã kiểm tra, request tìm kiếm đã ghi, hành động ghi đã ghi (hoặc ghi rõ "CHƯA XÁC MINH" kèm lý do và ca thử cần phép).
- Biết giới hạn số mã BG mỗi lần tìm ở 6.2 và cách chọn đủ N dòng khi phân trang.
- Trả lời được 3 câu then chốt: (a) giới hạn số BG mỗi lô ở từng màn hình và kích thước lô đề xuất; (b) cách đọc số "SL bưu gửi chưa lập BĐ13" ở bước 3; (c) cách đọc kết quả thành công/thất bại từng BG ở bước 4, và thông báo lỗi nguyên văn theo từng module nếu thu được.
- Có file mẫu 3.8.1 với tên cột chính xác.
- Có fixture đã làm sạch cho mọi màn hình đọc được.
- Không có thông tin đăng nhập hay dữ liệu khách hàng thật trong bất kỳ tệp nào. Không có dòng code extension nào được tạo.

## 7. Câu hỏi còn mở
Các câu về nguồn danh sách, xử lý BG lỗi, bước 3 và chia lô đã chốt ở mục 2b. Antigravity chỉ bổ sung các câu mới phát sinh từ phát hiện thực tế vào `00-tong-hop-va-rui-ro.md`.

## 8. Cách làm việc
- Trước khi làm, nhắc người dùng tự đăng nhập và mở sẵn module 6.2; chờ xác nhận.
- Làm phần **chỉ đọc** của cả 4 bước trước, báo cáo tiến độ ngắn gọn theo từng bước.
- Khi cần chạy thử thao tác ghi, dừng và xin phép theo mẫu, **mỗi bước một phép riêng**:
  > "Cho phép thử Bước <N> (<tên thao tác>) với mã BG test: <mã>. Chấp nhận thay đổi dữ liệu của BG này."
- Nên đề nghị người dùng chuẩn bị **1–2 BG test** đi đủ 4 bước, và thêm **1 BG cố ý sai** (sai trạng thái) để thu thông báo thất bại.
- Gặp điểm cần quyết định thì dừng và hỏi, không tự quyết.
