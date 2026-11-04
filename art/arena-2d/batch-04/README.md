# Sửa chuyển động đấu sĩ anime — batch 04

Mở [trang so sánh trước/sau](preview.html). Bộ được chọn là **`final-v2/`**.
`final/` là bản trung gian trước khi sửa sắc độ chân; không phải bản giao mới nhất.

## Phần đã sửa

- Vẽ lại 8 tư thế chạy theo sơ đồ khớp với hai nửa bước khác nhau. Hai pha tiếp đất rộng đã có ở đầu mỗi nửa; không thêm frame sao chép để đủ số lượng.
- Sửa sắc độ chân: chân phải gần camera sáng hơn, chân trái xa camera có sắc thép tối hơn, kể cả khi chân trái dẫn trước. Nhờ đó hướng gập gối và chuyển chân dễ đọc hơn.
- Vẽ lại 6 tư thế đánh: chuẩn bị, lấy đà, đỉnh lấy đà, chém, theo đà, hồi phục. Đầu/nhân dạng bám cùng master, bớt biến thiên giữa tư thế.
- Căn lệch ngang thân khi chạy bằng Forge. Đánh dùng điểm hông để giảm trôi cả người mà vẫn giữ xoay vai. Không khóa đáy từng frame, giữ được chân nâng và nhún người.
- Chạy dùng 4 tick/frame ở 60 Hz (15 tư thế/giây, một chu kỳ 8 tư thế dài 0,533 giây). Đánh dùng 5/6/4/3/5/7 tick, tổng 0,5 giây; `hit` nằm ở tư thế chém thứ 4. Đây là metadata chuẩn bị tích hợp, chưa phải logic gây sát thương.
- Cùng 14 tư thế có bản 384px và bản 192px. Không tạo thêm tư thế bằng phóng/thu từng frame. Trang so sánh mặc định tải 192px, khi chọn 384px mới tải ảnh lớn.

Tất cả đều chỉ **hướng Đông Nam / SE**. Chưa tạo bảy hướng còn lại trong đợt sửa lỗi này, chưa sửa mã game hoặc tích hợp asset vào gameplay.

## File để dùng và xem

- [Danh mục có SHA-256](final-v2/catalog.json), [báo cáo kiểm tra](final-v2/qa-report.json).
- [Chạy WebP](final-v2/run-se/clips/clips/clip-00.webp), [chạy GIF](final-v2/run-se/preview.gif), [atlas chạy](final-v2/run-se/sheet.png).
- [Đánh WebP](final-v2/attack-se/clips/clips/clip-00.webp), [đánh GIF](final-v2/attack-se/preview.gif), [atlas đánh](final-v2/attack-se/sheet.png).
- PNG từng tư thế trong `final-v2/run-se/`, `final-v2/attack-se/`; bản nhẹ trong `final-v2/lite/`.

Canvas gốc 384 × 384, điểm neo chung 192/365; bản nhẹ 192 × 192, neo 96/182,5.
GIF dùng đơn vị 10ms và lặp lại để xem; PNG player và manifest/WebP là nguồn thời gian chính xác. Clip đánh trong manifest là `oneshot`, không tự đánh liên tục trong game.

## Kiểm tra thực tế

Đã xem toàn bộ sheet, contact sheet sau đăng ký và vùng đầu phóng lớn. Đã chạy:

1. Forge `process` với profile cơ thể của batch-03, tỉ lệ dùng chung, giới hạn body CV 0,08 và drift theo profile 0,10. Bản chọn qua strict QC; không có frame rỗng, cắt mép hoặc bị clamp.
2. Kiểm tra RGBA, kích thước, alpha thật và SHA-256 của 14 tư thế ở mỗi độ phân giải; tất cả đạt.
3. Forge clip builder strict cho cả bốn gói (chạy/đánh × 384/192): xác minh byte PNG, giải mã WebP, timeline, alpha; không có lint/cảnh báo trùng frame. Builder vẫn ghi `needs-visual-review`, không chứng nhận chất lượng thẩm mỹ.
4. JavaScript trang so sánh qua kiểm tra cú pháp Node. Đường dẫn ảnh trước/sau ở cả hai kích thước đều tồn tại, dùng đường dẫn tương đối.
5. Bộ dò chuyển chân được cấu hình theo góc camera và màu giáp thực tế: **`near, near, far, far, far, far, near, near`**, cả bốn cặp nửa chu kỳ đều đổi chân; `leg_alternation: pass`, `phase_coverage: pass`. Xem `qa/final-v2-run-camera/sheet-qc.json`.

**Chưa xác minh phát bằng Chrome thực tế.** Đã thử công cụ điều khiển trình duyệt/cửa sổ: browser host không có, sau khi khởi tạo lại CUA báo `failed to write kernel assets ... OS error 3`. Không giả định các kiểm tra file và cú pháp thay thế được kiểm thử browser. Chưa đo FPS/RAM thực trên Intel Iris Xe, chưa kiểm thử chuyển động trong game, tốc độ di chuyển, trượt chân, va chạm hoặc mạng.

## Cảnh báo còn giữ nguyên

Không có kết luận “mọi bài kiểm tra đều pass”. Các báo cáo thô trước/sau đều lưu trong `qa/`.

- `identity_head_ratio` của bộ dò toàn vùng trên vẫn `fail`: chạy tối đa 1,064, đánh tối đa 1,071, vượt ngưỡng 1,05. Vùng đo này có thể chứa khăn hoặc kiếm giơ lên. Không thay ngưỡng để báo đạt.
- Kiểm tra bổ sung dùng ROI/mask tóc và da, loại phần lớn kiếm/khăn, cho ước lượng tỉ lệ khớp đầu 1,00 ở chạy và 1,00–1,04 ở đánh. Đây là bằng chứng bổ sung sau khi xem crop; mask vẫn có giới hạn (tóc, cổ áo hoặc biên ROI), không phải phép đo tuyệt đối hộp sọ và không xóa kết quả thô. File: `qa/run-se-head-only-depth/` và `qa/attack-se-head-only-depth/`.
- `leg_alternation` trong chế độ **auto-luminance** mặc định vẫn `fail`. Đọc mã Forge xác nhận chế độ này chỉ lấy 18% cuối của hình: với camera SE từ trên xuống, chân co phía sau nằm cao hơn vùng đó, nên một bàn chân có thể bị chia làm “hai chân”. Phép kiểm theo màu khai báo và vùng 65% chứa cả hai chân là phép kiểm bổ sung phù hợp hơn; giữ cả hai báo cáo, không sửa mã Forge.
- `torso_drift` của đánh còn `warn` khoảng 6,77 pixel ở kích thước kiểm tra (bản cũ 11,84). Đã cố định hông; vai và áo vẫn xoay theo nhát chém. Cần xem chuyển động thực tế trước khi chốt hoàn toàn. Bản kiểm theo màu chân dùng ngưỡng màu 24 thay vì 30 cũng có thể cảnh báo thân vì nhóm pixel áo thay đổi; không dùng cảnh báo đó làm số đo chính xác gốc vật lý.
- Các cảnh báo đầy đủ (giá trị, ngưỡng và frame) nằm trong [qa-report.json](final-v2/qa-report.json), có liên kết tới report gốc.

## Nguồn và công cụ

ImageGen tích hợp tạo ba ảnh thực: sheet chạy theo guide, sheet đánh theo guide, bản chỉnh sắc độ chân của chạy. Prompt thật và nguồn ở [source-files.json](source-files.json), thư mục `prompts/`, `raw/`.

Agent Sprite Forge 0.4, commit `5324342fdfab72430f4e9604f3fe427009f8596d`, repo https://github.com/0x0funky/agent-sprite-forge, giấy phép MIT. Không thay phiên bản hoặc sửa mã công cụ. Tên/phiên bản model nền của ImageGen không được host công bố.

`make_pose_guide.py` chỉ tạo sơ đồ hình học hướng dẫn, không phải hình nhân vật để đưa vào game. Art nhân vật bắt nguồn từ ImageGen. Các script khác chỉ tách nền, đăng ký, dịch chuyển nguyên pixel, giảm kích thước đồng loạt, đóng gói và kiểm tra; không vẽ tư thế cuối bằng hình học, không dùng lật hình để giả hướng.

Không dùng video, TRELLIS, GPU cục bộ hoặc dịch vụ trả phí mới. Không thêm credential. Giấy phép MIT của tool không tự bảo đảm quyền độc quyền của ảnh AI. Không thay runtime, cấu hình mạng, triển khai hoặc game nối từ trong lượt này.

## Các script trong đợt sửa

`make_pose_guide.py`, `normalize.py`, `diagnose_sheets.py`, `make_head_review.py`,
`head_mask_review.py`, `package_assets.py`, `check_exports.py`.

Kiểm tra lại gói đã chọn: `python art/arena-2d/batch-04/check_exports.py --bundle final-v2 --head-suffix=-depth`.
Các bước tạo/xuất ghi thư mục mới và từ chối đè gói đã tồn tại; giữ bản trước để đối chiếu.
