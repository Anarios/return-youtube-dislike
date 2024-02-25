Read this in other languages: [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Polski](SECURITY-FAQpl.md)


# Sicherheit

### Verfolgen Sie meine Anzeigehistorie?

Nein. Der Code der Erweiterung ist öffentlich und Sie können ihn selbst einsehen. Die einzige übermittelte Information ist die Video-ID, die benötigt wird, um die Anzahl der Dislikes für die Videos abzurufen. Es werden keine zusätzlichen Header gesendet. Über die Kommunikationsschicht wird Ihre öffentliche IP-Adresse an den Server übermittelt, sowie die Zeit, zu der die Anfrage gestellt wurde. Keine dieser Informationen identifiziert Sie auf eindeutige Weise. Unter der Annahme einer Zero-Trust-Umgebung ist das Beste, was wir bekommen können, eine dynamische IP. Die heute Ihnen gehört, gehört morgen Ihrem Nachbarn. Wenn Sie sich wirklich Sorgen machen, dass Ihre IP zurückverfolgt wird, verwenden Sie wahrscheinlich bereits ein VPN.

### Können Sie mich eindeutig identifizieren, wenn ich etwas dislike?

Ja. Wenn Sie ein Video nicht mögen, erstellen wir eine zufällig generierte eindeutige ID für Sie, die nicht mit Ihrem Google-Konto verknüpft ist. Dies geschieht, um das Botting zu verhindern. Es gibt jedoch keine Möglichkeit, diese zufällige ID mit Ihnen oder Ihrem persönlichen YouTube-Konto zu verknüpfen.

### Welche Informationen haben Sie genau?

Nur die Video-ID. Nicht Ihre Kommentare, nicht Ihren Benutzernamen, nicht mit wem Sie das Video geteilt haben, keine zusätzlichen Metadaten. Nichts. Nur die Video-ID.

### Wie wird meine IP gespeichert?

Der Backend speichert nicht gehashte IP-Adressen nur im flüchtigen Speicher (RAM). Diese Adressen werden nicht auf einer Festplatte gespeichert und daher nicht protokolliert. Wir hashen die IP-Adressen und speichern diese stattdessen. Dies geschieht, um Datenbankvandalismus zu verhindern.

### Ich habe etwas über OAuth gehört und den Zugriff auf mein YouTube-Konto!

Diese Funktion wird optional sein und sehr stark opt-in. Wenn Sie ein YouTube-Ersteller sind und Ihre Dislike-Statistiken mit uns teilen möchten, können Sie dies tun. Die Art und Weise, wie [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) strukturiert wurde, ist tatsächlich sehr sicher. Sie können den Zugriff auf Ihr Konto jederzeit widerrufen und uns sehr spezifische Berechtigungen erteilen. Wir werden nicht nach Berechtigungen fragen, die nicht erforderlich sind. Wir werden nur um Berechtigungen bitten, um Ihre Video-Statistiken anzeigen zu können.

### Wie kann ich diesem Dislike-Zähler vertrauen?

Wir haben Maßnahmen implementiert, um Bot-Angriffe zu verhindern, und werden weiterhin daran arbeiten, die Effektivität des Bot-Präventionssystems zu verbessern: Dies wird uns helfen, den Dislike-Zähler als gute Repräsentation der tatsächlichen Anzahl zu halten. Natürlich wird es nie zu 100% genau sein, also liegt es an Ihnen zu entscheiden, ob Sie dem Zähler vertrauen oder nicht.

### Warum teilen Sie den Backend-Code nicht?

Wir werden ihn irgendwann teilen - aber es gibt wirklich keinen echten Grund, ihn jetzt zu teilen. Es vermittelt ein falsches Sicherheitsgefühl - denn in einem Zero-Trust-System könnten wir genauso gut eine Version offenlegen, aber eine andere bereitstellen. Es gibt viele Gründe, den Code verborgen zu halten, insbesondere wie wir gegen Spam kämpfen. Das Verbergen/Verfremden des Spam-Behandlungscodes ist eine ziemlich standardmäßige Praxis.
