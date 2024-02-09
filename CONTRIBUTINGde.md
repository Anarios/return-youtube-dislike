Read this in other languages: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md)

# Willkommen beim Leitfaden für Beitragende von Return YouTube Dislikes

Vielen Dank, dass du deine Zeit investierst, um zu unserem Projekt beizutragen! Alle deine Änderungen werden in der nächsten Version der Erweiterung (oder der [Website](https://www.returnyoutubedislike.com/)) reflektiert.

## Erste Schritte

Bitte verwende Prettier mit den Standardeinstellungen für die Formatierung.

#### Voraussetzungen

Du musst Node und npm installiert haben, um die gebündelte Version der Quelle zu erstellen.

Verwendete Versionen beim Einrichten:

- Node: 12.18.4
- npm: 6.14.6

Um die `bundled-content-script.js` zu erstellen, die den Großteil der Geschäftslogik dieser Erweiterung enthält, musst du zuerst alle Abhängigkeiten installieren.

1. Gehe zum Root-Verzeichnis des Repos und führe aus:

```
npm install
```

2. Führe den folgenden Befehl aus, um `bundled-content-script.js` zu erstellen, das in `manifest.json` verwendet wird:

```
npm start // um die Build-Datei(en) zu erstellen und einen Datei-Watcher zu starten, der bei jedem Speichern neu lädt

// oder

npm run build // um die Build-Datei(en) einmal zu erstellen
```

Herzlichen Glückwunsch, du bist jetzt bereit zum Entwickeln!

Wenn du neu in der Entwicklung von Chrome-Erweiterungen bist oder zusätzliche Hilfe benötigst, sieh dir bitte [dieses YouTube-Tutorial](https://www.youtube.com/watch?v=mdOj6HYE3_0) an.

### Probleme

#### Öffnen eines neuen Problems

Wenn du Probleme mit der Erweiterung hast, suche bitte, um sicherzustellen, dass das Problem noch nicht gemeldet wurde. Wenn nicht, öffne ein Problem. Die Verwendung des Problemformulars wird dringend empfohlen, ist aber nicht zwingend erforderlich.

#### Lösung eines Problems

Wenn du ein Problem gefunden hast, das du lösen könntest, sei nicht schüchtern. Öffne einen PR mit der Lösung und vergewissere dich, dass du das behobene Problem erwähnst.

### Feature-Anfrage

#### Öffnen einer neuen Feature-Anfrage

Wenn du eine Idee für die Erweiterung hast, kannst du gerne eine Feature-Anfrage öffnen, aber suche bitte zuerst, um sicherzustellen, dass das Feature noch nicht vorgeschlagen wurde. Die Verwendung des Feature-Formulars wird dringend empfohlen, ist aber nicht zwingend erforderlich.

#### Implementierung einer Feature-Anfrage

Wenn du ein Feature gefunden hast, das du implementieren könntest, sei nicht schüchtern. Öffne einen PR mit der Implementierung und vergewissere dich, dass du das implementierte Feature erwähnst.

### Welche PRs akzeptieren wir?

- Fehlerbehebungen.
- Implementierung von Funktionen.
- Rechtschreibfehler oder bessere und einfachere Wörter zur Verwendung.
- Beiträge zur Website.
