Read this in other languages: [English](README.md), [Nederlands](READMEnl.md), [Deutsch](READMEde.md)

# youtube-dislike-sayısını-geri-getir-site

## Yapı Kurulumu

```bash
# bağımlılıkları yükle
$ npm install

# localhost:3000'de sıcak yeniden yükleme ile çalıştır
$ npm run dev

# değişikliklerine lint'i uygula
$ npm run lint

# üretim için yapıyı oluştur ve sunucuyu başlat
$ npm run build
$ npm run start

# statik proje oluştur
$ npm run generate
```

İşlerin nasıl yürüdüğüyle ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org)ye göz atın.

## Önerilen VSCode Kurulumu

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Varsayılan Ayarları Aç (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Özel Dizinler

You can create the following extra directories, some of which have special behaviors. Only `pages` is required; you can delete them if you don't want to use their functionality.

### `assets`

Assets dizini, Stylus veya Sass dosyaları, resimler veya yazı tipleri gibi derlenmemiş varlıklarınızı içerir.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/directory-structure/assets)ye göz atın.

### `components`

Components dizini, Vue.js bileşenlerinizi içerir. Component'ler, sayfanızın farklı bölümlerini oluşturur ve yeniden kullanılabilir. Ayrıca sayfalarınıza, mizanpajlarınıza ve hatta diğer component'lerinize de aktarılabilir.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/directory-structure/components)ye göz atın.

### `layouts`

Layouts dizini, Nuxt uygulamanızın görünümünü ve verdiği hissi değiştirmek istediğinizde, bir kenar çubuğu eklemek istediğinizde veya mobil ve masaüstü için farklı düzenlere sahip olmak istediğinizde çok yardımcı olabilir.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/directory-structure/layouts)ye göz atın.

### `pages`

Bu dizin, uygulama görünümlerinizi ve rotalarınızı içerir. Nuxt, bu dizindeki tüm `*.vue` dosyalarını okuyacak ve Vue Router'ı otomatik olarak kuracaktır.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/get-started/routing)ye göz atın.

### `plugins`

Plugins dizini, kök Vue.js Uygulamasını başlatmadan önce çalıştırmak istediğiniz JavaScript eklentilerini içerir. Burası Vue eklentileri eklemek ve işlevler veya sabitler enjekte etmek için kullanılan yerdir. `Vue.use()`u her kullanmanız gerektiğinde, `plugins/` içinde bir dosya oluşturmalı ve yolunu `nuxt.config.js` içinde eklentilere eklemelisiniz.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/directory-structure/plugins)ye göz atın.

### `static`

Bu dizin statik dosyalarınızı içerir. Bu dizindeki her dosya `/` ile eşlenir.

Örnek: `/static/robots.txt`, `/robots.txt` olarak eşlenir.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/directory-structure/static)ye göz atın.

### `store`

Bu dizin, Vuex mağaza dosyalarınızı içerir. Bu dizinde bir dosya oluşturmak, Vuex'i otomatik olarak etkinleştirecektir.

Bu dizinin kullanımı ile ilgili daha fazla bilgi için [belgeleme](https://nuxtjs.org/docs/2.x/directory-structure/store)ye göz atın.
