# Cùng nhau vượt đảo — trạng thái bản thử

Mở `index.html` qua website hiện có, chọn **Cùng nhau vượt đảo — 3D**.
Tạo phòng, gửi mã hoặc link mời; chủ phòng bắt đầu ván. WASD/mũi tên
để đi, Space để nhảy; bấm cảnh để xoay camera bằng chuột, Esc để thoát.
Có joystick và nút nhảy cảm ứng nhưng chưa kiểm thử thiết bị thật.

## Luật và kiến trúc

- 1 người: luyện tập, cầu mở sẵn. 2–4 người: giữ hai công tắc bằng hai
  người khác nhau trong 2,2 giây để mở cầu cố định.
- Checkpoint chung cho nhóm sau cầu; mọi người còn kết nối phải tới đích.
- Nếu còn một người, chuyển luyện tập và mở cầu; không tính thắng phối hợp.
- Chủ phòng rời: đóng phòng. Không chuyển chủ, không khôi phục sau reload.
- Host quyết định luật; mỗi khách chỉ nối với host. Pose khoảng 15 Hz,
  snapshot tối đa 12,5 Hz, nhân vật từ xa nội suy. Snapshot có số thứ tự.
- Vật lý bước 1/60 giây, trọng lực và mặt sàn chữ nhật; cây/đá là trang trí,
  chưa có va chạm cạnh/đầu hoặc va chạm giữa nhân vật. Không chống teleport.
- Mã PeerJS dùng tiền tố `island-`, độc lập phòng nối từ. Cấu hình ICE dùng
  `getPeerOptions()` hiện có. MQTT vẫn chỉ phục vụ danh sách phòng nối từ.
- Trang riêng chỉ tải Three.js khi mở game 3D. Đường dẫn tài nguyên tương đối
  phục vụ GitHub Pages dưới thư mục repository. Không đổi deployment.

## Tài nguyên và giấy phép

Three.js 0.170.0 được tải từ jsDelivr, lưu `js/vendor/three.module.min.js`;
giấy phép MIT tại `js/vendor/THREE-LICENSE.txt`. PeerJS vẫn dùng CDN hiện có,
cần mạng và dịch vụ signaling hoạt động; lỗi tải 3D có màn thông báo.

Ảnh `assets/island-lobby.png` thực sự được tạo bằng công cụ ImageGen tích hợp.
Prompt: “Wide charming low-poly 3D illustration of four tiny friendly rounded
explorer creatures in coral red, moss green, sunshine yellow and ocean blue,
on floating grassy islands above cream clouds, jumping platforms, two round
floor switches and a connecting bridge; matte geometry, soft daylight,
original design, no existing game characters, no text or watermark.”
Ảnh là minh họa, không phải ảnh chụp gameplay; nhân vật, cây, đá, công tắc
runtime là hình học tạo bằng mã. Không có model AI hoặc animation có xương.

Đã đọc README và MIT LICENSE từ https://github.com/microsoft/TRELLIS.2
(nhánh main, ngày 2026-11-03); chưa clone/chạy nên không có phiên bản model
thực tế được sử dụng. README yêu cầu Linux, NVIDIA >=24 GB VRAM, CUDA
(khuyến nghị 12.4), Python >=3.8, PyTorch và các extension CUDA như
flash-attn, nvdiffrast, CuMesh, o-voxel, FlexGEMM. Máy làm việc là Windows;
chưa xác minh được GPU (truy vấn bị từ chối quyền). Không cài bộ suy luận.

Quy trình tiếp theo trên máy Linux phù hợp: ghim commit repository và weights,
đọc lại giấy phép từng dependency/weights; tạo ảnh riêng một nhân vật toàn thân
trên nền trơn với bảng màu trên, chạy example image-to-3D, xuất GLB; giảm lưới
và texture bằng Blender, mục tiêu <2 MB/model và <15k tam giác. Kiểm tra hướng,
tỷ lệ, vật liệu và thời gian tải bằng GLTFLoader cùng phiên bản Three.js.
Giữ collider hiện tại; thêm model như lớp hình ảnh trong IslandAvatar và giữ
hình học hiện có khi tải lỗi. Đây là kế hoạch, GLB loader chưa được tích hợp.

## Kiểm thử

`npm test`: 32/32 đạt (28 nối từ, 4 nhóm kiểm thử đảo: giới hạn phòng,
công tắc, kết thúc, rời phòng, luyện tập, hồi sinh, sàn/nhảy ở 30/60/120 Hz).
Các kiểm thử mô phỏng luật/vật lý, chưa chứng minh đường nhảy thực tế dễ chơi.
Chưa xác minh render/WebGL, tạo/vào phòng thực qua PeerJS, nhiều tab,
điện thoại, nhiều thiết bị LAN, Wi-Fi so với 4G/5G, TURN và hiệu năng.
Công cụ mở trình duyệt hết thời gian chờ. Chưa nên coi bản này đã nghiệm thu
chơi từ đầu đến cuối. Trước phát hành cần thực hiện các kiểm tra trên,
đặc biệt đường nhảy và đủ bốn người, đóng host, replay và reload.

File sửa trong lượt tiếp tục: package.json; js/island/core.js, physics.js,
net.js, boot.js, main.js; island.html; tests/island.test.js; tài liệu này;
assets/island-lobby.png; js/vendor/three.module.min.js, THREE-LICENSE.txt.
Các sửa đổi index.html, css/style.css, js/net.js và module đảo đã có sẵn trước
lượt này được giữ lại. Không sửa giá trị credential hoặc cấu hình triển khai.
