阅读其他语言版本：[русский](CONTRIBUTINGru.md)、[Nederlands](CONTRIBUTINGnl.md)、[Français](CONTRIBUTINGfr.md)、[Türkçe](CONTRIBUTINGtr.md)、[українська](CONTRIBUTINGuk.md)、[Polski](CONTRIBUTINGpl.md)、[Deutsch](CONTRIBUTINGde.md)

# 欢迎来到 Return YouTube Dislikes 贡献指南

感谢您花时间为我们的项目做出贡献！您的所有更改都将反映在扩展的下一个版本中（或 [网站](https://www.returnyoutubedislike.com/)）。

## 入门

请使用 Prettier 的默认设置进行格式化。

#### 先决条件

您需要安装 node 和 npm 才能创建源代码的捆绑版本。

设置时使用的版本：

- node：12.18.4
- npm：6.14.6

要创建包含此扩展的大部分业务逻辑的 `bundled-content-script.js`，您必须先安装所有依赖项。

1. 转到 repo 的根目录并运行：

```
npm install
```

2. 运行以下命令创建 `manifest.json` 中使用的 `bundled-content-script.js`

```
npm start // 创建构建文件并启动在保存时热重载的文件观察器

// 或

npm run build // 创建构建文件一次
```

恭喜，您现在可以开始开发了！

如果您是 Chrome 扩展程序开发新手，或者需要额外帮助，请参阅[此 YouTube 教程](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### 问题

#### 打开新问题

如果您对扩展程序有任何问题，请搜索以确保该问题尚未被报告。如果没有，请打开一个问题，强烈建议使用问题表单，但这不是强制性的。

#### 解决问题

如果您发现一个您认为可以解决的问题，请随时提出来，不必客气。打开带有修复程序的 PR，并确保提及您正在修复的问题。

### 功能请求

#### 打开新的功能请求

如果您对扩展程序有想法，请随时打开功能请求，但请先搜索以确保该功能尚未被建议。强烈建议使用功能表单，但这不是强制性的

#### 实现功能请求

如果您发现您认为可以实现的功能，请随时提出来，不必客气。打开带有修复的 PR，并确保提及您正在实现的功能。

### 我们接受哪些 PR？

- 问题修复。
- 功能实现。
- 拼写错误或更好、更易用的词语。
- 网站贡献。