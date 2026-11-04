# Asset anime — đợt 02

Mở **gallery.html** để xem thư viện ảnh và animation. Không sửa mã game.
Hai ảnh đấu sĩ/nền trước đó đã được người dùng duyệt phong cách; các ảnh
mới ở trạng thái đã xử lý, cần duyệt hình ảnh và kiểm tra runtime sau này.

## Đã tạo thực tế

- 3 master nhân vật mới: hộ vệ, pháp sư, xạ thủ. Cùng đấu sĩ trước đó tạo
  thành 4 mẫu SE. PNG alpha, master.json, framing 1024²; không phải clip chạy.
- 9 props độc lập: cây lá rộng, thông, cầu, trạm tinh thể, quầy tiếp tế,
  đá rêu, bụi cây, hoa/cỏ và cụm đá thấp. Có anchor trong metadata.
- 12 animation, mỗi bộ 6 PNG 256², tổng **72 frame**. Có GIF sơ bộ và clip
  WebP đã đóng gói lại kèm thời gian/anchor/trạng thái one-shot hoặc cycle:
  chém, khiên, địa chấn, cầu phép, bụi lướt, băng chậm, sét, đạn xuyên,
  nước, thác, tinh thể và cây lay động.
- 1 nền sector đồi núi mới có đường dốc/thác, 1 dressed reference từ nền
  đã duyệt, 1 preview ráp bằng props độc lập và lineup 4 nhân vật.
- Mapping 12 kỹ năng tới các họ FX trong skill-vfx-map.json; hiệu ứng dùng
  lại có chủ đích, không phải 12 bộ động tác cơ thể đã hoàn thành.
- 4 job plan cho idle/run/attack/cast/hurt của bốn master tại motion-jobs/.
  Chỉ chuẩn bị job, **chưa chạy tạo video**.

## Chỗ lấy file

- final/animations/: PNG từng frame, sheet, GIF và pipeline-meta.json.
- final/clips-v2/: animation-clips.json, frame copy, WebP đúng nhịp và các
  ảnh review. Dùng bản v2: cây 1,8s, tinh thể 1,2s, frost 0,9s, FX khác 0,6s.
- props/: clean.png và thông tin neo. props/compact/ có 4 prop.png riêng.
- characters/: master_rgba.png và master.json của 3 tướng mới.
- raw/: nguồn gốc, gồm cả 2 ảnh lỗi giữ để truy vết, không dùng ảnh lỗi.
- prompts/: prompt thật đã gửi cho từng ảnh và hai lần sửa lỗi.
- final/catalog.json: đường dẫn tương đối, kích thước, sha256, trạng thái.
- final/qa/warnings.json: mọi cảnh báo của bản đã chọn và lịch sử bị thay thế.

## Kiểm tra và giới hạn

Đã dùng Agent Sprite Forge 0.4, commit
5324342fdfab72430f4e9604f3fe427009f8596d (MIT). Tạo ảnh bằng ImageGen tích
hợp (host_image); tên model cụ thể không được công cụ trả về. Không gọi API
trả phí hoặc dùng key mới. `package_batch.py` chỉ xử lý/ráp ảnh có sẵn,
không vẽ art mới. Không dùng tài nguyên showcase của repo làm nhân vật.

12 bộ cuối qua strict QC của processor, không rỗng, không cắt mép hoặc
paste-clamp. Despill radius 2 sửa viền màu nền của một số lần xử lý đầu.
Kiểm tra 72 PNG có alpha và đúng 256²; GIF có nhiều frame, không là ảnh đứng.
Clip builder giải mã lại WebP để kiểm tra frame, alpha và thời gian phát.
Điều này không chứng minh loop tuyệt đối mượt hoặc chạy tốt trong game.

Cảnh báo còn lại của prop pack (giữ nguyên từ công cụ):

`id: strategy_aspect; status: warn; value: ["moss-rock 363x224", "flowers 307x178", "stone-stump 334x196"]; threshold: 1.6`

Ba prop thấp rộng hơn ngưỡng pack vuông. Ảnh vẫn đầy đủ/tách riêng được,
nhưng cần duyệt trước khi chấp nhận; không ghi rằng toàn bộ QA đều pass.
Các cảnh báo key_ring_spill của bản trung gian và số đo nguyên gốc được
giữ đầy đủ trong final/qa/warnings.json; bản cuối đã xử lý lại.

Chưa tích hợp hoặc benchmark. Cây lay động là chuỗi PNG từ ảnh, có thể còn
dao động thân hoặc thay chi tiết lá; phải xem ở cỡ gameplay. Nước/thác chưa
mask theo polygon sông. Cầu có anchor giữa hai chân được chỉnh sau khi xem
preview; collider/mặt đi và tầng vách chưa làm trong lượt chỉ tạo asset.
Nền đồi mới là sector mẫu, chưa là 12 sector ghép liền của toàn bản đồ.

## Vì sao chưa có animation chạy/đánh tám hướng

**Cập nhật sau batch-03:** đã có route tạo pose sheet trực tiếp bằng ImageGen,
không bắt buộc nguồn video. Đã xuất prototype chạy 8 frame/đánh 6 frame SE cho
đấu sĩ, chưa đạt mọi kiểm tra hình ảnh và chưa hoàn tất tám hướng. Xem
[kết quả mới](../batch-03/README.md). Phần dưới mô tả giới hạn của route video
tại thời điểm batch-02, không phải giới hạn của mọi cách tạo animation.

Forge 0.4 dùng một clip image-to-video cho mỗi action nhân vật. Hiện không
có công cụ image_to_video, Grok CLI, provider video đã cấu hình hoặc FFmpeg.
Doctor ghi `video none`. Vì thế không gọi các ảnh master là animation và
không nhân ảnh đứng thành frame giả. Cần một route video phù hợp hoặc clip
nguồn do người dùng cung cấp; sau đó dùng các job đã chuẩn bị để xử lý.
Tám hướng vẫn cần master/clip đúng hướng, không lấy lật ngang thay toàn bộ.
