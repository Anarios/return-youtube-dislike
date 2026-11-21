import { az } from "vuetify/locale";
// By HAJİAGHA SADİKHOV
export default {
  ...az,
  home: {
    name: "Ana Səhifə",
    title: "YouTube Dislike Sayını Geri Qaytar",
    subtitle:
      "YouTube-dakı dislike saylarını geri qaytaran bir brauzer genişləndirməsi və API",
    ukraine: "Ukraynaya Dəstək Ol",
    sponsors: "Sponsorlar",
    becomeSponsor: "Sponsorumuz olun",
  },
  install: {
    name: "Yüklə",
    title: "Platformanızı Seçin",
    subtitle: "Firefox və bütün Chromium əsaslı brauzerlərdə mövcuddur",
    title2: "Digər Platformalar",
    subtitle2:
      "Brauzeriniz hələ dəstəklənmirsə, UserScript metodunu sınayın",
    title3: "Üçüncü Tərəf Tətbiqlər",
    subtitle3:
      "Risk tamamilə sizə məxsusdur, bizim tərəfimizdən heç bir məsuliyyət qəbul edilmir",
    firefox: "Firefox",
    chrome: "Chrome",
    edge: "Edge",
    opera: "Opera",
    brave: "Brave",
    userscript: "İstifadəçi skripti",
    tampermonkey: "Tampermonkey",
    androidReVanced: "Android - ReVanced",
    androidMorphe: "Android - Morphe",
    androidTubular: "Android (Tubular - NewPipe çatalı)",
    iosJailbroken: "iOS (Jailbreakli)",
    iosUYouPlus: "iOS (uYou+)",
    safariZorro: "Safari (macOS, iOS) - Zorro Dislikes",
    safariZorroGitHub: "Safari - Zorro Dislikes (GitHub)",
  },
  api: {
    name: "API",
    title: "Rəsmi RYD sənədlərinə xoş gəlmisiniz!",
    subtitle: "Başlamaq üçün menyudan bir bölmə seçin.",
    rights: {
      title: "İstifadə Hüquqları",
      subtitle:
        "İctimai API-nin üçüncü tərəflərin istifadəsində aşağıdakı məhdudiyyətlərə icazə verilir:",
      bullet1: "İstinad: ",
      bullet1text:
        "Bu layihəyə bu depoya və ya returnyoutubedislike.com saytına keçid verərək açıq şəkildə istinad edilməlidir.",
      bullet2: "Sürət Məhdudiyyəti: ",
      bullet2text:
        "İstifadəçi başına dəqiqədə 100 və gündə 10.000 sürət məhdudiyyəti var. Bu, tətbiqinizin geri çəkilməsi lazım olduğunu göstərən 429 status kodunu qaytarır.",
    },
    url: {
      title: "URL Məlumatı",
      subtitle: "API-ya bu URL vasitəsilə daxil olmaq olar: ",
    },
    endpoints: {
      title: "Mövcud Endpointlər",
      subtitle: "Mövcud endpointlərin siyahısı burada mövcuddur: ",
    },
    fetching: {
      title: "Əsas Məlumat Alma Təlimi",
      subtitle:
        "Müəyyən bir YouTube ID-sinin səslərini əldə etmək üçün bir nümunə: ",
      title2: "Nümunə Sorğu: ",
      url: "Sorğu URL-i: ",
      method: "Sorğu Metodu: ",
      headers: "Başlıqlar: ",
      response: "Nəticə: ",
      error1: 'Yanlış YouTube ID-si 404 "Tapılmadı" olaraq qaytarılır.',
      error2:
        'Səhv formatlaşdırılmış YouTube ID-si 400 "Yanlış Sorğu" olaraq qaytarılır.',
    },
  },
  help: {
    name: "Kömək",
    title: "Problem Həll Etmə",
    bullet1: "Genişləndirmənin ən son versiyası olan ",
    bullet11: " versiyasının qurulduğundan əmin olun",
    bullet2:
      "Genişləndirməni silib yenidən yükləməyi sınayın, sonra brauzerinizi yenidən başladın (bütün aktiv sekmələri bağlayın, yalnız bir sekmə deyil)",
    bullet3: "Bu linki açdığınızdan əmin olun: ",
    bullet31: "belə bir düz mətn görməlisiniz: ",
    bullet4: "Yuxarıdakı kömək etmədikdə - Discord serverimizdəki ",
    bullet41:
      " kanalından problemi bildirin (İngilis dilində) Discord serverimiz: ",
    bullet4a:
      "Bizə İşlətmə Sisteminiz, Brauzer Adınız və Brauzer Versiyanız haqqında məlumat verin",
    bullet4b: "Konsol açıqkən (açmaq üçün ",
    bullet4b1:
      " düyməsinə basın) problemi yaşadığınız səhifənin ekran görüntüsünü alın (yəni YouTube izləmə səhifəsinin) - Ekran görüntüsü nümunəsi aşağıdadır.",
    bullet4c:
      "Genişləndirmə quraşdırılmışkən brauzerinizin genişləndirmələr səhifəsinin ekran görüntüsünü alın.",
    bullet4c1: "Genişləndirmələri görmək üçün bu linki ünvan çubuğuna yapışdırın: ",
    firefox: "(Firefox üçün)",
    chrome: "(Chrome, Edge, Brave, Opera və Vivaldi üçün)",
    detected: "Aşkarlanan:",
    altExampleScreenshot: "nümunə ekran görüntüsü",
  },
  faq: {
    name: "Ən çox verilən suallar",
    title: "Ən çox verilən suallar",
    subtitle:
      "Hələ də problem yaşayırsınız? Discord serverimizə qoşulmaqdan çəkinməyin! (İngilis dilində)",
    bullet1: "Genişləndirmə məlumatları haradan alır?",
    bullet1text:
      "Rəsmi YouTube dislike sayı API-si bağlanmazdan əvvəl arxivlənmiş məlumatlar və təxmin edilən genişləndirmə istifadəçisi davranışlarının birləşməsi ilə.",
    bullet2: "Dislike sayı niyə yenilənmir?",
    bullet2text:
      "Hal-hazırda dislike hallarını cache-də saxlayırıq və çox tez-tez yeniləmirik. Videonun populyarlığından asılı olaraq dəyişir, lakin yenilənməsi bir neçə saat və ya bir neçə gün çəkə bilər.",
    bullet3: "Bu necə işləyir?",
    bullet3text:
      "Genişləndirmə izlədiyiniz videonun ID-sini toplayır və API-miz vasitəsilə videonun dislike sayını (həmçinin baxış və like sayları kimi digər məlumatları) alır. Daha sonra genişləndirmə səhifədə dislike sayını və nisbətini göstərir. Bir videoya like və ya dislike versəniz, verdiyiniz səs qeydə alınır və dəqiq dislike sayını təxmin etmək üçün verilənlər bazasına göndərilir.",
    bullet4: "Dislike sayımı sizinlə paylaşa bilərəm?",
    bullet4text:
      "Çox yaxın gələcəkdə bəli. Məzmun istehsalçılarının dislike sayıları üçün doğrulanma paylaşa bilmələri üçün Oauth və ya fərqli bir oxumaq üçün məhdud API istifadə etməyi planlaşdırırıq.",
    bullet5: "Hansı məlumatları toplayırsınız və bunlar necə işlənir?",
    bullet5text:
      "Genişləndirmə yalnız düzgün işləmək üçün zəruri olan məlumatları toplayır (IP adresiniz və ya videonun ID-si kimi). Məlumatlarınız heç vaxt üçüncü tərəflərə satılmayacaq. Təhlükəsizliyi və məxfiliyi necə təmin etdiyimiz haqqında daha ətraflı məlumat üçün <a href=\"https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md\">təhlükəsizlik haqqında tez-tez verilən suallara</a> baxın.",
    bullet6: "API/Backend necə işləyir?",
    bullet6text:
      "Server tərəfi YouTube API-sinin hələ dislike sayını qaytardığı dövrdə arxivlənmiş məlumatlardan, genişləndirmə istifadəçilərinin like/dislike saylarından və ekstrapolyasiyadan istifadə edir. Yaxın gələcəkdə məzmun yaradıcılarının dislike saylarını asan və təhlükəsiz şəkildə göndərməsinə imkan verəcəyik və ArchiveTeam-in arxivlənmiş məlumatlarını (4,56 milyard video) mövcud verilənlər bazamıza əlavə edəcəyik. Bu mövzu haqqında videoya da baxa bilərsiniz.",
    bullet7: "Dislike sayı niyə 'Sahibi tərəfindən deaktiv edilib' olaraq göstərilir?",
    bullet7text:
      "Bəzən yeni yüklənmiş videoda məzmun yaradıcısı dislike sayını deaktiv etməsə belə, bu mesaj görünə bilər. Bu, dislike sayının deaktiv olub-olmadığını müəyyənləşdirmə üsulumuzla bağlıdır. Ümid edirik ki, bu hal bir neçə saat ərzində və ya videoya like/dislike verib səhifəni yenilədikdən sonra aradan qalxacaq.",
  },
  donate: {
    name: "Bağış Et",
    subtitle:
      "İnterneti azad etmək səylərimizdə bizə bağışınızla dəstək ola bilərsiniz!",
    patreon: "Patreon",
    crypto: "Kripto",
  },
  links: {
    name: "Linklər",
    title: "Layihə Linkləri",
    subtitle: "Layihəyə və inkişaf etdiricilərinə linklər",
    contact: "Bizimlə Əlaqə",
    translators: "Tərcüməçilər",
    coolProjects: "Maraqlı Layihələr",
    sponsorBlockDescription: "Videolara daxil olan reklamlardan keçər",
    filmotDescription: "YouTube videolarını altyazıya görə axtarmağa imkan verir",
    github: "GitHub",
    discord: "Discord",
  },
  layout: {
    notSupported: "dəstəklənmir.",
    considerUpgrade: "Zəhmət olmasa ən son versiyaya yeniləyin.",
  },
};
