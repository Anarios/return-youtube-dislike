Preberite to v drugih jezikih: [English](CONTRIBUTING.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Slovenščina](CONTRIBUTINGsl.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [беларуская](CONTRIBUTINGbe.md)

# Dobrodošli v navodilih za sodelovanje pri projektu Return YouTube Dislike

Hvala, ker vlagate svoj čas v sodelovanje pri našem projektu! Vse vaše spremembe bodo upoštevane v naslednji različici razširitve (ali [spletne strani](https://www.returnyoutubedislike.com/)).

## Začetek

Za oblikovanje kode uporabite Prettier s privzetimi nastavitvami.

#### Predpogoji

Za izdelavo združene različice izvorne kode morata biti nameščena node in npm.

Različici, uporabljeni ob pripravi:

- node: 12.18.4
- npm: 6.14.6

Če želite ustvariti datoteko `bundled-content-script.js`, ki vsebuje večino poslovne logike te razširitve, morate najprej namestiti vse odvisnosti.

1. Pojdite v koren repozitorija in zaženite:

```
npm install
```

2. Zaženite naslednji ukaz, da ustvarite datoteko `bundled-content-script.js`, ki se uporablja v `manifest.json`

```
npm start // ustvari datoteke gradnje in zažene opazovalnik datotek, ki ob shranjevanju samodejno osveži gradnjo

// ali

npm run build // enkrat ustvari datoteke gradnje
```

Čestitamo, zdaj ste pripravljeni na razvoj!

Če razširitev za Chrome razvijate prvič ali potrebujete dodatno pomoč, si oglejte [ta vodič na YouTubu](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Prijave težav

#### Odpiranje nove prijave težave

Če imate z razširitvijo kakršno koli težavo, najprej poiščite, ali je že prijavljena. Če ni, odprite prijavo težave; uporaba obrazca je zelo priporočljiva, ni pa obvezna.

#### Reševanje težave

Če ste našli težavo, za katero menite, da jo lahko rešite, ne oklevajte. Odprite zahtevo za združitev s popravkom in obvezno navedite težavo, ki jo odpravljate.

### Predlogi funkcij

#### Odpiranje novega predloga funkcije

Če imate zamisel za razširitev, odprite predlog funkcije, vendar prej poiščite, ali funkcija ni bila že predlagana. Uporaba obrazca za funkcije je zelo priporočljiva, ni pa obvezna

#### Implementacija predlagane funkcije

Če ste našli funkcijo, za katero menite, da jo lahko implementirate, ne oklevajte. Odprite zahtevo za združitev in obvezno navedite funkcijo, ki jo implementirate.

### Katere zahteve za združitev sprejemamo?

- Popravke težav.
- Implementacije funkcij.
- Tipkarske napake ali boljše in razumljivejše ubeseditve.
- Prispevke k spletni strani.
