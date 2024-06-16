Read this in other languages: [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md)

# Güvenlik

### İzleme geçmişimi takip ediyor musunuz?

Hayır. Uzantının kodu herkese açıktır ve kendiniz görebilirsiniz. Gönderilen tek bilgi, videolar için dislike sayısını almak için gereken video kimliğidir. Gönderilen başka bir ek header yoktur. İletişim katmanı üzerinden, genel IP'niz sunucuya ve isteğin yapıldığı zamana maruz kalacaktır. Ancak, bunların hiçbiri sizi hiçbir şekilde benzersiz bir şekilde tanımlamıyor. Sıfır güven ortamını varsayarsak, elde edebileceğimizin en iyisi dinamik bir IP'dir. Ki, bu IP bugün sizin, yarın komşunuzun olabilir. IP'nizin izlenmesinden gerçekten endişeleniyorsanız, muhtemelen zaten bir VPN kullanıyorsunuzdur.

### Bir videoya dislike atarsam, beni benzersiz bir şekilde tanımlayabilir misiniz?

Evet. Bir videoya dislike attığınızda, sizin için Google hesabınızla bağlantılı olmayan rastgele oluşturulmuş benzersiz bir kimlik oluştururuz. Bu, bot kullanılmasını önlemek için yapılır. Ancak bu rastgele kimliği, size veya kişisel YouTube hesabınıza bağlamanın bir yolu yoktur.

### Tam olarak hangi bilgilere sahipsiniz, gerçekten?

Sadece video ID'si. Yorumlarınızı değil, kullanıcı adınızı değil, videoyu kiminle paylaştığınız değil, ek meta verilerinden hiçbiri değil. Hiç bir şey. Sadece video ID'si.

### IP adresim nasıl saklanıyor?

Backend, karma olmayan IP adreslerini yalnızca geçici bellekte (RAM'de) tutar. Bu adresler, bir sabit sürücüde depolanmaz ve bu nedenle günlüğe kaydedilmez. IP adreslerini hash ederiz ve bunun yerine depolanır. Bu, veri tabanı vandalizmini önlemek için yapılır.

### OAuth üzerinden YouTube hesabıma erişmek konusunda bazı tartışmalar duydum!

Bu özellik isteğe bağlı olacak ve çok fazla tercih edilecek. Bir YouTube içerik üreticisiyseniz ve dislike istatistiklerinizi bizimle paylaşmak istiyorsanız, bunu yapabilirsiniz. [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) yapılandırılma şekli, aslında çok güvenlidir. Hesabınıza erişimi istediğiniz zaman iptal edebilir ve bize çok özel izinler verebilirsiniz. Gerekli olmayan herhangi bir izini istemeyeceğiz. Yalnızca video istatistiklerinizi görüntülemek için izin isteyeceğiz.

### Bu dislike sayısına nasıl güvenebilirim?

Bot saldırılarını önlemek için önlemler aldık ve bot önleme sisteminin etkinliğini arttırmak için çalışmaya devam edeceğiz: bu, dislike sayısını gerçek sayının iyi bir temsilcisi olarak tutmamıza yardımcı olacaktır. Tabii ki hiçbir zaman %100 doğru olmayacaktır, bu yüzden sayıma güvenip güvenmemek size kalmıştır.

### Neden backend kodunu paylaşmıyorsunuz?

Bir noktada paylaşacağız - ama şu anda paylaşmak için ortada gerçekten gerçek bir sebep yok. Yanlış bir güvenlik hissi verebilir - çünkü sıfır güvenli bir sistemde, bir sürümü ifşa edebilir, ancak bir başkasını devreye alabiliriz. Özellikle spam ile nasıl mücadele ettiğimiz gibi, kodu gizli tutmak için birçok neden vardır. İstenmeyen posta işleme kodunu örtmek/gizlemek oldukça standart bir uygulamadır.
