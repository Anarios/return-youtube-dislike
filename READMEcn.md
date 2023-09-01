[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

阅读其他语言版本：[English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike是一个开源的扩展，可以显示 YouTube 的不喜欢数量。</b><br>
    适用于 Chrome 和 Firefox 作为 Web 扩展。<br>
    也可以作为 JS Userscript 在其他浏览器上使用。<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## 故事

在2021年11月10日，Google [宣布](https://blog.youtube/news-and-events/update-to-youtube/) 将移除 YouTube 的不喜欢数量。

此外，YouTube API 中的 `dislike` 字段于2021年12月13日 [被移除](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)，移除了在观看之前评估内容质量的能力。

## 它是如何工作的

随着 YouTube API 中不喜欢统计信息的移除，我们的后端切换到使用从扩展用户数据中抓取的不喜欢统计信息和估算数据的组合。

[常见问题解答](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## 为什么重要

您可以在我们的网站上了解更多信息：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API 文档

允许第三方使用此开放 API，但有以下限制：

- **归因**: 该项目应清楚地归因于 [returnyoutubedislike.com](https://returnyoutubedislike.com/) 的链接。
- **速率限制**: 客户端的速率限制为每分钟100次和每天10,000次。这将返回 _429_ 状态代码，表示您的应用程序应该减速。

API 可以通过以下基本 URL 访问：  
https://returnyoutubedislikeapi.com

可用端点列表在这里：  
https://returnyoutubedislikeapi.com/swagger/index.html

### 获取投票

示例获取给定 YouTube 视频 ID 的投票：  
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

不存在的 YouTube ID 将返回状态码 _404_ "未找到"。  
格式错误的 YouTube ID 将返回 _400_ "请求无效"。

## 贡献

请阅读[贡献指南](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md)。

## 支持这个项目！

您可以通过以下链接向我们捐赠来支持这个项目：

[捐赠](https://returnyoutubedislike.com/donate)

## 赞助商

[Piepacker](https://piepacker.com)

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[PocketTube](https://yousub.info/?utm_source=return
