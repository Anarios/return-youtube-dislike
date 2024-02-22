import { nl } from "vuetify/src/locale";

export default {
  ...nl,
  home: {
    name: "Home",
    title: "Return YouTube Dislike",
    subtitle:
      "Browser-extensie en een API die je antipathieën op YouTube laat zien",
    ukraine: "Support Ukraine",
    sponsors: "Sponsors",
  },
  install: {
    name: "Installeren",
    title: "Kies je platform",
    subtitle: "Beschikbaar voor Firefox en alle Chromium-browsers",
    title2: "Andere Platformen",
    subtitle2:
      "Als uw browser nog niet wordt ondersteund, probeer dan dit UserScript",
    title3: "Implementaties van derden",
    subtitle3: "Geen aansprakelijkheid aan onze kant, gebruik op eigen risico",
  },
  api: {
    name: "API",
    title: "Welkom bij de officiële RYD-documenten!",
    subtitle: "Selecteer een sectie in het menu om aan de slag te gaan.",
    rights: {
      title: "Gebruiksrechten",
      subtitle:
        "Gebruik door derden van deze open API is toegestaan met de volgende beperkingen:",
      bullet1: "Attributie: ",
      bullet1text:
        "Dit project moet duidelijk worden toegeschreven met een link naar deze repo of een link om terug te keren naar youtubedislike.com",
      bullet2: "Snelheidsbeperking: ",
      bullet2text:
        "Er zijn per klant tarieflimieten in plaats van 100 per minuut en 10.000 per dag. Dit geeft een 429-statuscode terug die aangeeft dat uw toepassing moet worden uitgeschakeld",
    },
    url: {
      title: "URL Informatie",
      subtitle: "De API is toegankelijk via de volgende basis-URL: ",
    },
    endpoints: {
      title: "Beschikbare eindpunten",
      subtitle: "Lijst met beschikbare eindpunten is hier beschikbaar: ",
    },
    fetching: {
      title: "Basiscursus ophalen",
      subtitle:
        "Voorbeeld om stemmen te krijgen voor een bepaalde YouTube-video-ID: ",
      title2: "Voorbeeld aanvraag: ",
      url: "Verzoek-URL: ",
      method: "Verzoekmethode:: ",
      headers: "Koppen: ",
      response: "Antwoord: ",
      error1:
        'Een ongeldige YouTube-ID retourneert statuscode 404 "Niet gevonden"',
      error2:
        'Een onjuist opgemaakte YouTube-ID retourneert 400 "Slecht verzoek"',
    },
  },
  help: {
    name: "Help",
    title: "Probleemoplossen",
    bullet1:
      "Zorg ervoor dat u de nieuwste versie van de extensie hebt geïnstalleerd, ",
    bullet11: "direct",
    bullet2:
      "Probeer de extensie te verwijderen en opnieuw te installeren, en start vervolgens de browser opnieuw (alle actieve vensters, niet slechts één tabblad)",
    bullet3: "Zorg ervoor dat deze link opent: ",
    bullet31: "je zou platte tekst moeten zien: ",
    bullet4: "Als niets van het bovenstaande helpt - meld uw probleem dan in",
    bullet41: "in onze",
    bullet4a: "Vertel ons uw besturingssysteem, browsernaam en browserversie",
    bullet4b:
      "Maak een screenshot van de pagina met het probleem (d.w.z. de YouTube-videopagina) met de console open (druk op ",
    bullet4b1: ") - voorbeeld screenshot hieronder.",
    bullet4c:
      "Maak een screenshot van de extensiepagina van uw browser waarop de extensie is geïnstalleerd.",
    bullet4c1: "Om extensies te zien, plaats dit in de adresbalk: ",
    firefox: "voor Firefox",
    chrome: "voor Chrome, Edge, Brave, Opera, Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Veel Gestelde Vragen",
    subtitle:
      "Heeft u nog vragen? Voel je vrij om lid te worden van onze Discord!",
    bullet1: "Waar haalt de extensie zijn gegevens vandaan?",
    bullet1text:
      "Een combinatie van gearchiveerde gegevens van voordat de officiële YouTube-dislike-API werd afgesloten, en geëxtrapoleerd gebruikersgedrag van extensies.",
    bullet2: "Waarom wordt het aantal dislikes niet bijgewerkt?",
    bullet2text:
      "Op dit moment worden video's die niet leuk zijn in de cache opgeslagen en worden ze niet vaak bijgewerkt. Het varieert afhankelijk van de populariteit van een video, maar het kan een paar uur tot een paar dagen duren om te updaten.",
    bullet3: "Hoe werkt dit?",
    bullet3text:
      "De extensie verzamelt de video-ID van de video die je aan het bekijken bent en haalt de afkeer (en andere velden zoals weergaven, vind-ik-leuks enz.) op met behulp van onze API. De extensie geeft vervolgens het aantal dislikes en de verhouding weer op de pagina. Als je een video leuk of niet leuk vindt, wordt deze opgenomen en naar de database gestuurd, zodat een nauwkeurige telling van de dislikes kan worden geëxtrapoleerd.",
    bullet4: "Kan ik mijn niet leuk-teller met je delen?",
    bullet4text:
      "Binnenkort beschikbaar. We onderzoeken het gebruik van Oauth of een andere alleen-lezen API met een beperkte reikwijdte, zodat makers hun afkeer-aantallen verifieerbaarheid kunnen delen.",
    bullet5: "Welke gegevens verzamelt u en hoe worden deze verwerkt?",
    bullet5text:
      'De extensie verzamelt alleen gegevens die strikt noodzakelijk zijn om goed te kunnen functioneren, zoals het IP-adres of de ID van de video die u bekijkt. Geen van uw gegevens zal ooit worden verkocht aan derden. Als u meer wilt weten over hoe wij omgaan met beveiliging en privacy, bekijk dan onze <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">beveilings FAQ</a>.',
    bullet6: "Hoe werkt de API/Backend?",
    bullet6text:
      "De backend gebruikt gearchiveerde gegevens van toen de youtube-api nog steeds het aantal dislikes retourneerde, extensiegebruikers zoals het aantal likes/dislikes en extrapolatie. In de nabije toekomst zullen we het voor makers van inhoud mogelijk maken om eenvoudig en veilig hun afkeuren-aantal in te dienen en we zullen de gearchiveerde gegevens van ArchiveTeam (4,56 miljard video's) toevoegen aan onze huidige database. U kunt ook een video over het onderwerp bekijken.",
    bullet7:
      "Waarom wordt bij het aantal dislikes 'DISLIKES DISABLED' weergegeven?",
    bullet7text:
      "Soms kan een recent geüploade video 'DISLIKES UITGESCHAKELD' weergeven, zelfs als de maker dit niet heeft uitgeschakeld. Dit komt door de manier waarop we detecteren of dislikes zijn uitgeschakeld, het zou binnen een paar uur moeten verdwijnen of door de video leuk of niet leuk te vinden en de pagina vernieuwen (hopelijk).",
  },
  donate: {
    name: "Doneer",
    subtitle:
      "Met een donatie kunt u onze inspanningen om het internet gratis te houden steunen!",
  },
  links: {
    name: "Linken",
    title: "Project Linken",
    subtitle: "Linken naar het project en zijn ontwikkelaars",
    contact: "Neem contact op met me",
    translators: "Vertalers",
    coolProjects: "Coole Projecten",
    sponsorBlockDescription: "In video geïntegreerde advertenties overslaan",
    filmotDescription: "Zoek YouTube-video's op ondertiteling",
  },
};
