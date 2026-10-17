[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chromewebstore.google.com/detail/return-youtube-dislike/gebbhagfogifgggkldgodflihgfeippi)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

閱讀其他語言版本：[English](README.md)、[العربية](READMEar.md)、[Azərbaycan dili](READMEaz.md)、[български](READMEbg.md)、[繁體中文](READMEtw.md)、[简体中文](READMEcn.md)、[Danish](READMEda.md)、[Deutsch](READMEde.md)、[Español](READMEes.md)、[Français](READMEfr.md)、[Ελληνικά](READMEgr.md)、[Magyar](READMEhu.md)、[Bahasa Indonesia](READMEid.md)、[日本語](READMEja.md)、[한국어](READMEkr.md)、[Nederlands](READMEnl.md)、[Polski](READMEpl.md)、[Português do Brasil](READMEpt_BR.md)、[русский](READMEru.md)、[Svenska](READMEsv.md)、[Türkçe](READMEtr.md)、[українська](READMEuk.md)、[Tiếng Việt](READMEvi.md)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike 是一款開放原始碼的瀏覽器擴充功能，可恢復顯示 YouTube 的不喜歡數。</b><br>
    可作為 Web 擴充功能安裝於 Chrome 與 Firefox。<br>
    也提供適用於其他瀏覽器的 JavaScript 使用者腳本（Userscript）。<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## 緣起

2021 年 11 月 10 日，Google [宣布](https://blog.youtube/news-and-events/update-to-youtube/) YouTube 將移除不喜歡數。

此外，YouTube API 中的 `dislike` 欄位也於 2021 年 12 月 13 日[遭到移除](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)，讓使用者無法在觀看影片前判斷內容品質。

## 運作方式

YouTube API 移除不喜歡統計資料後，我們的後端改為結合擷取到的不喜歡統計資料，以及根據擴充功能使用者資料推算出的估計值。

[常見問題（簡體中文）](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQcn.md)

## 重要性

如需進一步瞭解，請造訪我們的網站：[returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API 文件

第三方可以使用這個開放 API，但須遵守以下限制：

- **標示來源**：使用時必須清楚標示本專案，並連結至 [returnyoutubedislike.com](https://returnyoutubedislike.com/)。
- **速率限制**：每個用戶端每分鐘最多 100 次、每天最多 10,000 次。超過限制時會傳回 _429_ 狀態碼，表示您的應用程式應降低請求頻率。

可透過下列基礎 URL 使用 API：
https://returnyoutubedislikeapi.com

可用端點清單：
https://returnyoutubedislikeapi.com/swagger/index.html

### 取得投票數

以下範例可取得指定 YouTube 影片 ID 的投票數：
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

不存在的 YouTube ID 會傳回 _404_「Not Found」狀態碼。<br>
格式不正確的 YouTube ID 會傳回 _400_「Bad Request」狀態碼。

<!---
## API 文件

您可以在我們的網站上查看完整文件。
[https://returnyoutubedislike.com/docs/](https://returnyoutubedislike.com/docs/) -->

## 貢獻

請閱讀[貢獻指南（簡體中文）](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTINGcn.md)。

## 支持本專案！

您可以透過下方連結捐款支持本專案：

[捐款](https://returnyoutubedislike.com/donate)

## 贊助者

[成為我們的贊助者，即可在本儲存庫與官方網站上展示](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
