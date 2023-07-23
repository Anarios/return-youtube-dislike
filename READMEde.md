[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome-Bewertung&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store-Nutzer](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome-Nutzer&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla-Bewertung](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox-Bewertung&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla-Downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox-Nutzer&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commitrate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commitrate&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![Lizenz](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Lesen Sie dies in anderen Sprachen: [English](README.md), [Español](READMEes.md), [русский](READMEru.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Ελληνικά](READMEgr.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike (YouTube Dislikes zurückbringen) ist eine open-source Erweiterung die den Dislike-Zähler zurückbringt.</b><br>
    Für <a href="https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/">Chromiumbrowser</a> und <a href="https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/">Firefox</a> als Browsererweiterung verfügbar.<br>
    Für andere Browsers auch als JS-Userscript verfügbar.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Die Geschichte <!-- ## The Story -->

Am 10. November 2021 [kündigte Google an](https://blog.youtube/news-and-events/update-to-youtube/), dass der YouTube Dislike-Zähler von der Platform entfernt werden sollte.

Zusätzlich wurde das `dislike`-Feld in der YouTube API am 13. Dezember 2021 [entfernt](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts), und damit auch jegliche Möglichkeit, die Qualität der Inhalte zu bewerten, bevor man das Video sieht.

## Was die Erweiterung macht <!-- ## What it Does -->

Mit der Entfernung der Statistiken der YouTube API wechselte unser Backend zu einer Kombination von archivierten Dislike Statistiken sowie den extrapolierten Schätzungen durch die Nutzerdaten dieser Erweiterung, um die Dislike-Zahlen zu berechnen.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Warum dies wichtig ist <!-- ## Why it Matters -->

Mehr erfahren Sie auf unserer Website unter: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API-Dokumentation <!-- ## API documentation -->

Dritte dürfen diese öffentliche API mit folgenden Restriktionen benützen:

- **Namensnennung**: Dieses Projekt sollte klar mit folgendem Link [returnyoutubedislike.com](https://returnyoutubedislike.com/) versehen werden.
- **Ratenlimitierung**: Es bestehen pro Nutzer Limitierungen von 100 Anfragen pro Minute sowie 10.000 pro Tag. Dies wird eine Statusmeldung von _429_ ausgeben, die darauf hinweist, dass sich Ihre Anwendung zurückziehen sollte.

Die API ist unter der folgenden Basis-URL verfügbar:  
https://returnyoutubedislikeapi.com

Eine Liste aller verfügbaren Endpunkten finden Sie hier:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Bewertung erhalten <!-- ### Get votes -->

Beispiel, um die Bewertung einer gegebenen YouTube ID zu erhalten:  
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

Nicht existierende YouTube IDs werden den Statuscode _404_ "Not Found" zurückgeben.  
Falsch geformte YouTube IDs werden den Statuscode _400_ "Bad Request" zurückgeben.

<!---
## API Dokumentation

Sie können die gesamte Dokumentation auf unserer Website einsehen.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Beitragen <!-- ## Contributing -->

Bitte lesen Sie die [Beitragsinformationen](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Unterstütze dieses Projekt! <!-- ## Support this project! -->

Sie können das Projekt unterstützen, indem Sie unter den folgenden Link spenden:

[Spenden](https://returnyoutubedislike.com/donate)

## Sponsoren <!-- ## Sponsors -->

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Werde unser Sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
