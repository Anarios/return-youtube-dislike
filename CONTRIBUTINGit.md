Leggi questo documento in altre lingue: [English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [简体中文](CONTRIBUTINGcn.md), [繁體中文](CONTRIBUTINGtw.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Italiano](CONTRIBUTINGit.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# Benvenuto nella guida ai contributi di Return YouTube Dislike

Grazie per aver dedicato il tuo tempo a contribuire al nostro progetto! Tutte le tue modifiche saranno riflesse nella prossima versione dell'estensione (o del [sito web](https://www.returnyoutubedislike.com/)).

## Per iniziare

Utilizza Prettier con la configurazione del progetto per la formattazione del codice.

#### Prerequisiti

È necessario avere Node.js e npm installati per creare la versione pacchettizzata (bundle) del codice sorgente. Utilizza le versioni indicate in [.nvmrc](.nvmrc) e [package.json](package.json).

1. Vai nella cartella radice del repository ed esegui questo comando per installare le dipendenze:

```bash
npm ci
```

2. Durante lo sviluppo, esegui questo comando per creare la build di sviluppo e monitorare le modifiche ai file:

```bash
npm run dev
```

La build viene aggiornata automaticamente a ogni salvataggio. Per provare le modifiche nel browser, ricarica l'estensione e la pagina di prova.

Per creare una build di produzione, esegui:

```bash
npm run build
```

Le build per Chrome e Firefox vengono generate rispettivamente in `Extensions/combined/dist/chrome` e `Extensions/combined/dist/firefox`. In Chrome, attiva la modalità sviluppatore e carica la cartella `chrome` come estensione non pacchettizzata; in Firefox, carica il file `manifest.json` della cartella `firefox` come componente aggiuntivo temporaneo per le prove.

Congratulazioni, ora sei pronto a sviluppare!

Se non hai mai sviluppato un'estensione per Chrome o hai bisogno di ulteriore supporto, consulta [questo tutorial su YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Segnalazione problemi (Issues)

#### Aprire una nuova issue

Se riscontri problemi con l'estensione, cerca prima tra le issue aperte e chiuse per accertarti che il problema non sia già stato segnalato. In caso contrario, apri una nuova issue; l'uso del template predefinito è vivamente consigliato, sebbene non obbligatorio.

#### Risolvere una issue

Se hai individuato una issue che ritieni di poter risolvere, non farti problemi: apri direttamente una PR con la correzione, ricordandoti di menzionare la issue che stai risolvendo nella descrizione.

### Richieste di funzionalità (Feature Requests)

#### Proporre una nuova funzionalità

Se hai un'idea per migliorare l'estensione, sentiti libero di aprire una richiesta di funzionalità (feature request). Prima di farlo, effettua una ricerca per verificare che l'idea non sia già stata suggerita in precedenza. L'utilizzo dell'apposito template è consigliato ma non obbligatorio.

#### Implementare una funzionalità

Se hai trovato una richiesta di funzionalità che desideri implementare, proponi pure il tuo lavoro: apri una PR con l'implementazione e menziona la relativa richiesta di funzionalità.

### Quali tipologie di PR accettiamo?

- Correzioni di bug e problemi.
- Implementazione di nuove funzionalità.
- Correzione di refusi o miglioramenti alla chiarezza del testo.
- Contributi e miglioramenti al sito web.
