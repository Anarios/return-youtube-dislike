Прочетете това на други езици: [English](README.md), [Nederlands](READMEnl.md), [Türkçe](READMEtr.md)

# return-youtube-dislike-site

## Настройки за изграждане

```bash
# инсталирайте зависимостите (dependencies)
$ npm install

# sстартирайте с горещо презареждане (hot reload) на localhost:3000
$ npm run dev

# проверете вашите промени
$ npm run lint

# изградете за продукция и стартирайте сървъра
$ npm run build
$ npm run start

# генерирайте статичен проект
$ npm run generate
```

За подробно обяснение на как работят нещата, разгледайте [документацията](https://nuxtjs.org).

## Препоръчителна настройка в VSCode

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Open Settings (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Специални директории

Можете да създадете следните допълнителни директории, част от които имат специално поведение. Само `pages` се изисква; можете да ги изтриете, ако не искате да използвате тяхната функционалност.

### `assets`

Директорията за активи съдържа некомпилираните ви активи като файлове Stylus или Sass, изображения или шрифтове.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/directory-structure/assets).

### `components`

Директорията за компоненти съдържа вашите компоненти на Vue.js. Компонентите образуват различните части на страницата ви и могат да бъдат преизползвани и включвани във вашите страници, оформления и дори други компоненти.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/directory-structure/components).

### `layouts`

Оформленията са отлична помощ, когато искате да промените външния вид на вашия Nuxt ап, независимо дали искате да включите страничен бар или да имате различни оформления за мобилни и настолни компютри.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/directory-structure/layouts).

### `pages`

Тази директория съдържа вашите изгледи и маршрути на приложението ви. Nuxt ще прочете всички файлове `*.vue` в тази директория и автоматично ще настрои Vue Router.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/get-started/routing).

### `plugins`

Директорията с плъгини съдържа JavaScript плъгини, които искате да изпълните преди да инстанциирате основното приложение на Vue.js. Това е мястото, където да добавяте Vue плъгини и да внедрявате функции или константи. Всеки път, когато имате нужда от `Vue.use()`, трябва да създадете файл в `plugins/` и да добавите неговия път в плъгините в `nuxt.config.js`.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/directory-structure/plugins).

### `static`

Тази директория съдържа статичните ви файлове. Всеки файл в тази директория е съпоставен с `/`.

Пример: `/static/robots.txt` е съпоставен като `/robots.txt`.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/directory-structure/static).

### `store`

Тази директория съдържа файловете на вашето сървис за управление на състоянието Vuex. Създаването на файл в тази директория активира автоматично Vuex.

Повече информация за използването на тази директория може да намерите в [документацията](https://nuxtjs.org/docs/2.x/directory-structure/store).
