[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Leggi questo in altre lingue: [English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Italiano](CONTRIBUTINGit.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# Benvenuto nella guida ai contributi di Return YouTube Dislike

Grazie per aver dedicato il tuo tempo a contribuire al nostro progetto! Tutte le tue modifiche saranno riflesse nella prossima versione dell'estensione (o del [sito web](https://www.returnyoutubedislike.com/)).

## Per iniziare

Si prega di utilizzare Prettier con le impostazioni predefinite per la formattazione del codice.

#### Prerequisiti

È necessario avere Node.js e npm installati per creare la versione pacchettizzata (bundle) del codice sorgente.

Versioni utilizzate durante la configurazione:

- node: 12.18.4
- npm: 6.14.6

Per generare il file `bundled-content-script.js`, che contiene la maggior parte della business logic dell'estensione, occorre prima installare tutte le dipendenze.

1. Vai nella cartella radice della repository ed esegui:

```bash
npm install
```

2. Esegui il comando seguente per creare `bundled-content-script.js`, utilizzato in `manifest.json`:

```bash
npm start # crea i file di build e avvia un file watcher che ricarica automaticamente a ogni salvataggio

# oppure

npm run build # crea i file di build una sola volta
```

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