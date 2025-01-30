Baca ini dibahasa lain: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Deutsch](CONTRIBUTINGde.md)

# Selamat datang di petunjuk kontribusi Return Youtube Dislikes

Terima kasih telah menggunakan waktumu untuk berkontribusi pada proyek kami! Semua perubahan akan diaplikasikan pada versi extension selanjutnya (atau [website](https://www.returnyoutubedislike.com/)).

## Mula-mula

Tolong gunakan Prettier dengan setting bawaan untuk melakukan formatting.

#### Prerequisites

Kamu harus menginstall node dan npm untuk membuat versi bundled dari source code.

Versi yang digunakan:

- node: 12.18.4
- npm: 6.14.6

Untuk membuat `bundled-content-script.js` yang memiliki semua logic dari extension ini, kamu harus menginstall semua dependency terlebih dahulu.

1. Masuk ke root dari repo dan jalankan:

```
npm install
```

2. Jalankan command berikut untuk membuat `bundled-content-script.js` yang akan digunakan di `manifest.json`

```
npm start // untuk membuat build file dan menjalankan file watcher yang akan melakukan hot-reloads ketika menyimpan.

// atau

npm run build // untuk membuat build file satu kali.
```

Selamat, kamu sekarang sudah siap untuk melakukan develop!

Jika kamu baru dalam melakukan develop extension Chrome, atau membutuhkan bantuan tambahan, tolong kunjungi [tutorial Youtube ini](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Issues

#### Membuat issue baru

Jika kamu menemuakan issue mengenai extension, tolong cari terlebih dahulu untuk memastikan issue tersebuat telah di laporkan. Jika belum, buat issue baru, direkomendasikan menggunakan form issue tapi tidak harus.

#### Menyelesaikan issue

Jika kamu menemukan issue yang dapat kamu selesaikan, jangan malu. Buat PR dan pastikan untuk mention issue yang sedang diperbaiki.

### Rqeust Fitur

#### Membuat request fitur

Jika kamu memiliki ide mengenai extension, silakan untuk membuat request fitur, tapi tolong cari terlebih dahulu untuk memastikan fitur tersebut belum direquest oleh orang lain. Direkomendasikan menggunakan form request fitur tapi tidak harus.

#### Implementasi request fitur

Jika kamu menemukan request fitur yang dapat kamu kerjakan, jangan malu. Buat PR dan pastikan untuk mention request fitur yang sedang dikerjakan.

### PR apa saja yang kami terima?

- Memperbaiki issue.
- Implementasi fitur.
- Typo atau improvisasi kata dan kalimat.
- Kontribusi website.
