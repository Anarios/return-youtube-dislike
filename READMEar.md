[![متجر كروم الالكتروني](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![مستخدمو متجر كروم الإلكتروني](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![تصنيف موزيلا](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![تنزيلات موزيلا](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![معدل الالتزام](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![المشاكل](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![ديسكورد](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![الترخيص](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)


اقرأ هذا بلغات أخرى: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md)


# Return YouTube Dislike

<p align="center">
     <b>Return YouTube Dislike هو امتداد مفتوح المصدر يعرض عدد عدم الإعجاب على YouTube.</b><br>
     متاح لمتصفح Chrome وFirefox كملحق ويب.<br>
     متاح أيضًا للمتصفحات الأخرى مثل JS Userscript.<br><br>
     <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## القصة

في العاشر من نوفمبر، 2021، جوجل [أعلنت](https://blog.youtube/news-and-events/update-to-youtube/) أنه ستتم إزالة عدد عدم الإعجاب من على YouTube.

بالإضافة إلى ذلك، تمت [إزالة] حقل "عدم الإعجاب" في واجهة برمجة تطبيقات YouTube (https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) في 13 كانون الأول (ديسمبر) 2021، مما أدى إلى إزالة أي قدرة على الحكم على جودة المحتوى قبل المشاهدة.
## ماذا يفعل

مع إزالة إحصائيات عدم الإعجاب من واجهة برمجة تطبيقات YouTube، تحولت الواجهة الخلفية لدينا إلى استخدام مجموعة من إحصائيات عدم الإعجاب المستخرجة، وهي تقديرات مستمدة من اضافة بيانات مستخدم .

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## لماذا مهم

تستطيع الحصول على معلومات أكثر من موقعنا: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)


## وثائق واجهة برمجة التطبيقات API

يُسمح باستخدام جهة خارجية لواجهة برمجة التطبيقات المفتوحة API هذه مع القيود التالية:

- **الإسناد**: يجب أن يُنسب هذا المشروع بوضوح من خلال رابط إلى [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **حدود السعر**: توجد حدود للسعر لكل عميل بدلاً من 100 في الدقيقة و10,000 في اليوم. سيؤدي هذا إلى إرجاع رمز الحالة _429_ الذي يشير إلى أنه يجب التراجع عن تطبيقك.

يمكن الوصول إلى واجهة برمجة التطبيقات API عبر عنوان URL الأساسي التالي:
https://returnyoutubedislikeapi.com

قائمة نقاط النهاية المتاحة متاحة هنا:
https://returnyoutubedislikeapi.com/swagger/index.html

### أحصل على أصوات

مثال للحصول على أصوات لمعرف فيديو معين على YouTube:  
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

None existing YouTube ID will return status code _404_ "Not Found".  
Wrong formed YouTube ID will return _400_ "Bad Request".

أي معرف YouTube غير موجود سيؤدي الى رمز الحالة _404_ "غير موجود".
تكوين YouTube بشكل خاطئ سيؤدي إلى عرض _400_ "طلب غير صالح".

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## المساهمة

Please read the [contribution guide](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## ادعم المشروع!

يمكنكم دعم هذا المشروع من خلال التبرع لنا على الرابط أدناه:

[Donate](https://returnyoutubedislike.com/donate)

## الرعاة

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Become our sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
