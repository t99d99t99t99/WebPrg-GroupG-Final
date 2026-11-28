# ARCHITECTURE.md

코드 지도입니다. 폴더 단위의 책임, 데이터 구조, 호출 관계만 적습니다. 함수 목록은 적지 않습니다.
코드를 바꾸면 [AGENTS.md](AGENTS.md)의 커밋 체크리스트에 따라 이 문서도 같은 커밋에서 고칩니다.

## 구조

건물 팝업의 간격은 `building-appearance.js`가 계산한 그림자 제외 건물 테두리(알파 128 이상)와 호버 확대·상승을 기준으로 좌우 동일하게 맞춥니다. 호버 윤곽과 해당 경계 사각형은 에셋별로 캐시합니다. 팝업 이동 경로와 겹치는 중간 건물은 마우스 반응을 잠시 끄고, 팝업을 닫으면 복원합니다. 개별 건물 호버에서는 지도 전체를 덮는 막(`#focus-veil`, z-index 1300) 하나로 나머지를 흐리게 하고, 호버한 건물만 빨간 외곽선과 함께 막 위(1999)로 올립니다. 요소마다 투명도·흐림을 걸면 북마크가 많을 때 호버가 크게 끊겨서 이렇게 합니다.

카테고리 선택만 된 상태(`category-focus`)에서는 Figma USER-MAIN-CATEGORY-007에 따라 흐림 막과 확대·상승을 사용하지 않습니다. 선택 건물·아이콘은 100%, 다른 건물·아이콘은 40%, 잔디·도로·장식·교통은 60%, 황무지 배경은 100% 불투명도로 표시합니다. 사이드바는 선택한 카테고리 색의 15% 배경과 45% 펼침 선, 일반 굵기의 글씨를 사용합니다. 해제하면 원래 표시로 복원합니다.

검색은 제목 완전 일치 → 제목 시작 → 단어 시작 → 제목 중간 → 공백을 제외한 제목 일치 → 초성 → 도메인 일치 순으로 표시합니다. 검색어의 모든 단어가 제목 또는 도메인에 포함되어야 하며 단어 순서는 무관합니다. 특수기호는 보존합니다. `bookmark-search.js`가 변경된 이름·URL만 다시 색인하고 데이터 추가·삭제·변경 시 검색 캐시를 비웁니다. 카테고리 이동·아이콘 변경은 기존 색인의 표시 데이터를 갱신합니다. `category-manager.js`는 입력을 프레임 단위로 모으고 IME 조합 중 갱신·Esc 초기화를 보류합니다. 결과는 버튼으로 50개씩 추가하거나 방향키로 다음 묶음을 불러옵니다. 검색 중 불필요한 숨은 카테고리 목록 재생성을 건너뛰며, 검색어가 바뀌면 이전 상세 카드를 닫습니다. 강조 표시는 원문 위치를 보존한 텍스트·mark 노드로 만들고 HTML을 해석하지 않습니다.

카테고리 순서 이동은 `homepage/category-reorder.js`가 Pointer Events로 처리합니다. 행을 끌면 다른 행이 빈 슬롯을 만들고, 놓으면 320ms 정착 애니메이션 후 `category-manager.js`를 통해 기존 `CategoryDB.reorder`로 저장합니다. 일반 카테고리는 고정하며 드래그 중 들어온 목록 갱신은 정착 후 반영합니다.

건물 상세가 열리면 사이드바의 해당 카테고리명과 행 배경·테두리를 강조하고, 닫히면 기존 선택 상태를 유지합니다. 카테고리를 선택한 뒤 카테고리 행이나 해당 건물·상세 카드 외 영역을 클릭하면 선택을 해제합니다.

| 경로 | 책임 |
|---|---|
| `BUILDING_FAMILIES.md` | 사용 중인 5개 건물 계열, 성장 단계별 에셋, 통합·미사용 목록, 이미지·마스크 파일명 규칙 |
| `manifest.json` | 확장 설정(Manifest V3). 새 탭·팝업·모듈 서비스 워커를 연결하고 권한(`storage`, `activeTab`, `bookmarks`, `favicon`, `tabs`)을 선언 |
| `background.js` | 저장된 페이지와 일치하는 탭의 파비콘 변경·활성화를 감지해 북마크 아이콘 URL을 갱신 |
| `assets/icons/` | 확장 프로그램 아이콘 PNG 4종(16·32px 단독 집, 48·128px 건물 모음)과 `source/`의 수정 가능한 SVG 원본. `manifest.json`에서 크기별로 연결하며 새 탭 파비콘은 16px 아이콘을 사용 |
| `db/` | 저장소 계층. `chrome.storage.local`을 직접 다루는 유일한 곳. 기존 북마크의 아이콘 주소 1회 보정도 담당 |
| `popup/` | 툴바 아이콘을 누르면 뜨는 팝업. 현재 탭을 카테고리에 저장 |
| `homepage/` | 새 탭 지도. 카테고리별 자동 도시 배치, 설명 카드, 사이트 방문, 링크 복사, 카테고리 목록 패널(건물명 검색·건물 목록 펼침), Google 서비스 바로가기 패널, 설정 창(크롬 북마크 동기화 포함) |
| `homepage/layout.js` | 도시 배치 계산(순수 함수). 그리드 위 구역·건물 칸·피켓 칸 결정, 구역 둘레 도로 타일(교차로에 붙은 직선 도로는 횡단보도 타일), 아이소메트릭 좌표 변환 |
| `homepage/decorations.js` | 구역 빈칸의 나무·꽃·풀·바위·거리 소품(가로등·쓰레기통·우체통) 장식과 집 앞마당(울타리·우체통) 계산(순수 함수). 픽셀이 고르지 않게 보이지 않도록 원본 크기로만 그림. 카테고리와 구역 안 칸 위치로 고정해 고름 |
| `homepage/traffic.js` | 장식용 도시 움직임. 매 렌더의 도로 칸을 받아 사람(인도로 걷다 가끔 멈춤, 교차로의 옆길은 횡단보도로 건넘, 막다른 길에서는 같은 인도로 돌아섬)과 차(오른쪽 차선, 같은 차선의 앞차와 간격 유지·교차로에서 서로 막히면 한쪽 우선, 교차로 앞 횡단보도에서 가끔 정지, 일정 시간 뒤 다른 차로 교체, 큰 차일수록 드묾)를 1~2개씩 움직이고, 가끔 헬리콥터가 지도를 가로지름. 횡단보도(planRoads의 pelican 타일) 중 칸 위치로 정한 30% 정도에 길 양쪽 인도로 신호등 한 쌍을 세움(서로 길 건너편을 보도록 방향별 그림 선택). 도시 애니메이션 설정이 꺼져 있거나 OS의 움직임 줄이기가 켜져 있으면 사람·차·헬리콥터의 이동과 프레임을 정지하고 반복 프레임 요청도 중단함. 다시 켜면 현재 위치에서 재개함. 건물 상세가 열리면 지도와 함께 흐려짐(헬리콥터도 z-index 1250으로 막 아래). 위치는 매 프레임 `transform`으로만 바꿔 지도 배치를 다시 계산하지 않게 함. 앞뒤 순서는 바닥 위치(x+y)로 건물 칸 중심과 비교하고, `#traffic`을 `#buildings` 뒤에 두며 매 프레임 자식 순서를 바닥 위치순으로 맞춰 z-index가 같을 때도 어긋나지 않게 함. 저장소·포인터 이벤트 없음 |
| `homepage/background.js` | 구역·도로 밖을 채우는 미개발 공터 바닥 타일 계산(순수 함수). 칸 좌표로 정한 흙 변형 타일, 화면 범위를 칸 범위로 바꾸는 역변환 |
| `homepage/background-renderer.js` | 공터 타일 또는 설정한 단색·그라데이션·사진 배경을 화면 해상도 기준 캔버스 하나에 그림(장치 픽셀 1:1, 최대 1,600만 픽셀, 가장자리를 픽셀 격자에 맞춤). 이미지 로딩을 공유하고 뒤늦게 끝난 이전 요청은 버림 |
| `homepage/spatial-index.js` | 건물의 월드 좌표 사각형을 격자로 색인해 팝업 이동 경로 주변 건물만 검색 |
| `homepage/map-camera.js` | 탭 안의 줌·시점 이동. 핀치/휠 확대, 트랙패드 스크롤·가운데 버튼 이동, 포인터 중심 줌과 배율 제한, 프레임 단위 변환. 픽셀 아트가 선명하도록 휠·핀치 줌은 원본 1px당 화면 픽셀 수가 …1/3, 1/2, 1, 1.5, 2, 2.5, 3…인 단계로만 바꾸고(입력을 모아 한 단계씩, 0.16초 애니메이션으로 이어 줌, 정수 단계가 가장 선명), 위치는 화면 픽셀 격자에 맞춥니다. 처음 맞춤도 도시가 들어가는 가장 큰 단계(예: 1.5)를 씁니다. 축소는 맞춤 단계보다 한 단계 아래까지만 허용하고, 이동은 도시가 화면 너비·높이의 1/4(도시가 그보다 작으면 도시 전체)만큼 화면에 남도록 제한합니다. 저장소 접근 없음 |
| `homepage/building-move.js` | 건물 이동 계산(순수 함수). 놓은 자리의 의미(이동·자리 교환·밀어내기·한 줄 끼워 넣기) 결정, 끼워 넣은 줄 너머 땅 밀기, 이동을 적용한 `planCity` 결과 미리 계산, 배치 지문 |
| `homepage/building-drag.js` | 건물 길게 누르기·끌기·놓기 화면 동작. 반투명 건물과 놓일 칸 표시, 꽉 찬 땅 테두리 게이지와 넓힐 칸, 넓힌 뒤 지도 미리보기, Esc·지도 밖 취소, 끈 뒤 사이트 방문 막기. 안내 문구는 쓰지 않고 표시로만 알립니다 |
| `homepage/picket-drag.js` | 카테고리 이름 피켓(팻말) 끌기·놓기 화면 동작. 같은 땅의 빈칸에만 놓이고, 놓일 칸 표시, 땅 밖·건물 칸·Esc는 취소. 저장은 `saveCategoryPicket`에 맡김 |
| `homepage/building-rules.js` | 5개 계열의 3단계 에셋 목록, 북마크 ID 기반 계열·a/b·형태 선택, 7일 미방문 파손 판정 |
| `homepage/building-appearance.js` | 그림자를 제외한 호버 윤곽, 건물별 사전 제작 벽면 마스크 연결 |
| `homepage/category-colors.js` | 카테고리 기본 색 배정, 벽면 명도와 잔디 채도·명도 보정 |
| `db/storage.js` | Chrome 저장소 및 웹 미리보기 어댑터, 저장 변경 알림, 공통 쓰기 잠금 |
| `db/settings.js` | 지도 설정 저장소(`SettingsDB`). 지도 장식 밀도·도시 애니메이션·새 탭 열기·크롬 북마크 자동 동기화·배경(빈 공간 채우기) 값을 검증·저장하며, 없거나 잘못된 값은 기본값으로 읽음 |
| `homepage/settings-panel.js`, `homepage/settings.css` | 우측 상단 내비게이션의 설정 버튼과, 카테고리 목록 자리에 목록 대신 열리는 설정 창(USER-MAIN-OPTIONS). 설정 즉시 반영·취소(설정 취소·X·설정 버튼 다시 누르기) 시 복원, 장식 밀도와 단계별 설명, 동작 스위치와 설명 말풍선, 배경 네 칸 선택·색상·사진 업로드, 자동 동기화 스위치·지금 동기화 및 초기화 재확인. 열림·닫힘은 `onOpen`·`onClose` 콜백으로 알려 `homepage.js`가 카테고리 목록을 숨기고 되돌림. 빈 공간 채우기 설정을 지도 배경 렌더러에 전달 |
| `homepage/background-image.js` | 업로드 사진 검증 및 자동 압축. 긴 변 2560px·인코딩 결과 1MiB 이내를 목표로 WebP 화질과 해상도를 조절하고, 이미 목표 이내인 사진은 원본을 유지 |
| `shared/` | 홈페이지 이름·URL 검증, 사이트 아이콘 URL 생성, 키보드로 조작할 수 있는 카테고리 선택 목록 |
| `shared/building-designs.js` | 건물 5개 계열의 성장 에셋과 좌우 방향별 기본 디자인 10종. 팝업 선택·DB 검증·지도 렌더링이 공유 |
| `shared/site-icons.js` | Chrome Favicon API 조회 URL 생성, 저장할 아이콘 URL 검증. 지도·호버 카드·카테고리 건물 목록이 함께 쓰는 대표 이모지(`bookmarkEmoji`)와 사이트 아이콘 주소(`bookmarkIconUrl`) 결정 |
| `shared/building-picker.js`, `shared/building-picker.css` | 홈페이지 북마크 수정 창의 건물 디자인 선택 띠(좌우 화살표, 3개씩 표시, 카테고리 색 벽면 미리보기). 사용자 선택 변경은 `onChange`로 알리며 초기값 설정은 알리지 않음. 팝업은 아직 같은 모양의 자체 코드를 씀 |
| `shared/color-picker.js`, `shared/color-picker.css` | 홈페이지와 팝업이 함께 쓰는 컬러피커 UI·스타일. 채도/밝기 드래그·방향키, 색조, HEX, Escape·바깥 클릭 닫기. 저장은 호출 화면에서 처리 |
| `shared/emoji-picker.js`, `shared/emoji-picker.css` | 저장 팝업·홈페이지 북마크 수정 창의 대표 아이콘 선택창. 한국어·영어 검색, 최근 사용(선택기 인스턴스 동안 유지)과 사람·자연·음식·활동·여행·사물·기호·깃발 분류, 키보드 이동, 사이트 아이콘 복귀. 저장은 호출 화면에서 처리하며 `position` 콜백으로 배율이 적용된 대화상자 안의 위치를 계산할 수 있음 |
| `shared/emoji-data.js`, `shared/emoji-LICENSE.txt` | Unicode Emoji 17.0의 기본 피부색 이모지와 CLDR 48 한국어 이름·영어 검색어, 허용 이모지 검증 및 데이터 라이선스 |
| `homepage/google-account.js` | 계정 표시 전용 어댑터. 전달받은 이름·HTTPS 사진 URL을 표시하고 사진 부재·실패 시 기본 아바타로 복귀. 인증·권한·저장소 접근 없음 |
| `homepage/google-launcher.js` | Google Service 런처 편집(USER-MAIN-CATEGORY-008). `homepage.html`에 있는 앱 링크 27개를 런처 9칸과 **추가 앱** 목록 사이에서 옮김. 추가 앱을 런처 칸에 끌어다 놓으면 그 칸에 있던 앱과 서로 바꿈(나머지 앱은 제자리). 불러오기·저장은 콜백(`settings`의 `googleLauncher`)으로 받고 저장소에 직접 접근하지 않음 |
| `homepage/category-manager.js` | 카테고리 목록 패널. 건물명·도메인 검색(다중 단어·초성·공백/문자 정규화, 일치 강조, 50개씩 추가 표시, 키보드 조작), 선택한 카테고리 아래 건물 목록(호버·클릭은 `homepage.js`의 `hoverBuilding`·`selectBuilding`으로 지도 강조·상세 카드 고정), 생성·이름 수정·드래그 순서 이동·삭제 확인, 색상 칩이나 연필로 이름 수정 칸과 컬러피커를 함께 열기(카테고리 일반의 색상 칩은 컬러피커만), 수정 중 확인·취소, 휴지통 버튼으로 삭제 창 열기, 카테고리 강조 선택 |
| `homepage/bookmark-search.js` | 홈페이지 검색 전용 순수 모듈. 제목·도메인 색인, NFKC·대소문자·공백 정규화, 한글 초성, 모든 단어 일치 및 제목 우선 순위, 원문 강조 범위, 최근 12개 검색 결과 캐시. 저장소를 수정하지 않음 |
| `homepage/category-reorder.js` | 행의 포인터 드래그·자동 스크롤·정착 애니메이션·취소와 저장 콜백 처리. 다른 행의 카테고리 줄 가운데에 놓으면 병합 콜백 |
| `homepage/building-reorder.js` | 카테고리 아래 건물 목록의 순서 변경(행·드래그 손잡이를 끌기, 손잡이에서 위·아래 방향키)과 다른 카테고리 줄에 놓아 옮기기. 끄는 동안 목록 가장자리에서 자동 스크롤. 저장은 콜백으로 `BookmarkDB.reorder`, 옮기기는 `BookmarkDB.edit`의 `category` |
| `debug/` | 개발자용 정적 디버그 도구 모음. 앱 저장소나 Chrome API를 사용하지 않음 |
| `debug/index.html` | 디버그 도구 진입 페이지 |
| `debug/debug.css` | 디버그 도구 목록과 건물 색상 테스트의 공통 레이아웃·테마 스타일 |
| `debug/building-color-test/` | 건물 색상·잔디 미리보기와 정적 마스크 PNG를 픽셀 단위로 편집·저장하는 도구 |
| `debug/ui-preview/` | daisyUI 부품 모음과 Tailwind CSS 4·CLI 4·daisyUI 5 스타일 빌드 공간. 미리보기용 생성 CSS와 빌드 설정·잠금 파일·설명 포함 |
| `debug/ui-preview/src/` | `input.css`는 미리보기 빌드 진입점, `app.css`는 서비스 빌드 진입점, `daisyui.css`는 기본 플러그인 설정, `theme.css`는 Export 테마, `additional.css`는 미리보기 개별 스타일 |
| `debug/ui-preview/preview.html` | 고정 샘플 컴포넌트와 상태 확인. 저장소에 포함된 `preview.generated.css`를 로드하므로 열 때 별도 빌드가 필요 없음 |
| `demo/seed-data.js` | 화면 로직과 분리된 시연용 카테고리 4개·북마크 8개 |
| `style.css` | 두 페이지가 공유하는 디자인 토큰(CSS 변수)과 기본 스타일 |
| `assets/ui/popup-arrow-left.svg`, `assets/ui/popup-arrow-right.svg` | 건물 선택 화살표 SVG. 표시 크기는 왼쪽 14×15, 오른쪽 14×14이며 출처는 README.md |
| `daisyui.generated.css` | `homepage/`와 `popup/`이 사용하는 daisyUI 정적 번들. `debug/ui-preview/src/app.css`에서 자동 생성하며 직접 수정하지 않음 |
| `assets/` | 아이콘과 건물 이미지. `assets/Isometric City/`는 에셋 팩 원본으로, 지도에는 도로·바닥 타일, 건물, `Characters/`(사람)·`Vehicles/`(차·헬리콥터), `Props/`의 신호등(traffic.js)과 나무·꽃·풀·바위·가로등·쓰레기통·우체통·울타리(구역 빈칸 장식)를 쓰고 나머지 소품은 아직 쓰지 않음. `wall-mask-buildings/`는 건물 에셋별 벽면 마스크. `ui/`는 화면 버튼 SVG(추가·수정·펼치기·NEW 말풍선 등)와 `google/`의 Google 서비스 아이콘. 출처는 README.md |
| `biome.json` | 포맷·린트 설정 |
| `package.json`, `package-lock.json` | 개발 도구 의존성(Biome, Chrome 타입 정의). 서비스 실행에는 필요 없음 |
| `.claude/skills/sync-project/` | 노션 기획 문서로 `PROJECT.md`를 다시 쓰는 Claude Code 스킬 |
| `.github/workflows/biome.yml` | PR과 `main` push 때 Biome 검사 |

## 진입점

| 화면 | manifest 항목 | 불러오는 순서 |
|---|---|---|
| 새 탭 | `chrome_url_overrides.newtab` | `homepage/homepage.html` → `daisyui.generated.css`, `style.css`, `homepage.css`, `settings.css`, `shared/color-picker.css`, `shared/building-picker.css`, `shared/emoji-picker.css`, `homepage.js`(module) |
| 팝업 | `action.default_popup` | `popup/popup.html` → `daisyui.generated.css`, `style.css`, `popup.css`, `shared/color-picker.css`, `shared/emoji-picker.css`, `popup.js`(module) |

## 호출 관계

`debug/ui-preview/src/input.css`는 기본 플러그인 설정·테마·추가 스타일 CSS를 불러오고 UI 부품 모음, 디버그 목록과 건물 색상 테스트 HTML의 클래스를 탐색해 `debug/ui-preview/preview.generated.css`를 생성합니다. 세 디버그 화면은 이 CSS의 `livingtaco` 테마를 공유합니다. 생성된 CSS는 저장소에 포함되므로 디버그 도구를 열 때 npm 설치가 필요하지 않습니다. `debug/ui-preview/src/app.css`는 같은 플러그인과 테마를 불러오고 `homepage/`와 `popup/`의 클래스를 탐색해 루트의 `daisyui.generated.css`를 생성합니다. 서비스도 이 정적 CSS를 런타임 빌드 없이 로드합니다.

```
homepage/homepage.js ──> homepage/layout.js (planCity, planRoads)
homepage/homepage.js ──> homepage/decorations.js (decorationsFor) ──> homepage/layout.js (hashText)
homepage/homepage.js ──> db/db.js (settings) ──> db/settings.js ──> db/storage.js
homepage/homepage.js ──> homepage/background-renderer.js ──> homepage/background.js (planBackground, cellBounds) ──> homepage/layout.js (타일 크기)
homepage/homepage.js ──> homepage/spatial-index.js (팝업 이동 경로 후보 검색)
homepage/homepage.js ──> homepage/map-camera.js (카메라 변환, 변경 시 팝업 닫기·배경 갱신)
homepage/homepage.js ──> homepage/building-drag.js ──> homepage/building-move.js ──> homepage/layout.js (planCity)
homepage/homepage.js ──> db/db.js (moveBookmark: 건물 이동 저장)
homepage/homepage.js ──> homepage/picket-drag.js ──> homepage/building-move.js (gridAt) / homepage/layout.js (project)
homepage/homepage.js ──> db/db.js (saveCategoryPicket: 피켓 위치 저장)
homepage/homepage.js ──> homepage/category-colors.js
homepage/homepage.js ──> homepage/building-rules.js / homepage/building-appearance.js
homepage/homepage.js ──> homepage/category-manager.js / homepage/google-account.js / homepage/google-launcher.js
homepage/category-manager.js ──> homepage/category-reorder.js / homepage/building-reorder.js / homepage/bookmark-search.js
homepage/homepage.js ──> homepage/settings-panel.js ──> db/db.js (settings, resetAllData) / shared/color-picker.js / homepage/background-image.js
homepage/homepage.js ──> homepage/traffic.js ──> homepage/layout.js (project, planRoads 결과의 칸·타일 이름)
homepage/homepage.js ─┐
                      ├─> db/db.js ──> db/bookmark.js / db/category.js ──> db/storage.js
popup/popup.js ───────┘          └─> demo/seed-data.js                       ├─> chrome.storage.local
                                                                           └─> localStorage (웹 미리보기)
popup/popup.js ──> chrome.tabs.query / shared/site-icons.js (현재 탭 제목·URL·파비콘)
homepage/homepage.js ──> chrome.bookmarks.getTree → db/db.js (importChromeBookmarks)
background.js ──> chrome.tabs.onUpdated / onActivated → db/db.js (저장된 사이트 파비콘 갱신)
shared/site-icons.js ──> chrome.runtime.getURL (Chrome Favicon API 주소 생성)
shared/site-icons.js ──> shared/emoji-data.js (저장된 대표 이모지 검증)
popup/popup.js ──> shared/category-select.js / shared/validation.js
popup/popup.js / homepage/homepage.js ──> shared/emoji-picker.js ──> shared/emoji-data.js
homepage/homepage.js ──> shared/emoji-data.js (수정 창의 저장된 이모지 초기값 검증)
db/bookmark.js ──> shared/emoji-data.js (저장·수정할 이모지 검증)
popup/popup.js / homepage/category-manager.js ──> db/category.js (기본 카테고리 판별)
popup/popup.js ──> homepage/category-colors.js (기존 카테고리 색상·새 카테고리 초기 색상)
popup/popup.js ──> homepage/building-appearance.js (미리보기 벽면 마스크)
popup/popup.js / homepage/homepage.js ──> shared/color-picker.js
popup/popup.js / db/bookmark.js / homepage/building-rules.js / shared/building-picker.js ──> shared/building-designs.js
homepage/homepage.js ──> shared/building-picker.js ──> homepage/building-appearance.js / homepage/category-colors.js (벽면 마스크·색)
homepage/category-manager.js ──> db/db.js
homepage/homepage.js ──> shared/
homepage/category-manager.js / db/db.js / db/bookmark.js / db/category.js ──> shared/validation.js
debug/building-color-test/building-color-test.js ──> assets/Isometric City/Buildings/ 및 벽면 마스크 이미지
debug/building-color-test/building-color-test.js ──> homepage/category-colors.js (벽면 명도 보정)
debug/building-color-test/building-color-test.js ──> debug/building-color-test/mask-editor.js (마스크 편집)
debug/building-color-test/building-color-test.js ──> debug/building-color-test/mask-archive.js (마스크 ZIP 다운로드)
```

`debug/building-color-test/building-color-test.js`는 사용 중인 건물 64개와 공사 에셋 2개의 파일명을 정적으로 나열하고 카드를 만들어 색상을 미리 봅니다. 미사용 건물 32개는 표시하지 않습니다. 입력 색상은 페이지 안에서만 적용하며 데이터베이스에 저장하지 않습니다.

`mask-editor.js`는 선택한 정적 PNG를 읽어 픽셀과 불투명도를 편집하고 변경된 마스크를 카드에 미리 보여 줍니다. 원본 보기와 선택 픽셀의 불투명도 복사, 확대·축소를 버튼과 단축키로 제공합니다. 변경된 PNG는 디버그 페이지의 `sessionStorage`에 임시 보관해 같은 탭의 새로고침 후에도 복원하며, 탭 세션이 끝나면 사라집니다. 개별 PNG나 변경된 마스크·전체 마스크 ZIP을 다운로드하고 파일을 직접 교체해야 실제 에셋에 반영됩니다. 앱 데이터 저장 키와 Chrome 저장소는 사용하지 않습니다.

- `db/db.js`가 저장 키와 `bookmarks`, `categories`, `settings` 싱글턴, 초기화 Promise인 `ready`, 변경 알림 `subscribe`(북마크·카테고리·지도 설정 키가 바뀔 때)를 제공합니다.
- 홈페이지 설정 창 안의 "지금 동기화" 버튼은 클릭할 때, "크롬 북마크 자동 동기화"(`settings`의 `autoSyncBookmarks`)가 켜져 있으면 새 탭을 열 때마다 `homepage.js`가 `chrome.bookmarks.getTree`로 읽은 트리를 `importChromeBookmarks`에 전달합니다. 북마크바·기타·모바일 등 Chrome 기본 컨테이너 안의 사용자 폴더를 카테고리로 만들고(폴더 이름은 앞 10자까지만 써서 앱의 카테고리 이름 규칙에 맞춥니다), 하위 폴더의 북마크는 해당 상위 카테고리로 합칩니다. 폴더 밖의 북마크는 "카테고리 일반"으로 가져옵니다. 같은 이름의 카테고리는 재사용하고(앞 10자가 같은 폴더는 한 카테고리로 합쳐집니다), 정규화한 URL이 이미 있으면 건너뜁니다. HTTP/HTTPS 주소만 가져오며 이름은 Chrome 원본을 보존합니다. 공통 쓰기 잠금 안에서 최신 데이터와 합쳐 두 배열을 함께 저장합니다. 가져온 북마크에는 Chrome 북마크 ID를 `chromeId`로 저장하고, 예전에 가져와 `chromeId`가 없는 북마크는 같은 주소의 Chrome 북마크가 있으면 그때 연결합니다. `chromeId`가 있는 북마크는 그 Chrome 북마크가 삭제되어 트리에 없으면 동기화할 때 앱에서도 삭제합니다(메모·방문 횟수 포함). 팝업으로 저장해 `chromeId`가 없는 북마크는 지우지 않습니다. Chrome 원본을 수정하지 않으며, 이름·주소·폴더 변경은 반영하지 않고 실시간 동기화도 하지 않습니다(동기화 시점에만 반영).
- 팝업은 `Bookmark`, `Category` 클래스와 `add` API로 현재 페이지를 저장합니다. 팝업은 374×600 크기의 각진 컨테이너이며 입력 영역만 세로 스크롤하고 하단 74px 영역의 작업 버튼은 고정합니다. 현재 탭 제목을 초기 페이지 이름으로 표시하며, 이름은 빈 값만 거부하고 이름·메모 모두 언어·기호·글자 수 제한 없이 저장합니다. 홈페이지 이름 수정과 메모도 같은 제한을 적용합니다. 긴 이름은 입력란·지도 라벨에서 말줄임하고 상세 카드에서 줄바꿈합니다.
- 새 카테고리 입력은 “일반”으로 시작하며 모든 언어·특수기호·이모지를 허용합니다. 10자 이내, 빈 값·이름 중복 금지 규칙을 UI와 DB에서 검사합니다. 기존 카테고리 목록은 `shared/category-select.js`로 색상 칩과 이름을 함께 표시하고 4개 항목 높이에서 스크롤합니다. 새 카테고리는 임의의 팔레트 색상으로 시작하며 색상 선택기·HEX 입력으로 바꿉니다. 불투명도는 100%로 표시합니다. 선택한 색상은 기존 `color` 필드에 저장합니다.
- 건물 선택은 5개 계열의 좌우 방향별 기본 디자인 10종이며 기본값은 도심 주택 왼쪽입니다. 선택 상태는 회색 반투명 배경으로 강조하며 양 끝의 진행 불가 화살표는 숨깁니다. 미리보기는 홈페이지와 같은 벽면 마스크, 색상 블렌딩 및 `wallColorAdjustments`를 사용하고 카테고리 선택·색상·HEX 변경 즉시 갱신합니다. 선택값은 북마크의 `buildingDesign` 필드에 저장하며, 지도는 선택한 계열·방향과 카테고리 색상을 적용합니다. 선택값이 없으면 ID 기반으로 결정합니다.
- 상세 카드의 메모 입력과 북마크 수정은 `BookmarkDB.edit`를 사용합니다. 수정 창은 변경된 이름·URL만 검증합니다. 건물 디자인은 선택 즉시 지도에 미리 반영하고, **수정하기** 또는 **Esc**로 닫을 때 처음 표시한 디자인에서 바뀐 값만 `buildingDesign`으로 저장합니다. **취소하기**는 미리보기를 버려 원래 모습으로 복원합니다. 선택 중에는 저장 객체와 지도 배치 스냅샷을 바꾸지 않아 디자인 필드가 없던 북마크도 정확히 복원되며, 저장 실패 시 모달과 선택을 유지해 재시도할 수 있습니다. 이모지 선택기가 열려 있으면 Esc는 먼저 선택기만 닫습니다. 수정 창이 열린 동안 지도는 45%·blur 1px로 흐려지고(`#world.editor-focus`가 흐림 막 값을 바꿈) 수정 중인 건물은 다시 그린 뒤에도 선명하게 남습니다. 북마크 삭제는 상세 카드의 삭제 버튼에서 확인 창을 거쳐 `BookmarkDB.remove`를 사용합니다. 카테고리 삭제는 `deleteCategory`가 카테고리와 포함된 북마크를 함께 삭제합니다. 카테고리 병합은 다른 카테고리 줄 가운데에 놓으면 확인 창(`#category-merge`)을 띄우고, **합치기**를 누를 때만 `mergeCategory(from, to)`가 옮기는 북마크의 `category`를 바꾸고 `cell`을 지워 새 영역에 다시 배치하게 한 뒤 원래 카테고리를 지웁니다(카테고리 일반은 거부). 카테고리 아래 건물 목록은 북마크 배열 순서이며, `BookmarkDB.reorder(ids)`는 그 북마크들이 차지한 배열 자리 안에서만 순서를 바꿉니다(필드 변경 없음). 순서는 카테고리 배열 순서로 저장합니다. 건물 행을 다른 카테고리 줄(펼친 건물 목록 제외)에 놓으면 `BookmarkDB.edit(id, { category })`로 그 카테고리로 옮기며, `edit`가 `cell`을 지워 지도가 새 영역에 다시 배치합니다(카테고리 일반으로도 옮길 수 있음).
- DB는 초기화가 끝난 뒤 저장소를 읽습니다. 조회 시 최신 데이터를 다시 읽어 다른 탭의 저장을 반영합니다.
- 홈페이지 북마크 수정 창은 카테고리 선택과 새 이름 입력을 전환할 수 있습니다. 새 카테고리는 화면 안의 임시 객체로 보관하고, 최종 수정 시 최신 이름 중복을 검사해 `CategoryDB.add` 후 `BookmarkDB.edit`로 연결합니다. 취소 시 생성하지 않으며, 생성 뒤 북마크 저장이 실패하면 생성된 카테고리를 선택한 상태로 재시도해 중복 생성을 막습니다. Chrome API 연결 없이 웹 미리보기에서도 동일한 DB 경로를 사용합니다.
- 두 저장 키가 모두 없는 최초 환경에서만 시연 데이터를 넣습니다. 기존 배열은 빈 배열이어도 덮어쓰지 않습니다. Web Locks로 여러 탭의 초기화를 직렬화합니다.
- 지도는 저장 변경 알림, 화면 재진입(다른 탭에서 돌아옴), 새 탭 로드 시 데이터를 갱신합니다. 메모·NEW·미리보기·아이콘(`iconUrl`) 필드만 바뀐 저장은 다시 그리지 않습니다. 아이콘이 바뀌면 열린 상세 카드의 아이콘만 바꾸고, 지도 아이콘은 다음 전체 렌더링 때 반영합니다. 렌더링 비교값에는 배경 사진 전체 대신 길이와 앞뒤 일부만 넣습니다. 팝업과 홈페이지는 저장소와 객체 형식을 공유합니다.
- 지도 전체의 표시 데이터가 같으면 DOM 갱신을 건너뛰고, 일부만 바뀌면 변경 없는 카테고리의 건물·장식·잔디·라벨 노드를 재사용합니다. 드래그 미리보기 뒤에는 정상 지도를 다시 그립니다. 배치 계산은 북마크를 카테고리별로 한 번 묶어 사용합니다.
- 공터 배경은 수천 개의 이미지 요소 대신 화면 크기(최대 400만 픽셀)의 캔버스 하나로 표시합니다. 건물 호버 윤곽은 에셋마다 CSS 규칙 하나를 공유하며, 팝업 이동 경로와 겹치는 건물은 캐시한 월드 좌표와 공간 색인으로 찾습니다. 저장 형식은 바꾸지 않습니다.
- 새 탭은 `updateCity` 안에서 최신 배열을 읽고 `planCity`로 배치를 계산합니다. 바뀐 위치·기본 색을 한 번에 저장합니다. 모든 데이터 변경은 공통 Web Locks(`webprg-bookmarkmap-data`)를 사용하므로 팝업 저장·메모·색상·도시 배치가 서로 덮어쓰지 않습니다. Web Locks가 없는 환경은 같은 페이지의 Promise 큐로 순차 처리합니다.
- 새 탭은 색이 없는 카테고리 색을 `category-colors.js` 규칙으로 정하고 `db.js`에서 저장합니다. 카테고리 색상 편집은 입력 즉시 목록의 색상 표시·구역 강조 영역·건물 벽·잔디 색에 반영되고 `CategoryDB.edit`로 저장합니다.
- 두 화면은 같은 `createColorPicker`와 CSS를 사용합니다. 홈페이지는 캔버스 배율에 맞춰 피커 위치를 정하고 색상 미리보기·지연 저장을 처리합니다. 팝업은 새 카테고리 이름 입력창 내부 왼쪽의 색상 칩을 누르면 피커를 엽니다. HEX·불투명도는 피커 안에 표시합니다. 바뀐 색은 칩과 건물 미리보기에 즉시 반영하되 저장하기 전에는 DB에 쓰지 않습니다.
- 도시 배치 규칙 (`homepage/layout.js`):
  - 그리드 한 칸에 건물 하나. 카테고리 구역은 2×2 → 2×3 → 3×3 → 3×4 … 순서의 모양 중, (북마크 수 + 피켓 1칸) × 1.3칸이 들어가는 크기입니다(`MARGIN`). 남는 칸은 건물 사이 여백입니다.
  - 건물과 피켓이 구역의 85%를 넘게 채우면 커지고(`MAX_FILL`), 45% 미만이면 줄어듭니다(`MIN_FILL`). 줄어든 모양이 원래 구역 안에 들어갈 때만 줄입니다. 북마크 한두 개로는 구역 크기가 바뀌지 않습니다.
  - 새 건물은 옆에 건물이 없는 빈칸, 그다음 바둑판 칸을 먼저 고르고, 같으면 북마크 ID 해시로 고릅니다(`hashText`). 정한 칸은 저장되므로 새로고침해도 그대로입니다. 배치 계산이 구역 크기를 바꾸면 그 구역의 건물을 이 규칙으로 다시 놓습니다(건물 이동으로 고정된 땅은 제외).
  - 구역마다 빈칸 하나를 카테고리 이름 피켓 칸으로 비워 둡니다(`group.picket`). 카테고리에 저장된 `picket` 칸이 비어 있으면 그 칸을, 아니면 앞쪽(화면 아래) 모서리에 가장 가까운 빈칸을 씁니다. 그 칸에는 카테고리 이름을 적은 나무 팻말을 HTML·CSS로 그립니다(`homepage.js`의 `createPicket`, 윗면 띠는 카테고리 색).
  - 나머지 빈칸에는 지도 장식 밀도 설정(`settings`의 `decorationDensity`)에 따라 장식(나무·꽃·풀·바위·거리 소품)을 그립니다. 많이(`high`)는 빈칸 전부, 보통(`normal`, 기본값)은 약 65%, 적게(`low`)는 약 35%입니다. 칸마다 밀도용 해시를 따로 고정해 두므로 밀도를 올리면 기존 장식은 그대로 두고 장식만 늘어납니다. 설정이 저장되면 저장 변경 알림으로 지도를 다시 그립니다. 또한 집 건물 약 70%에는 앞쪽 변에 울타리와 우체통을 붙입니다(`homepage/decorations.js`). 칸마다 카테고리 ID와 구역 안 위치로 고르므로 구역이 통째로 옮겨져도 장식이 따라갑니다. 저장하지 않고, 클릭을 막지 않습니다.
  - 모든 구역 둘레에 1칸 도로가 있고, 이웃 구역과 도로를 공유합니다(구역 사이 최소 1칸).
  - 구역 사이는 정확히 1칸(도로 공유)이거나 3칸 이상입니다. 2칸이면 도로 두 줄이 나란히 생기므로 허용하지 않고, 저장된 배치에 2칸 간격이 있으면 한쪽을 1칸 당기거나 밀어 고칩니다(`fixDoubleRoads`). 3칸 이상 떨어진 구역끼리는 도로가 직접 이어지지 않지만, 도로망 전체는 항상 하나로 이어지게 합니다. 카테고리 삭제 등으로 도로망이 끊겨 섬이 생기면 구역들을 중앙 쪽으로 당기고, 그래도 남은 섬 구역은 본 도로망과 도로를 공유하는 가장 가까운 빈자리로 옮깁니다(`roadsConnected`, `reconnect`, 고정된 땅은 제외). 건물을 옮길 때 고정된 두 땅이 2칸 간격이 되면 건물이 빠진 땅(`pinned`의 두 번째)만 1칸 움직일 수 있습니다.
  - 새 카테고리는 중앙에서 가장 가까운 빈 자리에 놓입니다. 구역은 바깥쪽으로 커집니다.
  - 커질 자리가 없으면 구역 하나만 옮깁니다(자기 자신 또는 막고 있는 이웃 하나 중 덜 움직이는 쪽). 구역이 옮겨지면 건물도 같이 옮겨집니다.
  - 추가할 때 기존 건물 칸은 바뀌지 않습니다. 구역이 줄어들 때는 건물이 없는 줄(행·열)부터 없애고(가운데 줄이면 건물이 적은 쪽이 한 칸 붙음), 빈 줄이 없을 때만 가운데에서 먼 쪽을 잘라 건물을 다시 채웁니다. 구역이 줄어들면 구역들을 중앙 쪽으로 당깁니다. 건물을 옮길 때는 옮긴 뒤 생긴 빈자리도 중앙 쪽으로 당기되, 건물을 놓은 땅과 건물이 빠진 땅은 움직이지 않습니다(`planCity`의 `pinned`·`compactAll` 옵션).
  - 카테고리를 삭제하면 포함된 북마크도 함께 삭제합니다. 저장 데이터에서 카테고리 ID가 일치하지 않는 북마크가 발견되면 DB 초기화 및 도시 갱신 시 "카테고리 일반"의 ID로 바꾸어 저장하고 기존 칸을 지워 다시 배치합니다. 별도의 임시 구역은 만들지 않습니다.
  - 도시 전체가 지도 영역에 들어가도록 확대·축소합니다.
  - 구역과 도로 밖의 화면 전체는 흙 바닥(미개발 공터)으로 채웁니다(`homepage/background.js`). 약 14% 칸에 풀 조각·마른 자국·웅덩이 변형을 칸 좌표 기준으로 고정해 섞습니다. 배경은 저장하지 않고 그릴 때마다 현재 구역·도로로 다시 계산하며, 확대·축소 계산에는 포함하지 않습니다. 창 크기가 바뀌면 배경만 다시 그립니다. 배경 캔버스는 화면보다 사방 256px(`BACKGROUND_OVERSCAN`) 크게 그려 두고, 카메라가 움직이면 배율이 바뀌었거나 그 여유의 절반 넘게 이동한 즉시, 그렇지 않으면 움직임이 멈춘 0.12초 뒤에 다시 그려 빈 영역이 보이지 않게 합니다.
  - 건물을 0.4초 길게 누르거나 누른 채 움직이면 집어 들고, 땅의 칸에 놓습니다(`homepage/building-drag.js`, `homepage/building-move.js`). 건물은 항상 놓은 칸에 들어갑니다. 같은 땅: 빈칸은 이동, 다른 건물 칸은 자리 교환. 다른 땅: 빈칸은 그 칸, 건물 칸은 그 건물을 가장 가까운 빈칸으로 밀고 그 칸. 도로에는 놓을 수 없습니다. 꽉 찬 다른 땅 위에 머물면 그 땅 테두리를 따라 게이지가 1초 동안 차오르고, 다 차면 네 면의 넓힐 칸(가장자리 바로 밖 도로 칸, 모서리 제외)이 나타납니다. 넓힐 칸에 놓으면 그 땅이 그 방향으로 한 줄 넓어지며 건물이 그 칸에 들어가고, 넓힌 줄 너머의 다른 땅은 건물과 함께 한 칸 밀린 뒤 빈 자리가 있으면 중앙 쪽으로 다시 당겨집니다. 넓힐 칸은 포인터가 그 땅이나 둘레 도로를 벗어나면 사라집니다. 끄는 동안 지도는 그대로 두고, 넓힐 칸 위에 있을 때만 땅·도로·배경·건물을 놓은 뒤 모습으로 다시 그려 보여 줍니다(확대 비율 유지, 다른 넓힐 칸과 게이지는 숨김). 놓을 수 없는 곳에서 놓으면 안내 없이 원래 자리로 돌아갑니다. 저장된 데이터의 변경은 끄는 동안 반영하지 않고 끝난 뒤 다시 그리며, 놓은 경우에는 저장이 끝날 때까지 화면을 유지합니다. 놓을 때 저장소가 시작 때와 다르거나 결과가 미리보기와 다르면 저장하지 않습니다.
  - 피켓(이름 팻말)은 누른 채 움직이면 바로 집어 들고, 같은 땅의 빈칸(건물이 없는 칸, 장식은 상관없음)에 놓으면 그 칸으로 옮깁니다(`homepage/picket-drag.js`). 놓을 칸에는 카테고리 색 마름모를 표시하고, 땅 밖이나 건물 칸 위에서는 팻말이 회색으로 바뀌며 놓으면 원래 자리로 돌아갑니다. Esc로 취소합니다. 저장은 `saveCategoryPicket(id, { x, y })`이며, 끄는 동안 들어온 저장 변경은 끝난 뒤 다시 그립니다. 장식은 새 피켓 칸을 비우고 다시 배치됩니다.
- Chrome 확장프로그램에서는 `chrome.storage.local`, 웹 미리보기에서는 별도의 `localStorage`를 사용합니다.

## 데이터 구조

`chrome.storage.local`에 북마크·카테고리 배열, 아이콘 보정 완료 표시, 지도 설정을 저장합니다.

| 키 | 값 |
|---|---|
| `webprg-bookmarkmap-bookmarks` | 북마크 객체 배열 |
| `webprg-bookmarkmap-categories` | 카테고리 객체 배열 |
| `webprg-bookmarkmap-icon-backfill-v1` | 기존 북마크의 아이콘 주소를 홈페이지 첫 실행에서 한 번 보정했는지 여부 |
| `webprg-bookmarkmap-settings` | 지도 설정 객체 |

**북마크:** `{ id, url, name, category, savedAt, clickCount, cell, lastVisitedAt?, memo?, isNew?, preview?, iconUrl?, useEmoji?, emoji?, buildingDesign? }`
- `id`: `crypto.randomUUID()` 문자열
- `chromeId`: 선택 사항. Chrome 북마크에서 가져온 북마크의 Chrome 북마크 ID(문자열). 동기화할 때 이 ID의 Chrome 북마크가 없으면 앱에서도 삭제합니다. 팝업으로 저장한 북마크에는 없습니다.
- `category`: 카테고리의 `id`. 일치하는 카테고리가 없으면 DB 초기화 및 도시 갱신 시 "카테고리 일반"의 ID로 바꾸어 저장합니다
- `savedAt`: 저장 시각(`Date.now()`). Chrome 북마크 가져오기는 원래 등록일(`dateAdded`)을 사용합니다.
- `clickCount`: 지도에서 사이트를 방문한 횟수(일반 클릭, Ctrl/⌘ 클릭, 휠 클릭). 기존 북마크는 클릭 전까지 필드가 없으며, 클릭하면 1부터 저장됩니다
- `lastVisitedAt`: 지도에서 마지막으로 방문한 시각(`Date.now()`). `clickCount`를 올릴 때 함께 저장합니다. Chrome 북마크를 새로 가져올 때는 가져온 현재 시각으로 초기화해 정상 건물로 시작합니다. 그 외 방문 기록이 없는 북마크는 파손 판정에 `savedAt`을 사용합니다.
- `cell`: 지도 그리드에서 건물이 놓인 칸 `{ x, y }`(절대 좌표). 새 탭이 처음 그릴 때 채웁니다. 카테고리를 바꾸면(`edit`) 지워지고 새로 배정됩니다. 지도에서 건물을 끌어 옮기면(`moveBookmark`) 놓은 칸이 저장됩니다

- `memo`: 글자 수 제한 없는 문자열 메모. 기존 데이터에 없으면 빈 메모로 표시합니다. 팝업에서는 최종 저장 버튼을 누를 때만 북마크와 함께 저장합니다.
- `useEmoji`: 대표 아이콘으로 이모지를 쓸지 여부(boolean). 새 북마크의 기본값은 false이고, 필드가 없는 기존 북마크도 사이트 아이콘을 사용하는 것으로 해석합니다.
- `emoji`: 선택한 이모지 문자열. 새 북마크의 기본값은 `😊`이며 `useEmoji`가 false여도 선택값을 보존합니다. 팝업의 아이콘 선택은 최종 저장 시 두 필드와 기존 `iconUrl`을 함께 저장하며, `BookmarkDB.add`와 `edit`는 타입 및 허용 이모지 목록을 검증합니다. `useEmoji`가 true이고 이모지가 유효하면 홈페이지 지도 라벨·호버 카드·카테고리 건물 목록에 해당 이모지를 텍스트로 표시합니다. 그 외에는 기존 사이트 아이콘 경로를 사용합니다.
- `buildingDesign`: 선택적 디자인 ID (`blue-homes:a` 등). `shared/building-designs.js`의 ID를 `add`/`edit`에서 검증합니다. 선택한 계열과 방향을 성장·파손 단계에서도 유지하며, 필드가 없으면 ID 기반 규칙을 사용합니다. 데이터 호환을 위해 `cafe:a`·`pizza:a`도 허용하며 각각 카페·피자 가게의 외형 단계부터 표시합니다.
- `iconUrl`: 선택 사항인 웹사이트 아이콘 URL. 저장 팝업은 현재 탭 파비콘 URL을 저장하고, 없으면 Chrome Favicon API 주소를 생성합니다. 기존 북마크는 `webprg-bookmarkmap-icon-backfill-v1` 표시를 두고 홈페이지 최초 실행에서 한 번 보정합니다. Chrome 북마크 API는 파비콘을 제공하지 않으므로 동기화한 URL을 Favicon API로 연결합니다. 탭에서 파비콘이 갱신되거나 페이지가 활성화되면 서비스 워커가 같은 URL의 저장된 북마크를 찾아 실제 파비콘 URL을 저장합니다. 아이콘 정보가 없거나 로딩이 실패하면 홈페이지 지도는 지구본 이모지를 표시합니다. 호버 카드는 사이트명 앞에 지도와 같은 아이콘 주소(`shared/site-icons.js`의 `bookmarkIconUrl`)를 표시하며, 불러온 뒤에 바꿔 깨진 이미지를 보이지 않고, 불러오지 못하면 확장 프로그램 아이콘(`assets/icons/icon32.png`)을 표시합니다.
- `isNew`: 새로 저장한 건물의 NEW 표시. 건물을 호버·포커스하면 false로 저장합니다. 새 탭을 떠날 때(다른 탭으로 전환), 그 화면을 보기 시작한 시각보다 먼저 저장된 북마크도 false로 저장합니다. 따라서 새로 연 탭에서는 NEW가 보이고, 한 번 본 뒤 다시 들어오면 사라집니다. 기존 데이터에는 표시하지 않습니다.
- `preview`: 예전 페이지 미리보기용 로컬 JPEG data URL. 미리보기 기능을 없애 현재 화면은 이 필드를 표시하거나 수집하지 않으며, 기존 데이터에 남아 있어도 그대로 둡니다.

**카테고리:** `{ id, name, createdAt, area, color, customColor?, buildingFamily?, isGeneral?, picket? }`

- `isGeneral`: true이면 기본 카테고리인 “카테고리 일반”. 초기화 때 이름을 정규화하고 ID와 연결된 북마크는 보존합니다. 이 항목이 없으면 같은 이름의 카테고리를 지정하거나 새 UUID로 생성합니다. 이름 변경과 삭제는 `CategoryDB` 및 `deleteCategory`에서 거부하며 색상 변경은 허용합니다. 저장·조회·정렬 및 지도 렌더링에서 항상 맨 앞이고 순서 이동 UI는 제공하지 않습니다. 팝업의 카테고리 선택은 이 항목을 기본값으로 사용합니다.

- `area`: 지도 그리드에서 구역이 차지하는 칸 `{ x, y, w, h }`. 새 탭이 처음 그릴 때 채웁니다
- `picket`: 사용자가 피켓(이름 팻말)을 끌어 놓은 칸. 구역 왼쪽 위 칸(`area.x`, `area.y`) 기준 오프셋 `{ x, y }`라서 땅이 옮겨져도 함께 움직입니다. 끌어 옮기기 전에는 없습니다. 그 칸이 구역 밖이거나 건물이 차지하면 무시하고 기본 자리를 쓰며, 그 칸이 다시 비면 저장된 자리로 돌아갑니다
- `color`: 카테고리 목록의 색상 표시, 구역 강조 영역, 구역 안 집·잔디 색에 적용하는 6자리 hex 색상. 비어 있는 기존 카테고리는 지도에서 자동 지정해 저장합니다.

- `customColor`: 이전 화면의 사용자 색상 지정 여부. 저장 값은 보존하지만 홈페이지 건물 색상에는 사용하지 않습니다.
- `buildingFamily`: 이전 버전이 저장한 선택적 계열 ID. 현재 화면의 계열 선택에는 사용하지 않으며, 기존 필드는 데이터 호환을 위해 보존합니다.

**지도 설정:** `{ decorationDensity?, cityAnimation?, openInNewTab?, autoSyncBookmarks?, emptySpaceFill?, googleLauncher? }`

- `decorationDensity`: 지도 장식 밀도. `"low"`(적게)·`"normal"`(보통)·`"high"`(많이) 중 하나이고 기본값은 `"normal"`입니다. `settings.get()`은 기본값을 채운 전체 설정을 돌려주고, `settings.edit({ decorationDensity })`는 값을 검사한 뒤 저장합니다(다른 저장 필드는 보존). 설정 창은 열 때 읽은 값을 보관하고 변경한 항목을 즉시 저장·반영합니다. 연속 입력은 쓰기 순서를 보장하면서 대기 중인 이전 입력을 최신 값으로 합칩니다. **설정 취소**·X 버튼·설정 버튼 다시 누르기는 이번에 바꾼 항목을 창을 열기 전 값으로 복원하며, **설정 저장**·Esc·바깥 클릭은 변경을 유지합니다. 취소와 전체 초기화는 진행 중인 설정 쓰기 뒤에 처리해 뒤늦은 쓰기가 복원·초기화 값을 덮지 않도록 합니다. 설정창 항목이 늘면 `db/settings.js`의 기본값과 검사 목록에 필드를 추가합니다.

- `cityAnimation`: boolean, 기본값 true. `homepage.js`가 설정을 읽어 `traffic.setEnabled`에 전달합니다. false이면 교통 요소만 정지하며 호버·대화상자 페이드는 유지합니다. OS 움직임 줄이기는 이 설정보다 우선합니다.
- `openInNewTab`: boolean, 기본값 true. 일반 건물 클릭을 새 탭으로 열고 false이면 현재 탭으로 엽니다. Ctrl/⌘·Shift·가운데 클릭 등 브라우저 기본 동작과 방문 횟수 기록은 유지합니다.
- `autoSyncBookmarks`: boolean, 기본값 false. true이면 `homepage.js`가 새 탭을 열 때마다 크롬 북마크를 가져오고 크롬에서 지운 북마크를 삭제합니다(지금 동기화와 같은 동작).
- `googleLauncher`: Google Service 런처에 표시할 앱 ID 9개의 배열(순서대로, 중복 없음). ID 목록은 `db/settings.js`의 `GOOGLE_LAUNCHER_APPS`(27개)이고 기본값은 그 앞 9개(계정·검색·지도·Play·뉴스·Gmail·드라이브·Meet·주소록)입니다. 값이 없거나 올바르지 않으면 기본값을 씁니다.
- `emptySpaceFill`: `{ mode, colorMode, solidColor, gradientStart, gradientEnd, angle, photoDataUrl }`. `mode`는 `none`·`color`·`photo`·`tile`이고 기본값은 `tile`, `colorMode`는 `solid`·`gradient`이고 기본값은 `solid`입니다. 설정 창의 네 칸은 단색(`color`+`solid`)·그라데이션(`color`+`gradient`)·타일(`tile`)·사진(`photo`)이며, `none`은 설정 창에서 더 고를 수 없고 이미 저장된 값은 그대로 읽습니다. 색상은 6자리 HEX(기본 단색·시작색 `#d7e9c8`, 끝색 `#b7d6f2`), 방향은 0~360 정수(기본 90), 사진은 JPG/PNG/WEBP의 base64 data URL(기본 빈 문자열)입니다. 업로드 원본의 용량 제한 없이 긴 변 2560px·인코딩 결과 1MiB 이내로 자동 최적화한 뒤 저장합니다(base64 변환 시 약 4/3배). 기존 저장 사진에는 새 용량 제한을 적용하지 않습니다. **선택 UI·설정 저장만 구현했으며 `background.js`·배경 렌더러는 이 설정을 사용하지 않습니다.**

`db/db.js`의 `resetAllData`는 공통 쓰기 잠금 안에서 북마크를 빈 배열, 카테고리를 새 기본 카테고리 하나, 설정을 기본값, 아이콘 보정 표시를 false로 한 번에 저장합니다. 저장 키는 남겨 다음 실행에서 시연 데이터가 다시 생성되지 않게 합니다. 크롬 원본 북마크나 다른 서비스의 저장소는 삭제하지 않습니다. 설정 창의 초기화 확인 버튼을 눌렀을 때만 호출하며 설정 취소로 되돌릴 수 없는 별도 즉시 실행 동작입니다. 크롬 북마크 동기화도 설정 저장과 별도로 즉시 실행합니다.

키 이름이나 필드를 바꾸면 이미 저장된 데이터를 읽지 못하게 됩니다. 바꾸기 전에 팀에 묻습니다.

## 무언가를 추가하려면

| 하려는 일 | 고칠 곳 |
|---|---|
| 북마크·카테고리에 필드 추가 | `db/bookmark.js` 또는 `db/category.js`의 `add`/`edit`(허용 필드 목록), 그 필드를 쓰는 페이지 |
| 새로 저장할 데이터 종류 | `db/`에 새 클래스, `db/db.js`에 키와 싱글턴 |
| 두 페이지 공통 색·크기 | `style.css` 변수 |
| 새 Chrome API 사용 | `manifest.json` `permissions` (먼저 팀에 묻기) |

- `shared/building-designs.js`는 계열별 성장 에셋과 선택 가능한 디자인을 정의하고, `building-rules.js`는 북마크의 디자인·방문 횟수·마지막 방문 시각으로 이미지를 결정합니다. 선택한 디자인이 없으면 ID 해시로 계열과 방향을 정합니다. 성장 단계와 파손 규칙, 사용·미사용 목록은 `BUILDING_FAMILIES.md`에 있습니다. 에셋은 원본 픽셀 크기로 그립니다(대부분 128px 폭, 일부 129~132px).
- `building-appearance.js`는 알파 128 미만의 그림자·여백을 제외한 호버 윤곽을 이미지 URL별 Promise로 캐시합니다. 벽면 마스크는 `assets/wall-mask-buildings/wall-mask-<건물 이미지 파일명>` 규칙으로 정적 PNG를 연결하며, 디버그 페이지도 같은 경로를 사용합니다.
- 집과 잔디는 카테고리 `color`로 착색합니다. 집은 정적 벽면 마스크에 색상층과 명도 보정층을 적용합니다. 상점 지붕 테두리·문틀·창틀·벽 접합부는 포함하고 유리·문짝·벽돌 줄눈은 제외하며, 파손 얼룩과 모서리는 벽면에 포함합니다. 검정 보정층의 불투명도는 0.6 이하로 제한해 원본 명암 차이를 최소 40% 남깁니다. 홈페이지와 디버그 페이지가 같은 `wallColorAdjustments`를 사용합니다. 잔디는 `category-colors.js`에서 채도·명도를 보정한 뒤 색상층과 명도 보정층을 적용합니다. 구역 강조는 카테고리 색으로 채운 영역으로 표시합니다.
- 잔디는 모든 카테고리에서 `tile_ground_grass.png` 한 장을 쓰고, 카테고리 색으로 착색합니다.

## Google 계정 표시 연결

`google-account.js`의 `setGoogleAccount({ displayName, photoUrl })`는 인증된 계정 정보를 입력받아 표시합니다. 계정 표시 해제는 `setGoogleAccount(null)`입니다. 홈페이지는 기본 아바타로 시작하며, 이 모듈은 로그인·계정 조회·토큰 저장을 수행하지 않습니다. 사진이 없으면 이름의 첫 글자(이름도 없으면 기본 사람 아이콘), 이미지 로드 실패 시에도 같은 대체 표시를 사용합니다.
