# daisyUI 부품 모음

기존 [preview.html](preview.html) 한 페이지에서 daisyUI 컴포넌트를 비교하고 필요한 부품을 Figma 목업으로 가져가는 작업 공간입니다. 미리보기는 프로젝트 기능·데이터와 연결하지 않지만, 같은 테마와 설치 버전으로 실제 확장 프로그램용 정적 CSS도 생성합니다.

**daisyUI 5.7.50**과 `livingtaco` 테마를 사용합니다. UI 미리보기와 디버그 목록·건물 색상 테스트가 저장소에 포함된 [preview.generated.css](preview.generated.css)를 함께 참조하므로 페이지를 열 때 npm 설치나 CSS 빌드가 필요하지 않습니다.

## 열기

저장소 루트에서 다음 명령으로 로컬 서버를 실행합니다. Windows에서는 `python3` 대신 `py`를 사용합니다.

```bash
python3 -m http.server 8766 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8766/debug/`를 열고 **daisyUI 부품 모음**을 선택합니다. 미리보기만 볼 때는 의존성 설치가 필요하지 않습니다.

## CSS 수정과 빌드

스타일이나 부품을 수정해 생성 CSS를 갱신할 때만 Node.js와 npm 의존성이 필요합니다. Windows PowerShell에서는 저장소 루트에서 다음을 실행합니다. `npm.cmd`는 PowerShell 실행 정책을 바꾸지 않고 npm을 실행합니다. macOS/Linux에서는 `npm.cmd` 대신 `npm`을 사용합니다.

```powershell
cd debug/ui-preview
npm.cmd ci
npm.cmd run build
```

수정하면서 자동으로 다시 빌드하려면 `npm.cmd run watch`를 실행합니다. 원본 CSS나 샘플 HTML을 저장하면 미리보기 CSS가 생성되고, 브라우저는 직접 새로고침합니다. 감시는 `Ctrl+C`로 종료합니다. 변경된 `preview.generated.css`는 원본과 함께 반영합니다.

서비스 화면의 클래스나 테마를 수정했을 때는 `npm.cmd run build:app`으로 서비스 CSS를 다시 생성합니다. `npm.cmd run watch:app`은 서비스 CSS를 감시하고, `npm.cmd run build:all`은 미리보기와 서비스 CSS를 모두 생성합니다.

## 부품 구성과 상태 확인

| 종류 | 예제 |
|---|---|
| 버튼 | 주요 색상, 크기, 테두리형·부드러운 배경·고스트, 아이콘, 선택·비활성 |
| 입력 | 빈 값·긴 제목·오류·비활성, 검색창, 여러 줄 입력, 선택 상자 |
| 선택 | 체크박스, 라디오, 토글의 기본·선택·오류·비활성 |
| 표시 | 배지, 정보·성공·주의·오류 알림, 툴팁, 로딩 |
| 탐색 | 박스형·밑줄형 탭, 선택·비활성 메뉴, 닫힌·열린 드롭다운 |
| 콘텐츠 | 기본 카드, 긴 제목의 더미 북마크 카드, 기본·선택된 목록 행 |
| 오버레이 | 열린 모달과 토스트 |

- 각 부품 이름과 주요 실제 클래스는 샘플 바깥의 설명에 표시됩니다. 괄호 안 상태는 `checked`, `disabled` 같은 HTML 속성입니다.
- 마우스를 올려 hover, `Tab`으로 focus, 체크박스·라디오·토글·탭을 눌러 선택 상태를 확인합니다. 새로고침하면 초기 예시 상태로 돌아갑니다.
- 기본 드롭다운은 `<details>`로 열고 닫습니다. 별도의 열린 드롭다운·툴팁·모달·토스트 예제는 목업용으로 항상 표시합니다. 모달의 취소·저장 버튼도 고정된 모습이며 실제 기능은 실행하지 않습니다.
- 알림, 검색, 링크 이름, 주소는 모두 더미 내용이며 서버·저장소·외부 사이트와 연결하지 않습니다.

## 목업으로 가져올 때

- [preview.html](preview.html)에서 해당 종류의 `section`을 찾습니다. 부품 자체는 `.catalog-stage` 안에 있고 이름·클래스 설명은 바깥의 `figcaption`에 있습니다.
- 목업에 필요한 부품 영역만 가져오고 이름·클래스 설명과 페이지 탐색은 제외하면 됩니다. 이 페이지가 Figma로 자동 전송하거나 동기화하지는 않습니다.
- `.catalog-*`는 전시용 여백·배치 클래스입니다. 모달·토스트의 고정 위치, 드롭다운 위치와 모달의 전역 스크롤 잠금만 이 페이지에서 제한하여 다른 샘플을 가리지 않게 합니다. 실제 화면에 통합할 때 이 배치 보정은 분리합니다.
- 여러 부품에 공통 스타일을 바꾸려면 아래 원본 CSS를 수정합니다. 샘플별로 CSS를 복사하거나 `node_modules`를 수정하지 않습니다.

## 수정 위치

- [src/theme.css](src/theme.css): Export한 `@plugin "daisyui/theme" { ... }` 블록을 붙여넣는 위치입니다. 현재는 제공받은 `livingtaco` 테마의 색상·둥글기·그림자·노이즈 값을 그대로 사용합니다.
- [src/additional.css](src/additional.css): 테마 토큰과 분리해서 추가할 개별 스타일입니다. 기존 규칙 뒤의 `.catalog-*` 규칙은 부품 모음 전용 배치입니다.
- [preview.html](preview.html): **부품을 추가하는 파일**입니다. 해당 종류의 `.catalog-group`에서 `figure.catalog-sample`을 복사하고 이름·클래스 설명과 `.catalog-stage` 안의 부품을 함께 수정합니다. 클래스는 HTML에 그대로 적어 기존 빌드에서 탐색되게 합니다.
- [src/input.css](src/input.css): Tailwind, daisyUI 기본 light 테마, 위 두 CSS 파일을 연결합니다. UI 부품 모음과 디버그 목록·건물 색상 테스트 HTML의 클래스를 탐색합니다.
- [src/app.css](src/app.css): 실제 `homepage/`와 `popup/`의 클래스만 탐색해 서비스용 정적 CSS를 만드는 진입점입니다. 미리보기 전용 [src/additional.css](src/additional.css)는 불러오지 않습니다.
- [src/daisyui.css](src/daisyui.css): daisyUI 플러그인과 기본 light 테마 설정입니다. Export 테마와 분리하여 유지합니다.
- [preview.generated.css](preview.generated.css): 빌드 또는 감시 명령으로 생성하며 저장소에 포함하는 미리보기 CSS입니다. 직접 수정하지 않고 원본을 수정한 뒤 다시 생성합니다.
- [../../daisyui.generated.css](../../daisyui.generated.css): `build:app` 또는 `watch:app`으로 생성되며 실제 두 화면이 로드합니다. 직접 수정하지 않습니다.
- [biome.json](biome.json): 프로젝트 포맷 규칙을 상속하고, 이 폴더에서만 Tailwind CSS 문법 검사를 허용합니다.

테마를 붙여넣은 뒤에는 [preview.html](preview.html)의 `<html data-theme="livingtaco">`를 Export 블록의 `name`과 동일하게 바꿉니다. 예를 들어 `name: "mytheme";`이면 `data-theme="mytheme"`입니다. 현재 테마의 `default: false`는 그대로 유지하고 HTML에서 명시적으로 선택합니다. 기본 daisyUI 플러그인 설정은 [src/daisyui.css](src/daisyui.css)에 있으므로 Export할 때 지워지지 않습니다. [공식 테마 사용법](https://daisyui.com/docs/themes/)

## 전달 및 복원

팀원에게 전달할 원본은 [테마 CSS](src/theme.css), [추가 스타일 CSS](src/additional.css), [샘플 HTML](preview.html), 이 설명서입니다. 바로 재현하려면 설정과 잠금 파일을 포함한 이 폴더 전체를 전달합니다. 실제 화면에는 생성된 [../../daisyui.generated.css](../../daisyui.generated.css)와 각 HTML의 daisyUI 클래스가 적용됩니다.

[package-lock.json](package-lock.json)으로 설치 버전을 보존합니다. `preview.generated.css`는 다른 개발자가 설치 없이 열 수 있도록 원본과 함께 보관합니다. 원본이 바뀌면 `npm ci` 후 `npm run build`로 다시 생성합니다. `node_modules/`는 Git에서 제외합니다.

## 범위

이 폴더는 미리보기와 CSS 빌드 전용 작업 공간입니다. `homepage/`와 `popup/`의 정적 클래스를 읽어 서비스 번들을 만들지만, 프로젝트 기능·저장 데이터·`db/`·`manifest.json`에는 관여하지 않습니다.
