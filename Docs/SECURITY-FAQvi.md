Đọc bằng các ngôn ngữ khác: [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Tiếng Việt](SECURITY-FAQvi.md)


# Tính Bảo mật

### Tiện ích mở rộng này có theo dõi lịch sử xem vi-đê-ô của tôi không?

Không. Mã nguồn của tiện ích mở rộng này được cung cấp công khai và bạn có thể kiểm tra mã nguồn nếu muốn. Thông tin duy nhất được tiện ích này gửi đi là ID của vi-đê-ô vì việc truy vấn số lượt đánh giá "không thích" cần ID của vi-đê-ô. Không thông tin nào khác được gửi đi. Ở lớp truyền tải, máy chủ sẽ biết được địa chỉ IP của bạn cũng như thời điểm mà truy vấn được tạo. Tuy nhiên, những thông tin này không thể định danh chính xác bạn. Giả sử với môi trường bất tín, chúng tôi cùng lắm chỉ có thể biết được địa chỉ IP động. Địa chỉ IP động là của bạn ngày hôm nay, nhưng sẽ là của người khác vào ngày mai. Nếu bạn lo lắng rằng địa chỉ IP của mình bị theo dõi, bạn có thể sử dụng mạng riêng ảo.

### Nhóm phát triển có thể định danh chính xác tôi không nếu như tôi có đánh giá "không thích"?

Có. Khi bạn đưa ra đánh giá "không thích" với một vi-đê-ô, chúng tội sẽ tạo ra một số định danh duy nhất ngẫu nhiên cho bạn, nhưng số định danh này không có bất kì mối liên hệ nào với tài khoản Google của bạn. Việc tạo số định danh là nhằm tránh người dùng bot. Không có bất kì cách nào để liên hệ số định danh này với bạn hay với tài khoản YouTube của bạn.

### Chính xác thì thông tin nào được thu thập?

Chỉ có ID của vi-đê-ô sẽ được thu thập. Bình luận của bạn, không. Tên người dùng của bạn, không. Thông tin của người mà bạn chia sẻ vi-đê-ô, không. Siêu dữ liệu khác, không. Không có bất kì thông tin nào khác được thu thập. Chỉ duy nhất ID của vi-đê-ô.

### Địa chỉ IP của tôi được lưu trữ ra sao?

Đầu sau chỉ giữ địa chỉ IP không được băm trong bộ nhớ khả biến (RAM). Những địa chỉ này không được lưu vào bộ nhớ bất biến (như ổ đĩa cứng) và như vậy không bị ghi chép lại. Chúng tôi băm địa chỉ IP rồi mới lưu lại những địa chỉ đã băm. Việc lưu địa chỉ đã băm là nhằm tránh việc phá hoại cơ sở dữ liệu.

### Tôi có bắt gặp một số cuộc thảo luận về OAuth cũng như về việc truy cập tài khoản YouTube của tôi!

Tính năng sắp có này là tùy chọn. Nếu bạn là nhà sáng tạo nội dung trên YouTube và bạn mong muốn chia sẽ số liệu đánh giá "không thích" với chúng tôi, chúng tôi rất hoan nghênh. Cách thức hoạt động của [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) giúp đảm bảo tính bảo mật. Bạn có thể hủy bỏ các truy cập vào tài khoản của bạn bất cứ lúc nào bạn muốn và cũng như có thể đưa ra bất kì sự cho phép cụ thể nào. Chúng tôi sẽ không đòi hỏi bất kì sự cho phép nào không cần thiết. Chúng tôi chỉ xin được cấp phép để xem số liệu về vi-đê-ô của bạn.

### Số lượt đánh giá "không thích" có đáng tin cậy không?

Chúng tôi đã và đang thực hiện nhiều biện pháp phòng chống việc tấn công từ người dùng bot và sẽ tiếp duy trì việc tăng cường tính hiệu quả của hệ thống phòng chống bot: Điều này sẽ giúp chúng tôi đảm bảo rằng số lượt đánh giá "không thích" của tiện ích phản ánh đúng số lượt đánh giá thực. Tất nhiên là không thể đảm bảo chính xác hoàn toàn, cho nên tùy thuộc vào bạn có muốn tin hay không.

### Tại sao mã nguồn của đầu sau không được chia sẻ?

Chúng tôi sẽ chia sẻ mã nguồn của đầu sau trong tương lại. Nhưng không có lí do gì thực sự cấp thiết để phải chia sẻ mã nguồn vào thời điểm hiện nay. Việc chia sẻ mã nguồn sẽ tạo ra sự an tâm hão huyền vì trong môi trường bất tín, chúng tôi có thể chia sẻ mã nguồn này nhưng lại dùng mã nguồn khác. Có nhiều lí do để giữ bí mật mã nguồn, trong đó có việc chống tương tác rác. Che giấu/Làm rối mã xử lý tương tác rác là biện pháp tiêu chuẩn.
