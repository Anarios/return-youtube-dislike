[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)


Прочетете това на други езици: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)



# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike е отворено разширение, което връща броя на дизлайковете в YouTube.</b><br>
    Достъпно за Chrome и Firefox като уеб разширение.<br>
     Също така е налично за други браузъри като JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Историята

На 10 ноември 2021 г. Google [обяви](https://blog.youtube/news-and-events/update-to-youtube/), че броят на дизлайковете в YouTube ще бъде премахнат.

Освен това, полето `dislike` в YouTube API беше [премахнато](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) на 13 декември 2021 г., което премахна всяка възможност за оценка на качеството на съдържанието преди гледането му.

## Какво прави

С премахването на статистиката за дизлайковете от YouTube API, нашият бекенд премина към използване на комбинация от скрейпната статистика за дизлайкове, оценки извлечени от данните на потребителите на разширението.

[Често задавани въпроси](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQbg.md)

## Защо е важно

Можете да научите повече на нашия уебсайт: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Документация за API

Използването от трети страни на този отворен API е разрешено със следните ограничения:

- **Атрибуция**: Този проект трябва ясно да се атрибутира с връзка към [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Ограничение на скоростта**: Има ограничения на скоростта за клиента от 100 на минута и 10 000 на ден. Това ще върне статусен код 429, който показва, че вашето приложение трябва да се оттегли.

API е достъпен на следния базов URL адрес: 
https://returnyoutubedislikeapi.com

Списък на наличните крайща е достъпен тук: 
https://returnyoutubedislikeapi.com/swagger/index.html

### Получаване на гласове

Пример за получаване на гласове за даден YouTube видео идентификатор: 
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

Не съществуващ YouTube идентификатор ще върне статус код 404 "Not Found".
Грешно формиран YouTube идентификатор ще върне 400 "Bad Request".

<!---
## Документация за API

Може да видите цялата документация на нашия уебсайт.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Сътрудничество

Моля, прочетете [ръководството за сътрудничество](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGbg.md).

## Подкрепете този проект!

Можете да подкрепите този проект, като ни дарите на следния линк:

[Дарение](https://returnyoutubedislike.com/donate)

## Спонсори



[Become our sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
