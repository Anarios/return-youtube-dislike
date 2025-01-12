Lees dit in andere talen: [English](CONTRIBUTINGen.md), [русский](CONTRIBUTINGru.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Deutsch](CONTRIBUTINGde.md)

# Welkom bij de YouTube Dislikes bijdragengids

Bedankt voor het investeren van uw tijd in het bijdragen aan ons project! Al uw wijzigingen worden weergegeven in de volgende versie van de extensie (of de [website](https://www.returnyoutubedislike.com/)).

## Aan de slag

Gebruik Prettier met standaardinstellingen voor opmaak.

#### Vereisten

U moet node en npm hebben geïnstalleerd om de gebundelde versie van de broncode te maken.

Versies gebruikt bij het instellen:

- node: 12.18.4
- npm: 6.14.6

Om de `bundled-content-script.js` te maken die de meeste bedrijfslogica van deze extensie bevat, moet u eerst alle afhankelijkheden installeren.

1. Ga naar de hoofdmap van de repo en voer het volgende uit:

```
npm install
```

2. Voer de volgende opdracht uit om `bundled-content-script.js` aan te maken dat wordt gebruikt in `manifest.json`

```
npm start // om het (de) buildbestand(en) te maken en een bestandswachter te starten die bij het opslaan opnieuw wordt geladen

// of

npm run build // om het (de) buildbestand(en) eenmaal te maken
```

Gefeliciteerd, je bent nu klaar om te ontwikkelen!

Als je nieuw bent in het ontwikkelen van Chrome-extensies of extra hulp nodig hebt, bekijk dan [deze YouTube-tutorial](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Problemen

#### Een nieuw probleem openen

Als je problemen hebt met de extensie, zoek dan eerst of het probleem nog niet is gemeld. Als dit niet het geval is, open dan een probleem, het gebruik van het probleemformulier wordt sterk aanbevolen, maar is niet verplicht.

#### Een probleem oplossen

Als je een probleem hebt gevonden waarvan je denkt dat je het zou kunnen oplossen, wees dan niet verlegen. Open een PR met de oplossing en vermeld het probleem dat u aan het oplossen bent.

### Functieverzoek:

#### Een nieuw functieverzoek openen

Als je een idee hebt voor de extensie, kun je een functieverzoek openen, maar zoek het eerst op om er zeker van te zijn dat de functie niet al is voorgesteld. Het gebruik van het functieformulier wordt sterk aanbevolen, maar is niet verplicht.

#### Een functieverzoek implementeren

Als je een functie hebt gevonden waarvan je denkt dat je die zou kunnen implementeren, wees dan niet verlegen. Open een PR met de oplossing en zorg ervoor dat u de functie vermeldt die u implementeert.

### Welke PR's accepteren we?

- Probleemoplossingen.
- Implementatie van functies.
- Typefouten of betere en gemakkelijkere woorden om te gebruiken.
- Website bijdragen.
