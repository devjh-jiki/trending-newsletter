# trending-newsletter

[GitHub Trending](https://github.com/trending) 을 한글로 정리해주는 뉴스레터.
각 레포의 README를 바탕으로 핵심 기능과 대표적인 활용 사례를 간결하게 정리합니다.

- **Daily**: 평일 오전 9시 30분 → [Archive](https://github.com/devjh-jiki/trending-newsletter/tree/main/archive)
- **Weekly**: 매주 일요일 오전 9시 30분 → [Weekly Archive](https://github.com/devjh-jiki/trending-newsletter/tree/main/archive/weekly)

## 요약 결과

- `koDescription`: 원문 설명을 옮긴 짧은 핵심 설명
- `summary`: 해결 문제, 핵심 기능, 차별점을 담은 짧은 문단
- `useCases`: `사용 주체 — 구체적인 활용 상황` 형식의 대표 사례 2~4개

Archive에서는 본문을 `🔎 핵심`과 `🎯 활용 사례` 헤더로 구분하고, 활용 사례를 불릿으로 표시합니다.

GitHub Actions에서는 내장 `GITHUB_TOKEN`으로 공개 레포의 README를 조회합니다. 로컬에서는 선택적으로 `GITHUB_TOKEN`을 설정할 수 있으며, 토큰이 없으면 GitHub 공개 API를 사용합니다. README 조회가 실패하거나 README가 없는 레포는 GitHub Trending의 설명만으로 분석을 계속합니다.
