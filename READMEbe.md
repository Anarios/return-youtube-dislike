[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [English](README.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [беларуская](READMEbe.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md), [Slovenščina](READMEsl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike — гэта пашырэнне з адкрытым зыходным кодам, якое вяртае адлюстраванне лічыльніка непадабаек на YouTube.</b><br>
    Даступна для Chrome і Firefox як Web Extension.<br>
    Таксама даступна для іншых браўзераў у выглядзе карыстальніцкага скрыпта (JS Userscript).<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Гісторыя

10 лістапада 2021 года Google [абвясціў](https://blog.youtube/news-and-events/update-to-youtube/), што лічыльнік непадабаек на YouTube будзе выдалены.

Акрамя таго, поле `dislike` у YouTube API было [выдалена](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) 13 снежня 2021 года, што пазбавіла карыстальнікаў магчымасці ацэньваць якасць кантэнту перад праглядам.

## Што робіць праект

Пасля выдалення статыстыкі непадабаек з YouTube API наш бэкэнд перайшоў на камбінацыю архіўных дадзеных і ацэнак, экстрапаляваных з дадзеных карыстальнікаў пашырэння.

[FAQ (Частыя пытанні)](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQbe.md)

## Чаму гэта важна

Вы можаце даведацца больш на нашым сайце: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Дакументацыя API

Выкарыстанне гэтага адкрытага API трэцімі бакамі дазваляецца з наступнымі абмежаваннямі:

- **Атрыбуцыя**: Праект павінен быць выразна пазначаны спасылкай на [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Абмежаванне частаты**: Дзейнічаюць абмежаванні для кожнага кліента: 100 запытаў у хвіліну і 10 000 у дзень. Пры перавышэнні будзе вернуты код стану _429_, які азначае, што ваша праграма павінна знізіць частату запытаў.

API даступны па наступным базавым URL:
https://returnyoutubedislikeapi.com

Спіс даступных канчатковых кропак даступны тут:
https://returnyoutubedislikeapi.com/swagger/index.html

### Атрыманне галасоў

Прыклад атрымання галасоў для зададзенага ідэнтыфікатара відэа YouTube:
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

Неіснуючы ідэнтыфікатар YouTube верне код стану _404_ "Not Found".<br>
Няправільна адфарматаваны ідэнтыфікатар YouTube верне код стану _400_ "Bad Request".

## Удзел у распрацоўцы

Калі ласка, азнаёмцеся з [кіраўніцтвам па ўнясенні ўкладу](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGbe.md).

## Падтрымайце праект!

Вы можаце падтрымаць праект ахвяраваннем па спасылцы:

[Падтрымаць](https://returnyoutubedislike.com/donate)

## Спонсары

[Станьце нашым спонсарам і з'явіцеся ў рэпазіторыі і на сайце](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
