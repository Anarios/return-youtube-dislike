[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [English](README.md), [فارسی](READMEfa.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [беларуская](READMEbe.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Italiano](READMEit.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md), [Slovenščina](READMEsl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike è un'estensione open-source che ripristina il conteggio dei non mi piace su YouTube.</b><br>
    Disponibile per Chrome e Firefox come estensione web.<br>
    Disponibile anche per altri browser come Userscript JS.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## La Storia

Il 10 novembre 2021, Google ha [annunciato](https://blog.youtube/news-and-events/update-to-youtube/) che il conteggio dei non mi piace su YouTube sarebbe stato rimosso.

Inoltre, il campo `dislike` nell'API di YouTube è stato [rimosso](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) il 13 dicembre 2021, eliminando ogni possibilità di giudicare la qualità dei contenuti prima della visione.

## Cosa fa

Con la rimozione delle statistiche dei non mi piace dall'API di YouTube, il nostro backend è passato all'utilizzo di una combinazione di statistiche estratte tramite scraping e stime estrapolate dai dati degli utenti dell'estensione.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Perché è importante

Puoi scoprire di più sul nostro sito web: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentazione API

L'uso di terze parti di questa API aperta è consentito con le seguenti restrizioni:

- **Attribuzione**: Questo progetto deve essere chiaramente attribuito con un link a [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Limite di frequenza (Rate Limiting)**: Sono previsti limiti di frequenza per client pari a 100 richieste al minuto e 10.000 al giorno. Il superamento restituirà un codice di stato _429_ per indicare all'applicazione di rallentare le richieste.

L'API è accessibile al seguente URL di base:
https://returnyoutubedislikeapi.com

L'elenco degli endpoint disponibili è consultabile qui:
https://returnyoutubedislikeapi.com/swagger/index.html

### Ottenere i voti

Esempio per ottenere i voti dato l'ID di un video di YouTube:
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

Un ID YouTube non esistente restituirà il codice di stato _404_ "Not Found".

Un ID YouTube formattato in modo errato restituirà il codice di stato _400_ "Bad Request".

<!---
## Documentazione API

Puoi visualizzare tutta la documentazione sul nostro sito web.
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## Contribuire

Si prega di leggere la [guida ai contributi](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Supporta questo progetto!

Puoi supportare questo progetto effettuando una donazione tramite il link sottostante:

[Dona](https://returnyoutubedislike.com/donate)

## Sponsor

[Diventa nostro sponsor per comparire nel repository e sul sito web](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)

