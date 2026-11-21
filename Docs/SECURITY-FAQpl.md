Read this in other languages: [беларуская](SECURITY-FAQbe.md), [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Deutsch](SECURITY-FAQde.md), [العربية](SECURITY-FAQar.md), [Bahasa Indonesia](SECURITY-FAQid.md), [中文](SECURITY-FAQcn.md), [български](SECURITY-FAQbg.md), [Tiếng Việt](SECURITY-FAQvi.md), [Slovenščina](SECURITY-FAQsl.md)

# Security

### Czy śledzicie moją historię wyświetleń?

Rozszerzenie przesyła do API Return YouTube Dislike identyfikator aktualnego filmu oraz widoczną liczbę łapek w górę,
jeśli jest dostępna. Serwer potrzebuje tych danych, aby podać i doprecyzować szacowaną liczbę łapek w dół. Przy żądaniu
serwer otrzymuje też standardowe dane sieciowe, takie jak Twój publiczny adres IP i czas wysłania żądania. Rozszerzenie
nie przesyła nazwy Twojego konta YouTube, komentarzy z YouTube, prywatnych danych z YouTube ani treści innych stron.
Nie zapisuje też osobnej lokalnej historii oglądania. W przeglądarce Firefox identyfikator filmu i liczba łapek w górę
są przesyłane dopiero po wyrażeniu przez Ciebie zgody na każde z nich osobno.

### Czy możecie mnie jednoznacznie zidentyfikować, jeżeli zostawię łapkę w dół?

Gdy po raz pierwszy oddajesz głos lub reagujesz na komentarz w RYD, rozszerzenie tworzy stały losowy identyfikator,
który pomaga zapobiegać nadużyciom podczas głosowania. Rozszerzenie nie wysyła go, gdy otwierasz filmy lub czytasz
komentarze. Identyfikator nie jest tworzony na podstawie Twojego konta Google lub YouTube i nie jest z nim powiązany.
Mozilla zalicza stałe identyfikatory do danych osobowych. Dzięki temu identyfikatorowi serwis może powiązać oddane głosy
z tą samą instalacją rozszerzenia.

### Jakie informacje wy macie, konkretnie?

Żądania o liczbę łapek w dół zawierają identyfikator filmu oraz widoczną liczbę łapek w górę, jeśli jest dostępna.
Do rejestracji służy losowy identyfikator instalacji. Przy oddaniu głosu zapisujemy ten identyfikator, identyfikator filmu,
wybraną ocenę i czas oddania głosu. Przy reakcjach na komentarze w RYD zapisujemy ten sam identyfikator instalacji,
identyfikator komentarza i wybraną reakcję. Przy głosach i reakcjach serwis może również zapisać, którego rozszerzenia
lub skryptu użytkownika używasz, jego wersję oraz pozycję odtwarzania w chwili kliknięcia (w pełnych sekundach), jeśli
jest dostępna. Gdy usuwasz reakcję, serwis oznacza jej zapis jako usunięty. Opublikowane przez Ciebie komentarze i
odpowiedzi są widoczne publicznie pod Twoją nazwą użytkownika w RYD.

### Jak mój adres IP jest przechowywany?

Serwis zapisuje Twój adres IP. Jeśli żądanie zawiera opis przeglądarki (ciąg User-Agent), serwis zapisuje również ten
opis. Dane te są zapisywane przy zakończonych rejestracjach, oddanych głosach, opublikowanych komentarzach i
odpowiedziach oraz reakcjach na komentarze w RYD. Adresy IP służą do zapobiegania nadużyciom i zbiorczej analizy
danych. Nie sprzedajemy ich ani nie wykorzystujemy do celów reklamowych.

### Słyszałem jakąś dyskusję o OAuth, i dostępie do mojego konta YouTube.

Ta funkcjonalność będzie opcjonalna i z całą pewnością wymagała ręcznego dołączenia. Jeżeli jesteś twórcą na YouTube i chcesz podzielić się z nami swoimi statystykami, to możesz. Sposób w jaki [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) został ustrukturyzowany jest właściwie bardzo bezpieczny. Możesz wycofać dostęp do konta w każdej chwili i dać nam specyficzne uprawnienia. Nie będziemy prosić o żadne uprawnienia, które nie są wymagane. Poprosimy tylko o możliwość wyświetlenia statystyk filmów.

### Jak bardzo mogę ufać licznikowi łapek w dół?

Zaimplementowaliśmy środki zapobiegające atakom botów i będziemy kontynuować pracę nad systemem zapobiegającym botom: to pomoże nam utrzymać licznik łapek w dół jako dobrą reprezentację prawdziwej wartości. Oczywiście, wartość ta nigdy nie będzie w 100% dokładna, więc to czy zaufasz tej liczbie zależy tylko od Ciebie.

### Dlaczego nie udostępnicie kodu backendu?

Kiedyś go udostępnimy - ale nie ma za bardzo sensu robić to teraz. Wprowadziłoby to fałszywe poczucie bezpieczeństwa - bo w systemie zerowego zaufania równie dobrze moglibyśmy przedstawić jeden system, a uruchomić inny. Jest dużo powodów do ukrywania kodu, specyficznie do walki ze spamem. Ukrywanie/Obfuskacja kodu jest dość standardową praktyką.
