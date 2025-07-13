[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Leia isso em outros idiomas: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md), [Danish](READMEda.md), [العربية](READMEar.md) ou [English (Para Melhor precisão!)](README.md), [Bahasa Indonesia](READMEid.md)


# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike é uma extensão de código aberto que traz de volta a contagem de dislikes do YouTube.</b><br>
    Disponível para Chrome e Firefox como uma Extensão Web.<br>
    Também disponível para outros navegadores como um JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## História

Em 10 de novembro de 2021 o Google [anunciou](https://blog.youtube/news-and-events/update-to-youtube/) que o contador de Deslikes do Youtube seria removido.

Adicionalmente, o campo `dislike` na API do YouTube foi [removido](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) em 13 de dezembro de 2021, removendo qualquer capacidade de julgar a qualidade do conteúdo antes de assistir.

## Como funciona

Com a remoção das estatísticas de dislike da API do YouTube, nosso back-end passou a usar uma combinação de estatísticas de dislike coletadas via scraping e estimativas baseadas nos dados dos usuários da extensão.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Por que Isso Importa

Você pode saber mais em nosso site: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentação da API

O uso por terceiros desta API aberta é permitido com as seguintes restrições:

- **Atribuição**: Este projeto deve ser claramente atribuído com um link para [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Limite de Taxa**: Existem limites por cliente de 100 requisições por minuto e 10.000 por dia. Se esses limites forem atingidos, será retornado um código de status 429, indicando que sua aplicação deve reduzir o volume de requisições.

A API é acessível pela seguinte URL base:
https://returnyoutubedislikeapi.com

A lista de endpoints está disponível aqui:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Obter dados de likes e dislikes

Exemplo de como obter os dados de likes e dislikes com base no ID do vídeo do YouTube:

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
Um ID de YouTube inexistente retornará o código de status _404_ "Não Encontrado".  
Um ID de YouTube malformado retornará o código _400_ "Requisição Inválida".

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Contribuindo

Por favor leia o [guia de contribuição](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGpt_BR.md).

## Ajude nosso projeto!

Você pode ajudar esse projeto doando para nós no link abaixo:

[Doar](https://returnyoutubedislike.com/donate)

## Patrocinadores

[Torne-se nosso Patrocinador](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
