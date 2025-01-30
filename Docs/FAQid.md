Baca ini dibahasa lain: [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md), [Português do Brasil](FAQpt_BRmd)


# Pertayaan yang Sering Ditanyakan

## Sebelum bertanya di GitHub atau Discord, tolong lihat halaman ini.

<br>

### **1. Darimana extension ini mendapatkan datanya?**

Kombinasi dari API Google dan scraping data.

Kami telah menyimpan semua data yang ada kedalam DB agar datanya tetap ada meskipun setelah Google menghapus jumlah dislike dari API mereka.

<br>

### **2. Jumlah dislike video tidak update**


Sekarang jumlah dislike video dicache, dan tidak update selalu.
Sekali setiap 2-3 hari, tidak lebih dari itu.

Benar, itu tidak ideal, tapi inilah yang bisa kami lakukan dan kami sedang melakukan improvisasi agar dapat melakukan update sesering mungkin.

<br>

### **3. Bagaimana cara kerjanya?**

Extension mengumpulkan id dari video yang sedang ditonton, mengambil data dislike (dan lainnya seperti jumlah views, likes, dll) menggunakan API kami, jika video ini pertama kali diambil datanya menggunakan API kami, API yang digunakan akan diubah ke API Youtube untuk mengambil datanya dan datanya akan disimpan kedalam database kami untuk dilakukan cache (untuk 2-3 hari) yang bertujuan untuk pengarsipan data dan datanya dikembalikan ke kamu. Lalu extension akan menampilkan jumlah dislike ke kamu.

<br>

### **4. Apa yang akan terjadi setelah API Youtube menghapus jumlah dislike?**

Bagian backend akan berganti dengan menggunakan kombinasi dari data arsip dislike, estimasi perkiraan dari pengguna, dan estimasi berdasarkan jumlah rasio view/like untuk video yang dislikenya tidak diarsip dan arsip dislike yang sudah tua.

<br>

### **5. Bagaimana cara menghitung jumlah dislike?**

RYD mernggunakan sistem voting dari pengguna untuk memperkirakan jumlah dislike.

- Jika video diupload setelah API dislike dihapus:

  $$ \textup{Jumlah RYD Dislike} = \left( \frac{\textup{Jumlah RYD Dislike Pengguna}}{\textup{Jumlah RYD Like Pengguna}} \right) \times \textup{Jumlah Public Like Publik} $$

- Jika entah bagaimana Database RYD memiliki data jumlah asli dari like dan dislike (diberikan dari pengupload atau arsip), jumlah dislike akan dihitung berdasarkan jumlah voting dari pengguna dan arsip. Semakin tua data arsip maka semakin sedikit pengaruhnya ke hasil akhir perhitungan dislike.

<br>

---

Berikut adalah form video

[![Mengenai IReturn YouTube Dislike](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Saya memiliki masalah keamanan/privasi

Lihat [halaman ini](SECURITY-FAQid.md) untuk informasi lebih lanjut.
