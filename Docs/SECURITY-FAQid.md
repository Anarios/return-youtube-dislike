Baca ini dibahasa lain: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md)

# Keamanan

### Apakah kalian melacak riwayat video yang saya tonton?

Tidak, Kode extension bersifat publik dan kamu dapat melihatnya sendiri. Informasi yang kami ambil hanya id dari video, yang diperlukan untuk pengambilan jumlah dislike. Tidak ada tambahan data headers lainnya. Pada communication layer, IP Publik kamu akan terekspos ke server, bersamaan dengan waktu ketika requestnya dibuat. Meskipun begitu, data ini tidaklah bersifat unik atau mengidentifikasikan kamu dalam bentuk apapun. Asumsikan environment yang tidak terpercaya, hal terbaik yang dapat kami ambil adalah IP dinamis. Yang bisa saja hari ini adalah milikmu, besok milik tetanggamu. Jika kamu merasa khawati jika IP-mu dilacak, kamu mungkin telah menggunakan VPN.

### Bisakah kalian mengidentifikasi saya ketika saya dislike suatu video?

Iya. Ketika kamu dislike suatu video, kami membuat id yang digenerate secara acak untukmu yang tidak ada hubungannya dengan akun Google. Ini dilakukan untuk menghindari bot. Tapi tidak mungkin untuk mencari kamu atau akun Youtube-mu menggunakan id acak ini.

### Informasi apa saja yang kalian punya?

Hanya id dari video. Bukan komentarmu, bukan usernamemu, bukan siapa saja orang yang pernah kamu kirimkan video, bukan metadata tambahan. Tidak ada. Hanya id dari video.

### Bagaimana IP saya disimpan?

Backend menyimpan alamat IP yang tidak di hash hanya di dalam RAM. Alamat ini tidak disimpan di hard drive, sehingga tidak di log. Kami melakukan hash terhadap alamat IP dan menyimpan yang itu. Ini dilakukan untuk mencegah perusakan database.

### Saya pernah mendengar diskusi mengenai OAuth, dan akses ke akun Youtube saya!

Fitur ini bersifat opsional, dan banyak yang berpartisipasi. Jika kamu merupakan seorang Youtuber, dan mau membagikan data dislikenya kepada kami, kamu bisa melakukannya. Dengan cara [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) yang terstruktur, dan sangat aman. Kamu dapat menghapus akses ke akunmu kapanpun, dan bisa menentukan data mana yang mau dibagikan dan tidak dibagikan secara spesifik. Kami tidak akan meminta izin apapun yang bersifat tidak wajib. Kami hanya akan meminta izin untuk melihat data video kamu.

### Bagaimana bisa saya percaya jumlah dislike ini?

Kami telah melakukan tidakan pencegahan dari penyerangan bot dan akan terus mengimprovisasi keefektifan sistem dari pecegahan bot tersebut: ini akan membantu kami menjaga jumlah dislike agar tetap bisa menjadi representasi dari jumlah yang asli. Tentu jumlahnya tidak akan akurat 100% jadi pada akhirnya itu semua terserah padamu untuk percaya atau tidak dengan jumlah dislikenya.

### Mengapa kamu tidak memberikan kode backend?

Kami akan memberikannya nanti pada satu waktu - tapi tidak ada alasan khusus untuk memberikanny sekarang. Itu memberikan rasa keamanan yang salah - karena pada sistem yang tidak terpercaya, kami bisa saja memberikan versi yang berdeda dengan yang kami deploy. Ada beberapa alsan lain untuk tetap menyembunyikan kodenya, terutama untuk memerangi spam. Menyembunyikan/menyamarkan kode penanganan spam adalah praktik yang cukup standar dilakukan.
