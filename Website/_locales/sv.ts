import { sv } from "vuetify/src/locale";

export default {
  ...sv,
  home: {
    name: "Hem",
    title: "Return YouTube Dislike",
    subtitle:
      "Webbläsartillägg och ett API som visar antalet ogilla på Youtube",
    ukraine: "Stöd Ukraina",
    sponsors: "Sponsorer",
  },
  install: {
    name: "Installera",
    title: "Välj din webbläsare",
    subtitle: "Tillgängligt för Firefox och alla Chromium-webbläsare",
    title2: "Andra webbläsare",
    subtitle2: "Om din webbläsare ännu inte stöds, prova detta UserScript",
    title3: "Tredjepartsimplementeringar",
    subtitle3: "Inget ansvar från vår sida, använd på egen risk",
  },
  api: {
    name: "API",
    title: "Välkommen till de officiella RYD-dokumenten!",
    subtitle: "För att komma igång, välj ett avsnitt från menyn.",
    rights: {
      title: "Användningsrättigheter",
      subtitle:
        "Tredjepartsanvändning av detta öppna API är tillåtet med följande begränsningar:",
      bullet1: "Tillskrivning: ",
      bullet1text:
        "Detta projekt bör tydligt tillskrivas med antingen en länk till denna repo eller en länk till returnyoutubedislike.com",
      bullet2: "Satsbegränsning: ",
      bullet2text:
        "Det finns satsbegränsningar per användare med 100 per minut och 10000 per dag. Detta kommer att returnera en statushod 429 som indikerar att din applikation ska hålla sig borta",
    },
    url: {
      title: "Webbadressinformation",
      subtitle: "API:et är tillgängligt via följande baswebbadress: ",
    },
    endpoints: {
      title: "Tillgängliga slutpunkter",
      subtitle: "Lista över tillgängliga slutpunkter finns här: ",
    },
    fetching: {
      title: "Grundläggande handledning för hämtning",
      subtitle:
        "Exempel för att hämta röster för ett bestämt YouTubevideo-ID: ",
      title2: "Example Request: ",
      url: "Request URL: ",
      method: "Request Method: ",
      headers: "Headers: ",
      response: "Response: ",
      error1: 'Ett ogiltigt YouTube-ID returnerar statuskoden 404 "Not Found"',
      error2:
        'Ett felaktigt formaterat YouTube-ID returnerar 400 "Bad Request"',
    },
  },
  help: {
    name: "Hjälp",
    title: "Felsökning",
    bullet1:
      "Se till att du har den senaste versionen av tillägget installerat, ",
    bullet11: "just nu",
    bullet2:
      "Försök att avinstallera tillägget och installera det igen, starta sedan om webbläsaren (alla aktiva fönster, inte bara en flik)",
    bullet3: "Se till att den här länken öppnas: ",
    bullet31: "du bör se vanlig text: ",
    bullet4: "Om inget av ovanstående hjälper - rapportera ditt problem i",
    bullet41: "i vår",
    bullet4a:
      "Tala om för oss ditt operativsystem, webbläsarnamn och webbläsarversion",
    bullet4b:
      "Ta en skärmdump av sidan du har problem med (t.ex en youtube-videosida) med konsolfönstret öppet (tryck ",
    bullet4b1: ") - exempel på skärmdump nedan.",
    bullet4c:
      "Ta en skärmdump av tilläggssidan i din webbläsare med tillägg installerat.",
    bullet4c1: "För att se tilläggen skriv in detta i adressfältet: ",
    firefox: "för Firefox",
    chrome: "för Chrome, Edge, Brave, Opera och Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Vanliga frågor",
    subtitle: "Har du fortfarande frågor? Gå gärna med i vår Discord!",
    bullet1: "Var får tillägget sina data?",
    bullet1text:
      "En kombination av arkiverad data från innan det officiella YouTube ogilla-API:et stängdes av och och extrapolerat tilläggsanvändarbeteende.",
    bullet2: "Varför uppdateras inte antalet ogilla?",
    bullet2text:
      "Just nu cachelagras ogilla för videoklipp och de uppdateras inte särskilt ofta. Det varierar beroende på en videos popularitet, men det kan ta allt från några timmar till några dagar att uppdatera.",
    bullet3: "Hur fungerar detta?",
    bullet3text:
      "Tillägget samlar in video-ID:t för videon du tittar på och hämtar ogilla (and other fields like views, likes etc) med hjälp av vårt API. Tillägget visar sedan antalet ogilla och förhållandet på sidan. Om du gillar eller ogillar en video, spelas det in och skickas till databasen så att ett korrekt antal ogilla kan extrapoleras.",
    bullet4: "Kan jag dela mina antalet ogilla med dig?",
    bullet4text:
      "Kommer snart. Vi tittar på att använda Oauth eller ett annat skrivskyddat API med ett begränsat omfång så att kreatörer kan dela med sig av verifierbarheten av sina antal ogilla.",
    bullet5: "Vilken data samlar du in och hur behandlas den?",
    bullet5text:
      'Tillägget samlar bara in data som är absolut nödvändig för att den ska fungera korrekt, som IP-adressen eller ID:t på videon du tittar på. Inga uppgifter kommer någonsin att säljas till tredjepart. Om du vill veta mer om hur vi hanterar säkerhet och integritet läs då vår <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">vanliga frågor om säkerhet</a>.',
    bullet6: "Hur fungerar API/Backend?",
    bullet6text:
      "Backend använder arkiverad data från när YouTubes API fortfarande returnerade antalet ogilla. Inom en snar framtid kommer vi att tillåta innehållsskapare att enkelt och säkert skicka in sina ogilla och vi kommer att lägga till ArchiveTeams arkiverade data (4,56 miljarder videor) i vår nuvarande databas. Du kan också se en video om ämnet.",
    bullet7: "Varför visar antalet ogilla 'OGILLA ÄR INAKTIVERAT'?",
    bullet7text:
      "I bland kan en nyligen uppladdad video visa 'OGILLA ÄR INAKTIVERAT' även om ägaren inte har inaktiverat den. Detta beror på hur informationen om ogilla är inaktiverat hämtas ut. Det bör försvinna inom några timmar eller genom att gilla eller ogilla videon och uppdatera sidan (förhoppningsvis).",
  },
  donate: {
    name: "Donera",
    subtitle:
      "Du kan stöda våra ansträngningar att hålla internet fritt med en donation!",
  },
  links: {
    name: "Länkar",
    title: "Projektlänkar",
    subtitle: "Länkar till projektet och dess utvecklare",
    contact: "Kontakta mig",
    translators: "Översättare",
    coolProjects: "Häftiga projekt",
    sponsorBlockDescription: "Hoppar över annonser integrerade i videon",
    filmotDescription: "Sök efter YouTube-videor i undertexterna",
  },
};
