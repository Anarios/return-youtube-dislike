Read this in other languages: [беларуская](SECURITY-FAQbe.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md), [العربية](SECURITY-FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [Slovenščina](SECURITY-FAQsl.md)


# Sicherheit

### Verfolgen Sie meine Anzeigehistorie?

Die Erweiterung sendet die aktuelle Video-ID und, falls verfügbar, die angezeigte Anzahl der Likes an die API von Return
YouTube Dislike. Der Dienst benötigt diese Angaben, um die Anzahl der Dislikes zu schätzen und die Schätzung zu verbessern.
Bei der Anfrage erhält der Server auch übliche Netzwerkmetadaten wie Ihre öffentliche IP-Adresse und den Zeitpunkt der
Anfrage. Die Erweiterung sendet weder den Namen Ihres YouTube-Kontos noch YouTube-Kommentare, private YouTube-Daten oder
Inhalte von Seiten ohne Bezug zum Video. Sie führt keine separate lokale Liste der angesehenen Videos. In Firefox werden
Video-ID und Anzahl der Likes erst gesendet, wenn Sie die jeweilige Übertragung erlauben.

### Können Sie mich eindeutig identifizieren, wenn ich etwas dislike?

Wenn Sie zum ersten Mal abstimmen oder auf einen RYD-Kommentar reagieren, erstellt die Erweiterung eine dauerhafte
zufällige ID, um Missbrauch bei der Stimmabgabe zu verhindern. Beim Öffnen von Videos oder Lesen von Kommentaren wird
diese ID nicht gesendet. Sie wird weder aus Ihrem Google- oder YouTube-Konto abgeleitet noch damit verknüpft. Mozilla
stuft dauerhafte Kennungen als personenbezogene Daten ein. Die ID ermöglicht es dem Dienst, abgegebene Stimmen
derselben Installation der Erweiterung zuzuordnen.

### Welche Informationen haben Sie genau?

Abfragen der Dislike-Zahl enthalten die Video-ID und, falls verfügbar, die angezeigte Anzahl der Likes. Für die
Registrierung verwendet der Dienst eine zufällige Installations-ID. Er speichert übermittelte Stimmen mit dieser ID,
der Video-ID, der gewählten Stimme und dem Zeitpunkt. Reaktionen auf RYD-Kommentare verwenden dieselbe Installations-ID,
die Kommentar-ID und die gewählte Reaktion. Bei Stimmen und Reaktionen können auch die verwendete Erweiterung oder das
verwendete Nutzerskript, die jeweilige Version und, falls verfügbar, die Wiedergabeposition in ganzen Sekunden zum
Zeitpunkt des Klicks erfasst werden. Wenn Sie eine Reaktion zurücknehmen, markiert der Dienst den Eintrag als entfernt.
Kommentare und Antworten, die Sie in RYD veröffentlichen, sind unter Ihrem RYD-Namen öffentlich.

### Wie wird meine IP gespeichert?

Der Dienst speichert Ihre IP-Adresse und, falls verfügbar, die mit der Anfrage gesendete Browserkennung (User-Agent).
Er speichert diese Angaben zusammen mit abgeschlossenen Registrierungen, abgegebenen Stimmen, veröffentlichten Kommentaren
und Antworten sowie Reaktionen auf RYD-Kommentare. Der Dienst verwendet IP-Adressen zur Missbrauchsprävention und für
aggregierte Analysen. Er verkauft sie nicht und verwendet sie nicht für Werbung.

### Ich habe etwas über OAuth gehört und den Zugriff auf mein YouTube-Konto!

Diese Funktion wird optional sein und sehr stark opt-in. Wenn Sie ein YouTube-Ersteller sind und Ihre Dislike-Statistiken mit uns teilen möchten, können Sie dies tun. Die Art und Weise, wie [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) strukturiert wurde, ist tatsächlich sehr sicher. Sie können den Zugriff auf Ihr Konto jederzeit widerrufen und uns sehr spezifische Berechtigungen erteilen. Wir werden nicht nach Berechtigungen fragen, die nicht erforderlich sind. Wir werden nur um Berechtigungen bitten, um Ihre Video-Statistiken anzeigen zu können.

### Wie kann ich diesem Dislike-Zähler vertrauen?

Wir haben Maßnahmen implementiert, um Bot-Angriffe zu verhindern, und werden weiterhin daran arbeiten, die Effektivität des Bot-Präventionssystems zu verbessern: Dies wird uns helfen, den Dislike-Zähler als gute Repräsentation der tatsächlichen Anzahl zu halten. Natürlich wird es nie zu 100% genau sein, also liegt es an Ihnen zu entscheiden, ob Sie dem Zähler vertrauen oder nicht.

### Warum teilen Sie den Backend-Code nicht?

Wir werden ihn irgendwann teilen - aber es gibt wirklich keinen echten Grund, ihn jetzt zu teilen. Es vermittelt ein falsches Sicherheitsgefühl - denn in einem Zero-Trust-System könnten wir genauso gut eine Version offenlegen, aber eine andere bereitstellen. Es gibt viele Gründe, den Code verborgen zu halten, insbesondere wie wir gegen Spam kämpfen. Das Verbergen/Verfremden des Spam-Behandlungscodes ist eine ziemlich standardmäßige Praxis.
