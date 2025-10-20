Read this in other languages: [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md)

# Välkommen till Return YouTube Dislike – bidragsguide

Tack för att du lägger tid på att bidra till vårt projekt! Alla dina ändringar kommer att synas i nästa version av tillägget (eller på [webbplatsen](https://www.returnyoutubedislike.com/)).

## Kom igång

Använd gärna Prettier med standardinställningar för formatering.

#### Förutsättningar

Du behöver ha Node och npm installerat för att skapa den bundlade versionen av koden.

Versioner som användes vid uppsättning:

- node: 12.18.4
- npm: 6.14.6

För att skapa `bundled-content-script.js`, som innehåller större delen av tilläggets logik, behöver du först installera alla beroenden.

1. Gå till repo‑ts roten och kör:

```
npm install
```

2. Kör följande kommando för att skapa `bundled-content-script.js`, som används i `manifest.json`:

```
npm start // skapar build‑fil(er) och startar en filbevakare som laddar om vid spara

// eller

npm run build // skapar build‑fil(er) en gång
```

Grattis! Du är nu redo att utveckla.

Om du är ny på att utveckla Chrome‑tillägg, eller behöver extra hjälp, se [den här YouTube‑guiden](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Ärenden (Issues)

#### Skapa ett nytt ärende

Om du har problem med tillägget, sök först för att säkerställa att ärendet inte redan är rapporterat. Om inte, skapa ett ärende. Det rekommenderas starkt att använda ärendeformuläret, men det är inte obligatoriskt.

#### Lösa ett ärende

Om du hittat ett ärende du tror att du kan lösa, tveka inte. Öppna en PR med lösningen och nämn vilket ärende du åtgärdar.

### Funktionsförslag

#### Skapa ett nytt funktionsförslag

Har du en idé för tillägget? Skapa gärna ett funktionsförslag, men sök först för att se till att förslaget inte redan finns. Att använda funktionsformuläret rekommenderas men är inte obligatoriskt.

#### Implementera ett funktionsförslag

Om du hittat en funktion du kan implementera, tveka inte. Öppna en PR med implementationen och nämn vilken funktion du implementerar.

### Vilka PR:er accepterar vi?

- Buggfixar.
- Implementering av funktioner.
- Rättning av stavfel eller förbättrade, enklare formuleringar.
- Bidrag till webbplatsen.
