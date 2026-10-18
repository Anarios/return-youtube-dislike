Preberite to v drugih jezikih: [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md), [Português do Brasil](FAQpt_BR.md), [العربية](FAQar.md), [Bahasa Indonesia](FAQid.md), [中文](FAQcn.md), [български](FAQbg.md), [Slovenščina](FAQsl.md), [Tiếng Việt](FAQvi.md), [беларуская](FAQbe.md)

# Pogosto zastavljena vprašanja

## Preden vprašanje zastavite na GitHubu ali Discordu, si oglejte to stran.

<br>

### **1. Od kod ta razširitev dobi podatke?**

Iz kombinacije Googlovih API-jev in postrganih podatkov.

Vse razpoložljive podatke shranjujemo v svojo zbirko podatkov, da bodo na voljo tudi potem, ko Google v svojem API-ju ukine število nevšečkov.

<br>

### **2. Število nevšečkov pri videu se ne posodablja**

Trenutno so nevšečki videov predpomnjeni in se ne posodabljajo zelo pogosto. Enkrat na 2–3 dni, ne pogosteje.

Res ni idealno, a je pač tako. Trudimo se, da bi jih lahko posodabljali pogosteje.

<br>

### **3. Kako to deluje?**

Razširitev zbere ID videa, ki ga gledate, in prek našega API-ja pridobi nevšečke (ter druga polja, kot so ogledi, všečki itd.). Če je to prvič, da je naš API pridobil ta video, bo podatke pridobil prek YouTubovega API-ja, jih zaradi predpomnjenja (za približno 2–3 dni) in arhiviranja shranil v zbirko podatkov ter vam jih vrnil. Razširitev vam nato prikaže nevšečke.

<br>

### **4. Kaj se bo zgodilo, ko YouTubov API ne bo več vračal števila nevšečkov?**

Zaledje bo prešlo na kombinacijo arhivirane statistike nevšečkov, ocen, ekstrapoliranih iz podatkov uporabnikov razširitve, ter ocen na podlagi razmerja med ogledi in všečki za videe, katerih nevšečki niso bili arhivirani, in za zastarele arhive nevšečkov.

<br>

### **5. Kako se izračuna število nevšečkov?**

RYD za ekstrapolacijo števila nevšečkov uporablja glasove svojih uporabnikov.

- Če je bil video naložen po ukinitvi API-ja:

  $$ \textup{Število nevšečkov RYD} = \left( \frac{\textup{Število nevšečkov uporabnikov RYD}}{\textup{Število všečkov uporabnikov RYD}} \right) \times \textup{Javno število všečkov} $$

- Če je zbirka podatkov RYD kljub temu imela dejansko število všečkov in nevšečkov (ki ga je posredoval nalagatelj ali izvira iz arhiva), se število nevšečkov izračuna na podlagi obojega – glasov uporabnikov in arhivirane vrednosti. Vpliv arhivirane vrednosti na končno število se s staranjem zmanjšuje.

<br>

---

To v obliki videa

[![IReturn YouTube Dislike Explained](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Skrbita me varnost in zasebnost

Več informacij najdete na [tej strani](SECURITY-FAQsl.md).
