# Tích hợp AI tạo tranh troll tự động (300 ảnh mục tiêu)

Mục tiêu: **240 ảnh vật thể + 60 tranh thành ngữ**, mỗi ảnh có đáp án tiếng Việt, minh hoạ rõ nét ngay từ đầu, đánh lạc hướng hài hước nhưng vẫn đoán được.

**Trạng thái thực tế:** Công cụ đã được tích hợp vào code, nhưng không có khoá API thì không thể tạo ảnh AI thật. Hai tệp `assets/image-quiz/ai-object-questions.json` và `ai-idiom-questions.json` ban đầu chứa mảng rỗng. ĐỪNG báo chúng đã có 300 ảnh nếu chưa chạy thành công.

## Cách vận hành

1. Trong GitHub repository vào **Settings → Secrets and variables → Actions → New repository secret**. Tạo secret **OPENAI_API_KEY**. KHÔNG đưa khoá vào code, chat, commit hay GitHub Actions log.
2. Trên nhánh `feature/ai-troll-image-bank` workflow `.github/workflows/generate-ai-quiz.yml` tự chạy khi code tạo ảnh được đẩy lên. Nếu chưa có secret, workflow bỏ qua bước tốn tiền.
3. Khi workflow có thể kích hoạt thủ công trên GitHub Actions, chọn **Generate and check AI troll artwork → Run workflow**. Mặc định mục tiêu là 240 vật thể và 60 thành ngữ. Mỗi lần chạy có thể thay các mức mục tiêu để thử nhỏ trước.
4. Workflow tạo ảnh với `gpt-image-2.5-flare`, dùng `gpt-4.1-mini` đánh giá trực quan. Những ảnh vượt ngưỡng chất lượng mới được tự động thêm vào ngân hàng `ai-*-questions.json`. Ảnh không đạt bị loại và đánh dấu để **không tính phí tạo lại vô hạn**.
5. Workflow commit từng nhóm (tối đa 8 ảnh/call script) lên đúng nhánh. **Có thể đạt ít hơn 300 ảnh** nếu AI trả lỗi, ảnh bị từ chối, hết số đáp án khả dụng, quota hoặc chi phí.
6. Khi sinh ảnh hoàn tất, review thống kê và merge nhánh chứa **các ảnh đã thực sự tạo ra** vào `master`. Không trộn lời hứa 300 ảnh với số tệp đã tồn tại.

## Chạy thử trên máy, không gọi API

```bash
npm run ai:dry-run
npm test
```

## Chạy theo lô thủ công (cần khoá, có phí)

```bash
# Windows PowerShell
$env:OPENAI_API_KEY = "KEY_FROM_SECURE_ENV"
node scripts/generate-ai-quiz.mjs --mode=object --limit=8 --attempts=2 --style=misdirection
node scripts/generate-ai-quiz.mjs --mode=idiom --limit=8 --attempts=2 --style=comic
```

Các câu đã qua AI QA được đưa vào `assets/image-quiz/ai-object-questions.json` và `ai-idiom-questions.json` kèm ảnh thật `assets/image-quiz/ai/<mode>/*.webp`. Chế độ chơi ưu tiên ảnh AI đã tự duyệt hơn ảnh Wikimedia / tranh comic cũ **nếu tồn tại**, nhưng không bao giờ bị phá vỡ nếu chưa có ảnh AI.

## Bản quyền, QA và chi phí

- Mỗi ảnh tạo ra có phí API. **Không có cơ sở để khẳng định một số tiền cố định**: phụ thuộc model, số lượt tạo và đánh giá. Đặt giới hạn ngân sách phù hợp trong tài khoản OpenAI trước khi chạy 300 ảnh.
- AI kiểm tra đúng đối tượng, có thể đoán được, hài hước và không có chữ; vẫn có thể đánh giá sai. Nên xem ngẫu nhiên ảnh trước khi public rộng rãi.
- **Không generate trong vòng chơi**: sinh offline rồi lưu WEBP vào repo để mọi người tải nhanh và đồng nhất qua WebRTC.
- Chỉ dùng ảnh có metadata `reviewStatus: auto-approved` trong danh sách AI khi load game.

Tham khảo [OpenAI Images API](https://developers.openai.com/api/reference/resources/images/methods/generate).
