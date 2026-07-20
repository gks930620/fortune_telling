# 🔮 오늘의 운세

AI가 **매일 새벽 모든 경우의 수를 미리 생성**해 두는 정적 운세 사이트.
사용자가 생년월일·혈액형·MBTI를 입력하면 브라우저가 버킷(띠·일간·별자리)을 계산해
**이미 준비된 운세를 즉시** 보여준다. 요청 시 AI 호출은 0회.

전체 설계는 [기획서.md](기획서.md) 참고.

## 운세 6종 (하루 76버킷)

띠(12) · 사주 일간(10) · 별자리(12) · 타로 메이저 아르카나(22) · 혈액형(4) · MBTI(16)

## 발행 주기 (KST 05:30 단일 cron, 스크립트가 판정)

매일(daily) · 월요일(weekly) · 매월 1일(monthly) · 1월 1일(yearly)

## 파이프라인

```
context.js(계산) → 역할 AI 6명(운세 JSON) → assemble.js(검증·병합) → writer AI(리포트 md) → commit → Pages
```

- 날짜·일진(60갑자)·십성·주기 판정은 **코드**(`scripts/`), 해석·글은 **AI**(`prompts/`)
- 역할 AI 출력은 `work/<날짜>/`에 스냅샷으로 커밋 (검증 근거)
- 사이트는 `docs/` (Jekyll · GitHub Pages)

## 처음 설정 (1회)

1. GitHub 저장소 만들고 push
2. **Settings → Pages**: Deploy from a branch → `main` / `/docs`
3. 로컬에서 `claude setup-token` 실행 → 나온 토큰을
   **Settings → Secrets and variables → Actions** 에 `CLAUDE_CODE_OAUTH_TOKEN` 으로 등록
   (⚠️ API 키를 Secrets에 넣지 말 것 — 구독 대신 종량 과금돼 버린다)
4. **Actions 탭 → fortune → Run workflow** 로 수동 1회 실행해 검증

## 로컬 테스트

```sh
node scripts/context.js                        # 오늘 컨텍스트 생성
FORTUNE_DATE=2026-01-01 node scripts/context.js  # 특정 날짜 재생(신년 테스트·백필)
node scripts/assemble.js                       # work/<날짜>/*.json 검증·병합
```

정기 유지보수는 없다 — 발행 주기가 전부 날짜 계산만으로 판정되기 때문.
