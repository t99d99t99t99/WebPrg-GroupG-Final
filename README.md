# 북마크 도시

웹페이지를 카테고리별 건물로 저장하고 Chrome 새 탭의 아이소메트릭 지도에서 찾아가는 확장 프로그램입니다.

## 문서
* [PROJECT.md](PROJECT.md): 기획 (노션에서 생성, 직접 수정 금지)
* [ARCHITECTURE.md](ARCHITECTURE.md): 프로젝트 구조, 데이터 구조
* [BUILDING_FAMILIES.md](BUILDING_FAMILIES.md): 사용 중인 건물 계열, 성장 단계별 에셋, 마스크 경로
* [AGENTS.md](AGENTS.md): 협업·Git 규칙, AI 에이전트 지침 (`CLAUDE.md`는 이 파일을 불러옴)

## 개발에 필요한 패키지 설치하기
### Windows
```powershell
winget install OpenJS.NodeJS.LTS
```

Node.js 설치 시 npm도 함께 설치됩니다. 프로젝트 폴더에서 의존성을 설치합니다:
```powershell
npm install
```

### MacOS
```bash
brew install node
```

Node.js 설치 시 npm도 함께 설치됩니다. 프로젝트 폴더에서 의존성을 설치합니다:
```bash
npm install
```

### GitHub CLI (AI가 PR 생성·머지까지 하려면 필요)
AI에게 "올려줘"라고 하면 커밋부터 `main` 머지까지 한 번에 진행합니다([AGENTS.md](AGENTS.md) "커밋과 올리기"). 이때 GitHub CLI(`gh`)를 씁니다.
```bash
winget install GitHub.cli   # Windows (MacOS: brew install gh)
gh auth login               # 처음 한 번, GitHub 계정으로 로그인
```

## 크롬에서 보기
1. 크롬 우측 상단 점 세개 버튼 누르기
2. "설정" 누르기
3. 좌측 사이드바에서 "확장 프로그램" 누르기
4. 우측 상단 "개발자 모드" 버튼 누르기
5. "압축해제된 확장 프로그램 로드" 버튼 누르기
6. 본 프로젝트의 폴더를 불러오기

코드를 고친 뒤에는 확장 프로그램 카드의 새로고침 버튼을 누릅니다.
* 팝업 콘솔: 팝업 안에서 우클릭 → "검사"
* 새 탭 콘솔: 새 탭에서 F12

### Chrome 북마크 가져오기

확장 프로그램을 새로고침한 뒤 새 탭 왼쪽 위의 **설정**을 열고 **크롬 북마크 동기화** 오른쪽의 동기화 버튼을 누릅니다. Chrome 북마크를 읽기 위해 `bookmarks` 권한, Chrome Favicon API로 사이트 아이콘을 조회하기 위해 `favicon` 권한, 방문 중인 탭의 파비콘 갱신을 감지하기 위해 `tabs` 권한을 사용합니다. 홈페이지 최초 실행에서는 기존 북마크의 아이콘을 한 번 보정하고, Chrome 북마크 동기화 뒤에도 아이콘을 조회합니다. 저장된 페이지를 방문해 파비콘이 바뀌면 다음 홈페이지 화면에 반영됩니다.

- 북마크바·기타·모바일 북마크 안의 사용자 폴더는 카테고리로 가져오고(폴더 이름은 앞 10자까지), 하위 폴더의 북마크도 상위 폴더 카테고리에 합칩니다.
- 폴더에 넣지 않은 북마크는 **카테고리 일반**에 저장합니다.
- 이름이 같은 카테고리는 재사용하고, 이미 저장된 URL은 중복 추가하지 않습니다. HTTP/HTTPS 주소만 가져옵니다.
- 클릭할 때마다 새 항목을 가져옵니다. Chrome 원본은 유지하며, 원본에서 수정·삭제한 항목을 서비스에 자동 반영하지는 않습니다.
- 일반 웹 미리보기에서는 Chrome 북마크에 접근할 수 없습니다.

## daisyUI 스타일 빌드와 미리보기

디버그 도구의 **daisyUI 부품 모음**은 저장소에 포함된 CSS를 사용하므로 설치나 빌드 없이 열 수 있습니다. 스타일을 수정할 때만 [daisyUI 미리보기 사용 설명](debug/ui-preview/README.md)에 따라 해당 폴더에 의존성을 설치해 CSS를 다시 생성합니다. 서비스 화면은 루트의 `daisyui.generated.css`를 정적으로 불러옵니다.

```powershell
cd debug/ui-preview
npm.cmd ci
npm.cmd run build:all
```

테마 또는 서비스 HTML의 daisyUI 클래스를 바꾸면 `npm.cmd run build:app`으로 서비스 CSS를 다시 생성합니다. 미리보기 소스를 바꾸면 `npm.cmd run build` 또는 `npm.cmd run watch`로 `preview.generated.css`를 갱신해 함께 반영합니다.

## 코드 검사 (Biome)
커밋 전에 바꾼 파일의 포맷과 린트를 맞춥니다. PR을 올리면 GitHub에서 같은 검사가 자동으로 돕니다.
```bash
npx biome check --write <파일>   # 바꾼 파일만 고치기
npx biome ci .                   # 전체 검사 (GitHub에서 도는 것과 같음)
```
VS Code를 쓰면 Biome 확장을 설치해 저장할 때 자동으로 맞출 수 있습니다.

## 에셋 출처

### 카테고리 목록 아이콘

- 디자인 원본: Figma 화면명세(11.19) `Components / Main Map`의 `Icon / Search`, `Main / Reorder Button`, `Main / Category List Item`
- 파일: `assets/ui/search.svg`(17×17px), `clear-search.svg`(17×17px), `drag-handle-row.svg`(8×3px, 드래그 손잡이의 점 두 개 한 줄 — 세 줄을 2px 간격으로 쌓아 32×32 손잡이를 만듦), `edit.svg`(20×20px), `delete.svg`(18×18px, 빨간 선). 카테고리 아이콘(쌓인 타일 3장)은 `homepage/category-manager.js`가 SVG로 그립니다.

### 팝업 건물 선택 화살표

- 디자인 원본: [Figma 팝업](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk/?node-id=6142-5889)
- 파일: `assets/ui/popup-arrow-left.svg`(14×15px), `popup-arrow-right.svg`(14×14px)

### 확장 프로그램 아이콘

디자인 원본: [Figma 아이콘](https://www.figma.com/design/c5m3zTylAHEJby2WeHxOiX?node-id=1-2)

수정 가능한 SVG는 `assets/icons/source/`에 있습니다. `symbol.svg`는 단독 집, `city.svg`는 3×3 건물 모음이며, SVG에는 실루엣과 흰색 문 도형이 분리되어 있습니다.

| 파일 | 크기 | 사용 위치 |
|---|---|---|
| `assets/icons/icon16.png` | 16×16 | 툴바와 새 탭 파비콘 |
| `assets/icons/icon32.png` | 32×32 | 고해상도 툴바 |
| `assets/icons/icon48.png` | 48×48 | 확장 프로그램 관리 화면 |
| `assets/icons/icon128.png` | 128×128 | 설치 및 대표 아이콘 |

PNG는 바깥 배경과 문이 투명합니다. 16·32px은 파란 집 한 채, 48·128px은 건물 모음을 사용합니다. 설치 후 아이콘이 바로 바뀌지 않으면 `chrome://extensions`에서 이 확장 프로그램을 새로고침하고 새 탭을 다시 엽니다.

### 도시 지도 에셋

아이소메트릭 도시 에셋 출처: [Isometric City - Starter Pack](https://buggystudio.itch.io/isometric-city-starter-pack) by Buggy Studio (`assets/Isometric City/`)

- 라이선스: CC0. 제작자가 itch.io 페이지 댓글에서 "They are CC0. You are free to use on any personal or commercial project."라고 밝혔습니다(페이지 본문에는 별도 라이선스 표기 없음).
- 건물 이미지와 별도로 `assets/wall-mask-buildings/`의 PNG 마스크를 사용해 벽면을 착색합니다. 파일명과 착색 영역 기준은 [벽면 마스크 설명](assets/wall-mask-buildings/README.md)을 참고합니다.


## 기능과 사용법

카테고리 순서는 행을 직접 위아래로 끌어 바꿉니다. 손잡이는 표시하지 않으며 색상·수정·삭제 버튼에서는 드래그를 시작하지 않습니다. 끄는 행은 흰 배경과 그림자로 떠오르고, 다른 행은 자리를 비켜 줍니다. 놓으면 0.32초 동안 튕기며 정착하고 저장합니다. Escape로 이동을 취소할 수 있으며, 기존 Alt+위/아래 키보드 정렬도 사용할 수 있습니다.

메인 화면은 `homepage/homepage.html`이며 Chrome 새 탭에 표시됩니다. 카테고리별로 구역과 건물 색상을 구분하고 사이트 방문 횟수에 따라 건물의 성장 단계를 표시합니다.

- 화면 디자인과 명세: [Figma](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk?node-id=2002-38)
- 저장소가 없는 최초 실행에서만 시연 데이터를 넣고 기존 데이터는 보존합니다.
- 카테고리 목록 위의 검색창은 건물명 전체에서 검색하고, 도메인도 보조 검색합니다. `etl` → `서울대학교 new eTL`, `서울 etl` 또는 `etl 서울`, `ㅅㅇㄷ` → `서울대학교`, `GoogleDrive` → `Google Drive`처럼 찾을 수 있습니다. 대소문자·전각 문자·연속 공백 차이를 허용하고 `C++`·`C#` 같은 특수기호는 유지합니다. 모든 검색 단어가 포함된 결과만 보여주며 제목 일치를 우선합니다. 결과의 카테고리·도메인과 일치 부분을 표시하고 50개씩 더 볼 수 있습니다. 위·아래 방향키로 결과를 이동하고 Enter로 상세 카드를 선택합니다. Esc로 검색을 지우며 한글 조합 중에는 조합을 보호합니다. 카테고리 이름을 누르면 지도에서 강조되고 그 카테고리의 건물 목록이 펼쳐집니다. 건물명에 마우스를 올리면 지도 건물이 강조되고, 누르면 상세 카드가 고정됩니다(같은 건물명 다시 클릭, 다른 건물명·카테고리명·빈 지도 클릭, 카드에 들어갔다 나가면 해제). 건물 행의 드래그 손잡이(⠿)나 행을 끌어 순서를 바꾸고, 손잡이에서 위·아래 방향키로도 옮깁니다. 건물 행을 다른 카테고리 줄에 놓으면 그 카테고리로 옮겨집니다(Esc로 취소). 건물이 10개를 넘으면 목록 안에서 스크롤합니다.
- 카테고리 행을 다른 카테고리 행의 가운데에 끌어 놓으면 그 카테고리에 병합되어 북마크가 옮겨지고 영역이 하나로 합쳐집니다(행 사이에 놓으면 순서 변경). 카테고리 일반은 이동·수정·삭제·병합할 수 없고, 연필·휴지통 버튼은 보이지만 눌러도 동작하지 않습니다.
- 카테고리 목록 패널은 내용 높이에 맞춰 줄어들고 최대 956px이며, 넘치면 목록 영역만 스크롤합니다(검색창은 고정).
- 카테고리 목록의 +로 생성, 연필이나 색상 막대를 누르면 이름 수정 칸과 색상 선택기가 함께 열리고, 확인으로 저장하거나 취소로 닫습니다. 휴지통으로 삭제합니다. 카테고리 일반은 색상 막대로 색상만 바꿉니다. 목록을 드래그하거나 이름 버튼에서 Alt+위/아래 방향키로 순서를 바꿉니다. 삭제 확인 시 포함된 북마크도 삭제됩니다.
- 북마크 이름과 메모는 모든 언어·기호를 허용하고 글자 수 제한 없이 저장합니다. 이름은 빈 값만 금지합니다. 카테고리 이름도 모든 언어·특수기호·이모지를 허용하며, 10자 이내·빈 값 및 중복 금지 규칙을 적용합니다.
- 저장 팝업은 374×600 크기이며 내용을 세로로 스크롤합니다. 카테고리 목록에 색상 칩을 표시하고, 새 카테고리는 “일반”과 임의 색상으로 시작합니다. 색상·HEX와 건물 디자인을 고른 뒤 하단의 저장하기를 누르면 페이지 이름·메모와 함께 저장됩니다. 선택한 건물은 새 탭에서 카테고리 색상으로 표시되며 기존 성장·파손 규칙을 따릅니다.
- 새로 추가한 북마크는 홈페이지에서 NEW 말풍선과 빨간 외곽선으로 표시되고, 호버·포커스하거나 화면을 본 뒤 다른 탭으로 나갔다 돌아오면 해제됩니다.
- 지도 라벨·건물 설명 카드·카테고리 건물 목록에는 저장할 때 선택한 대표 이모지 또는 사이트 아이콘을 표시합니다. 사이트 아이콘을 불러올 수 없으면 지도는 지구본, 설명 카드와 목록은 확장 프로그램 아이콘을 표시합니다.
- 건물 설명 카드에서 메모를 입력하면 즉시 저장됩니다. 수정 버튼에서 페이지 이름·URL·카테고리·건물 디자인을 바꿉니다. 건물 디자인은 선택 즉시 지도에 반영되며 **취소하기**를 누르면 원래 모습으로 돌아갑니다. **수정하기**는 편집한 내용을 저장하고, **Esc**로 닫으면 선택한 건물 디자인만 저장합니다. 삭제 버튼에서 확인 후 북마크를 지우고, 링크를 복사할 수 있습니다. 건물을 클릭하면 사이트로 이동하고 방문 횟수가 증가합니다.
- 우측 상단 앱 버튼으로 Google 서비스 바로가기를 접고 펼칩니다. Google Service 제목 옆 연필 버튼으로 편집 상태에 들어가 **추가 앱**을 런처 칸으로 끌어다 놓으면 그 자리에 들어가고 마지막 앱이 빠집니다(항상 9개). 체크는 저장, X는 취소입니다.
- 지도 위에서 트랙패드 핀치로 확대·축소하고 두 손가락 스크롤로 이동합니다. 마우스는 휠로 확대·축소하고 가운데 버튼을 누른 채 드래그해 이동합니다. 확대 중심은 포인터 위치입니다. 사이드바·설정·상세 카드의 스크롤은 그대로 사용합니다. 카메라 위치는 현재 탭에서 유지하며 새로고침하면 도시 전체 맞춤으로 돌아옵니다. 트랙패드와 고해상도 휠은 브라우저가 장치를 구분하지 않아 델타 패턴으로 판별합니다.
- 카테고리와 건물은 자동 배치합니다. 건물·구역 수동 이동과 캘린더 연동은 지원하지 않습니다.
- 수업 공지·팀 과제 안내는 시연용 `example.com` 주소입니다.

웹에서 화면만 확인하려면 저장소 폴더에서 `python3 -m http.server 8766 --bind 127.0.0.1`을 실행한 뒤 `http://127.0.0.1:8766/homepage/homepage.html`에 접속합니다. 웹 미리보기의 저장소는 확장프로그램과 별개입니다. 현재 탭 URL을 가져오는 실제 저장 팝업은 확장프로그램에서 사용합니다.

### 홈페이지 설정

왼쪽 위 톱니바퀴로 설정 창을 엽니다. 설정은 변경하는 즉시 반영됩니다. **설정 취소**를 누르면 이번에 바꾼 설정을 창을 열기 전 값으로 복원합니다. **설정 저장**·Esc·바깥 클릭으로 닫으면 변경을 유지합니다.

- 지도 장식 밀도: 적게(빈칸의 약 35%)·보통(약 65%, 기본값)·많이(100%)로 기존 장식 밀도를 조절합니다.
- 빈 공간 채우기: 사용 안 함, 단색·그라데이션, 사진 업로드, 타일 패턴(기본값)을 선택합니다. 단색과 그라데이션 색상·각도, JPG/PNG/WEBP 사진을 편집하고 저장할 수 있습니다. 큰 사진은 긴 변 2560px·인코딩 결과 1MiB 이내로 자동 압축하며 작은 사진은 원본을 유지합니다. **현재는 설정 창 미리보기와 저장만 제공하며 지도 배경은 바뀌지 않습니다.**
- 도시 애니메이션: 기본 켜짐. 끄면 사람·차량·헬리콥터의 이동과 애니메이션을 멈춥니다. OS의 움직임 줄이기 설정이 켜져 있으면 도시 애니메이션도 정지합니다.
- 새 탭에서 열기: 기본 켜짐. 끄면 일반 건물 클릭으로 현재 탭에서 방문합니다. Ctrl/⌘ 클릭과 가운데 클릭 등은 브라우저 기본 동작을 따릅니다.
- 크롬 북마크 동기화: 기존 왼쪽 아래 전용 버튼을 없애고 설정 창으로 옮겼습니다. 누르면 즉시 가져오며 설정 취소로 가져온 북마크를 되돌리지는 않습니다.
- 전체 초기화: 확인 창의 **초기화하기**를 눌러야 북마크·카테고리·지도 배치·설정을 지웁니다. 빈 도시와 기본 카테고리 하나로 시작하며 시연 데이터가 다시 생기지 않습니다. 크롬 원본 북마크는 지우지 않습니다.

설정 아이콘 `assets/ui/settings*.svg` 7개는 [Figma 설정 창 명세](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk/?node-id=6441-8272)에서 가져왔습니다. 버튼은 [카테고리 화면 명세](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk/?node-id=6795-62839)대로 오른쪽 위 Google 바로가기의 맨 끝(9개 점 버튼 오른쪽)에 둡니다.

### 디버그 옵션

위 로컬 서버를 실행한 뒤 `http://127.0.0.1:8766/debug/`를 열고 **전체 건물 색상 테스트**를 선택합니다. 사용 중인 건물과 공사 에셋의 벽면 마스크·색상·명도를 비교하는 도구입니다. 표시 방식을 **마스크 강조**로 바꾸면 선택된 벽면만 분홍색으로 표시하고, **원본**에서는 착색을 끕니다. 입력한 색상은 저장하지 않습니다.

각 건물 카드의 **마스크 편집**을 누르면 원본 위에서 픽셀을 칠하거나 지울 수 있습니다. 픽셀 선택 도구로 칠하지 않고 위치를 고른 뒤 불투명도를 복사할 수 있으며, 원본 보기·확대·격자·실행 취소·다시 실행도 지원합니다. 수정 결과는 카드에 바로 반영되며, 세션에서 변경된 마스크가 있는 카드에는 표시가 나타납니다. 목록의 건물 크기 조절로 미리보기 크기를 바꿀 수 있습니다. 편집 영역에서 방향키로 픽셀을 선택하고 `Space`로 칠하거나 `Delete`로 지웁니다. `Space`를 누른 채 방향키로 이동하면 이어서 칠합니다. `Q`·`W`·`E`로 마우스 도구를 바꾸고, `1`~`9`와 `0`으로 칠하기 불투명도를 10~100%로 설정합니다. `O`는 원본 보기, `I`는 선택한 불투명도 복사, `+`/`−`는 확대·축소입니다. 실행 취소는 Ctrl/⌘+Z, 다시 실행은 Ctrl/⌘+Shift+Z 또는 Ctrl+Y입니다. 편집창의 전체 보기 크기도 조절할 수 있습니다.

**완료**를 누르면 편집창이 닫히고 변경 내용은 현재 탭 세션에 유지되어 새로고침 후에도 복원됩니다. 탭 세션이 끝나면 사라지므로 필요한 파일을 다운로드하세요. **이 파일만 저장**으로 현재 마스크를 PNG로 저장하거나, 목록의 **변경된 파일 모두 다운로드**와 **전체 파일 다운로드**로 각각 변경된 마스크 또는 목록에 있는 66개의 마스크를 ZIP으로 받을 수 있습니다. 다운로드한 PNG를 `assets/wall-mask-buildings/`의 같은 이름으로 교체해야 앱에 반영됩니다.

### 건물과 색상

건물은 `assets/Isometric City/Buildings/`의 5개 계열을 사용합니다. 저장할 때 선택한 디자인을 적용하며, 선택값이 없는 북마크는 ID 해시로 계열과 방향을 정합니다. 사용·미사용 에셋과 파일명 규칙은 [건물 계열 목록](BUILDING_FAMILIES.md)을 참고합니다.

새 북마크는 1단계, 방문 5회부터 2단계, 15회부터 3단계입니다. 같은 북마크는 성장해도 계열과 방향을 유지합니다. 건물은 에셋의 원본 픽셀 크기로 그립니다.

지도에서 일주일(7일) 동안 방문하지 않은 건물은 파손된 모습(`_damaged` 에셋)으로 바뀝니다. 한 번도 방문하지 않은 북마크는 저장한 시각부터 셉니다. 건물을 클릭해 방문하면 바로 원래 모습으로 돌아옵니다. 공사 중 이미지는 사용하지 않습니다.

카테고리 색상 변경은 목록의 색상 표시, 구역 강조 영역, 건물 벽, 잔디 색에 바로 반영됩니다. 착색 영역은 [벽면 마스크 설명](assets/wall-mask-buildings/README.md), 색상 보정과 저장 데이터 호환성은 [ARCHITECTURE.md](ARCHITECTURE.md)를 참고합니다.

### UI 확인 순서

1. 확장프로그램을 새로고침하고 새 탭을 엽니다.
2. 카테고리를 추가하고 이름 변경·색상 변경·순서 이동 후 새 탭에서도 유지되는지 확인합니다.
3. 일반 http/https 페이지에서 확장 팝업을 열고 이름·카테고리를 입력한 후 저장합니다.
4. 새 탭에서 해당 카테고리의 NEW 건물에 호버하고 메모 입력·링크 복사·수정 창을 확인합니다.
5. 수정 창에서 카테고리를 바꾸면 건물이 이동하고, 페이지 새로고침 후에도 메모와 수정 내용이 유지됩니다.
6. 테스트용 카테고리의 삭제 창에서 취소와 최종 삭제를 각각 확인합니다.

UI 아이콘(NEW 말풍선 꼬리 포함)의 디자인 원본은 위 Figma 화면 명세입니다. Google 서비스 아이콘은 `assets/ui/google/`의 개별 PNG이며 출처는 아래와 같습니다.

저장 팝업의 **아이콘** 버튼에서 이모지를 검색·선택하거나 **사이트 아이콘 사용**으로 돌아갈 수 있습니다. 선택은 **저장하기**를 누를 때 북마크에 저장됩니다. 이모지 목록은 [Unicode Emoji 17.0](https://unicode.org/Public/17.0.0/emoji/emoji-test.txt), 한국어 이름은 [Unicode CLDR 48](https://github.com/unicode-org/cldr/tree/release-48/common/annotations)에서 가져왔으며 라이선스는 `shared/emoji-LICENSE.txt`에 있습니다. 기본 피부색의 표준 이모지를 제공하며 최근 사용 목록은 팝업을 닫으면 초기화됩니다.

홈페이지의 북마크 수정 창에서도 상단 아이콘 선택 행으로 같은 선택기를 열 수 있습니다. 선택한 이모지는 입력 행에 즉시 표시하고 **수정하기**를 누르면 지도·호버 카드·건물 목록에 반영합니다. **취소하기**로 닫으면 아이콘 변경을 저장하지 않으며, 선택기가 열린 상태의 Esc는 선택기만 닫습니다.

북마크 수정 창의 **＋ 새 카테고리 만들기**에서 이름을 입력하면 **수정하기**를 누를 때 카테고리를 생성하고 해당 북마크를 옮깁니다. **기존 카테고리 선택**으로 돌아가거나 **취소하기**로 닫으면 새 카테고리는 만들지 않습니다. 입력 중인 페이지 이름·URL·아이콘·건물 디자인은 카테고리 입력 모드를 바꿔도 유지됩니다. 이 기능은 웹 미리보기에서도 동작합니다.

`assets/ui/emoji-*.svg` 11개는 [Figma 팝업·이모지 선택기 명세](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk/?node-id=6723-62151)의 분류·검색·화살표 아이콘입니다.

### Google 서비스 아이콘 출처

- `search.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/googleg_96dp.png)
- `maps.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/maps_96dp.png)
- `play.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/play_prism_48dp.png)
- `news.png`: [Google 공식 이미지](https://www.gstatic.com/gnews/logo/google_news_192.png)
- `gmail.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png)
- `drive.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png)
- `meet.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png)
- `contacts.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/contacts_2022_48dp.png)
- `youtube.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/youtube_48dp.png)
- `gemini.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/gemini_48dp.png)
- `calendar.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/calendar_2020q4_48dp.png)
- `photos.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/photos_48dp.png)
- `translate.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/translate_48dp.png)
- `vids.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/vids_48dp.png)
- `sheets.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/sheets_2020q4_48dp.png)
- `docs.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/docs_2020q4_48dp.png)
- `slides.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/slides_2020q4_48dp.png)
- `one.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/one_48dp.png)
- `shopping.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/shopping_48dp.png)
- `store.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/gstore_48dp.png)
- `finance.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/finance_48dp.png)
- `keep.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/keep_2020q4_48dp.png)
- `ad-center.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/my_ad_center_48dp.png)
- `classroom.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/classroom_48dp.png)
- `chat.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/chat_2023q4_48dp.png)
- `earth.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/earth_48dp.png)

런처 편집의 체크·취소 아이콘 `assets/ui/check.svg`, `cancel.svg`(20×20px)는 [Figma 구글런처 편집 명세](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk/?node-id=6900-72696)에서 가져왔습니다.

Google 계정 표시는 인증된 계정 정보를 입력받으며 인증·로그인 처리는 포함하지 않습니다. 연결 방법은 [ARCHITECTURE.md의 Google 계정 표시 연결](ARCHITECTURE.md#google-계정-표시-연결)을 참고합니다.
