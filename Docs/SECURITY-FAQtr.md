Read this in other languages: [беларуская](SECURITY-FAQbe.md), [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY-FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md)

# Güvenlik

### İzleme geçmişimi takip ediyor musunuz?

Hayır. Uzantının kodu herkese açıktır ve kendiniz görebilirsiniz. Uzantı, dislike sayısını tahmin etmek ve bu tahmini iyileştirmek için açık olan videonun kimliğini ve varsa görüntülenen beğeni sayısını gönderir. İstek sırasında genel IP adresiniz ve istek zamanı gibi standart ağ bilgileri de sunucuya ulaşır. Uzantı, cihazınızda ayrı bir izleme geçmişi tutmaz. Firefox'ta video kimliği ve beğeni sayısı ancak her biri için izin verdikten sonra gönderilir.

### Bir videoya dislike atarsam, beni benzersiz bir şekilde tanımlayabilir misiniz?

İlk kez oy verdiğinizde veya bir RYD yorumuna tepki verdiğinizde uzantı, oylamanın kötüye kullanılmasını önlemeye yardımcı olmak için rastgele ve kalıcı bir kimlik oluşturur. Sadece bir video açmak ya da yorumları okumak bu kimliğin gönderilmesine yol açmaz. Bu kimlik Google veya YouTube hesabınızdan türetilmez ve bu hesaplarla bağlantılı değildir. Mozilla kalıcı kimlikleri kişisel veri olarak sınıflandırır. Hizmet, gönderilen oyları aynı uzantı kurulumuyla ilişkilendirmek için bu kimliği kullanır.

### Tam olarak hangi bilgilere sahipsiniz, gerçekten?

Dislike sayısı istekleri video kimliğini ve varsa görüntülenen beğeni sayısını içerir. Kayıt sırasında uzantı kurulumuna ait rastgele bir kimlik kullanılır. Oylar bu kimlik, video kimliği, oy tercihi ve oy verme zamanı ile kaydedilir. RYD yorumlarına verilen tepkilerde aynı kurulum kimliği, yorum kimliği ve seçilen tepki kullanılır. Oy ve tepki kayıtları hangi uzantıyı veya kullanıcı betiğini kullandığınızı, sürümünü ve varsa tıkladığınız andaki oynatma konumunu (tam saniye cinsinden) da içerebilir. Bir tepkiyi geri aldığınızda, o tepkinin kaydı kaldırılmış olarak işaretlenir. RYD'de yayımladığınız yorumlar ve yanıtlar RYD takma adınızla herkese açık olarak görünür. Uzantı, YouTube hesap adınızı veya YouTube'daki yorumlarınızı göndermez.

### IP adresim nasıl saklanıyor?

Hizmet, IP adresinizi ve istekte varsa tarayıcınızı tanımlayan User-Agent dizesini saklar. Bu bilgiler tamamlanmış kayıt işlemleri, oylar, yayımlanan yorumlar ve yanıtlar ile RYD yorumlarına verilen tepkilerle birlikte saklanır. IP adresleri kötüye kullanımı önlemek ve toplu istatistikler oluşturmak için kullanılır. IP adresleri satılmaz ve reklam amacıyla kullanılmaz.

### OAuth üzerinden YouTube hesabıma erişmek konusunda bazı tartışmalar duydum!

Bu özellik isteğe bağlı olacak ve çok fazla tercih edilecek. Bir YouTube içerik üreticisiyseniz ve dislike istatistiklerinizi bizimle paylaşmak istiyorsanız, bunu yapabilirsiniz. [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) yapılandırılma şekli, aslında çok güvenlidir. Hesabınıza erişimi istediğiniz zaman iptal edebilir ve bize çok özel izinler verebilirsiniz. Gerekli olmayan herhangi bir izini istemeyeceğiz. Yalnızca video istatistiklerinizi görüntülemek için izin isteyeceğiz.

### Bu dislike sayısına nasıl güvenebilirim?

Bot saldırılarını önlemek için önlemler aldık ve bot önleme sisteminin etkinliğini arttırmak için çalışmaya devam edeceğiz: bu, dislike sayısını gerçek sayının iyi bir temsilcisi olarak tutmamıza yardımcı olacaktır. Tabii ki hiçbir zaman %100 doğru olmayacaktır, bu yüzden sayıma güvenip güvenmemek size kalmıştır.

### Neden backend kodunu paylaşmıyorsunuz?

Bir noktada paylaşacağız - ama şu anda paylaşmak için ortada gerçekten gerçek bir sebep yok. Yanlış bir güvenlik hissi verebilir - çünkü sıfır güvenli bir sistemde, bir sürümü ifşa edebilir, ancak bir başkasını devreye alabiliriz. Özellikle spam ile nasıl mücadele ettiğimiz gibi, kodu gizli tutmak için birçok neden vardır. İstenmeyen posta işleme kodunu örtmek/gizlemek oldukça standart bir uygulamadır.
