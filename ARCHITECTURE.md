# ARCHITECTURE.md

코드 지도입니다. 폴더 단위의 책임, 데이터 구조, 호출 관계만 적습니다. 함수 목록은 적지 않습니다.
코드를 바꾸면 [AGENTS.md](AGENTS.md)의 커밋 체크리스트에 따라 이 문서도 같은 커밋에서 고칩니다.

## 구조

| 경로 | 책임 |
|---|---|
| `manifest.json` | 확장 설정(Manifest V3). 새 탭과 팝업을 연결하고 권한(`storage`, `activeTab`)을 선언 |
| `db/` | 저장소 계층. `chrome.storage.local`을 직접 다루는 유일한 곳 |
| `popup/` | 툴바 아이콘을 누르면 뜨는 팝업. 현재 탭을 카테고리에 저장 |
| `homepage/` | 새 탭 지도. 카테고리별 자동 건물 배치, 설명 카드, 사이트 방문, 링크 복사 |
| `homepage/layout.js` | 구역별 에셋과 자동 배치 슬롯. 저장된 배열 순서를 사용해 추가 시 기존 좌표 유지 |
| `db/storage.js` | Chrome 저장소 및 웹 미리보기 어댑터, 저장 변경 알림 |
| `demo/seed-data.js` | 화면 로직과 분리된 시연용 카테고리 4개·북마크 8개 |
| `style.css` | 두 페이지가 공유하는 디자인 토큰(CSS 변수)과 기본 스타일 |
| `assets/` | 아이콘과 건물 이미지. `assets/figma/`는 Figma 원본 구역 SVG. 출처는 README.md |
| `biome.json` | 포맷·린트 설정 |
| `.github/workflows/biome.yml` | PR과 `main` push 때 Biome 검사 |

## 진입점

| 화면 | manifest 항목 | 불러오는 순서 |
|---|---|---|
| 새 탭 | `chrome_url_overrides.newtab` | `homepage/homepage.html` → `style.css`, `homepage.css`, `homepage.js`(module) |
| 팝업 | `action.default_popup` | `popup/popup.html` → `style.css`, `popup.css`, `popup.js`(module) |

## 호출 관계

```
homepage/homepage.js ──> homepage/layout.js
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
- 건물 위치는 카테고리 및 카테고리 내부 북마크의 저장 배열 순서로 결정합니다. 새 북마크 추가 시 기존 위치가 유지되며 별도 위치 필드는 추가하지 않습니다.
- Chrome 확장프로그램에서는 `chrome.storage.local`, 웹 미리보기에서는 별도의 `localStorage`를 사용합니다.

## 데이터 구조

`chrome.storage.local`에 키 두 개로 배열을 저장합니다.

| 키 | 값 |
|---|---|
| `webprg-bookmarkmap-bookmarks` | 북마크 객체 배열 |
| `webprg-bookmarkmap-categories` | 카테고리 객체 배열 |

**북마크:** `{ id, url, name, category, savedAt, clickCount }`
- `id`: `crypto.randomUUID()` 문자열
- `category`: 카테고리의 `id`. 일치하는 카테고리가 없으면 새 탭에서 "분류 없음"에 표시됩니다
- `savedAt`: 저장 시각(`Date.now()`)
- `clickCount`: 지도에서 사이트를 방문한 횟수. 기존 북마크는 클릭 전까지 필드가 없으며, 클릭하면 1부터 저장됩니다

**카테고리:** `{ id, name, createdAt }`

키 이름이나 필드를 바꾸면 이미 저장된 데이터를 읽지 못하게 됩니다. 바꾸기 전에 팀에 묻습니다.

## 무언가를 추가하려면

| 하려는 일 | 고칠 곳 |
|---|---|
| 북마크·카테고리에 필드 추가 | `db/bookmark.js` 또는 `db/category.js`의 `add`/`edit`(허용 필드 목록), 그 필드를 쓰는 페이지 |
| 새로 저장할 데이터 종류 | `db/`에 새 클래스, `db/db.js`에 키와 싱글턴 |
| 두 페이지 공통 색·크기 | `style.css` 변수 |
| 새 Chrome API 사용 | `manifest.json` `permissions` (먼저 팀에 묻기) |
