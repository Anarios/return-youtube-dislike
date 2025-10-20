Read this in other languages: [English](CONTRIBUTING.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md)

# Return YouTube Dislike へのコントリビュートガイドへようこそ

本プロジェクトへのご協力に時間を割いていただきありがとうございます！ 皆さまの変更は、拡張機能の次のリリース（または[ウェブサイト](https://www.returnyoutubedislike.com/)）に反映されます。

## はじめに

フォーマットには Prettier をデフォルト設定のまま使用してください。

#### 前提条件

ソースのバンドル版を作成するには、Node と npm をインストールする必要があります。

セットアップ時のバージョン:

- node: 12.18.4
- npm: 6.14.6

この拡張機能の大部分のロジックを含む `bundled-content-script.js` を作成するには、まず依存関係をインストールします。

1. リポジトリのルートに移動して、以下を実行します:

```
npm install
```

2. `manifest.json` で使用される `bundled-content-script.js` を作成するには、次のコマンドを実行します。

```
npm start // ビルドファイルを作成し、保存時に自動リロードするウォッチャーを開始

// または

npm run build // 一度だけビルドファイルを作成
```

おめでとうございます。これで開発を始める準備ができました！

Chrome 拡張の開発が初めて、または追加のヘルプが必要な場合は、[こちらの YouTube チュートリアル](https://www.youtube.com/watch?v=mdOj6HYE3_0)をご覧ください。

### Issue について

#### 新しい Issue を作成する

拡張機能に問題がある場合は、既に報告されていないか検索してください。未報告であれば Issue を作成してください。Issue フォームの使用は強く推奨しますが必須ではありません。

#### Issue を解決する

解決できそうな Issue を見つけた場合は、遠慮なく修正の PR を作成し、修正した Issue を必ず明記してください。

### 機能リクエスト

#### 新しい機能リクエストを作成する

拡張機能に関するアイデアがある場合は、自由に機能リクエストを作成してください。ただし、既に提案されていないか事前に検索してください。機能フォームの使用は強く推奨しますが必須ではありません。

#### 機能リクエストを実装する

実装できそうな機能を見つけた場合は、遠慮なく実装の PR を作成し、実装する機能を必ず明記してください。

### 受け付ける PR

- 不具合修正
- 機能の実装
- 誤字修正や、より良く簡潔な表現への改善
- ウェブサイトへの貢献
