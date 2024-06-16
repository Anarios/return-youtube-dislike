[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

別の言語: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube DislikeはYouTubeの低評価を表示するためのオープンソースな拡張機能です。</b><br>
    ChromeとFireFoxで拡張機能を利用可能です。<br>
    また、他のブラウザでもJS Userscriptを利用できます。<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## これまでの経緯

2021 年 10 月 10 日、Google は YouTube の低評価を非表示にすると[発表しました](https://blog.youtube/news-and-events/update-to-youtube/)。

そして 2021 年 12 月 13 日、YouTube API からも低評価が[削除](<(https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)>)され、動画のクオリティを判断する手段がなくなってしまいました。

## What it Does

<!-- この部分の翻訳が微妙? -->

YouTube API から低評価が削除されたことにより、バックエンドは拡張機能のユーザーをもとにスクレイピングされたデータと組み合わせて表示するように切り替わりました

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## 低評価が重要な理由

ウェブサイトに詳細が書かれています: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API ドキュメント

サードパーティは以下の制限のもとで API を利用できます:

- **帰属**: [returnyoutubedislike.com](https://returnyoutubedislike.com/) へのリンクを明確に表記してください。
- **レート制限**: クライアントごとに 1 分あたり 100 回、1 日あたり 10000 回という制限があります。制限に達すると*429*コードが返されます。

API は以下の Base URL でアクセスできます:  
https://returnyoutubedislikeapi.com

利用可能なエンドポイントはこちらを参照してください:  
https://returnyoutubedislikeapi.com/swagger/index.html

### 評価を取得

API を利用して YouTube video ID から評価を取得する例です:  
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

存在しない YouTube ID の場合 _404_ "Not Found" が返されます。
不正なフォーマットの YouTube ID の場合 _400_ "Bad Request"が返されます。

<!---
## API ドキュメント

APIの完全なドキュメントは公式サイトを参照してください。
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## 貢献する

こちらの[contribution guide](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md)を読んでください。

## プロジェクトを支援!

以下のリンクに寄付をしてこのプロジェクトを支援できます:

[寄付](https://returnyoutubedislike.com/donate)

## スポンサー

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=returnyoutubedislike)

[Become our sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
