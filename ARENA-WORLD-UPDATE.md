# Địa hình, nhân vật, icon và điều khiển — cập nhật 02

## Thay đổi

- Thung lũng 160 × 120 đơn vị (bản trước 46 × 30), đồi cao khoảng 8–14
  đơn vị, suối uốn quanh, hai cầu gỗ, rừng dùng instancing, đá và trạm pin.
  Đây là mesh 3D, không phải ảnh nền. Mặt đất và nhân vật dùng cùng hàm
  độ cao, nhân vật lên xuống theo đồi; lội suối giảm 35% tốc độ.
- Hai căn cứ tại x = -65/+65; trạm pin phân bố rộng hơn. Cần chơi thử lại
  nhịp trận/cân bằng vì khoảng cách đã tăng đáng kể.
- Nhân vật dạng người: thân eo/ngực, đầu có mặt, vai → cánh tay → khuỷu →
  cẳng tay → cổ tay; hông → đùi → gối → cẳng chân → bàn chân.
  Dùng các nhóm phân cấp chuyển động độc lập, không dùng bộ xương AI.
- 18 món có bộ phận hiển thị gắn vào nhân vật. Bán món sẽ tháo phần hình ảnh;
  giày gắn hai chân, giáp trên ngực, ba lô trên lưng, găng trên tay, vũ khí
  trên tay cầm. Model đơn giản theo loại món, không sao chép độ chi tiết icon.
- Cửa hàng có xem trước nhân vật 3D, renderer nhỏ chỉ tồn tại lúc mở bảng.
- 12 icon kỹ năng, ba icon thuốc và 18 icon đồ dùng hai PNG atlas AI.
  HUD có tên kỹ năng, phím tắt, lớp đếm hồi chiêu; tooltip và so sánh chỉ số.
- Hiệu ứng sự kiện đủ 12 kỹ năng: vòng năng lượng/mảnh sáng; khiên/thế thủ/
  liên thanh có aura theo thời gian buff; vùng làm chậm, vòm chắn, bão có
  cột chớp. Hiệu ứng đặt theo độ cao địa hình. Chưa có hoạt ảnh điện ảnh.
- Thu nhỏ bảng thời gian/tỉ số xuống 330px; mục tiêu nhỏ hơn; thêm minimap,
  bảng chỉ số mở/đóng; lăn chuột zoom 12–40 đơn vị.
- Chuột phải raycast lên mesh địa hình, A* tìm đường quanh tường, gửi hướng
  di chuyển qua giao thức input cũ. WASD hủy đường đi; marker chỉ điểm đến.

## Giới hạn rõ ràng

Va chạm là height-field và tường theo XZ: không có hang, leo vách dựng,
nhảy, bơi hay ragdoll. Hai cây cầu có mặt đỡ riêng. Mặt nước không đỡ người;
nhân vật đứng trên lòng suối. Cây/đá trang trí chưa là vật cản tìm đường.
Đạn và tầm đánh tính theo mặt bằng, hình ảnh đạn theo mặt đất; chưa có
đường đạn vật lý 3D hoặc lợi thế cao độ. Đồi đã đi được nhưng chưa có IK
đặt từng bàn chân theo dốc; khớp hoạt ảnh bằng mã.

48 kiểm thử tự động đạt, gồm 28 nối từ, kiểm thử đấu trường, phòng mô phỏng,
mesh địa hình trùng height-field, tìm đường tránh tường, chuỗi khớp và gắn/
tháo đồ, sự kiện hiệu ứng đủ 12 skill và file icon PNG. Không thay ICE/TURN.
Chưa xác minh render thực tế, cảm giác click đường dài, FPS trên Iris Xe,
hoặc nhiều người khác mạng. Browser access host không khả dụng; truy cập
cửa sổ Edge hết thời gian chờ phê duyệt. Không coi unit test là nghiệm thu UI.

## Tài nguyên AI thực tế

Đã tạo bằng ImageGen tích hợp, không chạy TRELLIS hoặc tải model nhân vật:

- `assets/arena-skills.png`: atlas 4 × 4, 12 skill + ba thuốc + ô trống.
- `assets/arena-items.png`: atlas 6 × 3, 18 trang bị theo thứ tự data.js.

Prompt skill:

“Create a game UI icon atlas, exactly 4 columns and 4 rows, sixteen equal
square cells, edge-to-edge grid no margins no gaps, each symbol centered
with generous internal padding on dark navy background. Painterly detailed
fantasy sci-fi icons, jewel colors and metallic highlights, no text no letters
no numerals. Row 1: sword dash slash; defensive crossed swords shield; ground
earthquake impact; charging armored bull. Row 2: protective golden shield;
blue forcefield dome; glowing violet magic orb; icy slowing rune circle.
Row 3: violet lightning storm; piercing arrow projectile; evasive boot dash;
rapid-fire crossbow. Row 4: red healing potion; cyan shield potion; green
speed potion; golden empty inventory socket. Consistent polished RPG UI art,
readable small.”

Prompt item:

“A single RPG equipment UI icon atlas exactly 6 columns by 3 rows, eighteen
equal square cells, no outside margins and no gaps. Detailed hand-painted
fantasy sci-fi inventory art, luminous gold turquoise violet metal on dark navy,
each object centered with padding, no text letters or numerals. Row 1: energy
sword, lifesteal claw gauntlet, sniper scope, attack speed motor, armor piercing
warhammer, glowing mage staff. Row 2: prism crystal, cooldown coil, magic
reactor, chest armor plate, insulated cloak, titan heart amulet. Row 3: jet
shell shoulder armor, rocket boots, supply backpack, regenerative medical
bracer, spare power battery belt, supply relay antenna. Consistent beautiful
readable small icons, each individual cell exactly same size.”
