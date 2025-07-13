[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Læs dette på andre sprog: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [العربية](READMEar.md), [Bahasa Indonesia](READMEid.md)


# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike er en open-source udvidelse, som bringer antallet af dislikes tilbage på YouTube.</b><br>
    Den er tilgængelig til Chrome og Firefox som en webudvidelse.<br>
    Den er også tilgængelig i andre browsere som et JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Historien

Den 10. november 2021, [annoncerede Google](https://blog.youtube/news-and-events/update-to-youtube/) at Youtube dislike tælleren ville blive fjernet.

Desuden blev dislike-feltet i YouTube API'en [fjernet](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) den 13. december 2021, 2021, hvilket fjernede muligheden til at vurdere kvaliteten af indholdet før afspilning.

## Hvad den gør

Med fjernelsen af dislike stats fra Youtube API'en, har vores backend skiftet til at bruge en kombination af scraped dislike-statistic, hvor skøn er extrapoleret fra extension-brugerdata.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Hvorfor det betyder noget

Du kan lære mere på vores hjemmeside: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API dokumentation

Tredjeparts brug af denne åbne API er tilladt under de følgende restriktioner:

- **Tilskrivning**: Dette projekt skal tydeligt tilskrives med et link til [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Rategrænse**: Der er en grænse på 100 anmodninger per minut og 10.000 per dag for hver klient. Dette vil returnere en statuskode på _429_, som indikerer, at din applikation skal trække sig tilbage.

API'en er tilgængelig via følgende base-URL:
https://returnyoutubedislikeapi.com

En liste over tilgængelige endpoints er tilgængelig her:
https://returnyoutubedislikeapi.com/swagger/index.html

### Få stemmer

Eksempel på at få stemmer på en given YouTube-video-ID:
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

En ikke-eksisterende YouTube-ID vil returnere statuskoden _404_ "Not Found".
En forkert formet YouTube-ID vil returnere _400_ "Bad Request".

<!---
## API documentation

Du kan se al dokumentation på vores hjemmeside.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Bidrag

Læs venligst [bidragsvejledningen](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Støt dette projekt!

Du kan støtte dette projekt ved at donere til os på nedenstående link:

[Doner](https://returnyoutubedislike.com/donate)

## Sponsorer



[Bliv vores sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
