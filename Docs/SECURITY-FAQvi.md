Đọc bằng các ngôn ngữ khác: [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md)


# Tính Bảo mật

### Tiện ích mở rộng này có theo dõi lịch sử xem vi-đê-ô của tôi không?

Tiện ích gửi ID của vi-đê-ô đang xem và số lượt đánh giá "thích" đang hiển thị (nếu có) tới API Return YouTube Dislike để
máy chủ trả về số lượt đánh giá "không thích" ước tính và cải thiện kết quả ước tính. Qua yêu cầu này, máy chủ cũng biết
được các thông tin mạng thông thường như địa chỉ IP công khai và thời điểm gửi yêu cầu. Tiện ích không gửi tên tài khoản
YouTube, bình luận trên YouTube, dữ liệu riêng tư trên YouTube hay nội dung của các trang không liên quan. Tiện ích cũng
không lưu danh sách lịch sử xem riêng trên thiết bị. Trên Firefox, tiện ích chỉ gửi từng loại dữ liệu (ID vi-đê-ô và số lượt
đánh giá "thích") sau khi bạn cấp quyền tương ứng.

### Nhóm phát triển có thể định danh chính xác tôi không nếu như tôi có đánh giá "không thích"?

Lần đầu bạn đánh giá vi-đê-ô hoặc bày tỏ cảm xúc với bình luận RYD, tiện ích tạo một mã định danh ngẫu nhiên để dùng lâu dài
và giúp ngăn chặn hành vi lạm dụng. Tiện ích không gửi mã này khi bạn mở vi-đê-ô hoặc đọc bình luận. Mã này không được tạo từ
tài khoản Google hay YouTube và không liên kết với các tài khoản đó, nhưng Mozilla xếp mã định danh cố định vào loại dữ liệu
cá nhân. Dịch vụ dùng mã này để nhận biết các lượt đánh giá được gửi từ cùng một bản cài đặt tiện ích.

### Chính xác thì thông tin nào được thu thập?

Yêu cầu lấy số lượt đánh giá "không thích" có ID vi-đê-ô và số lượt đánh giá "thích" đang hiển thị (nếu có). Khi đăng ký,
tiện ích sử dụng mã định danh bản cài đặt được tạo ngẫu nhiên. Mỗi lượt đánh giá được gửi đi sẽ được ghi lại cùng với mã
này, ID vi-đê-ô, lựa chọn đánh giá và thời điểm gửi. Khi bạn bày tỏ cảm xúc với bình luận RYD, dịch vụ ghi lại mã định danh
của cùng bản cài đặt, ID bình luận và cảm xúc bạn đã chọn. Bản ghi lượt đánh giá và cảm xúc còn có thể chứa thông tin về
tiện ích hoặc tập lệnh người dùng bạn sử dụng, phiên bản của tiện ích hoặc tập lệnh đó, và vị trí phát tại thời điểm bạn
nhấp (tính bằng giây nguyên, nếu có). Nếu bạn bỏ cảm xúc đã chọn, bản ghi sẽ được đánh dấu là đã gỡ. Bình luận và câu trả
lời bạn đăng được hiển thị công khai dưới biệt danh RYD của bạn.

### Địa chỉ IP của tôi được lưu trữ ra sao?

Dịch vụ lưu địa chỉ IP của bạn và thông tin mô tả trình duyệt (chuỗi user-agent) nếu trình duyệt gửi kèm thông tin này
trong yêu cầu. Dịch vụ lưu các thông tin này cùng với lượt đăng ký đã hoàn tất, lượt đánh giá, bình luận và câu trả lời đã
đăng, cũng như các lượt bày tỏ cảm xúc với bình luận RYD. Địa chỉ IP được dùng để ngăn chặn hành vi lạm dụng và phân tích
dữ liệu tổng hợp. Dịch vụ không bán hoặc dùng địa chỉ IP cho quảng cáo.

### Tôi có bắt gặp một số cuộc thảo luận về OAuth cũng như về việc truy cập tài khoản YouTube của tôi!

Tính năng sắp có này là tùy chọn. Nếu bạn là nhà sáng tạo nội dung trên YouTube và bạn mong muốn chia sẽ số liệu đánh giá "không thích" với chúng tôi, chúng tôi rất hoan nghênh. Cách thức hoạt động của [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) giúp đảm bảo tính bảo mật. Bạn có thể hủy bỏ các truy cập vào tài khoản của bạn bất cứ lúc nào bạn muốn và cũng như có thể đưa ra bất kì sự cho phép cụ thể nào. Chúng tôi sẽ không đòi hỏi bất kì sự cho phép nào không cần thiết. Chúng tôi chỉ xin được cấp phép để xem số liệu về vi-đê-ô của bạn.

### Số lượt đánh giá "không thích" có đáng tin cậy không?

Chúng tôi đã và đang thực hiện nhiều biện pháp phòng chống việc tấn công từ người dùng bot và sẽ tiếp duy trì việc tăng cường tính hiệu quả của hệ thống phòng chống bot: Điều này sẽ giúp chúng tôi đảm bảo rằng số lượt đánh giá "không thích" của tiện ích phản ánh đúng số lượt đánh giá thực. Tất nhiên là không thể đảm bảo chính xác hoàn toàn, cho nên tùy thuộc vào bạn có muốn tin hay không.

### Tại sao mã nguồn của đầu sau không được chia sẻ?

Chúng tôi sẽ chia sẻ mã nguồn của đầu sau trong tương lại. Nhưng không có lí do gì thực sự cấp thiết để phải chia sẻ mã nguồn vào thời điểm hiện nay. Việc chia sẻ mã nguồn sẽ tạo ra sự an tâm hão huyền vì trong môi trường bất tín, chúng tôi có thể chia sẻ mã nguồn này nhưng lại dùng mã nguồn khác. Có nhiều lí do để giữ bí mật mã nguồn, trong đó có việc chống tương tác rác. Che giấu/Làm rối mã xử lý tương tác rác là biện pháp tiêu chuẩn.
