Đọc bằng các ngôn ngữ khác: [English](README.md), [Nederlands](READMEnl.md), [Türkçe](READMEtr.md)

# return-youtube-dislike-site

## Thiết lập Xây dựng <!-- ## Build Setup -->

```bash
# cài đặt các đối tượng phụ thuộc
$ npm install

# chạy với tự động tải lại tại localhost:3000
$ npm run dev

# chạy lint với những thay đổi của bạn
$ npm run lint

# xây dựng ra thành phẩm và khởi động máy chủ
$ npm run build
$ npm run start

# tạo dự án tĩnh
$ npm run generate
```

Để biết thêm thông tin chi tiết về cách mọi thứ hoạt động, hãy xem [tài liệu](https://nuxtjs.org).

## Cài đặt VSCode được khuyến nghị <!-- ## Recommended VSCode Setup -->

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Mở Thiết lập Mặc định (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Các Thư mục Đặc biệt <!-- ## Special Directories -->

Bạn có thể tạo các thư mục thêm dưới đây, một vài thư mục trong số đó có chức năng đặc biệt. Chỉ thư mục `pages` là bắt buộc; bạn có thể xóa các thư mục còn lại nếu bạn không muốn sử dụng chức năng của chúng.

### `assets` <!-- ### assets -->

Thư mục assets chứa các tệp tài nguyên không được biên dịch như các tệp Stylus và Sass, hình ảnh, hoặc phông chữ.

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/directory-structure/assets).

### `components` <!-- ### components -->

Thư mục components chứa các thành phần Vue.js. Các thành phần này tạo nên các phần của trang và có thể được tái sử dụng và được nhập vào các trang, bố cục và kể cả thành phần khác. 

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/directory-structure/components).

### `layouts` <!-- ### layouts -->

Bố cục rất hữu dụng khi bạn cần thay đổi giao diện của ứng dụng Nuxt, ví dụ như thêm thanh bên hay tạo bố cục riêng biệt cho thiết bị di động và máy tính để bàn.

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/directory-structure/layouts).

### `pages` <!-- ### pages -->

Thư mục này chứa các giao diện và tuyến ứng dụng. Nuxt sẽ đọc tất cả tệp có dạng `*.vue` trong thư mục này và tự động thiết lập Bộ định tuyến Vue.

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/get-started/routing).

### `plugins` <!-- ### plugins -->

Thư mục này chứa các trình bổ trợ JavaScript được dùng để chạy trước khi khởi tạo ứng dụng Vue.js gốc. Đây là nơi để thêm các trình bổ trợ Vue và các hàm hoặc hằng số. Mỗi khi bạn muốn dùng hàm `Vue.use()`, bạn cần tạo một tệp trong thư mục `plugins/` và thêm đường dẫn tới trình bổ trợ này vào trong tệp `nuxt.config.js`.

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/directory-structure/plugins).

### `static` <!-- ### static -->

Thư mục này chứa các tệp tĩnh của bạn. Mỗi tệp trong thư mục này sẽ được gán đường dẫn `/`.

Ví dụ: `/static/robots.txt` được gán thành `/robots.txt`.

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/directory-structure/static).

### `store` <!-- ### store -->

Thư mục này chứa các tệp Vuex store. Tạo một tệp trong thư mục này sẽ tự động kích hoạt Vuex.

Thông tin về cách dùng thư mục này trong [tài liệu](https://nuxtjs.org/docs/2.x/directory-structure/store).
