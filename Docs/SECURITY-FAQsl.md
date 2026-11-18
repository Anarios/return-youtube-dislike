Preberite to v drugih jezikih: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY-FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY_FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Slovenščina](SECURITY-FAQsl.md), [Tiếng Việt](SECURITY-FAQvi.md), [беларуская](SECURITY-FAQbe.md)

# Varnost

### Ali sledite moji zgodovini ogledov?

Razširitev pošlje ID trenutnega videa in, kadar je na voljo, njegovo vidno število všečkov API-ju Return YouTube Dislike,
ker ju strežnik potrebuje za vrnitev in izboljšanje ocene nevšečkov. Zahteva razkrije tudi običajne omrežne
metapodatke, kot sta javni naslov IP in čas zahteve. Razširitev ne pošilja imena vašega računa na YouTubu,
komentarjev, zasebnih podatkov z YouTuba ali vsebine nepovezanih strani in ne vodi ločenega lokalnega seznama
zgodovine ogledov.

### Ali me lahko enolično prepoznate, če dam nevšeček?

Razširitev ustvari trajen naključni ID za oddajo glasov, odporno proti zlorabam. Ni izpeljan iz vašega Googlovega
ali YouTubovega računa in ni povezan z njim, vendar Mozilla trajne identifikatorje uvršča med osebne podatke. ID
storitvi omogoča, da oddane glasove poveže z isto namestitvijo razširitve.

### Katere podatke imate, natančno?

Pri zahtevi za število nevšečkov razširitev pošlje ID videa in, kadar je na voljo, prikazano število všečkov.
Pri registraciji uporabi naključni ID namestitve. Ob glasovanju storitev s tem ID-jem shrani ID videa, izbrani glas
in čas. Ob odzivu na komentar RYD z istim ID-jem shrani ID komentarja in izbrani odziv. Glas ali odziv lahko vsebuje
tudi vrsto in različico razširitve ali uporabniškega skripta ter položaj predvajanja v celih sekundah ob kliku, če je
ta podatek na voljo. Ko odziv odstranite, ga storitev v zapisu označi kot odstranjenega. Vaši komentarji in odgovori
so javni pod vašim vzdevkom RYD.

Izbirne premium funkcije uporabljajo ID računa, ime, e-poštni naslov, profilno sliko, podatke o
članstvu in žeton seje storitve, ki ga vrne prijava s Patreonom ali GitHubom, ki jo sproži uporabnik.

### Kako je shranjen moj naslov IP?

Storitev ob zaključenih registracijah, glasovih, objavljenih komentarjih in odgovorih ter odzivih na komentarje RYD
shrani vaš naslov IP. Če brskalnik z zahtevo pošlje tudi svoj opis (niz User-Agent), shrani še tega. Naslove IP
uporabljamo za preprečevanje zlorab in zbirno statistiko. Ne prodajamo jih in jih ne uporabljamo za oglaševanje.

### Slišal sem nekaj razprav o protokolu OAuth in dostopu do mojega računa na YouTubu!

Prijava v premium analitiko je izbirna in se začne šele, ko uporabnik v razširitvi izbere prijavo s Patreonom ali GitHubom.
Postopek OAuth vrne podatke o računu in žeton seje Return YouTube Dislike, ki se uporablja za overjanje premium zahtev
API-ja.
Firefox pred začetkom prometa, povezanega z računom, zahteva ločeno privolitev za podatke za overjanje. Z odjavo se
shranjeni podatki o računu in seja odstranijo iz razširitve. Preklic Firefoxovega dovoljenja za podatke za overjanje prav tako počisti
sejo računa in prepreči nadaljnji promet, povezan z računom, dokler znova ne date privolitve in se ne prijavite. Sinhronizacija
brskalnika lahko, kadar je omogočena, sinhronizira identifikator namestitve, nastavitve in sejo računa.

### Kako lahko zaupam temu številu nevšečkov?

Uvedli smo ukrepe za preprečevanje napadov botov in bomo še naprej izboljševali učinkovitost sistema za preprečevanje botov: to nam bo pomagalo ohranjati število nevšečkov kot dober približek dejanskega števila. Seveda ne bo nikoli 100-odstotno natančno, zato se sami odločite, ali številu zaupate ali ne.

### Zakaj ne objavite kode zaledja?

Nekoč jo bomo objavili, a zdaj za to res ni pravega razloga. Objava daje lažen občutek varnosti – v sistemu brez zaupanja bi lahko razkrili eno različico, uvedli pa povsem drugo. Obstaja veliko razlogov, da koda ostane skrita, predvsem to, kako se borimo proti neželeni vsebini. Skrivanje oziroma zakrivanje kode za obravnavo neželene vsebine je precej ustaljena praksa.
