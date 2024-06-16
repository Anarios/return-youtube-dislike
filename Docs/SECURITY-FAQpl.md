Read this in other languages: [English](SECURITY-FAQ.md), [русский](SECURITY-FAQru.md), [Nederlands](SECURITY_FAQnl.md), [Français](SECURITY-FAQfr.md), [Türkçe](SECURITY-FAQtr.md), [українська](SECURITY-FAQuk.md), [Deutsch](SECURITY-FAQde.md)

# Security

### Czy śledzicie moją historię wyświetleń?

Nie. Kod rozszerzenia jest publiczny i można samemu to zobaczyć. Jedyne informacje, które są wysyłane, to ID filmu, które jest wymagane do pobrania liczby łapek w dół dla filmów. Nie są wysyłane żadne dodatkowe nagłówki. W warstwie sieciowej, Twój adres IP będzie jawny dla serwera wraz z czasem wykonania żądania. Jednakże, żadne z tych danych nie identyfikują Ciebie jednoznacznie w żaden sposób. Zakładając środowisko zerowego zaufania, najczulsze dane, jakie możemy otrzymać, jest dynamiczny adres IP, który dzisiaj jest Twój, a jutro Twojego sąsiada. Jeżeli boisz się śledzenia poprzez adres IP, pewnie już korzystasz z VPN.

### Czy możecie mnie jednoznacznie zidentyfikować, jeżeli zostawię łapkę w dół?

Tak. Kiedy zostawiasz łapkę w dół, tworzymy losowo generowane ID dla Ciebie, które nie jest związane z Twoim kontem Google. Powodem takiego rozwiązania jest zapobieganie botowaniu. Mimo to, nie ma sposobu powiązania tego losowego ID z Tobą lub Twoim osobistym kontem Google.

### Jakie informacje wy macie, konkretnie?

Tylko ID filmu. Komentarze - nie. Nazwa użytkownika - nie. Osoby, którym udostępniłeś film - nie. Jakiekolwiek dodatkowe metadane - nie. Nic. Tylko ID filmu.

### Jak mój adres IP jest przechowywany?

Backend trzyma niehashowane adresy IP tylko w pamięci zmiennej (RAM). Te adresy nie są przechowywane na dysku twardym, przez co nie są rejestrowane. Zamiast tego przechowujemy zhashowany adres IP. Jest to zrobione po to aby zapobiec wandalizmom.

### Słyszałem jakąś dyskusję o OAuth, i dostępie do mojego konta YouTube.

Ta funkcjonalność będzie opcjonalna i z całą pewnością wymagała ręcznego dołączenia. Jeżeli jesteś twórcą na YouTube i chcesz podzielić się z nami swoimi statystykami, to możesz. Sposób w jaki [OAuth](https://en.wikipedia.org/wiki/OAuth#:~:text=but%20without%20giving%20them%20the%20passwords.) został ustrukturyzowany jest właściwie bardzo bezpieczny. Możesz wycofać dostęp do konta w każdej chwili i dać nam specyficzne uprawnienia. Nie będziemy prosić o żadne uprawnienia, które nie są wymagane. Poprosimy tylko o możliwość wyświetlenia statystyk filmów.

### Jak bardzo mogę ufać licznikowi łapek w dół?

Zaimplementowaliśmy środki zapobiegające atakom botów i będziemy kontynuować pracę nad systemem zapobiegającym botom: to pomoże nam utrzymać licznik łapek w dół jako dobrą reprezentację prawdziwej wartości. Oczywiście, wartość ta nigdy nie będzie w 100% dokładna, więc to czy zaufasz tej liczbie zależy tylko od Ciebie.

### Dlaczego nie udostępnicie kodu backendu?

Kiedyś go udostępnimy - ale nie ma za bardzo sensu robić to teraz. Wprowadziłoby to fałszywe poczucie bezpieczeństwa - bo w systemie zerowego zaufania równie dobrze moglibyśmy przedstawić jeden system, a uruchomić inny. Jest dużo powodów do ukrywania kodu, specyficznie do walki ze spamem. Ukrywanie/Obfuskacja kodu jest dość standardową praktyką.
