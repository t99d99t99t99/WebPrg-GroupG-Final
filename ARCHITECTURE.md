# ARCHITECTURE.md

코드 지도입니다. 폴더 단위의 책임, 데이터 구조, 호출 관계만 적습니다. 함수 목록은 적지 않습니다.
코드를 바꾸면 [AGENTS.md](AGENTS.md)의 커밋 체크리스트에 따라 이 문서도 같은 커밋에서 고칩니다.

## 구조

| 경로 | 책임 |
|---|---|
| `manifest.json` | 확장 설정(Manifest V3). 새 탭과 팝업을 연결하고 권한(`storage`, `activeTab`)을 선언 |
| `db/` | 저장소 계층. `chrome.storage.local`을 직접 다루는 유일한 곳 |
| `popup/` | 툴바 아이콘을 누르면 뜨는 팝업. 현재 탭을 카테고리에 저장 |
| `homepage/` | 새 탭 지도. 카테고리별 자동 도시 배치, 설명 카드, 사이트 방문, 링크 복사 |
| `homepage/layout.js` | 도시 배치 계산(순수 함수). 그리드 위 구역·건물 칸 결정, 구역 둘레 도로 타일, 아이소메트릭 좌표 변환 |
| `homepage/category-colors.js` | 카테고리 기본 색 배정, 집 벽면 마스크와 명도 보정 |
| `db/storage.js` | Chrome 저장소 및 웹 미리보기 어댑터, 저장 변경 알림 |
| `demo/seed-data.js` | 화면 로직과 분리된 시연용 카테고리 4개·북마크 8개 |
| `style.css` | 두 페이지가 공유하는 디자인 토큰(CSS 변수)과 기본 스타일 |
| `assets/` | 아이콘과 건물 이미지. `assets/Isometric City/`는 지도에 쓰는 도로·바닥 타일과 건물. `wall-mask-house-*.png`는 집 크기별 벽면 색상 마스크. `assets/figma/`는 Figma 원본 구역 SVG. 출처는 README.md |
| `biome.json` | 포맷·린트 설정 |
| `.github/workflows/biome.yml` | PR과 `main` push 때 Biome 검사 |

## 진입점

| 화면 | manifest 항목 | 불러오는 순서 |
|---|---|---|
| 새 탭 | `chrome_url_overrides.newtab` | `homepage/homepage.html` → `style.css`, `homepage.css`, `homepage.js`(module) |
| 팝업 | `action.default_popup` | `popup/popup.html` → `style.css`, `popup.css`, `popup.js`(module) |

## 호출 관계

```
homepage/homepage.js ──> homepage/layout.js (planCity, planRoads)
homepage/homepage.js ──> homepage/category-colors.js
homepage/homepage.js ─┐
                      ├─> db/db.js ──> db/bookmark.js / db/category.js ──> db/storage.js
popup/popup.js ───────┘          └─> demo/seed-data.js                       ├─> chrome.storage.local
                                                                           └─> localStorage (웹 미리보기)
popup/popup.js ──> chrome.tabs.query (현재 탭 제목·URL)
```

- `db/db.js`가 저장 키와 `bookmarks`, `categories` 싱글턴, 초기화 Promise인 `ready`, 변경 알림 `subscribe`를 제공합니다.
- `popup.js`는 새 객체를 만들 때만 `Bookmark`, `Category` 클래스를 직접 import합니다. 기존 팝업은 그대로 사용합니다.
- DB는 초기화가 끝난 뒤 저장소를 읽습니다. 조회 시 최신 데이터를 다시 읽어 다른 탭의 저장을 반영합니다.
- 두 저장 키가 모두 없는 최초 환경에서만 시연 데이터를 넣습니다. 기존 배열은 빈 배열이어도 덮어쓰지 않습니다. Web Locks로 여러 탭의 초기화를 직렬화합니다.
- 지도는 저장 변경 알림, 탭 포커스 복귀, 새 탭 로드 시 데이터를 갱신합니다. 기존 팝업과 같은 저장소와 객체 형식을 사용합니다.
- 새 탭은 그릴 때마다 `planCity`로 배치를 계산하고, 바뀐 위치만 `db.js`의 `saveLayout`으로 한 번에 저장합니다. Web Locks(`webprg-bookmarkmap-layout`)로 여러 탭의 계산을 직렬화합니다. 같은 데이터면 다시 계산해도 바뀌는 것이 없습니다.
- 새 탭은 색이 없는 카테고리 색을 `category-colors.js` 규칙으로 정하고 `db.js`에서 저장합니다. 카테고리 색상 편집은 입력 즉시 지도에 반영되고 `CategoryDB.edit`로 저장하며, 집의 벽면에만 크기별 마스크를 적용합니다.
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

**북마크:** `{ id, url, name, category, savedAt, clickCount, cell }`
- `id`: `crypto.randomUUID()` 문자열
- `category`: 카테고리의 `id`. 일치하는 카테고리가 없으면 새 탭에서 "분류 없음"에 표시됩니다
- `savedAt`: 저장 시각(`Date.now()`)
- `clickCount`: 지도에서 사이트를 방문한 횟수. 기존 북마크는 클릭 전까지 필드가 없으며, 클릭하면 1부터 저장됩니다
- `cell`: 지도 그리드에서 건물이 놓인 칸 `{ x, y }`(절대 좌표). 새 탭이 처음 그릴 때 채웁니다. 카테고리를 바꾸면(`edit`) 지워지고 새로 배정됩니다

**카테고리:** `{ id, name, createdAt, area, color }`

- `area`: 지도 그리드에서 구역이 차지하는 칸 `{ x, y, w, h }`. 새 탭이 처음 그릴 때 채웁니다
- `color`: 카테고리 구역과 집 벽면에 적용하는 6자리 hex 색상. 비어 있는 기존 카테고리는 지도에서 자동 지정해 저장합니다.

키 이름이나 필드를 바꾸면 이미 저장된 데이터를 읽지 못하게 됩니다. 바꾸기 전에 팀에 묻습니다.

## 무언가를 추가하려면

| 하려는 일 | 고칠 곳 |
|---|---|
| 북마크·카테고리에 필드 추가 | `db/bookmark.js` 또는 `db/category.js`의 `add`/`edit`(허용 필드 목록), 그 필드를 쓰는 페이지 |
| 새로 저장할 데이터 종류 | `db/`에 새 클래스, `db/db.js`에 키와 싱글턴 |
| 두 페이지 공통 색·크기 | `style.css` 변수 |
| 새 Chrome API 사용 | `manifest.json` `permissions` (먼저 팀에 묻기) |
