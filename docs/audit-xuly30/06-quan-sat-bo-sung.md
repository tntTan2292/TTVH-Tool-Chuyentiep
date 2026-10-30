# QUAN SÁT BỔ SUNG VÀ KHẢO SÁT CHỈ ĐỌC (MỤC F)

---

## 1. Màn hình tra cứu lịch sử hành trình bưu gửi
- Có thể dùng màn hình **3.9 - Quản lý vận đơn** (`/van-don.html`) hoặc popup tra cứu lịch sử hành trình để kiểm tra lại dòng thời gian của bưu gửi.
- Bưu gửi sau khi đi qua quy trình 3.0 sẽ có đầy đủ các vết:
  - Báo phát chuyển tiếp.
  - Vu hồi kho.
  - Phân hướng giao lại bưu tá.
  - Lập bản kê BĐ13.
  - Tạo yêu cầu chuyển bưu gửi về 3.0.

## 2. Khả năng hoàn tác
- Các nghiệp vụ: Vu hồi, Giao lại, Lập BĐ13 và Chuyển bưu gửi là các hành động **ghi trực tiếp vào cơ sở dữ liệu và chuyển trạng thái luân chuyển của bưu gửi**, không có nút hoàn tác 1-click trên giao diện.
- Do đó, Extension cần áp dụng cơ chế xác nhận rõ ràng và kiểm tra số lượng chặt chẽ trước khi thực thi từng bước.

