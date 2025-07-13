[![Chrome Web Mağazası](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Mağazası İstifadəçilər](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla Rəyi](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla yükləmələri](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit sayı](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issue'lar](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![Lisans](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Bunu başqa dillərdə oxuyun: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Français](READMEfr.md), [Nederlands](READMEnl.md), [日本語](READMEja.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md), [Magyar](READMEhu.md), [Danish](READMEda.md)

# YouTube bəyənməmə sayını geri qaytarın

<p align="center">
    <b>YouTube Bəyənməmə Sayını əldə edin YouTube-da bəyənməmə sayını göstərən açıq mənbəli əlavədir.</b><br>
    Chrome və Firefox-da Veb Uzantısı kimi mövcuddur.<br>
    Ayrıca diğer tarayıcılar için JS Userscript olarak da mevcuttur.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Onun hekayəsi

10 noyabr 2021-ci ildə Google elan etdi ki, YouTube bəyənməmə sayları silinəcək [Elan etdi](https://blog.youtube/news-and-events/update-to-youtube/).

Əlavə olaraq, YouTube API-də "like" sahəsi 13 dekabr 2021-ci il tarixində [qaldırıldı](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) ve içeriğin kalitesini izlemeden önce yargılayabilme olanağı ortadan kaldırıldı.

## Bunun nə faydası var?

Bəyənməmə statistikasının YouTube API-dən silinməsi ilə backendimiz genişləndirmə istifadəçi datasından təxmin edilən ümumi bəyənməmə statistikasının kombinasiyasından istifadə etməyə keçdi.

[Tez-tez verilən suallar](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQtr.md)

## Niyə Vacibdir

Ətraflı məlumatı saytımızda tapa bilərsiniz: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API Sənədləri

Bu açıq API-nin üçüncü tərəfin istifadəsinə aşağıdakı məhdudiyyətlərlə icazə verilir:

- **Atribut**: Bu layihə açıq şəkildə [returnyoutubedislike.com](https://returnyoutubedislike.com/) ünvanına yönləndirilməlidir.
- **Sürət Məhdudiyyəti**: Bir istifadəçi üçün dəqiqədə 100 və gündə 10.000 sürət həddi var. Bu, _429_ status kodunu qaytarır, ərizənizin geri götürülməsi lazım olduğunu göstərir.

API-yə aşağıdakı əsas URL vasitəsilə daxil olmaq olar:
https://returnyoutubedislikeapi.com

Mövcud son nöqtələrin siyahısı burada mövcuddur:
https://returnyoutubedislikeapi.com/swagger/index.html

### Səslərin əldə edilməsi

Müəyyən bir YouTube video ID-si üçün reytinqləri əldə etmək üçün bir nümunə:
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

Heç bir mövcud YouTube ID-si 404 "Tapılmadı" status kodunu qaytarmayacaq.

<!---
## API Sənədləri

Saytımızda bütün sənədlərlə tanış ola bilərsiniz.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Töhfə verin

Zəhmət olmasa [töhfə bələdçisi](CONTRIBUTINGaz.md)nu oxuyun.

## Bu Layihəyə Dəstək olun!

Aşağıdakı linkdən bizə ianə verə və bu layihəyə dəstək ola bilərsiniz:

[Bağışlayın](https://returnyoutubedislike.com/donate)

## Sponsorlar


[Sponsorumuz olun](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
