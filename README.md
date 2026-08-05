# 🔮 오늘의 운세

AI가 **매일 새벽 모든 경우의 수를 미리 생성**해 두는 정적 운세 사이트.
방문하면 **이미 준비된 운세를 즉시** 보여준다. 요청 시 AI 호출은 0회.

> ## ⏸️ 자동 실행 중단 중 (2026-08-05 ~)
>
> 토큰 사용량 조절을 위해 **새벽 자동 생성을 멈춰 두었다.** 사이트는 그대로 살아 있고,
> 마지막 발행분(2026-08-04)과 지난 운세를 계속 볼 수 있다.
>
> **재개 방법**: [.github/workflows/fortune.yml](.github/workflows/fortune.yml)의
> `schedule:` 두 줄에서 주석(`#`)만 걷어내고 커밋하면 끝이다.
>
> 중단 중에도 **수동 실행은 된다** — Actions 탭 → fortune → Run workflow.
> 한 번 돌릴 때 Claude 세션 5개(역할 4 + 집필 1)를 쓴다.

전체 설계는 [기획서.md](기획서.md), 현재 상태 점검은 [현황.md](현황.md) 참고.

## 운세 4종 (하루 56버킷)

| 운세 | 버킷 | 페이지 | 입력 |
|---|---|---|---|
| 사주 (일간) | 10 | `/saju.html` | **생년월일** |
| 띠 | 12 | `/tti.html` | 없음 (12띠 전체 + 출생연도) |
| 별자리 | 12 | `/zodiac.html` | 없음 (12별자리 전체 + 날짜 구간) |
| 타로 | 22 | `/tarot.html` | 카드 1장 선택 |

띠·별자리는 어차피 12개뿐이라 전체를 보여주고 자기 것을 찾게 한다.
사주만 계산이 개인 생년월일에 종속되므로 입력을 받는다(브라우저에만 저장).

> 혈액형·MBTI는 2026-07-28에 제외했다 — 운세라기보다 성격 유형론에 가깝다는 판단.

## 발행 주기 (KST 03:00 단일 cron, 스크립트가 판정)

매일(daily) · 월요일(weekly) · 매월 1일(monthly) · 1월 1일(yearly)

사이트에서는 주기를 탭으로 바꿔 볼 수 있고, `docs/data/index.json`에 실린 날짜만큼
**지난 운세도 거슬러 볼 수 있다**(daily 60일 · weekly 26주 · monthly 24개월 · yearly 10년).

## 파이프라인

```
context.js(계산) → 역할 AI 4명(운세 JSON) → assemble.js(검증·병합) → writer AI(리포트 md) → commit → Pages
```

- 날짜·일진(60갑자)·십성·**합충**·별자리 오행 관계·주기 판정은 **코드**(`scripts/`),
  해석·글은 **AI**(`prompts/`)
- `context.json`에 **최근 3회 각 버킷에 쓴 keyword**를 함께 실어 보낸다.
  역할 AI는 매일 독립 세션이라 어제를 모른다 — 이 필드가 그 기억이고,
  "같은 말을 반복하지 마라"의 근거가 된다.
- 역할 AI 출력은 `work/<날짜>/`에 스냅샷으로 커밋 (검증 근거).
  **과거 스냅샷은 고쳐 쓰지 않는다** — 그날 AI가 실제로 본 것의 기록이다.
- 사이트는 `docs/` (Jekyll · GitHub Pages)
- `assemble.js`가 `scripts/lib/manse.js`를 `docs/assets/js/`로 복사한다 —
  **docs 쪽 사본을 직접 수정하지 말 것** (서버·브라우저 계산이 갈라지는 것을 막는 장치)

## 처음 설정 (1회)

1. GitHub 저장소 만들고 push
2. **Settings → Pages**: Deploy from a branch → `main` / `/docs`
3. 로컬에서 `claude setup-token` 실행 → 나온 토큰을
   **Settings → Secrets and variables → Actions** 에 `CLAUDE_CODE_OAUTH_TOKEN` 으로 등록
   (⚠️ API 키를 Secrets에 넣지 말 것 — 구독 대신 종량 과금돼 버린다)
4. **Actions 탭 → fortune → Run workflow** 로 수동 1회 실행해 검증

## 로컬 테스트

```sh
node scripts/context.js                          # 오늘 컨텍스트 생성
FORTUNE_DATE=2026-01-01 node scripts/context.js  # 특정 날짜 재생(신년 테스트·백필)
node scripts/assemble.js                         # work/<날짜>/*.json 검증·병합
```

정기 유지보수는 없다 — 발행 주기가 전부 날짜 계산만으로 판정되기 때문.
