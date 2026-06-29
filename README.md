# trending-newsletter

[GitHub Trending](https://github.com/trending) 을 매일 수집해 **한글로 번역·요약**하고,
**3가지 관점**으로 정리해 뉴스레터로 전달하는 프로젝트입니다.

## 3가지 관점

1. **프론트엔드 개발자** — 실무에 쓸 도구/라이브러리/패턴
2. **프로덕트 창업자** — 제품 아이디어/시장 신호/비즈니스 모델
3. **기술 블로거·마케터** — 글감/트렌드/수익형 콘텐츠 소재

## 파이프라인

```
매일 cron
  → GitHub Trending 수집 (HTML 파싱 또는 비공식 API*)
  → 각 레포 README/설명 가져오기
  → LLM 으로 한글 번역 + 3관점 요약
  → Markdown 뉴스레터 생성 → archive/YYYY-MM-DD.md
  → 발송 (Resend / Buttondown 등) 또는 RSS
```

> *GitHub Trending 은 **공식 API/RSS 가 없습니다**. HTML 파싱 또는 비공식 API
> (예: `github-trending-api`) 를 사용해야 합니다.

## 구조

| 위치 | 설명 |
|------|------|
| [`src/fetch-trending.mjs`](./src/fetch-trending.mjs) | trending HTML 수집·파싱 (의존성 없음) |
| [`src/summarize.mjs`](./src/summarize.mjs) | LLM 한글 번역 + 3관점 요약 (키 없으면 fallback) |
| [`src/render.mjs`](./src/render.mjs) | 뉴스레터 Markdown 렌더링 |
| [`src/index.mjs`](./src/index.mjs) | 파이프라인 진입점 |
| [`archive/`](./archive) | 발행된 뉴스레터 아카이브 (Markdown) |
| `.github/workflows/daily.yml` | 매일 자동 실행 |

## 로컬 실행

```bash
# LLM 없이 수집·렌더만 검증 (요약은 "생략" 표시)
LIMIT=3 node src/index.mjs

# 사내 게이트웨이(OpenAI 호환)로 요약까지
LLM_BASE_URL=https://ai-api.hicare.net/v1 LLM_API_KEY=sk-... LLM_MODEL=claude-haiku-4-5 node src/index.mjs

# 공식 API fallback
ANTHROPIC_API_KEY=... node src/index.mjs
OPENAI_API_KEY=...    node src/index.mjs
```

### 환경변수 (우선순위 순)

| 변수 | 설명 |
|------|------|
| `LLM_BASE_URL` + `LLM_API_KEY` | **1순위**. OpenAI 호환 게이트웨이(사내 hicare 등) |
| `LLM_MODEL` | 게이트웨이 모델 (기본 `claude-haiku-4-5`) |
| `ANTHROPIC_API_KEY` | 2순위. Anthropic 공식 |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | 3순위. OpenAI 공식 (기본 `gpt-4o-mini`) |
| `SINCE` | `daily`/`weekly`/`monthly` (기본 daily) |
| `LANGUAGE` | 예: `typescript` (기본 전체) |
| `LIMIT` | 레포 개수 (기본 10) |

> 키가 하나도 없으면 LLM 요약을 건너뛰고 원문만 렌더합니다(파이프라인은 항상 동작).

## 자동 실행

`.github/workflows/daily.yml` 가 **평일(월~금) 오전 9시 KST** (`cron: 0 0 * * 1-5`) 에
자동 실행되어 뉴스레터를 생성하고 `archive/` 에 커밋합니다.

## 설정 (GitHub Actions Secrets / Variables)

커밋 금지. Settings → Secrets and variables → Actions 에 등록:

**Secrets**
- `LLM_API_KEY` — 사내 게이트웨이 토큰 (필수)
- `LLM_BASE_URL` — 예: `https://ai-api.hicare.net/v1` (필수)
- (선택) `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` — 게이트웨이 미사용 시 fallback

**Variables** (선택)
- `LLM_MODEL` — 기본 `claude-haiku-4-5`

> ⚠️ 사내 게이트웨이를 외부(GitHub Actions)에서 호출하므로, `ai-api.hicare.net` 이
> 외부 IP에서 접근 가능해야 하며 회사 정책상 허용되는지 확인하세요.

## 상태

🟢 수집→번역→렌더→아카이브 파이프라인 동작. 사내 게이트웨이 요약 로컬 검증 완료.

남은 것(선택):
- [ ] 이메일 발송(Resend/Buttondown) 연동
- [ ] `daily.yml` 의 `schedule` 주석 해제로 매일 자동 실행
- [ ] 각 레포 README 본문까지 가져와 더 깊은 요약 (현재는 trending 설명 기반)
