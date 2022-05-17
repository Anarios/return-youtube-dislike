[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)


# Return YouTube Dislike

Прочитать на других языках: [English](README.md), [Español](READMEes.md), [Türkçe](READMEtr.md)

<p align="center">
    <b>Return YouTube Dislike - это расширение с открытым исходным кодом, которое возвращает счётчик отметок «Не нравится» на YouTube.</b><br>
    Доступно для Chrome и Firefox в качестве веб-расширения.<br>
    Также доступен для других браузеров в виде пользовательского скрипта JS.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## История

10 ноября 2021 года Google [объявили](https://blog.youtube/news-and-events/update-to-youtube/), что счётчик «Не нравится» на YouTube будет удален.  
  
Кроме того, поле отметок `«Не нравится»` в API YouTube было [удалено]](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) 13 декабря 2021 года, удалив любую возможность судить о качестве контента перед просмотром.

## Как оно работает

С удалением статистики отметок из API YouTube наш сервер переключился на использование комбинации собранной статистики отметок «Не нравится», оценок, экстраполированных из пользовательских данных расширения.

[ЧаВО (англ.)](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Почему это важно

Вы можете узнать больше на нашем веб-сайте: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Документация по API

Стороннее использование этого открытого API разрешено со следующими ограничениями:

- **Атрибуция**: Этот проект должен быть четко атрибутирован со ссылкой на [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Ограничение**: Существуют ограничения скорости для каждого клиента вместо 100 в минуту и 10 000 в день. Это выдаст код ошибки *429*, указывающий на то, что ваше приложение должно быть отключено.

API доступен по следующему основному URL-адресу:  
https://returnyoutubedislikeapi.com  

Список доступных эндпоинтов доступен здесь:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Получить голоса
Пример получения голосов за заданный идентификатор видео на YouTube:  
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


Ни один существующий идентификатор YouTube не выдаст код ошибки *404* "Не найдено".  
Неправильно сформированный идентификатор YouTube выдаст *400* "Неверный запрос".



<!---
## Документация по API

Вы можете просмотреть всю документацию на нашем веб-сайте.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->


## Участие/помощь в разработке

Пожалуйста, ознакомьтесь с [руководством по внесению вклада в проект (англ.)](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Поддержите этот проект!

Вы можете поддержать этот проект, сделав нам пожертвование по ссылке ниже:

[Пожертвование](https://returnyoutubedislike.com/donate)

## Спонсоры
[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Станьте нашим спонсором](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)

