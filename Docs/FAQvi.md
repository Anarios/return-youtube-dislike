Đọc bằng các ngôn ngữ khác: [English](FAQ.md), [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md)


# Câu Hỏi Thường Gặp <!-- # Frequently Asked Questions -->

## Trước khi đưa ra bất kì câu hỏi nào trên GitHub hay trên Discord, vui lòng đọc hết trang này. <!-- ## Before asking a question on GitHub or Discord, please refer to this. -->

<br>

### **1. Tiện ích mở rộng này lấy dữ liệu từ đâu?** <!-- ### Where does this extension get the data? -->

Kết hợp dữ liệu lấy từ API của Google và dữ liệu thu thập được.

Chúng tôi lưu giữ tất cả dữ liệu mà chúng tôi có được vào cơ sở dữ liệu của chúng tôi, kể từ khi Google loại bỏ số lượt đánh giá "không thích" khỏi API của họ.

<br>

### **2. Số lượt "không thích" không được cập nhật** <!-- ### Video dislike count doesn't update -->

Hiện tại, các lượt đánh giá "không thích" sẽ được lưu lại và số lượt đánh giá tổng được hiển thị không được cập nhật thường xuyên. Thông thường, cứ mỗi 2 đến 3 ngày, chứ không ngắn hơn.

Đồng ý rằng điều này không đáng mong chờ, nhưng hiện tại thì tiện ích hoạt động như vậy. Chúng tôi đang cố gắng cải thiện tần suất nhật số lượt đánh giá.

<br>

### **3. Cách thức hoạt động của tiện ích mở rộng này?** <!-- ### How does this work? -->

Tiện ích này thu thập ID của vi-đê-ô mà bạn đang xem, truy vấn đánh giá của vi-đê-ô (bao gồm số lượt "không thích", số lượt "thích", số lượt xem, v.v.) bằng API của chúng tôi. Nếu đây là đầu tiên diễn ra truy vấn tới API của chúng tôi đối với vi-đê-ô này, tiện ích sẽ sử dụng API của YouTube sẽ truy vấn các thông tin cần thiết, sau đó lưu trữ các thông tin này vào cơ sở dữ liệu cho mục đích truy vấn nhanh (trong vòng 2 đến 3 ngày) và cho mục đích lưu trữ và sẽ trả kết quả truy vấn về cho bạn. Lúc này, tiện ích sẽ hiện thị số lượt đánh giá "không thích" cho bạn xem.

<br>

### **4. Việc gì sẽ diễn ra sau khi API của YouTube ngừng cung cấp số lượt "không thích"?** <!-- ### What will happen after the YouTube API stops returning the dislike count? -->

Đầu sau của tiện ích sẽ chuyển sang sử dụng kết hợp dữ liệu đã được lưu trữ về số lượt đánh giá "không thích", những ước tính ngoại suy từ dữ liệu người dùng của tiện ích và những ước tính dựa trên tỉ lệ lượt xem/lượt "thích" đối với những vi-đê-ô chưa lưu được số lượt "không thích" và đối với các kho lưu trữ số lượt "không thích" lỗi thời. 

<br>

### **5. Số lượt đánh giá "không thích" được tính như thế nào?** <!-- ### How is the dislike count calculated? -->

RYD sử dụng đánh giá từ người dùng để ngoại suy số lượt đánh giá "không thích".

- Nếu vi-đê-ô được đăng tải sau khi API của YouTube loại bỏ trường `dislike`:

  $$ \textup{Số lượt "Không thích" của RYD} = \left( \frac{\textup{Số lượt "Không thích" từ Người dùng của RYD}}{\textup{Số lượt "Thích" từ Người dùng của RYD}} \right) \times \textup{Số lượt "Thích" từ API của YouTube} $$

- Nếu cơ sở dữ liệu của RYD có được số lượt đánh giá "thích" và "không thích" thực (được cung cấp bởi chủ vi-đê-ô hay từ kho lưu trữ), số lượt đánh giá "không thích" sẽ được tính dựa trên đồng thời (1) đánh giá từ người dùng của tiện ích và (2) số liệu được lưu trữ. Số liệu được lưu trữ sẽ càng ngày càng kém quan trọng trong việc tính toán số lượt đánh giá.

<br>

---

Vi-đê-ô thông tin về Return YouTube Dislike:

[Giải thích về Return YouTube Dislike (Tiếng Anh)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Tôi có thắc mắc về tính bảo mật / quyền riêng tư <!-- ## I have security / privacy concerns -->

Vui lòng tham khảo [trang này](SECURITY-FAQvi.md) để biết thêm thông tin.
