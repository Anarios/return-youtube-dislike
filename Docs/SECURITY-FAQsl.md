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

Pri zahtevah za število nevšečkov: ID trenutnega videa in, kadar je na voljo, vidno število všečkov. Pri registraciji in
oddaji glasov: naključni uporabniški ID razširitve, ID videa, izbrani glas, časovni žig in omrežni naslov, uporabljen za
nadzor nad zlorabami. Izbirne premium funkcije uporabljajo ID računa, ime, e-poštni naslov, profilno sliko, podatke o
članstvu in žeton seje storitve, ki ga vrne prijava s Patreonom ali GitHubom, ki jo sproži uporabnik. Pri različici 4.0.6 in
pripadajoči izdaji zaledja se dostop prek Patreona določi iz trenutno dodeljenih ID-jev stopenj, ne iz finančnih podatkov.

### Kako je shranjen moj naslov IP?

API ob vsaki zahtevi prejme vaš omrežni naslov. Potrjeni zapisi glasov ohranijo uporabljeni omrežni naslov zaradi
preprečevanja zlorab in združene analitike. Naslova ne prodajamo in ga ne uporabljamo za oglaševanje.

### Slišal sem nekaj razprav o protokolu OAuth in dostopu do mojega računa na YouTubu!

Prijava v premium analitiko je izbirna in se začne šele, ko uporabnik v razširitvi izbere prijavo s Patreonom ali GitHubom.
Postopek OAuth vrne podatke o računu in žeton seje Return YouTube Dislike, ki se uporablja za overjanje premium zahtev
API-ja. Pri različici 4.0.6 in pripadajoči izdaji zaledja se upravičenost prek Patreona določi iz trenutno dodeljenih ID-jev stopenj;
storitev ne zahteva in ne uporablja zneskov članstva, datumov ali stanja bremenitev, skupnega zneska vseh dosedanjih plačil ali statusa podpornika.
Firefox pred začetkom prometa, povezanega z računom, zahteva ločeno privolitev za podatke za overjanje. Z odjavo se
shranjeni podatki o računu in seja odstranijo iz razširitve. Preklic Firefoxovega dovoljenja za podatke za overjanje prav tako počisti
sejo računa in prepreči nadaljnji promet, povezan z računom, dokler znova ne date privolitve in se ne prijavite. Sinhronizacija
brskalnika lahko, kadar je omogočena, sinhronizira identifikator namestitve, nastavitve in sejo računa.

### Kako lahko zaupam temu številu nevšečkov?

Uvedli smo ukrepe za preprečevanje napadov botov in bomo še naprej izboljševali učinkovitost sistema za preprečevanje botov: to nam bo pomagalo ohranjati število nevšečkov kot dober približek dejanskega števila. Seveda ne bo nikoli 100-odstotno natančno, zato se sami odločite, ali številu zaupate ali ne.

### Zakaj ne objavite kode zaledja?

Nekoč jo bomo objavili, a zdaj za to res ni pravega razloga. Objava daje lažen občutek varnosti – v sistemu brez zaupanja bi lahko razkrili eno različico, uvedli pa povsem drugo. Obstaja veliko razlogov, da koda ostane skrita, predvsem to, kako se borimo proti neželeni vsebini. Skrivanje oziroma zakrivanje kode za obravnavo neželene vsebine je precej ustaljena praksa.
