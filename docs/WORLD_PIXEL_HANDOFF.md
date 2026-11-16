# 세계별 색·픽셀 도안 인계

WORKLOG 6절 10번(2026-11-15) 요청을 구현했다. 기준은 Claude `954d84c`, 작업 브랜치는 `codex/world-pixel-assets`다. 기존 게임의 코드·CSS·테스트·음성·음악·학습 기록은 수정하지 않았다.

## 전달물과 실제 범위

| 파일 | 내용 |
|---|---|
| `cards/data/world-art.json` 및 `worlds.json` | 3대륙·30세계의 표시 정보, 세계당 색 변수 8개, 보스·길·성·열쇠의 sprite ID |
| `cards/assets/postal/world-pixels/sprites.svg` | 16×16 정수 격자 보스 도안 180개와 장식용 별칭 6개 |
| `cards/assets/postal/world-pixels/manifest.json` | emoji → sprite ID, 한국어 이름, 원본 크기, 장식 별칭, 기기 검증 상태 |
| `assets/post-office/world-pixels/pixels.json` | 팔레트와 도안별 16줄 픽셀 원본. `.`은 투명 |
| `tools/postal_pixel_recipes.py` | 도안 제작 소스. 가족별 공통 구조와 각 물건의 실루엣·세부 요소 |
| `tools/build_world_pixel_assets.py` | 세계 표와 도안을 대조해 표시용 JSON·SVG 생성; `--check`로 재현 검사 |
| `cards/art-review/` | 세계 색·이모지·기존 축소 확대·새 도안을 나란히 보는 검토판 |

[verified] 30세계 × 6개 = **180개**다. 요청의 ‘174개’와 달리 현재 WORLD_BIBLE 전체를 다시 세어 180개 모두 포함했다. 174라는 숫자의 산출 근거는 문서에 없어 추정하지 않는다. 도안은 OS 이모지를 캡처·축소·추적하지 않고 코드에서 직접 그렸다. 유사 계열은 구조를 공유하지만 180개 픽셀 배열은 서로 다르다. 이 수치는 아이가 모든 그림을 쉽게 구분한다는 의미는 아니다.

장식은 `deco-boat`, `deco-sunflower`, `deco-palm`, `deco-moon`, `deco-shell`, `deco-pear`다. 기존 보스 도안을 같은 모습으로 재사용하는 **별칭 6개**이며 새 보스 6개로 세지 않는다. ‘배’는 항구의 돛단배와 과일 배를 모두 제공했다. 현재 1프레임 정지 도안이며 개별 애니메이션은 없다. 프로젝트 공통 청록 외곽선·크림·차분한 금색/산호색을 사용한다. 외부 게임의 그림·음원은 포함하지 않는다.

## worlds.json 상태와 색 계약

표시 원본 `world-art.json`은 `schemaVersion: 3`, `status: "draft"`, `contentScope: "presentation-only"`, `playable: false`, `counts.assignedCards: 0`이다. `map`, `words`, 필수 집, 대륙 성 규칙, 진도 이관은 없다. **게임용 완성 v3 데이터가 아니며, 학습 로더가 이 파일만 보고 세계를 열어서는 안 된다.** 이후 추가된 `make_worlds.py`가 같은 ID와 표시 필드를 보존해 실제 4,610개 배정 `worlds.json`을 만든다. 전체 worlds도 현재 draft이지만 배정은 완료됐고, 자세한 접점은 [WORLD_GENERATOR_HANDOFF.md](WORLD_GENERATOR_HANDOFF.md)를 따른다. 허구의 빈 words/완료 칸을 넣지 않았다. `source.sha256`는 이번 표시 자료의 WORLD_BIBLE 파일 해시이며 어휘 원본 해시가 아니다.

`world.palette`의 sky/ground/path는 승인 검토한 원래 색을 유지한다. `world.paletteVars`는 정확히 다음 8개 키를 가진다.

```json
{
  "--w-sky": "#DFF3FF",
  "--w-sky-l": "#E5F4FA",
  "--w-ground": "#8FCB83",
  "--w-ground-d": "#77AC73",
  "--w-ground-l": "#A7D59A",
  "--w-path": "#72644A",
  "--w-path-d": "#615C46",
  "--w-path-l": "#90846D"
}
```

위 예시는 문 앞 꽃밭이다. 파생색은 sRGB 각 채널을 어두운 청록 `#233F3A` 또는 밝은 크림 `#FBF7EA`와 22% 혼합하고 반올림한다. [verified] 기본 길·땅의 명암비는 모든 세계 3:1 이상이다. 무늬의 밝은/어두운 픽셀 각각이나 글자 대비까지 3:1이라는 주장은 하지 않는다. 검토판은 실제 `t-grass`/`t-path` 기호를 사용해 무늬도 보여 준다.

Claude 연결 예시:

```js
// 표시 컨테이너 아래의 inline SVG가 변수를 상속하도록 한다.
for (const [key, value] of Object.entries(world.paletteVars)) {
  mapElement.style.setProperty(key, value);
}
// 세계를 바꿀 때 8개를 전부 갱신한다. 현재 표시용 자료로 학습을 열지는 않는다.
```

현재 `t-grass`, `t-path`, `t-cloud`에는 해당 변수가 연결돼 있다. **기존 `t-water-a/b`, `t-sand`, `t-snow`, `t-night`는 고정색**이므로 세계 팔레트로 모두 바뀐다고 가정하지 않는다. 필요하면 Claude가 지형별 변수 연결을 보완한다. 이번 작업은 기존 66개 기호 시트를 덮어쓰지 않고 별도 시트를 제공한다. 기존 v2 생성기를 다시 실행해도 새 팩은 지워지지 않는다.

## 보스·장식 연결

`world.bossSprites`는 `bossEmoji`와 같은 순서로 6개 ID를 가진다. `routes[].spriteId`, `castle.spriteId`, `key.spriteId`는 해당 세계 6개 안에서 고른다. `wb-p1-01-01`처럼 세계 ID와 슬롯을 고정해 이름 변경으로 ID가 바뀌지 않도록 한다. 원본 이모지의 코드 포인트·VS16을 그대로 manifest에 보관한다. **학습 카드 의미 그림으로 쓰지 않는다.** 세계 보스와 배경 장식으로만 쓴다.

게임 로더는 `assets/postal/world-pixels/sprites.svg`를 읽어 기존 시트 옆에 inline으로 한 번 넣는다. ID가 기존 시트와 겹치지 않는다. 모든 새 기호의 viewBox는 `0 0 16 16`이다.

```html
<svg width="64" height="64" viewBox="0 0 16 16" aria-hidden="true"
     style="shape-rendering:crispEdges;image-rendering:pixelated">
  <use href="#wb-p1-01-01" width="16" height="16"/>
</svg>
```

48px(3배) 또는 64px(4배)로 표시하고 이름도 함께 둔다. 미지원 ID나 로드 실패 때는 이름을 남긴다. 달 위상·우편함·펜처럼 비슷한 도안은 특히 이름을 생략하지 않는다. 이번 파일을 추가하는 것만으로 현재 `main.js`의 `px()`나 `BOSSES`가 교체되지는 않는다. WORLD_SCHEMA의 v3 지도 로더와 함께 적용할 담당은 Claude다.

## 검토판과 iPad 확인

Mac에서 기존 명령 `python3 tools/serve_cards.py --host 0.0.0.0`을 실행한 뒤 같은 네트워크의 iPad Safari에서 `http://<Mac의 LAN IP>:8090/art-review/`를 연다. 이 페이지는 게임의 localStorage·state API를 사용하지 않고 음악/단어 음성을 재생하지 않는다. 현재 선택은 메모리에만 있고 새로고침하면 초기화된다.

1. 기기 모델·iPadOS 버전·브라우저를 적는다.
2. 세계별 기본색/길 무늬와 180개 원래 이모지·기존 16px 축소 확대·새 픽셀 도안을 살핀다.
3. 각 항목의 ‘미확인’을 정상/안 보임/구별 어려움으로 직접 바꾼다. 미확인을 정상으로 자동 채우지 않는다.
4. ‘검토 결과 받기’로 JSON을 저장한다. 보고서에는 에셋 버전·문서 해시·기기 설명·UA·시각·각 항목의 실제 선택이 남는다. 기기 인증으로 표시하지 않는다.

[verified] Linux Chromium에서 화면 390/768/1024px, 그림 참조·렌더링·필터·보고서 내보내기를 확인했다. **iPad 실기기·Safari·최저 지원 iPadOS·아이의 선호/구별 능력은 미검증**이다. UA를 iPad로 바꾸는 것으로 실기기 검사를 대체하지 않았다. 검토판의 기기 이모지는 해당 기기 글꼴을 쓰며 픽셀 팩 자체는 이모지 글꼴에 의존하지 않는다.

## 재현과 검사

```sh
python3 -I tools/build_world_pixel_assets.py
python3 -I tools/build_world_pixel_assets.py --check
python3 -I tools/package_world_pixel_review.py --output /tmp/world-pixels/world-pixel-review.html
node tools/check_world_pixel_assets.cjs /tmp/world-pixels
node --test tests/*.test.mjs
```

`pixels.json`/SVG/manifest/world-art.json은 그림 생성 결과다. worlds.json은 별도 단어 배정 생성기의 결과다. 그림 수정은 `postal_pixel_recipes.py`, 세계 이름·기본색은 WORLD_BIBLE에서 하고 다시 생성한다. 세계 순서·이모지 목록 변경은 생성기가 거부하므로 도안과 의미의 대응을 명시적으로 갱신한다. `--check`는 생성 파일이 바뀌었거나 오래됐으면 실패한다.

단일 HTML은 그림·JSON·스타일·스크립트를 내장하고 네트워크 요청 없이 렌더링된다. 검증 환경의 Chromium은 `file://` 이동을 관리 정책으로 막아 `setContent`로 문서 자체를 확인했다. 실제 Safari의 로컬 파일 열기는 별도이며, 기기 검토에는 위 Mac HTTP 주소를 권장한다.
