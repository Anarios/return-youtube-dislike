[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Baca ini dibahasa lain: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [Magyar](READMEhu.md), [Danish](READMEda.md)
# Return YouTube Dislike

<p align="center">
    <b>Return Youtube Dislike adalah extension open-source yang memunculkan jumlah dislike di Youtube.<br>
    Juga ada pada browser lain sebagai JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Latar Belakang

Pada 10 November 2021, Google [memberitakan](https://blog.youtube/news-and-events/update-to-youtube/) bahwa jumlah dislike di Youtube akan dihapus.

Serta, data `dislike` pada API Youtube juga [dihapus](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) pada 13 Desember 2021, sehingga menghilangkan kemampuan untuk menilai qualitas konten video sebelum ditonton.

## Apa yang terjadi

Dengan dihapusnya data dislike dari API Youtube, kami mengubah backend kami sehingga menggunakan kombinasi scraping data dislike, dan estimasi perkiraan dari data pengguna.

[Pertanyaan yang Sering Ditanyakan](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQid.md)

## Mengapa ini Penting

Kamu bisa mempelajari lebih lanjut pada website kami di: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Dokumentasi API

Penggunaan pada pihak ketiga terhadap API ini diizinkan dengan beberapa batasan berikut:

- **Pereferensian**: Proyek ini harus jelas direferensikan menggunakan link ke [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Batas Penggunaan**: Terdapat batas penggunaan pada setiap client yaitu 100 per menit dan 10,000 per hari. Jika lebih dari ini, akan ada kode status _429_ yang menandakan kamu harus berhenti menggunakannya.

APInya bisa diakses melalui URL berikut:
https://returnyoutubedislikeapi.com

Daftar semua endpoint yang ada:
https://returnyoutubedislikeapi.com/swagger/index.html

### Voting

Contoh untuk melakukan voting terhadap suatu video Youtube menggunakan id:
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

Akan muncul kode status _404_ "Not Found" jika Youtube id tidak ditemukan.
Akan muncul kode status _400_ "Bad Request" jika Youtube id memiliki format yang salah.

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Kontribusi

Tolong baca [panduan kontribusi](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGid.md).

## Dukung proyek ini!

Kamu dapat mendukung proyek ini dengan cara donasi melalui link dibawah ini:

[Donasi](https://returnyoutubedislike.com/donate)

## Sponsor

[Menjadi sponsor kami](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
