[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/sk/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/sk/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Prečítajte si to v iných jazykoch: [English](README.md), [فارسی](READMEfa.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [беларуская](READMEbe.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Slovenčina](READMEsk.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md), [Slovenščina](READMEsl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike je open-source rozšírenie, ktoré na YouTube vracia počet dislajkov.</b><br>
    Pre Chrome a Firefox je dostupné ako webové rozšírenie.<br>
    Pre ostatné prehliadače je dostupné aj ako používateľský skript (JS Userscript).<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Príbeh

Google 10. novembra 2021 [oznámil](https://blog.youtube/news-and-events/update-to-youtube/), že z YouTube odstráni počet dislajkov.

Navyše 13. decembra 2021 [odstránil](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) z YouTube API pole `dislike`, takže kvalitu obsahu už pred pozretím nebolo ako posúdiť.

## Čo rozšírenie robí

Keďže YouTube API už štatistiky dislajkov neposkytuje, náš backend kombinuje získané štatistiky dislajkov s odhadmi, ktoré extrapoluje z údajov od používateľov rozšírenia.

[Často kladené otázky](Docs/FAQsk.md)

## Prečo na tom záleží

Viac sa dozviete na našom webe: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Dokumentácia API

Tretie strany môžu toto otvorené API používať s týmito obmedzeniami:

- **Uvedenie zdroja**: Projekt musí byť zreteľne uvedený s odkazom na [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Obmedzenie počtu požiadaviek**: Pre každého klienta platí limit 100 požiadaviek za minútu a 10 000 za deň. Po jeho prekročení API vráti stavový kód _429_, čo znamená, že aplikácia má požiadavky obmedziť.

API je dostupné na tejto základnej URL adrese:
https://returnyoutubedislikeapi.com

Zoznam dostupných endpointov nájdete tu:
https://returnyoutubedislikeapi.com/swagger/index.html

### Získanie hlasov

Príklad získania hlasov pre zadané ID videa YouTube:
`/votes?videoId=kxOuG8jMIgI`

```json
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2022-04-09T21:44:20.5103Z",
  "likes": 31885,
  "rawDislikes": 31946,
  "rawLikes": 457,
  "dislikes": 579721,
  "rating": 1.2085329444119253,
  "viewCount": 3762293,
  "deleted": false
}
```

Neexistujúce ID videa YouTube vráti stavový kód _404_ „Not Found“.  
Nesprávne naformátované ID videa YouTube vráti stavový kód _400_ „Bad Request“.

<!---
## Dokumentácia API

Celú dokumentáciu nájdete na našom webe.
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## Prispievanie

Prečítajte si [návod na prispievanie](CONTRIBUTINGsk.md).

## Podporte tento projekt!

Projekt môžete podporiť príspevkom cez tento odkaz:

[Prispieť](https://returnyoutubedislike.com/donate)

## Sponzori

[Staňte sa naším sponzorom a budete uvedení v repozitári aj na webe](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)

---

Slovenský preklad: Radoslav Ďurač
