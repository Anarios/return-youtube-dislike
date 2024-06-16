Lees dit in andere talen: [English](SECURITY_FAQ.md), [русский](SECURITY-FAQru.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [Deutsch](SECURITY-FAQde.md)

# Veiligheid

### Houd je mijn kijkgeschiedenis bij?

Nee. De code van de extensie is openbaar en u kunt deze zelf zien. De enige informatie die wordt verzonden, is de video-ID, die
nodig is om het aantal dislikes voor de video's op te halen. Er worden geen extra headers verzonden. Via de communicatielaag
wordt uw openbare IP-adres zichtbaar voor de server, evenals het tijdstip waarop het verzoek is gedaan. Geen van deze
identificeert u echter op enigerlei wijze uniek. Uitgaande van een zero-trust-omgeving, is het beste wat we kunnen krijgen een
dynamisch IP-adres. Wat vandaag van jou is, morgen van je buurman. Als u zich echt zorgen maakt dat uw IP-adres wordt
getraceerd, gebruikt u waarschijnlijk al een VPN.

### Kun je me uniek identificeren als ik een hekel heb?

Ja. Als je een video niet leuk vindt, maken we een willekeurig gegenereerde unieke ID voor je die niet is gekoppeld aan je
Google-account. Dit wordt gedaan om botting te voorkomen. Maar er is geen manier om deze willekeurige id aan jou of je
persoonlijke YouTube-account te koppelen.

### Welke informatie heb je precies?

Alleen de video-ID. Niet je opmerkingen, niet je gebruikersnaam, niet met wie je de video hebt gedeeld, geen aanvullende
metadata. Niks. Alleen de video-ID.

### Hoe wordt mijn IP opgeslagen?

De backend bewaart niet-gehashte IP-adressen alleen in vluchtig geheugen (RAM). Deze adressen worden niet opgeslagen op een
harde schijf en worden daarom niet gelogd. We hashen de IP-adressen en dat wordt in plaats daarvan opgeslagen. Dit wordt gedaan
om databasevandalisme te voorkomen.

### Ik hoorde wat discussie over OAuth en toegang tot mijn YouTube-account!

Deze functie zal optioneel zijn, en zeer veel opt-in. Als je een YouTube-creator bent en je wilt je afkeerstatistieken met ons delen, dan kan dat. De weg [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) gestructureerd was, is het eigenlijk heel veilig. U kunt op elk moment de toegang tot uw account intrekken en ons zeer specifieke machtigingen geven. We zullen geen toestemming vragen die niet vereist zijn. We vragen alleen toestemming om je videostatistieken te bekijken.

### Hoe kan ik deze afkeertelling vertrouwen?

We hebben maatregelen genomen om botaanvallen te voorkomen en zullen blijven werken aan het verbeteren van de effectiviteit van het botpreventiesysteem: dit zal ons helpen het aantal afkeer als een goede vertegenwoordiger van het werkelijke aantal te houden. Natuurlijk zal het nooit 100% nauwkeurig zijn, dus het is aan jou om te beslissen of je de telling vertrouwt of niet.

### Waarom deel je de backend-code niet?

We zullen het op een gegeven moment delen - maar er is echt geen echte reden om het nu te delen. Het geeft een vals gevoel van veiligheid - omdat we in een zero-trust-systeem net zo goed de ene versie kunnen onthullen, maar een andere kunnen implementeren. Er zijn tal van redenen om de code verborgen te houden, met name hoe we spam bestrijden. Het verbergen/verduisteren van de spamverwerkingscode is een vrij standaardpraktijk.
