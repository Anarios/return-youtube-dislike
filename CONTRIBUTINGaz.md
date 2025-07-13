```markdown
Bunu diğer dillerde oxuyun: [English](CONTRIBUTING.md), [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md)

# "YouTube Dislike Sayını Geri Qaytar" layihəsinə qatqı qaydalarına Xoş Gəlmisiniz

Layihəmizə qatqı etmək üçün vaxt ayırdığınız üçün təşəkkür edirik! Bütün dəyişiklikləriniz uzantının növbəti versiyasına (və ya [internet saytına](https://www.returnyoutubedislike.com/)) əlavə ediləcəkdir.

## Başlamaq

Formatlama üçün xahiş olunur ki, Prettier-i standart parametrlərdə istifadə edin.

#### Tələblər

Layihənin paketlənmiş versiyasını yaratmaq üçün node və npm quraşdırılmalıdır.

Quraşdırma zamanı istifadə olunan versiyalar:

- node: 12.18.4  
- npm: 6.14.6  

Bu uzantının əsas məntiqini ehtiva edən `bundled-content-script.js` faylını yaratmaq üçün əvvəlcə bütün asılılıqları quraşdırmalısınız.

1. Deponun əsas qovluğuna keçin və aşağıdakı əmri icra edin:

```
npm install
```

2. `manifest.json` içərisində istifadə olunan `bundled-content-script.js` faylını yaratmaq üçün aşağıdakı əmri çalışdırın.

```
npm start // fayl yaradılarkən və saxlanarkən avtomatik yenilənən fayl izləyicisini başlatmaq üçün

// ya da

npm run build // faylları yalnız bir dəfə yaratmaq üçün
```

Təbriklər, artıq inkişaf etməyə hazırsınız!

Chrome uzantılarının inkişafına yeni başlamısınızsa və ya əlavə yardıma ehtiyacınız varsa, lütfən [bu YouTube dərsinə](https://www.youtube.com/watch?v=mdOj6HYE3_0) baxın.

### Issue'lar

#### Yeni bir issue açmaq

Uzantı ilə bağlı hər hansı bir probleminiz varsa, problemin əvvəllər bildirilmədiyindən əmin olmaq üçün axtarış aparın. Əgər daha əvvəl bildirilməyibsə, bir mövzu açın. Problem formunun istifadəsi şiddətlə tövsiyə olunur, lakin məcburi deyil.

#### Bir issue'yu həll etmək

Həll edə biləcəyinizi düşündüyünüz bir problem tapsanız, çəkinmədən çalışın. Problemi həll edən bir PR açın və həll etdiyiniz problemi müəyyənləşdirdiyinizdən əmin olun.

### Xüsusiyyət İstəkləri

#### Yeni bir xüsusiyyət istəyi açmaq

Uzantı haqqında bir ideyanız varsa, yeni bir xüsusiyyət istəyi açmaqdan çəkinməyin, lakin xüsusiyyətin daha əvvəl təklif olunmadığından əmin olmaq üçün axtarış edin. Xüsusiyyət formasının istifadəsi şiddətlə tövsiyə olunur, lakin məcburi deyil.

#### Bir xüsusiyyət istəyini tətbiq etmək

Tətbiq edə biləcəyinizi düşündüyünüz bir xüsusiyyət tapsanız, çəkinmədən çalışın. Xüsusiyyəti tətbiq edən bir PR açın və əlavə etdiyiniz xüsusiyyəti qeyd etdiyinizdən əmin olun.

### Hansı PR növlərini qəbul edirik?

- Problem həlləri.  
- Xüsusiyyət tətbiqləri.  
- Yazı səhvləri və ya daha aydın ifadələr.  
- Sayt qatqıları.
```