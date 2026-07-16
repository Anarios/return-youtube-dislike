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
    <b>Return YouTube Dislike 是一個開源的瀏覽器擴充功能，可以顯示 Youtube 的不喜歡數量。</b><br>
    適用於 Chrome 和 Firefox 作為 Web 擴充功能。<br>
    也可以作為 JS Userscript 在其他瀏覽器上使用。<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## 背景

在2021年11月10日，Google [宣布](https://blog.youtube/news-and-events/update-to-youtube/) 將會移除 YouTube 的不喜歡數量。

此外，YouTube API 中的 `dislike` 欄位於2021年12月13日 [被移除](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)，移除了在觀看影片之前評估內容品質的依據。

## 它是如何運作的

由於 YouTube API 不再提供不喜歡統計，我們的後端改為混合使用擴充功能所回傳的用戶數據，並配合估算模型來呈現不喜歡數量。

[常見問題解答](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQcn.md)

## 了解更多

你可以在我們的網站上了解更多資訊：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API 文件

本專案允許第三方使用此公開 API，但有以下限制：

### 來源標示
- **標示出處**:　若使用本 API，請務必於明顯處註明來源：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)。
- **速率限制**: 客户端的速率限制為每分鐘100次和每天10,000次。如果回傳 _429_ 狀態代碼，表示客戶端請求過於頻繁，請降低呼叫頻率。

可以通過這個基本 URL 呼叫 API：
https://returnyoutubedislikeapi.com

詳細 API 端點清單請參閱 [此處](https://returnyoutubedislikeapi.com/swagger/index.html)

### 取得投票數據

若要取得特定 YouTube 影片 ID 的投票數據，請呼叫以下端點：
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

若該 YouTube ID 不存在，API 將回傳 404 狀態碼（Not Found）。
若 YouTube ID 格式錯誤，API 將回傳 400 狀態碼（Bad Request）。

## 貢獻

請閱讀[貢獻指南](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGcn.md)。

## 支持本專案！

你可以透過以下超連結向我們捐款以支持本專案：

[捐款](https://returnyoutubedislike.com/donate)

## 贊助我們
[贊助本專案，您的資訊將會顯示於我們的資源庫與官方網站。](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
