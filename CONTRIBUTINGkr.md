Read this in other languages: [English](CONTRIBUTING.md), [العربية](CONTRIBUTINGar.md), [Azərbaycan dili](CONTRIBUTINGaz.md), [български](CONTRIBUTINGbg.md), [中文](CONTRIBUTINGcn.md), [Dansk](CONTRIBUTINGda.md), [Deutsch](CONTRIBUTINGde.md), [Español](CONTRIBUTINGes.md), [Français](CONTRIBUTINGfr.md), [Ελληνικά](CONTRIBUTINGgr.md), [Magyar](CONTRIBUTINGhu.md), [Bahasa Indonesia](CONTRIBUTINGid.md), [日本語](CONTRIBUTINGja.md), [한국어](CONTRIBUTINGkr.md), [Nederlands](CONTRIBUTINGnl.md), [Polski](CONTRIBUTINGpl.md), [Português do Brasil](CONTRIBUTINGpt_BR.md), [русский](CONTRIBUTINGru.md), [Svenska](CONTRIBUTINGsv.md), [Türkçe](CONTRIBUTINGtr.md), [українська](CONTRIBUTINGuk.md), [Tiếng Việt](CONTRIBUTINGvi.md)

# Return YouTube Dislike 기여 가이드에 오신 것을 환영합니다

프로젝트에 기여해 주셔서 감사합니다! 여러분의 변경 사항은 확장 프로그램의 다음 버전(또는 [웹사이트](https://www.returnyoutubedislike.com/))에 반영됩니다.

## 시작하기

코드 포매팅에는 기본 설정의 Prettier를 사용해 주세요.

#### 사전 준비물

소스의 번들 버전을 만들려면 Node와 npm이 설치되어 있어야 합니다.

설정 시 사용한 버전:

- node: 12.18.4
- npm: 6.14.6

이 확장 프로그램의 대부분의 비즈니스 로직을 담은 `bundled-content-script.js`를 생성하려면 먼저 모든 의존성을 설치해야 합니다.

1. 저장소 루트로 이동하여 다음을 실행하세요:

```
npm install
```

2. `manifest.json`에서 사용하는 `bundled-content-script.js`를 생성하려면 다음 명령을 실행하세요:

```
npm start // 빌드 파일을 생성하고 저장 시 자동 새로고침하는 감시자 시작

// 또는

npm run build // 빌드 파일을 한 번만 생성
```

축하합니다. 이제 개발할 준비가 되었습니다!

Chrome 확장 프로그램 개발이 처음이거나 추가 도움이 필요하다면 [이 YouTube 튜토리얼](https://www.youtube.com/watch?v=mdOj6HYE3_0)을 참고하세요.

### 이슈

#### 새 이슈 만들기

확장 프로그램에 문제가 있다면, 먼저 동일한 이슈가 이미 보고되지 않았는지 검색해 주세요. 없다면 이슈를 생성해 주세요. 이슈 템플릿 사용을 권장하지만 필수는 아닙니다.

#### 이슈 해결하기

해결할 수 있을 것 같은 이슈를 찾았다면 주저하지 마세요. 수정 사항으로 PR을 열고, 해결 중인 이슈를 꼭 언급해 주세요.

### 기능 요청

#### 새 기능 요청 만들기

확장 프로그램에 대한 아이디어가 있다면 기능 요청을 자유롭게 열어 주세요. 다만, 이미 제안된 내용이 아닌지 먼저 검색해 주세요. 기능 템플릿 사용을 권장하지만 필수는 아닙니다.

#### 기능 요청 구현하기

구현할 수 있을 것 같은 기능을 찾았다면 주저하지 마세요. 구현 내용으로 PR을 열고, 구현하는 기능을 꼭 언급해 주세요.

### 어떤 PR을 수락하나요?

- 버그 수정
- 기능 구현
- 오타 수정 또는 더 좋고 간결한 표현으로 개선
- 웹사이트 관련 기여
