Read this in other languages: [English](CONTRIBUTING.md), [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Deutsch](CONTRIBUTINGde.md)

# Witamy w przewodniku współtworzenia Return YouTube Dislike

Dziękujemy za zainwestowanie czasu w rozwój naszego projektu! Wszystkie Twoje zmiany znajdą się w następnej wersji rozszerzenia ([bądź strony](https://www.returnyoutubedislike.com/)).

## Początek

Prosimy używać Prettier z domyślnymi ustawieniami do formatowania.

#### Wymagania wstępne

Musisz mieć zainstalowane node i npm, aby utworzyć dołączoną wersję źródła.

Wersje używane przy ustawianiu:

- node: 12.18.4
- npm: 6.14.6

Aby utworzyć `bundled-content-script.js`, które zawiera większość logiki tego rozszerzenia, musisz najpierw zainstalować wszystkie zależności.

1. Przejdź do korzenia tego repo i uruchom:

```
npm install
```

2. Użyj polecenia poniżej aby stworzyć `bundled-content-script.js`, które jest używane w `manifest.json`

```
npm start // aby utworzyć plik(i) build-u i uruchomić obserwatora pliku, który przeładowuje po zapisie

// lub

npm run build // aby jednorazowo utworzyć plik(i) build-u
```

Gratulacje, jesteś gotów pisać!

Jeśli jesteś nowy w pisaniu rozszerzeń do Chrome, lub potrzebujesz dodatkowej pomocy, obejrzyj [ten poradnik na YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Problemy

#### Otwieranie nowego problemu

Jeśli masz jakiekolwiek problemy z rozszerzeniem, najpierw wyszukaj go aby upewnić się, że dany problem nie został już zgłoszony. Jeżeli nie, otwórz problem. Używanie formularza problemu jest zalecane, ale nie jest konieczne.

#### Rozwiązywanie problemu

Jeżeli znalazłeś problem, który myślisz, że jesteś w stanie rozwiązać, nie wstydź się. Otwórz PR z fix-em i opisz problem, który naprawiasz.

### Prośba o funkcjonalność

#### Otwieranie nowej prośby o funkcjonalność

Jeżeli masz pomysł na rozszerzenie, śmiało otwórz nowe żądanie o funkcjonalność, ale prosimy o wyszukanie swojego pomysłu, aby upewnić się, że nie został on już zasugerowany. Używanie formularza jest zalecane, ale nie jest konieczne.

#### Implementacja prośby o funkcjonalność

Jeżeli znalazłeś pomysł na funkcjonalność, którą myślisz, że jesteś w stanie zaimplementować, nie wstydź się. Otwórz PR z fix-em, i opisz funkcjonalność, którą implementujesz.

### Jakie PR-y przyjmujemy?

- Naprawy problemów.
- Implementacja funkcjonalności.
- Literówki lub lepsze i łatwiejsze w zrozumieniu słowa.
- Współtworzenie strony.
