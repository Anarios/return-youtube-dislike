Bunu diğer dillerde okuyun: [English](FAQ.md), [русский](FAQru.md), [Nederlands](FAQnl.md), [Français](FAQfr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md)

# Sıkça Sorulan Sorular

## GitHub'da veya Discord'da bir soru sormadan önce, lütfen buraya göz atın.

<br>

### **1. Bu uzantı verileri nereden alıyor?**

Google API'lerinin ve kazınmış verilerin bir kombinasyonu.

Google, API'lerinde dislike sayılarını kapattıktan sonra kullanılabilir olması için mevcut tüm verileri DB'mize kaydederiz.

<br>

### **2. Video'nun dislike sayısı güncellenmiyor**

Şu anda video dislike'ları önbelleğe alınır ve çok sık güncellenmez. Her 2-3 günde bir, daha sık değil.

Evet, ideal değil, ama olan bu. Bunları nasıl daha sık güncelleyebileceğimizi öğrenmeye çalışıyoruz.

<br>

### **3. Bu uzantı nasıl çalışıyor?**

Uzantı, izlediğiniz videonun video kimliğini alır, dislike'larını (ve görüntülemeleri, like'ları vb. diğer alanları) API'mizi kullanarak getirir; video, API'miz tarafından ilk kez getiriliyorsa YouTube API'sini kullanır. Verileri almak için, verileri önbelleğe alma (yaklaşık 2-3 gün önbelleğe alınır) ve arşivleme amacıyla bir veritabanında saklanır ve size geri döndürülür. Uzantı daha sonra size dislike'ları gösterir.

<br>

### **4. YouTube API'si, dislike sayısını döndürmeyi durdurduğunda ne olacak?**

Backend, arşivlenmiş dislike istatistikleri, uzantı kullanıcı verilerinden tahmin edilen tahminler ve like'ları arşivlenmemiş videolar ve eski dislike arşivleri için izlenme/like oranlarına dayalı tahminlerin bir kombinasyonunu kullanmaya geçecektir.

<br>

### **5. Dislike sayısı nasıl hesaplanıyor?**

YDS, dislike sayısını tahmin etmek için kullanıcılarının oylarını kullanır.

- Video, API kapatıldıktan sonra yüklendiyse:

  $$ \textup{YDS'nin Dislike Sayısı} = \left( \frac{\textup{YDS Kullanıcılarının Like Sayısı}}{\textup{YDS Kullanıcılarının Dislike Sayısı}} \right) \times \textup{Halka Açık Like Sayısı} $$

- YDS veritabanı bir şekilde gerçek like ve dislike sayısına sahipse (yükleyici tarafından veya arşivden sağlanır), dislike sayısı hem kullanıcıların oyları hem de arşivlenen değer temelinde hesaplanacaktır. Arşivlenen değer, eskidikçe son sayım üzerinde daha az etkiye sahip olacaktır.

<br>

---

Bu video şeklinde

[![IReturn YouTube Dislike Explained](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Gizlilik / güvenlik hakkında endişelerim var

Daha fazla bilgi için [bu sayfa](SECURITY-FAQtr.md)ya göz atın.
