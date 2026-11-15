Leggi questo documento in altre lingue: [English](FAQ.md), [فارسی](FAQfa.md), [беларуская](FAQbe.md), [русский](FAQru.md), [Français](FAQfr.md), [Italiano](FAQit.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md), [Português do Brasil](FAQpt_BR.md), [العربية](FAQar.md), [Bahasa Indonesia](FAQid.md), [中文](FAQcn.md), [български](FAQbg.md), [Tiếng Việt](FAQvi.md), [Slovenščina](FAQsl.md), [Slovenčina](FAQsk.md)

# Domande frequenti

## Prima di porre una domanda su GitHub o Discord, consulta questa pagina.

<br>

### **1. Da dove provengono i dati di questa estensione?**

Da una combinazione delle API di Google e di dati estratti tramite scraping.

Salviamo tutti i dati disponibili nel nostro database, in modo che rimangano accessibili anche dopo che Google avrà smesso di fornire il conteggio dei non mi piace nella sua API.

<br>

### **2. Il conteggio dei non mi piace del video non si aggiorna**

Al momento i conteggi dei non mi piace dei video vengono memorizzati nella cache e non vengono aggiornati molto spesso: una volta ogni 2-3 giorni, non più frequentemente.

Sì, non è l'ideale, ma questa è la situazione attuale. Stiamo lavorando per poterli aggiornare più spesso.

<br>

### **3. Come funziona?**

L'estensione raccoglie l'ID del video che stai guardando e recupera il conteggio dei non mi piace (e altri dati come visualizzazioni, mi piace, ecc.) tramite la nostra API. Se è la prima volta che la nostra API recupera i dati del video, usa l'API di YouTube per ottenerli, poi li memorizza in un database per la cache (per circa 2-3 giorni) e per l'archiviazione, e te li restituisce. L'estensione ti mostra quindi il conteggio dei non mi piace.

<br>

### **4. Cosa succederà quando l'API di YouTube smetterà di fornire il conteggio dei non mi piace?**

Il backend passerà a utilizzare una combinazione di statistiche archiviate dei non mi piace, stime estrapolate dai dati degli utenti dell'estensione e stime basate sul rapporto tra visualizzazioni e mi piace per i video i cui non mi piace non sono stati archiviati e per gli archivi dei non mi piace non più aggiornati.

<br>

### **5. Come viene calcolato il conteggio dei non mi piace?**

RYD utilizza i voti dei propri utenti per estrapolare il conteggio dei non mi piace.

- Se il video è stato caricato dopo la disattivazione dell'API:

$$
D_{\mathrm{RYD}} = \left( \frac{D_u}{L_u} \right) \times L_p
$$

In questa formula, $D_{\mathrm{RYD}}$ è il conteggio dei non mi piace stimato da RYD, $D_u$ è il conteggio dei non mi piace degli utenti di RYD, $L_u$ è il conteggio dei mi piace degli utenti di RYD e $L_p$ è il conteggio pubblico dei mi piace.

- Se il database di RYD dispone in qualche modo dei conteggi reali dei mi piace e dei non mi piace (forniti da chi ha caricato il video o ricavati dall'archivio), il conteggio dei non mi piace viene calcolato sulla base di entrambi: i voti degli utenti e il valore archiviato. Il valore archiviato influisce sempre meno sul conteggio finale con il passare del tempo.

<br>

---

La spiegazione in formato video

[![Return YouTube Dislike: come funziona](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Ho dubbi sulla sicurezza o sulla privacy

Consulta [questa pagina](SECURITY-FAQit.md) per maggiori informazioni.
