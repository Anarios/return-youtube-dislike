Digər dillərdə oxuyun: [Nederlands](READMEnl.md), [Türkçe](READMEtr.md), [Deutsch](READMEde.md)

# return-youtube-dislike-site

## Layihənin Qurulması

```bash
# asılılıqları yüklə
$ npm install

# localhost:3000 ünvanında hot reload ilə işlət
$ npm run dev

# dəyişikliklərinizi lint ilə yoxlayın
$ npm run lint

# istehsal üçün tərtib et və serveri başlat
$ npm run build
$ npm run start

# statik layihə yaradın
$ npm run generate
```

Ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org) baxın.

## Tövsiyə Edilən VSCode Quraşdırması

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Ayarları Aç (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Xüsusi Qovluqlar

Aşağıdakı xüsusi qovluqları yarada bilərsiniz, bəzilərinin xüsusi davranışları var. Yalnız `pages` qovluğu məcburidir; digər funksiyalardan istifadə etmək istəmirsinizsə, onları silə bilərsiniz.

### `assets`

`assets` qovluğu kompilyasiya olunmamış fayllarınızı (Stylus və ya Sass faylları, şəkillər və şriftlər) saxlayır.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/directory-structure/assets) baxın.

### `components`

`components` qovluğu Vue.js komponentlərinizi saxlayır. Komponentlər səhifənizin müxtəlif hissələrini təşkil edir və səhifələrinizə, tərtibatlarınıza və digər komponentlərinizə təkrar istifadə edilə bilən şəkildə əlavə edilə bilər.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/directory-structure/components) baxın.

### `layouts`

Layoutlar, Nuxt tətbiqinizin görünüşünü və hissini dəyişdirmək istədiyiniz zaman kömək edir. Məsələn, bir yan panel əlavə etmək və ya mobil və masaüstü üçün fərqli layoutlar istifadə etmək kimi.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/directory-structure/layouts) baxın.

### `pages`

Bu qovluq tətbiqinizin görünüşlərini və marşrutlarını ehtiva edir. Nuxt, bu qovluqdakı bütün `*.vue` fayllarını oxuyaraq Vue Router-i avtomatik olaraq qurur.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/get-started/routing) baxın.

### `plugins`

`plugins` qovluğu əsas Vue.js tətbiqi başladılmadan əvvəl işlətmək istədiyiniz JavaScript plaginlərini ehtiva edir. Vue plaginlərini əlavə etmək və funksiyaları və ya sabitləri daxil etmək üçün istifadə olunur. `Vue.use()` istifadə etmək lazım gəldikdə bu qovluqda fayl yaratmalı və yolunu `nuxt.config.js`-dəki plaginlərə əlavə etməlisiniz.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/directory-structure/plugins) baxın.

### `static`

Bu qovluq statik fayllarınızı saxlayır. Bu qovluqdakı hər bir fayl `/` ünvanına xəritələnir.

Məsələn: `/static/robots.txt` faylı `/robots.txt` kimi xəritələnir.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/directory-structure/static) baxın.

### `store`

Bu qovluq Vuex store fayllarınızı ehtiva edir. Bu qovluqda fayl yaratmaq Vuex-i avtomatik olaraq aktivləşdirir.

Bu qovluğun istifadəsi haqqında daha ətraflı məlumat üçün [sənədləşməyə](https://nuxtjs.org/docs/2.x/directory-structure/store) baxın.