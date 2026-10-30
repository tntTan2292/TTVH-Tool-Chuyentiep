# PROMPT GIAO VIỆC CHO ANTIGRAVITY — AUDIT MODULE 3.9 + FILE EXCEL MẪU

> Vai trò: bạn là QA/Business Analyst kỹ thuật. Nhiệm vụ này CHỈ audit và tài liệu hóa. KHÔNG viết code extension.

## 1. Bối cảnh

Dự án: Chrome Extension tự động nhập **chuyển tiếp chi tiết bưu gửi (BG)** hàng loạt từ file Excel trên hệ thống **https://packnsend.vnpost.vn/** (module **3.9 - Quản lý vận đơn**, trang `van-don.html`).

Mục tiêu cuối: người dùng đăng nhập thủ công → mở extension → import Excel → extension tự nhập chuyển tiếp từng BG → báo cáo chính xác **thành công bao nhiêu / thất bại bao nhiêu (kèm nguyên nhân từng BG)**.

Việc cần làm ở bước này: audit tab **Chuyển tiếp** của một bưu gửi để biết chính xác các trường, ràng buộc, cách hệ thống gửi dữ liệu và các lỗi; sau đó thiết kế file Excel mẫu theo đúng các trường bắt buộc.

## 2. Ràng buộc an toàn (BẮT BUỘC tuân thủ)

1. **Người dùng tự đăng nhập** (có captcha). Không nhập, không lưu, không ghi lại tài khoản/mật khẩu/captcha ở bất kỳ đâu.
2. **Không bấm Lưu/Xác nhận chuyển tiếp trên bưu gửi thật** nếu chưa được người dùng cho phép bằng văn bản trong chat, kèm đúng mã BG test. Khi chưa có phép: chỉ đọc form, mở dropdown, và nếu cần chỉ kích hoạt validation phía client (để hiện thông báo "bắt buộc") nếu việc đó chắc chắn không gửi request lưu lên server. Không chắc → hỏi người dùng trước.
3. **Không xóa, sửa dữ liệu** của BG nào.
4. Mọi file bằng chứng (ảnh, HAR, log) phải được **làm sạch** trước khi lưu: xóa cookie, token (Authorization, `__RequestVerificationToken`, session id), số điện thoại/địa chỉ thật của khách hàng (thay bằng dữ liệu giả hoặc che).
5. Chỉ thao tác trong module liên quan; không đi sang chức năng khác ngoài phạm vi (trừ mục 3.E chỉ để quan sát).
6. Không tự suy đoán: thứ gì không xác minh được thì ghi rõ **"CHƯA XÁC MINH"** kèm cách xác minh.

## 3. Việc cần làm

### A. Luồng thao tác để tới tab Chuyển tiếp
- Ghi từng bước: từ menu 3.9 → tìm BG (ô "Mã vận đơn" cho phép nhiều mã ngăn cách dấu `,` — xác nhận giới hạn số mã, định dạng mã hợp lệ) → mở BG → tab Chuyển tiếp.
- Điều kiện để BG được phép chuyển tiếp (trạng thái vận đơn nào, quyền nào, nút bị ẩn/khóa khi nào).
- Tab Chuyển tiếp mở bằng popup/modal hay trang riêng? URL/route? Có iframe không?

### B. Danh sách trường của tab Chuyển tiếp
Lập bảng đầy đủ **mọi trường**, mỗi trường gồm:

| STT | Nhãn hiển thị | Selector ổn định (id / name / data-*; ưu tiên không phụ thuộc vị trí) | Loại control (input/select/select2/datepicker/radio/checkbox/textarea) | Bắt buộc? (dấu `*`, thuộc tính `required`, hay chỉ server kiểm tra) | Định dạng/độ dài tối đa/regex | Giá trị mặc định | Phụ thuộc trường khác | Ghi chú |

Đặc biệt lưu ý:
- Dropdown: liệt kê **toàn bộ option** (value + text) hoặc cách nạp (tĩnh / gọi API khi gõ / phụ thuộc cấp trên như Tỉnh → Huyện → Xã). Nếu list quá dài, chỉ ghi nguồn nạp + 10 mẫu + cách tra.
- Trường tự động điền sẵn từ BG (chỉ đọc) và trường người dùng phải nhập.
- Trường ngày/giờ: định dạng nhập, có chặn ngày quá khứ/tương lai không.
- Trường chỉ hiện theo điều kiện (ví dụ chọn loại này mới hiện ô kia).
- Kiểu autocomplete / select2 / typeahead: cách chọn bằng bàn phím hoặc chuột, có cần chờ tải không (ảnh hưởng độ ổn định của tự động hóa).

### C. Kỹ thuật gửi dữ liệu (quan trọng nhất để chọn giải pháp)
Dùng DevTools (Network, lọc Fetch/XHR) ở chế độ **quan sát**:
- Khi nạp tab Chuyển tiếp: các request nào được gọi (URL, method, tham số, kiểu response) — nhất là các request nạp danh mục.
- Khi bấm Lưu (**chỉ khi đã được phép theo mục 2.2**): URL, method, headers cần thiết (anti-forgery token? header tùy biến?), payload (form-urlencoded/JSON/multipart), cấu trúc response khi thành công và khi lỗi.
- Có anti-forgery/CSRF token không, lấy từ đâu (cookie, input ẩn, meta), hết hạn khi nào.
- Cơ chế đăng nhập/phiên: hết phiên sau bao lâu, khi hết phiên response trông thế nào (redirect về login hay trả JSON), để extension nhận biết và dừng an toàn.
- Giới hạn tốc độ: có throttle/ban khi gọi liên tiếp không (chỉ quan sát tài liệu/response, không thử spam).
- Kết luận đề xuất, kèm lý do và rủi ro, một trong hai hướng:
  - (1) Tự động hóa DOM (điền form và bấm nút như người dùng);
  - (2) Gọi lại endpoint nội bộ bằng `fetch` trong ngữ cảnh trang (kế thừa phiên đăng nhập).

### D. Danh mục thông báo lỗi và kết quả
Thu thập (không gây lưu dữ liệu thật) và phân loại các thông báo:
- Lỗi thiếu trường bắt buộc (nguyên văn từng thông báo).
- Lỗi sai định dạng.
- Lỗi nghiệp vụ phía server (BG không đủ điều kiện, BG đã chuyển tiếp, không có quyền, trùng lặp…) — nếu chưa thể kích hoạt thì ghi "CHƯA XÁC MINH" và đề xuất bộ ca kiểm thử cần người dùng cho phép.
- Thông báo thành công (nguyên văn, vị trí hiển thị: toast/modal/alert, thời gian tồn tại, cách nhận biết bằng DOM hoặc response).
- Với mỗi thông báo: đề xuất **mã lỗi chuẩn hóa** cho báo cáo (ví dụ `E01_THIEU_TRUONG`, `E02_SAI_DINH_DANG`, `E10_BG_KHONG_TON_TAI`, `E11_BG_KHONG_DU_DIEU_KIEN`, `E90_HET_PHIEN`, `E99_KHONG_XAC_DINH`).

### E. Quan sát chức năng liên quan (chỉ đọc)
Ghi nhận trong menu (đặc biệt 3.8 Quản lý BG chuyển tuyến, 3.13 Quản lý chuyển hoàn) có sẵn tính năng nhập hàng loạt / import Excel / xuất mẫu nào có thể tái sử dụng hoặc làm tham chiếu định dạng không. Chỉ mô tả, không thao tác thay đổi dữ liệu.

### F. Thiết kế file Excel mẫu
Dựa trên kết quả B và D, tạo file `docs/audit/mau-import-chuyen-tiep.xlsx` (dùng openpyxl hoặc tương đương), gồm:
- **Sheet `ChuyenTiep`** — mỗi dòng 1 BG. Một cột cho mỗi trường bắt buộc; các trường tùy chọn đặt sau và tô màu khác. Dòng tiêu đề đặt tên cột ổn định (khớp mã trường, không dấu, không khoảng trắng thừa). Thêm cột cố định: `MA_BG`. Thêm cột kết quả để extension ghi lại: `KET_QUA`, `MA_LOI`, `NGUYEN_NHAN`, `THOI_GIAN_XU_LY`.
- **Sheet `HuongDan`** — mô tả từng cột: bắt buộc/tùy chọn, định dạng, ví dụ, giá trị hợp lệ.
- **Sheet `DanhMuc`** — danh mục dùng cho dropdown (Data Validation tham chiếu sheet này).
- Data Validation trong Excel cho cột có danh mục; định dạng cột mã BG và điện thoại là **Text** (tránh mất số 0 đầu, tránh dạng khoa học).
- 3–5 dòng ví dụ bằng **dữ liệu giả**, rõ ràng không phải dữ liệu thật.
- Quy tắc kiểm tra file (validate) đề xuất: tiêu đề thiếu, dòng trống, mã BG trùng trong file, ô bắt buộc trống, sai định dạng — ghi vào `HuongDan`.

## 4. Sản phẩm bàn giao (trong thư mục `docs/audit/`)

| File | Nội dung |
|---|---|
| `01-luong-thao-tac.md` | Mục A kèm ảnh minh họa đã làm sạch |
| `02-truong-tab-chuyen-tiep.md` | Bảng mục B (và bản `.csv` cùng nội dung) |
| `03-ky-thuat-gui-du-lieu.md` | Mục C, có kết luận đề xuất hướng (1) hay (2) |
| `04-thong-bao-loi-va-ma-loi.md` | Mục D |
| `05-tinh-nang-lien-quan.md` | Mục E |
| `mau-import-chuyen-tiep.xlsx` | Mục F |
| `evidence/` | Ảnh chụp, HAR đã làm sạch |
| `00-tong-hop-va-rui-ro.md` | Tóm tắt 1 trang: phát hiện chính, danh sách "CHƯA XÁC MINH", rủi ro, câu hỏi cần PO quyết |

## 5. Định nghĩa hoàn thành
- Mọi trường của tab Chuyển tiếp có trong bảng, mỗi trường có selector đã kiểm tra hoạt động.
- Biết rõ trường nào bắt buộc (nêu bằng chứng: dấu `*`, thuộc tính, hoặc thông báo lỗi).
- Có kết luận kỹ thuật cho cách gửi dữ liệu, hoặc ghi rõ lý do chưa kết luận được và cần người dùng cho phép thử gì.
- File Excel mở được, Data Validation hoạt động, cột khớp bảng trường.
- Không có thông tin đăng nhập hay dữ liệu khách hàng thật trong bất kỳ file nào.
- Không có dòng code extension nào được tạo.

## 6. Cách làm việc
- Trước khi làm, nhắc người dùng tự đăng nhập và mở sẵn tab Chuyển tiếp của một BG; chờ xác nhận.
- Khi gặp điểm cần quyết định hoặc cần quyền thử thao tác, dừng và hỏi người dùng, không tự quyết.
- Báo cáo tiến độ ngắn gọn theo từng mục A–F.
