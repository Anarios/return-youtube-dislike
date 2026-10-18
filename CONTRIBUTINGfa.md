Read this in other languages: [English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# به راهنمای مشارکت Return YouTube Dislikes خوش آمدید

از اینکه وقت خود را برای مشارکت در پروژه ما اختصاص می‌دهید سپاسگزاریم! تمام تغییرات شما در نسخه بعدی افزونه (یا [وب‌سایت](https://www.returnyoutubedislike.com/)) منعکس خواهد شد.

## شروع به کار

لطفاً از Prettier با تنظیمات پیش‌فرض برای قالب‌بندی استفاده کنید.

#### پیش‌نیازها

برای ایجاد نسخه bundled از سورس، باید node و npm را نصب داشته باشید.

نسخه‌های استفاده‌شده در زمان راه‌اندازی:

- node: 12.18.4
- npm: 6.14.6

برای ایجاد `bundled-content-script.js` که شامل بیشتر منطق اصلی این افزونه است، ابتدا باید تمام وابستگی‌ها را نصب کنید.

۱. به ریشه مخزن بروید و اجرا کنید:

```
npm install
```

۲. دستور زیر را برای ایجاد `bundled-content-script.js` که در `manifest.json` استفاده می‌شود اجرا کنید:

```
npm start // برای ایجاد فایل(های) بیلد و شروع یک مشاهده‌گر فایل که هنگام ذخیره به صورت لحظه‌ای بارگذاری مجدد می‌کند

// یا

npm run build // برای ایجاد فایل(های) بیلد به صورت یک‌باره
```

تبریک، اکنون آماده توسعه هستید!

اگر در توسعه افزونه‌های Chrome تازه‌کار هستید یا به کمک بیشتری نیاز دارید، لطفاً [این آموزش YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0) را مشاهده کنید.

### مشکلات

#### باز کردن یک issue جدید

اگر مشکلی با افزونه دارید، لطفاً جستجو کنید تا مطمئن شوید مشکل قبلاً گزارش نشده است. اگر گزارش نشده بود، یک issue باز کنید؛ استفاده از فرم issue به شدت توصیه می‌شود اما اجباری نیست.

#### حل یک issue

اگر مشکلی پیدا کردید که احساس می‌کنید قادر به حل آن هستید، خجالت نکشید. یک PR همراه با رفع مشکل باز کنید و حتماً به issueای که حل می‌کنید اشاره کنید.

### درخواست ویژگی

#### باز کردن یک درخواست ویژگی جدید

اگر ایده‌ای برای افزونه دارید، با خیال راحت یک درخواست ویژگی باز کنید، اما لطفاً قبل از آن جستجو کنید تا مطمئن شوید این ویژگی قبلاً پیشنهاد نشده است. استفاده از فرم ویژگی به شدت توصیه می‌شود اما اجباری نیست.

#### پیاده‌سازی یک درخواست ویژگی

اگر ویژگی پیدا کردید که فکر می‌کنید می‌توانید آن را پیاده‌سازی کنید، خجالت نکشید. یک PR همراه با رفع مشکل باز کنید و حتماً به ویژگی‌ای که پیاده‌سازی می‌کنید اشاره نمایید.

### چه PRهایی را می‌پذیریم؟

- رفع مشکلات.
- پیاده‌سازی ویژگی‌ها.
- اشتباهات تایپی یا کلمات بهتر و آسان‌تر برای استفاده.
- مشارکت در وب‌سایت.
