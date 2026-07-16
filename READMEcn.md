[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [English](README.md), [العربية](READMEar.md), [Azərbaycan dili](READMEaz.md), [български](READMEbg.md), [繁體中文](READMEtw.md), [简体中文](READMEcn.md), [Danish](READMEda.md), [Deutsch](READMEde.md), [Español](READMEes.md), [Français](READMEfr.md), [Ελληνικά](READMEgr.md), [Magyar](READMEhu.md), [Bahasa Indonesia](READMEid.md), [日本語](READMEja.md), [한국어](READMEkr.md), [Nederlands](READMEnl.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [русский](READMEru.md), [Svenska](READMEsv.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Tiếng Việt](READMEvi.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike 是一个开源的浏览器扩展，用于显示 YouTube 影片的不喜欢数量。</b><br>
    适用于 Chrome 和 Firefox 等主流浏览器。<br>
    同时也提供 JS Userscript 版本，可在其他浏览器上使用。<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## 专案缘起

2021 年 11 月 10 日，Google [宣布](https://blog.youtube/news-and-events/update-to-youtube/) 将移除 YouTube 的不喜欢数量显示。

随后，YouTube API 中的 `dislike` 字段于 2021 年 12 月 13 日 [正式移除](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)，这使得用户无法在观看影片前通过不喜欢数评估内容质量。本专案即在此背景下诞生。

## 它是如何工作的

由于 YouTube API 不再提供不喜欢统计信息，我们的后端改用了混合数据模型，结合了扩展收集的真实用户数据与估算模型来呈现不喜欢数量。

[常见问题解答](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQcn.md)

## 了解更多

你可以在我们的官网了解更多信息：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API 文档

本专案允许第三方使用此公开 API，使用需遵循以下限制：

- **来源标示 (Attribution)**: 若使用本 API，请务必于明显处注明来源：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)。
- **速率限制**: 客户端限制为每分钟 100 次、每日 10,000 次。若超过限制，API 将回传 `429` 状态码，表示请求过于频繁，请降低呼叫频率。

可透过以下 Base URL 呼叫 API：
https://returnyoutubedislikeapi.com

详细 API 端点清单请参阅 [此处](https://returnyoutubedislikeapi.com/swagger/index.html)。

### 获取投票数据

若要获取特定 YouTube 视频 ID 的投票数据，请呼叫以下端点：
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

若 YouTube ID 不存在，API 将回传 404 状态码 (Not Found)。
若 YouTube ID 格式错误，API 将回传 400 状态码 (Bad Request)。

## 贡献

请阅读 [贡献指南](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGcn.md)。

## 支持本专案！

您可以通过以下链接向我们捐赠来支持这个专案：

[捐赠](https://returnyoutubedislike.com/donate)

## 赞助商
[成为我们的赞助商，您的信息将在我们的资源库和网站上展示。](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)