[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Leer en otros idiomas: [English](README.md), [русский](READMEru.md), [日本語](READMEja.md), [Türkçe](READMEtr.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike es una extensión de código abierto que regresa el contador de dislikes.</b><br>
    Disponible para Chrome y Firefox cómo una extensión web.<br>
    También disponible para otros navegadores cómo un Userscript de JS.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## La historia

El 10 de Noviembre de 2021, Google [anunció](https://blog.youtube/news-and-events/update-to-youtube/) que el contador de dislikes de YouTube sería eliminado.  

Adicionalmente, el campo de 'dislike' en la API de YouTube fue [eliminado](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) el 13 de Diciembre de 2021, acabando con la habilidad de juzgar la calidad del contenido antes de verlo.

## Que hace

Con la retirada de las estadísticas de dislikes de la API de YouTube, nuestro *backend* pasó a usar una combinación de las estadísticas de dislikes archivadas y datos extrapolados de los usuarios de la extensión.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Por qué importa

Puedes aprender más en nuestro sitio web en: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentación de la API

El uso de terceros de esta API abierta se permite bajo las siguientes restricciones:

- **Atribución**: Este proyecto debe estar claramente atribuido con un link a [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Límites de velocidad**: Hay límites de velocidad por cliente de 100 por minuto y 10.000 por día. Excederlos retornará un código de estado *409* indicando que tu aplicación debe bajar la velocidad.

La API es accesible sobre la siguiente URL base:  
https://returnyoutubedislikeapi.com  

La lista de los *endpoints* disponibles se puede consultar aquí:
https://returnyoutubedislikeapi.com/swagger/index.html

### Obtener votos
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


Un ID de YouTube no existente retornará el codigo de estado *404* "Not Found" (no encontrado).
Un ID de YouTube mal estructurado retornará *400* "Bad Request" (solicitud incorrecta).



<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->


## Contribuciones

Por favor, lee la [guía de contribución](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## ¡Apoya este proyecto!

Puedes apoyar este proyecto donándonos en el enlace inferior:

[Donar](https://returnyoutubedislike.com/donate)

## Patrocinadores
[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Hazte nuestro patrocionador](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
