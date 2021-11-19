[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike)](https://github.com/Anarios/return-youtube-dislike/issues)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)
[![Mozilla Add-ons](https://img.shields.io/amo/rating/return-youtube-dislikes?label=Firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)

# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike is an open-source extension that returns the YouTube dislike count.</b><br>
    Available for Chrome and Firefox as a Web Extension.<br>
    Also available for other browsers as JS Userscript.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## The Story

On November 10th, 2021, Google [announced](https://blog.youtube/news-and-events/update-to-youtube/) thathe YouTube dislike count would be removed.  
  
Additionally, the `dislike` field in the YouTube API will be [removed](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts) on December 13th, 2021, removing any ability to judge the quality of content before watching.

## What it Does

This plugin will re-enable the visibility of the dislike count, fetching the total number of dislikes via our API, which in turn relies upon YouTube's [Data API](https://developers.google.com/youtube/v3).

With the removal of dislike stats from the YouTube API, our backend will switch to using a combination of scraped dislike stats, estimates extrapolated from extension user data
and estimates based on view\like ratios.

## Why it Matters

You can learn more at our website at: [returnyoutubedislike.com](https://www.returnyoutubedislike.com/)

