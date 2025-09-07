Read this in other languages: [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md)

# Velkommen til Return YouTube Dislike bidragsvejledning

Tak fordi du bruger din tid på at bidrage til vores projekt! Alle dine ændringer vil blive afspejlet i den næste version af udvidelsen (eller på [websitet](https://www.returnyoutubedislike.com/)).

## Kom godt i gang

Brug venligst Prettier med standardindstillinger til formatering.

#### Forudsætninger

Du skal have Node og npm installeret for at kunne opbygge den bundtede version af koden.

Versioner brugt ved opsætning:

- node: 12.18.4
- npm: 6.14.6

For at oprette `bundled-content-script.js`, som indeholder størstedelen af udvidelsens forretningslogik, skal du først installere alle afhængigheder.

1. Gå til rodmappen af repoet og kør:

```
npm install
```

2. Kør følgende kommando for at oprette `bundled-content-script.js`, som bruges i `manifest.json`

```
npm start // opret build-fil(er) og start en watcher, der genindlæser ved gem

// eller

npm run build // opret build-fil(er) én gang
```

Tillykke, du er nu klar til at udvikle!

Hvis du er ny i udvikling af Chrome‑udvidelser eller har brug for ekstra hjælp, se [denne YouTube‑vejledning](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Issues

#### Opret en ny issue

Hvis du har problemer med udvidelsen, så søg først for at sikre, at problemet ikke allerede er rapporteret. Hvis ikke, opret en issue. Det anbefales stærkt at bruge issue‑skabelonen, men det er ikke påkrævet.

#### Løs en issue

Hvis du har fundet et problem, du mener, du kan løse, så tøv ikke. Opret en PR med rettelsen, og husk at nævne den issue, du løser.

### Feature‑ønsker

#### Opret et nyt feature‑ønske

Hvis du har en idé til udvidelsen, er du velkommen til at oprette et feature‑ønske, men søg venligst først for at sikre, at det ikke allerede er foreslået. Brug af feature‑skabelonen anbefales, men er ikke påkrævet.

#### Implementér et feature‑ønske

Hvis du har fundet et feature, som du kan implementere, så tøv ikke. Opret en PR med implementeringen, og husk at nævne det feature, du implementerer.

### Hvilke PR’er accepterer vi?

- Fejlrettelser.
- Implementering af funktioner.
- Ret stavefejl eller brug bedre og enklere formuleringer.
- Bidrag til websitet.
