Prečítajte si to v iných jazykoch: [English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Slovenčina](CONTRIBUTINGsk.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# Vitajte v návode na prispievanie do Return YouTube Dislike

Ďakujeme, že venujete čas prispievaniu do nášho projektu! Všetky vaše zmeny sa prejavia v ďalšej verzii rozšírenia (alebo na [webe](https://www.returnyoutubedislike.com/)).

## Začíname

Na formátovanie používajte Prettier s predvolenými nastaveniami.

#### Predpoklady

Na vytvorenie zbaleného (bundled) zdrojového kódu potrebujete mať nainštalovaný node a npm.

Verzie použité pri príprave projektu:

- node: 12.18.4
- npm: 6.14.6

Ak chcete vytvoriť súbor `bundled-content-script.js`, ktorý obsahuje väčšinu logiky rozšírenia, najprv nainštalujte všetky závislosti.

1. Prejdite do koreňového priečinka repozitára a spustite:

```
npm install
```

2. Spustite tento príkaz, ktorý vytvorí súbor `bundled-content-script.js` používaný v `manifest.json`:

```
npm start // vytvorí zostavené súbory a spustí sledovanie súborov, ktoré ich pri uložení znova načíta

// alebo

npm run build // vytvorí zostavené súbory jednorazovo
```

Gratulujeme, teraz môžete začať vyvíjať!

Ak s vývojom rozšírení pre Chrome začínate alebo potrebujete pomoc navyše, pozrite si [tento návod na YouTube](https://www.youtube.com/watch?v=mdOj6HYE3_0).

### Problémy (issues)

#### Nahlásenie nového problému

Ak máte s rozšírením problém, najprv vyhľadajte, či ho už niekto nenahlásil. Ak nie, otvorte nový issue. Odporúčame použiť formulár na nahlásenie problému, nie je to však povinné.

#### Riešenie problému

Ak ste našli problém, ktorý by ste vedeli vyriešiť, nehanbite sa. Otvorte PR s opravou a uveďte v ňom, ktorý problém opravujete.

### Návrhy funkcií

#### Nový návrh funkcie

Ak máte nápad na rozšírenie, pokojne otvorte návrh funkcie. Predtým však vyhľadajte, či ju už niekto nenavrhol. Odporúčame použiť formulár na návrh funkcie, nie je to však povinné.

#### Implementácia navrhnutej funkcie

Ak ste našli funkciu, ktorú by ste vedeli implementovať, nehanbite sa. Otvorte PR s implementáciou a uveďte v ňom, ktorú funkciu implementujete.

### Aké PR prijímame?

- Opravy problémov.
- Implementáciu funkcií.
- Opravy preklepov alebo výstižnejšie a jednoduchšie formulácie.
- Príspevky na web.
