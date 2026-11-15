Leggi in altre lingue: [English](SECURITY-FAQ.md), [فارسی](SECURITY-FAQfa.md), [беларуская](SECURITY-FAQbe.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY-FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY_FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md), [Slovenčina](SECURITY-FAQsk.md), [Italiano](SECURITY-FAQit.md)

# Sicurezza

### Tracciate la mia cronologia di visualizzazione?

L'estensione invia all'API di Return YouTube Dislike l'ID del video corrente e, quando disponibile, il numero visibile
di Mi piace, perché il server ne ha bisogno per restituire e migliorare la stima dei Non mi piace. La richiesta espone
anche i normali metadati di rete, come l'indirizzo IP pubblico e l'ora della richiesta. L'estensione non invia il nome
del tuo account YouTube, i commenti su YouTube, i dati privati di YouTube o il contenuto di pagine non correlate e non
conserva un elenco locale separato dei video guardati. In Firefox, l'ID del video e il numero di Mi piace vengono
inviati solo dopo che hai autorizzato ciascuno dei due.

### Potete identificarmi in modo univoco se metto Non mi piace?

La prima volta che voti o reagisci a un commento RYD, l'estensione crea un ID casuale persistente per proteggere
l'invio dei voti dagli abusi. Questo ID non viene inviato quando apri i video o leggi i commenti. Non deriva dal tuo
account Google o YouTube e non è collegato a questi account, ma Mozilla classifica gli identificatori persistenti
come dati personali. L'ID consente al servizio di associare i voti inviati alla stessa installazione dell'estensione.

### Quali informazioni avete, esattamente?

Per le richieste del numero di Non mi piace: l'ID del video corrente e, quando disponibile, il numero visibile di
Mi piace. Per la registrazione e l'invio dei voti: l'ID utente casuale dell'estensione, l'ID del video, il voto scelto
e la data e l'ora. Per le reazioni ai commenti RYD: lo stesso ID utente casuale dell'estensione, l'ID del commento
e la reazione. I commenti e le risposte RYD pubblicati dai membri che hanno effettuato l'accesso sono pubblici e
vengono memorizzati insieme al loro nickname RYD. L'API riceve anche il tuo indirizzo IP.
Gli indirizzi IP in chiaro rimangono nella RAM e vengono memorizzati i relativi hash per i controlli contro gli abusi.
Le funzionalità premium facoltative usano l'ID dell'account, il nome, l'indirizzo email, l'immagine del profilo,
le informazioni sull'abbonamento e il token di sessione del servizio restituiti da un accesso tramite Patreon o
GitHub avviato dall'utente. Nella versione 4.1.0 e nella corrispondente versione del backend, l'accesso tramite
Patreon viene determinato in base agli ID dei livelli a cui l'utente ha attualmente diritto e, ove necessario,
all'importo attuale dell'abbonamento che dà diritto all'accesso e alla sua periodicità mensile o annuale.
L'estensione non riceve questi campi relativi all'importo e alla periodicità, né alcun dato sulle carte di pagamento
o sui conti bancari.

### Come viene memorizzato il mio indirizzo IP?

Gli indirizzi IP in chiaro rimangono nella RAM e vengono memorizzati i relativi hash. Queste informazioni vengono
usate per prevenire gli abusi e per analisi aggregate. Non vengono vendute né usate per la pubblicità.

### Ho sentito parlare di OAuth e dell'accesso al mio account YouTube!

L'accesso alle analisi premium è facoltativo e inizia solo quando l'utente sceglie di accedere tramite Patreon o
GitHub nell'estensione. Il flusso OAuth restituisce i dati dell'account e un token di sessione di Return YouTube
Dislike usato per autenticare le richieste alle API premium. Nella versione 4.1.0 e nella corrispondente versione
del backend, l'idoneità tramite Patreon viene determinata in base agli ID dei livelli a cui l'utente ha attualmente
diritto e, ove necessario, all'importo attuale dell'abbonamento che dà diritto all'accesso e alla sua periodicità;
il servizio non richiede le date o lo stato degli addebiti, i pagamenti complessivi effettuati nel tempo o lo stato
di sostenitore.
Firefox richiede le autorizzazioni facoltative "Informazioni di autenticazione" e "Informazioni di identificazione
personale" prima che inizi lo scambio di dati relativo all'account. La disconnessione rimuove dall'estensione i dati
dell'account e la sessione memorizzati. Anche la revoca dell'autorizzazione di Firefox per i dati di autenticazione
elimina la sessione dell'account e blocca ulteriori scambi di dati relativi all'account finché non concedi nuovamente
il consenso e accedi di nuovo. Se abilitata, la sincronizzazione del browser può sincronizzare l'identificatore
dell'installazione, le impostazioni e la sessione dell'account.

### Come posso fidarmi di questo numero di Non mi piace?

Abbiamo adottato misure per prevenire gli attacchi dei bot e continueremo a migliorare l'efficacia del sistema
di prevenzione: questo ci aiuterà a mantenere il numero di Non mi piace rappresentativo del numero effettivo.
Naturalmente non sarà mai preciso al 100%, quindi spetta a te decidere se fidarti o meno.

### Perché non condividete il codice del backend?

Lo condivideremo prima o poi, ma al momento non c'è un vero motivo per farlo. Dà un falso senso di sicurezza,
perché in un sistema zero trust potremmo anche pubblicare una versione e distribuirne un'altra. Ci sono molti
motivi per mantenere il codice riservato, in particolare il modo in cui contrastiamo lo spam. Nascondere o
offuscare il codice che gestisce lo spam è una pratica piuttosto comune.
