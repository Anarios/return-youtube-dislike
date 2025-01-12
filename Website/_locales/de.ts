import { en } from "vuetify/src/locale";
// By tubyoub
export default {
  ...en,
  home: {
    name: "Startseite",
    title: "Return YouTube Dislike",
    subtitle: "Eine Browser Erwiterung und eine API welche dir die YouTube dislikes zeigt",
    ukraine: "Unterstütz die Ukraine",
    sponsors: "Sponsoren",
  },
  install: {
    name: "Instalieren",
    title: "Wähle deine Platform",
    subtitle: "Erhältlich für Firefox und alle Chromium Browser",
    title2: "Andere Platformen",
    subtitle2: "Wenn dien Browser noch nicht unterstützt wird, versuch das UserSript",
    title3: "Implementierungen von Drittanbietern",
    subtitle3: "Keine Garantie von unserer Seite, nutzung auf eigene Gefahr",
  },
  api: {
    name: "API",
    title: "Willkommen zu der offiziellen RYD Dokumentation!",
    subtitle: "Um zu beginnen, wähle einen Bereich aus dem Menü.",
    rights: {
      title: "Nutzungsrechte",
      subtitle: "Die Nutzung dieser offenen API durch Dritte ist mit den folgenden Einschränkungen gestattet::",
      bullet1: "Namensnennung: ",
      bullet1text:
        "Dieses Projekt sollte eindeutig mit einem Link zu diesem Repo oder einem Link zu returnyoutubedislike.com gekennzeichnet werden",
      bullet2: "Begrenzung der Anfragen: ",
      bullet2text:
        "Es gibt Ratenbegrenzung pro Client von 100 pro Minute und 10.000 pro Tag. Dies führt zu einem Statuscode 429, der anzeigt, dass Ihre Anwendung warten sollte vor ihrer nächsten Anfrage",
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
      subtitle: "Grundlegende Anleitung zum Abrufen der Bewertung von einer gegebenen YouTube Video  ID: ",
      title2: "Besipiel Anfragen: ",
      url: "Anfrage URL: ",
      method: "Anfrage Methoden: ",
      headers: "Kopfzeile: ",
      response: "Antwort: ",
      error1: 'Eine ungültige YouTube-ID liefert den Statuscode 404 "Not Found"',
      error2: 'Eine falsch formatierte YouTube-ID liefert den Statuscode 400 "Bad Request"',
    },
  },
  help: {
    name: "Hilfe",
    title: "Fehlersuche",
    bullet1: "Stell sicher, dass sie die neuste Version der Erweiterung installiert haben, derzeit ist das die, ",
    bullet11: "",
    bullet2:
      "Versuch die Erweiterung zu entfernen und erneut zu installieren, und starte dann den Browser neu (alle aktiven Fenster, nicht nur eine Registerkarte)",
    bullet3: "Stell sicher das du den Link öffnest: ",
    bullet31: "Du solltest diesen Text sehen: ",
    bullet4: "Wenn nichts von dem oben Gesagten Lösungen hilft - melden Sie Ihr Problem in",
    bullet41: "in unserem",
    bullet4a: "Gib uns den Namen deines Betriebssystem, Browsernamen und die Browser Version ",
    bullet4b:
      "Mach ein Screenshot der Seite mit dem Problem (von der YouTube Video Seite) mit der Konsole offen (drücke ",
    bullet4b1: ") - Beispiel Screenshot unten.",
    bullet4c: "Mache ein Screenshot von deinen installierten Erweiterungen in deinem Browser .",
    bullet4c1: "Um diese Seite zu sehen gib das in dei Adressleiste ein: ",
    firefox: "für Firefox",
    chrome: "für Chrome, Edge, Brave, Opera, Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Häufig gestellte Fragen",
    subtitle: "Hast du noch Fragen? Dann komm auf unseren Discord!",
    bullet1: "Woher kriegt die Erweiterung ihre Daten her?",
    bullet1text:
      "Eine Kombination aus archivierten Daten aus der Zeit, bevor die offizielle YouTube dislike API abgeschaltet wurde, und extrapoliertem Statistiken durch Analyse des Nutzerverhaltens.",
    bullet2: "Warum updated der Dislike counter nicht?",
    bullet2text:
      "Momentan werden die Dislikes von Videos im Cache gespeichert und nicht sehr häufig aktualisiert. Die Aktualisierung hängt von der Popularität eines Videos ab, kann aber zwischen ein paar Stunden und ein paar Tagen dauern.",
    bullet3: "Wie funktioniert die Extension?",
    bullet3text:
      "Die Erweiterung sammelt die Video-ID des Videos, das du dir ansiehst, und ruft die Dislikes (und andere Felder wie views, Likes usw.) über unsere API ab. Die Erweiterung zeigt dann die Anzahl der Dislikes und das Like/Dislike verhalten auf der Seite an. Wenn Ihnen ein Video gefällt oder nicht gefällt, wird dies aufgezeichnet und an die Datenbank gesendet, so dass eine genaue Anzahl der Ablehnungen bestimmt werden kann.",
    bullet4: "Kann ich meine Dislikes mit euch teilen?",
    bullet4text:
      "Demnächst. Wir prüfen die Verwendung von Oauth oder einer anderen Read-Only-API mit begrenztem Umfang, damit die Ersteller ihre Dislike Anzahl verifizieren können.",
    bullet5: "Was für Daten sammelt ihr und wie werden sie verarbeitet?",
    bullet5text:
      'Die Erweiterung sammelt nur Daten, die für ihr ordnungsgemäßes Funktionieren unbedingt erforderlich sind, z. B. die IP-Adresse oder die ID des Videos, das Sie sich ansehen. Keine Ihrer Daten wird jemals an Dritte verkauft werden. Wenn du mehr darüber erfahren möchtest, wie wir mit Sicherheit und Datenschutz umgehen, lesen Sie unsere <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md"> Sicherheits-FAQ </a>.',
    bullet6: "Wie Funktioniert die API / das Backend?",
    bullet6text:
      "Das Backend verwendet archivierte Daten aus der Zeit, als die YouTube API noch die Anzahl der Dislikes, die Anzahl der Likes und Dislikes der Extension nutzer und die Hochrechnung zurückgab. In naher Zukunft werden wir es Creator ermöglichen, ihre Dislike-Anzahl einfach und sicher zu übermitteln, und wir werden die archivierten Daten von ArchiveTeam (4,56 Milliarden Videos) in unsere aktuelle Datenbank aufnehmen. Sie können sich auch ein Video zu diesem Thema ansehen.",
    bullet7: "Warum zeigt der Dislike Counter manchmal 'DISLIKES DISABLED'?",
    bullet7text:
      "Manchmal wird bei einem kürzlich hochgeladenen Video 'DISLIKES DISABLED' angezeigt, auch wenn der Creator es nicht deaktiviert hat. Das liegt daran, wie wir erkennen, ob Dislikes deaktiviert sind, es sollte in ein paar Stunden verschwinden oder indem man das Video Liked oder disliked und die Seite aktualisiert (hoffentlich).",
  },
  donate: {
    name: "Spenden",
    subtitle: "Du kannst unsere Bemühungen, das Internet frei zu halten, mit einer Spende unterstützen !",
  },
  links: {
    name: "Links",
    title: "Project Links",
    subtitle: "Link zu dem Projekt und deren Developer",
    contact: "Kontakt",
    translators: "Übersezter",
    coolProjects: "Cool Projects",
    sponsorBlockDescription: "Überspringe integrierte Werbung in Videos ",
    filmotDescription: "Suche nach YouTube Videos über ihre Untertitel",
  },
};
