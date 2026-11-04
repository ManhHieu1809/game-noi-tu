# Nhìn Hình Đoán Chữ — hai chế độ (nhánh feature/image-quiz)

## Cách chơi
Chủ phòng tạo phòng, chọn **Nhìn hình đoán chữ**, rồi chọn:

- **Ca dao · Tục ngữ · Thành ngữ** (`idiom`): 112 câu hỏi comic 3 khung tranh, giải nghĩa bằng suy luận.
- **Đoán vật thể ảnh khó** (`object`): 467 đáp án đồ dùng, con vật, món ăn, rau quả, công nghệ... Ảnh bị zoom/crop, che vùng nhìn và mờ rồi rõ dần trong 40 giây. Có ảnh thật nếu nhập được ngân hàng Wikimedia, ngoài ra có hình gợi ý emoji được làm khó để hoạt động offline.

Mỗi câu có 40 giây. Đúng sớm được nhiều điểm; tất cả cùng đoán. **Không có giới hạn số vòng**. Hết một câu tự chuyển câu kế tiếp, không tự kết thúc game. Chỉ chủ phòng bấm **Kết thúc trò chơi** để chốt điểm.

## Chống lặp nghiêm ngặt

- Mỗi đáp án tiếng Việt sau khi chuẩn hóa (không dấu, chữ thường) chỉ xuất hiện **một lần trên thiết bị chủ phòng** trong toàn bộ lịch sử chơi ở từng chế độ, kể cả có nhiều ảnh cho cùng một đáp án.
- Lịch sử được lưu ở `localStorage`: `noitu.imageQuiz.seen.v2.idiom` và `noitu.imageQuiz.seen.v2.object`. Bộ thành ngữ còn nhập lịch sử phiên cũ `seen.v1`.
- Mỗi khi bắt đầu ván mới cũng ưu tiên *chỉ những đáp án chưa gặp*. Game không lặp khi hết ngân hàng. Thay vào đó giữ phòng ở trạng thái chơi, hiển thị **Hết câu mới**, chờ chủ phòng kết thúc hoặc bổ sung dữ liệu và tạo ván mới.
- Lịch sử chỉ tồn tại ở **trình duyệt thiết bị làm host**: đổi thiết bị chủ phòng, xóa dữ liệu trình duyệt hoặc mở tab riêng tư sẽ mất khả năng bảo đảm xuyên phòng. Muốn đồng bộ với tài khoản cần backend và kho lưu trữ tập trung.
- Trong dữ liệu hữu hạn, không thể bảo đảm chơi vô hạn *và* không trùng; cơ chế này ưu tiên **không trùng** hơn việc tự lặp câu.

## Nguồn hình và câu hỏi

1. `js/games/image-quiz/rebus.js`: 112 gợi ý tranh comic tự biên soạn.
2. `js/games/image-quiz/seed.js` + `objects.js`: 467 đáp án vật thể gắn tên bài Wikipedia để truy vấn thumbnail. **Đây là 467 mục dữ liệu và minh họa dự phòng, không phải 467 ảnh chụp đã nhập sẵn.**
3. Chạy `npm run build:object-quiz` (cần kết nối Internet) để kiểm tra Wikipedia thumbnail + Wikimedia Commons `imageinfo`, chỉ giữ file có metadata giấy phép phù hợp và ghi thông tin tác giả. Kết quả ở `assets/image-quiz/object-questions.json`. Nguồn tham khảo: https://www.mediawiki.org/wiki/API:Imageinfo
4. `.github/workflows/build-object-quiz.yml` có quy trình tạo ảnh qua GitHub Actions trên nhánh feature. Dữ liệu sinh ra có `reviewStatus`; cần **kiểm tra ảnh có đúng chủ đề, điều kiện giấy phép và ghi công trước khi phát hành**. Dữ liệu đã nhập ghi đè fallback trùng ID; nếu chưa nhập hoặc ảnh hỏng, hình emoji vẫn hoạt động.
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
