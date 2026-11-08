Prečítajte si to v iných jazykoch: [English](FAQ.md), [فارسی](FAQfa.md), [беларуская](FAQbe.md), [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md), [Português do Brasil](FAQpt_BR.md), [العربية](FAQar.md), [Bahasa Indonesia](FAQid.md), [中文](FAQcn.md), [български](FAQbg.md), [Tiếng Việt](FAQvi.md), [Slovenščina](FAQsl.md), [Slovenčina](FAQsk.md)

# Často kladené otázky

## Skôr než položíte otázku na GitHube alebo Discorde, pozrite si, prosím, túto stránku.

<br>

### **1. Odkiaľ rozšírenie berie údaje?**

Z kombinácie rozhraní API od Googlu a získaných (scrapovaných) údajov.

Všetky dostupné údaje ukladáme do našej databázy, aby boli k dispozícii aj po tom, čo Google z API odstráni počty dislajkov.

<br>

### **2. Počet dislajkov pri videu sa neaktualizuje**

Počty dislajkov pri videách sa momentálne ukladajú do vyrovnávacej pamäte a neaktualizujú sa príliš často – raz za 2 – 3 dni, nie častejšie.

Áno, nie je to ideálne, ale je to tak. Pracujeme na tom, aby sme ich mohli aktualizovať častejšie.

<br>

### **3. Ako to funguje?**

Rozšírenie zistí ID videa, ktoré pozeráte, a cez naše API načíta počet dislajkov (a ďalšie údaje, napríklad zhliadnutia či lajky). Ak naše API načítava video prvý raz, získa údaje z YouTube API a uloží ich do databázy – na ukladanie do vyrovnávacej pamäte (približne na 2 – 3 dni) aj na archiváciu – a potom vám ich vráti. Rozšírenie vám následne zobrazí dislajky.

<br>

### **4. Čo sa stane, keď YouTube API prestane vracať počet dislajkov?**

Backend prejde na kombináciu archivovaných štatistík dislajkov, odhadov extrapolovaných z údajov od používateľov rozšírenia a odhadov podľa pomeru zhliadnutí a lajkov. Tie použije pri videách, ktorých dislajky sa nearchivovali, a pri zastaraných archívoch dislajkov.

<br>

### **5. Ako sa počíta počet dislajkov?**

RYD odhaduje počet dislajkov z hlasov svojich používateľov.

- Ak bolo video nahrané po vypnutí API:

  $$ \textup{Počet dislajkov RYD} = \left( \frac{\textup{Počet dislajkov od používateľov RYD}}{\textup{Počet lajkov od používateľov RYD}} \right) \times \textup{Verejný počet lajkov} $$

- Ak databáza RYD nejakým spôsobom získala skutočný počet lajkov a dislajkov (od autora videa alebo z archívu), počet dislajkov sa vypočíta z oboch zdrojov – z hlasov používateľov aj z archivovanej hodnoty. S pribúdajúcim vekom má archivovaná hodnota na výsledný počet čoraz menší vplyv.

<br>

---

To isté vo forme videa

[![Return YouTube Dislike – vysvetlenie](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Mám obavy o bezpečnosť alebo súkromie

Viac informácií nájdete na [tejto stránke](SECURITY-FAQsk.md).
