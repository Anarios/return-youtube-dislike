[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Olvasható még a következő nyelveken: [English](README.md), [Español](READMEes.md), [русский](READMEru.md), [Türkçe](READMEtr.md), [العربية](READMEar.md), [Bahasa Indonesia](READMEid.md)

# Return YouTube Dislike

<p align="center">
    <b>A Return YouTube Dislike egy nyílt forráskódú bővítmény, ami visszahozza a YouTube dislike számlálóját.</b><br>
    Elérhető Chrome és Firefox böngészőkhöz bővítményként, illetve további böngészőkhöz JS Userscript formában.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Történet

2021\. november 10-én a Google [bejelentette](https://blog.youtube/news-and-events/update-to-youtube/), hogy eltávolítják a YouTube dislike ("nem tetszik") számlálóját.

Ezzel együtt a YouTube API `dislike` mezőjét is [törölték](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) 2021. december 13-án, így megszűnt az a lehetőség, hogy a tartalmak megtekintése előtt meggyőződjünk azok minőségéről.

## Hogyan működik?

A YouTube API változása utáni dislike statisztikákat a backendünk részben korábban begyűjtött adatokból, részben pedig a bővítményt használók adataiból kinyert becsléssel építi fel.

[GYIK](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Miért számít ez?

Többet is megtudhatsz a weboldalunkon: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API dokumentáció

Ennek az API-nak a third-party felhasználását az alábbiak mellett engedélyezzük:

-   **Forrásmegjelölés**: Egy erre a projektre mutató, jól látható [returnyoutubedislike.com](https://returnyoutubedislike.com/) linkkel.
-   **Rate Limiting**: Kliensoldalon gyakoriság-korlátozás van beállítva percenként 100, naponta maximum 10 000 lekérésre. Túllépés esetén _429_ státuszkód jelzi, hogy az alkalmazásod nem küldhet több lekérést.

Az API ezen az URL-en érhető el:
https://returnyoutubedislikeapi.com

További elérhető endpointok itt találhatók:
https://returnyoutubedislikeapi.com/swagger/index.html

### Szavazatok lekérése

Példa egy adott YouTube videó ID adatainak lekéréséhez:
`/votes?videoId=kxOuG8jMIgI`

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

Nem létező YouTube ID esetén _404_ "Not Found" státuszkód, rossz formátumú YouTube ID esetén _400_ "Bad Request" válasz érkezik.

<!---
## API dokumentáció

Az összes dokumentáció elolvasható a weboldalunkon.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Kontribúció

Kérjük, olvasd el a [kontribúciós leírást](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Támogasd a projektet!

Támogathatod ezt a projektet adományokkal az alábbi linken:

[Támogatás](https://returnyoutubedislike.com/donate)

## Szponzorok



[Legyél szponzorunk!](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
