# 어린이 영단어 웹게임: iPad 오디오 재생 / 음원 라이선스 / 이모지 에셋 조사

조사일: 2026-11-11. 대상: 정적 HTML/JS, Mac Safari/Chrome + iPad Safari, 홈 LAN 또는 localhost의 plain http 서빙.

## 0. 표기와 한계

- [verified: URL] 이번 세션에서 해당 페이지 본문을 직접 읽음.
- [search: URL] 검색 결과가 돌려준 URL이고 검색 결과의 요약만 읽음 (원문 페이지는 읽지 못함). 원문 확인 전까지는 verified보다 한 단계 낮은 신뢰도.
- [recall] 기억에 의존, 낡았을 수 있음.
- [estimate] 위 근거로부터의 추정이나 설계 판단.

조사 환경의 한계:
- WebFetch는 이 세션에서 도메인 해석이 막혀 사용 불가였고, Firecrawl로 대체했다. 도중에 Firecrawl 크레딧이 소진되어 일부 페이지(Twemoji/OpenMoji/Noto 원문 README, Piper 새 저장소의 LICENSE, Azure Product Terms, AWS Service Terms, Google Service Specific Terms, WebKit 블로그의 autoplay 정책 글)는 직접 읽지 못했다. 해당 항목은 [search] 또는 [recall]로 표시했다.
- 법률 자문이 아니다. "공식 약관이 말하는 것"과 "불명확한 곳"을 구분해 적었다.

---

## 1. iOS/iPadOS Safari 오디오 재생 패턴

### 1.1 확인된 사실

1. 자동 재생 규칙. 소리가 있는 미디어는 "사용자가 사이트와 상호작용했거나, 음소거이거나, 허용 목록에 있을 때"만 재생되는 것이 일반 규칙이다. 스크립트가 시작한 `play()`와 Web Audio의 `start()` 모두 이 규칙을 받는다. [verified: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay]
2. `play()`는 Promise를 반환하고, 권한 문제는 `NotAllowedError`, 지원하지 않는 소스는 `NotSupportedError`로 reject된다. Safari iOS는 10부터 Promise 반환. [verified: https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/play]
3. 요소별 제스처 제한. WebKit 개발자 Eric Carlson의 말: "play() 또는 load()는 `<video>`와 `<audio>` 요소마다 사용자 제스처 핸들러 안에서 한 번 호출되어야 한다. 그 이후 제한은 풀려서, 한 파일을 load/play한 뒤 'src'를 바꿔 다른 파일을 제스처 없이 load/play할 수 있다." 단, 이 글은 iOS 8 시기 버그 코멘트라 오래됐다. 최신 iPadOS에서 그대로인지는 실기기 확인 필요. [verified: https://bugs.webkit.org/show_bug.cgi?id=134925]
4. 무음 스위치(벨소리 음소거) 동작. Web Audio는 iOS 링거가 무음일 때 음소거되고, HTML `<audio>`/`<video>`는 media 채널을 써서 계속 들린다. 해결책으로 (a) 무음 mp3를 `<audio>`로 루프 재생해 믹서를 media 채널로 전환, (b) iOS 17부터 `navigator.audioSession.type = "playback"` (기본값은 `ambient`라 무음일 때 음소거). 이 WebKit 버그는 "RESOLVED CONFIGURATION CHANGED". [verified: https://bugs.webkit.org/show_bug.cgi?id=237322]
5. AudioContext `state`에는 `interrupted` 값이 있다. iOS Safari에서 사용자가 페이지를 떠나면(탭 전환, 최소화, 화면 끄기) `interrupted`가 되고 `resume()`이 필요하다. MDN 예시는 `if (audioCtx.state === "interrupted") { audioCtx.resume().then(() => play()); return; }`. `interrupted`는 Safari 9+(iOS 포함)로 표기. [verified: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/state]
6. `decodeAudioData`는 Promise 반환 형태가 Safari 14.1 / iOS 14.5부터이고, 그 이전은 콜백 형태만 된다(콜백 형태는 Safari 6부터). 따라서 iPad가 iPadOS 14.5 미만이면 콜백 형태를 써야 한다. 또한 "완전한 파일 데이터"에만 동작한다. [verified: https://developer.mozilla.org/en-US/docs/Web/API/BaseAudioContext/decodeAudioData]
7. 포맷 지원 (MDN 코덱 가이드의 호환 표): MP3는 Safari 3.1부터, FLAC은 Safari 11부터, Vorbis는 Safari "No"; Opus는 Safari에서 CAF 컨테이너로만(macOS 10.13/iOS 11 기준 서술). AAC는 MP4(.m4a) 컨테이너에서 쓰며 Safari 지원은 이 표에서 직접 확인하지 못했다(아래 [recall]). [verified: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Audio_codecs]
8. `AudioContext` `interrupted` 이후 복귀 문제는 실제 WebKit 버그로 반복 보고된다: iOS 17.4.1~17.5.1 회귀(Bug 276016), Safari 18에서 포그라운드 복귀 후에도 `interrupted` 유지(Bug 281955), `resume()`이 효과 없는 경우(Bug 273511), 상태는 `running`인데 실제로는 음소거(Bug 283419). 해결 방법으로 `visibilitychange`에서 `resume()`, `resume()` 실패 시 탭-투-리쥼 오버레이가 흔히 쓰인다. [search: https://bugs.webkit.org/show_bug.cgi?id=276016] [search: https://bugs.webkit.org/show_bug.cgi?id=273511] [search: https://lists.webkit.org/pipermail/webkit-unassigned/2024-October/1191544.html] [search: https://bugs.webkit.org/show_bug.cgi?id=283419]
9. iOS는 오디오/비디오를 사용자가 재생을 요청하기 전에는 로드하지 않는 정책이 오랫동안 유지돼 왔다. preload가 조용히 무시되고 에러도 없다는 보고, 셀룰러 요금 방지를 위해 preload/autoplay가 비활성화된다는 2013년 측정 글, `preload="metadata"`가 `moov`가 앞에 없는 mp4/m4a에서 재생 실패를 일으킨다는 보고가 있다. 현재(2025-2026) iPadOS에서 `load()`가 어디까지 받아오는지는 확인하지 못했다. [search: https://www.stevesouders.com/blog/2013/04/21/html5-video-bytes-on-ios] [search: https://bugs.webkit.org/show_bug.cgi?id=132691] [search: https://dev.to/dexterlung/audio-plays-on-desktop-but-not-on-iphone-ipad-the-culprit-is-the-mp4-moov-atom-1j01]
10. `src`를 빠르게 바꾸면 이전 `play()` Promise가 "The play() request was interrupted by a new load request"(`AbortError`)로 reject된다. Chrome 개발자 문서와 Firefox 테스트가 같은 동작을 확인한다. `pause()` 후 `load()`/`play()`, 또는 `canplay` 이후 `play()` 같은 완화책이 흔하다. 이 에러는 "이전 요청이 대체됨"이라는 정상 신호로 취급하는 것이 안전. [search: https://developer.chrome.com/blog/play-request-was-interrupted] [search: https://searchfox.org/firefox-main/source/dom/media/test/test_play_promise_15.html]
11. `playsinline`은 `<video>`에 필요한 속성이다(MDN은 Safari 자동재생에 필요하다고 서술). 순수 `<audio>`/`new Audio()`로 단어 음성만 재생한다면 사실상 무관하다. 비디오 요소로 오디오를 재생하는 우회는 쓰지 않는다. [verified: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay] (playsinline이 오디오 전용에는 불필요하다는 판단은 [estimate])
12. `navigator.audioSession`은 W3C Editor's Draft 단계이고 2025년 11월 기준 Safari만 구현. 반드시 `'audioSession' in navigator`로 가드. `transient`/`transient-solo`로 두면 HTMLAudioElement가 소리 없이 재생되는 보고가 있다(`playback`만 쓸 것). [search: https://bugs.webkit.org/show_bug.cgi?id=237322 의 후속 코멘트 요약]

### 1.2 [recall] (확인 못 함)
- AAC(.m4a)와 WAV, MP3는 iOS Safari에서 오래전부터 지원. Ogg Vorbis는 미지원이라 쓰지 않는 것이 안전(MDN 표가 Vorbis "No"로 뒷받침).
- 단순 정적 서버(예: 구버전 Python `http.server`)는 HTTP Range 요청을 지원하지 않아 iOS Safari에서 오디오/비디오가 재생 안 되는 문제가 알려져 있다. LAN 서빙 서버의 Range 지원을 실기기로 확인할 것.
- 동시에 많은 미디어 요소를 만들면 iOS에서 메모리/디코더 한도에 걸린다는 경험담이 있다. 수치는 확인 못 함.

### 1.3 (a) 공유 Audio 1개 vs (b) Web Audio vs (c) Audio 여러 개 비교

| 항목 | (a) 공유 HTMLAudioElement 1개, src 교체 | (b) AudioContext + decodeAudioData 버퍼 | (c) Audio 객체 다수 |
|---|---|---|---|
| 첫 탭 해제 | 요소 1개만 해제하면 됨. src 교체는 제스처 없이 가능했다는 과거 WebKit 코멘트(3) | AudioContext를 제스처 안에서 생성/`resume()`. 이후 재생 자유 | 요소마다 제스처 필요(3). 해제 누락 위험 |
| 무음 스위치 | media 채널이라 들림(4) | 기본은 음소거됨. iOS 17+ `audioSession.type='playback'` 또는 무음 audio 루프 필요(4) | (a)와 동일 |
| 잠금/앱 전환 후 | 요소가 일시정지되고 다음 `play()`는 대개 가능(추정). 별도 `interrupted` 상태 없음 | `interrupted` 진입, `resume()` 필요하고 가끔 안 풀림(5, 8) | (a)와 동일 |
| 지연/반응성 | src 교체마다 로딩 지연, 연타 시 AbortError(10) | 디코드 후 메모리에서 즉시 재생. 가장 낮은 지연 | 미리 만든 요소는 빠르나 iOS preload 불확실(9) |
| 메모리 | 최소 | 단어 수 x PCM 크기. 수백 단어 짧은 클립이면 보통 허용 가능(추정) | 요소 수에 비례 |
| 구현 복잡도 | 낮음 | 중간 (fetch/decode/캐시, 구버전 콜백 분기(6)) | 중간~높음 |
| 권장도 | 1차 권장 | 지연이 문제로 판명될 때의 2차 | 비권장 |

결론 (신뢰도: 중간): 1차는 (a) 공유 HTMLAudioElement 1개. 근거는 무음 스위치에서 안전하고(4), 단순하며, 제스처 해제 지점이 하나라는 점. 단 "src를 바꿔도 제스처가 다시 필요 없다"는 근거(3)가 오래된 글이라 실기기 확인이 필수. 체감 지연이 크면 (b)로 가되, 반드시 `audioSession.type='playback'` 가드 + `interrupted` 처리를 같이 넣는다.

---

## 2. Web Speech API (speechSynthesis)

확인된 것:
- Safari iOS의 `speak()` 지원은 iOS 7부터 표기. [verified: https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/speak] (같은 페이지에 사용자 활성화 요구 서술은 없음)
- `getVoices()`는 브라우저에 따라 비동기로 채워지며, Chrome처럼 `voiceschanged` 이벤트를 기다려야 하는 곳이 있고, 오래된 브라우저는 즉시 목록을 반환한다. [verified: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API]
- iOS 18에서 Safari의 Web Speech `getVoices()`에 고품질 voice(compact)가 사라지고 저품질(eloquence) voice만 노출된다는 Apple 개발자 포럼 보고(스페인어 사례, 2024-09/10). 시뮬레이터에는 있고 실기기에는 없음. 해결책 언급 없음. en-US에서 동일한지는 직접 확인 못 함. [verified: https://developer.apple.com/forums/thread/764438]

검색 요약 수준 (원문 미확인):
- 설치된 voice가 전부 노출되지 않는다는 Apple 포럼 글. [search: https://developer.apple.com/forums/thread/723503]
- iOS Safari는 사용자 제스처 밖의 `speak()`를 무음 처리하며, `cancel()` 직후 `speak()`에 짧은 지연/경합이 있다는 2차 자료. voices가 로드 시점에 비어 있고 `voiceschanged`가 Safari에서 안 뜬다는 오래된(2014) Q&A, iOS 14에서 voice의 `name`이 빈 문자열이었다는 WebKit 버그. [search: https://www.testmuai.com/learning-hub/speech-synthesis-api-browser-support/] [search: https://bugs.webkit.org/show_bug.cgi?id=216684]

결론 (신뢰도: 중간~높음): 임시 대체 수단으로만 허용. 이유: (1) 어떤 voice가 보일지 OS 버전/설정/업데이트에 따라 달라 통제 불가 (iOS 18 회귀 사례), (2) 제스처 요건과 cancel/speak 경합으로 연타에 취약, (3) 발음이 아이에게 "정답 발음"이 되는데 voice 품질이 장치마다 다름, (4) 녹음 음원은 한 번 만들면 모든 기기에서 동일. 사용 시에는 UI에 "임시 음성(기기 음성)"임을 명시하고, 녹음 파일이 없거나 재생 실패했을 때만 호출. 호출 전 `speechSynthesis.cancel()`, voices가 빈 배열이면 `voiceschanged` 대기 + 타임아웃 후 `lang='en-US'`만 지정해 기본 voice 사용.

---

## 3. 음원 제작 라이선스

### 3.1 총괄표 (개인 가족 사용 / 공개 시)

| 방법 | 개인 가족 사용 | 앱을 공개한다면 | 확실성 |
|---|---|---|---|
| (i) Flite (CMU) | 문제 없음 | 대체로 가능, 고지 유지 | 엔진: 높음. 개별 voice 데이터: 중간 |
| (ii-a) Piper + lessac | 회색/비권장 (연구용 라이선스) | 사용 불가로 취급 | 데이터셋 약관은 확인(높음), 모델·산출물에 어떻게 걸리는지는 불명확 |
| (ii-b) Piper + ljspeech | 가능 | 가능 (public domain 표기) | 모델 카드 기준 중간~높음 |
| (ii-c) Piper + amy | 불명확 | 불명확 | 낮음 (카드: "See URL", 최근 재학습) |
| (iii) macOS `say` | 개인·비상업 범위에서 가능, 회색 지대 있음 | 불가 | 약관 원문 확인 (높음) |
| (iv) 클라우드 TTS | 약관상 대체로 저장·사용 가능 | 유료 플랜/약관 조건 충족 시 가능 | 업체별 상이 (아래) |
| (v) 부모 직접 녹음 | 문제 없음 | 본인 권리. 타인 목소리 포함 시 동의 필요 | 높음 (일반 원칙) |

### 3.2 (i) Flite / CMU voices (ffmpeg flite 필터)

- 엔진: CMU Flite는 "BSD-like" 자유 소프트웨어이며 "상업 제품에도 사용 가능". 조건은 저작권 고지 유지, 수정 표시, 저자명 삭제 금지, 보증 부인. 출력 음성에 대한 별도 제한 문구는 COPYING에 없다. 배포물 전체가 이 라이선스를 따르되 일부 파일만 예외(regex, g72x, rateconv 등, 모두 유사한 자유 라이선스). [verified: https://raw.githubusercontent.com/festvox/flite/master/COPYING]
- ffmpeg의 flite 필터는 `--enable-libflite`로 빌드된 ffmpeg가 필요하고, 기본 voice는 `kal`이며 `awb, kal, kal16, rms, slt` 등이 등록돼 있다. [search: https://ayosec.github.io/ffmpeg-filters-docs/4.2/Sources/Audio/flite.html]
- voice 데이터: CMU ARCTIC(slt, awb, rms 등)은 "BSD 스타일 오픈 소프트웨어 라이선스, 상업/비상업 제한 없음"으로 서술된다. 단 HTS 파생 voice(slt)는 CC BY 3.0이라는 별개 안내가 있어 "파생 모델마다 약관이 다르다." `kal`(diphone 계열)의 라이선스는 검색에서 확인하지 못했다. [search: https://hts-engine.sourceforge.net/readme_hts_voice_cmu_us_arctic_slt.php] [search: https://openpolar.no/Record/ftciteseerx:oai:CiteSeerX.psu:10.1.1.64.8827]
- 판단: Flite 배포물에 포함된 voice는 COPYING의 포괄 조항 아래에 있다고 해석하는 것이 자연스럽지만 이것은 [estimate]. 사용할 voice를 정한 뒤 해당 voice 파일/소스의 헤더 저작권 문구를 직접 확인해 `CREDITS`에 기록할 것. 음질은 로봇 음성에 가까워 학습용 정답 발음으로는 부족할 가능성 [estimate].
- 공개 시: 위 고지 유지 의무 외 큰 변화 없음.

### 3.3 (ii) Piper TTS

- 엔진: 원래 `rhasspy/piper`는 MIT 라이선스이며 2025-10-06에 아카이브되었고 "개발은 `OHF-Voice/piper1-gpl`로 이동"했다고 표시됨. 새 저장소 이름이 GPL을 암시하지만 LICENSE 원문은 확인하지 못했다. 엔진 라이선스가 생성된 오디오에 전이되는지에 대해서는 일반적으로 도구의 출력물에는 전이되지 않는다는 것이 통상 해석이나 [estimate], GPL 엔진을 배포(재배포)하지 않고 로컬에서 돌려 파일만 만든다면 영향이 적다. [verified: https://github.com/rhasspy/piper] (이동 안내와 MIT 표기). 새 저장소: [search: https://github.com/OHF-Voice/piper1-gpl]
- voice는 엔진과 별개로 각 학습 데이터셋의 라이선스를 따른다. Hugging Face의 `rhasspy/piper-voices` 저장소 전체에는 MIT 태그가 붙어 있으나 이는 개별 데이터셋 약관을 대신하지 못한다. [search: https://huggingface.co/rhasspy/piper-voices/blob/856d185c267ad13c45e707792c8c6fbf5fac01d9/en/en_US/lessac/medium/MODEL_CARD]
- lessac: 모델 카드가 Blizzard 2013(CSTR, Edinburgh) 데이터셋과 해당 라이선스 링크를 명시. [verified: https://huggingface.co/rhasspy/piper-voices/blob/v1.0.0/en/en_US/lessac/high/MODEL_CARD] 그 라이선스는 "Research Licence Agreement"로, 허용 목적은 "연구와 탐구(Research Purposes)"뿐이고, 상업 목적 및 "voice synthesis 제품/서비스의 개발·마케팅·상용화"를 명시적으로 제외하며, 제3자 사용 불허(8조), 양도·재배포 금지(7조). 라이선스는 서명한 개인/기관에게만 부여됨. [verified: https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html] 이 약관이 "학습된 모델"과 "그 모델이 만든 오디오"에 어떻게 미치는지는 불명확하다. 어쨌든 가족용이라도 "연구 목적"이 아니므로 회색 지대이고, 공개한다면 사용하지 않는 것이 안전. 신뢰도: 약관 내용은 높음, 적용 범위는 낮음.
- ljspeech(medium): 모델 카드에 데이터셋 URL과 "License: public domain". [verified: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/ljspeech/medium/MODEL_CARD] (데이터셋이 LibriVox 공개 도메인 녹음이라는 배경은 [recall])
- amy(medium): 모델 카드가 데이터셋을 `MycroftAI/mimic3-voices`로 적고 "License: See URL"이라 약관이 카드에 직접 없고, 같은 카드에 "hifi_tts_92 base에서 fine-tune, 최근 재학습" 커밋이 있다(조회 시점 기준 약 16시간 전 커밋). 모델 카드가 최근에도 바뀌는 중이라 생성 시점에 다시 확인해야 한다. [verified: https://huggingface.co/rhasspy/piper-voices/blob/main/en/en_US/amy/medium/MODEL_CARD] (Hi-Fi TTS 데이터셋이 CC BY 4.0이라는 점은 [recall])
- 정리: 생성 시점에 사용한 모델 카드·`.onnx.json`을 저장소에 같이 보관하고, voice 이름/버전/날짜를 `CREDITS`에 기록. ljspeech가 가장 명확. lessac은 피한다.

### 3.4 (iii) macOS `say` / Apple 시스템 voice

macOS Tahoe SLA 원문(발췌): System Voices는 "(1) Apple Software를 실행하는 동안, (2) 본인의 개인적·비상업적 용도의 원본 콘텐츠와 프로젝트를 만드는 데" 사용할 수 있고, "이 라이선스는 그 밖의 System Voices 생성이나 사용을 허용하지 않으며, 영리·비영리·공개 공유·상업적 맥락에서 System Voices의 사용·복제·전시·공연·녹음·게시·재배포를 포함한다." [verified: https://www.apple.com/legal/sla/docs/macOSTahoe.pdf] (해당 PDF 895쪽 중 앞부분에서 발췌된 답. 조항 번호와 문서 버전 표기는 추출 결과에 없었음.)

해석:
- 부모가 자기 Mac에서 `say`로 만든 오디오를 자기 가족의 iPad로 서빙해 쓰는 것은 "본인의 개인적·비상업적 프로젝트" 범위로 읽힐 여지가 있다. 다만 "공개 공유" 및 "재배포" 금지 문구가 있어 가족 구성원 기기에 파일을 배포하는 것이 경계에 걸리는지는 약관만으로 단정할 수 없다. 불명확, 회색 지대.
- 앱을 공개하면 명백히 불가("public sharing", "redistribution"). Siri voice도 같은 계열로 보도되나 원문 미확인. [search: https://developer.apple.com/forums/thread/776244]
- 따라서 `say` 산출물은 "가족용 임시 음원"으로만 쓰고 공개 전에 교체 대상으로 표시할 것. 신뢰도: 약관 문구 높음, 가족 배포 해석 낮음.

### 3.5 (iv) 클라우드 TTS

- Amazon Polly (FAQ): "Polly가 생성한 음성을 캐시하고 재생할 수 있다", "MP3 같은 표준 포맷으로 저장", "저장과 재사용에 제한이 없다." 마케팅성 FAQ 문구이므로 AWS Service Terms 원문은 확인 못 했다. 별도 attribution 요구는 FAQ에 없음. [verified: https://aws.amazon.com/polly/faqs/]
- Google Cloud TTS: "Cloud Text-to-Speech로 만든 오디오 데이터 파일을 Google Cloud Platform 이용약관과 관련 법을 준수하는 한 애플리케이션이나 미디어에서 사용할 수 있다." 저장·재배포를 명시적으로 다루지는 않음. "경쟁 TTS 학습 금지" 류 조항은 포럼 글 수준. [verified: https://cloud.google.com/text-to-speech/quotas (docs.cloud.google.com/text-to-speech/quotas로 리디렉션)] [search: https://discuss.google.dev/t/text-to-speech-api-license/187973]
- Azure AI Speech: 공식 Product Terms 원문은 못 읽었다. Microsoft Q&A 답변들은 "유료 티어는 출력물 상업 사용 권리가 있고 무료 티어는 평가용이라 해당 권리가 없다", "재배포는 일반적으로 허용, 단 합성 콘텐츠임을 적절히 고지하고 경쟁 TTS 학습에 쓰지 말 것"으로 정리한다. 커뮤니티 답변이지 약관 원문이 아님. [search: https://learn.microsoft.com/answers/a/12933078] [search: https://learn.microsoft.com/en-us/legal/cognitive-services/speech-service/tts-code-of-conduct]
- ElevenLabs: 무료 플랜은 상업 라이선스가 없고 어떤 상업 목적에도 쓸 수 없으며, 무료 플랜(또는 비로그인)에서 만든 콘텐츠를 게시하면 제목에 "elevenlabs.io" 또는 "11.ai"를 표기해야 한다. 모든 유료 플랜은 상업 라이선스 포함(베타 서비스 제외). 유료 구독 중 생성한 콘텐츠는 상업 사용 가능, 구독 밖에서(이전/이후) 만든 콘텐츠는 상업 사용 불가이며 비상업적으로 공유할 때도 항상 표기 필요. [verified: https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform]
- 가족(비상업, 비공개) 용도: 위 약관은 모두 "저장해서 앱에 넣는 것" 자체를 금하지 않는 것으로 읽힌다(ElevenLabs 무료는 "게시" 시 표기 의무, 상업 불가). 무료 한도로 만든 음원을 나중에 공개·상업화하려면 유료 구독 중에 재생성하는 것이 안전하다.
- 공개 시: 유료 플랜(또는 약관 조건 충족) 상태에서 최종 음원을 (재)생성하고, 생성 날짜·플랜·voice를 기록. 합성 음성 고지 문구 추가.

### 3.6 (v) 부모 직접 녹음

- 녹음자(부모)가 저작권·음성 권리 보유자이므로 외부 약관 제약이 없다. 공개 시에도 본인 권리로 가능. 자녀나 제3자 목소리가 섞이면 공개 시 동의 필요(특히 미성년자는 보호자 동의). 일반 원칙이며 법적 확인은 [estimate].
- 단어 자체는 저작권 대상이 아니지만, 사전 사이트(Oxford, Cambridge, Merriam-Webster 등)의 발음 음원은 별도 약관이 있으므로 가져다 쓰지 않는다. [recall]
- 품질 면에서 일관된 마이크/볼륨/무음 트리밍 규칙을 정해 두면 단어 간 편차를 줄일 수 있다 [estimate].

### 3.7 공개 시 변하는 것 요약
- 제거/교체 필수: macOS `say` 산출물, lessac, 무료 플랜 ElevenLabs 산출물(또는 표기 의무 이행).
- 조건 확인 후 가능: Flite(고지 유지), ljspeech(public domain), 유료 클라우드(약관 재확인), 부모 녹음(동의).
- 이모지/그림 에셋은 아래 4절의 attribution 페이지 필요.
- `CREDITS`/`LICENSES.md`에 음원별 출처·도구·모델·생성일·라이선스 링크를 기록하는 구조를 지금부터 두면 나중에 비용이 적다 [estimate].

---

## 4. 이모지 / 그래픽 에셋

| 에셋 | 라이선스 | 개인(비공개) 사용 | 공개 시 | 근거 |
|---|---|---|---|---|
| 시스템 이모지(텍스트 문자로 렌더) | 기기 폰트(Apple Color Emoji 등)에 의존 | 가장 간단. 문자 코드만 포함 | 문자 코드만 쓰면 에셋 재배포 아님. 단 기기별로 모양이 다름 | [search: https://blog.emojipedia.org/who-owns-emoji/] |
| Apple 이모지 이미지를 추출/번들 | 공개 라이선스 없음, Apple 저작물로 취급 | 비권장 | 불가로 취급 (App Store 가이드는 UI 요소로 Apple 이모지 사용 금지) | [search: https://steveklabnik.com/writing/emoji-licensing/] |
| Twemoji | 그래픽 CC BY 4.0, 코드 MIT (jdecked 포크의 LICENSE / LICENSE-GRAPHICS) | 가능 | 가능. 저작권 고지 + CC BY 4.0 표기(출처 표기) 필요 | [search: https://github.com/jdecked/twemoji] |
| OpenMoji | CC BY-SA 4.0 | 가능 | 표기 의무 + ShareAlike. "수정하지 않고 포함만 한" 큰 제품이 SA를 따라야 하는지는 FAQ가 명확히 답하지 않고 GitHub 이슈 #505는 미해결 | [search: https://openmoji.org/faq] [search: https://github.imc.re/hfg-gmuend/openmoji/issues/505] |
| Noto Emoji | 도구와 대부분의 이미지 Apache 2.0, 폰트 SIL OFL 1.1, 국기 일부 퍼블릭 도메인 | 가능 | 가능. Apache 고지 유지. 파일별 라이선스 확인 | [search: https://github.com/googlefonts/noto-emoji] |

참고:
- 위 Twemoji/OpenMoji/Noto 항목은 원문 README를 읽지 못하고 검색 요약으로 확인한 것이라 [search] 수준이다. 번들 전에 해당 저장소의 LICENSE 파일을 직접 열어 확인할 것. 검색 결과 중 한 블로그는 Twemoji를 Apache 2.0이라고 적었으나 이는 포크의 README 발췌(MIT 코드 + CC BY 4.0 그래픽)와 어긋나므로 신뢰하지 않았다.
- 공개를 고려한다면 CC BY-SA의 SA 해석 불확실성 때문에 OpenMoji보다 Noto(Apache 2.0)나 Twemoji(CC BY)가 다루기 쉽다 [estimate].
- 개인 사용은 시스템 이모지로 충분하다. 다만 같은 문자가 Mac Chrome(Apple Color Emoji), iPad Safari에서 같게 보이는지, 오래된 iPadOS에서 최신 이모지가 빈 네모(tofu)로 보이지 않는지 실기기에서 확인해야 한다. 오래된 이모지 위주로 고르는 것이 안전 [estimate].

---

## 5. 설계 시사점 (10개 이하)

1. 오디오 컨트롤러 1개 + 공유 `HTMLAudioElement` 1개. 첫 "시작" 탭 핸들러 안에서 `play()`로 요소를 해제하고(짧은 실제 클립 또는 무음), 페이지 로드 시점에는 절대 `play()`하지 않는다. 새로고침하면 제스처가 사라지므로 시작 화면을 다시 거친다.
2. 요청 토큰(`seq`)으로 오래된 재생 취소. `play(word)`마다 `seq++`, `pause()` -> `src` 교체 -> `play()`. 모든 비동기 후속(Promise, `canplay`, 타이머)은 `seq === mine`일 때만 반영. 빠른 화면 전환 시 이전 단어가 뒤늦게 재생되지 않게 한다.
3. 대체된 요청의 `AbortError`는 실패가 아니라 정상 취소로 무시(토큰이 다를 때). 현재 요청의 `NotAllowedError`는 "소리 켜기" 탭 유도(대기 단어 보존), `NotSupportedError`와 `error` 이벤트(`media.error.code`)는 해당 파일 불량으로 기록.
4. 중복 재생 방지: 같은 단어가 이미 로딩/재생 중일 때 자동 트리거는 무시, 사용자가 직접 누른 재생 버튼은 처음부터 다시 재생. 호출에 `source: 'auto' | 'user'`를 둔다.
5. 실패 감지는 3중으로: `play()` reject, `error` 이벤트, 감시 타이머(예: 호출 후 N초 내 `playing` 이벤트가 없으면 stalled로 판정; N은 LAN에서 실측 후 결정 [estimate]). 게임 진행을 오디오 `ended`에 묶지 말고 타임아웃으로 풀어준다.
6. 잠금/백그라운드 복귀: `visibilitychange`(visible)와 `pageshow`에서 상태 점검. 요소는 재생성하지 말고(재해제 필요) `pause()` 후 마지막 요청만 재시도 가능하게 둠. Web Audio를 쓰게 되면 `state !== 'running'`일 때 `resume()`에 타임아웃을 걸고, 풀리지 않으면 "소리 켜기" 버튼 노출(`interrupted` 고착 버그 전제).
7. 파일 포맷: 1차 AAC(.m4a, `faststart`로 moov를 앞에) + MP3 폴백, Ogg/Vorbis 금지. 짧게 트리밍, 모노. 정적 서버는 Range 요청 지원 여부를 먼저 확인(구버전 `python -m http.server`는 미지원 가능 [recall]).
8. iOS에서는 preload를 믿지 않는다. 다음 단어 선로딩이 필요하면 지연을 실측해서 (a)를 유지할지 (b) 버퍼 방식으로 전환할지 결정. (b)를 쓰면 `'audioSession' in navigator` 가드 후 `type='playback'`, `decodeAudioData`는 Promise/콜백 이중 분기.
9. speechSynthesis는 "임시 음성" 라벨과 함께 녹음 파일 없음/재생 실패 시에만 호출. 호출 전 `cancel()`, voices 비어 있으면 `voiceschanged` 대기 + 타임아웃. 자동 테스트와 정답 판정 로직에서는 사용하지 않는다.
10. 숨김 디버그 패널(요소 `readyState`, `networkState`, `error`, 마지막 `play()` 결과, AudioContext `state`, 이벤트 로그)을 두어 iPad에서 원인 분석이 가능하게 한다.

### 실제 iPad에서만 검증 가능한 것
- 첫 탭 해제 후 `src` 교체 재생이 제스처 없이 되는지 (근거 3은 오래된 글).
- 무음 스위치 ON 상태에서 HTML audio가 들리는지, (b)를 쓴다면 `audioSession.type='playback'`이 효과 있는지.
- 화면 잠금/앱 전환/제어센터/다른 앱 소리 후 복귀: 재생 가능 여부, `interrupted` 고착, `resume()` 효과.
- LAN plain http 서버의 Range 응답, m4a/mp3 디코드, `faststart` 영향, 첫 재생 지연, 연타(빠른 화면 전환) 시 AbortError 빈도.
- 저전력 모드, 홈 화면 추가(PWA/standalone) 모드에서의 동작 차이 (iOS 26의 PWA 내 `<audio>` 문제 보고가 있음: [search: https://bugs.webkit.org/show_bug.cgi?id=291892]).
- `navigator.audioSession` 유무와 iPadOS 버전별 동작, speechSynthesis의 en-US voice 목록과 `voiceschanged` 발생 여부.
- 이모지 렌더링(최신 코드포인트의 빈 네모 여부).

---

## 6. 권고 한 줄 요약 (신뢰도)
- 오디오: 공유 HTMLAudioElement 1개 + 요청 토큰 + 시작 탭 해제 (중간; 실기기 검증 전제).
- speechSynthesis: 임시 폴백으로만 (중간~높음).
- 음원: 가족용은 ljspeech(Piper) / Flite / 부모 녹음 / 유료 클라우드가 약관상 무난, `say`는 가족용 임시, lessac 회피. 공개 시에는 `say`와 lessac 제거 (약관 문구 높음, 적용 해석 낮음~중간).
- 이모지: 개인은 시스템 이모지, 공개 대비는 Noto 또는 Twemoji + 출처 표기 (낮음~중간; 원문 LICENSE 확인 필요).
