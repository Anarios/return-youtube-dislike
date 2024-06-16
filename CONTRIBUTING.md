Read this in other languages: [русский](CONTRIBUTINGru.md), [Nederlands](CONTRIBUTINGnl.md), [Français](CONTRIBUTINGfr.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Polski](CONTRIBUTINGpl.md), [Deutsch](CONTRIBUTINGde.md)

# Welcome To Return YouTube Dislikes contributing guide

Thank you for investing your time in contributing to our project! All your changes will be reflected in the next version of the extension (or the [website](https://www.returnyoutubedislike.com/)).

## Getting Started

Please use Prettier with default settings for formatting.

#### Prerequisites

You need to have node and npm installed to create the bundled version of the source.

Versions used when setting up:

- node: 12.18.4
- npm: 6.14.6

To create the `bundled-content-script.js` that contains most of the business logic of this extension you have to install all dependencies first.

1. Go to the root of the repo and run:

```
npm install
```

2. Run the following command to create `bundled-content-script.js` which is used in `manifest.json`

```
npm start // to create the build file(s) and start a file watcher that hot-reloads on save

// or

npm run build // to create the build file(s) once
```

Congratulations, You are now ready to develop!

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
