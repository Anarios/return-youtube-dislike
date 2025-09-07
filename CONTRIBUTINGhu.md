Read this in other languages: [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md)

# Üdvözlünk a Return YouTube Dislike közreműködői útmutatójában

Köszönjük, hogy időt szánsz a projekthez való hozzájárulásra! Minden módosításod meg fog jelenni a bővítmény következő verziójában (vagy a [weboldalon](https://www.returnyoutubedislike.com/)).

## Kezdő lépések

Kérjük, a formázáshoz használd a Prettier eszközt alapértelmezett beállításokkal.

#### Előkövetelmények

A forrás kimenetének elkészítéséhez szükséged lesz a Node és az npm telepítésére.

Az előkészítéskor használt verziók:

- node: 12.18.4
- npm: 6.14.6

A `bundled-content-script.js` létrehozásához (ami a bővítmény üzleti logikájának nagy részét tartalmazza) először telepíteni kell az összes függőséget.

1. Lépj a repó gyökerébe és futtasd:

```
npm install
```

2. Futtasd az alábbi parancsot a `bundled-content-script.js` elkészítéséhez, amelyet a `manifest.json` használ:

```
npm start // a build fájl(ok) létrehozása és egy watcher indítása, amely mentéskor újratölt

// vagy

npm run build // a build fájl(ok) egyszeri létrehozása
```

Gratulálunk, készen állsz a fejlesztésre!

Ha új vagy a Chrome‑bővítmények fejlesztésében, vagy extra segítségre van szükséged, nézd meg [ezt a YouTube‑oktatóanyagot](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Hibák és problémák

#### Új issue megnyitása

Ha problémád van a bővítménnyel, először keress rá, hogy nem jelentették‑e már. Ha nem, nyiss egy issue‑t. Erősen ajánlott az issue űrlap használata, de nem kötelező.

#### Egy issue megoldása

Ha találtál egy problémát, amit meg tudsz oldani, ne habozz. Nyiss egy PR‑t a javítással, és mindenképp említsd meg, melyik issue‑t javítod.

### Funkciókérések

#### Új funkciókérés megnyitása

Ha van egy ötleted a bővítményhez, nyugodtan nyiss funkciókérést, de előtte keresd meg, hogy nem javasolták‑e már. A funkció űrlap használata ajánlott, de nem kötelező.

#### Funkciókérés megvalósítása

Ha találtál egy funkciót, amit meg tudsz valósítani, ne habozz. Nyiss egy PR‑t a megvalósítással, és említsd meg a funkciót, amit implementálsz.

### Milyen PR‑okat fogadunk el?

- Hibajavítások.
- Funkciók implementálása.
- Elírások javítása, jobb és egyszerűbb megfogalmazások.
- Közreműködések a weboldalon.
