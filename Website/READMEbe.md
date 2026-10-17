Read this in other languages: [English](README.md), [беларуская](READMEbe.md), [Nederlands](READMEnl.md), [Türkçe](READMEtr.md), [Deutsch](READMEde.md), [български](READMEbg.md), [Tiếng Việt](READMEvi.md)

# return-youtube-dislike-site

## Налада зборкі

```bash
# устаноўка залежнасцяў
$ npm install

# запуск лакальнага сервера з гарачай перазагрузкай на localhost:3000
$ npm run dev

# праверка лінтарам
$ npm run lint

# зборка для працоўнага асяроддзя і запуск сервера
$ npm run build
$ npm run start

# генерацыя статычнага праекта
$ npm run generate
```

Падрабязнае тлумачэнне таго, як усё працуе, глядзіце ў [дакументацыі Nuxt.js](https://nuxtjs.org).

## Рэкамендаваная налада VSCode

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Open Settings (JSON)

```json
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
},
"vetur.validation.template": false
```

## Адмысловыя каталогі

Вы можаце ствараць наступныя дадатковыя каталогі, некаторыя з якіх маюць адмысловыя паводзіны. Абавязковым з'яўляецца толькі `pages`; вы можаце выдаліць астатнія, калі вам не патрэбна іх функцыянальнасць.

### `assets`

Каталог assets змяшчае нескампіляваныя рэсурсы, такія як файлы Stylus ці Sass, выявы або шрыфты.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/directory-structure/assets).

### `components`

Каталог components змяшчае вашы кампаненты Vue.js. Кампаненты складаюць розныя часткі вашай старонкі і могуць быць паўторна выкарыстаны і імпартаваныя ў вашы старонкі, макеты і нават іншыя кампаненты.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/directory-structure/components).

### `layouts`

Макеты дапамагаюць змяняць знешні выгляд вашай праграмы Nuxt, незалежна ад таго, ці патрэбна бакавая панэль або асобныя макеты для мабільных і настольных прылад.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/directory-structure/layouts).

### `pages`

Гэты каталог змяшчае прадстаўленні (views) і маршруты праграмы. Nuxt прачытае ўсе файлы `*.vue` у гэтым каталогу і аўтаматычна наладзіць Vue Router.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/get-started/routing).

### `plugins`

Каталог plugins змяшчае JavaScript-плагіны, якія павінны выконвацца перад ініцыялізацыяй каранёвай праграмы Vue.js. Тут можна дадаваць плагіны Vue і ўкараняць функцыі або канстанты. Кожны раз, калі патрабуецца `Vue.use()`, варта стварыць файл у `plugins/` і дадаць яго шлях у спіс `plugins` у `nuxt.config.js`.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/directory-structure/plugins).

### `static`

Гэты каталог змяшчае статычныя файлы. Кожны файл адлюстроўваецца ў корань `/`.

Прыклад: `/static/robots.txt` даступны як `/robots.txt`.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/directory-structure/static).

### `store`

Гэты каталог змяшчае файлы сховішча Vuex. Стварэнне файла ў гэтым каталогу аўтаматычна актывуе Vuex.

Больш падрабязна ў [дакументацыі](https://nuxtjs.org/docs/2.x/directory-structure/store).
