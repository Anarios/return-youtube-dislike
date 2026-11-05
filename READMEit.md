Leggi questo in altre lingue: [English](README.md), [فارسی](READMEfa.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [беларуская](READMEbe.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Italiano](READMEit.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md), [Slovenščina](READMEsl.md)

# Return YouTube Dislike

## La nostra storia

Il 10 novembre 2021, Google ha [annunciato](https://blog.youtube/news-and-events/update-to-youtube/) la rimozione del contatore pubblico dei "Non mi piace" su YouTube.

Inoltre, il campo `dislike` nelle API di YouTube è stato [rimosso](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) il 13 dicembre 2021, togliendo agli utenti la possibilità di valutare la qualità dei contenuti prima di riprodurli.

## Come funziona

In seguito alla rimozione delle statistiche dei dislike dalle API di YouTube, il nostro backend è passato all'uso di una combinazione di statistiche archiviate in precedenza (scraped) e stime estrapolate dai dati degli utenti dell'estensione.

[FAQ (Domande frequenti)](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Perché è importante

Puoi scoprire di più visitando il nostro sito web: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentazione API

L'uso da parte di terze parti di queste API pubbliche è consentito nel rispetto delle seguenti restrizioni:

* **Attribuzione**: Il progetto deve essere chiaramente accreditato inserendo un link a [returnyoutubedislike.com](https://returnyoutubedislike.com/).

* **Limite di frequenza (Rate Limiting)**: Sono previsti limiti per singolo client pari a 100 richieste al minuto e 10.000 al giorno. Il superamento comporterà la risposta con codice di stato *429*, indicante la necessità di ridurre la frequenza delle chiamate.

L'API è raggiungibile al seguente indirizzo base:
https://returnyoutubedislikeapi.com

L'elenco degli endpoint disponibili è consultabile qui:
https://returnyoutubedislikeapi.com/swagger/index.html

### Ottenere i voti

Esempio per recuperare i voti relativi all'ID di un determinato video YouTube:
`/votes?videoId=kxOuG8jMIgI`

```
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2022-04-09T21:44:20.5103Z",
  "likes": 31885,
  "rawDislikes": 31946,
  "rawLikes": 457,
  "dislikes": 579721,
  "rating": 1.2085329444119253,
  "viewCount": 3762293,
  "deleted": false
}

```

Se l'ID di YouTube non esiste, l'API restituirà il codice di stato *404* "Not Found".

Se il formato dell'ID non è valido, verrà restituito il codice di stato *400* "Bad Request".

## Come contribuire

Ti invitiamo a leggere la nostra [guida ai contributi](CONTRIBUTINGit.md).

## Supporta il progetto!

Puoi sostenere questo progetto con una donazione tramite il link seguente:

[Fai una donazione](https://returnyoutubedislike.com/donate)

## Sponsor

[Diventa un nostro sponsor e ottieni visibilità nella repository e sul sito web](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)