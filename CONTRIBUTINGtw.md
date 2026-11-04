其他語言版本：[English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# 歡迎閱讀 Return YouTube Dislikes 貢獻指南

感謝您投入時間為本專案做出貢獻！您的所有修改都會反映在擴充功能的下一個版本中（或是 [網站](https://www.returnyoutubedislike.com/)）。

## 開始之前

請使用預設設定的 Prettier 進行程式碼格式化。

#### 前置需求

您需要安裝 node 和 npm，才能建立原始碼的打包版本。

建立時使用的版本：

- node: 12.18.4
- npm: 6.14.6

要建立包含本擴充功能大部分業務邏輯的 `bundled-content-script.js`，您必須先安裝所有相依套件。

1. 進入專案根目錄，執行：

```
npm install
```

2. 執行以下指令建立 `bundled-content-script.js`（供 `manifest.json` 使用）

```
npm start // 建立建置檔案並啟動檔案監視器，儲存時會自動熱重載

// 或者

npm run build // 僅建立一次建置檔案
```

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
