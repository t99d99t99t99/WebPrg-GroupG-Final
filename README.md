README.md의 초안입니다. 

## 문서
* [PROJECT.md](PROJECT.md): 기획 (노션에서 생성, 직접 수정 금지)
* [ARCHITECTURE.md](ARCHITECTURE.md): 프로젝트 구조, 데이터 구조
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

## daisyUI 스타일 빌드와 미리보기

스타일 작업과 서비스용 daisyUI CSS 빌드는 별도 [daisyUI 미리보기 사용 설명](ui-preview/README.md)을 따릅니다. 의존성은 `ui-preview/`에만 설치하고, 서비스 화면은 미리 생성한 루트의 `daisyui.generated.css`를 정적으로 불러옵니다.

```powershell
cd ui-preview
npm.cmd ci
npm.cmd run build:all
```

테마 또는 서비스 HTML의 daisyUI 클래스를 바꾸면 `npm.cmd run build:app`으로 서비스 CSS를 다시 생성합니다. 미리보기는 기존 `npm.cmd run build`와 `npm.cmd run watch` 명령을 그대로 사용합니다.

## 코드 검사 (Biome)
커밋 전에 바꾼 파일의 포맷과 린트를 맞춥니다. PR을 올리면 GitHub에서 같은 검사가 자동으로 돕니다.
```bash
npx biome check --write <파일>   # 바꾼 파일만 고치기
npx biome ci .                   # 전체 검사 (GitHub에서 도는 것과 같음)
```
VS Code를 쓰면 Biome 확장을 설치해 저장할 때 자동으로 맞출 수 있습니다.

## 에셋 출처

아이소메트릭 도시 에셋 출처: [Isometric City - Starter Pack](https://buggystudio.itch.io/isometric-city-starter-pack) by Buggy Studio (`assets/Isometric City/`)

- 라이선스: CC0. 제작자가 itch.io 페이지 댓글에서 "They are CC0. You are free to use on any personal or commercial project."라고 밝혔습니다(페이지 본문에는 별도 라이선스 표기 없음).
- 지도 그리드 한 칸에 맞지 않는 256px 폭(2×2칸) 건물 이미지는 지웠습니다. 나머지 파일은 수정하지 않았습니다.


## 도시형 북마크 프로토타입

메인 화면은 `homepage/homepage.html`입니다. 기존과 같이 이 저장소 폴더를 Chrome 확장프로그램으로 로드합니다. 카테고리에 색상 필드(`color`)를 추가하고, 클릭 횟수에 따라 집 크기 텍스쳐를 표시합니다.

- Figma의 [완성 UI와 화면 명세](https://www.figma.com/design/AJUY7H7Zq3FM2nLZ9s7bKk?node-id=2002-38)를 기준으로 홈페이지의 메인 화면·설명 카드·수정 창을 구현했습니다. 저장 팝업은 기존 담당자 코드를 유지합니다.
- 저장소가 없는 최초 실행에서만 시연 데이터를 넣고 기존 데이터는 보존합니다.
- 카테고리 관리의 +로 생성, 연필로 이름 수정·삭제, 색상 막대로 색상을 변경합니다. 목록을 드래그하거나 이름 버튼에서 Alt+위/아래 방향키로 순서를 바꿉니다. 삭제 확인 시 포함된 북마크도 삭제됩니다.
- 북마크 이름은 최대 20자, 카테고리 이름은 최대 10자이며 한글·영문·숫자·공백을 허용합니다. 카테고리 이름 중복은 허용하지 않습니다.
- 기존 팝업으로 추가한 북마크는 홈페이지에서 NEW 말풍선과 빨간 외곽선으로 표시되고, 호버·포커스하거나 화면을 본 뒤 다른 탭으로 나갔다 돌아오면 해제됩니다.
- 건물 설명 카드에서 메모를 입력하면 즉시 저장됩니다. 수정 버튼에서 이름·카테고리·URL을 바꾸고 링크를 복사할 수 있습니다. 건물 클릭으로 링크를 방문하면 기존 성장 규칙이 적용됩니다.
- 홈페이지 호버 카드에서 북마크 URL을 iframe으로 직접 연결하여 미리보기를 표시합니다. 저장된 미리보기 이미지가 있으면 우선 표시합니다. 외부 삽입을 제한하는 사이트는 표시되지 않을 수 있어 원본 새 탭 링크를 함께 제공합니다. 팝업·로그인·권한 설정은 변경하지 않습니다.
- 우측 상단 앱 버튼으로 Google 서비스 바로가기를 접고 펼칩니다.
- 자동 도시 배치와 색상을 유지합니다. 건물·구역 수동 이동과 캘린더 연동은 포함하지 않습니다.
- 수업 공지·팀 과제 안내는 시연용 `example.com` 주소입니다.

웹에서 화면만 확인하려면 저장소 폴더에서 `python3 -m http.server 8766 --bind 127.0.0.1`을 실행한 뒤 `http://127.0.0.1:8766/homepage/homepage.html`에 접속합니다. 웹 미리보기의 저장소는 확장프로그램과 별개입니다. 현재 탭 URL을 가져오는 실제 저장 팝업은 확장프로그램에서 사용합니다.

건물은 `assets/Isometric City/Buildings/`의 정상 에셋 48종을 사용합니다. 카테고리마다 도심 주택·밝은 벽돌 주택·갈색 벽돌 주택·정원 주택·먹거리 상점·생활 상점 중 덜 쓰이는 계열을 배정하고 `buildingFamily`에 저장합니다. 처음 6개는 서로 다른 계열, 이후에는 적게 쓰인 계열을 재사용하며, 기존 배정은 카테고리 추가·삭제·정렬·색상 변경에도 유지합니다. 북마크를 다른 카테고리로 옮기면 이동한 카테고리의 계열을 따릅니다.

새 북마크는 1단계, 방문 5회부터 2단계, 15회부터 3단계입니다. 북마크 ID로 a/b와 단계별 세부 모양을 결정하므로 같은 북마크는 성장해도 a/b가 유지됩니다. 모든 단계는 동일한 128px 표시 폭을 사용하며, 방문 횟수에 따라 에셋만 교체합니다. 파손·공사 중 이미지는 사용하지 않습니다.

건물은 원본 에셋 색상을 유지합니다. 카테고리 색상 변경은 목록의 색상 표시와 구역 강조 테두리에만 반영하며 건물과 잔디는 착색하지 않습니다. 기존 `customColor` 저장 값과 벽면 마스크 파일은 호환성을 위해 보존하지만 홈페이지의 건물 렌더링에는 사용하지 않습니다.

### UI 확인 순서

1. 확장프로그램을 새로고침하고 새 탭을 엽니다.
2. 카테고리를 추가하고 이름 변경·색상 변경·순서 이동 후 새 탭에서도 유지되는지 확인합니다.
3. 일반 http/https 페이지에서 확장 팝업을 열고 이름·카테고리를 입력한 후 저장합니다.
4. 새 탭에서 해당 카테고리의 NEW 건물에 호버하고 메모 입력·링크 복사·수정 창을 확인합니다.
5. 수정 창에서 카테고리를 바꾸면 건물이 이동하고, 페이지 새로고침 후에도 메모와 수정 내용이 유지됩니다.
6. 테스트용 카테고리의 삭제 창에서 취소와 최종 삭제를 각각 확인합니다.

UI 아이콘(NEW 말풍선 꼬리 포함)은 팀이 제공한 Figma에서 내보냈습니다. 기존 `assets/ui/google-services.png`는 보존하지만 화면에서 사용하지 않습니다. 서비스 이름은 HTML 텍스트이고, 개별 아이콘은 아래 Google 공식 고해상도 PNG를 로컬 `assets/ui/google/`에 저장하여 사용합니다.

### Google 서비스 아이콘 출처

- `search.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/googleg_96dp.png)
- `maps.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/maps_96dp.png)
- `play.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/play_prism_48dp.png)
- `news.png`: [Google 공식 이미지](https://www.gstatic.com/gnews/logo/google_news_192.png)
- `gmail.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/gmail_2020q4_48dp.png)
- `drive.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/drive_2020q4_48dp.png)
- `meet.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/meet_2020q4_48dp.png)
- `contacts.png`: [Google 공식 이미지](https://www.gstatic.com/images/branding/product/2x/contacts_2022_48dp.png)

계정 사진은 인증된 사진 URL을 전달받아 표시할 UI만 준비되어 있습니다. 로그인과 권한 설정은 포함하지 않습니다. 연결 방법은 ARCHITECTURE.md의 Google 계정 표시 연결을 참고합니다.

모든 구역의 잔디는 원본 초록색으로 통일합니다. 카테고리 색을 변경해도 잔디는 변하지 않으며, 목록·구역 강조 테두리에만 색을 반영합니다.
