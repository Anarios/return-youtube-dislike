import { pl } from "vuetify/src/locale";
// by itsbudyn#6502
export default {
  ...pl,
  home: {
    name: "Strona główna",
    title: "Return YouTube Dislike",
    subtitle:
      "Rozszerzenie do przeglądarki i API pokazujące ilość łapek w dół na YouTube",
    ukraine: "Wesprzyj Ukrainę",
    sponsors: "Sponsorzy",
  },
  install: {
    name: "Instalacja",
    title: "Wybierz swoją platformę",
    subtitle: "Dostępne dla Firefox i wszystkich przeglądarek Chromium",
    title2: "Inne platformy",
    subtitle2:
      "Jeżeli twoja przeglądarka nie jest wspierana, wypróbuj ten UserScript",
    title3: "Implementacje od stron trzecich",
    subtitle3:
      "Nie ponosimy za nie odpowiedzialności, używasz na własne ryzyko",
  },
  api: {
    name: "API",
    title: "Witamy w oficjalnej dokumentacji RYD!",
    subtitle: "Aby rozpocząć, wybierz sekcję z menu.",
    rights: {
      title: "Prawa do użytku",
      subtitle:
        "Używanie tego otwartego API jest dozwolone z następującymi ograniczeniami:",
      bullet1: "Przypisanie: ",
      bullet1text:
        "Ten projekt powinien być widocznie przypisany autorom za pomocą linku do tego repozytorium, albo do returnyoutubedislike.com",
      bullet2: "Ograniczenia: ",
      bullet2text:
        "Istnieją ograniczenia żądań dla klientów - 100 na minutę, oraz 10 000 na dzień. Przekroczenie będzie sygnowane zwrotem kodu 429 wskazujący, że Twoja aplikacja powinna przyhamować. ",
    },
    url: {
      title: "Informacje o URL",
      subtitle: "API jest dostępne przez następujące bazowe URL: ",
    },
    endpoints: {
      title: "Dostępne endpointy",
      subtitle: "Lista dostępnych endpointów znajduje się tutaj: ",
    },
    fetching: {
      title: "Poradnik - Podstawowe pobieranie",
      subtitle:
        "Przykład pozwalający otrzymać głosy z danego ID filmu na YouTube: ",
      title2: "Przykładowe żądanie: ",
      url: "URL żądania: ",
      method: "Metoda żądania: ",
      headers: "Nagłówki: ",
      response: "Odpowiedź: ",
      error1: 'Nieprawidłowy ID filmu zwróci kod 404 "Not Found"',
      error2:
        'Nieprawidłowo sformatowany ID filmu zwróci kod 400 "Bad Request"',
    },
  },
  help: {
    name: "Pomoc",
    title: "Rozwiązywanie problemów",
    bullet1:
      "Upewnij się, że masz zainstalowaną najnowszą wersję rozszerzenia, ",
    bullet11: "obecnie.",
    bullet2:
      "Spróbuj usunąć rozszerzenie i zainstalować je ponownie, a następnie zrestartować przeglądarkę (wszystkie aktywne okna, nie tylko jedną kartę)",
    bullet3: "Upewnij się, że ten link się otwiera: ",
    bullet31: "powinno się wyświetlić w czystym tekście: ",
    bullet4: "Jeśli nic powyżej nie pomoże - zgłoś problem na",
    bullet41: "na naszym",
    bullet4a:
      "Powiedz z jakiego systemu operacyjnego korzystasz, oraz podaj nazwę i wersję przeglądarki",
    bullet4b:
      "Wykonaj zrzut ekranu problematycznej strony (tj. strony filmu na YouTube) z otwartą konsolą (naciśnij ",
    bullet4b1: ") - przykładowy zrzut poniżej.",
    bullet4c:
      "Wykonaj zrzut ekranu strony z rozszerzeniami Twojej przeglądarki, wraz z zainstalowanym rozszerzeniem.",
    bullet4c1: "Aby zobaczyć rozszerzenia, wklej do paska adresowego: ",
    firefox: "dla Firefox",
    chrome: "dla Chrome, Edge, Brave, Opera oraz Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Często zadawane pytania",
    subtitle: "Wciąż masz pytania? Zapraszamy na naszego Discorda!",
    bullet1: "Skąd rozszerzenie otrzymuje swoje dane?",
    bullet1text:
      "Kombinacja danych zarchiwizowanych przed wyłączeniem oficjalnego API do łapek w dół, oraz ekstrapolowane zachowania użytkowników rozszerzenia.",
    bullet2: "Dlaczego licznik łapek w dół się nie aktualizuje?",
    bullet2text:
      "Na chwilę obecną łapki w dół są buforowane i nie są często aktualizowane. Zależy to od popularności filmu, jednak może to zająć klika godzin lub kilka dni żeby licznik został zaktualizowany. ",
    bullet3: "Jak to działa?",
    bullet3text:
      "Rozszerzenie pobiera ID filmu, który oglądasz, a następnie używając naszego API pobiera liczbę łapek w dół (oraz inne pola, takie jak wyświetlenia, łapki w górę itd.). Rozszerzenie potem wyświetla liczbę łapek w dół oraz proporcje łapek na stronie. Jeżeli dasz filmowi łapkę w górę bądź w dół, ta akcja zostanie zarejestrowana i wysłana do bazy danych, aby dokonać ekstrapolacji dokładnej liczby łapek w dół.",
    bullet4: "Czy mogę Wam udostępnić liczbę łapek w dół na moich filmach?",
    bullet4text:
      "Wkrótce. Przyglądamy się możliwościom użycia OAuth lub innego klucza API tylko do odczytu z ograniczonym zakresem, aby twórcy mogli udostępniać zweryfikowaną liczbę swoich łapek w dół.",
    bullet5: "Jakie dane zbieracie i co z nimi robicie?",
    bullet5text:
      'Rozszerzenie zbiera tylko dane wymagane do poprawnego działania, takie jak adres IP lub ID oglądanego filmu. Dane te nigdy nie będą sprzedane osobom trzecim. Jeżeli chcesz przeczytać więcej o tym, jak radzimy sobie z bezpieczeństwem i prywatnością, sprawdź nasze <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">FAQ bezpieczeństwa</a>.',
    bullet6: "Jak działa API/Backend?",
    bullet6text:
      "Backend używa danych zarchiwizowanych w momencie, gdy API YouTube wciąż zwracało liczby łapek w dół, oraz danych zebranych i ekstrapolowanych od użytkowników rozszerzenia. W niedalekiej przyszłości pozwolimy twórcom łatwo i bezpieczne udostępniać swoje liczniki łapek w dół oraz będziemy dodawać dane zarchiwizowane przez ArchiveTeam (4,56 miliardów filmów) do naszej bazy danych. Można też obejrzeć film na ten temat. ",
    bullet7: "Dlaczego licznik łapek w dół pokazuje 'WYŁĄCZONE PRZEZ TWÓRCĘ'?",
    bullet7text:
      "Czasami świeżo wrzucony film pokazuje 'WYŁĄCZONE PRZEZ TWÓRCĘ' nawet wtedy, gdy twórca nie wyłączył łapek. Jest to spowodowane naszym sposobem wykrywania wyłączonych łapek, powinno zniknąć za parę godzin, albo po oddaniu łapki i odświeżeniu strony (oby).",
  },
  donate: {
    name: "Wesprzyj",
    subtitle:
      "Możesz wesprzeć pieniężnie nasze starania w utrzymaniu wolnego internetu!",
  },
  links: {
    name: "Linki",
    title: "Linki projektu",
    subtitle: "Linki do projektu i ich developerów",
    contact: "Skontaktuj się ze mną",
    translators: "Tłumacze",
    coolProjects: "Fajne projekty",
    sponsorBlockDescription: "Pomiń reklamy zintegrowane z filmem",
    filmotDescription: "Wyszukaj filmy na YouTube po napisach",
  },
};
