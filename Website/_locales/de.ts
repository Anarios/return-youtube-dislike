import { en } from "vuetify/src/locale";
// By tubyoub
export default {
  ...en,
  home: {
    name: "Startseite",
    title: "Return YouTube Dislike",
    subtitle: "Eine Browsererwiterung und eine API, welche dir die YouTube dislikes zeigt",
    ukraine: "Unterstützt die Ukraine",
    sponsors: "Sponsoren",
  },
  install: {
    name: "Installieren",
    title: "Wähle deine Platform",
    subtitle: "Erhältlich für Firefox und alle Chromium-basierten Browser",
    title2: "Andere Platformen",
    subtitle2: "Wenn dein Browser noch nicht unterstützt wird, versuche dieses UserSript",
    title3: "Implementierungen von Drittanbietern",
    subtitle3: "Keine Garantie von unserer Seite, Nutzung auf eigene Gefahr",
  },
  api: {
    name: "API",
    title: "Willkommen auf der offiziellen RYD Dokumentation!",
    subtitle: "Um zu beginnen, wähle einen Bereich aus dem Menü.",
    rights: {
      title: "Nutzungsrechte",
      subtitle: "Die Nutzung dieser offenen API durch Dritte ist mit den folgenden Einschränkungen gestattet:",
      bullet1: "Namensnennung: ",
      bullet1text:
        "Dieses Projekt sollte eindeutig mit einem Link zu dieser Repo oder einem Link zu returnyoutubedislike.com gekennzeichnet werden",
      bullet2: "Begrenzung der Anfragen: ",
      bullet2text:
        "Es gibt Ratenbegrenzung pro Client von 100 pro Minute und 10.000 pro Tag. Dies führt zu einem Statuscode 429, der anzeigt, dass deine Anwendung vor der nächsten Anfrage warten sollte",
    },
    url: {
      title: "URL Information",
      subtitle: "Die API ist über die folgende Basis-URL zugänglich: ",
    },
    endpoints: {
      title: "Verfügbare Endpunkte",
      subtitle: "Eine Liste aller Endpunkte sind hier zu finden: ",
    },
    fetching: {
      title: "Grundlegende Anleitung zum Abrufen der Daten",
      subtitle: "Grundlegende Anleitung zum Abrufen der Bewertung von einer gegebenen YouTube Video ID: ",
      title2: "Besipiel Anfragen: ",
      url: "Anfrage-URL: ",
      method: "Anfrage Methoden: ",
      headers: "Header: ",
      response: "Antwort: ",
      error1: 'Eine ungültige YouTube-ID liefert den Statuscode 404 "Not Found"',
      error2: 'Eine falsch formatierte YouTube-ID liefert den Statuscode 400 "Bad Request"',
    },
  },
  help: {
    name: "Hilfe",
    title: "Fehlersuche",
    bullet1: "Stelle sicher, dass du die neuste Version der Erweiterung installiert hast, derzeit ist das die Version ",
    bullet11: "",
    bullet2:
      "Versuche, die Erweiterung zu entfernen und erneut zu installieren, und starte dann den Browser neu (alle aktiven Fenster, nicht nur eine Registerkarte)",
    bullet3: "Stelle sicher das du den Link öffnest: ",
    bullet31: "Du solltest diesen Text sehen: ",
    bullet4: "Wenn nichts von den oben gesagten Lösungen hilft - melde das Problem in",
    bullet41: "in unserem",
    bullet4a: "Gib uns den Namen deines Betriebssystems, deines Browsers und die Version des Browsers ",
    bullet4b:
      "Mache einen Screenshot der Seite mit dem Problem (von der YouTube-Seite) mit der Konsole offen (drücke ",
    bullet4b1: ") - wie in dem Screenshot unten.",
    bullet4c: "Mache ein Screenshot von deinen installierten Erweiterungen in deinem Browser.",
    bullet4c1: "Um diese Seite zu sehen, gib das in dei Adressleiste ein: ",
    firefox: "für Firefox und",
    chrome: "für Chrome, Edge, Brave, Opera und Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Häufig gestellte Fragen",
    subtitle: "Hast du noch Fragen? Dann komm auf unseren Discord!",
    bullet1: "Woher bekommt die Erweiterung ihre Daten?",
    bullet1text:
      "Eine Kombination aus archivierten Daten aus der Zeit, bevor die offizielle YouTube-Dislike-API abgeschaltet wurde, und extrapoliertem Statistiken durch Analyse des Nutzerverhaltens.",
    bullet2: "Warum updated der Dislike-Counter nicht?",
    bullet2text:
      "Momentan werden die Dislikes von Videos im Cache gespeichert und nicht sehr häufig aktualisiert. Die Aktualisierung hängt von der Popularität eines Videos ab, das kann zwischen ein paar Stunden und ein paar Tagen dauern.",
    bullet3: "Wie funktioniert die Extension?",
    bullet3text:
      "Die Erweiterung sammelt die Video-ID des Videos, das du dir ansiehst, und ruft die Dislikes (und andere Felder wie Views, Likes usw.) über unsere API ab. Die Erweiterung zeigt dann die Anzahl der Dislikes und das Like/Dislike-Verhältnis auf der Seite an. Wenn dir ein Video gefällt oder nicht gefällt, wird dies aufgezeichnet und an die Datenbank gesendet, so dass eine genaue Anzahl der Dislikes bestimmt werden kann.",
    bullet4: "Kann ich meine Dislikes mit euch teilen?",
    bullet4text:
      "Demnächst. Wir prüfen die Verwendung von Oauth oder einer anderen Read-Only-API mit begrenztem Umfang, damit die Youtuber ihre Dislike-Anzahl verifizieren können.",
    bullet5: "Was für Daten sammelt ihr und wie werden sie verarbeitet?",
    bullet5text:
      'Die Erweiterung sammelt nur Daten, die für ihr ordnungsgemäßes Funktionieren unbedingt erforderlich sind, z.B. die IP-Adresse oder die ID des Videos, das du dir ansiehst. Keine deiner Daten werden jemals an Dritte verkauft. Wenn du mehr darüber erfahren möchtest, wie wir mit Sicherheit und Datenschutz umgehen, lesen Sie unsere <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md"> Sicherheits-FAQ</a>.',
    bullet6: "Wie Funktioniert die API / das Backend?",
    bullet6text:
      "Das Backend verwendet archivierte von damals, als die YouTube API noch die Anzahl der Dislikes, die Anzahl der Likes und Dislikes der Extension-Nutzer und die Hochrechnung zurückgab. In naher Zukunft werden wir es Youtubern ermöglichen, ihre Dislike-Anzahl einfach und sicher zu übermitteln, und wir werden die archivierten Daten von ArchiveTeam (4,56 Milliarden Videos) in unsere aktuelle Datenbank aufnehmen. Du kannst dir auch ein Video zu diesem Thema ansehen.",
    bullet7: "Warum zeigt der Dislike-Counter manchmal 'DISLIKES DISABLED'?",
    bullet7text:
      "Manchmal wird bei einem kürzlich hochgeladenen Video 'DISLIKES DISABLED' angezeigt, auch wenn der Youtuber es nicht deaktiviert hat. Das liegt daran, wie wir erkennen, ob Dislikes deaktiviert sind. Es sollte in ein paar Stunden verschwinden oder indem man das Video liked oder disliked und die Seite aktualisiert (hoffentlich).",
  },
  donate: {
    name: "Spenden",
    subtitle: "Du kannst unsere Bemühungen, das Internet frei zu halten, mit einer Spende unterstützen!",
  },
  links: {
    name: "Links",
    title: "Projekt-Links",
    subtitle: "Link zu dem Projekt und deren Entwickler",
    contact: "Kontakt",
    translators: "Übersezter",
    coolProjects: "Coole Projekte",
    sponsorBlockDescription: "Überspringe integrierte Werbung in Videos",
    filmotDescription: "Suche nach YouTube-Videos über ihre Untertitel",
  },
};
