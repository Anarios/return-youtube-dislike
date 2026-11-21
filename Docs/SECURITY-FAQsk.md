Prečítajte si to v iných jazykoch: [English](SECURITY-FAQ.md), [فارسی](SECURITY-FAQfa.md), [беларуская](SECURITY-FAQbe.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY-FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY_FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md), [Slovenčina](SECURITY-FAQsk.md)

# Bezpečnosť

### Sledujete moju históriu pozerania?

Rozšírenie posiela do API Return YouTube Dislike ID aktuálneho videa a – ak je k dispozícii – aj jeho viditeľný počet
lajkov, pretože server ich potrebuje, aby vrátil a spresnil odhad dislajkov. Požiadavka zároveň obsahuje bežné sieťové
metaúdaje, napríklad verejnú IP adresu a čas požiadavky. Rozšírenie neposiela názov vášho účtu YouTube, komentáre
na YouTube, súkromné údaje z YouTube ani obsah nesúvisiacich stránok a nevedie ani samostatný lokálny zoznam
pozretých videí. Vo Firefoxe sa ID videa aj počet lajkov posielajú až po tom, čo ich povolíte.

### Dokážete ma jednoznačne identifikovať, keď dám dislajk?

Keď prvý raz zahlasujete alebo zareagujete na komentár RYD, rozšírenie vytvorí trvalé náhodné ID, ktoré chráni
odosielanie hlasov pred zneužitím. Pri otváraní videí a čítaní komentárov sa neposiela. Nie je odvodené od vášho účtu
Google ani YouTube a nie je s ním prepojené, Mozilla však trvalé identifikátory považuje za osobné údaje. Vďaka tomuto
ID dokáže služba priradiť odoslané hlasy k tej istej inštalácii rozšírenia.

### Aké údaje presne máte?

Pri žiadosti o počet dislajkov rozšírenie odosiela ID videa a viditeľný počet lajkov, ak je k dispozícii. Pri registrácii
sa používa náhodné ID inštalácie. S týmto ID sa pri hlasovaní ukladá ID videa, zvolený hlas a čas. Pri reakcii na
komentár RYD sa s rovnakým ID ukladá ID komentára a zvolená reakcia. Hlas alebo reakcia môžu obsahovať aj typ a verziu
rozšírenia alebo používateľského skriptu a, ak je k dispozícii, pozíciu prehrávania v celých sekundách v okamihu
kliknutia. Ak reakciu odstránite, jej záznam sa označí ako odstránený. Vaše komentáre a odpovede sú verejné pod vašou
prezývkou RYD.

Voliteľné prémiové funkcie používajú ID účtu, meno, e-mailovú adresu, profilový obrázok, údaje o členstve a token relácie služby,
ktoré vráti prihlásenie cez Patreon alebo GitHub spustené používateľom. Vo verzii 4.1.0 a v príslušnom vydaní backendu
sa prístup cez Patreon určuje podľa ID úrovní, na ktoré má používateľ aktuálne nárok, a v prípade potreby aj podľa
aktuálnej výšky nároku a mesačnej či ročnej frekvencie členstva. Rozšírenie tieto údaje o výške a frekvencii nedostáva,
rovnako ako žiadne údaje o platobnej karte či bankovom účte.

### Ako ukladáte moju IP adresu?

Pri dokončených registráciách, hlasoch, uverejnených komentároch a odpovediach aj pri reakciách na komentáre RYD
služba ukladá vašu IP adresu. Ak prehliadač s požiadavkou odošle aj svoj opis (reťazec User-Agent), uloží sa spolu
s ňou. IP adresy používame na ochranu pred zneužitím a na súhrnné štatistiky. Nepredávame ich ani ich nepoužívame na reklamu.

### Počul som diskusie o OAuth a o prístupe k môjmu účtu YouTube!

Prihlásenie do prémiovej analytiky je voliteľné a začne sa až vtedy, keď si používateľ v rozšírení vyberie prihlásenie
cez Patreon alebo GitHub. Proces OAuth vráti údaje o účte a token relácie Return YouTube Dislike, ktorý slúži na overenie
požiadaviek na prémiové API. Vo verzii 4.1.0 a v príslušnom vydaní backendu sa oprávnenie cez Patreon určuje podľa ID
úrovní, na ktoré má používateľ aktuálne nárok, a v prípade potreby aj podľa aktuálnej výšky nároku a frekvencie
členstva. Služba nežiada dátumy ani stav platieb, celkové platby za celé obdobie ani stav patróna.
Firefox si pred začatím komunikácie s účtom vyžiada voliteľné povolenia „Overovacie údaje“ a „Osobné identifikačné
údaje“. Odhlásením sa z rozšírenia odstránia uložené údaje o účte aj relácia. Ak vo Firefoxe odoberiete povolenie na
overovacie údaje, relácia účtu sa tiež vymaže a ďalšia komunikácia s účtom bude zablokovaná, kým znova neudelíte súhlas
a neprihlásite sa. Ak je zapnutá synchronizácia prehliadača, môže synchronizovať identifikátor inštalácie, nastavenia
a reláciu účtu.

### Ako môžem tomuto počtu dislajkov dôverovať?

Zaviedli sme opatrenia proti útokom botov a ochranu pred nimi budeme ďalej zlepšovať. Vďaka tomu bude počet dislajkov
dobre zodpovedať skutočnosti. Na 100 % presný, samozrejme, nikdy nebude, takže je na vás, či mu dôverovať budete.

### Prečo nezverejníte kód backendu?

Raz ho zverejníme, ale teraz na to naozaj nie je dôvod. Dávalo by to falošný pocit bezpečia – v systéme bez dôvery
(zero-trust) by sme pokojne mohli zverejniť jednu verziu a nasadiť inú. Naopak, dôvodov kód nezverejňovať je dosť,
najmä spôsob, akým bojujeme proti spamu. Skrývať či zahmlievať kód, ktorý rieši spam, je bežná prax.
