# Animation nhân vật bằng frame trực tiếp

Bản sửa mới ở [batch-04](../batch-04/README.md), có [so sánh trước/sau](../batch-04/preview.html). Giữ batch-03 làm mốc đối chiếu.

Phạm vi: tạo asset anime cho game 2.5D; không thay đổi hoặc tích hợp mã game.

## Phương pháp

- ImageGen tích hợp tạo các tư thế thực tế từ nhân vật đã duyệt.
- Agent Sprite Forge 0.4, commit `5324342fdfab72430f4e9604f3fe427009f8596d`, xử lý sprite sheet, nền, khung hình và kiểm tra kỹ thuật.
- Không dùng hoặc giả lập video đầu vào. Không yêu cầu GPU trên máy người chơi để tạo asset.
- Mỗi hướng/hành động có sheet riêng, giữ tay cầm kiếm và camera; không lật ảnh để giả hướng khác.
- Thử đầu tiên: đấu sĩ chạy hướng Đông Nam, 8 tư thế tiếp đất/hạ trọng tâm/qua chân/bay, luân phiên hai chân.

## Trạng thái

Đã tạo **14 tư thế thực tế** của đấu sĩ, chỉ hướng **Đông Nam / SE**:

| Hành động | Tư thế | Phát | Thời gian |
|---|---:|---|---|
| Chạy | 8 | Chu kỳ, hai nửa bước | 5 tick/frame ở 60 Hz; tổng 2/3 giây |
| Đánh kiếm | 6 | Một lần, giữ frame cuối | 6/7/5/3/5/8 tick; tổng 34/60 giây |

Có PNG RGBA, atlas, GIF xem nhanh, WebP và manifest clip có timing/sự kiện. Đánh có lấy đà, chém, thu kiếm; sự kiện `hit` nằm ở tư thế 4. Đây là nhãn chuẩn bị tích hợp, chưa gây sát thương trong game.

**Gỡ được phụ thuộc video, nhưng chưa hoàn tất bộ animation tám hướng.** Bộ hiện tại là prototype, chưa đạt mọi kiểm tra hình ảnh. Chưa nhân rộng sang bảy hướng còn lại hoặc ba tướng khác. Không dùng lật ảnh để giả hướng hoặc đổi tay cầm kiếm.

## Xem kết quả

Mở [preview.html](preview.html) trực tiếp bằng trình duyệt, không cần server. Có chạy/đánh, dừng, phát lại, kéo từng frame, tốc độ và nền tối/sáng/bản đồ. Không có CDN, tải video hoặc API. Đây là trang xem asset, không thay đổi game.

- [Danh mục file và hash](final/catalog.json).
- [Chạy: WebP đúng timeline](final/run-se/clips/clips/clip-00.webp), [GIF xem nhanh](final/run-se/preview.gif), [atlas](final/run-se/sheet.png).
- [Đánh: WebP đúng timeline](final/attack-se/clips/clips/clip-00.webp), [GIF xem nhanh](final/attack-se/preview.gif), [atlas](final/attack-se/sheet.png).
- [Báo cáo kiểm tra đầy đủ](final/qa-report.json).

GIF chỉ là preview: đồng hồ GIF theo đơn vị 10 ms, nên thời gian chạy 83⅓ ms được xem ở 80 ms. PNG player trong HTML và manifest/WebP dùng timeline tick, không dùng thời gian GIF để làm gameplay. GIF đánh phát lại để dễ xem; manifest và trang HTML xử lý đánh một lần.

## Xử lý và tối ưu

1. Hai lần tạo sheet chạy ban đầu lặp chân dẫn. Bản v2 không cải thiện nên loại.
2. Tạo riêng bốn tư thế nửa sau để có đổi chân rõ hơn. `assemble_run_trial.py` ghép hai nửa bằng một tỉ lệ/dịch chuyển chung cho từng nguồn; không vẽ hoặc nội suy ra tư thế mới bằng mã.
3. `register_actions.py` căn hai hành động bằng một tỉ lệ chung cho toàn hành động, không fit bbox từng frame.
4. Forge `process`: nền mềm, khử viền magenta, khung 384 × 384, tỉ lệ chung, giữ chuyển động bay/nhún. Bộ dò tràn ô của các sheet đã đăng ký trả `pass`, không có cảnh báo. Quy tắc largest-component chỉ áp dụng body nối liền; không dùng để che tràn ô.
5. `finalize.py` dùng `scale_frames.measure/plan_shifts` của Forge để khóa lệch ngang thân khi chạy và cân đường đất giữa hai hàng bằng dịch chuyển nguyên pixel. Không khóa đáy từng frame, nên giữ pha bay. Không mất pixel hoặc cắt mép. Khi đánh, giữ xoay/ngả thân chủ ý.
6. Một lượt ImageGen sửa tính nhất quán sau đó không cải thiện chỉ số đầu (tối đa 1.122 so với 1.10); giữ làm tài liệu thử nghiệm và không chọn.
7. Xuất thêm cùng 14 tư thế ở 192 × 192 bằng giảm kích thước RGBA premultiplied đồng loạt, không thay động tác. Xem `final/lite/`. RAM pixel thô của 14 frame: khoảng 8,26 MB ở 384 hoặc 2,06 MB ở 192; chưa tính bộ nhớ trình duyệt, GPU hoặc bản sao atlas. Đây là ước tính dung lượng pixel, **không phải** benchmark FPS trên Intel Iris Xe.

## Kết quả kiểm tra và giới hạn

- 14 PNG gốc: RGBA thật, 384 × 384, có nội dung và alpha; không chạm mép/cắt pixel sau đăng ký.
- Forge clip builder chạy strict: không có lint hoặc cảnh báo frame trùng; xác minh byte/hash, giải mã WebP, alpha và timeline. Trạng thái của builder vẫn là `needs-visual-review`, không phải chứng nhận animation đẹp.
- Kiểm tra cú pháp JavaScript và đường dẫn local của trang xem thử đã chạy. Chưa chạy trang xem thử bằng browser automation, chưa benchmark trên máy bạn.
- **Bộ dò frame của cả hai clip vẫn trả `fail`: `identity_head_ratio`.** Chạy ước lượng 0.94–1.10, đánh 0.918–1.082, vượt ngưỡng 0.95–1.05. Đây là ước lượng template của công cụ, có thể chịu ảnh hưởng tóc/khăn/kiếm và góc nghiêng; không tự bỏ hoặc đổi ngưỡng để báo đạt.
- Chạy còn `phase_coverage` và `leg_alternation` cảnh báo: bộ dò chưa xác nhận đủ tư thế tiếp đất rộng và đổi chân ở mọi cặp nửa chu kỳ. Đã xem các tư thế và cải thiện nửa sau, nhưng chưa có cơ sở gọi là chu kỳ chạy hoàn chỉnh đạt chất lượng cuối.
- Đánh còn `torso_drift` khoảng 11.84 pixel ở kích thước kiểm tra; có động tác vặn/ngả thân chủ ý, cần xem lại khi chỉnh animation và ghép với game. Không khóa thân cứng để chỉ làm mất cảnh báo.
- Lệch ngang thân của chạy đã được xử lý bằng đăng ký. Các lỗi/cảnh báo trước và sau xử lý vẫn lưu trong `qa/`; bản tổng hợp giữ nguyên nội dung lỗi/cảnh báo của bản được chọn.
- Chưa kiểm tra cảm giác chạy theo vận tốc thật, trượt chân, va chạm, ghép hit/VFX, chuyển hướng, mạng hoặc hiệu năng game. Chưa sửa mã game nên không chạy lại test gameplay trong đợt asset này.
- Hiệu ứng slash là layer riêng từ batch-02; body đánh không chứa sẵn vòng sáng. Preview hiện xem body để lộ lỗi chuyển động, chưa phải chiêu thức trong game.

## Công cụ, nguồn và quyền sử dụng

Hình dùng ImageGen tích hợp; công cụ không công bố tên/phiên bản model nền. Forge là bộ xử lý có giấy phép MIT tại commit nêu trên, không phải mô hình tạo video hoặc nguồn motion capture. Không sử dụng TRELLIS.2, video sinh AI, model 3D/rig hoặc API trả phí bên ngoài trong đợt này. Không thêm credential.

Nhân dạng dựa trên master anime đã được duyệt trong dự án. Prompt thực tế ở `prompts/`, nguồn và lựa chọn ở `source-files.json`. Prompt lưu ở pipeline của run chỉ là prompt nguồn đầu; nguồn ghép chính xác gồm run-v1 + far-half, được ghi trong registration JSON. Giấy phép MIT của công cụ không tự cấp bảo đảm về tính độc quyền/bản quyền của ảnh do AI sinh.

## Phần còn phải làm

Sửa các tư thế được QA đánh dấu, kiểm tra loop trực quan trong trình duyệt; sau đó mới mở rộng các hướng S/SW/W/NW/N/NE/E, tiếp đến idle/cast/hurt và các tướng khác. Mỗi hướng cần vẽ đúng camera và tay kiếm; không thay bằng lật sprite. Toàn bộ việc tích hợp vào game vẫn để giai đoạn sau theo yêu cầu của bạn.

## Kiểm tra bắt buộc

Kiểm tra số ô, tràn ô, alpha, tỉ lệ, điểm neo; sau đó xem hình và vòng lặp để đánh giá nhân dạng, tay cầm kiếm, hai nửa bước chạy và chuyển pha cuối–đầu. Kết quả kỹ thuật không thay thế kiểm tra chuyển động. Chưa kiểm thử trong game khi chưa tích hợp.
