Read this in other languages: [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Polski](FAQpl.md)

# Häufig gestellte Fragen

## Bevor Sie eine Frage auf GitHub oder Discord stellen, sehen Sie bitte hier nach.

<br>

### **1. Woher stammt die Datenquelle dieser Erweiterung?**

Eine Kombination aus Google-APIs und gescrapten Daten.

Wir speichern alle verfügbaren Daten in unserer Datenbank, damit sie verfügbar sind, nachdem Google die Anzahl der Dislikes in ihrer API abschaltet.

<br>

### **2. Die Anzahl der Dislikes bei Videos aktualisiert sich nicht**

Aktuell werden die Dislikes bei Videos zwischengespeichert und nicht sehr häufig aktualisiert. Etwa alle 2-3 Tage, nicht öfter.

Ja, das ist nicht ideal, aber es ist wie es ist. Wir arbeiten daran, wie oft wir sie aktualisieren können, zu verbessern.

<br>

### **3. Wie funktioniert das?**

Die Erweiterung sammelt die Video-ID des von Ihnen angesehenen Videos, ruft die Dislikes (und andere Felder wie Aufrufe, Likes usw.) über unsere API ab. Wenn dies das erste Mal ist, dass das Video von unserer API abgerufen wurde, wird die YouTube-API verwendet, um die Daten zu erhalten. Anschließend werden die Daten für den Zwischenspeicher (ca. 2-3 Tage zwischengespeichert) und Archivierungszwecke in einer Datenbank gespeichert und an Sie zurückgegeben. Die Erweiterung zeigt Ihnen dann die Dislikes an.

<br>

### **4. Was passiert, wenn die YouTube-API aufhört, die Anzahl der Dislikes zurückzugeben?**

Der Backend wird auf eine Kombination aus archivierten Dislike-Statistiken, Schätzungen, die aus den Daten der Erweiterungsnutzer extrapoliert werden, und Schätzungen basierend auf Ansichts-/Like-Verhältnissen für Videos, deren Dislikes nicht archiviert wurden, und veralteten Dislike-Archiven umstellen.

<br>

### **5. Wie wird die Anzahl der Dislikes berechnet?**

RYD verwendet die Stimmen seiner Benutzer, um die Anzahl der Dislikes zu extrapolieren.

- Wenn das Video nach dem Abschalten der API hochgeladen wurde:

  $$ \textup{RYD Dislike Count} = \left( \frac{\textup{RYD Users Dislike Count}}{\textup{RYD Users Like Count}} \right) \times \textup{Public Like Count} $$

- Wenn die RYD-Datenbank auf irgendeine Weise die tatsächliche Anzahl von Likes und Dislikes enthielt (vom Ersteller bereitgestellt oder aus dem Archiv), wird die Anzahl der Dislikes basierend auf beiden - den Stimmen der Benutzer und dem archivierten Wert - berechnet. Der archivierte Wert wird mit zunehmendem Alter weniger Einfluss auf die endgültige Zählung haben.

<br>

---

Dies in Videoform

[![IReturn YouTube Dislike Explained](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Ich habe Sicherheits-/Privatsphärebedenken

Siehe [diese Seite](SECURITY-FAQde.md) für weitere Informationen.
