# 사용 중인 건물 계열

현재 지도에서 선택하는 계열은 아래 5개입니다. 기준 코드는 [homepage/building-rules.js](homepage/building-rules.js)의 `BUILDING_FAMILIES`입니다. 계열이나 단계별 건물을 바꾸면 이 문서도 함께 갱신합니다.

## 계열과 성장 단계

표 안의 이름은 건물 파일명에서 `bld_` 접두사와 방향·파손 접미사를 뺀 형태 이름입니다. 한 칸에 여러 형태가 있으면 북마크 ID 해시로 그중 하나를 선택합니다.

| 계열 이름 | 계열 ID | 1단계: 방문 0~4회 | 2단계: 방문 5~14회 | 3단계: 방문 15회 이상 | 정상 이미지 수 |
|---|---|---|---|---|---|
| 도심 주택 | `blue-homes` | `house_small_blue` | `house_medium_blue` | `house_tall_blue` | 6 |
| 밝은 벽돌 주택 | `light-brick-homes` | `house_small_brickred` | `house_medium_brickwhite` | `house_tall_brickwhite` | 6 |
| 정원 주택 | `garden-homes` | `house_small_yellow` | `house_medium_white` | `house_tall_green` | 6 |
| 먹거리 상점 | `food-market` | `fruitstand` | `cafe`, `icecream` | `pizza` | 8 |
| 생활 상점 | `service-market` | `clinic` | `autoshop` | `gunshop` | 6 |

총 16개 형태에 a/b 방향이 있어 정상 이미지 32개를 사용합니다. 각 이미지에 대응하는 파손 이미지까지 포함하면 지도에서 선택 가능한 이미지는 64개입니다. 상점도 같은 방문 횟수 기준으로 성장하며, 단계별 착색 보정 크기는 각각 `small`·`medium`·`tall`입니다.

## 통합·미사용 건물

벽면을 착색한 결과가 같거나 거의 같은 형태는 다음 대표 건물로 통합했습니다. 아래 미사용 형태의 a/b 방향과 정상·파손 이미지 모두 지도 선정 목록과 디버그 목록에서 제외합니다. 원본 이미지와 마스크 파일은 보존합니다.

| 구분 | 사용하는 대표 형태 | 사용하지 않는 형태 |
|---|---|---|
| 소형 주택 통합 | `house_small_blue` | `house_small_red`, `house_small_purple` |
| 중형 주택 통합 | `house_medium_blue` | `house_medium_green` |
| 대형 주택 통합 | `house_tall_blue` | `house_tall_brown`, `house_tall_purple` |

정원 주택에는 위 통합 대상 이외의 `house_small_yellow`·`house_medium_white`·`house_tall_green`만 남깁니다.

갈색 벽돌 주택(`warm-brick-homes`) 계열은 폐지했습니다. 해당 계열의 `house_small_brickbrown`·`house_medium_brown`·`house_tall_brickbrown`은 사용하지 않으며, `house_tall_brown`도 위 대형 주택 통합에 따라 사용하지 않습니다. 합계 8개 형태, a/b 및 파손을 포함한 이미지 32개가 미사용입니다.

## 선택과 파손 규칙

- 북마크 ID 해시로 계열·a/b 방향·단계별 형태를 결정합니다. 같은 카테고리 안에서도 여러 계열과 방향이 섞입니다.
- 같은 북마크는 방문 횟수가 늘어도 계열과 방향을 유지하고, 해당 계열의 다음 단계 건물로 바뀝니다.
- 마지막 방문부터 7일이 지나면 같은 형태와 방향의 파손 이미지로 바뀝니다. 방문 기록이 없으면 저장 시각을 기준으로 하며, 지도에서 방문하면 정상 이미지로 돌아옵니다.
- 이전에 카테고리에 저장된 `buildingFamily` 값은 보존하지만 현재 건물 선택에는 사용하지 않습니다.
- 파일명의 `blue`, `red` 등은 원본 에셋의 형태 이름입니다. 실제 벽 색은 카테고리 색으로 착색합니다.

## 이미지와 벽면 마스크 경로

건물 원본은 `assets/Isometric City/Buildings/`에 있으며 파일명은 다음 규칙을 따릅니다.

| 구분 | 파일명 규칙 | 예시 |
|---|---|---|
| 정상 | `bld_<형태>_<a 또는 b>.png` | `bld_house_small_blue_a.png` |
| 파손 | `bld_<형태>_<a 또는 b>_damaged.png` | `bld_house_small_blue_a_damaged.png` |
| 벽면 마스크 | `wall-mask-<건물 원본 파일명>` | `wall-mask-bld_house_small_blue_a.png` |

모든 벽면 마스크는 `assets/wall-mask-buildings/`에 있습니다. 홈페이지와 디버그 페이지가 같은 정적 PNG를 읽습니다. 착색 영역 기준은 [마스크 설명](assets/wall-mask-buildings/README.md)을 참고합니다.

`bld_contruction_a.png`와 `bld_construction_b.png`는 폴더에 있지만 지도에서는 선택하지 않는 공사 에셋입니다. [전체 건물 색상 테스트](debug/building-color-test.html)는 사용 중인 건물 64개와 공사 에셋 2개, 총 PNG 66개를 표시하며, 공사 에셋의 마스크는 투명합니다. 통합·폐지된 건물 32개는 표시하지 않습니다.
