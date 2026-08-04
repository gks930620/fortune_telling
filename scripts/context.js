/**
 * context.js — 파이프라인 ①: 실행 컨텍스트 생성 (코드 단계)
 *
 * KST 날짜를 기준으로 오늘의 일진(60갑자)·연간지·십성 관계를 계산하고,
 * 오늘 발행할 주기(daily/weekly/monthly/yearly)를 판정해
 * work/<날짜>/context.json 으로 스냅샷을 남긴다. AI는 이 파일을 읽고 해석만 한다.
 *
 * 사용:  node scripts/context.js
 * 재생:  FORTUNE_DATE=2026-01-01 node scripts/context.js   (백필·리플레이)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Manse = require('./lib/manse');

const ROOT = path.join(__dirname, '..');

/** 달력 연도 기준 간지 (입춘 무시) — 1월 1일 신년운세용. 1/1은 입춘 전이라 year_ganzhi가 아직 전년도 간지다. */
function calendarYearGanzhi(y) {
  const s = ((y - 4) % 10 + 10) % 10;
  const b = ((y - 4) % 12 + 12) % 12;
  return { name: Manse.STEMS[s] + Manse.BRANCHES[b] + '년', zodiac: Manse.ZODIAC_KO[b] + '띠', year: y };
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + n * 86400000);
  return t.getUTCFullYear() + '-' +
    String(t.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(t.getUTCDate()).padStart(2, '0');
}

/**
 * 최근 발행분에서 버킷별 keyword를 긁어온다 — "파일이 기억이다".
 *
 * 역할 AI는 매일 독립 세션이라 어제 자기가 뭐라고 썼는지 모른다. 그래서 매일 처음부터
 * 같은 고정관념을 다시 유도해냈다(황소자리=안정, 죽음 카드=손절 …). 이 값을 context에 실어
 * "이 단어들은 다시 쓰지 마라"고 지시하면 점수 고착과 키워드 반복이 함께 풀린다.
 *
 * 같은 주기끼리만 본다 — 주간운세의 '지난 회'는 지난주지 어제가 아니다.
 * 반환: { tti: { rat: ['재정비','신중모드'], … }, saju: {…}, … }  (없으면 빈 객체)
 */
function recentKeywords(period, beforeDate, count) {
  const dir = path.join(ROOT, 'docs', 'data', period);
  let files;
  try {
    files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  } catch (e) {
    return {};   // 첫 실행 — 아직 발행 이력이 없다
  }
  // 오늘 것은 제외한다 (재실행이면 이미 있을 수 있는데, 자기 자신을 피하라고 할 순 없다)
  const dates = files.map(f => f.replace(/\.json$/, ''))
    .filter(d => d < beforeDate)
    .sort()
    .slice(-count);

  const out = {};
  for (const d of dates) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(dir, `${d}.json`), 'utf8'));
    } catch (e) {
      continue;   // 깨진 과거 파일 하나 때문에 오늘 실행을 막지 않는다
    }
    for (const [type, buckets] of Object.entries(data.types || {})) {
      out[type] = out[type] || {};
      for (const [id, entry] of Object.entries(buckets)) {
        if (!entry || typeof entry.keyword !== 'string') continue;
        out[type][id] = out[type][id] || [];
        out[type][id].push(entry.keyword);
      }
    }
  }
  return out;
}

function main() {
  const date = process.env.FORTUNE_DATE || Manse.kstToday();
  const p = Manse.parseDate(date);
  if (!p) {
    console.error(`잘못된 날짜 형식: ${date} (YYYY-MM-DD 필요)`);
    process.exit(1);
  }

  const weekday = Manse.weekdayKo(p.y, p.m, p.d);
  const day = Manse.dayGanzhi(p.y, p.m, p.d);
  const year = Manse.yearGanzhi(p.y, p.m, p.d);

  // ---- 발행 주기 판정 (KST 날짜 기준) ----
  const periods = ['daily'];
  if (weekday === '월') periods.push('weekly');
  if (p.d === 1) periods.push('monthly');
  if (p.m === 1 && p.d === 1) periods.push('yearly');

  // ---- 주기별 부가 정보 ----
  const weekRange = weekday === '월' ? { start: date, end: addDays(date, 6) } : null;

  const context = {
    date,
    weekday,
    periods,
    // 오늘의 일진 — AI가 산수하지 않도록 전부 계산해서 준다
    day_ganzhi: {
      name: day.name + '일',
      stem: day.stem, branch: day.branch,
      stem_element: day.stemElement, branch_element: day.branchElement,
      yang: day.yang
    },
    year_ganzhi: { name: year.name + '년', zodiac: year.zodiacKo + '띠', effective_year: year.effectiveYear },
    // 신년운세(yearly)용 — 올해 달력 연도의 간지 (yearly가 발행되는 1/1은 입춘 전이라 위 year_ganzhi와 다르다)
    new_year_ganzhi: periods.includes('yearly') ? calendarYearGanzhi(p.y) : undefined,
    // 오늘의 일간이 각 일간(사주 버킷)에 갖는 십성 관계 — 사주 역할 AI의 해석 근거
    saju_relations: Manse.sipseongMap(day.stemIndex),
    // 오늘 일진의 지지가 12띠에 갖는 충·육합·삼합 — 띠 역할 AI의 해석 근거.
    // 예전엔 이걸 안 줘서 AI가 기억으로 추론했다(맞았지만 보증이 없었다).
    tti_relations: Manse.branchRelationMap(day.branchIndex),
    // 오늘 일진 오행이 12별자리 원소에 갖는 생·극 — 별자리 역할 AI의 해석 근거.
    // 이게 없어서 별자리만 매일 성격론을 되풀이했다(점수가 안 흔들렸다).
    zodiac_relations: Manse.starSignRelationMap(day.stemElement, day.branchElement),
    week_range: weekRange,
    month: date.slice(0, 7),
    year: p.y,
    // 주기별로 "최근 3회에 내가 쓴 키워드" — 역할 AI가 같은 말을 되풀이하지 않도록
    recent_keywords: Object.fromEntries(
      periods.map(period => [period, recentKeywords(period, date, 3)])
    ),
    generated_at: new Date().toISOString()
  };

  const dir = path.join(ROOT, 'work', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'context.json'), JSON.stringify(context, null, 2) + '\n', 'utf8');

  console.log(`context 생성 완료: work/${date}/context.json`);
  console.log(`  ${date} (${weekday}) · ${context.day_ganzhi.name} · ${context.year_ganzhi.name}`);
  console.log(`  발행 주기: ${periods.join(', ')}`);
  for (const period of periods) {
    const mem = context.recent_keywords[period];
    const types = Object.keys(mem);
    const n = types.reduce((a, t) => a + Object.keys(mem[t]).length, 0);
    console.log(`  최근 키워드(${period}): ${types.length}종 ${n}버킷` + (n ? '' : ' — 이력 없음(첫 발행)'));
  }

  // GitHub Actions 출력 (워크플로가 역할·집필 단계에 주입)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `date=${date}\nperiods=${periods.join(',')}\n`);
  }
}

main();
