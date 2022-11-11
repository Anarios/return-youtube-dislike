[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Lese in anderen Sprachen: [English](README.md), [Español](READMEes.md), [русский](READMEru.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike ist eine Open-Source Erweiterung, welche die Youtube Dislike Anzahl zurückbringt.</b><br>
    Verfügbar für Chrome und Firefox als eine Web Erweiterung.<br>
    Auch verfügbar für andere Browser als JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Die Geschichte:

Am 10. November 2021, Google [kündigte an](https://blog.youtube/news-and-events/update-to-youtube/), dass die YouTube Dislike Anzahl entfernt wird.

Zusätzlich wurde am 13. Dezember 2021 das `Dislike` Feld in der YouTube API [entfernt](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts).  Keine Möglichkeit mehr, die Qualität von Inhalten vor dem Anschauen zu beurteilen.

## Was macht es

Mit dem Entfernen der Dislike Statistik aus der YouTube API, unser Backend ist dazu übergegangen eine eine Kombination aus ausgewerteten Abneigungsstatistiken und Schätzungen welche aus den Nutzerdaten der Erweiterung berechnet wurden zu nutzen.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Warum es wichtig ist

Du kannst darüber mehr auf unserer Webseite erfahren: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API documentation

Die Nutzung dieser offenen API durch Dritte ist mit den folgenden Einschränkungen gestattet:

- **Namensnennung**: Dieses Projekt sollte eindeutig mit einem Link zu folgenden Seiten versehen werden [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Raten Limitierung**: Es gibt Ratenbeschränkungen pro Client von 100 pro Minute und 10.000 pro Tag. Dies führt zu einem Statuscode _429_, der anzeigt, dass Ihre Anwendung das Limit erreicht hat und sich zurückziehen sollte.

Die API ist über die folgende Basis-URL zugänglich:  
https://returnyoutubedislikeapi.com

Eine Liste der verfügbaren Endpunkte finden Sie hier:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Votes abfragen

Beispiel, um Votes für eine bestimmte YouTube-Video-ID abzufragen:   
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

Eine nicht vorhandene YouTube-ID gibt den Statuscode _404_ "Not Found" zurück.  
Eine falsch gebildete YouTube-ID wird den Statuscode _400_ "Bad Request" zurückgeben.

<!---
## API Dokumentation

Sie können die gesamte Dokumentation auf unserer Website einsehen.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Beitragsleitfaden

Bitte lese den [Beitragsleitfaden](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Untersütze das Projekt!
Sie können dieses Projekt unterstützen, indem Sie uns über die unten stehenden Link eine Spende zukommen lassen:

[Spenden](https://returnyoutubedislike.com/donate)

## Sponsoren

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Werde unser Sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
