# QUAN HỆ PHỤ THUỘC GIỮA CÁC BƯỚC VÀ RÀNG BUỘC CHẠY LẠI (MỤC E)

---

## 1. Mối quan hệ chuỗi trạng thái bưu gửi

Quy trình "Xử lý 3.0" là một chuỗi biến đổi trạng thái liên tục qua 4 module:

```
[Bưu gửi đã Chuyển tiếp C39]
              │
              ▼ (Bước 1: Vu hồi tại 6.2)
[StatusCode = 'R' - Đã vu hồi]
              │
              ▼ (Bước 2: Giao lại bưu hồi tại 6.2)
[Bưu gửi thuộc Tuyến Chuyển tiếp - Chờ lập BĐ13]
              │
              ▼ (Bước 3: Lập bản kê BĐ13 tại 3.2)
[Đã lập BĐ13 xong - Sẵn sàng tạo yêu cầu chuyển]
              │
              ▼ (Bước 4: Chuyển bưu gửi tại 3.8.1)
[Bưu gửi quay về quy trình xử lý tại 3.0]
```

---

## 2. Ràng buộc an toàn theo quyết định của PO

1. **Loại trừ lỗi từng bưu gửi:**
   - Nếu bưu gửi bị lỗi ở Bước N, hệ thống tự động loại bỏ bưu gửi đó ra khỏi danh sách xử lý ở Bước N+1.
   - Các bưu gửi thành công còn lại tiếp tục được xử lý bình thường.
2. **Kiểm tra đối chiếu số lượng tại Bước 3:**
   - Trước khi click mở bảng lập BĐ13: Extension đọc số tại cột "SL bưu gửi chưa lập BD13".
   - **Nếu số này ≠ số bưu gửi vừa giao lại thành công ở Bước 2 ➔ Dừng ngay tiến trình và cảnh báo**, không tự ý lập bản kê để tránh gom nhầm bưu gửi của người khác.
3. **Giới hạn kích thước lô an toàn:**
   - Ô tìm kiếm 6.2: Khuyên dùng tối đa **30 - 50 bưu gửi/lần**.
   - Phân trang 6.2: `pageLen: -1` (toàn bộ hiển thị trên 1 trang).
   - Import 3.8.1: Chấp nhận danh sách mảng JSON tương ứng với lô 30 - 50 bưu gửi.

