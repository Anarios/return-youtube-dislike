Bunu diğer dillerde okuyun: [English](CONTRIBUTING.md), [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Deutsch](CONTRIBUTINGde.md)

# "YouTube Dislike Sayısını Geri Getir"in katkı kılavuzuna Hoş Geldiniz

Projemize katkıda bulunmak için zaman ayırdığınız için teşekkür ederiz! Tüm değişiklikleriniz, uzantının bir sonraki sürümüne (veya [internet sitesi](https://www.returnyoutubedislike.com/)ne) yansıtılacaktır.

## Başlarken

Lütfen formatlama işlemi için, Prettier'i varsayılan ayarlardayken kullanın.

#### Ön Şartlar

Kaynağın paketlenmiş sürümünü oluşturmak için node ve npm'nin kurulu olması gerekir.

Kurulum sırasında kullanılan sürümler:

- node: 12.18.4
- npm: 6.14.6

Bu uzantının iş mantığının çoğunu içeren `bundled-content-script.js`yi oluşturmak için, önce tüm bağımlılıkları yüklemeniz gerekir.

1. Deponun köküne gidin ve şu komutu çalıştırın:

```
npm install
```

2. `manifest.json` içinde kullanılan `bundled-content-script.js` dosyasını oluşturmak için aşağıdaki komutu çalıştırın.

```
npm start // derleme dosyasının/dosyalarının oluşturulması ve kaydedilmesi sırasında çalışırken yeniden yüklenen bir dosya izleyicisini başlatmak için

// ya da

npm run build // derleme dosyasını/dosyalarını bir kez oluşturmak için
```

Tebrikler, artık geliştirmeye hazırsınız!

Chrome uzantıları geliştirme konusunda yeniyseniz veya fazladan yardıma ihtiyacınız olursa lütfen [bu YouTube öğreticisi](https://www.youtube.com/watch?v=mdOj6HYE3_0)ne bakın.

### Issue'lar

#### Yeni bir issue başlatmak

Uzantıyla ilgili herhangi bir sorununuz varsa, sorunun önceden bildirilmediğinden emin olmak için lütfen arama yapın. Eğer daha önce bildirilmediyse, bir konu açın. Sorun formunu kullanmanız şiddetle tavsiye edilir ancak zorunlu değildir.

#### Bir issue'yu çözmek

Çözebileceğinizi düşündüğünüz bir sorun bulduysanız, çekinmeyin. Düzeltmeyi içeren bir PR açın ve düzelttiğiniz sorunu belirttiğinizden emin olun.

### Özellik Talebi

#### Yeni bir özellik talebi açmak

Uzantı hakkında bir fikriniz varsa, bir özellik isteği açmaktan çekinmeyin, ancak özelliğin daha önce önerilmediğinden emin olmak için lütfen önce arama yapın. Özellik formunun kullanılması şiddetle tavsiye edilir ancak zorunlu değildir.

#### Bir özellik isteğini uygulamak

Uygulayabileceğinizi düşündüğünüz bir özellik bulduysanız, çekinmeyin. Düzeltmeyi içeren bir PR açın ve uyguladığınız özelliği belirttiğinizden emin olun.

### Hangi tür PR'leri kabul ediyoruz?

- Sorun düzeltmeleri.
- Özellik uygulaması.
- Yazım hataları veya daha anlaşılabilir ve kullanımı daha kolay kelimeler.
- Site katkıları.
