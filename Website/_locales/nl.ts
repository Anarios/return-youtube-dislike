import { en } from "vuetify/src/locale";

export default {
  ...en,
  home: {
    name: "Home",
    title: "Breng YouTube Dislike terug",
    subtitle: "Browser extensie en API die dislikes op Youtube weergeeft",
    ukraine: "Steun Oekraïne",
    sponsors: "Sponsors",
  },
  install: {
    name: "Installeer",
    title: "Selecteer Jou Platform",
    subtitle: "Beschikbaar voor Firefox en alle Chromium browsers",
    title2: "Andere Platforms",
    subtitle2: "Als jou browser er niet bij staat, probeer dan dit UserScript",
    title3: "Third Party Implementations",
    subtitle3: "Wij zijn niet aansprakelijk, gebruik op eigen risico",
  },
  api: {
    name: "API",
    title: "Welkom bij de API!",
    subtitle: "Om te beginnen, klik op een selectie in het menu.",
    rights: {
      title: "Gebruiksrechten",
      subtitle:
        "Gebruik van de API is gratis, maar we vragen je om de volgende voorwaarden te respecteren:",
      bullet1: "Attributie: ",
      bullet1text:
        "Het project moet een link bevatten naar deze repo of direct naar returnyoutubedislike.com",
      bullet2: "Rate Limiting: ",
      bullet2text:
        "Dit zijn per client rate limits van 100 per minuut en 10.000 per dag. Dit zal een 429 status code teruggeven die aangeeft dat jouw applicatie moet afremmen",
    },
    url: {
      title: "URL Informatie",
      subtitle: "De API is toegankelijk via de volgende basis URL: ",
    },
    endpoints: {
      title: "Beschikbare Endpoints",
      subtitle: "Lijst van beschikbare endpoints is hier beschikbaar: ",
    },
    fetching: {
      title: "Basis Fetching Tutorial",
      subtitle: "Voorbeeld om de stemmen van een gegeven YouTube-video-ID te krijgen: ",
      title2: "Voorbeeld Request: ",
      url: "Request URL: ",
      method: "Request Methode: ",
      headers: "Headers: ",
      response: "Response: ",
      error1: "Een ongeldige YouTube-ID zal statuscode 404 'Not Found' teruggeven",
      error2:
        "Een onjuist geformatteerde YouTube-ID zal statuscode 400 'Bad Request' teruggeven",
    },
  },
  help: {
    name: "Help",
    title: "Probleemoplossing",
    bullet1: "Zorg ervoor dat je de laatste versie van de extensie hebt geïnstalleerd, ",
    bullet11: "op dit moment",
    bullet2:
      "Probeer de extensie te verwijderen en opnieuw te installeren, start daarna de browser opnieuw op (alle actieve vensters, niet alleen één tabblad)",
    bullet3: "Wees er zeker van dat deze link opent: ",
    bullet31: "Je moet dit zien: ",
    bullet4: "Als niets van bovenstaande helpt - rapporteer je probleem in",
    bullet41: "in onze",
    bullet4a: "Vertel ons jouw besturingssysteem, browsernaam en browserversie",
    bullet4b:
      "Neem een screenshot van de pagina met het probleem (bijv. een YouTube-video pagina) met de console open (druk op ",
    bullet4b1: ") - voorbeeld screenshot hieronder.",
    bullet4c:
          "Neem een schermafdruk van de extensie pagina van je browser met de extensie geïnstalleerd.",
    bullet4c1: "Om extensies te zien, voer dit in in de adresbalk: ",
    firefox: "voor Firefox",
    chrome: "voor Chrome, Edge, Brave, Opera, Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Veelgestelde vragen",
    subtitle: "Heb je nog vragen? Stel ze in onze Discord",
    bullet1: "Waar haalt de extensie de dislike data vandaan?",
    bullet1text:
      "Een combinatie van gearchiveerde gegevens van voor de officiële YouTube-dislike-API werd afgesloten en extrapolatie van gebruikersgedrag van de extensie.",
    bullet2: "Waarom worden de dislikes niet geupdate?",
    bullet2text:
      "Momenteel worden video dislikes gecached en worden ze niet vaak bijgewerkt. Dit varieert afhankelijk van de populariteit van een video, maar kan tussen een paar uur en een paar dagen duren voordat ze worden bijgewerkt.",
    bullet3: "Hoe werkt het?",
    bullet3text:
      "De extensie verzamelt het video ID van de video die je bekijkt en haalt de dislike (en andere velden zoals weergaven, likes enz.) Op met behulp van onze API. De extensie toont vervolgens het aantal dislikes en het percentage op de pagina. Als je een video leuk vindt of niet, wordt dat opgeslagen en naar de database verzonden zodat een nauwkeurig aantal dislikes kan worden afgeleid.",
    bullet4: "Kan ik mijn dislikes delen met jou?",
    bullet4text:
      "Komt binnenkort. We zijn bezig met het gebruik van Oauth of een andere alleen-lezen-API met een beperkte scope, zodat makers hun ongeldige afkeuringsaantallen kunnen delen.",
    bullet5: "Wat verzamelen we en waarom?",
    bullet5text:
      "De extensie verzamelt alleen gegevens die strikt noodzakelijk zijn voor het correct functioneren, zoals het IP-adres of het ID van de video die u bekijkt. Geen van uw gegevens zal ooit worden verkocht aan derden. Als u meer wilt weten over hoe we omgaan met beveiliging en privacy, bekijk dan onze <a href = ",
    bullet6: "How does the API/Backend work?",
    bullet6text:
      "De backend gebruikt gearchiveerde gegevens van toen de YouTube API nog steeds de dislike-telling teruggaf, de like/dislike-telling van extensiegebruikers en extrapolatie. In de nabije toekomst zullen we content creators de mogelijkheid geven om hun dislike-telling gemakkelijk en veilig in te dienen en zullen we de gegevens van ArchiveTeam (4,56 miljard video's) toevoegen aan onze huidige database. Je kunt ook een video bekijken over het onderwerp.",
    bullet7: "Waarom toont de dislike-teller 'DISLIKES UITGESCHAKELD'?",
    bullet7text:
      "Soms kan een recent geüploade video 'DISLIKES DISABLED' weergeven, zelfs als de maker het niet heeft uitgeschakeld. Dit is te wijten aan hoe we detecteren of dislikes zijn uitgeschakeld. Het zou in een paar uur moeten verdwijnen of door het video te liken of disliken en de pagina te vernieuwen (hopelijk).",
  },
  donate: {
    name: "Doneer",
    subtitle:
      "Je kan ons steunen om het internet vrij te houden met een donatie!",
  },
  links: {
    name: "Links",
    title: "Project Links",
    subtitle: "Links naar het project en de ontwikkelaars",
    contact: "Contacteer ons",
    translators: "Vertalers",
    coolProjects: "Coole Projecten",
    sponsorBlockDescription: "Sla reclame binnen videos over",
    filmotDescription: "Zoek videos op basis van subtitels",
  },
};
