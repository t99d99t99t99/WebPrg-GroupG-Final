# daisyUI 스타일 미리보기

실제 확장 프로그램 코드와 분리된 daisyUI 컴포넌트 확인용 작업 공간입니다.

## 설치 및 실행

Node.js와 Python 3가 필요합니다. 설치 직후 명령을 찾지 못하면 터미널을 다시 엽니다.

Windows PowerShell에서는 저장소 루트에서 다음을 실행합니다. `npm.cmd`는 PowerShell의 스크립트 실행 정책을 바꾸지 않고 npm을 실행합니다.

```powershell
cd ui-preview
npm.cmd ci
npm.cmd run build
py -m http.server 8767 --bind 127.0.0.1
```

브라우저에서 `http://127.0.0.1:8767/preview.html`을 엽니다. macOS/Linux에서는 `npm.cmd` 대신 `npm`, `py` 대신 `python3`를 사용합니다.

CSS를 수정하면서 자동으로 다시 빌드하려면 별도 터미널에서 다음을 실행합니다.

```powershell
cd ui-preview
npm.cmd run watch
```

원본 CSS나 샘플 HTML을 저장하면 CSS가 다시 생성됩니다. 브라우저는 직접 새로고침합니다. 각 명령은 `Ctrl+C`로 종료합니다.

## 수정 위치

- [src/theme.css](src/theme.css): Export한 `@plugin "daisyui/theme" { ... }` 블록을 붙여넣는 위치입니다. 현재는 빈 상태로 기본 `light`의 색상·둥글기·그림자를 유지합니다.
- [src/additional.css](src/additional.css): 테마 토큰과 분리해서 추가할 개별 스타일입니다.
- [preview.html](preview.html): 사용한 클래스가 드러나는 샘플 HTML입니다. 마우스를 올려 hover, `Tab`으로 focus, 비활성 버튼으로 disabled 상태를 확인합니다. 버튼은 실제 저장이나 이동을 실행하지 않습니다.
- [src/input.css](src/input.css): Tailwind, daisyUI 기본 light 테마, 위 두 CSS 파일을 연결합니다. 클래스 탐색은 샘플 HTML로 한정됩니다.
- [src/daisyui.css](src/daisyui.css): daisyUI 플러그인과 기본 light 테마 설정입니다. Export 테마와 분리하여 유지합니다.
- [dist/styles.css](dist/styles.css): 빌드 또는 감시 명령으로 생성하는 CSS입니다. 직접 수정하거나 커밋하지 않습니다.
- [biome.json](biome.json): 프로젝트 포맷 규칙을 상속하고, 이 폴더에서만 Tailwind CSS 문법 검사를 허용합니다.

테마를 붙여넣은 뒤에는 [preview.html](preview.html)의 `<html data-theme="light">`를 Export 블록의 `name`과 동일하게 바꿉니다. 예를 들어 `name: "mytheme";`이면 `data-theme="mytheme"`입니다. 기본 daisyUI 플러그인 설정은 [src/daisyui.css](src/daisyui.css)에 있으므로 Export할 때 지워지지 않습니다. [공식 테마 사용법](https://daisyui.com/docs/themes/)

## 전달 및 복원

팀원에게 전달할 원본은 [테마 CSS](src/theme.css), [추가 스타일 CSS](src/additional.css), [샘플 HTML](preview.html), 이 설명서입니다. 바로 재현하려면 설정과 잠금 파일을 포함한 이 폴더 전체를 전달합니다. 실제 화면 통합은 별도 작업입니다.

[package-lock.json](package-lock.json)으로 설치 버전을 보존합니다. 다른 환경에서도 `npm ci` 후 `npm run build`로 복원할 수 있습니다. `node_modules/`와 자동 생성되는 `dist/`는 Git에서 제외하며 원본 파일은 모두 보존합니다.

## 범위

이 폴더는 스타일 전달용 독립 작업 공간입니다. 실제 `homepage/`, `popup/`, `db/`, `manifest.json`, 공용 `style.css`와 연결되어 있지 않습니다.
