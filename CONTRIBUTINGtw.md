其他語言版本：[English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [简体中文](CONTRIBUTINGcn.md), [繁體中文](CONTRIBUTINGtw.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# 歡迎閱讀 Return YouTube Dislike 貢獻指南

感謝您投入時間為本專案做出貢獻！您提交的修改一經採納，就會收錄在新版擴充功能或[網站](https://www.returnyoutubedislike.com/)中。

## 開始之前

請使用本專案的 Prettier 設定進行程式碼格式化。

#### 前置需求

您需要安裝 Node.js 和 npm，才能建立原始碼的打包版本。請使用 [.nvmrc](.nvmrc) 和 [package.json](package.json) 中指定的版本。

1. 進入專案根目錄，執行以下指令安裝相依套件：

```
npm ci
```

2. 開發時，執行以下指令建立開發版本，並持續監視檔案變更：

```
npm run dev
```

儲存修改時會自動重新建置。在瀏覽器中測試修改時，請重新載入擴充功能及測試頁面。

若要建置正式版本，請執行：

```
npm run build
```

建置後，Chrome 和 Firefox 版本分別位於 `Extensions/combined/dist/chrome` 和 `Extensions/combined/dist/firefox`。在 Chrome 中，可透過開發人員模式載入 `chrome` 目錄中的未封裝擴充功能；在 Firefox 中，可將 `firefox` 目錄中的 `manifest.json` 載入為暫時附加元件進行測試。

恭喜，您現在已準備好開始開發！

如果您是第一次開發 Chrome 擴充功能，或需要額外協助，請參考[這個 YouTube 教學影片](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### 問題回報

#### 提出新問題

如果您遇到擴充功能的問題，請先搜尋確認該問題尚未被回報。如果沒有，請開啟一個 issue。強烈建議使用 issue 表單，但並非必須。

#### 解決問題

如果您發現某個問題是您能夠解決的，請不要猶豫。請提交包含修正內容的 PR，並註明您正在修復的 issue。

### 功能需求

#### 提出新功能需求

如果您對擴充功能有想法，歡迎開啟功能需求，但請先搜尋確認該功能尚未被提出。強烈建議使用功能需求表單，但並非必須。

#### 實作功能需求

如果您發現某個功能是您能夠實作的，請不要猶豫。請提交 PR，並註明您正在實作的功能。

### 我們接受哪些 PR？

- 問題修正。
- 功能實作。
- 錯字修正，或更好、更易懂的用詞。
- 網站相關貢獻。
