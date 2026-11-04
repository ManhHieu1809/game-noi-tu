# Art direction mới nhất: Anime HD

Yêu cầu người dùng: nhân vật anime, bối cảnh cũng anime. Tài liệu này thay
thế hướng bán hiện thực của các ảnh thử trước. Không đổi thiết kế map rộng,
luật 2vs2, tám hướng, trang bị nhiều lớp hoặc phạm vi chưa code.

## Những gì phải nhìn thấy

- Nhân vật: gương mặt/mắt anime, dáng thanh niên khoảng sáu đầu, đường nét
  gọn, khuỷu/gối và bàn tay rõ; trang phục fantasy có cá tính nhưng dễ đọc
  ở cỡ 80–100 px. Không thêm hàng chục dây đai, không giáp trầy xước nặng.
- Màu: teal/coral/ngà/bạc cho đấu sĩ; giáp ngà/xanh cho tanker; lam/ngà với
  phép tím cho mage; rêu/vàng nhạt cho xạ thủ. Đây là thiết kế dự kiến, chưa
  phải bốn bộ sprite đã sản xuất.
- Nền: đồng cỏ sáng, đồi và suối trong, vách đá vẽ tay theo mảng, bóng mềm,
  đường di chuyển rõ. Cây và kiến trúc anime tạo riêng cùng góc camera.
- Vật liệu thể hiện bằng màu và highlight anime, không ảnh texture hiện thực.
- Không sao chép nhân vật hoặc tên phong cách của một game/anime có sẵn.

## Bộ mẫu tạo lại trong lượt điều chỉnh

1. Một master đấu sĩ anime, hướng SE, nền magenta để tách alpha bằng Forge.
2. Một nền sector anime ground-only, không cây/nhà/cầu gộp vào nền.

Hai ảnh này là để duyệt phong cách, không phải toàn bộ bản đồ hoặc animation.
Chỉ tạo lại mẫu ở bước này; không nhân sang bốn tướng hoặc hàng nghìn frame
trước khi người dùng thấy phù hợp. Mẫu cũ bán hiện thực là `rejected-style`.
Không gọi một tấm master đứng là animation tám hướng.

Toolchain vẫn là Agent Sprite Forge commit
`5324342fdfab72430f4e9604f3fe427009f8596d`; ảnh nguồn từ ImageGen tích hợp.
Chưa có route video/FFmpeg; ghi rõ giới hạn khi sang giai đoạn animation.

Cập nhật: batch-03 đã tạo tư thế chạy/đánh SE trực tiếp bằng ImageGen, dùng Forge
xử lý thành clip mà không cần video. Đây là prototype có lỗi/cảnh báo hình ảnh,
chưa phải bộ tám hướng hoàn chỉnh; xem [batch-03](batch-03/README.md).
