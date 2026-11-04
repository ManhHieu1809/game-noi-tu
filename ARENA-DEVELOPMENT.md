# Đấu trường năng lượng — bản nền 01

**Cập nhật địa hình/nhân vật:** xem `ARENA-WORLD-UPDATE.md`. Phần bản đồ,
nhân vật, icon và kết quả kiểm thử bên dưới mô tả bản nền trước cập nhật.

## Mở và chơi

Từ trang chính chọn **Đấu trường năng lượng**, hoặc mở `arena.html` qua
website hiện có. Không cần Node trên website GitHub Pages. `npm start` chỉ
dùng xem thử trong môi trường phát triển.

Chọn tên và chức nghiệp rồi **Luyện tập với 3 bot** để thử ngay. Phòng bạn bè
cần 4 người, hai người mỗi đội, hai chức nghiệp khác nhau trong cùng đội.
Chủ phòng bắt đầu hoặc chơi lại. Mã phòng riêng tiền tố `arena-v1-`.

WASD di chuyển; chuột ngắm; giữ chuột trái đánh; Q/E/R kỹ năng; Space lướt;
1/2/3 thuốc; B cửa hàng; Esc đóng bảng. Chỉ hỗ trợ bàn phím/chuột hiện tại;
thiết bị cảm ứng có thông báo và khóa nút vào trận.

Chạy qua pin để nhặt. Về vòng căn cứ để tự nạp và hồi máu. Một pin cho
20 tiền cá nhân và 1 năng lượng đội. Đủ 18 năng lượng, đứng tại căn cứ và
bấm Công phá: khiên căn cứ đối phương hạ 35 giây. Chỉ đánh được lõi khi
khiên hạ. Lõi có 750 máu. Trận 10 phút, so máu lõi rồi tổng pin đã nạp;
bằng nhau thì hòa. Bot không phải đối thủ đã được cân bằng.

Bị hạ rơi nửa lượng pin (làm tròn lên), hồi sinh 6 giây sau và giữ đồ.
18 trang bị, tối đa 3 món không trùng; 3 ô thuốc, được trùng loại.
Thuốc dùng chung hồi 3 giây. Mua/bán tại căn cứ, bán lại 65% giá gốc.
Giảm hồi chiêu tối đa 35%. Chỉ số và nội dung tại `js/arena/data.js`.

## Đồ họa

Nhân vật được dựng bằng Three.js: giáp nhiều lớp, mặt/kính mắt, khớp tay
chân, bình pin/ba lô, vũ khí và phụ kiện riêng. Có bước chân, nhún thân,
xoay hướng ngắm và động tác đánh cơ bản. Đấu trường có nền lát, máy móc,
bồn cây, trạm pin, thiết bị cửa hàng, lõi phát sáng và khiên. Vật liệu
Standard với độ nhám/kim loại; ánh sáng hemisphere và directional, shadow
map 1024; bóng tiếp xúc dưới chân. Hiệu ứng vòng va chạm/nhặt/nạp/lướt.

Chế độ Thấp tắt shadow map và dùng pixel ratio 1; Vừa giới hạn 1,35.
Tái sử dụng đối tượng đạn/pin/vùng kỹ năng qua các khung hình. Tài nguyên
chỉ tải khi mở arena. Không có model AI mới, không cần TRELLIS/GPU NVIDIA.
Three.js và MIT LICENSE dùng bản local đã có trong `js/vendor/`.
Font Google có fallback hệ thống; PeerJS tiếp tục dùng CDN hiện có.

Đây là bản nền, chưa phải mức hình ảnh cuối: chưa có texture bề mặt riêng,
hoạt ảnh tử vong, animation phân đoạn hoàn chỉnh từng chiêu hoặc âm thanh.
Mức chân thực và hiệu năng cần duyệt qua render thực tế trên máy người dùng.

## Kết nối và giới hạn

Host mô phỏng 30 Hz, snapshot tối đa 12,5 Hz; input khách 20 Hz có sequence,
kiểm tra số hữu hạn và timeout dừng di chuyển. Client dự đoán vị trí cục bộ,
nội suy đối thủ; host quyết định tiền, đồ, kỹ năng, sát thương, pin và thắng.
Dự đoán chưa mô phỏng đầy đủ làm chậm/lướt, có thể có hiệu chỉnh khi mạng trễ.
Host nên để tab game hoạt động; chưa có bù trễ hay worker chạy nền.

Khách không được gửi vị trí, tiền hoặc trạng thái tùy ý. Action có giới hạn
nhịp và kiểm tra trong engine. Chưa phải cơ chế chống gian lận cho giải đấu.
Nếu một người ngắt kết nối trong trận, hủy trận không ghi nhận thắng/thua.
Chủ phòng rời thì đóng phòng. Không chuyển chủ hoặc khôi phục reload.

Chỉ sửa liên kết chọn game trong `index.html`; không sửa `js/net.js`, ICE,
TURN credential, MQTT hay deployment trong lượt này. Mã đảo cũ vẫn được
giữ trên đĩa, không còn là nút game 3D chính. Giữ game nối từ hiện có.
Không publish hoặc commit thay người dùng.

## Kiểm chứng

- `npm test`: 42/42 đạt: 28 nối từ, 4 đảo cũ, 8 luật đấu trường,
  2 kiểm thử giao thức phòng bằng transport mô phỏng và đường dẫn local.
- Mô phỏng 4 bot trong 10 phút: kết thúc, có nạp pin, mua đồ, hạ gục và
  công phá lõi. Đây là mô phỏng engine, không chứng minh độ vui/cân bằng.
- Kiểm thử giao thức mô phỏng gồm handshake, giới hạn 4 người, đổi chức
  nghiệp, snapshot, input/action và hủy khi ngắt kết nối; không phải WebRTC thật.
- Công cụ kiểm tra UI hết thời gian chờ hai lần. Chưa xác minh hình ảnh
  render, FPS Iris Xe, click/điều khiển thực, nhiều tab PeerJS, LAN, khác mạng
  hoặc TURN. Không báo bản này đã nghiệm thu multiplayer hay hình ảnh.
- Module main/scene/network qua `node --check`; HTTP trang arena và scene
  trả 200 trên máy chủ cục bộ. Đường dẫn subpath kiểm tra bằng phân giải file,
  chưa phải deployment GitHub Pages thực tế.

File mới: `arena.html`, `css/arena.css`, `js/arena/{boot,data,core,scene,
network,main}.js`, `tests/arena.test.js`, `tests/arena-network.test.js`, tài
liệu này. File hiện có sửa trong lượt: `index.html` (nút game).
