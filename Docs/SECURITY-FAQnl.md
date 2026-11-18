Lees dit in andere talen: [English](SECURITY_FAQ.md), [русский](SECURITY-FAQru.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY-FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md)

# Veiligheid

### Houd je mijn kijkgeschiedenis bij?

De extensie stuurt de ID van de huidige video en, als die beschikbaar is, het zichtbare aantal likes naar de API van
Return YouTube Dislike. De dienst gebruikt die gegevens om het aantal dislikes te schatten en die schatting te
verbeteren. Bij het verzoek krijgt de server ook gebruikelijke netwerkgegevens te zien, zoals je openbare IP-adres
en het tijdstip van het verzoek. De extensie stuurt geen YouTube-accountnaam, YouTube-opmerkingen, privégegevens van
YouTube of inhoud van pagina's die er niets mee te maken hebben. De extensie houdt geen aparte lokale lijst bij van
bekeken video's. In Firefox worden de video-ID en het aantal likes elk pas verzonden nadat je daarvoor toestemming
hebt gegeven.

### Kun je me uniek identificeren als ik een hekel heb?

Wanneer je voor het eerst stemt of op een RYD-opmerking reageert, maakt de extensie een blijvende willekeurige ID
aan om misbruik bij het stemmen te voorkomen. De extensie stuurt deze ID niet wanneer je een video opent of
opmerkingen leest. De ID is niet afgeleid van of gekoppeld aan je Google- of YouTube-account. Mozilla beschouwt
blijvende identificatoren als persoonsgegevens. Met de ID kan de dienst stemmen aan dezelfde installatie van de
extensie koppelen.

### Welke informatie heb je precies?

Een verzoek om het aantal dislikes bevat de video-ID en, als die beschikbaar is, het zichtbare aantal likes. Voor
registratie gebruikt de dienst een willekeurige installatie-ID. De dienst slaat verzonden stemmen op met die ID, de
video-ID, de gekozen stem en het tijdstip. Reacties op RYD-opmerkingen gebruiken dezelfde installatie-ID, de ID van
de opmerking en de gekozen reactie. Bij stemmen en reacties kunnen ook de gebruikte extensie of het gebruikte
gebruikersscript, de bijbehorende versie en, als die beschikbaar is, de afspeelpositie in hele seconden op het moment
van de klik worden vastgelegd. Als je een reactie intrekt, markeert de dienst de bijbehorende vermelding als verwijderd.
Opmerkingen en antwoorden die je in RYD plaatst, zijn openbaar onder je RYD-gebruikersnaam.

### Hoe wordt mijn IP opgeslagen?

De dienst slaat je IP-adres op en, indien beschikbaar, de browseridentificatie die bij het verzoek wordt
meegestuurd (de user-agent). De dienst bewaart deze gegevens bij voltooide registraties, uitgebrachte stemmen,
geplaatste opmerkingen en antwoorden en reacties op RYD-opmerkingen. IP-adressen worden gebruikt om misbruik te
voorkomen en voor geaggregeerde analyses. De dienst verkoopt ze niet en gebruikt ze niet voor advertenties.

### Ik hoorde wat discussie over OAuth en toegang tot mijn YouTube-account!

Deze functie zal optioneel zijn, en zeer veel opt-in. Als je een YouTube-creator bent en je wilt je afkeerstatistieken met ons delen, dan kan dat. De weg [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) gestructureerd was, is het eigenlijk heel veilig. U kunt op elk moment de toegang tot uw account intrekken en ons zeer specifieke machtigingen geven. We zullen geen toestemming vragen die niet vereist zijn. We vragen alleen toestemming om je videostatistieken te bekijken.

### Hoe kan ik deze afkeertelling vertrouwen?

We hebben maatregelen genomen om botaanvallen te voorkomen en zullen blijven werken aan het verbeteren van de effectiviteit van het botpreventiesysteem: dit zal ons helpen het aantal afkeer als een goede vertegenwoordiger van het werkelijke aantal te houden. Natuurlijk zal het nooit 100% nauwkeurig zijn, dus het is aan jou om te beslissen of je de telling vertrouwt of niet.

### Waarom deel je de backend-code niet?

We zullen het op een gegeven moment delen - maar er is echt geen echte reden om het nu te delen. Het geeft een vals gevoel van veiligheid - omdat we in een zero-trust-systeem net zo goed de ene versie kunnen onthullen, maar een andere kunnen implementeren. Er zijn tal van redenen om de code verborgen te houden, met name hoe we spam bestrijden. Het verbergen/verduisteren van de spamverwerkingscode is een vrij standaardpraktijk.
