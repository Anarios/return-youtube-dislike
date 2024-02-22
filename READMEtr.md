[![Chrome Web Mağazası](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Mağazası Kullanıcıları](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla oylaması](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla indirmeleri](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit sayısı](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issue'lar](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![Lisans](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Bunu diğer dillerde okuyun: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Français](READMEfr.md), [Nederlands](READMEnl.md), [日本語](READMEja.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# YouTube Dislike Sayısını Geri Getir

<p align="center">
    <b>YouTube Dislike Sayısını Geri Getir, YouTube'daki dislike sayısını gösteren açık-kaynaklı bir uzantıdır.</b><br>
    Chrome ve Firefox'da bir Web Uzantısı olarak mevcuttur.<br>
    Ayrıca diğer tarayıcılar için JS Userscript olarak da mevcuttur.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Hikâyesi

10 Kasım 2021 tarihinde Google, YouTube dislike sayısının kaldırılacağını [duyurdu](https://blog.youtube/news-and-events/update-to-youtube/).

Ek olarak, YouTube API'sindeki `dislike` alanı 13 Aralık 2021 tarihinde [kaldırıldı](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) ve içeriğin kalitesini izlemeden önce yargılayabilme olanağı ortadan kaldırıldı.

## Ne İşe Yarar

YouTube API'sinden dislike istatistiklerinin kaldırılmasıyla, backend'imiz, uzantı kullanıcı verilerinden tahmin edilen, toplanmış dislike istatistiklerinin bir birleşimini kullanmaya başladı.

[SSS](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQtr.md)

## Neden Önemlidir

Sitemizden daha fazla bilgi edinebilirsiniz: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API Belgelemesi

Bu açık API'nin üçüncü taraflarca kullanımına, aşağıdaki kısıtlamalarla izin verilir:

- **Atfetme**: Bu proje, açık bir biçimde [returnyoutubedislike.com](https://returnyoutubedislike.com/) adresine yönlendirilmelidir.
- **Hız Sınırlaması**: Kullanıcı başına dakikada 100 ve günde 10.000 hız sınırlaması vardır. Bu, uygulamanızın geri çekilmesi gerektiğini belirten _429_ durum kodunu döndürür.

API'ye aşağıdaki temel URL üzerinden erişilebilir:
https://returnyoutubedislikeapi.com

Kullanılabilir endpoint'lerin bir listesi burada mevcuttur:
https://returnyoutubedislikeapi.com/swagger/index.html

### Oylamaları Elde Etme

Belirli bir YouTube video ID'sinin oylamalarını elde etmek için bir örnek:
`/votes?videoId=kxOuG8jMIgI`

```json
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2021-12-20T12:25:54.418014Z",
  "likes": 27326,
  "dislikes": 498153,
  "rating": 1.212014408444885,
  "viewCount": 3149885,
  "deleted": false
}
```

Hiçbir mevcut YouTube ID'si _404_ "Not Found" durum kodunu döndürmez.
Yanlış oluşturulmuş bir YouTube ID'si _400_ "Bad Request" durum kodunu döndürür.

<!---
## API Belgelemesi

Tüm belgelemeleri sitemizden inceleyebilirsiniz.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Katkıda Bulunma

Lütfen [katkı kılavuzu](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGtr.md)nu okuyun.

## Bu Projeyi Destekle!

Aşağıdaki bağlantıdan bize bağış yapabilir ve bu projeye destek olabilirsiniz:

[Bağış Yap](https://returnyoutubedislike.com/donate)

## Sponsorlar

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Sponsorumuz olun](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
