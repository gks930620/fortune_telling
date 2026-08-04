/**
 * assemble.js — 파이프라인 ④: AI 출력 검증·병합 (코드 단계)
 *
 * work/<날짜>/<type>.json (역할 AI 4종의 출력)을 스키마 검증하고,
 * 주기별로 병합해 docs/data/<주기>/<날짜>.json 과 docs/data/latest.json 을 만든다.
 * 한 타입이 불량이어도 나머지는 진행한다 (한 단계 실패 ≠ 전체 실패).
 *
 * 사용:  node scripts/assemble.js   (FORTUNE_DATE로 날짜 오버라이드 가능)
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Manse = require('./lib/manse');

const ROOT = path.join(__dirname, '..');

// 타입별 기대 버킷 키 — prompts/common.md 와 반드시 일치해야 한다
// 혈액형·MBTI는 2026-07-28에 제외했다 (운세로 보기 어렵다는 판단). 과거 날짜의 병합 결과에는
// 남아 있지만 사이트가 읽지 않는다.
const EXPECTED_KEYS = {
  tti: Manse.ZODIAC_IDS,
  saju: Manse.SAJU_STEM_IDS,
  zodiac: Manse.STAR_SIGNS.map(s => s.id),
  tarot: Manse.TAROT.map(t => t.id)
};
const TYPES = Object.keys(EXPECTED_KEYS);

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

/** 버킷 하나의 형태 검증 */
function validEntry(e) {
  return e && typeof e === 'object'
    && Number.isInteger(e.score) && e.score >= 1 && e.score <= 5
    && typeof e.keyword === 'string' && e.keyword.trim() !== ''
    && typeof e.text === 'string' && e.text.trim() !== ''
    && typeof e.advice === 'string' && e.advice.trim() !== '';
}

/** 한 타입의 한 주기 버킷 묶음 검증 — 키 완전성 + 각 항목 형태 */
function validateBuckets(type, period, buckets) {
  if (!buckets || typeof buckets !== 'object') return { ok: false, why: '버킷 없음' };
  const expected = EXPECTED_KEYS[type];
  const missing = expected.filter(k => !(k in buckets));
  if (missing.length) return { ok: false, why: `누락 키 ${missing.length}개: ${missing.slice(0, 5).join(',')}…` };
  const bad = expected.filter(k => !validEntry(buckets[k]));
  if (bad.length) return { ok: false, why: `불량 항목: ${bad.slice(0, 5).join(',')}` };
  const extra = Object.keys(buckets).filter(k => !expected.includes(k));
  if (extra.length) console.warn(`  [${type}/${period}] 예상 밖 키 무시: ${extra.join(',')}`);
  // 기대 키만 추려 순서대로 재구성 (extra 제거)
  const clean = {};
  for (const k of expected) clean[k] = buckets[k];
  return { ok: true, buckets: clean };
}

/**
 * docs/data/index.json — 주기별로 열람 가능한 날짜 목록 (최신 순).
 * 사이트의 주기 전환·과거 열람 UI가 이걸 읽는다. 정적 사이트라 디렉터리 목록을
 * 브라우저가 알 방법이 없으므로, 발행할 때마다 코드가 목록을 만들어 둔다.
 *
 * 무한히 쌓이면 파일이 커지므로 주기별 상한을 둔다. 상한을 넘긴 과거 데이터는
 * 파일로는 남아 있고(직접 URL로 접근 가능) 목록에서만 빠진다.
 */
const INDEX_LIMIT = { daily: 60, weekly: 26, monthly: 24, yearly: 10 };

function writeIndex() {
  const index = {};
  for (const period of Object.keys(INDEX_LIMIT)) {
    const dir = path.join(ROOT, 'docs', 'data', period);
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch (e) {
      continue;   // 아직 그 주기로 발행한 적이 없다
    }
    const dates = files
      .filter(f => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .map(f => f.replace(/\.json$/, ''))
      .sort()
      .reverse()
      .slice(0, INDEX_LIMIT[period]);
    if (dates.length) index[period] = dates;
  }
  fs.writeFileSync(
    path.join(ROOT, 'docs', 'data', 'index.json'),
    JSON.stringify(index) + '\n', 'utf8'
  );
  const summary = Object.entries(index).map(([p, d]) => `${p} ${d.length}`).join(' · ');
  console.log(`index.json 갱신: ${summary || '없음'}`);
}

function main() {
  const date = process.env.FORTUNE_DATE || Manse.kstToday();
  const workDir = path.join(ROOT, 'work', date);
  const context = readJSON(path.join(workDir, 'context.json'));
  if (!context) {
    console.error(`work/${date}/context.json 이 없습니다. 먼저 context.js를 실행하세요.`);
    process.exit(1);
  }

  // 사이트에 내려보낼 컨텍스트 요약 (프론트가 그대로 표시)
  const siteContext = {
    weekday: context.weekday,
    day_ganzhi: context.day_ganzhi,
    year_ganzhi: context.year_ganzhi,
    new_year_ganzhi: context.new_year_ganzhi,
    saju_relations: context.saju_relations,
    week_range: context.week_range
  };

  let anyWritten = false;

  for (const period of context.periods) {
    const merged = { date, period, context: siteContext, types: {}, generated_at: new Date().toISOString() };
    let count = 0;

    for (const type of TYPES) {
      const file = path.join(workDir, `${type}.json`);
      if (!fs.existsSync(file)) { console.warn(`  [${type}] 파일 없음 → 제외 (${period})`); continue; }
      const data = readJSON(file);
      if (!data || !data.periods) { console.warn(`  [${type}] JSON 파싱 실패/periods 없음 → 제외`); continue; }
      const result = validateBuckets(type, period, data.periods[period]);
      if (!result.ok) { console.warn(`  [${type}/${period}] 검증 실패: ${result.why} → 제외`); continue; }
      merged.types[type] = result.buckets;
      count++;
    }

    if (count === 0) {
      console.error(`::error::${period}: 유효한 운세 타입이 하나도 없습니다. 이 주기는 게시 생략.`);
      continue;
    }

    const outDir = path.join(ROOT, 'docs', 'data', period);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${date}.json`), JSON.stringify(merged) + '\n', 'utf8');
    console.log(`병합 완료: docs/data/${period}/${date}.json (${count}/${TYPES.length}종)`);
    anyWritten = true;

    // latest.json 갱신 (클라이언트 폴백 포인터) — 백필(과거 날짜 재생) 시 포인터가 역행하지 않게 최신 날짜만 반영
    const latestFile = path.join(ROOT, 'docs', 'data', 'latest.json');
    const latest = readJSON(latestFile) || {};
    const prevDate = latest[period] && latest[period].date;
    if (!prevDate || date >= prevDate) {
      latest[period] = { date };
      fs.writeFileSync(latestFile, JSON.stringify(latest, null, 2) + '\n', 'utf8');
    } else {
      console.log(`  latest.${period} 유지 (${prevDate}) — 백필 날짜 ${date}는 포인터 미갱신`);
    }
  }

  // 열람 목록 갱신 — 이번 실행으로 새로 생긴 날짜까지 반영된다
  writeIndex();

  // 만세력 모듈을 브라우저용으로 동기화 (단일 원본: scripts/lib/manse.js)
  const dst = path.join(ROOT, 'docs', 'assets', 'js', 'manse.js');
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(path.join(__dirname, 'lib', 'manse.js'), dst);
  console.log('manse.js → docs/assets/js/ 동기화 완료');

  // 부분 실패는 허용하지만, 전량 실패는 워크플로를 빨갛게 만들어 알아채게 한다
  if (!anyWritten) {
    console.error('::error::게시된 주기가 없습니다. 역할 AI 출력을 확인하세요.');
    process.exit(1);
  }
}

main();
