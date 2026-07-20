/**
 * holidays.js — 대한민국 공휴일 테이블 (대체공휴일 포함)
 *
 * ⚠️ 매년 12월, 다음 해 공휴일을 여기에 추가하는 것이 이 프로젝트의 유일한 정기 유지보수다.
 *    테이블에 없는 연도가 오면 context.js가 경고를 남기고 연휴 특집 없이 진행한다.
 *
 * 출처(2026·2027 검증): superkts.com/day/holiday, kholidayz.com, publicholidays.co.kr (2026-07 조회)
 * 규칙 메모: 신정·현충일은 대체공휴일 미적용. 설·추석 연휴는 일요일과 겹칠 때만 대체 발생.
 */
'use strict';

const HOLIDAYS = {
  2026: [
    { date: '2026-01-01', name: '신정' },
    { date: '2026-02-16', name: '설날 연휴', rep: '설날' },
    { date: '2026-02-17', name: '설날', rep: '설날' },
    { date: '2026-02-18', name: '설날 연휴', rep: '설날' },
    { date: '2026-03-01', name: '삼일절' },
    { date: '2026-03-02', name: '삼일절 대체공휴일', rep: '삼일절' },
    { date: '2026-05-05', name: '어린이날' },
    { date: '2026-05-24', name: '부처님오신날' },
    { date: '2026-05-25', name: '부처님오신날 대체공휴일', rep: '부처님오신날' },
    { date: '2026-06-06', name: '현충일' },
    // { date: '2026-07-17', name: '제헌절' }, // 공휴일 재지정 확정 시 주석 해제 (기획서 §10)
    { date: '2026-08-15', name: '광복절' },
    { date: '2026-08-17', name: '광복절 대체공휴일', rep: '광복절' },
    { date: '2026-09-24', name: '추석 연휴', rep: '추석' },
    { date: '2026-09-25', name: '추석', rep: '추석' },
    { date: '2026-09-26', name: '추석 연휴', rep: '추석' },
    { date: '2026-10-03', name: '개천절' },
    { date: '2026-10-05', name: '개천절 대체공휴일', rep: '개천절' },
    { date: '2026-10-09', name: '한글날' },
    { date: '2026-12-25', name: '성탄절' }
  ],
  2027: [
    { date: '2027-01-01', name: '신정' },
    { date: '2027-02-06', name: '설날 연휴', rep: '설날' },
    { date: '2027-02-07', name: '설날', rep: '설날' },
    { date: '2027-02-08', name: '설날 연휴', rep: '설날' },
    { date: '2027-02-09', name: '설날 대체공휴일', rep: '설날' },
    { date: '2027-03-01', name: '삼일절' },
    { date: '2027-05-05', name: '어린이날' },
    { date: '2027-05-13', name: '부처님오신날' },
    { date: '2027-06-06', name: '현충일' },
    { date: '2027-08-15', name: '광복절' },
    { date: '2027-08-16', name: '광복절 대체공휴일', rep: '광복절' },
    { date: '2027-09-14', name: '추석 연휴', rep: '추석' },
    { date: '2027-09-15', name: '추석', rep: '추석' },
    { date: '2027-09-16', name: '추석 연휴', rep: '추석' },
    { date: '2027-10-03', name: '개천절' },
    { date: '2027-10-04', name: '개천절 대체공휴일', rep: '개천절' },
    { date: '2027-10-09', name: '한글날' },
    { date: '2027-10-11', name: '한글날 대체공휴일', rep: '한글날' },
    { date: '2027-12-25', name: '성탄절' },
    { date: '2027-12-27', name: '성탄절 대체공휴일', rep: '성탄절' }
  ]
};

function toDays(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

function addDays(dateStr, n) {
  const t = new Date((toDays(dateStr) + n) * 86400000);
  return t.getUTCFullYear() + '-' +
    String(t.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(t.getUTCDate()).padStart(2, '0');
}

/** 해당 연도(±이웃 연도 경계 포함)의 공휴일을 연속 블록으로 묶는다. 간격 ≤2일(주말 낀 경우)은 한 연휴로 본다. */
function holidayBlocks(year) {
  const entries = [...(HOLIDAYS[year - 1] || []), ...(HOLIDAYS[year] || []), ...(HOLIDAYS[year + 1] || [])]
    .sort((a, b) => a.date.localeCompare(b.date));
  const blocks = [];
  for (const e of entries) {
    const last = blocks[blocks.length - 1];
    if (last && toDays(e.date) - toDays(last.end) <= 2) {
      last.end = e.date;
      last.entries.push(e);
    } else {
      blocks.push({ start: e.date, end: e.date, entries: [e] });
    }
  }
  for (const b of blocks) {
    // 대표 이름: '연휴'·'대체'가 아닌 본 공휴일 우선
    const main = b.entries.find(e => !/연휴|대체/.test(e.name)) || b.entries[0];
    b.name = main.rep || main.name;
    b.days = Math.round(toDays(b.end) - toDays(b.start)) + 1;
  }
  return blocks;
}

/** 오늘이 공휴일이면 그 항목을, 아니면 null */
function holidayOn(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  if (!HOLIDAYS[year]) return null;
  const list = HOLIDAYS[year];
  return list.find(e => e.date === dateStr) || null;
}

/** 오늘이 연휴 블록의 "첫날"이면 블록 정보를 반환 (연휴 특집은 첫날 한 번만 발행) */
function holidayBlockStarting(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  return holidayBlocks(year).find(b => b.start === dateStr) || null;
}

/** 오늘 이후 n일 내 시작하는 다음 연휴 블록 (리포트 맛내기용) */
function nextHolidayBlock(dateStr, withinDays) {
  const year = Number(dateStr.slice(0, 4));
  const limit = addDays(dateStr, withinDays);
  return holidayBlocks(year)
    .find(b => b.start > dateStr && b.start <= limit) || null;
}

function hasYear(year) { return Boolean(HOLIDAYS[year]); }

module.exports = { HOLIDAYS, holidayBlocks, holidayOn, holidayBlockStarting, nextHolidayBlock, hasYear, addDays };
