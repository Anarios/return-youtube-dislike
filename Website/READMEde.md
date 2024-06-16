Read this in other languages: [English](README.md), [Nederlands](READMEnl.md), [Türkçe](READMEtr.md)

# return-youtube-dislike-site

## Build Setup

```bash
# Abhängigkeiten installieren
$ npm install

# Mit Hot Reload unter localhost:3000 bereitstellen
$ npm run dev

# Linten Ihrer Änderungen
$ npm run lint

# Für die Produktion erstellen und Server starten
$ npm run build
$ npm run start

# Statisches Projekt generieren
$ npm run generate
```

Für eine ausführliche Erklärung, wie die Dinge funktionieren, lesen Sie die [Dokumentation](https://nuxtjs.org).

## Empfohlene VSCode-Einrichtung

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) `ext install dbaeumer.vscode-eslint`
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) `ext install esbenp.prettier-vscode`
- [Vetur](https://marketplace.visualstudio.com/items?itemName=octref.vetur)

> `Strg(Cmd)` + `Shift` + `P` > Einstellungen öffnen (JSON)

```
"editor.formatOnSave": true,
"editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
}
"vetur.validation.template": false,
```

## Besondere Verzeichnisse

Sie können die folgenden zusätzlichen Verzeichnisse erstellen, von denen einige spezielle Verhaltensweisen haben. Nur `pages` ist erforderlich; Sie können sie löschen, wenn Sie ihre Funktionalität nicht verwenden möchten.

### `assets`

Das Verzeichnis assets enthält Ihre nicht kompilierten Assets wie Stylus- oder Sass-Dateien, Bilder oder Schriftarten.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/directory-structure/assets).

### `components`

Das Verzeichnis components enthält Ihre Vue.js-Komponenten. Komponenten bilden die verschiedenen Teile Ihrer Seite und können in Ihren Seiten, Layouts und sogar anderen Komponenten wiederverwendet und importiert werden.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/directory-structure/components).

### `layouts`

Layouts sind eine große Hilfe, wenn Sie das Aussehen und Verhalten Ihrer Nuxt-App ändern möchten, ob Sie eine Seitenleiste einbeziehen oder unterschiedliche Layouts für mobile und Desktop haben möchten.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/directory-structure/layouts).

### `pages`

Dieses Verzeichnis enthält Ihre Anwendungsansichten und Routen. Nuxt liest alle `*.vue`-Dateien in diesem Verzeichnis und richtet automatisch Vue Router ein.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/get-started/routing).

### `plugins`

Das Verzeichnis plugins enthält JavaScript-Plugins, die Sie ausführen möchten, bevor Sie die Root-Vue.js-Anwendung instanziieren. Hier fügen Sie Vue-Plugins hinzu und injizieren Funktionen oder Konstanten. Jedes Mal, wenn Sie `Vue.use()` verwenden möchten, sollten Sie eine Datei in `plugins/` erstellen und ihren Pfad zu Plugins in `nuxt.config.js` hinzufügen.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/directory-structure/plugins).

### `static`

Dieses Verzeichnis enthält Ihre statischen Dateien. Jede Datei in diesem Verzeichnis ist auf `/` abgebildet.

Beispiel: `/static/robots.txt` ist als `/robots.txt` abgebildet.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/directory-structure/static).

### `store`

Dieses Verzeichnis enthält Ihre Vuex-Store-Dateien. Das Erstellen einer Datei in diesem Verzeichnis aktiviert automatisch Vuex.

Weitere Informationen zur Verwendung dieses Verzeichnisses finden Sie in [der Dokumentation](https://nuxtjs.org/docs/2.x/directory-structure/store).
