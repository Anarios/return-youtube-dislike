[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Preberite to v drugih jezikih: [English](README.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Slovenščina](READMEsl.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md), [беларуская](READMEbe.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike je odprtokodna razširitev, ki vrne prikaz števila nevšečkov na YouTubu.</b><br>
    Na voljo je za Chrome in Firefox kot spletna razširitev.<br>
    Za druge brskalnike je na voljo kot uporabniški skript JS.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Zgodba

10. novembra 2021 je Google [objavil](https://blog.youtube/news-and-events/update-to-youtube/), da bo število nevšečkov na YouTubu odstranjeno.

Poleg tega je bilo 13. decembra 2021 iz YouTubovega API-ja [odstranjeno](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) polje `dislike`, s čimer je izginila vsakršna možnost presoje kakovosti vsebine pred ogledom.

## Kaj počne

Po odstranitvi statistike nevšečkov iz YouTubovega API-ja naše zaledje uporablja kombinacijo postrgane statistike nevšečkov in ocen, ekstrapoliranih iz podatkov uporabnikov razširitve.

[Pogosta vprašanja](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQsl.md)

## Zakaj je to pomembno

Več izveste na naši spletni strani: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Dokumentacija API-ja

Uporaba tega odprtega API-ja s strani tretjih oseb je dovoljena z naslednjimi omejitvami:

- **Navedba vira**: Ta projekt mora biti jasno naveden s povezavo do [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Omejevanje pogostosti**: Za posameznega odjemalca veljata omejitvi 100 zahtev na minuto in 10.000 na dan. Ob prekoračitvi API vrne statusno kodo _429_, kar pomeni, da mora vaša aplikacija zmanjšati pogostost zahtev.

API je dostopen na naslednjem osnovnem naslovu URL:
https://returnyoutubedislikeapi.com

Seznam razpoložljivih končnih točk je na voljo tukaj:
https://returnyoutubedislikeapi.com/swagger/index.html

### Pridobivanje glasov

Primer pridobivanja glasov za podani ID videa na YouTubu:
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

Neobstoječ ID videa na YouTubu vrne statusno kodo _404_ »Not Found«.
Napačno oblikovan ID videa na YouTubu vrne statusno kodo _400_ »Bad Request«.

<!---
## Dokumentacija API-ja

Celotno dokumentacijo si lahko ogledate na naši spletni strani.
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## Sodelovanje

Preberite [navodila za sodelovanje](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGsl.md).

## Podprite ta projekt!

Ta projekt lahko podprete z donacijo prek spodnje povezave:

[Doniraj](https://returnyoutubedislike.com/donate)

## Pokrovitelji

[Postanite naš pokrovitelj in bodite predstavljeni v repozitoriju ter na spletni strani](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
