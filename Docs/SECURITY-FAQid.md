Baca ini dibahasa lain: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [Slovenščina](SECURITY-FAQsl.md)

# Keamanan

### Apakah kalian melacak riwayat video yang saya tonton?

Ekstensi mengirim ID video yang sedang kamu tonton dan, jika tersedia, jumlah like yang ditampilkan ke API Return YouTube
Dislike agar server dapat memberikan dan menyempurnakan perkiraan jumlah dislike. Permintaan itu juga mengungkapkan
metadata jaringan standar, seperti alamat IP publik dan waktu permintaan. Ekstensi tidak mengirim nama akun YouTube,
komentar YouTube, data pribadi di YouTube, atau isi halaman lain yang tidak berkaitan. Ekstensi juga tidak menyimpan
daftar riwayat tontonan tersendiri di perangkatmu. Di Firefox, ID video dan jumlah like masing-masing hanya dikirim
setelah kamu memberi izin.

### Bisakah kalian mengidentifikasi saya ketika saya dislike suatu video?

Saat pertama kali kamu memberi like atau dislike pada video atau bereaksi terhadap komentar RYD, ekstensi membuat ID acak
yang digunakan seterusnya untuk membantu mencegah penyalahgunaan. Ekstensi tidak mengirim ID ini saat kamu membuka video
atau membaca komentar. ID ini tidak berasal dari atau terhubung dengan akun Google atau YouTube kamu, tetapi Mozilla
menggolongkan ID persisten sebagai data pribadi. Layanan menggunakan ID ini untuk mengenali suara yang dikirim dari
pemasangan ekstensi yang sama.

### Informasi apa saja yang kalian punya?

Permintaan jumlah dislike berisi ID video dan, jika tersedia, jumlah like yang ditampilkan. Pendaftaran menggunakan ID
pemasangan yang dibuat secara acak. Suara yang dikirim dicatat bersama ID pemasangan, ID video, pilihan like atau dislike,
dan waktu pemberian suara. Reaksi terhadap komentar RYD dicatat bersama ID pemasangan yang sama, ID komentar, dan reaksi
yang kamu pilih. Catatan suara dan reaksi juga dapat menyertakan ekstensi atau userscript yang kamu pakai beserta versinya
dan, jika tersedia, posisi pemutaran saat kamu mengeklik, dalam detik tanpa pecahan. Saat kamu menarik reaksi, catatannya
ditandai sebagai dihapus. Komentar dan balasan yang kamu kirim dapat dilihat publik dengan nama panggilan RYD kamu.

### Bagaimana IP saya disimpan?

Layanan menyimpan alamat IP kamu dan, jika tersedia, informasi browser yang dikirim bersama permintaan (string user-agent).
Informasi ini disimpan bersama pendaftaran yang telah selesai, suara yang kamu kirim, komentar dan balasan yang telah
dipublikasikan, serta reaksi terhadap komentar RYD. Alamat IP digunakan untuk mencegah penyalahgunaan dan untuk analisis
agregat. Alamat IP tidak dijual atau digunakan untuk iklan.

### Saya pernah mendengar diskusi mengenai OAuth, dan akses ke akun Youtube saya!

Fitur ini bersifat opsional, dan banyak yang berpartisipasi. Jika kamu merupakan seorang Youtuber, dan mau membagikan data dislikenya kepada kami, kamu bisa melakukannya. Dengan cara [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) yang terstruktur, dan sangat aman. Kamu dapat menghapus akses ke akunmu kapanpun, dan bisa menentukan data mana yang mau dibagikan dan tidak dibagikan secara spesifik. Kami tidak akan meminta izin apapun yang bersifat tidak wajib. Kami hanya akan meminta izin untuk melihat data video kamu.

### Bagaimana bisa saya percaya jumlah dislike ini?

Kami telah melakukan tidakan pencegahan dari penyerangan bot dan akan terus mengimprovisasi keefektifan sistem dari pecegahan bot tersebut: ini akan membantu kami menjaga jumlah dislike agar tetap bisa menjadi representasi dari jumlah yang asli. Tentu jumlahnya tidak akan akurat 100% jadi pada akhirnya itu semua terserah padamu untuk percaya atau tidak dengan jumlah dislikenya.

### Mengapa kamu tidak memberikan kode backend?

Kami akan memberikannya nanti pada satu waktu - tapi tidak ada alasan khusus untuk memberikanny sekarang. Itu memberikan rasa keamanan yang salah - karena pada sistem yang tidak terpercaya, kami bisa saja memberikan versi yang berdeda dengan yang kami deploy. Ada beberapa alsan lain untuk tetap menyembunyikan kodenya, terutama untuk memerangi spam. Menyembunyikan/menyamarkan kode penanganan spam adalah praktik yang cukup standar dilakukan.
