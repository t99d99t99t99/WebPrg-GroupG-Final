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
