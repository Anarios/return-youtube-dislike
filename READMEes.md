[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Leer en otros idiomas: [English](README.md), [русский](READMEru.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike (recuperar los *dislikes* de YouTube) es una extensión de código abierto que reintroduce el contador de *dislikes* (o «No me gustas»).</b><br>
    Está disponible para Chrome y Firefox como una extensión web.<br>
    También está disponible para otros navegadores como un *userscript* de JS.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## La historia

El 10 de noviembre de 2021, Google [anunció](https://blog.youtube/news-and-events/update-to-youtube/) que eliminarían el contador de _dislikes_ de YouTube.

Adicionalmente, el campo `dislike` de la API de YouTube también fue [eliminado](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) el 13 de diciembre de 2021, acabando con la posibilidad de juzgar la calidad de un contenido antes de verlo.

## Qué hace

Tras la retirada de las estadísticas de _dislikes_ de la API de YouTube, nuestro _backend_ pasó a usar una combinación de las estadísticas archivadas de _dislikes_ y datos extrapolados de los usuarios de la extensión.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Por qué importa

Para más información, visita nuestro sitio web: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentación de la API

Se permite el uso de terceros de esta API abierta bajo las siguientes restricciones:

- **Atribución**: Este proyecto debe estar claramente atribuido con un enlace a [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Límites de velocidad**: Hay límites de velocidad por cliente de 100 solicitudes por minuto y 10.000 al día. Al excederlos se mostrará un código de estado _429_, indicando que tu aplicación debe bajar la velocidad.

La API es accesible a través de la siguiente URL base:  
https://returnyoutubedislikeapi.com

La lista de los _endpoints_ disponibles se puede consultar aquí:
https://returnyoutubedislikeapi.com/swagger/index.html

### Obtención de votos

Ejemplo para obtener los votos del ID de un vídeo de YouTube proporcionado:
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

Un ID de YouTube no existente mostrará el código de estado _404_ "Not Found" (no encontrado).
Un ID de YouTube mal estructurado mostrará el código _400_ "Bad Request" (solicitud incorrecta).

<!---
## Documentación de la API

Puedes ver toda la documentación en nuestra página web.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Contribuciones

Rogamos que leas la [guía de contribución](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md) antes de empezar.

## ¡Apoya este proyecto!

Puedes apoyar este proyecto enviando un donativo a través del enlace inferior:

[Donar](https://returnyoutubedislike.com/donate)

## Patrocinadores

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Patrocínanos](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
