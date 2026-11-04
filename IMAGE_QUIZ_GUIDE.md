# Nhìn Hình Đoán Chữ — hai chế độ (bản sửa ảnh hiển thị rõ)

## Cách chơi
Chủ phòng tạo phòng, chọn **Nhìn hình đoán chữ**, rồi chọn:

- **Ca dao · Tục ngữ · Thành ngữ** (`idiom`): 112 câu hỏi comic 3 khung tranh, giải nghĩa bằng suy luận.
- **Đoán vật thể ảnh khó** (`object`): 467 đáp án đồ dùng, con vật, món ăn, rau quả, công nghệ... **Ảnh hiển thị đầy đủ và rõ nét ngay từ giây đầu**, không zoom, crop hay làm mờ. Mọi người có 40 giây để trả lời; **hết giờ mới công bố đáp án**, kể cả nếu tất cả đã đoán đúng sớm. Có ảnh thật từ Wikimedia, emoji là hình dự phòng khi tải ảnh lỗi.

Mỗi câu có 40 giây đếm ngược. Đúng sớm được nhiều điểm; tất cả cùng đoán. Ở chế độ **Đoán vật thể**, đáp án chỉ công bố khi đồng hồ về 0. Chế độ **Thành ngữ** giữ nguyên cơ chế hiện sớm đáp án nếu tất cả người chơi đã đoán đúng. **Không có giới hạn số vòng**. Hết một câu tự chuyển câu kế tiếp, không tự kết thúc game. Chỉ chủ phòng bấm **Kết thúc trò chơi** để chốt điểm.

## Chống lặp nghiêm ngặt

- Mỗi đáp án tiếng Việt sau khi chuẩn hóa (không dấu, chữ thường) chỉ xuất hiện **một lần trên thiết bị chủ phòng** trong toàn bộ lịch sử chơi ở từng chế độ, kể cả có nhiều ảnh cho cùng một đáp án.
- Lịch sử được lưu ở `localStorage`: `noitu.imageQuiz.seen.v2.idiom` và `noitu.imageQuiz.seen.v2.object`. Bộ thành ngữ còn nhập lịch sử phiên cũ `seen.v1`.
- Mỗi khi bắt đầu ván mới cũng ưu tiên *chỉ những đáp án chưa gặp*. Game không lặp khi hết ngân hàng. Thay vào đó giữ phòng ở trạng thái chơi, hiển thị **Hết câu mới**, chờ chủ phòng kết thúc hoặc bổ sung dữ liệu và tạo ván mới.
- Người chơi guest cũng lưu đáp án khi đáp án được công bố. Khi gia nhập phòng mới, guest chia sẻ **chỉ ID hình đã xem và khóa đáp án từng gặp** cho host. Chủ phòng hợp nhất các lịch sử hợp lệ trước khi chơi và tránh hỏi lại những câu mà người trong nhóm đã gặp; không gửi lại tên hay điểm cũ.
- Lịch sử vẫn phụ thuộc vào **các trình duyệt đang tham gia phòng**. Nếu đổi nhóm hoàn toàn, xóa dữ liệu, dùng thiết bị mới hay chế độ riêng tư, không thể bảo đảm chống lặp toàn cục. Muốn đồng bộ vĩnh viễn giữa mọi người cần backend/tài khoản.
- Trong dữ liệu hữu hạn, không thể bảo đảm chơi vô hạn *và* không trùng; cơ chế này ưu tiên **không trùng** hơn việc tự lặp câu.

## Nguồn hình và câu hỏi

1. `js/games/image-quiz/rebus.js`: 112 gợi ý tranh comic tự biên soạn.
2. `js/games/image-quiz/seed.js` + `objects.js`: 467 đáp án vật thể gắn tên bài Wikipedia để truy vấn thumbnail. **249 ảnh Wikimedia khác nhau đã được nhập vào `object-questions.json`** ở lần build gần nhất (cần duyệt lại nội dung và ghi công). Những đáp án chưa có ảnh thật được giữ làm ứng viên để nhập thêm, không hiện emoji dễ đoán nếu ngân hàng ảnh thật đủ lớn.
3. Chạy `npm run build:object-quiz` (cần kết nối Internet) để kiểm tra Wikipedia thumbnail + Wikimedia Commons `imageinfo`, chỉ giữ file có metadata giấy phép phù hợp và ghi thông tin tác giả. Kết quả ở `assets/image-quiz/object-questions.json`. Nguồn tham khảo: https://www.mediawiki.org/wiki/API:Imageinfo
4. `.github/workflows/build-object-quiz.yml` có quy trình tạo ảnh qua GitHub Actions trên nhánh feature. Tính đến lần nhập gần nhất đã có **249 ảnh thật được chọn theo metadata giấy phép** trong JSON (cần kiểm duyệt lại chủ thể trước khi dùng ở production). Script nhập gia tăng từng đợt (`--batch=90` mặc định), dừng lịch sự khi Wikimedia giới hạn 429 và không xóa dữ liệu đã có. Dữ liệu sinh ra có `reviewStatus`; cần **kiểm tra ảnh có đúng chủ đề, điều kiện giấy phép và ghi công trước khi phát hành**. Khi bộ ảnh thật đủ lớn, game chỉ chọn câu có ảnh thật; nếu một ảnh tải lỗi, hình emoji của cùng câu là phương án dự phòng. Nếu chưa nhập được ngân hàng, game vẫn có bộ gợi ý emoji offline.
5. Có thể bổ sung tranh của bạn vào `assets/image-quiz/rebus-questions.json` hay `assets/image-quiz/object-questions.json`, mỗi câu có `id`, `answer`, `aliases`, `category`, `difficulty`, `imageUrl` (đường dẫn HTTPS hoặc `assets/image-quiz/...`) và `emoji`/`scene` dự phòng.

## Khởi chạy và thử

```bash
npm start
npm test
# Khi muốn nhập ảnh thật (Internet + kiểm tra quyền ảnh)
npm run build:object-quiz
```

Vào http://localhost:3000 trên hai trình duyệt hoặc hai máy, tạo phòng, chọn mode và bắt đầu. Để kiểm tra có còn câu mới, nhìn dòng bên dưới nút Bắt đầu trong phòng chờ. Nếu gặp lỗi ảnh, kiểm tra Network/Console và thử chạy importer.

**Giới hạn:** Đây vẫn là trò P2P do host điều phối, không có server bảo vệ ngân hàng đáp án. Người biết kỹ thuật có thể kiểm tra các câu được gửi dưới dạng assets JavaScript; muốn chống gian lận nghiêm ngặt cần backend kiểm tra đáp án.
