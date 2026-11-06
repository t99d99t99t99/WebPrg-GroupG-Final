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

## 코드 검사 (Biome)
커밋 전에 바꾼 파일의 포맷과 린트를 맞춥니다. PR을 올리면 GitHub에서 같은 검사가 자동으로 돕니다.
```bash
npx biome check --write <파일>   # 바꾼 파일만 고치기
npx biome ci .                   # 전체 검사 (GitHub에서 도는 것과 같음)
```
VS Code를 쓰면 Biome 확장을 설치해 저장할 때 자동으로 맞출 수 있습니다.

## 에셋 출처

3D 건물 에셋 출처: [Thridy](https://thridy.com/)

- [Building 3D Icon](https://thridy.com/building-3d-icon) by Thridy
- [Scandinavian Apartment Building 3D Icon](https://thridy.com/scandinavian-apartment-building-3d-icon) by Thridy
- [Home 3D Icon](https://thridy.com/home-3d-icon) by Thridy
- [Property 3D Icon](https://thridy.com/property-3d-icon) by Thridy
- [Apartment Building 3D Icon](https://thridy.com/apartment-building-3d-icon) by Thridy
- [Modern House 3D Icon](https://thridy.com/modern-house-3d-icon) by Thridy
- [Sanctuary 3D Icon](https://thridy.com/sanctuary-3d-icon) by Thridy
- [Villa 3D Icon](https://thridy.com/villa-3d-icon) by Thridy

아이소메트릭 도시 에셋 출처: [Isometric City - Starter Pack](https://buggystudio.itch.io/isometric-city-starter-pack) by Buggy Studio (`assets/Isometric City/`)

- 라이선스: CC0. 제작자가 itch.io 페이지 댓글에서 "They are CC0. You are free to use on any personal or commercial project."라고 밝혔습니다(페이지 본문에는 별도 라이선스 표기 없음).
- 지도 그리드 한 칸에 맞지 않는 256px 폭(2×2칸) 건물 이미지는 지웠습니다. 나머지 파일은 수정하지 않았습니다.


## 도시형 북마크 프로토타입

메인 화면은 `homepage/homepage.html`입니다. 기존과 같이 이 저장소 폴더를 Chrome 확장프로그램으로 로드합니다. 팝업과 확장 권한, 기존 저장 키 및 객체 필드는 유지합니다.

- Figma의 [프로토타입 페이지 및 Spec](https://www.figma.com/design/bYhdVsqxtoey19Ask9bn32?node-id=71-2)을 기준으로 지도와 건물 설명 카드를 구현했습니다.
- 저장소가 없는 최초 실행에서만 카테고리 4개·북마크 8개를 넣습니다. 기존 데이터가 있으면 빈 배열도 그대로 보존합니다.
- 기존 팝업으로 링크를 저장하면 지도와 개수가 갱신되고 기존 건물 위치는 유지됩니다. 새 탭에서도 같은 데이터와 배치를 표시합니다.
- 건물에 마우스를 올리거나 키보드로 포커스하면 이름·카테고리·링크 미리보기·메모 안내·링크 복사를 볼 수 있습니다. 미리보기는 로컬 건물 이미지와 페이지 이름·도메인으로 구성한 카드이며 사이트 스크린샷 수집 기능은 없습니다.
- 구역 색과 이름은 기본적으로 숨기고, 구역 접근 또는 카테고리 강조 시 표시합니다.
- 건물 이동·디자인 편집·카테고리 편집·캘린더 연동은 이번 범위에 포함하지 않습니다.
- 수업 공지·팀 과제 안내는 시연용 `example.com` 주소입니다.

웹에서 화면만 확인하려면 저장소 폴더에서 `python3 -m http.server 8766 --bind 127.0.0.1`을 실행한 뒤 `http://127.0.0.1:8766/homepage/homepage.html`에 접속합니다. 웹 미리보기의 저장소는 확장프로그램과 별개입니다. 현재 탭 URL을 가져오는 실제 저장 팝업은 확장프로그램에서 사용합니다.

추가 에셋: `assets/figma/*-zone.svg` 4개는 위 Figma 시안에서 내려받은 구역 도형입니다. 도형은 유지하고 접근성 제목을 추가했습니다. 건물은 기존 `assets/`의 이미지 8종을 그대로 사용하며 파일을 수정하지 않았습니다.
