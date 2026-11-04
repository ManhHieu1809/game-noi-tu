# Nhìn hình đoán chữ - Tranh troll / thành ngữ (nhánh review)

## Lối chơi mới
- Chủ phòng tạo phòng bình thường, chọn **Nhìn hình đoán chữ** rồi bắt đầu khi có >= 2 người.
- **112 câu đố tiếng Việt được biên soạn riêng**, mỗi câu có ba cảnh gợi ý kiểu tranh comic/meme, không còn bộ hỏi tên một đồ vật thông thường.
- Tất cả người chơi giải ý của **cả bức tranh**: thành ngữ, tục ngữ, câu nói vui, không chỉ nhập tên biểu tượng.
- Mỗi câu có 40 giây. Người đúng nhanh được nhiều điểm hơn. Hết giờ hoặc khi tất cả đoán đúng, đáp án xuất hiện rồi chuyển sang câu tiếp theo.
- **KHÔNG có giới hạn 8, 10 hay bất cứ số câu nào cho một ván.** Hệ thống tuần tự dùng các đáp án chưa gặp, khi hết ngân hàng thì xáo lại. Số câu vẫn tăng và bảng điểm tiếp tục cộng.
- Chủ phòng có nút **Kết thúc trò chơi** ngay trên tranh (và ở khu vực điều khiển). Chỉ khi chủ phòng xác nhận, game mới sang kết quả. Người tham gia không có quyền kết thúc.
- Lịch sử câu hỏi đã gặp được ưu tiên chống lặp ở máy chủ phòng (localStorage). Hết toàn bộ câu khả dụng thì vẫn cần lặp lại, vì số câu độc nhất hữu hạn.

## Tranh và nguồn asset
- Tranh comic ba ô hiện tại được **vẽ bằng HTML/CSS và biểu tượng Unicode** theo dữ liệu do dự án tự biên soạn, không dùng ảnh meme lấy trộm hoặc phụ thuộc dịch vụ tạo ảnh trực tuyến. Đây là bản làm được ngay; **chưa phải gói ảnh AI vẽ từng bức**.
- Dữ liệu câu đố nằm trong `js/games/image-quiz/rebus.js`. Nếu sau này có tranh AI đã được kiểm duyệt, hãy bổ sung vào `assets/image-quiz/rebus-questions.json` dưới dạng đối tượng:
```json
{
  "questions": [{
    "id": "custom-001",
    "answer": "đầu voi đuôi chuột",
    "aliases": [],
    "category": "Thành ngữ",
    "difficulty": "hard",
    "scene": ["🐘🎩", "✂️🧵", "🐭🌀"],
    "imageUrl": "assets/image-quiz/my-custom-comic.webp",
    "attribution": "Tự vẽ / nguồn + tác giả (nếu cần)"
  }]
}
```
- `imageUrl` có thể là ảnh WEBP/PNG nằm trong thư mục asset hợp lệ hoặc URL HTTPS có giấy phép. Khi ảnh lỗi, ba cảnh tranh comic là phương án dự phòng.
- Script `scripts/build-image-quiz.mjs` **là importer ảnh chụp cho game đoán tên đồ vật cũ**; nó KHÔNG được dùng làm nguồn cho chế độ troll mới. Không nên chạy script cũ rồi mong câu đố troll biến thành tranh AI.
- Câu hỏi mới cần được kiểm duyệt để tránh gợi ý quá hiển nhiên, mơ hồ hoặc đáp án không phù hợp. Những biểu tượng comic là gợi ý, không bảo đảm mọi người hiểu theo cùng một cách.

## Khởi chạy và kiểm tra
```sh
npm start
npm test
```
Mở http://localhost:3000 ở hai trình duyệt (hoặc hai thiết bị), vào cùng mã phòng, chọn game và thử đoán. Trên điện thoại, nút **Kết thúc trò chơi** cũng nằm ngay phía trên tranh với chủ phòng.

Bản này không thêm backend mới, vẫn dùng PeerJS/WebRTC và bộ điều phối phòng hiện tại. Vì câu hỏi là tệp tĩnh trong client, người cố tình xem mã nguồn có thể tìm được đáp án; nếu cần chống gian lận, chuyển kho đáp án vào backend.
