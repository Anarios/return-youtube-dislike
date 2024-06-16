[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Lees dit in andere talen: [English](README.md), [Español](READMEes.md), [русский](READMEru.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike is een open-source extensie die het aantal dislikes van YouTube retourneert.</b><br>
    Beschikbaar voor Chrome en Firefox als webextensie.<br>
    Ook beschikbaar voor andere browsers als JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Het Verhaal

Op 10 november 2021 [kondigde](https://blog.youtube/news-and-events/update-to-youtube/) that the YouTube dislike count would be removed.

Additionally, the `dislike` field in the YouTube API was [removed](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) Google aan dat het aantal dislikes op YouTube zou worden verwijderd.

## Wat het doet

Met de verwijdering van afkeerstatistieken uit de YouTube API, schakelde onze backend over op het gebruik van een combinatie van geschraapte afkeerstatistieken, schattingen geëxtrapoleerd uit gebruikersgegevens van extensies.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Waarom het uitmaakt

U kunt meer informatie vinden op onze website op: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API-documentatie

Gebruik door derden van deze open API is toegestaan ​​met de volgende beperkingen:

- **Naamsvermelding**: dit project moet duidelijk worden toegeschreven met een link naar [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Snelheidsbeperking**: Er zijn tarieflimieten per klant in plaats van 100 per minuut en 10.000 per dag. Hiermee wordt een statuscode _429_ geretourneerd die aangeeft dat uw toepassing moet worden uitgeschakeld.

De API is toegankelijk via de volgende basis-URL:
https://returnyoutubedislikeapi.com

Lijst met beschikbare eindpunten is hier beschikbaar:
https://returnyoutubedislikeapi.com/swagger/index.html

### Stemmen krijgen

Voorbeeld om stemmen te krijgen voor een bepaalde YouTube-video-ID:
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

Geen bestaande YouTube-ID retourneert statuscode _404_ "Niet gevonden".
Verkeerd gevormde YouTube-ID retourneert _400_ "Slecht verzoek".

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Bijdragen

Lees de [bijdragengids](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Steun dit project!

U kunt dit project steunen door aan ons te doneren via onderstaande link:

[Doneer](https://returnyoutubedislike.com/donate)

## Sponsoren

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Wordt een sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
