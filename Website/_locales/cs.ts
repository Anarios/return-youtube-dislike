import { cs } from "vuetify/src/locale";
// By Fjuro
export default {
  ...cs,
  home: {
    name: "Domů",
    title: "Return YouTube Dislike",
    subtitle: "Rozšíření prohlížeče a API, která zobrazí disliky na YouTube",
    ukraine: "Podpořte Ukrajinu",
    sponsors: "Sponzoři",
  },
  install: {
    name: "Instalace",
    title: "Vyberte svou platformu",
    subtitle: "Dostupné pro Firefox a všechny prohlížeče založené na Chromiu",
    title2: "Další platformy",
    subtitle2:
      "Pokud váš prohlížeč ještě není podporován, vyzkoušejte tento UserScript",
    title3: "Implementace třetích stran",
    subtitle3:
      "Žádná odpovědnost na naší straně, používejte na vlastní nebezpečí",
  },
  api: {
    name: "API",
    title: "Vítejte v oficiální dokumentaci RYD!",
    subtitle: "Pro začátek vyberte sekci z menu.",
    rights: {
      title: "Práva k použití",
      subtitle:
        "Použití této API třetími stranami je povoleno s následujícími omezeními:",
      bullet1: "Uvedení: ",
      bullet1text:
        "Tento projekt by měl být viditelně uveden buď s odkazem na tento repozitář, nebo s odkazem na returnyoutubedislike.com",
      bullet2: "Omezení požadavků: ",
      bullet2text:
        "U API platí omezení na 100 požadavků za minutu a 10 000 za den. Při překročení tohoto limitu aplikace vrátí stavový kód 429, značící, že byste měli omezit své požadavky",
    },
    url: {
      title: "Informace o URL",
      subtitle: "API je dostupná na následující základní URL: ",
    },
    endpoints: {
      title: "Dostupné endpointy",
      subtitle: "Seznam dostupných endpointů lze nalézt zde: ",
    },
    fetching: {
      title: "Základní návod na přístup",
      subtitle: "Příklad získání hlasů daného ID YouTube videa: ID: ",
      title2: "Příklad požadavku: ",
      url: "URL požadavku: ",
      method: "Způsob žádosti: ",
      headers: "Hlavičky: ",
      response: "Odpověď: ",
      error1: 'Neplatné YouTube ID vrátí stavový kód 404 "Not Found"',
      error2:
        'Nesprávně formátované YouTube ID vrátí stavový kód 400 "Bad Request"',
    },
  },
  help: {
    name: "Nápověda",
    title: "Řešení problémů",
    bullet1:
      "Ujistěte se, že používáte nejnovější verzi rozšíření. Momentálně je to verze ",
    bullet11: "",
    bullet2:
      "Zkuste odebrat a znovu nainstalovat rozšíření a poté restartovat váš prohlížeč (všechna aktivní okna, ne jen jednu kartu)",
    bullet3: "Ujistěte se, že se otevře následující odkaz: ",
    bullet31: "měli byste vidět tento text: ",
    bullet4:
      "Pokud nepomůže ani jedna z možností výše, nahlaste svůj problém do kanálu",
    bullet41: "v našem",
    bullet4a:
      "Řekněte nám jaký máte operační systém, název prohlížeče a verzi prohlížeče",
    bullet4b:
      "Udělejte snímek obrazovky s problémem (např. stránka YouTube videa) s otevřenou konzolí (stiskněte ",
    bullet4b1: ") - příkladný snímek viz níže.",
    bullet4c:
      "Udělejte snímek obrazovky stránky rozšíření vašeho prohlížeče s nainstalovaným rozšířením.",
    bullet4c1:
      "Pro zobrazení rozšíření zadejte následující adresu do adresního řádku: ",
    firefox: "pro Firefox",
    chrome: "pro Chrome, Edge, Brave, Opera, Vivaldi",
  },
  faq: {
    name: "FAQ",
    title: "Často kladené dotazy",
    subtitle: "Stále máte otázky? Připojte se na náš Discord server!",
    bullet1: "Jak získává rozšíření svá data?",
    bullet1text:
      "Kombinací archivovaných dat z doby před oficiálním vypnutím rozhraní API YouTube dislike a extrapolovaného chování uživatelů rozšíření..",
    bullet2: "Proč se neaktualizuje počet disliků?",
    bullet2text:
      "V současné době jsou počty disliků videí ukládány do mezipaměti a nejsou příliš často aktualizovány. Jejich aktualizace se liší v závislosti na popularitě videa, ale může trvat od několika hodin do několika dnů.",
    bullet3: "Jak to funguje?",
    bullet3text:
      "Rozšíření načte ID videa, které sledujete, a pomocí našeho rozhraní API získá počet disliků (a další pole, jako jsou zobrazení, lajky atd.). Rozšíření pak na stránce zobrazí počet a poměr disliků. Pokud se vám video líbí nebo nelíbí, je to zaznamenáno a odesláno do databáze, takže lze extrapolovat přesný počet disliků.",
    bullet4: "Můžu s vámi sdílet počet svých disliků?",
    bullet4text:
      "Již brzy. Hledáme způsob, jak použít rozhraní Oauth nebo jiného rozhraní API pouze pro čtení s omezeným rozsahem, aby tvůrci mohli ověřitelně sdílet své počty disliků.",
    bullet5: "Jaká data sbíráte a jak je s nimi nakládáno?",
    bullet5text:
      'Rozšíření shromažďuje pouze údaje, které jsou nezbytně nutné pro jeho správnou funkci, například IP adresu nebo ID sledovaného videa. Žádné z vašich údajů nebudou nikdy prodány třetím stranám. Pokud se chcete dozvědět více o tom, jak se staráme o zabezpečení a ochranu osobních údajů, podívejte se na naši <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">bezpečnostní FAQ</a>.',
    bullet6: "Jak funguje API/Backend?",
    bullet6text:
      "Backend používá archivovaná data z doby, kdy rozhraní YouTube ještě vracelo počet disliků, počty lajků/disliků uživatelů a extrapolaci. V blízké budoucnosti umožníme tvůrcům obsahu snadno a bezpečně odesílat počet disliků a do naší současné databáze přidáme archivovaná data ArchiveTeamu (4,56 miliardy videí). Můžete si také prohlédnout video na toto téma.",
    bullet7: "Proč počet disliků zobrazuje 'DISLIKES DISABLED'?",
    bullet7text:
      "Někdy se u nedávno nahraného videa může zobrazit 'DISLIKES DISABLED' (disliky zakázány), i když je tvůrce nezakázal, což je způsobeno tím, jak zjišťujeme, zda jsou dislike zakázány. Mělo by to samo zmizet během několika hodin nebo tím, že dáte lajk či dislike danému videu.",
  },
  donate: {
    name: "Přispět",
    subtitle:
      "Můžete podpořit naše úsilí ponechat internet bezplatný jakýmkoli darem!",
  },
  links: {
    name: "Odkazy",
    title: "Odkazy projektu",
    subtitle: "Odkazy na projekt a jeho vývojáře",
    contact: "Kontaktujte mě",
    translators: "Překladatelé",
    coolProjects: "Bezva projekty",
    sponsorBlockDescription: "Přeskočte reklamy integrované ve videích",
    filmotDescription: "Prohledávejte YouTube videa pomocí titulků",
  },
};
