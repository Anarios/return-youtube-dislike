Bunu digər dillərdə oxuyun: [English](FAQ.md), [русский](FAQru.md), [Nederlands](FAQnl.md), [Français](FAQfr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md)

# Tez-tez verilən suallar

## GitHub və ya Discord-da sual verməzdən əvvəl bura nəzər salın.

<br>

### **1.Bu uzantı məlumatları haradan əldə edir??**

Google API-lərin və silinmiş məlumatların birləşməsi.Google API-lərin və silinmiş məlumatların birləşməsi.

Google öz API-də bəyənməmə saylarını bağladıqdan sonra istifadə oluna bilməsi üçün bütün mövcud məlumatları verilənlər bazamızda saxlayırıq.
<br>

### **2. Videonun bəyənməmə sayı yenilənmir**

Hazırda videonun bəyənməmələri keşlənir və tez-tez yenilənmir. Hər 2-3 gündə, daha tez-tez deyil.

Bəli, bu ideal deyil, amma olduğu kimidir. Biz bunları daha tez-tez necə yeniləyə biləcəyimizi anlamaq üzərində işləyirik.
<br>

### **3. Bu uzantı necə işləyir?**

Artırma bizim API-dən istifadə edərək baxdığınız videonun video identifikatorunu götürür, bəyənmədiklərini (və baxışlar, bəyənmələr və s. kimi digər sahələri) alır; video API tərəfindən ilk dəfə alınırsa, YouTube API-dən istifadə edir. Məlumatları əldə etmək üçün o, keşləmə (təxminən 2-3 gün ərzində yaddaşda saxlanılır) və arxivləşdirmə məqsədləri üçün verilənlər bazasında saxlanılır və sizə qaytarılır. Daha sonra uzantı sizə bəyənmədiyinizləri göstərir.

<br>

### **4. YouTube API bəyənməmə saylarını qaytarmağı dayandırdıqda nə baş verir?**

Backend arxivləşdirilmiş bəyənməmə statistikası, genişləndirmə istifadəçi məlumatlarından ekstrapolyasiya edilmiş təxminlər və arxivləşdirilməmiş videolar və köhnə bəyənməmə arxivləri üçün baxış/bəyənmə nisbətlərinə əsaslanan təxminlərin birləşməsindən istifadə etməyə keçəcək.

<br>

### **5. Bəyənməmələrin sayı necə hesablanır?**

YDS bəyənməmələrin sayını hesablamaq üçün istifadəçilərinin səslərindən istifadə edir.

- Video API bağlandıqdan sonra yüklənibsə:

  $$ \textup{YDS Bəyənməmə Sayısı} = \left( \frac{\textup{YDS İstifadəçiləri Saymağı Bəyənirlər}}{\textup{YDS İstifadəçilərinin Bəyənmədiyi Say}} \right) \times \textup{İctimai Bəyənmə Sayısı} $$

- Əgər YDS verilənlər bazasında hansısa şəkildə real bəyənmə və bəyənməmə sayları varsa (yükləyən və ya arxivdən təqdim olunur), bəyənməmə sayı həm istifadəçilərin səsləri, həm də arxivləşdirilmiş dəyər əsasında hesablanacaq. Arxivləşdirilmiş dəyər yaşlandıqca son hesaba daha az təsir edəcək.
<br>

---

Bu video formada

[![IReturn YouTube Dislike Explained](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Məxfilik/təhlükəsizliklə bağlı narahatlıqlarım var
Ətraflı məlumat üçün [bu səyfə](SECURITY-FAQtr.md)ya baxın.
