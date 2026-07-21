# 뉴스레터 구조 개편 + Weekly 추가 설계 (2026-07-21)

## 배경

- 현재 아카이브는 레포마다 "프론트엔드/개발자·창업자/PM·홍보/마케팅" 3관점을 강제로 붙인다.
  대부분의 레포는 특정 관점에서 억지스러운 문장이 나온다.
- daily만 있고 weekly가 없다.
- 괜찮은 도구를 발견해도 바로 PoC를 시작할 수 있는 안내가 없다.
- 부수 버그: Anthropic API 전환(fb35702) 이후 최근 아카이브(7/16~7/20)가 전부
  "(요약 파싱 실패)"로 저장되고 있다. `content[0].text`만 읽는 코드와
  `max_tokens: 512` 제한이 원인 후보.

## 결정 사항 (사용자 확인 완료)

1. **아카이브 구조**: 레포별 3관점 나열 제거. 레포마다 한 단락 정리 + Quick Start,
   상단에 "👥 직군별 추천" 섹션(직군 → 레포 리스트 + 이유 한 줄).
2. **Weekly**: 매주 일요일 09:30 KST, `SINCE=weekly`, `LIMIT=15`.
   저장 경로는 `archive/weekly/YYYY-MM-DD.md`로 분리.
3. **PoC 세팅**: 아카이브의 레포 섹션에 "⚡ 바로 써보기" 코드블록(설치·실행 명령 2~4줄)
   포함. LLM이 레포 성격을 보고 생성하고, 책/목록류처럼 PoC가 무의미한 레포는 생략.

## 변경 상세

### summarize.mjs

- `Summary` 타입 변경:
  - `koDescription`: 한글 번역 설명 (유지)
  - `overview`: 무엇인지/왜 떴는지/어디에 쓰면 좋은지 한 단락 (3~4문장)
  - `quickStart`: 설치·실행 셸 명령 (PoC 불가 레포는 빈 문자열)
  - `roles`: 적합 직군 id 배열 — `frontend | backend | founder | pm | marketing | data`
  - `recommendReason`: 해당 직군에 왜 좋은지 한 줄
- 시스템 프롬프트를 위 스키마로 교체.
- Anthropic 응답 파싱 버그 수정: 모든 `text` 타입 content 블록을 join해서 읽고,
  `max_tokens`를 1024로 상향. 파싱 실패 시 원문 일부를 로그로 남긴다.
- fallback/파싱 실패 객체도 새 스키마로 갱신.

### render.mjs

- 상단: 제목(주간이면 "GitHub Weekly Trending") → 📊 오늘의/이번 주 흐름 →
  👥 직군별 추천 → 레포 목록.
- 직군별 추천: 각 레포의 `roles`를 역집계. 직군마다
  `[repo](url) — recommendReason` 목록. 걸리는 레포 없는 직군은 생략.
- 레포 섹션: 제목/⭐ → `> koDescription` → overview 단락 →
  `**⚡ 바로 써보기**` + bash 코드블록(quickStart 있을 때만).

### index.mjs

- `SINCE=weekly`면 아카이브 경로를 `archive/weekly/`, 아카이브 링크도 동일하게 분기.
- 디스코드 embed: weekly면 제목에 📆 주간 표시. 링크 문구의 "3관점 요약"을
  "직군별 추천"으로 수정.

### .github/workflows/weekly.yml (신규)

- `cron: "30 0 * * 0"` (일요일 09:30 KST), `SINCE=weekly`, `LIMIT=15`.
- 나머지 단계는 daily.yml과 동일 (생성 → archive 커밋).

## 검증

- LLM 키 없이 `node src/index.mjs` 실행 → fallback 경로로 daily/weekly 아카이브가
  새 구조로 생성되는지 확인.
- Anthropic 파싱은 모의 응답(여러 content 블록, 코드펜스 포함)으로 단위 확인.

## 하지 않는 것

- 디스코드 발송 포맷 개편 (현행 유지, 링크 문구만 수정)
- 기존 아카이브 파일 소급 수정
