<p dir="rtl"> <!-- Right-to-left orientation, GitHub does not support this automatically. -->

[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

قراءة هذا في اللغات الأخرى: [English](README.md)، [русский](READMEru.md)، [Español](READMEes.md)، [Nederlands](READMEnl.md)، [Français](READMEfr.md)، [日本語](READMEja.md)، [Türkçe](READMEtr.md)، [українська](READMEuk.md)، [Deutsch](READMEde.md)، [Ελληνικά](READMEgr.md)، [Svenska](READMEsv.md)، [中文](READMEcn.md)، [Polski](READMEpl.md)، [Português do Brasil](READMEpt_BR.md)، [Magyar](READMEhu.md)، [Danish](READMEda.md)
# Return YouTube Dislike

<p align="center" dir= "rtl">
    <b>Return YouTube Dislike عبارة عن إضافة مفتوحة المصدر تعيد عداد عدم الإعجابات على YouTube.</b><br>
    متوفرة لـ Chrome وفيرفكس كإضافة ويب.<br>
    أيضًا متوفرة للمتصفحات الأخرى كـ JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## القصة

في 10 من تشرين الأول (نوفمبر) 2021، [أعلنت](https://blog.youtube/news-and-events/update-to-youtube/) Google إزالة عداد عدم الإعجابات على YouTube.

علاوةً على ذلك، [أزيل](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) الحقل `dislike` في واجهة برمجة التطبيقات YouTube في 13 من كانون الأول 2021، مزيلًا أي قدرة على الحكم على جودة المحتوى قبل مشاهدته.

## ماذا تفعل

مع إزالة إحصائيات عدم الإعجابات من واجهة برمجة تطبيقات YouTube، تحولت الواجهة الخلفية لدينا إلى استخدام مجموعة من إحصائيات عدم الإعجابات المستخرجة، وهي تقديرات مستمدة من بيانات مستخدم الإضافة.

[الأسئلة المتكررة](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## لماذا الأمر مهم

يمكنك معرفة المزيد على موقعنا الإلكتروني: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## وثائق واجهة برمجة التطبيقات

استخدام الجهات الخارجية لواجهة برمجة التطبيقات المفنوحة هذه مسموح مع القيود التالية:

- **الإسناد**: يجب الإسناد إلى هذا المشروع بوضوح برابط إلى [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **الحد من المعدل**: توجد حدود للطلب لكل عميل بدلاً من 100 في الدقيقة و10000 في اليوم. سيؤدي ذلك إلى إرجاع رمز الحالة _429_ الذي يشير إلى أنه يجب على طلبك التراجع.

يمكن الوصول إلى واجهة برمجة التطبيقات عبر عنوان URL الأساسي التالي:  
https://returnyoutubedislikeapi.com

قائمة نقاط النهاية المتاحة متوفرة هنا:  
https://returnyoutubedislikeapi.com/swagger/index.html

### الحصول على التصويتات

مثال للحصول على تصويتات معرف الفيديو YouTube المعطى:  
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

معرفات YouTube غير الموجودة ستعيد رمز الحالة _404_ "بلا وجود".  
معرفات YouTube غير سليمة الشكل ستعيد رمز الحالة will return _400_ "طلب غير صالح".

<!---
## وثائق واجهة برمجة التطبيقات

يمكنك عرض جميع الوثائق على موقعنا الإلكتروني.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## المساهمة

الرجاء قراءة [دليل المساهمة](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGar.md).

## دعم هذا المشروع!

يمكنك دعم هذا المشروع من خلال التبرع لنا عبر الرابط أدناه:

[التبرع](https://returnyoutubedislike.com/donate)

## الرعاة

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[كونوا رعاة لنا](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)

</p>