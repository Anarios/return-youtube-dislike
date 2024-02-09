Read this in other languages: [English](FAQ.md), [русский](FAQru.md), [Français](FAQfr.md), [Nederlands](FAQnl.md), [Türkçe](FAQtr.md), [українська](FAQuk.md), [Deutsch](FAQde.md)

# Często zadawane pytania

## Przeczytaj poniższe przed zadawaniem pytań na GitHubie lub Discordzie.

<br>

### **1.Skąd rozszerzenie otrzymuje swoje dane?**

Kombinacja API Google i danych scrape-owanych.

Zapisujemy wszystkie dostępne dane do naszej bazy danych, żeby były dostępne po tym jak Google wyłączy liczniki łapek w dół w swoim API.

<br>

### **2. Licznik łapek w dół się nie aktualizuje**

Na chwile obecną łapki w dół są buforowane i nie są bardzo często aktualizowane. Raz na 2-3 dni, nie częściej.

No nie jest to idealne, ale tak już jest. Pracujemy nad tym jak częściej możemy to aktualizować.

<br>

### **3. Jak to działa?**

Rozszerzenie zbiera ID filmu, którego oglądasz, pobiera ilość łapek w dół (i inne pola, takie jak wyświetlenia, łapki w górę itd.) za pomocą naszego API. Jeżeli film jest pierwszy raz pobrany przez nasze API, zostanie użyte YouTube API do pobrania danych, a potem przechowania w bazie danych do buforu (przez jakieś 2-3 dni) i archiwizacji, po czym zwracane jest Tobie. Rozszerzenie potem wyświetla ilość łapek w dół.

<br>

### **4. Co się wydarzy gdy YouTube API przestanie zwracać liczbę łapek w dół?**

Backend przełączy się na używanie kombinacji zarchiwizowanych statystyk łapek w dół, szacunków ekstrapolowanych z danych użytkowników rozszerzenia i szacowań opartych na stosunkach wyświetleń/łapek w górę dla filmów, których ilość łapek w dół nie została zarchiwizowana i dla przestarzałych archiwów.

<br>

### **5. Jak wyliczana jest liczba łapek w dół?**

RYD używa głosów użytkowników, aby ekstrapolować liczbę łapek w dół.

- Jeżeli film został wrzucony przed wyłączeniem API:

  $$ \textup{Liczba łapek w dół RYD} = \left( \frac{\textup{Liczba łapek w dół użytkowników RYD}}{\textup{Liczba łapek w górę użytkowników RYD}} \right) \times \textup{Publiczna liczba łapek w górę} $$

- Jeśli baza danych RYD jakimś cudem miałaby prawidłową liczbę łapek w górę i dół (zapewnione przez twórce lub z archiwum), liczba łapek w dół będzie obliczana w oparciu jednocześnie głosów użytkowników i wartości zarchiwizowanych. Zarchiwizowana wartość będzie miała mniejszy wpływ na ostateczną liczbę z biegiem czasu.

<br>

---

To samo w formie filmu.

[![IReturn YouTube Dislike Explained](https://yt-embed.herokuapp.com/embed?v=GSmmtv-0yYQ)](https://www.youtube.com/watch?v=GSmmtv-0yYQ)

---

<br>

## Mam zastrzeżenia co do bezpieczeństwa / prywatności

Przejdź [tutaj](SECURITY-FAQ.md) aby uzyskać więcej informacji.
