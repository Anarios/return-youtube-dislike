import { tr } from "vuetify/src/locale";
// By Batuhan Kara & İlyas Zan
export default {
  ...tr,
  home: {
    name: "Ana Sayfa",
    title: "YouTube Dislike Sayısını Geri Getir",
    subtitle:
      "YouTube'daki dislike sayılarınızı geri getiren bir tarayıcı uzantısı ve API",
    ukraine: "Ukrayna'ya Destek Ol",
    sponsors: "Sponsorlar",
  },
  install: {
    name: "Yükle",
    title: "Platformunuzu Seçin",
    subtitle: "Firefox ve bütün Chromium tabanlı tarayıcılarda kullanılabilir",
    title2: "Diğer Platformlar",
    subtitle2:
      "Tarayıcınız henüz desteklenmiyorsa UserScript yöntemini deneyin",
    title3: "Üçüncü Parti Uygulamalar",
    subtitle3:
      "Riski tamamen size aittir, bizim tarafımızda sorumluluk kabul edilmemektedir",
  },
  api: {
    name: "API",
    title: "Resmî RYD belgelerine hoş geldiniz!",
    subtitle: "Başlamak için menüden bir bölüm seçin.",
    rights: {
      title: "Kullanım Hakları",
      subtitle:
        "Herkese açık API'nin üçüncü parti kişilerin kullanımında aşağıdaki kısıtlamalara izin verir:",
      bullet1: "Atıf: ",
      bullet1text:
        "Bu proje, bu depoya ya da returnyoutubedislike.com sitesine bir bağlantı ile açıkça atfedilmelidir.",
      bullet2: "Hız Sınırlaması: ",
      bullet2text:
        "Kullanıcı başına dakikada 100 ve günde 10.000 hız sınırlaması vardır. Bu, uygulamanızın geri çekilmesi gerektiğini belirten 429 durum kodunu döndürür.",
    },
    url: {
      title: "URL Bilgisi",
      subtitle: "API'ye şu URL üzerinden ulaşılabilir: ",
    },
    endpoints: {
      title: "Kullanılabilir Endpoint'ler",
      subtitle: "Kullanılabilir endpoint'lerin listesi burada mevcuttur: ",
    },
    fetching: {
      title: "Temel Veri Alma Eğitimi",
      subtitle:
        "Belirli bir YouTube ID'sinin oylamalarını elde etmek için bir örnek: ",
      title2: "Örnek İstek: ",
      url: "İstek URL'si: ",
      method: "İstek Yöntemi: ",
      headers: "Header'lar: ",
      response: "Sonuç: ",
      error1: 'Geçersiz bir YouTube ID\'si, 404 "Not Found" olarak döndürülür.',
      error2:
        'Yanlış biçimlendirilmiş bir YouTube ID\'si, 400 "Bad Request" olarak döndürülür.',
    },
  },
  help: {
    name: "Yardım",
    title: "Sorun Giderme",
    bullet1: "Uzantının en son sürümü olan ",
    bullet11: " sürümünün kurulu olduğundan emin olun",
    bullet2:
      "Uzantıyı kaldırıp yeniden yüklemeyi deneyin, sonra tarayıcınızı yeniden başlatın (tüm aktif sekmeleri kapatın, sadece tek bir sekmeyi değil)",
    bullet3: "Şu bağlantıyı açtığınızdan emin olun: ",
    bullet31: "şöyle bir düz metin görmelisiniz: ",
    bullet4: "Yukarıdakiler yardımcı olmadıysa - Discord sunucumuzdaki ",
    bullet41:
      " kanalından problemi bildirin (İngilizce bir şekilde) Discord sunucumuz: ",
    bullet4a:
      "Bize İşletim Sisteminizi, Tarayıcı Adınızı ve Tarayıcı Sürümünüzü söyleyin",
    bullet4b: "Konsol açıkken (açmak için ",
    bullet4b1:
      " tuşuna basın) sorunu yaşadığınız sayfanın ekran görüntüsünü alın (yani YouTube watch sayfasının) - Ekran görüntüsü örneği aşağıdadır.",
    bullet4c:
      "Uzantı yüklüyken tarayıcınızın uzantılar sayfasının ekran görüntüsünü alın.",
    bullet4c1: "Uzantıları görmek için şu linki adres çubuğuna yapıştırın: ",
    firefox: "(Firefox için)",
    chrome: "(Chrome, Edge, Brave, Opera ve Vivaldi için)",
  },
  faq: {
    name: "SSS",
    title: "Sıkça Sorulan Sorular",
    subtitle:
      "Hâlâ sorun mu yaşıyorsunuz? Discord sunucumuza katılmaktan çekinmeyin! (İngilizce)",
    bullet1: "Uzantı, verileri nereden alıyor?",
    bullet1text:
      "Resmî YouTube dislike sayısı API'si kapatılmadan önceki arşivlenmiş verilerden ve tahmin edilen uzantı kullanıcısı davranışının bir birleşimiyle.",
    bullet2: "Dislike sayısı neden güncellenmiyor?",
    bullet2text:
      "Şu anda dislike durumları önbelleğe alınır ve çok sık güncellenmez. Bir videonun popülerliğine bağlı olarak değişir ancak güncellenmesi birkaç saat ilâ birkaç gün sürebilir.",
    bullet3: "Bu nasıl çalışıyor?",
    bullet3text:
      "Uzantı, izlediğiniz videonun ID'sini alır, API'miz üzerinden dislike sayılarınızı geri getirir (aynı zamanda görüntülenmenizi, like'ınızı vb. diğer alanları da). Uzantı daha sonra sayfada dislike sayısını ve oranını görüntüler. Bir videoya like veya dislike atarsanız bu kaydedilir ve veri tabanına gönderilir, böylece doğru dislike sayısını tahmin edebilir.",
    bullet4: "Dislike sayımı sizinle paylaşabilir miyim?",
    bullet4text:
      "Çok yakında evet. İçerik üreticilerinin dislike sayıları için doğrulanabilirliğini paylaşabilmeleri amacıyla Oauth ya da sınırlı bir kapsamda farklı bir salt okunur API kullanmayı düşünüyoruz.",
    bullet5: "Hangi verileri topluyorsunuz ve bunlar nasıl işleniyor?",
    bullet5text:
      "Uzantı, yalnızca izlediğiniz videonun IP adresi veya videonun ID'si gibi düzgün çalışması için kesinlikle gerekli olan verileri toplar. Verileriniz asla 3. taraflara satılmayacaktır. Güvenliği ve gizliliği nasıl ele aldığımız hakkında daha fazla bilgi için <a href=\"https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md\">security FAQ</a>'ya gidin.",
    bullet6: "API/Backend nasıl çalışıyor?",
    bullet6text:
      "Yazılım, YouTube API'sinin dislike sayısını ve uzantı kullanıcılarının like/dislike sayısı sonuçların genişletilmesinin döndürmeye devam ettiği zamana ait arşivlenmiş verileri kullanır. Yakın zamanda içerik üreticilerin dislike sayısını kolay ve güvenli bir şekilde göndermelerine izin vereceğiz ve ArchiveTeam'in arşivlenmiş verilerini (4,56 milyar video) veri tabanımıza ekleyeceğiz. Ayrıca konu ile ilgili videoyu da izleyebilirsiniz.",
    bullet7: "Dislike sayısı neden 'DISLIKE'LAR KAPALI' olarak gözüküyor?",
    bullet7text:
      "Yazma sırasında like ve dislike sayısını devre dışı bırakan videoların dislike sayılarını göstermiyoruz. Uzantı, bu videolar için 'DISLIKE'LAR KAPALI' mesajını görüntüler. Yakında tüm videolarda dislike sayısını göstereceğiz. Bu, yalnızca geçici bir çözümdür. Bu nedenle insanlar uzantının bozuk olduğunu düşünmez (zaten iyi çalışmıyor). Bazen yakın zamanda yüklenen bir videoda, içerik üreticisi onu devre dışı bırakmamış olsa bile 'DISLIKE'LAR KAPALI' olarak gözükebilir. Bunun nedeni, dislike sayısını devre dışı bırakıp bırakmadığını tespit etmemizdir. Birkaç saat içinde videoyu like ya da dislike atarsanız veya sayfayı yenilerseniz kaybolması gerekir (umarız).",
  },
  donate: {
    name: "Bağış Yap",
    subtitle:
      "İnterneti özgür bırakma çabamızda bize bağışınızla destek olabilirsiniz!",
  },
  links: {
    name: "Bağlantılar",
    title: "Proje Bağlantıları",
    subtitle: "Projeye ve geliştiricilerine bağlantılar",
    contact: "Bana Ulaşın",
    translators: "Çevirmenler",
    coolProjects: "Havalı Projeler",
    sponsorBlockDescription: "Videolara gömülü reklamları pas geçer",
    filmotDescription: "YouTube videolarını alt yazılara göre aramanızı sağlar",
  },
};
