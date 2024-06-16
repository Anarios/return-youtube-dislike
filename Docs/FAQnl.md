Lees dit in andere talen: [Engels](FAQ.md), [русский](FAQru.md), [Français](FAQfr.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md), [Deutsch](FAQde.md)

# Veel Gestelde Vragen

## Raadpleeg deze voordat u een vraag stelt op GitHub of Discord.

<br>

### **1. Waar haalt deze extensie de gegevens vandaan?**

Een combinatie van Google API's en geschraapte gegevens.

We slaan alle beschikbare gegevens op in onze database, zodat deze beschikbaar is nadat Google het aantal dislikes in hun API heeft stopgezet.

<br>

### **2. Het aantal video-dislikes wordt niet bijgewerkt**

Op dit moment worden video's die niet leuk zijn in het cachegeheugen opgeslagen en worden niet erg vaak bijgewerkt. Eens in de 2-3 dagen, niet vaker.

Ja, het is niet ideaal, maar het is wat het is. Werken aan het verbeteren van hoe vaak we ze kunnen bijwerken.

<br>

### **3. Hoe werkt dit?**

De extensie verzamelt de video-ID van de video die je aan het bekijken bent, haalt de dislike (en andere velden zoals views, likes etc) op met behulp van onze API. Als dit de eerste keer is dat de video wordt opgehaald door onze API, zal deze de YouTube API gebruiken om de gegevens op te halen, slaat de gegevens vervolgens op in een database voor caching (cache voor ongeveer 2-3 dagen) en archiveringsdoeleinden en stuurt ze naar u terug. De extensie geeft vervolgens de antipathieën aan u weer.

<br>

### **4. Wat gebeurt er nadat de YouTube API stopt met het teruggeven van het aantal dislikes?**

De backend zal overschakelen naar het gebruik van een combinatie van afkeer statistieken en afkeer archieven, schattingen geëxtrapoleerd uit gebruikersgegevens van extensies en schattingen op basis van weergave/vind-ik-leuk-verhoudingen voor video's waarvan de afkeuren niet zijn gearchiveerd en voor verouderde afkeer-archieven.

<br>

### **5. Hoe wordt het aantal dislikes berekend?**

RYD gebruikt de stemmen van zijn gebruikers om het aantal dislikes te extrapoleren.

- Als de video is geüpload nadat de API was afgesloten:

  $$ \textup{RYD Dislike Count} = \left( \frac{\textup{RYD Users Like Count}}{\textup{RYD Users Dislike Count}} \right) \times \textup{Public Like Count} $$

- Als de RYD-database op de een of andere manier het werkelijke aantal likes en dislikes had (geleverd door de uploader of uit het archief), wordt het aantal dislikes berekend op basis van zowel de stemmen van de gebruikers als de gearchiveerde waarde. De gearchiveerde waarde heeft minder invloed op de uiteindelijke telling naarmate deze ouder wordt.

<br>

---

Dit in videovorm

[![IReturn YouTube Dislike Uitgelegd (Engels)](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Ik heb zorgen over de beveiliging/privacy

Bekijk [deze pagina](SECURITY-FAQnl.md) voor meer informatie.
