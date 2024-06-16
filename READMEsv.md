[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Läs detta på andra språk: [English](README.md), [Español](READMEes.md), [русский](READMEru.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike (Återinför YouTube Dislikes) är ett open-source tillägg som återinför antalet dislikes (nedåttummar) på YouTube.</b><br>
    Tillgängligt som tillägg för <a href="https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/">Chromium Browser</a> och <a href="https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/">Firefox</a>.<br>
    Finns även för andra webbläsare som JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Berättelsen <!-- The Story -->

Den 10 november 2021 [meddelade Google](https://blog.youtube/news-and-events/update-to-youtube/) att YouTubes dislikes skulle tas bort från plattformen.

Dessutom blev `dislike`-fältet i YouTubes API [borttaget](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) den 13 december 2021, vilket tog bort möjligheten att bedöma innehållets kvalitet innan visning.

## Vad det gör <!-- What it Does -->

Med borttagandet av dislike-statistiken från YouTubes API, bytte vår backend till att använda en kombination av skrapad dislike-statistik och uppskattningar utifrån data av tilläggsanvändare.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Varför det är viktigt <!-- Why it Matters -->

Du kan läsa mer på vår webbplats: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API dokumentation <!-- API documentation -->

Tredjepartsanvändning av detta öppna API är tillåtet med följande restriktioner:

- **Attribution**: Detta projekt ska tydligt tillskrivas med en länk till [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Frekvensbegränsning**: Det finns per klient hastighetsbegränsningar på 100 per minut och 10'000 per dag. Detta kommer att returnera en _429_ statuskod som indikerar att din applikation bör backa.

API:et är tillgängligt på följande bas-URL:
https://returnyoutubedislikeapi.com

En lista över tillgängliga ändpunkter finns här:
https://returnyoutubedislikeapi.com/swagger/index.html

### Hämta röster <!-- Get votes -->

Exempel för att hämta röster för en given YouTube-video-ID:
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

Inga existerande YouTube-ID returnerar statuskoden _404_ "Not Found".
Felaktigt formade YouTube-ID returnerar _400_ "Bad Request".

<!---
## API Dokumentation

Du kommer åt all dokumentation på vår webbplats.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Bidra <!-- Contributing -->

Läs gärna [bidragsguiden](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Stöd detta projekt! <!-- Support this project! -->

Du kan stödja detta projekt genom att donera till oss på länken nedan:

[Donera](https://returnyoutubedislike.com/donate)

## Sponsorer <!-- Sponsors -->

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Stöd oss på Patreon](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
