[![Cửa hàng Chrome Trực tuyến](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Đánh%20giá%20Chrome&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/?hl=vi)
[![Người dùng trên Cửa hàng Chrome Trực tuyến](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Người%20dùng%20Chrome&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/?hl=vi)
[![Đánh giá trên Mozilla](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Đánh%20giá%20Firefox&style=flat&logo=firefox)](https://addons.mozilla.org/vi/firefox/addon/return-youtube-dislikes/)
[![Lượt tải trên Mozilla](https://img.shields.io/amo/users/return-youtube-dislikes?label=Người%20dùng%20Firefox&style=flat&logo=firefox)](https://addons.mozilla.org/vi/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![Giấy phép](https://img.shields.io/badge/License-GPLv3-blue.svg?label=Giấy%20phép&style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)


Đọc bằng các ngôn ngữ khác: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)



# Return YouTube Dislike (Trả lại số lượt Không thích trên YouTube)

<p align="center">
    <b>Return YouTube Dislike (Trả lại số lượt Không thích trên YouTube) là một tiện ích mở rộng mã nguồn mở nhằm phục hồi số lượt "không thích" trên YouTube.</b><br>
    Tiện ích mở rộng dành cho <a href="https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/?hl=vi">Chrome</a> và <a href="https://addons.mozilla.org/vi/firefox/addon/return-youtube-dislikes/">Firefox</a>.<br>
    Cũng có thể dùng như một JS Userscript (Tập lệnh người dùng JS) trong các trình duyệt khác.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Căn nguyên <!-- ## The Story -->

Vào ngày 10 tháng 11 năm 2021, Google [thông báo](https://blog.youtube/news-and-events/update-to-youtube/) về việc loại bỏ số lượt "không thích" trên YouTube.

Thêm vào đó, vào ngày 13 tháng 12 năm 2021, Google [loại bỏ](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) trường `dislike` trong API của YouTube, do đó tước mất khả năng đánh giá chất lượng nội dung vi-đê-ô trước khi xem của người dùng.

## Cách thức hoạt động <!-- ## What it Does -->

Với việc số liệu thống kê "không thích" bị loại bỏ khỏi API của YouTube, đầu sau của chúng tôi chuyển sang sử dụng kết hợp số liệu "không thích" thu thập được và ước tính ngoại suy từ dữ liệu người dùng của tiện ích.

[Câu Hỏi Thường Gặp](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQvn.md)

## Tại sao số lượt Không thích lại quan trọng <!-- ## Why it Matters -->

Bạn có thể tìm hiểu thêm tại trang mạng: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Tài liệu API <!-- ## API documentation -->

Bên thứ ba được phép sử dụng API mở này, với các hạn chế sau:

- **Ghi công**: Phải ghi công dự án này rõ ràng bằng đường dẫn [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Giới hạn Truy vấn**: Giới hạn truy vấn cho mỗi khách là 100 lần mỗi phút và 10.000 lần mỗi ngày. Mã trạng thái _429_ "Quá Nhiều Yêu cầu" sẽ được trả về khi khách đạt tới giới hạn trên.

API có thể được truy cập với đường dẫn cơ sở sau:  
https://returnyoutubedislikeapi.com

Danh sách các hậu tố được liệt kê ở đây:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Truy vấn đánh giá <!-- ### Get votes -->

Ví dụ cách truy vấn đánh giá với một ID của một vi-đê-ô trên YouTube:  
`<Đường dẫn cơ sở>/votes?videoId=kxOuG8jMIgI`

```json
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2021-12-20T12:25:54.418014Z",
  "likes": 27326,
  "dislikes": 498153,
  "rating": 1.212014408444885,
  "viewCount": 3149885,
  "deleted": false
}
```

Trong trường hợp ID không tồn tại, mã trạng thái _404_ "Không Tìm thấy" sẽ được trả về.  
Trong trường hợp ID có định dạng không hợp lệ, mã trạng thái _400_ "Yêu cầu Không hợp lệ" sẽ được trả về.

<!---
## Tài liệu API

Bạn có thể xem tất cả tài liệu trên trang của chúng tôi.
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## Đóng góp <!-- ## Contributing -->

Vui lòng đọc [hướng dẫn đóng góp](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGvn.md).

## Hỗ trợ dự án! <!-- ## Support this project! -->

Bạn có thể hỗ trợ dự án này bằng cách quyên góp cho chúng tôi theo đường dẫn bên dưới:

[Quyên góp](https://returnyoutubedislike.com/donate)

## Tài trợ <!-- ## Sponsors -->



[Trở thành nhà tài trợ](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
