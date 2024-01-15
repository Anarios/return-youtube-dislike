[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [English](README.md), [Español](READMEes.md), [русский](READMEru.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike - це розширення з відкритим вихідним кодом, яке повертає лічильник відміток «Не подобається» на YouTube.</b><br>
    Доступно для Chrome та Firefox як веброзширення.<br>
    Також доступно для інших браузерів як JS UserScript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Історія

10 листопада 2021 року Google [оголосили](https://blog.youtube/news-and-events/update-to-youtube/), що лічильник відміток «Не подобається» на YouTube буде видалено.

Крім того, поле позначок `dislike` у YouTube API було [видалено](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) 13 грудня 2021 року, прибравши єдину можливість оцінити якість вмісту перед переглядом.

## Як це працює

Після видаленням статистики відміток з API YouTube наш сервер перейшов на використання комбінації заархівованих статистичних даних відміток «Не подобається» екстрапольованих із даними користувачів розширення.

[ЧаПи](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQuk.md)

## Чому це важливо

Ви можете дізнатися більше на нашому вебсайті: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Документація API

Використання цього відкритого API сторонніми особами дозволено з наступними обмеженнями:

- **Атрибуція**: Цей проєкт має бути чітко описано, використовуючи посилання на [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Обмеження**: Існують обмеження на швидкісті для кожного клієнта - 100 за хвилину і 10 000 за день. Це видасть код помилки 429, який вказує на те, що вашому додатку слід завершити роботу.

API доступно за наступною URL-адресою:
https://returnyoutubedislikeapi.com

Перелік доступних «ендпоінтів» можна переглянути тут:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Отримати оцінки

Приклад отримання оцінок відео на YouTube за ID:
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

Недійсний YouTube ID видасть код помилки 404 "Not Found".  
YouTube ID у невірному форматі видасть код помилки 400 "Bad Request".

<!---
## Документація API

Ви можете переглянути всю документацію на нашому сайті.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Взяти участь у розробці

Будь ласка, ознайомтеся із [посібником внеску в проєкт](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGuk.md).

## Підтримайте цей проєкт!

Ви можете підтримати цей проєкт пожертвою за посиланням нижче:

[Підтримати](https://returnyoutubedislike.com/donate)

## Спонсори

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Станьте нашим спонсором](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
