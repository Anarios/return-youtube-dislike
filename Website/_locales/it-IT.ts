import { en } from "vuetify/src/locale";

export default {
  ...en,
  home: {
    name: "Home",
    title: "Return YouTube Dislike",
    subtitle: "Estensione per browser e un API che ti mostra il numero di Non mi piace su YouTube",
    ukraine: "Sostieni l'Ucraina",
    sponsors: "Sponsor",
  },
  install: {
    name: "Installa",
    title: "Seleziona la tua piattaforma",
    subtitle: "Disponibile per Firefox e per tutti i browser Chromium",
    title2: "Altre piattaforme",
    subtitle2: "Se il tuo browser non è ancora supportato, prova questo script utente",
    title3: "Implementazioni di terze parti",
    subtitle3: "Nessuna responsabilità da parte nostra, usa a tuo rischio e pericolo",
  },
  api: {
    name: "API",
    title: "Ecco a te i documenti RYD ufficiali!",
    subtitle: "Per iniziare, seleziona una sezione dal menu.",
    rights: {
      title: "Diritti di utilizzo",
      subtitle:
        "L'utilizzo di questo API da parte di terzi è consentito secondo le seguenti restrizioni",
      bullet1: "Attribuzione: ",
      bullet1text:
        "Questo progetto deve venire chiaramente attribuito via un link a questa repo o a returnyoutubedislike.com",
      bullet2: "Limiti di richieste: ",
      bullet2text:
        "I limiti per il numero di richeste per ogni client sono di 100 al minuto o 10.000 al giorno. Questo comporterà un codice 429 che intima all'applicazione di interrompere le richieste.",
    },
    url: {
      title: "Informazioni URL",
      subtitle: "L'API è accesssibile dal seguente URL base: ",
    },
    endpoints: {
      title: "Endpoint disponibili",
      subtitle: "È disponibile una lista di endpoint disponibili qui: ",
    },
    fetching: {
      title: "Tutorial per richiesta basica",
      subtitle: "Esempio per ottenere i voti di un dato ID video di YouTube: ",
      title2: "Esempio richiesta: ",
      url: "URL richiesta: ",
      method: "Metodo richiesta: ",
      headers: "Intestazioni: ",
      response: "Risposta: ",
      error1: 'Un ID YouTube non valido restituirà un codice 404 "Not Found"',
      error2:
        'Un ID YouTube formattato incorrettamente restituirà 400 "Bad Request"',
    },
  },
  help: {
    name: "Aiuto",
    title: "Risoluzione problemi",
    bullet1: "Assicurati di aver installato l'ultima versione dell'estensione, ",
    bullet11: "adesso",
    bullet2:
      "Prova rimuovendo l'estensione e installandola di nuovo, poi riavvia il browser (tutte le finestre attive, non solo un pannello)",
    bullet3: "Assicurati che questo link si apra: ",
    bullet31: "dovresti vedere solo testo: ",
    bullet4: "Se non funziona nulla di tutto ciò, segnala il tuo problema in",
    bullet41: "nel nostro",
    bullet4a: "Dicci il tuo sistema operativo, nome del browser e versione del browser",
    bullet4b:
      "Fai uno screenshot della pagina con il problema (es. pagina video di YouTube) con la console aperta (premi ",
    bullet4b1: "), screenshot di esempio in basso.",
    bullet4c:
      "Fai uno screenshot della pagina delle estensioni del tuo browser con l'estensione installata.",
    bullet4c1: "Per vedere le estensioni inserisci questo nella barra di ricerca: ",
    firefox: "per Firefox",
    chrome: "per Chrome, Edge, Brave, Opera e Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Domande frequenti",
    subtitle: "Hai ancora domande? Unisciti al nostro Discord!",
    bullet1: "Da dove ottiene i propri dati l'estensione?",
    bullet1text:
      "Una combinazione di dati archiviati da prima della disattivazione dell'API ufficiale di YouTube per i Non mi piace e di dati estrapolati dall'utilizzo dell'estensione da parte degli utenti.",
    bullet2: "Perché il contatore dei Non mi piace non si aggiorna?",
    bullet2text:
      "Adesso i Non mi piace sono precaricati e non vengono aggiornati spesso. Dipende dalla popolarità del video, ma può volerci da qualche ora a qualche giorno per aggiornarsi.",
    bullet3: "Come funziona?",
    bullet3text:
      "L'estensione legge l'ID del video che stai guardando e ottiene il numero di Non mi piace (e altri parametri come visualizzazioni, Mi piace, ecc.) usando il nostro API. L'estensione, quindi, mostra il numero di Non mi piace e il rapporto sulla pagina. Se metti Mi piace o Non mi piace a un video, questo viene registrato e inviato al database così da estrapolare un numero di Non mi piace accurato.",
    bullet4: "Posso condividere il mio numero di Non mi piace con voi?",
    bullet4text:
      "In arrivo a breve. Stiamo valutando l'utilizzo di Oauth o di un altro API in sola lettura con un'estensione limitata per permettere ai creatori di condividere la verificabilità del loro conteggio di Non mi piace.",
    bullet5: "Che dati raccogliete e come sono trattati?",
    bullet5text:
      'L\'estensione raccoglie solo i dati strettamente necessari per funzionare in modo corretto, come l\'indirizzo IP o l\'ID del video che stai guardando. I tuoi dati non verranno mai venduti a terze parti. Se vuoi sapere di più su come gestiamo la sicurezza e la privacy dai un\'occhiata al nostro <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">security FAQ</a>.',
    bullet6: "Come funziona l'API/backend?",
    bullet6text:
      "Il backend utilizza dati archiviati da quando l'API di YouTube restituiva ancora il numero di Non mi piace e dati sui Mi Piace/Non mi piace estrapolati dall'utilizzo dell'estensione da parte degli utenti. Nel prossimo futuro permetteremo ai creatori di contenuti di presentare il loro numero di Non mi piace in modo semplice e sicuro e aggiungeremo i dati archiviati da ArchiveTeam (4,56 miliardi di video) al nostro database corrente. Puoi anche guardare un video a riguardo.",
    bullet7: "Perché il conteggio dei Non mi piace dice 'NON MI PIACE DISATTIVATI'?",
    bullet7text:
      "A volte un video caricato da poco potrebbe mostrare 'MI PIACE DISATTIVATI' anche se il creatore non li ha disattivati, ciò è dato da come rileviamo se i Non mi piace sono disattivati, dovrebbe sparire da solo in un paio d'ore o dopo aver messo Mi piace o Non mi piace al video e riaricato la pagina (si spera).",
  },
  donate: {
    name: "Dona",
    subtitle:
      "Puoi sostenere il nostro lavoro per mantenere l'internet libero con una donazione!",
  },
  links: {
    name: "Link",
    title: "Link progetti",
    subtitle: "Link al progetto e ai suoi sviluppatori",
    contact: "Contattami",
    translators: "Traduttori",
    coolProjects: "Progetti interessanti",
    sponsorBlockDescription: "Salta gli annunci integrati nei video",
    filmotDescription: "Cerca video su YouTube tramite i sottotitoli",
  },
};
