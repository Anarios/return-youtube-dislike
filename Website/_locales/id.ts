import { id } from "vuetify/src/locale";

export default {
  ...id,
  home: {
    name: "Beranda",
    title: "Return YouTube Dislike",
    subtitle: "Extension browser dan API yang memunculkan jumlah dislike di Youtube",
    ukraine: "Dukung Ukraina",
    sponsors: "Sponsor",
  },
  install: {
    name: "Install",
    title: "Pilih Platform",
    subtitle: "Tersedia untuk Firefox dan semua browser Chromium",
    title2: "Platform Lainnya",
    subtitle2: "Jika kamu menggunakan browser yang belum support, coba gunakan UserScript",
    title3: "Implementasi Pihak Ketiga",
    subtitle3: "Kami tidak akan bertanggung jawab, gunakan dengan risiko sendiri",
  },
  api: {
    name: "API",
    title: "Selamat datang di dokumentasi ofisial RYD!",
    subtitle: "Mula-mula, pilih bagian dari menu.",
    rights: {
      title: "Hak Penggunaan",
      subtitle:
        "Penggunaan pada pihak ketiga terhadap API ini diizinkan dengan beberapa batasan berikut:",
      bullet1: "Pereferensian: ",
      bullet1text:
        "Proyek ini harus jelas direferensikan menggunakan link ke repo ini atau ke returnyoutubedislike.com",
      bullet2: "Batas Penggunaan: ",
      bullet2text:
        "Terdapat batas penggunaan pada setiap client yaitu 100 per menit dan 10,000 per hari. Jika lebih dari ini, akan ada kode status 429 yang menandakan kamu harus berhenti menggunakannya",
    },
    url: {
      title: "Informasi URL",
      subtitle: "APInya bisa diakses melalui URL berikut: ",
    },
    endpoints: {
      title: "Endpoint",
      subtitle: "Daftar semua endpoint yang ada: ",
    },
    fetching: {
      title: "Tutorial Fetching Sederhana",
      subtitle: "Contoh untuk melakukan voting terhadap suatu video Youtube menggunakan id: ",
      title2: "Contoh Request: ",
      url: "URL Request: ",
      method: "Metode Request: ",
      headers: "Header: ",
      response: "Respon: ",
      error1: 'Akan muncul kode status 404 "Not Found" jika Youtube id tidak ditemukan',
      error2:
        'Akan muncul kode status 400 "Bad Request" jika Youtube id memiliki format yang salah',
    },
  },
  help: {
    name: "Bantuan",
    title: "Troubleshooting",
    bullet1: "Pastikan kamu memiliki versi extension terbaru, ",
    bullet11: "sekarang",
    bullet2:
      "Coba hapus extension dan install ulang , lalu restart semua browser yang terbuka",
    bullet3: "Pastikan link berikut terbuka: ",
    bullet31: "kamu seharusnya dapat melihat teks berikut: ",
    bullet4: "Jika petunjuk sebelumnya masih belum membantu - laporkan masalah ini di",
    bullet41: "pada",
    bullet4a: "Beritahukan Sistem Operasi, Nama Browser, dan Versi Browser",
    bullet4b:
      "Tangkap layar halaman yang bermasalah (seperti halaman video Youtube) dengan membuka console (tekan ",
    bullet4b1: ") - contoh tangkapan layar seperti dibawah ini.",
    bullet4c:
      "Tangkap layar halaman extension browser kamu dengan extension yang telah terinstall.",
    bullet4c1: "Untuk melihat extension, masukkan ini pada address bar: ",
    firefox: "untuk Firefox",
    chrome: "untuk Chrome, Edge, Brave, Opera, dan Vivaldi",
  },
  faq: {
    name: "Pertanyaan",
    title: "Pertanyaan yang Sering Ditanyakan",
    subtitle: "Masih punya pertanyaan? Silakan gabung Discord!",
    bullet1: "Darimana extension ini mendapatkan datanya?",
    bullet1text:
      "Kombinasi data arsip dislike dari API ofisial Youtube sebelum dihapus, dan perkiraan perilaku pengguna extension.",
    bullet2: "Mengapa jumlah dislike video tidak update?",
    bullet2text:
      "Untuk sekarang, data dislike video di cache dan tidak selalu update. Bervariasi tergantung pada popularitas video dan dapat memakan waktu beberapa jam sampai beberapa hari untuk melakukan update.",
    bullet3: "Bagaimana cara kerjanya?",
    bullet3text:
      "Extension mengumpulkan id dari video yang sedang ditonton, mengambil data dislike (dan lainnya seperti jumlah views, likes, dll) menggunakan API kami. Lalu extension akan menampilkan jumlah dislike dan rasio pada halaman. Jika kamu melakukan like atau dislike pada suatu video, datanya disimpan ke database sehingga data dislike yang lebih akurat akan dapat diperkirakan.",
    bullet4: "Bisakah saya membagikan jumlah dislike saya kepada kalian?",
    bullet4text:
      "Nanti. Kami sedang mencari tahu Oauth atau perbedaan antara API yang hanya bisa dibaca dengan scope terbatas sehingga pada creator bisa membagikan jumlah dislike mereka yang terverifikasi.",
    bullet5: "Data apa saja yang kalian ambil dan apa yang terjadi kepada data tersebut?",
    bullet5text:
      'Extension hanya mengambil data yang diperlukan untuk berjalan seperti seharusnya, seperti alamat IP atau id dari video yang sedang ditonton. Tidak ada satupun data yang akan dijual ke pihak ketiga. Jika kamu mau tahu lebih lanjut bagaimana kami menangani keamanan dan privasi, tolong cek <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQid.md">pertanyaan mengenai keamanan</a>.',
    bullet6: "Bagaimana cara kerja API/backend?",
    bullet6text:
      "Backend menggunakan data arsip ketika Youtube masih memberikan data jumlah dislike, jumlah like/dislike dari pengguna extension, dan perkiraan. Pada waktu dekat kami akan mengizinkan creator untuk mengirimkan data jumlah dislike mereka secara mudah dan aman dan kami akan menambahkan data arsip dari ArchiveTeam (4.56 miliar video) kepada database kami. Kamu juga dapat melihat video pada topik.",
    bullet7: "Mengapa jumlah dislike memunculkan kata 'DISLIKES DISABLED'?",
    bullet7text:
      "Kadang-kadang video yang baru saja diupload akan memunculkan 'DISLIKES DISABLED' walaupun creatornya belum mematikannya. ini dikarenakan bagaimana cara kami melakukan pengecekan terhadap dislike yang dimatikan, ini akan hilang dalam beberapa jam atau dengan cara memberi like/dislike kepada video tersebut dan merefresh halamannya (semoga saja berhasil).",
  },
  donate: {
    name: "Donasi",
    subtitle:
      "Kamu dapat mendukung effort kami dengan donasi kalian!",
  },
  links: {
    name: "Link",
    title: "Link Proyek",
    subtitle: "Link menuju proyek dan para developer",
    contact: "Kontak Kami",
    translators: "Penerjemah",
    coolProjects: "Proyek Keren Lainnya",
    sponsorBlockDescription: "Lewati iklan yang ada pada video",
    filmotDescription: "Mencari video Youtube menggunakan subtitle",
  },
};
