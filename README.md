[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

Read this in other languages: [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md) 

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike is an open-source extension that returns the YouTube dislike count.</b><br>
    Available for Chrome and Firefox as a Web Extension.<br>
    Also available for other browsers as JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## The Story

On November 10th, 2021, Google [announced](https://blog.youtube/news-and-events/update-to-youtube/) that the YouTube dislike count would be removed.

Additionally, the `dislike` field in the YouTube API was [removed](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) on December 13th, 2021, removing any ability to judge the quality of content before watching.

## What it Does

With the removal of dislike stats from the YouTube API, our backend switched to using a combination of scraped dislike stats, estimates extrapolated from extension user data.

[FAQ](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## Why it Matters

You can learn more at our website at: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

## API documentation

Third-party use of this open API is allowed with the following restrictions:

- **Attribution**: This project should be clearly attributed with a link to [returnyoutubedislike.com](https://returnyoutubedislike.com/).
- **Rate Limiting**: There are per client rate limits in place of 100 per minute and 10,000 per day. This will return a _429_ status code indicating that your application should back off.

The API is accessible over the following base URL:  
https://returnyoutubedislikeapi.com

List of available endpoints is available here:  
https://returnyoutubedislikeapi.com/swagger/index.html

### Get votes

Example to get votes of a given YouTube video ID:  
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

Non-existent YouTube ID will return status code _404_ "Not Found".  
Wrong formed YouTube ID will return _400_ "Bad Request".

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## Contributing

Please read the [contribution guide](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md).

## Support this project!

You can support this project by donating to us on the link below:

[Donate](https://returnyoutubedislike.com/donate)

## Sponsors

[Seed4.Me VPN](https://www.seed4.me/users/register?gift=ReturnYoutubeDislike)

[Become our sponsor](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
