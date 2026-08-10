# trending-newsletter

[GitHub Trending](https://github.com/trending) 을 한글로 정리해주는 뉴스레터.
각 레포의 README를 바탕으로 프로젝트의 핵심 기능, 실제 활용처, 도입 전 살펴볼 점을 상세하게 분석합니다.

- **Daily**: 평일 오전 9시 30분 → [Archive](https://github.com/devjh-jiki/trending-newsletter/tree/main/archive)
- **Weekly**: 매주 일요일 오전 9시 30분 → [Weekly Archive](https://github.com/devjh-jiki/trending-newsletter/tree/main/archive/weekly)

## 요약 결과

- `koDescription`: 원문 설명을 옮긴 짧은 핵심 설명
- `summary`: 프로젝트의 정체성, 해결 문제, 핵심 기능과 작동 방식
- `useCases`: 실제 적용 분야, 적합한 사용자와 문제 상황
- `considerations`: README에서 확인되는 제약과 도입 전 확인사항

GitHub Actions에서는 내장 `GITHUB_TOKEN`으로 공개 레포의 README를 조회합니다. 로컬에서는 선택적으로 `GITHUB_TOKEN`을 설정할 수 있으며, 토큰이 없으면 GitHub 공개 API를 사용합니다. README 조회가 실패하거나 README가 없는 레포는 GitHub Trending의 설명만으로 분석을 계속합니다.
