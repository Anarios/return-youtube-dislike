[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

阅读其他语言版本：[English](README.md)、[العربية](READMEar.md)、[Azərbaycan dili](READMEaz.md)、[български](READMEbg.md)、[繁體中文](READMEtw.md)、[简体中文](READMEcn.md)、[Danish](READMEda.md)、[Deutsch](READMEde.md)、[Español](READMEes.md)、[Français](READMEfr.md)、[Ελληνικά](READMEgr.md)、[Magyar](READMEhu.md)、[Bahasa Indonesia](READMEid.md)、[日本語](READMEja.md)、[한국어](READMEkr.md)、[Nederlands](READMEnl.md)、[Polski](READMEpl.md)、[Português do Brasil](READMEpt_BR.md)、[русский](READMEru.md)、[Svenska](READMEsv.md)、[Türkçe](READMEtr.md)、[українська](READMEuk.md)、[Tiếng Việt](READMEvi.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike 是一款开源的浏览器扩展程序，可恢复显示 YouTube 的“不喜欢”数量。</b><br>
    可作为 Web 扩展程序安装到 Chrome 和 Firefox。<br>
    也提供适用于其他浏览器的 JavaScript 用户脚本（Userscript）。<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## 项目背景

2021 年 11 月 10 日，Google [宣布](https://blog.youtube/news-and-events/update-to-youtube/) YouTube 将移除“不喜欢”数量。

此外，YouTube API 中的 `dislike` 字段也于 2021 年 12 月 13 日[被移除](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)，导致用户无法在观看视频前判断内容质量。

## 工作原理

YouTube API 移除“不喜欢”统计数据后，我们的后端改为结合抓取到的“不喜欢”统计数据，以及根据扩展程序用户数据推算出的估计值。

[常见问题](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQcn.md)

## 为什么这很重要

如需了解更多信息，请访问我们的网站：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API 文档

允许第三方使用此开放 API，但须遵守以下限制：

- **来源标注**：使用时必须明确标注本项目，并链接至 [returnyoutubedislike.com](https://returnyoutubedislike.com/)。
- **速率限制**：每个客户端每分钟最多请求 100 次、每天最多请求 10,000 次。超出限制时会返回 _429_ 状态码，表示您的应用应降低请求频率。

可通过以下基础 URL 访问 API：
https://returnyoutubedislikeapi.com

可用端点列表：
https://returnyoutubedislikeapi.com/swagger/index.html

### 获取投票数据

以下示例用于获取指定 YouTube 视频 ID 的投票数据：
`/votes?videoId=kxOuG8jMIgI`

```json
{
  "id": "kxOuG8jMIgI",
  "dateCreated": "2022-04-09T21:44:20.5103Z",
  "likes": 31885,
  "rawDislikes": 31946,
  "rawLikes": 457,
  "dislikes": 579721,
  "rating": 1.2085329444119253,
  "viewCount": 3762293,
  "deleted": false
}
```

如果 YouTube ID 不存在，将返回 _404_ “Not Found” 状态码。<br>
如果 YouTube ID 格式不正确，将返回 _400_ “Bad Request” 状态码。

<!---
## API 文档

您可以在我们的网站上查看完整文档。
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## 贡献

请阅读[贡献指南](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGcn.md)。

## 支持本项目！

您可以通过下方链接捐款支持本项目：

[捐款](https://returnyoutubedislike.com/donate)

## 赞助者

[成为我们的赞助者，即可在本仓库和官方网站上展示](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
