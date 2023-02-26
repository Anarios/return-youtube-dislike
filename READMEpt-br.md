[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Leia em outros idiomas: [English](README.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [日本語](READMEja.md), [Nederlands](READMEnl.md), [русский](READMEru.md), [Türkçe](READMEtr.md), [українська](READMEuk.md)


# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike é uma extensão de código aberto que retorna a contagem de dislikes do YouTube.</b><br>
    Disponível para Chrome e Firefox como Extensão da Web.<br>
    Também disponível para outros navegadores como JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## A História

Em 10 de novembro de 2021, o Google [anunciou](https://blog.youtube/news-and-events/update-to-youtube/) que a contagem de dislikes do YouTube seria removida.

Além disso, o campo `dislike` na API do YouTube foi [removido](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) em 13 de dezembro de 2021, removendo qualquer capacidade de julgar a qualidade do conteúdo antes de assistí-lo.

## O que ela faz

Com a remoção das estatísticas do dislikes da API do YouTube, nosso backend passou a usar uma combinação de estatísticas de dislikes raspadas e estimativas extrapoladas a partir dos dados dos usuários da extensão.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQpt-br.md)

## Por que isso importa

Você pode saber mais no nosso site em: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentação da API

O uso de terceiros desta API aberta é permitido com as seguintes restrições:

- **Atribuição**: Este projeto deve ser claramente atribuído com um link para [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Limitação de taxa**: Existem limites de taxa por cliente de 100 por minuto e 10.000 por dia. Isso retornará um código de status _429_, indicando que sua aplicação deve diminuir a velocidade.

A API é acessível no seguinte URL base:  
[https://returnyoutubedislikeapi.com](https://returnyoutubedislikeapi.com/)

Lista de endpoints disponíveis está disponível aqui:  
[https://returnyoutubedislikeapi.com/swagger/index.html](https://returnyoutubedislikeapi.com/swagger/index.html)

### Obter votos

Exemplo para obter votos de um determinado ID de vídeo do YouTube:  
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

Um ID do YouTube inexistente retornará o código de status _404_ "Not Found".  
Um ID do YouTube com formato incorreto retornará _400_ "Bad Request".

<!---
## Documentação da API

 Você pode ver toda a documentação em nosso site.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Contribuindo

Por favor, leia o [guia de contribuição](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGpt-br.md).

## Apoie este projeto!

Você pode apoiar este projeto nos doando no link abaixo:

[Doar](https://returnyoutubedislike.com/donate)

## Patrocinadores

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Torne-se nosso patrocinador](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
