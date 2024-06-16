[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](LICENSE)

Lisez ceci dans d'autres langues : [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md),[日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike est une extension open-source qui ré-affiche les dislikes (pouces rouges) sur YouTube.</b><br>
    Disponible pour Chrome et Firefox en tant qu'extension Web.<br>
    Également disponible pour d'autres navigateurs en tant que JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Le récit des événements

Le 10 novembre 2021, Google [a annoncé](https://blog.youtube/news-and-events/update-to-youtube/) que le compteur de dislike sur YouTube serait supprimé.

En outre, le champ `dislike` de l'API YouTube a été [supprimé](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) le 13 décembre 2021, supprimant ainsi toute possibilité de juger de la qualité du contenu d'une vidéo avant de la regarder.

## Ce qu'il fait

Avec la suppression des statistiques du nombre de dislike de l'API YouTube, notre backend est passé à l'utilisation d'une combinaison de statistiques du nombre de dislike scrapé et d'estimations extrapolées à partir des données d'extension des utilisateurs.

[FAQ](Docs/FAQfr.md)

## Pourquoi c'est important

Vous pouvez en savoir plus sur notre site web à l'adresse suivante : [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentation de l'API

L'utilisation par des tiers de cette API ouverte est autorisée avec les restrictions suivantes :

- **Attribution**: Ce projet doit être clairement nommé avec un lien vers [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Limitation des requêtes**: Il y a des limites de requêtes par client en place qui sont de 100 requêtes par minute et 10 000 par jour. Nous renverrons un code d'erreur _429_ indiquant que votre application devrait se calmer.

L'API est accessible via l'URL de base suivante:  
https://returnyoutubedislikeapi.com

La liste des endpoints est disponible ici:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Obtenir les likes

Exemple pour obtenir les likes d'une vidéo YouTube avec un ID donné:  
`/votes?videoId=kxOuG8jMIgI`

```json
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2021-12-20T12:25:54.418014Z",
  "likes": 27326,
  "dislikes": 498153,
  "rating": 1.212014408444885,
  "viewCount": 3149885,
  "deleted": false
}
```

Si aucune vidéo YouTube n'a cet ID, le code d'erreur _404_ "Not Found" sera retourné.  
Un ID YouTube invalide renverra le code d'erreur _400_ "Bad Request".

<!---
## Documentation de l'API

Vous pouvez consulter toute la documentation sur notre site web.
[https://returnyoutubedislike.com/docs](https://returnyoutubedislike.com/docs) -->

## Contribution

Veuillez lire le [guide des contributions](CONTRIBUTINGfr.md).

## Soutenez ce projet !

Vous pouvez soutenir ce projet en faisant un don grâce au lien ci-dessous :

[Donner](https://returnyoutubedislike.com/donate)

## Sponsors

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Devenez notre sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
