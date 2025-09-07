Read this in other languages: [English](CONTRIBUTING.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md)

# مرحبًا بكم في دليل المساهمة في Return YouTube Dislikes

شكرًا لك على استثمار وقتك في المساهمة في مشروعنا! سيتم عكس جميع تغييراتك في الإصدار التالي من الامتداد (أو [الموقع](https://www.returnyoutubedislike.com/)).

## البدء

يرجى استخدام Prettier بالإعدادات الافتراضية للتنسيق.

#### المتطلبات الأساسية

تحتاج إلى تثبيت node و npm لإنشاء النسخة المجمعة من المصدر.

الإصدارات المستخدمة عند الإعداد:

- node: 12.18.4
- npm: 6.14.6

لإنشاء `bundled-content-script.js` الذي يحتوي على معظم منطق العمل لهذا الامتداد، يجب عليك تثبيت جميع التبعيات أولاً.

1. انتقل إلى جذر المستودع وقم بتشغيل:

```
npm install
```

2. قم بتشغيل الأمر التالي لإنشاء `bundled-content-script.js` الذي يستخدم في `manifest.json`

```
npm start // لإنشاء ملف(ات) البناء وبدء مراقب الملفات الذي يعيد التحميل تلقائيًا عند الحفظ

// أو

npm run build // لإنشاء ملف(ات) البناء مرة واحدة
```

تهانينا، أنت الآن جاهز للتطوير!

إذا كنت جديدًا في تطوير ملحقات Chrome، أو تحتاج إلى مساعدة إضافية، يرجى مشاهدة [هذا الفيديو التعليمي على YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### المشاكل

#### فتح مشكلة جديدة

إذا كانت لديك أي مشاكل مع الامتداد، يرجى البحث للتأكد من أن المشكلة لم يتم الإبلاغ عنها بالفعل. إذا لم تكن كذلك، افتح مشكلة، يوصى بشدة باستخدام نموذج المشكلة ولكنه ليس إلزاميًا.

#### حل مشكلة

إذا وجدت مشكلة تشعر أنك قد تكون قادرًا على حلها، لا تخجل. افتح PR مع الإصلاح وتأكد من ذكر المشكلة التي تقوم بإصلاحها.

### طلب ميزة

#### فتح طلب ميزة جديدة

إذا كانت لديك فكرة للامتداد، لا تتردد في فتح طلب ميزة، ولكن يرجى البحث أولاً للتأكد من أن الميزة لم يتم اقتراحها بالفعل. يوصى بشدة باستخدام نموذج الميزة ولكنه ليس إلزاميًا.

#### تنفيذ طلب ميزة

إذا وجدت ميزة تشعر أنك قد تكون قادرًا على تنفيذها، لا تخجل. افتح PR مع الإصلاح وتأكد من ذكر الميزة التي تقوم بتنفيذها.

### ما PRs التي نقبلها؟

- إصلاحات المشاكل.
- تنفيذ الميزات.
- الأخطاء المطبعية أو الكلمات الأفضل والأسهل للاستخدام.
- مساهمات الموقع.
