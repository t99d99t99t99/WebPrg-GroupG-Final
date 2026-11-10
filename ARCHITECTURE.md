# ARCHITECTURE.md

코드 지도입니다. 폴더 단위의 책임, 데이터 구조, 호출 관계만 적습니다. 함수 목록은 적지 않습니다.
코드를 바꾸면 [AGENTS.md](AGENTS.md)의 커밋 체크리스트에 따라 이 문서도 같은 커밋에서 고칩니다.

## 구조

| 경로 | 책임 |
|---|---|
| `BUILDING_FAMILIES.md` | 사용 중인 5개 건물 계열, 성장 단계별 에셋, 통합·미사용 목록, 이미지·마스크 파일명 규칙 |
| `manifest.json` | 확장 설정(Manifest V3). 새 탭과 팝업을 연결하고 권한(`storage`, `activeTab`)을 선언 |
| `assets/icons/` | 확장 프로그램 아이콘 PNG 4종(16·32px 단독 집, 48·128px 건물 모음)과 `source/`의 수정 가능한 SVG 원본. `manifest.json`에서 크기별로 연결하며 새 탭 파비콘은 16px 아이콘을 사용 |
| `db/` | 저장소 계층. `chrome.storage.local`을 직접 다루는 유일한 곳 |
| `popup/` | 툴바 아이콘을 누르면 뜨는 팝업. 현재 탭을 카테고리에 저장 |
| `homepage/` | 새 탭 지도. 카테고리별 자동 도시 배치, 설명 카드, 사이트 방문, 링크 복사 |
| `homepage/layout.js` | 도시 배치 계산(순수 함수). 그리드 위 구역·건물 칸 결정, 구역 둘레 도로 타일, 아이소메트릭 좌표 변환 |
| `homepage/building-rules.js` | 5개 계열의 3단계 에셋 목록, 북마크 ID 기반 계열·a/b·형태 선택, 7일 미방문 파손 판정 |
| `homepage/building-appearance.js` | 그림자를 제외한 호버 윤곽, 건물별 사전 제작 벽면 마스크 연결 |
| `homepage/category-colors.js` | 카테고리 기본 색 배정, 벽면 명도와 잔디 채도·명도 보정 |
| `db/storage.js` | Chrome 저장소 및 웹 미리보기 어댑터, 저장 변경 알림, 공통 쓰기 잠금 |
| `shared/` | 홈페이지 이름·URL 검증, 키보드로 조작할 수 있는 카테고리 선택 목록 |
| `homepage/bookmark-preview.js` | 호버 시 URL의 sandbox iframe 미리보기(저장 이미지가 있으면 우선 표시). 카드가 닫히면 iframe과 크기 관찰 해제 |
| `homepage/google-account.js` | 계정 표시 전용 어댑터. 전달받은 이름·HTTPS 사진 URL을 표시하고 사진 부재·실패 시 기본 아바타로 복귀. 인증·권한·저장소 접근 없음 |
| `homepage/category-manager.js` | 카테고리 생성·이름 수정·순서 이동·삭제 확인 |
| `debug/` | 개발자용 정적 디버그 도구 모음. 앱 저장소나 Chrome API를 사용하지 않음 |
| `debug/index.html` | 디버그 도구 진입 페이지 |
| `debug/debug.css` | 디버그 도구 목록과 건물 색상 테스트의 공통 레이아웃·테마 스타일 |
| `debug/building-color-test/` | 건물 색상·잔디 미리보기와 정적 마스크 PNG를 픽셀 단위로 편집·저장하는 도구 |
| `debug/ui-preview/` | daisyUI 부품 모음과 Tailwind CSS 4·CLI 4·daisyUI 5 스타일 빌드 공간. 미리보기용 생성 CSS와 빌드 설정·잠금 파일·설명 포함 |
| `debug/ui-preview/src/` | `input.css`는 미리보기 빌드 진입점, `app.css`는 서비스 빌드 진입점, `daisyui.css`는 기본 플러그인 설정, `theme.css`는 Export 테마, `additional.css`는 미리보기 개별 스타일 |
| `debug/ui-preview/preview.html` | 고정 샘플 컴포넌트와 상태 확인. 저장소에 포함된 `preview.generated.css`를 로드하므로 열 때 별도 빌드가 필요 없음 |
| `demo/seed-data.js` | 화면 로직과 분리된 시연용 카테고리 4개·북마크 8개 |
| `style.css` | 두 페이지가 공유하는 디자인 토큰(CSS 변수)과 기본 스타일 |
| `daisyui.generated.css` | `homepage/`와 `popup/`이 사용하는 daisyUI 정적 번들. `debug/ui-preview/src/app.css`에서 자동 생성하며 직접 수정하지 않음 |
| `assets/` | 아이콘과 건물 이미지. `assets/Isometric City/`는 지도에 쓰는 도로·바닥 타일과 건물. `wall-mask-buildings/`는 건물 에셋별 벽면 마스크. 출처는 README.md |
| `biome.json` | 포맷·린트 설정 |
| `.github/workflows/biome.yml` | PR과 `main` push 때 Biome 검사 |

## 진입점

| 화면 | manifest 항목 | 불러오는 순서 |
|---|---|---|
| 새 탭 | `chrome_url_overrides.newtab` | `homepage/homepage.html` → `daisyui.generated.css`, `style.css`, `homepage.css`, `homepage.js`(module) |
| 팝업 | `action.default_popup` | `popup/popup.html` → `daisyui.generated.css`, `style.css`, `popup.css`, `popup.js`(module) |

## 호출 관계

`debug/ui-preview/src/input.css`는 기본 플러그인 설정·테마·추가 스타일 CSS를 불러오고 UI 부품 모음, 디버그 목록과 건물 색상 테스트 HTML의 클래스를 탐색해 `debug/ui-preview/preview.generated.css`를 생성합니다. 세 디버그 화면은 이 CSS의 `livingtaco` 테마를 공유합니다. 생성된 CSS는 저장소에 포함되므로 디버그 도구를 열 때 npm 설치가 필요하지 않습니다. `debug/ui-preview/src/app.css`는 같은 플러그인과 테마를 불러오고 `homepage/`와 `popup/`의 클래스를 탐색해 루트의 `daisyui.generated.css`를 생성합니다. 서비스도 이 정적 CSS를 런타임 빌드 없이 로드합니다.

```
homepage/homepage.js ──> homepage/layout.js (planCity, planRoads)
homepage/homepage.js ──> homepage/category-colors.js
homepage/homepage.js ──> homepage/building-rules.js / homepage/building-appearance.js
homepage/homepage.js ─┐
                      ├─> db/db.js ──> db/bookmark.js / db/category.js ──> db/storage.js
popup/popup.js ───────┘          └─> demo/seed-data.js                       ├─> chrome.storage.local
                                                                           └─> localStorage (웹 미리보기)
popup/popup.js ──> chrome.tabs.query (현재 탭 제목·URL)
popup/popup.js ──> shared/category-select.js / shared/validation.js
homepage/category-manager.js ──> db/db.js
homepage/homepage.js ──> shared/
debug/building-color-test/building-color-test.js ──> assets/Isometric City/Buildings/ 및 벽면 마스크 이미지
debug/building-color-test/building-color-test.js ──> homepage/category-colors.js (벽면 명도 보정)
debug/building-color-test/building-color-test.js ──> debug/building-color-test/mask-editor.js (마스크 편집)
debug/building-color-test/building-color-test.js ──> debug/building-color-test/mask-archive.js (마스크 ZIP 다운로드)
```

`debug/building-color-test/building-color-test.js`는 사용 중인 건물 64개와 공사 에셋 2개의 파일명을 정적으로 나열하고 카드를 만들어 색상을 미리 봅니다. 통합·폐지된 주택 32개는 표시하지 않습니다. 입력 색상은 페이지 안에서만 적용하며 데이터베이스에 저장하지 않습니다.

`mask-editor.js`는 선택한 정적 PNG를 읽어 픽셀과 불투명도를 편집하고 변경된 마스크를 카드에 미리 보여 줍니다. 원본 보기와 선택 픽셀의 불투명도 복사, 확대·축소를 버튼과 단축키로 제공합니다. 변경된 PNG는 디버그 페이지의 `sessionStorage`에 임시 보관해 같은 탭의 새로고침 후에도 복원하며, 탭 세션이 끝나면 사라집니다. 개별 PNG나 변경된 마스크·전체 마스크 ZIP을 다운로드하고 파일을 직접 교체해야 실제 에셋에 반영됩니다. 앱 데이터 저장 키와 Chrome 저장소는 사용하지 않습니다.

- `db/db.js`가 저장 키와 `bookmarks`, `categories` 싱글턴, 초기화 Promise인 `ready`, 변경 알림 `subscribe`를 제공합니다.
- 팝업은 `Bookmark`, `Category` 클래스와 `add` API로 현재 페이지를 저장합니다. 새 카테고리 이름은 `shared/validation.js`로 검사하고, 카테고리 목록은 `shared/category-select.js`를 사용합니다. 북마크 이름은 20자, 메모는 50자까지 저장하며 메모는 기존 `memo` 필드에 기록합니다. 홈페이지 폼도 같은 공유 모듈을 사용합니다.
- 상세 카드의 메모 입력은 `BookmarkDB.edit`, 북마크 수정도 같은 메서드를 사용합니다. 수정 창은 팝업에서 저장한 제목·주소가 홈페이지 규칙과 달라도 저장할 수 있도록, 바뀐 이름·URL만 검사해서 보냅니다. 북마크 삭제는 상세 카드의 삭제 버튼에서 확인 창을 거쳐 `BookmarkDB.remove`를 사용합니다. 카테고리 삭제는 `deleteCategory`가 카테고리와 포함된 북마크를 함께 삭제합니다. 순서는 카테고리 배열 순서로 저장합니다.
- DB는 초기화가 끝난 뒤 저장소를 읽습니다. 조회 시 최신 데이터를 다시 읽어 다른 탭의 저장을 반영합니다.
- 두 저장 키가 모두 없는 최초 환경에서만 시연 데이터를 넣습니다. 기존 배열은 빈 배열이어도 덮어쓰지 않습니다. Web Locks로 여러 탭의 초기화를 직렬화합니다.
- 지도는 저장 변경 알림, 화면 재진입(다른 탭에서 돌아옴), 새 탭 로드 시 데이터를 갱신합니다. 메모·NEW·미리보기 필드만 바뀐 저장은 다시 그리지 않습니다. 기존 팝업과 같은 저장소와 객체 형식을 사용합니다.
- 새 탭은 `updateCity` 안에서 최신 배열을 읽고 `planCity`로 배치를 계산합니다. 바뀐 위치·기본 색을 한 번에 저장합니다. 모든 데이터 변경은 공통 Web Locks(`webprg-bookmarkmap-data`)를 사용하므로 팝업 저장·메모·색상·도시 배치가 서로 덮어쓰지 않습니다. Web Locks가 없는 환경은 같은 페이지의 Promise 큐로 순차 처리합니다.
- 새 탭은 색이 없는 카테고리 색을 `category-colors.js` 규칙으로 정하고 `db.js`에서 저장합니다. 카테고리 색상 편집은 입력 즉시 목록의 색상 표시·구역 강조 영역·건물 벽·잔디 색에 반영되고 `CategoryDB.edit`로 저장합니다.
- 도시 배치 규칙 (`homepage/layout.js`):
  - 그리드 한 칸에 건물 하나. 카테고리 구역은 2×2 → 2×3 → 3×3 → 3×4 … 순서로 북마크 수에 맞춰 커지고 줄어듭니다.
  - 모든 구역 둘레에 1칸 도로가 있고, 이웃 구역과 도로를 공유합니다(구역 사이 최소 1칸).
  - 새 카테고리는 중앙에서 가장 가까운 빈 자리에 놓입니다. 구역은 바깥쪽으로 커집니다.
  - 커질 자리가 없으면 구역 하나만 옮깁니다(자기 자신 또는 막고 있는 이웃 하나 중 덜 움직이는 쪽). 구역이 옮겨지면 건물도 같이 옮겨집니다.
  - 추가할 때 기존 건물 칸은 바뀌지 않습니다. 구역이 줄어들 때만 건물을 다시 채우고, 구역들을 중앙 쪽으로 당깁니다.
  - "분류 없음" 구역은 저장하지 않고 매번 마지막에 계산합니다.
  - 도시 전체가 지도 영역에 들어가도록 확대·축소합니다.
- Chrome 확장프로그램에서는 `chrome.storage.local`, 웹 미리보기에서는 별도의 `localStorage`를 사용합니다.

## 데이터 구조

`chrome.storage.local`에 키 두 개로 배열을 저장합니다.

| 키 | 값 |
|---|---|
| `webprg-bookmarkmap-bookmarks` | 북마크 객체 배열 |
| `webprg-bookmarkmap-categories` | 카테고리 객체 배열 |

**북마크:** `{ id, url, name, category, savedAt, clickCount, cell, lastVisitedAt?, memo?, isNew?, preview? }`
- `id`: `crypto.randomUUID()` 문자열
- `category`: 카테고리의 `id`. 일치하는 카테고리가 없으면 새 탭에서 "분류 없음"에 표시됩니다
- `savedAt`: 저장 시각(`Date.now()`)
- `clickCount`: 지도에서 사이트를 방문한 횟수(일반 클릭, Ctrl/⌘ 클릭, 휠 클릭). 기존 북마크는 클릭 전까지 필드가 없으며, 클릭하면 1부터 저장됩니다
- `lastVisitedAt`: 지도에서 마지막으로 방문한 시각(`Date.now()`). `clickCount`를 올릴 때 함께 저장합니다. 방문한 적 없는 북마크에는 없으며, 이때 파손 판정은 `savedAt`을 기준으로 합니다
- `cell`: 지도 그리드에서 건물이 놓인 칸 `{ x, y }`(절대 좌표). 새 탭이 처음 그릴 때 채웁니다. 카테고리를 바꾸면(`edit`) 지워지고 새로 배정됩니다

- `memo`: 최대 50자 메모. 기존 데이터에 없으면 빈 메모로 표시합니다.
- `isNew`: 새로 저장한 건물의 NEW 표시. 건물을 호버·포커스하면 false로 저장합니다. 새 탭을 떠날 때(다른 탭으로 전환), 그 화면을 보기 시작한 시각보다 먼저 저장된 북마크도 false로 저장합니다. 따라서 새로 연 탭에서는 NEW가 보이고, 한 번 본 뒤 다시 들어오면 사라집니다. 기존 데이터에는 표시하지 않습니다.
- `preview`: 선택 사항인 로컬 JPEG data URL. 값이 제공되면 이미지로 표시하고, 없거나 이미지 로딩이 실패하면 저장된 URL을 iframe으로 연결합니다. 홈페이지에서는 캡처하거나 외부 서버로 전송하지 않습니다. 현재 팝업은 이 필드를 수집하지 않습니다.

**카테고리:** `{ id, name, createdAt, area, color, customColor?, buildingFamily? }`

- `area`: 지도 그리드에서 구역이 차지하는 칸 `{ x, y, w, h }`. 새 탭이 처음 그릴 때 채웁니다
- `color`: 카테고리 목록의 색상 표시, 구역 강조 영역, 구역 안 집·잔디 색에 적용하는 6자리 hex 색상. 비어 있는 기존 카테고리는 지도에서 자동 지정해 저장합니다.

- `customColor`: 이전 화면의 사용자 색상 지정 여부. 저장 값은 보존하지만 홈페이지 건물 색상에는 사용하지 않습니다.
- `buildingFamily`: 이전 버전이 저장한 선택적 계열 ID. 현재 화면의 계열 선택에는 사용하지 않으며, 기존 필드는 데이터 호환을 위해 보존합니다.

키 이름이나 필드를 바꾸면 이미 저장된 데이터를 읽지 못하게 됩니다. 바꾸기 전에 팀에 묻습니다.

## 무언가를 추가하려면

| 하려는 일 | 고칠 곳 |
|---|---|
| 북마크·카테고리에 필드 추가 | `db/bookmark.js` 또는 `db/category.js`의 `add`/`edit`(허용 필드 목록), 그 필드를 쓰는 페이지 |
| 새로 저장할 데이터 종류 | `db/`에 새 클래스, `db/db.js`에 키와 싱글턴 |
| 두 페이지 공통 색·크기 | `style.css` 변수 |
| 새 Chrome API 사용 | `manifest.json` `permissions` (먼저 팀에 묻기) |

- 건물 규칙은 `building-rules.js`에 모읍니다. 정상 에셋 32종을 5개 계열의 3단계로 사용합니다. 착색 결과가 겹치는 주택은 파란 주택으로 통합하고 정원 주택은 소형 노랑·중형 흰색·대형 초록만 남기며, 갈색 벽돌 주택 계열은 사용하지 않습니다. 통합·미사용 목록은 `BUILDING_FAMILIES.md`에 명시합니다. 방문 0~4/5~14/15회 이상에 small/medium/tall 에셋을 선택합니다. 에셋은 원본 픽셀 크기로 그립니다(대부분 128px 폭, 일부 129~132px). 각 북마크 ID 해시로 계열, a/b 방향, 단계별 세부 형태를 선택하므로 한 카테고리 안에서도 계열이 섞입니다. 마지막 방문(없으면 저장 시각)부터 7일이 지나면 같은 형태의 `_damaged` 에셋으로 바뀌고, 지도에서 방문하면 바로 원래 건물로 돌아옵니다. 시간 경과는 새 탭을 열거나 화면에 다시 들어올 때 반영됩니다. 공사 중 에셋은 사용하지 않습니다.
- `building-appearance.js`는 알파 128 미만의 그림자·여백을 제외한 호버 윤곽을 이미지 URL별 Promise로 캐시합니다. 벽면 마스크는 모든 건물에 같은 `assets/wall-mask-buildings/wall-mask-<건물 이미지 파일명>` 규칙으로 정적 PNG를 연결하며, 디버그 페이지도 같은 경로를 사용합니다. 계열별 에셋 목록은 `BUILDING_FAMILIES.md`에 정리합니다. `customColor` 값은 보존하지만 건물 렌더링에는 사용하지 않습니다.
- 집과 잔디는 카테고리 `color`로 착색합니다. 집은 정적 벽면 마스크에 색상층과 명도 보정층을 적용합니다. 상점 지붕 테두리·문틀·창틀·벽 접합부는 포함하고 유리·문짝·벽돌 줄눈은 제외하며, 파손 얼룩과 모서리는 벽면에 포함합니다. 검정 보정층의 불투명도는 0.6 이하로 제한해 원본 명암 차이를 최소 40% 남깁니다. 홈페이지와 디버그 페이지가 같은 `wallColorAdjustments`를 사용합니다. 잔디는 `category-colors.js`에서 채도·명도를 보정한 뒤 색상층과 명도 보정층을 적용합니다. 구역 강조는 카테고리 색으로 채운 영역으로 표시합니다.

## Google 계정 표시 연결

확장프로그램 담당자는 홈페이지에서 `google-account.js`의 `setGoogleAccount({ displayName, photoUrl })`를 호출해 인증이 끝난 계정을 표시할 수 있습니다. 로그아웃은 `setGoogleAccount(null)`입니다. 현재 홈페이지는 기본 아바타로 시작하며, 이 모듈 자체는 로그인·계정 조회·토큰 저장을 수행하지 않습니다. 사진이 없으면 이름의 첫 글자(이름도 없으면 기본 사람 아이콘), 이미지 로드 실패 시에도 같은 대체 표시를 사용합니다.

페이지 미리보기는 홈페이지에서만 처리합니다. 지도 위를 지나가기만 할 때 사이트를 불러오지 않도록, 건물 위에 0.5초 머문 뒤 iframe을 만듭니다. iframe은 1024×576 페이지를 카드 너비에 맞춰 축소하며 `sandbox="allow-scripts"`로 부모 페이지 접근·새 창·폼 제출을 허용하지 않습니다. 원본 새 탭 링크를 별도로 제공합니다. 대상 사이트의 X-Frame-Options/CSP 정책으로 차단될 수 있으며, 교차 출처 iframe의 성공 여부를 신뢰성 있게 판별하지 않으므로 항상 제한 가능 안내를 표시합니다. 차단 정책을 우회하거나 확장 권한을 추가하지 않습니다.

- 잔디는 모든 카테고리에서 `tile_ground_grass.png` 한 장을 쓰고, 카테고리 색으로 착색합니다. 카테고리 강조는 구역을 채운 영역으로 표시합니다.
