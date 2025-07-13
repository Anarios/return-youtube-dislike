[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

اقرأ هذا بلغات أخرى: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [Magyar](READMEhu.md), [Danish](READMEda.md)

#Return YouTube Dislike
<p align="center">
  <b>إعادة زر عدم الإعجاب على يوتيوب هو امتداد مفتوح المصدر يعيد عرض عدد عدم الإعجاب على يوتيوب.</b><br>
  متاح لمتصفح كروم وفايرفوكس كامتداد ويب.<br>
  متاح أيضًا لمتصفحات أخرى كـ JS Userscript.<br><br>
  <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## القصة

في 10 نوفمبر 2021، أعلنت جوجل [هنا](https://blog.youtube/news-and-events/update-to-youtube/) أن عدد عدم الإعجاب على يوتيوب سيتم إزالته.

بالإضافة إلى ذلك، تم إزالة حقل `dislike` من واجهة برمجة تطبيقات يوتيوب [هنا](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) في 13 ديسمبر 2021، مما أزال أي قدرة على تقييم جودة المحتوى قبل مشاهدته.

## ما الذي يفعله

مع إزالة إحصائيات عدم الإعجاب من واجهة برمجة تطبيقات يوتيوب، تحول نظامنا الخلفي إلى استخدام مزيج من إحصائيات عدم الإعجاب المستخرجة، وتقديرات مستنبطة من بيانات مستخدمي الامتداد.

[الأسئلة الشائعة](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## لماذا يهم

يمكنك معرفة المزيد على موقعنا الإلكتروني: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## توثيق واجهة برمجة التطبيقات

يسمح باستخدام هذه الواجهة المفتوحة من قبل أطراف ثالثة مع القيود التالية:

- **النسبة**: يجب أن يُنسب هذا المشروع بوضوح مع رابط إلى [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **تحديد المعدل**: هناك حدود معدل لكل عميل تبلغ 100 في الدقيقة و 10,000 في اليوم. سيعيد هذا رمز الحالة _429_ مما يشير إلى أن تطبيقك يجب أن يتراجع.

واجهة برمجة التطبيقات متاحة عبر عنوان URL الأساسي التالي:  
https://returnyoutubedislikeapi.com

قائمة النقاط النهائية المتاحة متاحة هنا:  
https://returnyoutubedislikeapi.com/swagger/index.html

### الحصول على الأصوات

مثال للحصول على أصوات فيديو معين على يوتيوب:  
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

سيعيد معرف يوتيوب غير الموجود رمز الحالة _404_ "غير موجود".  
سيعيد معرف يوتيوب غير الصحيح رمز الحالة _400_ "طلب غير صالح".

<!---
## توثيق واجهة برمجة التطبيقات

يمكنك عرض جميع الوثائق على موقعنا الإلكتروني.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## المساهمة

يرجى قراءة [دليل المساهمة](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## دعم هذا المشروع!

يمكنك دعم هذا المشروع من خلال التبرع لنا على الرابط أدناه:

[تبرع](https://returnyoutubedislike.com/donate)

## الرعاة

[كن راعينا](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
