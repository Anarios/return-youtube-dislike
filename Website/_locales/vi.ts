import { vi } from "vuetify/src/locale";

export default {
  ...vi,
  home: {
    name: "Trang Chủ",
    title: "Return YouTube Dislike",
    subtitle: 'Tiện ích mở rộng cho trình duyệt và API hiển thị số lượt "Không thích" trên YouTube',
    ukraine: "Ủng hộ U-crai-na",
    sponsors: "Tài trợ",
  },
  install: {
    name: "Cài Đặt",
    title: "Chọn Nền tảng",
    subtitle: "Tương thích với trình duyệt Firefox và tất cả các trình duyệt Chromium",
    title2: "Nền tảng Khác",
    subtitle2: "Nếu trình duyệt của bạn chưa được hỗ trợ, hãy thử dùng Tập lệnh Người dùng",
    title3: "Thực hiện bởi Bên Thứ ba",
    subtitle3: "Nhóm phát triển không chịu trách nhiệm cho bất kì rủi ro nào bạn gặp phải khi sử dụng",
  },
  api: {
    name: "API",
    title: "Chào mừng tới tài liệu RYD chính thức!",
    subtitle: "Để bắt đầu, hãy chọn một mục trong danh sách.",
    rights: {
      title: "Quyền Sử dụng",
      subtitle:
        "Bên thứ ba được phép sử dụng API mở này, với các hạn chế sau:",
      bullet1: "Ghi công: ",
      bullet1text:
        "Phải ghi công dự án này rõ ràng bằng đường dẫn tới kho mã nguồn hoặc đường dẫn tới trang returnyoutubedislike.com",
      bullet2: "Giới hạn Truy vấn: ",
      bullet2text:
        'Giới hạn truy vấn cho mỗi khách là 100 lần mỗi phút và 10.000 lần mỗi ngày. Mã trạng thái 429 "Quá Nhiều Yêu cầu" sẽ được trả về khi khách đạt tới giới hạn trên.',
    },
    url: {
      title: "Thông tin Đường dẫn",
      subtitle: "API có thể được truy cập với đường dẫn cơ sở sau: ",
    },
    endpoints: {
      title: "Các Hậu tố",
      subtitle: "Danh sách các hậu tố được liệt kê ở đây: ",
    },
    fetching: {
      title: "Hướng dẫn Truy vấn Cơ bản",
      subtitle: "Ví dụ cách truy vấn đánh giá với một ID của một vi-đê-ô trên YouTube: ",
      title2: "Truy vấn Ví dụ: ",
      url: "Đường dẫn Truy vấn: ",
      method: "Phương thức Truy vấn: ",
      headers: "Phần đầu: ",
      response: "Phản hồi: ",
      error1: 'Nếu ID không tồn tại, mã trạng thái 404 "Không Tìm thấy" sẽ được trả về"',
      error2:
        'Nếu ID có định dạng không hợp lệ, mã trạng thái 400 "Yêu cầu Không hợp lệ" sẽ được trả về',
    },
  },
  help: {
    name: "Trợ Giúp",
    title: "Khắc phục Sự cố",
    bullet1: "Hãy kiểm tra phiên bản của tiện ích mở rộng. Phiên bản mới nhất là: ",
    bullet11: "",
    bullet2:
      "Thử gỡ bỏ và cài lại tiện ích mở rộng, rồi tắt và mở lại trình duyệt (tắt toàn bộ cửa sổ của trình duyệt, không phải tắt chỉ một thẻ)",
    bullet3: "Kiểm tra xem bạn có truy cập theo đường dẫn này được không: ",
    bullet31: "và nếu truy cập được, kiểm tra xem bạn có thấy đoạn văn bản thô tương tự đoạn văn bản dưới đây hay không: ",
    bullet4: "Nếu các bước trên không khắc phục được sự cố, hãy gửi báo cáo sự cố của bạn tới kênh",
    bullet41: "trên",
    bullet4a: "Cung cấp thông tin Hệ điều hành, Tên Trình duyệt và Phiên bản Trình duyệt (xem thông tin bên dưới)",
    bullet4b:
      "Tại trang có sự cố (ví dụ như trang phát vi-đê-ô trên YouTube), mở bảng điều khiển (nhấn nút ",
    bullet4b1: ") và chụp màn hình. Xem hình ví dụ ở bên dưới.",
    bullet4c:
      "Mở trang quản lí tiện ích mở rộng trong trình duyệt mà bạn cài tiện ích mở rộng này.",
    bullet4c1: "Để mở trang quản lí tiện ích, nhập nội dung sau vào thanh địa chỉ: ",
    firefox: "đối với trình duyệt Firefox",
    chrome: "đối với các trình duyệt Chrome, Edge, Brave, Opera, và Vivaldi",
  },
  faq: {
    name: "Hỏi-Đáp",
    title: "Câu hỏi Thường gặp",
    subtitle: "Bạn vẫn còn điều gì cần giải đáp? Hãy tham gia Discord của chúng tôi!",
    bullet1: "Tiện ích mở rộng này lấy dữ liệu từ đâu?",
    bullet1text:
      'Dữ liệu của tiện ích này bao gồm dữ liệu được lưu trữ trước khi YouTube loại bỏ số lượt "không thích" khỏi API chính thức và các ước tính ngoại suy từ hành vi của người dùng.',
    bullet2: 'Tại sao số lượt "không thích" không được cập nhật?',
    bullet2text:
      'Hiện tại, số lượt "không thích" được lưu vào cơ sở dữ liệu và số lượt được hiển thị không được cập nhật liên tục. Việc cập nhật số lượt được hiển thị tùy thuộc vào độ phổ biến của vi-đê-ô, có thể mất vài giờ tới vài ngày để cập nhật.',
    bullet3: "Cách thức hoạt động của tiện ích mở rộng này?",
    bullet3text:
      'Tiện ích này thu thập ID của vi-đê-ô mà bạn xem, rồi sử dụng API của chúng tôi để truy vấn số lượt "không thích" (cùng với các thông tin khác như lượt xem, số lượt "thích", v.v.). Sau đó, tiện ích sẽ hiển thị số lượt "không thích" và tỉ lệ "thích"/"không thích". Nếu bạn đánh giá "thích" hay "không thích" một vi-đê-ô, đánh giá này sẽ được ghi lại và gửi vào cơ sở dữ liệu, nhờ đó số lượt "không thích" có thể được ngoại suy chính xác.',
    bullet4: 'Tôi có thể chia sẻ số lượt "không thích" của mình cho nhóm phát triển không?',
    bullet4text:
      'Tính năng này sẽ sớm có. Chúng tôi đang tìm hiểu cách dùng Oauth hay API chỉ-đọc với phạm vi giới hạn để các nhà sáng tạo nội dung có thể chia sẻ lượt "không thích" của mình.',
    bullet5: "Dữ liệu nào được tiện ích này thu thập và dữ liệu này được dùng ra sao?",
    bullet5text:
      'Tiện ích này chỉ thu thập dữ liệu cần thiết để hoạt động chính xác, bao gồm địa chỉ IP và ID của vi-đê-ô mà bạn xem. Dữ liệu của bạn không bị bán cho bên thứ ba. Nếu bạn muốn biết thêm về cách chúng tôi đảm bảo tính bảo mật và quyền riêng tư, vui lòng tham khảo <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQvi.md">những câu hỏi thường gặp về bảo mật</a>.',
    bullet6: "API/Đầu sau hoạt động ra sao?",
    bullet6text:
      'Đầu cuối sử dụng dữ liệu được lưu trữ từ thời API của YoutTube vẫn còn cung cấp số lượt "không thích", số lượt "thích"/"không thích" từ người dùng và ước tính ngoại suy. Trong tương lai gần, tiện ích sẽ cho phép các nhà sáng tạo nội dung gửi số lượt "không thích" về cho nhóm phát triển một cách dễ dàng và bảo mật và chúng tôi cũng sẽ gộp dữ liệu của ArchiveTeam (4,56 triệu vi-đê-ô) vào cơ sở dữ liệu của chúng tôi. Bạn có thể xem vi-đê-ô về chủ đề này để biết thêm thông tin.',
    bullet7: "Tại sao nút \"Không thích\" hiện nội dung 'Chủ kênh đã Tắt Đánh giá'?",
    bullet7text:
      "Đôi khi vi-đê-ô mới được đăng tải sẽ hiển thị nút đánh giá với nội dung 'Chủ kênh đã Tắt Đánh giá' mặc dù chủ kênh không hề tắt chức năng đánh giá. Việc này là do cách thức mà tiện ích này xác định việc tắt đánh giá. Tình trạng này có thể sẽ biến mất sau vài giờ hoặc sau khi bạn đánh giá \"thích\" hay \"không thích\" vi-đê-ô này kèm theo việc tải lại trang.",
  },
  donate: {
    name: "Quyên Góp",
    subtitle:
      "Bằng cách quyên góp, bạn có thể hỗ trợ nỗ lực của chúng tôi trong việc giữ cho Internet được miễn phí!",
  },
  links: {
    name: "Đường Dẫn",
    title: "Các Đường dẫn của Dự án",
    subtitle: "Đường dẫn tới dự án và nhóm phát triển",
    contact: "Thông tin Liên lạc",
    translators: "Người dịch",
    coolProjects: "Các Dự án Thú vị",
    sponsorBlockDescription: "Lướt qua quảng cáo được chèn trong nội dung vi-đê-ô",
    filmotDescription: "Tìm vi-đê-ô YouTube bằng phụ đề",
  },
};
