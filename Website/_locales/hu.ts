import { hu } from 'vuetify/src/locale';
// By Gergely Pap
export default {
    ...hu,
    home: {
        name: 'Főoldal',
        title: 'Return YouTube Dislike',
        subtitle:
            'Bővítmény és API, ami visszahozza a YouTube dislike számlálót.',
        ukraine: 'Támogatjuk Ukrajnát',
        sponsors: 'Szponzorok',
    },
    install: {
        name: 'Telepítés',
        title: 'Válassz platformot!',
        subtitle: 'Elérhető Firefoxhoz és Chromium böngészőkhöz',
        title2: 'Egyéb platformok',
        subtitle2:
            'Ha a böngésződ még nem támogatott, próbáld ezt a UserScriptet',
        title3: 'Third Party implementációk',
        subtitle3:
            'Nem vállalunk érte felelősséget, használd saját belátásod szerint',
    },
    api: {
        name: 'API',
        title: 'Üdv a hivatalos RYD dokumentáción!',
        subtitle: 'A kezdéshez válassz egy szekciót a menüből!',
        rights: {
            title: 'Felhasználási jogok',
            subtitle:
                'Ennek az API-nak a saját felhasználását az alábbiak mellett engedélyezzük:',
            bullet1: 'Forrásmegjelölés: ',
            bullet1text:
                'Ezt a projektet jól láthatóan fel kell tüntetni egy repóra vagy a returnyoutubedislike.com oldalra mutató linkkel.',
            bullet2: 'Rate Limiting: ',
            bullet2text:
                'Kliensoldalon gyakoriság-korlátozás van beállítva percenként 100, naponta maximum 10 000 lekérésre. Túllépés esetén 429 státuszkód jelzi, hogy az alkalmazásod nem küldhet több lekérést.',
        },
        url: {
            title: 'URL információ',
            subtitle: 'Az API ezen a base URL-en érhető el: ',
        },
        endpoints: {
            title: 'Elérhető endpointok',
            subtitle: 'Az elérhető endpointok listája itt található: ',
        },
        fetching: {
            title: 'Tutorial egy lekéréshez',
            subtitle:
                'Példa egy adott YouTube videó ID adatainak lekéréséhez: ',
            title2: 'Példa lekérés: ',
            url: 'Lekérés URL: ',
            method: 'Lekérés Method: ',
            headers: 'Header: ',
            response: 'Válasz: ',
            error1: 'Nem létező YouTube ID esetén 404 "Not Found" válasz érkezik.',
            error2: 'Rossz formátumú YouTube ID esetén 400 "Bad Request" választ küldünk.',
        },
    },
    help: {
        name: 'Segítség',
        title: 'Hibaelhárítás',
        bullet1:
            'Győződj meg, hogy a bővítmény legújabb verziója van telepítve, ami ',
        bullet11: 'jelenleg.',
        bullet2:
            'Próbáld meg újratelepíteni a bővítményt, majd újraindítani a böngészőt (az összes aktív ablakot, nem csak egy tabot).',
        bullet3: 'Ellenőrizd ezt a linket: ',
        bullet31: 'ezt a szöveget kellene látnod: ',
        bullet4: 'Ha a fentiek közül egyik sem segít, jelentsd a problémát a',
        bullet41: 'channelen a Discord szerverünkön: ',
        bullet4a:
            'Add meg az operációs rendszered, illetve a böngésződ nevét és verzióját!',
        bullet4b:
            'Készíts screenshotot a problémáról (pl. a YouTube videó oldala) úgy, hogy nyitva van a konzol (ehhez nyomd meg az ',
        bullet4b1: ' billentyűt)! Példa:',
        bullet4c: 'Készíts screenshotot a bővítmények oldalról!',
        bullet4c1: 'A bővítmények listájához írd be a címsorba: ',
        firefox: 'Firefox esetén',
        chrome: 'Chrome, Edge, Brave, Opera és Vivaldi esetén',
    },
    faq: {
        name: 'GYIK',
        title: 'Gyakran Ismételt Kérdések',
        subtitle: 'Lenne még kérdésed? Csatlakozz a Discordunkhoz!',
        bullet1: 'Honnan szerzi a bővítmény az adatokat?',
        bullet1text:
            'A YouTube dislike API leállítása előtt archivált adatok és a bővítményt használók adatainak kombinációjából.',
        bullet2: 'Miért nem frissül a dislike számláló?',
        bullet2text:
            'Alapból a dislike-ok cache-elve vannak, és nem frissülnek túl gyakran. Ez a videó népszerűségétől függően változhat, de maximum pár órán vagy napon belül frissülnek az értékek.',
        bullet3: 'Hogyan működik ez az egész?',
        bullet3text:
            'A bővítmény begyűjti az éppen megnyitott videó ID-ját, és a saját API-nkon keresztül lekéri a dislike számot (illetve mást is, például a megtekintések és like-ok számát). Ezután megjeleníti az oldalon a dislike számlálót és az arányt. Ha like-olsz vagy dislike-olsz egy videót, azt az adatbázisunk eltárolja, hogy ki tudjuk következtetni a pontos értékeket.',
        bullet4: 'Megoszthatom a saját videóim dislike számait veletek?',
        bullet4text:
            'Hamarosan. Vizsáljuk egy Oauth vagy hasonló, csak olvasható, korlátozott API használatának lehetőségét, hogy a tartalomkészítők a valós dislike számaikat is meg tudják osztani.',
        bullet5: 'Milyen adatot gyűjtötök és hogyan kezelitek azokat?',
        bullet5text:
            'A bővítmény csak olyan adatot gyűjt, ami a megfelelő működéshez nélkülözhetetlen, ilyen az IP cím és az éppen megtekintett videó ID-ja. Soha, semmilyen adatot nem adunk el harmadik fél számára. Ha szeretnél többet megtudni az adatkezelésünkről és a biztonságról, nézd meg a <a href="https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/SECURITY-FAQ.md">Security GYIK-et</a>!',
        bullet6: 'Hogyan működik az API/Backend?',
        bullet6text:
            'A backend a YouTube API változása előtt archivált adatokat és a bővítményt használók like/dislike adatait használja fel egy extrapolált értékhez. Hamarosan támogatni fogjuk, hogy a tartalomkészítők könnyen és biztonságosan beküldhessék a pontos dislike számaikat, illetve az ArchiveTeam által archivált (4,56 milliárd videót tartalmazó) adathalmazt is felvisszük az adatbázisunkba. Erről egy videót is megtekinthetsz.',
        bullet7: "Miért mutatja a számláló, hogy 'DISLIKES DISABLED'?",
        bullet7text:
            "Egy nemrég feltöltött videónál néha előfordulhat a 'DISLIKES DISABLED' üzenet akkor is, ha a készítője nem kapcsolta ki azt. Ennek köze van ahhoz, ahogyan a kikapcsolt dislike-okat ellenőrizzük, de pár órán belül el kell tűnnie, vagy ha nem, like-olás vagy dislike-olás utáni oldalfrissítésre (remélhetőleg).",
    },
    donate: {
        name: 'Támogatás',
        subtitle:
            'Támogathatod a szabad internetért folytatott erőfeszítéseinket egy adománnyal.',
    },
    links: {
        name: 'Linkek',
        title: 'Projekt linkek',
        subtitle: 'Linkek a projekthez és a fejlesztőkhöz',
        contact: 'Kapcsolat',
        translators: 'Fordítók',
        coolProjects: 'Hasonló projektek',
        sponsorBlockDescription: 'Átugorja a videókba épített reklámokat.',
        filmotDescription: 'YouTube videók keresése felirat alapján.',
    },
};
