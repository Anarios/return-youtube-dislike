[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Rating&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Chrome Web Store Users](https://img.shields.io/chrome-web-store/users/gebbhagfogifgggkldgodflihgfeippi?label=Chrome%20Users&style=flat&logo=google)](https://chrome.google.com/webstore/detail/youtube-dislike-button/gebbhagfogifgggkldgodflihgfeippi/)
[![Mozilla rating](https://img.shields.io/amo/stars/return-youtube-dislikes?label=Firefox%20Rating&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Mozilla downloads](https://img.shields.io/amo/users/return-youtube-dislikes?label=Firefox%20Users&style=flat&logo=firefox)](https://addons.mozilla.org/en-US/firefox/addon/return-youtube-dislikes/)
[![Commit rate](https://img.shields.io/github/commit-activity/m/Anarios/return-youtube-dislike?label=Commits&style=flat)](https://github.com/Anarios/return-youtube-dislike/commits/main)
[![Issues](https://img.shields.io/github/issues/Anarios/return-youtube-dislike?style=flat&label=Issues)](https://github.com/Anarios/return-youtube-dislike/issues)
[![Discord](https://img.shields.io/discord/909435648170160229?label=Discord&style=flat&logo=discord)](https://discord.gg/UMxyMmCgfF)
[![License](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://github.com/Anarios/return-youtube-dislike/blob/main/LICENSE)

다른 언어로 전환: [English](README.md), [русский](READMEru.md), [Español](READMEes.md), [Nederlands](READMEnl.md), [Français](READMEfr.md), [日本語](READMEja.md), [Türkçe](READMEtr.md), [українська](READMEuk.md), [Deutsch](READMEde.md), [Ελληνικά](READMEgr.md), [Svenska](READMEsv.md), [中文](READMEcn.md), [Polski](READMEpl.md), [Português do Brasil](READMEpt_BR.md), [Magyar](READMEhu.md), [Danish](READMEda.md)
# Return YouTube Dislike

<p align="center">
    <b>Return YouTube Dislike는 YouTube 싫어요 수를 반환하는 오픈소스 확장 프로그램입니다.</b><br>
    Chrome 및 Firefox에서 웹 확장 프로그램으로 제공됩니다.<br>
    JS Userscript로 다른 브라우저에서도 제공됩니다.<br><br>
    <img width="400px" src="https://user-images.githubusercontent.com/18729296/141743755-2be73297-250e-4cd1-ac93-8978c5a39d10.png"/>
</p>

## 배경

2021년 11월 10일, Google은 YouTube 싫어요 수를 [삭제한다고 발표](https://blog.youtube/news-and-events/update-to-youtube/)했습니다.

또한, 2021년 12월 13일에 Youtube API 에서 `dislike` 필드가 [제거](https://support.google.com/youtube/thread/134791097/update-to-youtube-dislike-counts)되어 영상을 시청하기 전에 콘텐츠의 품질을 판단할 수 있는 기능이 삭제되었습니다.
## 무엇을 하나요?

YouTube API에서 dislike 통계가 제거되면서 백엔드는 스크래핑된 싫어요 통계와 확장 프로그램 사용자 데이터에서 추정한 추정치를 조합하여 사용하도록 전환했습니다.

[자주 묻는 질문](https://github.com/Anarios/return-youtube-dislike/blob/main/Docs/FAQ.md)

## 왜 중요한가요?

자세한 내용은 [returnyoutubedislike.com](https://www.returnyoutubedislike.com/) 에서 확인할 수 있습니다.

## API 문서

다음 제한 사항 하에 서드파티 앱에서 이 Open API를 사용하는 것을 허용합니다.

- **출처**: 서드파티 앱은 [returnyoutubedislike.com](https://returnyoutubedislike.com/) 링크와 함께 명확히 출처를 표시해야 합니다. 
- **Rate Limiting**: 클라이언트당 분당 100개, 하루 당 10,000개의 요청 제한이 있습니다. 하루 할당량 초과 시, 서버에서 429 에러를 반환합니다.

아래 Base URL 을 통해 API에 접근할 수 있습니다:  
https://returnyoutubedislikeapi.com

사용 가능한 엔드포인트 목록은 여기에서 확인할 수 있습니다:<br>
https://returnyoutubedislikeapi.com/swagger/index.html

### Vote 가져오기

아래 예시 처럼 YouTube video ID에서 Vote를 가져올 수 있습니다. <br>
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

존재하지 않는 YouTube ID는 상태 코드 _404_ "Not Found" 를 반환합니다.<br>
잘못 구성된 YouTube ID는 상태 코드  _400_ "Bad Request" 를 반환합니다.

<!---
## API documentation

You can view all documentation on our website.
[https://returnyoutubedislike.com/documentation/](https://returnyoutubedislike.com/documentation/) -->

## 프로젝트 기여 (Contributing)

[기여 가이드](https://github.com/Anarios/return-youtube-dislike/blob/main/CONTRIBUTING.md) 를 확인해보세요.

## 프로젝트 후원

아래 링크를 통해 이 프로젝트를 지원해주세요!:

[후원하기](https://returnyoutubedislike.com/donate)

## 스폰서


[우리의 스폰서가 되어주세요](https://www.patreon.com/join/returnyoutubedislike/checkout?rid=8008601)
