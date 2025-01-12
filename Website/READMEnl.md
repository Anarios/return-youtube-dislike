Read this in other languages: [English](README.md), [Türkçe](READMEtr.md), [Deutsch](READMEde.md)

# return-youtube-dislike-site

## Opstelling bouwen

```bash
# install dependencies
$ npm install

# serve with hot reload at localhost:3000
$ npm run dev

# lint your changes
$ npm run lint

# build for production and launch server
$ npm run build
$ npm run start

# generate static project
$ npm run generate
```

Voor gedetailleerde uitleg over hoe dingen werken, bekijk de [documentatie](https://nuxtjs.org).

## Aanbevolen VSCode-instellingen

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Ctrl(Cmd)` + `Shift` + `P` > Instellingen Openen (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Speciale mappen

U kunt de volgende extra mappen maken, waarvan sommige speciaal gedrag vertonen. Alleen `pagina's` zijn vereist; u kunt ze verwijderen als u hun functionaliteit niet wilt gebruiken.

### `assets`

De assets-map bevat uw niet-gecompileerde activa zoals Stylus- of Sass-bestanden, afbeeldingen of lettertypen.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/directory-structure/assets).

### `componenten`

De componentenmap bevat uw Vue.js-componenten. Componenten vormen de verschillende delen van uw pagina en kunnen opnieuw worden gebruikt en geïmporteerd in uw pagina's, lay-outs en zelfs andere componenten.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/directory-structure/components).

### `lay-outs`

Lay-outs zijn een grote hulp wanneer je het uiterlijk van je Nuxt-app wilt veranderen, of je nu een zijbalk wilt opnemen of verschillende lay-outs voor mobiel en desktop wilt hebben.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/directory-structure/layouts).

### `pagina's`

Deze map bevat uw toepassingsweergaven en routes. Nuxt zal alle `*.vue` bestanden in deze map lezen en Vue Router automatisch instellen.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/get-started/routing).

### `plugins`

TDe directory met plug-ins bevat JavaScript-plug-ins die u wilt uitvoeren voordat u de roottoepassing Vue.js start. Dit is de plek om Vue-plug-ins toe te voegen en om functies of constanten te injecteren. Elke keer dat je `Vue.use()` moet gebruiken, moet je een bestand maken in `plugins/` en het pad toevoegen aan plug-ins in `nuxt.config.js`.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/directory-structure/plugins).

### `static`

Tzijn directory bevat uw statische bestanden. Elk bestand in deze map is toegewezen aan `/`.

Voorbeeld: `/static/robots.txt` wordt toegewezen als `/robots.txt`.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/directory-structure/static).

### `store`

Deze map bevat uw Vuex-winkelbestanden. Door een bestand in deze map aan te maken, wordt Vuex automatisch geactiveerd.

Meer informatie over het gebruik van deze directory in [de documentatie](https://nuxtjs.org/docs/2.x/directory-structure/store).
