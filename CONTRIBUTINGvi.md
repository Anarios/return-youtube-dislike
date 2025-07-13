Đọc bằng các ngôn ngữ khác: [English](CONTRIBUTING.md), [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md)


# Chào mừng tới Hướng dẫn Đóng góp của Return YouTube Dislike (Trả lại số lượt Không thích trên YouTube) <!-- # Welcome To Return YouTube Dislikes contributing guide -->

Cảm ơn bạn đã dành thời gian để đóng góp cho dự án của chúng tôi! Tất cả các thay đổi của bạn sẽ được hiển thị trong phiên bản tiếp theo của tiện ích mở rộng này (hoặc của [trang mạng](https://www.returnyoutubedislike.com/)).

## Bắt đầu <!-- ## Getting Started -->

Hãy dùng [Prettier](https://prettier.io/) với thiết lập mặc định để định dạng mã.

#### Yêu cầu sơ bộ <!-- ### Prerequisites -->

Bạn cần phải cài **node** và **npm** để tạo bản đóng gói của mã nguồn.

Các phiên bản được dùng khi cài đặt:

- node: 12.18.4
- npm: 6.14.6

Dể có thể tạo tệp `bundled-content-script.js`, trong đó có chứa hầu hết các lôgic kinh doanh của tiện ích mở rộng này, trước tiên bạn phải cài các đối tượng phụ thuộc.

1. Tới thư mục gốc của kho mã nguồn và chạy lệnh:

```
npm install
```

2. Chạy lệnh dưới đây để tạo `bundled-content-script.js`, sẽ dùng tới trong `manifest.json`

```
npm start // để tạo (các) tệp xây dựng và khởi chạy một trình quan sát tập tin, đảm nhiệm việc tự động tải lại dự án khi có thay đổi được lưu

// hoặc

npm run build // để tạo (các) tệp xây dựng chỉ một lần
```

Chúc mừng! Bạn đã sẵn sàng để phát triển chương trình!

Nếu bạn chưa bao giờ phát triển tiện ích mở rộng cho Chrome hoặc cần sự trợ giúp, hãy xem [hướng dẫn này trên YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Vấn đề <!-- ### Issues -->

#### Tạo một vấn đề mới <!-- #### Opening a new issue -->

Nếu bạn có bất kì vấn đề gì với tiện ích mở rộng này, trước tiên hãy đọc qua danh sách các vấn đề đang có. Nếu vấn đề của bạn không có trong danh sách các vấn đề, hãy [tạo một vấn đề](https://github.com/Anarios/return-youtube-dislike/issues/new?assignees=&labels=bug&template=bug.yml&title=%28Bug%29%3A+). Dùng mẫu đơn vấn đề nếu có thể, nhưng không bắt buộc.

#### Giải quyết một vấn đề <!-- #### Solving an issue -->

Nếu bạn cảm thấy có thể giải quyết một vấn đề nào đó, đừng ngần ngại. Hãy tạo một [yêu cầu kéo](https://github.com/Anarios/return-youtube-dislike/pulls) cho sự thay đổi của bạn và nhớ hãy ghi tên lỗi mà bạn giải quyết.

### Yêu cầu Tính năng <!-- ### Feature Request -->

#### Tạo một yêu cầu tính năng mới <!-- #### Opening a new feature request -->

Nếu bạn có một ý tưởng dành cho tiện ích mở rộng này, hãy mạnh dạn [tạo một yêu cầu chức năng](https://github.com/Anarios/return-youtube-dislike/issues/new?assignees=&labels=enhancement&template=feature-request.yml&title=%28Feature+Request%29%3A+), nhưng hãy chắc rằng bạn đã tìm và không thấy yêu cầu tính năng y hệt trong danh sách yêu cầu tính năng. Dùng mẫu đơn yêu cầu tính năng nếu có thể, nhưng không bắt buộc.

#### Thực hiện một yêu cầu tính năng <!-- #### Implementing a feature request -->

Nếu bạn cảm thấy có thể thực hiện một tính năng nào đó, đừng ngần ngại. Hãy tạo một [yêu cầu kéo](https://github.com/Anarios/return-youtube-dislike/pulls) cho sự thay đổi của bạn và nhớ hãy ghi tên tính năng mà bạn thực hiện.

### Những yêu cầu kéo mà chúng tôi chấp nhận? <!-- ### What PRs do we accept? -->

- Giải quyết vấn đề.
- Thực hiện tính năng.
- Sửa lỗi chính tả hoặc đề xuất cách dùng từ tốt hơn.
- Đóng góp cho trang mạng.
