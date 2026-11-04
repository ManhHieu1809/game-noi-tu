# Kế hoạch làm lại Đấu trường năng lượng 2,5D

## Phạm vi lượt này

Lập thiết kế, tạo art gốc và xử lý asset bằng Agent Sprite Forge. Không sửa
HTML, CSS, JavaScript runtime, mạng hoặc triển khai của game. Asset chưa được
tích hợp không được báo là đã chạy trong game. Bản 3D giữ nguyên để đối chiếu.

Toolchain: https://github.com/0x0funky/agent-sprite-forge, bản 0.4, commit
`5324342fdfab72430f4e9604f3fe427009f8596d`, MIT; checkout ở
`tools/agent-sprite-forge`. Không cài đè skill người dùng. Hình mới tạo bằng
ImageGen tích hợp (`host_image`), dùng repo cho master framing, tách nền,
metadata và QC. Không dùng secret/API trả phí hoặc artwork showcase trong repo.

Kiểm tra môi trường: Python 3.10, NumPy, Pillow có sẵn; SciPy thiếu nhưng
repo có fallback NumPy; FFmpeg và route image-to-video chưa có. Vì vậy bước
animation-video của 0.4 chưa chạy được. Không dựng animation giả từ ảnh đứng.

Cập nhật batch-03: đã thử route **ImageGen tạo tư thế trực tiếp → Forge xử lý sheet**,
không cần video. Đã xuất chạy 8 frame và đánh 6 frame của đấu sĩ ở SE, có bản
384/192px và trang xem thử. Còn lỗi/cảnh báo hình ảnh, chưa hoàn tất tám hướng
hoặc tích hợp game; xem [báo cáo batch-03](batch-03/README.md).

Batch-04 đã vẽ lại chạy/đánh SE theo guide khớp, sửa sắc độ hai chân và đăng ký
chuyển động; có [trang trước/sau](batch-04/preview.html) và
[báo cáo kiểm tra](batch-04/README.md). Bộ chọn là `batch-04/final-v2/`, còn giới hạn
chẩn đoán hình ảnh và kiểm thử browser; không báo hoàn tất tám hướng.

## Hướng hình ảnh

- **ANIME HD** cho cả nhân vật, địa hình, vật thể và giao diện. Nét anime rõ,
  mắt/biểu cảm anime, cel-shading sạch, màu sáng trong; không bán hiện thực,
  không chất liệu da thật/xước bẩn dày đặc, không mô hình 3D ghép khối.
  Góc 3/4 nhìn từ trên xuống khoảng 35°, camera cố định hướng. Nhân vật anime
  thanh niên tỷ lệ khoảng 6 đầu, không chibi. Ánh sáng trên-trái nhất quán.
- Thung lũng anime xanh tươi, nước turquoise trong, đường đất kem, vách đá
  được vẽ thành mảng sáng/tối mềm. Công trình tinh thể/cơ khí fantasy anime.
  Ngọc lam/hổ phách phân biệt đội; xanh tím dành cho phép. Nền ít tương phản
  hơn nhân vật/đạn/vùng kỹ năng. Không dùng phong cách u tối, bẩn và tả thực.
- Vẽ thân/vũ khí và FX thành lớp riêng. Hình tĩnh có chiều sâu bằng ánh sáng
  vẽ sẵn, bóng tiếp xúc và che khuất theo chân; không cần đèn/bóng 3D thời gian thực.
- Bộ icon cũ chỉ là nguồn tham khảo, phải kiểm tra phong cách trước khi tái dùng.

## Bản đồ thật rộng: Thung lũng Song Mạch

Kích thước mục tiêu **12.288 × 9.216 world-pixel**, camera logic 1.280 × 720.
Khoảng 9,6 màn hình ngang và 12,8 màn hình dọc ở zoom 1; diện tích không phụ
thuộc kích thước file PNG. Chia **4 cột × 3 hàng = 12 sector**, mỗi sector
3.072 × 3.072 logical px. Art nền mỗi sector dự kiến 1.536 × 1.536 source px,
scale 2; props và nhân vật giữ nguồn HD riêng để không bị nhòe khi zoom.
Không tải hoặc giữ texture của cả thế giới cùng lúc.

Sơ đồ địa lý (tọa độ world):

| Khu | Vị trí / vai trò | Khả năng di chuyển |
|---|---|---|
| Căn cứ Ngọc | (1.000, 4.608) | Vùng an toàn, cửa hàng, lõi |
| Căn cứ Hổ phách | (11.288, 4.608) | Đối xứng chức năng, không cần đối xứng từng nét cọ |
| Đường Bắc | y khoảng 2.304 | Đồi cao, đường vòng, cầu Bắc |
| Đường Giữa | y khoảng 4.608 | Rộng, trực tiếp, giao tranh chính |
| Đường Nam | y khoảng 6.912 | Rừng, bờ suối, đường vận chuyển vòng |
| Sông trung tâm | x quanh 6.144, uốn theo y | Nước sâu chặn, bãi cạn đi chậm |
| Cầu chính | (6.144, 4.608) | Mặt cầu riêng, hai bờ có approach polygon |
| Cầu phụ | gần (6.144, 2.304)/(6.144, 6.912) | Hai tuyến thay thế, không có nút thắt duy nhất |
| Đồi Tây Bắc / Đông Nam | (3.200, 1.700)/(9.000, 7.300) | Ramp liên tục nối tầng 0→1→2 |
| Trạm pin giữa | (6.144, 4.000) | Giá trị cao, có hai lối tiếp cận mỗi đội |
| Trạm pin cánh | (3.500/8.788, 2.400/6.800) | Thu thập ít rủi ro hơn |

Mỗi đội phải có ít nhất hai đường tới mỗi mục tiêu. Lòng đường chính rộng
200–320 px, đường phụ >=140 px, cầu >=160 px; footprint nhân vật khoảng
ellipse 18×10 px. Chân đi trên dữ liệu đường/ramp, không đoán từ pixel art.
Tường vách không leo trực tiếp; muốn lên đồi phải đi ramp. Đỉnh đồi là mặt
đi riêng có elevation, mép vách có collider. Sông gồm polygon sâu, cạn và cầu;
đi dưới/đi trên cầu chỉ có nếu dữ liệu tầng và lối vào định nghĩa rõ.

Thời gian thiết kế: tốc độ cơ bản khoảng 320 px/giây, căn cứ–giữa 16 giây,
đi thẳng giữa hai căn cứ khoảng 32 giây; đi tuyến vòng lâu hơn. Đây là mục
tiêu cân bằng cần đo trong prototype, chưa là kết quả kiểm thử. Giữ 2vs2,
thu thập/nạp pin, 3 trang bị + 3 thuốc và phá lõi; không thêm hệ thống khác
chỉ để lấp diện tích. Chế độ đấu tự do để sau.

## Cách sản xuất map, không làm một bức ảnh khổng lồ

1. Chốt master địa hình và một sector mẫu (ground-only). Đất/cỏ/nước/vách
   ổn định nằm ở nền. Cây, đá lớn, cầu, nhà, lõi, trạm pin là PNG độc lập.
2. Tạo dressed reference trên nền để kiểm tra ánh sáng và tỷ lệ; đây chỉ là
   bản định hướng. Không lấy ảnh dressed làm runtime base.
3. Tạo kit dùng chung: 6 vật liệu đất/cỏ/đá, 12 biến thể bờ nước, 8 mảnh
   vách/ramp, 3 cầu, 6 cây, 8 đá/bụi, 4 phế tích, 2 căn cứ, trạm pin/cửa hàng.
   Vật thể rộng hoặc ảnh hưởng va chạm phải tạo riêng, không nhét chung ô vuông.
4. Sector dùng kit chung và đầu nối đường/sông đã khóa. Đối chiếu hai sector
   liền nhau về cao độ, đường và ánh sáng; kiểm tra seam ở camera thực.
5. Viết dữ liệu object, anchor, collider, water/ramp/elevation/trigger và
   layer. Có `sortY` theo chân, footprint thân cây khác canopy.
6. Chạy `map_bundle validate`, `map_nav check`, compose actor-in-place;
   chỉ gọi map hoàn chỉnh khi mọi tuyến, cầu và ramp kiểm tra được.

Lượt hiện tại tạo **bộ mẫu sản xuất**, chưa tạo đủ art cho 12 sector. Sơ đồ
world và danh sách thiếu được lưu riêng để không nhầm asset mẫu với toàn map.

## Nhân vật và 8 hướng

Bốn master anime: đấu sĩ áo teal/khăn coral, tanker giáp sáng, pháp sư áo
xanh lam/ngà, xạ thủ trang phục nhẹ. Giữ mã màu đội bằng viền chân/đai vải,
không nhuộm toàn bộ nhân vật làm mất vật liệu.

Thứ tự hướng chuẩn: S, SW, W, NW, N, NE, E, SE. Không dùng scaleX âm cho
nhân vật mang vũ khí bất đối xứng. Hình tám hướng tĩnh chỉ là turnaround,
không phải tám clip animation. Mỗi hướng cần quan sát được mặt/lưng tương ứng.

| Action / một hướng | Frame mục tiêu | Thời gian | Lớp FX |
|---|---:|---|---|
| Idle | 6 | 0,9–1,2s loop | Thở nhẹ, không lắc toàn thân |
| Run | 8–12 | 0,65–0,85s loop | Bụi chân riêng |
| Basic attack | 6–8 | 0,45–0,7s | Trail/đạn riêng; event hit tại frame định nghĩa |
| Q/E/R | 6–10 mỗi chiêu | Theo wind-up/hit/recover | Báo vùng, release, hit, decay riêng |
| Hurt | 3–4 | 0,2–0,35s | Hit flash riêng |
| Death | 6–8 | 0,65–1s | Không lặp |

Chỉ hoàn thiện một đấu sĩ với idle/run/attack tám hướng trước khi nhân lên
bốn tướng. 8 frame không tự bảo đảm mượt: xem đổi chân, tiếp đất, thời điểm
đánh và điểm nối loop. Neo chân chung; body-scale drift mục tiêu <=8%, không
thu phóng từng frame để che lỗi AI. Animation chưa có route sẽ để `planned`.

## Trang bị mặc lên người

Phải dùng cùng bộ frame/anchor với cơ thể. Tách lớp vũ khí, ngực, áo choàng,
cẳng tay, giày và phụ kiện. Mỗi layer đổi thứ tự trước/sau cơ thể theo hướng.
Không đặt icon cửa hàng đè lên người làm đồ mặc.

Trước tiên chứng minh một bộ giáp + đôi giày + ba lô theo đủ frame của
idle/run/attack trên đấu sĩ. Sau đó mới mở rộng 18 món và bốn body template.
Các món cùng vùng cần chốt slot hình ảnh: plate ở ngực, insulator là áo
choàng, shell ở vai; pack ở lưng, motor ở hông, relay trên vai. Vũ khí phụ
hiện ở bao lưng/hông; đòn đánh vẫn dùng vũ khí chức nghiệp. Không sinh
riêng mọi tổ hợp đồ: 18 chọn 3 có 816 tổ hợp, dùng layer/cache theo bộ đang mặc.

## Hiệu ứng và UI

12 bộ kỹ năng gồm telegraph → cast/release → travel/active → impact → fade.
Đấu sĩ: vệt chém/thế thủ/địa chấn; tanker: húc/khiên/vòm; mage: cầu phép/vùng
chậm/bão; ranger: xuyên phá/lướt/liên thanh. Trạng thái buff có dấu hiệu tồn
tại đúng thời gian; không chỉ lóe một vòng ở lần bấm.

HUD tổng tỉ số/thời gian <=300×54 px, không panel đặc lớn giữa màn. Skill
56px có icon, phím, cooldown; item/thuốc 40px; bảng chỉ số mở bằng C; minimap
180×135 có mục tiêu và fog nếu sau này cần. Tooltip ghi chỉ số và nội tại,
cửa hàng so sánh trước–sau, preview giấy búp bê dùng cùng layer với gameplay.

## Engine và hiệu năng ở bước code sau

Dự kiến Phaser (ghim bản stable khi tích hợp), tiếp tục web tĩnh/GitHub Pages
và PeerJS host-authority. Tái dùng luật/kết nối phù hợp sau khi audit; thay
renderer Three.js và HUD cập nhật toàn bộ mỗi nhịp. Không sửa nối từ/credential.

- Mục tiêu 60 FPS ở 1280×720; chế độ thấp hướng tới >=30 FPS. Phải đo thật,
  không cam kết trước. Fixed simulation 30 Hz, interpolation render riêng.
- Tải sector theo camera, cache 4–6 sector, cull props; atlas nhân vật <=2048²,
  tránh một texture khổng lồ; giới hạn particle, đạn và số texture sống.
- Sprite animation 10–15 FPS vẫn render di chuyển 60 FPS. Không khóa chuyển
  động của người chơi theo tốc độ phát frame của animation.
- Input chuột phải có tìm đường; WASD ghi đè; prediction cục bộ và reconcile.
- HUD chỉ cập nhật phần thay đổi, không dựng lại toàn bộ DOM mỗi 120ms.

## Lộ trình và cổng nghiệm thu

1. **Art mẫu (lượt này):** master nhân vật, nền sector, props tách nền, FX mẫu,
   prompt/provenance/QC. Xem ở cỡ gameplay, không chỉ ảnh phóng to.
2. **Duyệt hình ảnh:** đồng nhất góc nhìn, nhận ra bốn vai trò, nhân vật rõ trên
   nền. Sửa master trước khi tạo hàng nghìn frame; không làm ồ ạt theo mẫu chưa duyệt.
3. **Animation một tướng:** đủ tám hướng, idle/run/attack, ba lớp đồ. Xem GIF
   và clip contact sheet; giải quyết route video còn thiếu trước khi nhận hoàn thành.
4. **Map data + kit:** chốt 12 sector, ráp mẫu 2 sector liền, kiểm tra cầu/ramp,
   y-sort và footprint. Đạt rồi mới sản xuất phần còn lại.
5. **Prototype code:** chỉ một sector, một tướng và HUD, đo FPS/input 10 phút
   trên Iris Xe. Chưa đạt thì tối ưu trước khi tăng nội dung.
6. **Gameplay đầy đủ:** bốn tướng, 18 item, thuốc, kinh tế/lõi và replay.
7. **Multiplayer:** kiểm thử 4 tab, LAN rồi khác mạng; tách kết quả từng loại.

Không gắn nhãn `runtime-ready` khi mới có concept. Trạng thái chuẩn:
`planned`, `generated`, `processed`, `needs-visual-review`, `approved`,
`integrated`, `runtime-verified`. Lượt này tối đa tới `processed` hoặc
`needs-visual-review`, không có `integrated`.
