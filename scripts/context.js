/**
 * context.js — 파이프라인 ①: 실행 컨텍스트 생성 (코드 단계)
 *
 * KST 날짜를 기준으로 오늘의 일진(60갑자)·연간지·십성 관계를 계산하고,
 * 오늘 발행할 주기(daily/weekly/monthly/yearly/holiday)를 판정해
 * work/<날짜>/context.json 으로 스냅샷을 남긴다. AI는 이 파일을 읽고 해석만 한다.
 *
 * 사용:  node scripts/context.js
 * 재생:  FORTUNE_DATE=2026-01-01 node scripts/context.js   (백필·리플레이)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Manse = require('./lib/manse');
const Holidays = require('./holidays');

const ROOT = path.join(__dirname, '..');

/** 달력 연도 기준 간지 (입춘 무시) — 1월 1일 신년운세용. 1/1은 입춘 전이라 year_ganzhi가 아직 전년도 간지다. */
function calendarYearGanzhi(y) {
  const s = ((y - 4) % 10 + 10) % 10;
  const b = ((y - 4) % 12 + 12) % 12;
  return { name: Manse.STEMS[s] + Manse.BRANCHES[b] + '년', zodiac: Manse.ZODIAC_KO[b] + '띠', year: y };
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

  const holidayBlock = Holidays.holidayBlockStarting(date);
  if (holidayBlock) periods.push('holiday');

  if (!Holidays.hasYear(p.y)) {
    console.warn(`::warning::공휴일 테이블에 ${p.y}년이 없습니다. scripts/holidays.js에 추가하세요. (연휴 특집 없이 진행)`);
  }

  // ---- 주기별 부가 정보 ----
  const weekRange = weekday === '월' ? { start: date, end: Holidays.addDays(date, 6) } : null;

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
    today_holiday: Holidays.holidayOn(date)?.name || null,
    holiday_block: holidayBlock
      ? { name: holidayBlock.name, start: holidayBlock.start, end: holidayBlock.end, days: holidayBlock.days }
      : null,
    next_holiday: (() => {
      const nb = Holidays.nextHolidayBlock(date, 14);
      return nb ? { name: nb.name, start: nb.start, end: nb.end, days: nb.days } : null;
    })(),
    week_range: weekRange,
    month: date.slice(0, 7),
    year: p.y,
    generated_at: new Date().toISOString()
  };

  const dir = path.join(ROOT, 'work', date);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'context.json'), JSON.stringify(context, null, 2) + '\n', 'utf8');

  console.log(`context 생성 완료: work/${date}/context.json`);
  console.log(`  ${date} (${weekday}) · ${context.day_ganzhi.name} · ${context.year_ganzhi.name}`);
  console.log(`  발행 주기: ${periods.join(', ')}${holidayBlock ? ` · 연휴 특집: ${holidayBlock.name}` : ''}`);

  // GitHub Actions 출력 (워크플로가 역할·집필 단계에 주입)
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `date=${date}\nperiods=${periods.join(',')}\n`);
  }
}

main();
