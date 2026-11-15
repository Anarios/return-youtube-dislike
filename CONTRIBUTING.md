Read this in other languages: [English](CONTRIBUTING.md), [فارسی](CONTRIBUTINGfa.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [беларуская](CONTRIBUTINGbe.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md), [Slovenščina](CONTRIBUTINGsl.md)

# Welcome To Return YouTube Dislikes contributing guide

Thank you for investing your time in contributing to our project! All your changes will be reflected in the next version of the extension (or the [website](https://www.returnyoutubedislike.com/)).

## Getting Started

Use the Node.js version in [`.nvmrc`](.nvmrc) and the npm version in the `packageManager` field of [`package.json`](package.json). Format your changes with Prettier using the configuration in the same file.

From the repository root, install the dependencies recorded in the lockfile.

```sh
npm ci
```

For development, start the watcher. It rebuilds the extension when you save a source file.

```sh
npm run dev
```

For a one-time production build, run the following command.

```sh
npm run build
```

Both commands write browser-specific bundles to the `chrome`, `firefox`, and `safari` folders under `Extensions/combined/dist/`.

To try the Chrome build, open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `Extensions/combined/dist/chrome`. To see content script changes after a rebuild, reload the extension there and refresh the YouTube tab.

Run the unit tests from the repository root.

```sh
npm test
```

If you are new to developing Chrome extensions, or need extra help, please see [this YouTube tutorial](https://www.youtube.com/watch?v=mdOj6HYE3_0)

### Issues

#### Opening a new issue

If you have any issues with the extension, please search to make sure the issue isn't already reported. If it isn't, open an issue, using the issue form is highly recommended but not mandatory.

#### Solving an issue

If you found an issue that you feel you might be able to solve, don't be shy. Open a PR with the fix and make sure to mention the issue you are fixing.

### Feature Request

#### Opening a new feature request

If you have an idea for the extension, feel free to open a feature request, but please search it before to make sure the feature isn't already suggested. Using the feature form is highly recommended but not mandatory

#### Implementing a feature request

If you found a feature that you feel you might be able to implement, don't be shy. Open a PR with the fix and make sure to mention the feature you are implementing.

### What PRs do we accept?

- Issue fixes.
- Feature implementation.
- Typos or better and easier words to use.
- Website contributions.
