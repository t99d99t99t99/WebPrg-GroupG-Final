README.md의 초안입니다. 

## 프로젝트 구조 (추후 변경될 수 있음)
* `assets/`: 이미지 등 에셋 보관소
* `db/`: 브라우저 데이터 저장소
* `popup/`: 팝업 페이지(페이지 저장 버튼)의 내용
* `homepage/`: 크롬 초기 페이지의 내용
* `style.css`: 팝업 및 홈페이지의 공용 스타일. 요소 색상, 크기 등의 통일성을 위해 스타일은 이 파일에 저장하는 것을 우선하되, 팝업 또는 홈페이지 내부에서만 사용해야 하는 레이아웃은 해당 폴더 안의 별도 .css 파일에 저장합니다.

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

## 크롬에서 보기
1. 크롬 우측 상단 점 세개 버튼 누르기
2. "설정" 누르기
3. 좌측 사이드바에서 "확장 프로그램" 누르기
4. 우측 상단 "개발자 모드" 버튼 누르기
5. "압축해제된 확장 프로그램 로드" 버튼 누르기
6. 본 프로젝트의 폴더를 불러오기

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