Read this in other languages: [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md)

# Təhlükəsizlik

### Baxış tarixçəmi izləyirsiniz?

Xeyr. Artırmanın kodu ictimaiyyətə açıqdır və siz bunu özünüz görə bilərsiniz. Göndərilən yeganə məlumat videolar üçün bəyənməmə sayını almaq üçün tələb olunan video ID-dir. Göndərilən başqa əlavə başlıq yoxdur. Rabitə təbəqəsi vasitəsilə ictimai IP-niz serverə və sorğunun edildiyi vaxta məruz qalacaq. Bununla belə, bunların heç biri sizi heç bir şəkildə unikal şəkildə müəyyənləşdirmir. Sıfır etibar mühitini fərz etsək, əldə edə biləcəyimiz ən yaxşısı dinamik IP-dir. Bu İP bu gün sənin, sabah qonşunun ola bilər. Əgər həqiqətən IP-nizin izlənilməsindən narahatsınızsa, yəqin ki, artıq VPN-dən istifadə edirsiniz.

### Videonu bəyənməsəm, məni unikal şəkildə tanıya bilərsiniz??

Bəli. Videonu bəyənmədiyiniz zaman biz sizin üçün Google hesabınızla əlaqəli olmayan təsadüfi yaradılmış unikal ID yaradırıq. Bu, botlardan istifadənin qarşısını almaq üçün edilir. Bununla belə, bu təsadüfi identifikatoru sizə və ya şəxsi YouTube hesabınıza bağlamağın heç bir yolu yoxdur.

### Sizdə dəqiq olaraq hansı məlumat var??

Sadəcə video identifikatoru. Şərhləriniz, istifadəçi adınız, videonu kiminlə paylaşdığınız, heç bir əlavə metadata deyil. heç nə. Sadəcə video identifikatoru.

### Mənim IP ünvanım necə saxlanılır?

Backend yalnız müvəqqəti yaddaşda (RAM) haşiyələnməmiş IP ünvanlarını saxlayır. Bu ünvanlar sabit diskdə saxlanmır və buna görə də qeyd olunmur. Biz IP ünvanlarını hash edirik və əvəzinə onlar saxlanılır. Bu, verilənlər bazası vandalizminin qarşısını almaq üçün edilir.

### OAuth vasitəsilə YouTube hesabıma daxil olmaq haqqında bəzi mübahisələr eşitdim!

Bu xüsusiyyət istəyə bağlı olacaq və çox üstünlük təşkil edəcək. Əgər siz YouTube yaradıcısısınızsa və bəyənmədiyiniz statistikanı bizimlə bölüşmək istəyirsinizsə, bunu edə bilərsiniz. [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) Qurulma şəkli, əslində çox təhlükəsizdir. İstənilən vaxt hesabınıza girişi ləğv edə və bizə çox xüsusi icazələr verə bilərsiniz. Biz heç bir lazımsız icazə istəməyəcəyik. Biz yalnız video statistikanıza baxmaq üçün icazə istəyəcəyik.
### Bu sayda bəyənməmələrə necə etibar edə bilərəm??

Biz bot hücumlarının qarşısını almaq üçün tədbirlər gördük və anti-bot sisteminin effektivliyini artırmaq üçün işi davam etdirəcəyik: bu, bəyənməmələrin sayını real rəqəmin yaxşı nümayəndəsi kimi saxlamağa kömək edəcək. Əlbəttə ki, bu, heç vaxt 100% dəqiq olmayacaq, ona görə də hesaba etibar edib etməmək sizə bağlıdır.

### Niyə backend kodunu paylaşmırsınız?
Biz bunu nə vaxtsa paylaşacağıq - lakin hazırda paylaşmaq üçün həqiqətən heç bir səbəb yoxdur. Bu, yanlış təhlükəsizlik hissi verə bilər - çünki sıfır inamlı sistemdə biz bir versiyanı ifşa edə, digərini yerləşdirə bilərik. Kodu gizli saxlamağın bir çox səbəbi var, xüsusən də spamla necə mübarizə aparırıq. Spam emalı kodunu ört-basdır etmək/gizlətmək olduqca standart təcrübədir.