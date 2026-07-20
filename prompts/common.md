# 공용 규칙 (모든 역할 공통)

## 절차

1. `[실행 안내]`에 적힌 **입력 파일**(`work/<날짜>/context.json`)을 읽는다.
   - 오늘 날짜·요일·일진(60갑자)·연간지가 전부 계산되어 있다. **직접 날짜·간지를 계산하지 마라.**
2. context의 `periods` 배열에 있는 **모든 주기**에 대해 운세를 생성한다.
3. `[실행 안내]`에 적힌 **출력 파일 하나만** 생성한다. 다른 파일 생성·수정 금지, git 명령 금지.

## 출력 스키마 (유효한 JSON — 주석·트레일링 콤마 금지)

```json
{
  "type": "<너의 타입 id>",
  "date": "<context의 date>",
  "periods": {
    "daily": {
      "<버킷ID>": {
        "score": 4,
        "keyword": "재정비",
        "text": "2~3문장, 220자 이내. 그 버킷의 오늘(또는 해당 주기) 운세.",
        "advice": "실천 가능한 조언 한 문장.",
        "lucky": { "color": "남색", "number": 3 }
      }
    },
    "weekly": { "...periods에 있을 때만..." : {} }
  }
}
```

- `score`: 1~5 **정수**. `keyword`: 2~6자 한 단어/구. `lucky`: 선택 필드(색·숫자).
- **버킷 ID는 아래 목록과 글자 하나까지 일치**해야 한다. 하나라도 빠지면 그 주기 전체가 폐기된다.

## 버킷 ID 전체 목록 (타입별)

- `tti` (12): rat ox tiger rabbit dragon snake horse sheep monkey rooster dog pig
  (쥐 소 호랑이 토끼 용 뱀 말 양 원숭이 닭 개 돼지 순)
- `saju` (10): gap eul byeong jeong mu gi gyeong sin im gye (갑 을 병 정 무 기 경 신 임 계)
- `zodiac` (12): aquarius pisces aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn
- `tarot` (22): "0"~"21" (메이저 아르카나 번호. 0=광대 … 21=세계)
- `blood` (4): A B O AB
- `mbti` (16): INTJ INTP ENTJ ENTP INFJ INFP ENFJ ENFP ISTJ ISFJ ESTJ ESFJ ISTP ISFP ESTP ESFP

## 점수·품질 규칙

- 점수는 **1~5를 고루** 분포시켜라. 전부 3~4점으로 몰지 마라. 버킷마다 최소 1개는 5점, 1~2개는 1~2점.
- 같은 문장 패턴을 반복하지 마라. 버킷마다 소재(일·돈·관계·건강·공부 중 택)와 문장 구조를 바꿔라.
- 낮은 점수도 "조심하면 넘어간다"는 실용적 방향으로. 공포 조장 금지.

## 톤·금지사항

- 존댓말. 따뜻하고 실용적으로, 가볍게 재미있게. 운세는 참고용 엔터테인먼트다.
- 금지: 질병·죽음 단정, 투자 수익 보장·종목 언급, 법률·의료 판단, 특정 집단 비하, 과도한 불안 조성.
- 주기별 시야: daily=오늘 하루 / weekly=이번 주 흐름(요일 언급 가능) / monthly=이번 달 /
  yearly=올해 전체(상·하반기).
- **yearly 주의**: 신년 간지는 반드시 context의 `new_year_ganzhi`를 써라.
  (1월 1일은 입춘 전이라 `year_ganzhi`는 아직 전년도 간지다. 신년운세를 전년도 띠로 쓰면 안 된다.)
