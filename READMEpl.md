[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike to otwarte rozszerzenie, które przywraca licznik łapek w dół na YouTube.</b><br>
    Dostępne jako rozszerzenie dla Chrome i Firefox.<br>
    Dostępne także dla innych przeglądarek jako JS UserScript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Historia

Dnia 10 listopada 2021, Google [ogłosiło](https://blog.youtube/news-and-events/update-to-youtube/), że licznik łapek w dół na YouTube zostanie usunięty.

Dodatkowo, pole `dislike` w API YouTube zostało [usunięte](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) 13 grudnia 2021, usuwając przy tym jakąkolwiek możliwość oceny jakości filmu przed obejrzeniem.

## Co to robi

Wraz z usunięciem statystyk łapek w dół z YouTube API, nasz backend przełączył się na kombinację scrape-owanych statystyk łapek w dół i szacunków ekstrapolowanych z danych użytkowników rozszerzenia.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Dlaczego to ma znaczenie

Można o tym przeczytać na naszej stronie: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Dokumentacja API

Używanie tego otwartego API jest dozwolone z następującymi ograniczeniami:

- **Przypisanie**: Ten projekt powinien być jawnie przypisany z linkiem do [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Ograniczenie żądań**: Istnieją ograniczenia żądań do 100 na minutę i 10 000 na dzień. Przekroczenie zwróci kod _429_, mówiący aplikacji aby przyhamowała.

API jest dostępne przez poniższe bazowe URL:  
https://returnyoutubedislikeapi.com

Lista dostępnych endpointów jest dostępna tutaj:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Pobierz głosy

Przykład otrzymywania głosów z danego ID filmu YouTube:  
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

Nieistniejący ID filmu zwróci _404_ "Not Found".  
Niepoprawnie sformatowany ID filmu zwróci _400_ "Bad Request".

<!---
## API documentation

Cała dokumentacja jest dostępna na naszej stronie.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Współtworzenie

Prosimy przeczytać [przewodnik współtworzenia](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Wesprzyj ten projekt!

Możesz wesprzeć ten projekt dotacjami poniżej:

[Wesprzyj](https://returnyoutubedislike.com/donate)

## Sponsorzy

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Become our sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
