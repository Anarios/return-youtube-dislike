[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [English](README.md), [فارسی](READMEfa.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [беларуская](READMEbe.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md), [Slovenščina](READMEsl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike یک افزونه متن‌باز است که تعداد dislikeهای YouTube را بازمی‌گرداند.</b><br>
    برای Chrome و Firefox به صورت Web Extension در دسترس است.<br>
    همچنین برای سایر مرورگرها به صورت JS Userscript در دسترس است.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## داستان ماجرا

در ۱۰ نوامبر ۲۰۲۱، Google [اعلام کرد](https://blog.youtube/news-and-events/update-to-youtube/) که تعداد dislikeهای YouTube حذف خواهد شد.

علاوه بر این، فیلد `dislike` در YouTube API در تاریخ ۱۳ دسامبر ۲۰۲۱ [حذف شد](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)، که هرگونه امکان قضاوت درباره کیفیت محتوا قبل از تماشا را از بین برد.

## عملکرد

با حذف آمار dislike از YouTube API، بخش backend ما به استفاده از ترکیبی از آمار dislikeهای جمع‌آوری‌شده و برآوردهای استخراج‌شده از داده‌های کاربران افزونه تغییر یافت.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## چرا اهمیت دارد

می‌توانید در وب‌سایت ما اطلاعات بیشتری کسب کنید: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## مستندات API

استفاده شخص ثالث از این API عمومی با محدودیت‌های زیر مجاز است:

- **ارجاع**: این پروژه باید به طور واضح با لینکی به [returnyoutubedislike.com](https://returnyoutubedislike.com/) ارجاع داده شود.
- **محدودیت نرخ**: محدودیت‌های نرخ برای هر کلاینت ۱۰۰ در دقیقه و ۱۰,۰۰۰ در روز اعمال شده است. این یک کد وضعیت _429_ برمی‌گرداند که نشان می‌دهد برنامه شما باید متوقف شود یا درخواست‌ها را کاهش دهد.

این API از طریق URL پایه زیر در دسترس است:
https://returnyoutubedislikeapi.com

فهرست endpointهای موجود در اینجا در دسترس است:
https://returnyoutubedislikeapi.com/swagger/index.html

### دریافت آرا

مثال برای دریافت آرای یک YouTube video ID مشخص:
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

یک YouTube ID ناموجود، کد وضعیت _404_ "Not Found" برمی‌گرداند.  
یک YouTube ID با فرمت نادرست، کد وضعیت _400_ "Bad Request" برمی‌گرداند.

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## مشارکت

لطفاً [راهنمای مشارکت](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md) را مطالعه کنید.

## از این پروژه حمایت کنید!

می‌توانید با اهدا از طریق لینک زیر از این پروژه حمایت کنید:

[Donate](https://returnyoutubedislike.com/donate)

## حامیان مالی

[حامی ما شوید و در مخزن و وب‌سایت قرار بگیرید](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
