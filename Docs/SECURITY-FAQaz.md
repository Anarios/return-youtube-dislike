Read this in other languages: [беларуская](SECURITY-FAQbe.md), [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [Slovenščina](SECURITY-FAQsl.md)

# Təhlükəsizlik

### Baxış tarixçəmi izləyirsiniz?

Xeyr. Artırmanın kodu ictimaiyyətə açıqdır və ona özünüz baxa bilərsiniz. Artırma bəyənməmə sayını təxmin etmək və bu təxmini dəqiqləşdirmək üçün cari videonun identifikatorunu və göstərilirsə, bəyənmə sayını göndərir. Sorğu zamanı ictimai IP ünvanınız və sorğunun vaxtı kimi standart şəbəkə məlumatları da serverə məlum olur. Artırma cihazınızda ayrıca baxış tarixçəsi saxlamır.

### Videonu bəyənməsəm, məni unikal şəkildə tanıya bilərsiniz??

Artırma ilk dəfə səs verdiyinizdə və ya RYD-də şərhə reaksiya göstərdiyinizdə səsvermədə sui-istifadənin qarşısını almaq üçün qalıcı, təsadüfi identifikator yaradır. Sadəcə videonu açdıqda və ya şərhləri oxuduqda bu identifikator göndərilmir. İdentifikator Google və ya YouTube hesabınız əsasında yaradılmır və həmin hesablarla əlaqəli deyil. Mozilla qalıcı identifikatorları şəxsi məlumat kimi təsnif edir. Xidmət bu identifikatordan göndərilən səsləri eyni artırma quraşdırılması ilə əlaqələndirmək üçün istifadə edir.

### Sizdə dəqiq olaraq hansı məlumat var??

Bəyənməmə sayı sorğularına videonun identifikatoru və göstərilirsə, bəyənmə sayı daxildir. Qeydiyyat zamanı quraşdırmaya aid təsadüfi identifikatordan istifadə olunur. Səs verildikdə həmin identifikator, videonun identifikatoru, seçilmiş səs və səsvermə vaxtı saxlanılır. RYD şərhlərinə reaksiyalar üçün həmin identifikatordan, şərhin identifikatorundan və seçilmiş reaksiyadan istifadə olunur. Səs və reaksiya qeydlərində hansı artırmadan və ya istifadəçi skriptindən istifadə etdiyiniz, onun versiyası və varsa, klik anındakı oynatma mövqeyi (tam saniyə ilə) də göstərilə bilər. Reaksiyanı geri götürdükdə onun qeydi silinmiş kimi işarələnir. RYD-də dərc etdiyiniz şərhlər və cavablar ictimaiyyətə açıqdır və RYD-dəki ləqəbinizlə göstərilir. Artırma YouTube hesabınızın adını və ya YouTube şərhlərinizi göndərmir.

### Mənim IP ünvanım necə saxlanılır?

Xidmət IP ünvanınızı və sorğu ilə göndərildiyi halda, brauzeri təsvir edən məlumatı (User-Agent sətrini) saxlayır. Bu məlumatlar tamamlanmış qeydiyyatlar, səslər, dərc edilmiş şərhlər və cavablar, eləcə də RYD şərhlərinə reaksiyalarla birlikdə saxlanılır. IP ünvanlarından sui-istifadənin qarşısını almaq və ümumiləşdirilmiş statistika hazırlamaq üçün istifadə olunur. IP ünvanları satılmır və reklam məqsədilə istifadə edilmir.

### OAuth vasitəsilə YouTube hesabıma daxil olmaq haqqında bəzi mübahisələr eşitdim!

Bu xüsusiyyət istəyə bağlı olacaq və çox üstünlük təşkil edəcək. Əgər siz YouTube yaradıcısısınızsa və bəyənmədiyiniz statistikanı bizimlə bölüşmək istəyirsinizsə, bunu edə bilərsiniz. [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) Qurulma şəkli, əslində çox təhlükəsizdir. İstənilən vaxt hesabınıza girişi ləğv edə və bizə çox xüsusi icazələr verə bilərsiniz. Biz heç bir lazımsız icazə istəməyəcəyik. Biz yalnız video statistikanıza baxmaq üçün icazə istəyəcəyik.
### Bu sayda bəyənməmələrə necə etibar edə bilərəm??

Biz bot hücumlarının qarşısını almaq üçün tədbirlər gördük və anti-bot sisteminin effektivliyini artırmaq üçün işi davam etdirəcəyik: bu, bəyənməmələrin sayını real rəqəmin yaxşı nümayəndəsi kimi saxlamağa kömək edəcək. Əlbəttə ki, bu, heç vaxt 100% dəqiq olmayacaq, ona görə də hesaba etibar edib etməmək sizə bağlıdır.

### Niyə backend kodunu paylaşmırsınız?
Biz bunu nə vaxtsa paylaşacağıq - lakin hazırda paylaşmaq üçün həqiqətən heç bir səbəb yoxdur. Bu, yanlış təhlükəsizlik hissi verə bilər - çünki sıfır inamlı sistemdə biz bir versiyanı ifşa edə, digərini yerləşdirə bilərik. Kodu gizli saxlamağın bir çox səbəbi var, xüsusən də spamla necə mübarizə aparırıq. Spam emalı kodunu ört-basdır etmək/gizlətmək olduqca standart təcrübədir.