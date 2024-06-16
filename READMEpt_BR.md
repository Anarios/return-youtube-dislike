[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Leia isso em outros idiomas: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md) ou [English (Para Melhor precisão!)](README.md)


# Return YouTube Dislike


<p align="center">
    <b>Return YouTube Dislike é uma extensão de codigo aberto que retorna com o contador de Deslike do Youtube.</b></i> Agora está disponivel apenas para os proprietarios dos Canais<i><br>
       Disponivel para Chrome e Firefox como uma extensão Web.<br>
       e também disponivel para outros navegadores como um JS UserScript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## Nossa Historia

Em 10 de novembro de 2021 a Google [Anuciou](https://blog.youtube/news-and-events/update-to-youtube/) que o contador de Deslikes do Youtube seria removido. 

Additionally, the `dislike` field in the YouTube API was [removed](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) on December 13th, 2021, removing any ability to judge the quality of content before watching.

## Como isso funciona

With the removal of dislike stats from the YouTube API, our backend switched to using a combination of scraped dislike stats, estimates extrapolated from extension user data.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Why it Matters

Você pode aprender mais no nosso site Aqui: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## Documentação da API

Third-party use of this open API is allowed with the following restrictions:

- **Attribution**: This project should be clearly attributed with a link to [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Rate Limiting**: There are per client rate limits in place of 100 per minute and 10,000 per day. This will return a _429_ status code indicating that your application should back off.

The API is accessible over the following base URL:  
https://returnyoutubedislikeapi.com

List of available endpoints is available here:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Obtendo votos

Exemplo para obter os votos pelo Youtube Video ID:  
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

Nenhum youtube id exstente irá retornar o codigo de status _404_ "Nada encontrado".  
Wrong formed YouTube ID will return _400_ "Bad Request".

<!---
## Documentação da API

Você pode visualizar toda a documentação no Site.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Contribuindo

Por favor leia o [Guia de contribuição](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGpt_BR.md).

## Ajude nosso projeto!

Você pode ajuda esse projeto doando para nos no link abaixo:

[Doar](https://returnyoutubedislike.com/donate)

## Patrocinados

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[Torne-se nosso Patrocinador](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)

  