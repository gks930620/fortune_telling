/**
 * manse.js — 만세력 계산 모듈 (Node + 브라우저 공용, 의존성 0)
 *
 * 이 파일이 "코드가 하는 계산"의 전부다. AI는 여기서 계산된 값을 해석만 한다.
 * assemble.js가 이 파일을 docs/assets/js/manse.js 로 복사해 브라우저와 로직을 일치시킨다.
 * (docs 쪽 사본을 직접 수정하지 말 것)
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) module.exports = factory();
  else root.Manse = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STEMS = ['갑', '을', '병', '정', '무', '기', '경', '신', '임', '계'];
  var BRANCHES = ['자', '축', '인', '묘', '진', '사', '오', '미', '신', '유', '술', '해'];
  var ELEMENTS = ['목', '화', '토', '금', '수'];
  // 천간 오행: 갑을=목 병정=화 무기=토 경신=금 임계=수
  var STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4];
  // 지지 오행: 자=수 축=토 인=목 묘=목 진=토 사=화 오=화 미=토 신=금 유=금 술=토 해=수
  var BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4];

  var SAJU_STEM_IDS = ['gap', 'eul', 'byeong', 'jeong', 'mu', 'gi', 'gyeong', 'sin', 'im', 'gye'];

  var ZODIAC_IDS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'];
  var ZODIAC_KO = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];

  // 한국 잡지 관례 날짜 구간 (경계일은 관례에 따라 ±1일 차이가 있을 수 있음)
  var STAR_SIGNS = [
    { id: 'aquarius',    ko: '물병자리',   from: [1, 20],  to: [2, 18] },
    { id: 'pisces',      ko: '물고기자리', from: [2, 19],  to: [3, 20] },
    { id: 'aries',       ko: '양자리',     from: [3, 21],  to: [4, 19] },
    { id: 'taurus',      ko: '황소자리',   from: [4, 20],  to: [5, 20] },
    { id: 'gemini',      ko: '쌍둥이자리', from: [5, 21],  to: [6, 21] },
    { id: 'cancer',      ko: '게자리',     from: [6, 22],  to: [7, 22] },
    { id: 'leo',         ko: '사자자리',   from: [7, 23],  to: [8, 22] },
    { id: 'virgo',       ko: '처녀자리',   from: [8, 23],  to: [9, 23] },
    { id: 'libra',       ko: '천칭자리',   from: [9, 24],  to: [10, 22] },
    { id: 'scorpio',     ko: '전갈자리',   from: [10, 23], to: [11, 22] },
    { id: 'sagittarius', ko: '사수자리',   from: [11, 23], to: [12, 24] },
    { id: 'capricorn',   ko: '염소자리',   from: [12, 25], to: [1, 19] }
  ];

  var TAROT = [
    { id: '0',  ko: '광대',           en: 'The Fool' },
    { id: '1',  ko: '마법사',         en: 'The Magician' },
    { id: '2',  ko: '여사제',         en: 'The High Priestess' },
    { id: '3',  ko: '여황제',         en: 'The Empress' },
    { id: '4',  ko: '황제',           en: 'The Emperor' },
    { id: '5',  ko: '교황',           en: 'The Hierophant' },
    { id: '6',  ko: '연인',           en: 'The Lovers' },
    { id: '7',  ko: '전차',           en: 'The Chariot' },
    { id: '8',  ko: '힘',             en: 'Strength' },
    { id: '9',  ko: '은둔자',         en: 'The Hermit' },
    { id: '10', ko: '운명의 수레바퀴', en: 'Wheel of Fortune' },
    { id: '11', ko: '정의',           en: 'Justice' },
    { id: '12', ko: '매달린 사람',    en: 'The Hanged Man' },
    { id: '13', ko: '죽음',           en: 'Death' },
    { id: '14', ko: '절제',           en: 'Temperance' },
    { id: '15', ko: '악마',           en: 'The Devil' },
    { id: '16', ko: '탑',             en: 'The Tower' },
    { id: '17', ko: '별',             en: 'The Star' },
    { id: '18', ko: '달',             en: 'The Moon' },
    { id: '19', ko: '태양',           en: 'The Sun' },
    { id: '20', ko: '심판',           en: 'Judgement' },
    { id: '21', ko: '세계',           en: 'The World' }
  ];

  var BLOOD_TYPES = ['A', 'B', 'O', 'AB'];
  var MBTI_TYPES = [
    'INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP',
    'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'
  ];

  var WEEKDAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

  // ---- 날짜 · 60갑자 ----------------------------------------------------

  // 기준: 2000-01-07 = 갑자일 (1900-01-01 = 갑술일로 교차 검증됨)
  var ANCHOR_DAYS = Date.UTC(2000, 0, 7) / 86400000;

  function daysUTC(y, m, d) { return Date.UTC(y, m - 1, d) / 86400000; }

  function mod(n, k) { return ((n % k) + k) % k; }

  /** 해당 날짜의 일주(60갑자) 인덱스 0~59. 0 = 갑자 */
  function dayGanzhiIndex(y, m, d) { return mod(daysUTC(y, m, d) - ANCHOR_DAYS, 60); }

  function ganzhiFromIndex(idx) {
    var s = idx % 10, b = idx % 12;
    return {
      index: idx,
      name: STEMS[s] + BRANCHES[b],
      stem: STEMS[s], branch: BRANCHES[b],
      stemIndex: s, branchIndex: b,
      stemElement: ELEMENTS[STEM_ELEMENT[s]],
      branchElement: ELEMENTS[BRANCH_ELEMENT[b]],
      yang: s % 2 === 0
    };
  }

  function dayGanzhi(y, m, d) { return ganzhiFromIndex(dayGanzhiIndex(y, m, d)); }

  /** 입춘(2/4 근사) 기준 유효 연도 — 띠·연주 판정용 */
  function effectiveYear(y, m, d) {
    return (m < 2 || (m === 2 && d < 4)) ? y - 1 : y;
  }

  /** 연주(년 간지). 예: 2026 → 병오 */
  function yearGanzhi(y, m, d) {
    var ey = effectiveYear(y, m, d);
    var s = mod(ey - 4, 10), b = mod(ey - 4, 12);
    return {
      name: STEMS[s] + BRANCHES[b],
      stem: STEMS[s], branch: BRANCHES[b],
      zodiacId: ZODIAC_IDS[b], zodiacKo: ZODIAC_KO[b],
      effectiveYear: ey
    };
  }

  /** 생년월일 → 띠 (입춘 기준) */
  function zodiacFromBirth(y, m, d) {
    var b = mod(effectiveYear(y, m, d) - 4, 12);
    return { id: ZODIAC_IDS[b], ko: ZODIAC_KO[b] };
  }

  /** 생일 월·일 → 별자리 */
  function starSignFromBirth(m, d) {
    for (var i = 0; i < STAR_SIGNS.length; i++) {
      var s = STAR_SIGNS[i], f = s.from, t = s.to;
      var afterFrom = (m > f[0]) || (m === f[0] && d >= f[1]);
      var beforeTo = (m < t[0]) || (m === t[0] && d <= t[1]);
      if (f[0] <= t[0] ? (afterFrom && beforeTo) : (afterFrom || beforeTo)) return s;
    }
    return STAR_SIGNS[STAR_SIGNS.length - 1]; // 도달 불가 (안전망)
  }

  /** 생년월일 → 사주 일간 */
  function dayStemFromBirth(y, m, d) {
    var g = dayGanzhi(y, m, d);
    return {
      id: SAJU_STEM_IDS[g.stemIndex],
      ko: g.stem,
      element: g.stemElement,
      yang: g.yang,
      dayPillar: g.name // 일주 (예: 을미)
    };
  }

  /**
   * 십성(十星) — otherStem(오늘의 일간)이 userStem(내 일간)에 대해 갖는 관계.
   * 결정적 계산이므로 코드가 한다. AI는 이 결과를 해석만 한다.
   */
  function sipseong(userStemIndex, otherStemIndex) {
    var ue = STEM_ELEMENT[userStemIndex], oe = STEM_ELEMENT[otherStemIndex];
    var samePolarity = (userStemIndex % 2) === (otherStemIndex % 2);
    if (ue === oe) return samePolarity ? '비견' : '겁재';
    if ((ue + 1) % 5 === oe) return samePolarity ? '식신' : '상관'; // 내가 생하는 기운
    if ((ue + 2) % 5 === oe) return samePolarity ? '편재' : '정재'; // 내가 극하는 기운
    if ((oe + 1) % 5 === ue) return samePolarity ? '편인' : '정인'; // 나를 생하는 기운
    return samePolarity ? '편관' : '정관';                          // 나를 극하는 기운
  }

  /** 오늘 일간이 10개 일간 각각에 갖는 십성 관계 맵 { gap: '비견', ... } */
  function sipseongMap(todayStemIndex) {
    var map = {};
    for (var i = 0; i < 10; i++) map[SAJU_STEM_IDS[i]] = sipseong(i, todayStemIndex);
    return map;
  }

  // ---- KST 날짜 유틸 ----------------------------------------------------

  /** 현재 시각의 KST 날짜 문자열 YYYY-MM-DD */
  function kstToday(now) {
    var t = new Date((now || Date.now()) + 9 * 3600 * 1000);
    return t.getUTCFullYear() + '-' +
      String(t.getUTCMonth() + 1).padStart(2, '0') + '-' +
      String(t.getUTCDate()).padStart(2, '0');
  }

  function parseDate(str) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
    if (!m) return null;
    return { y: +m[1], m: +m[2], d: +m[3] };
  }

  function weekdayKo(y, m, d) {
    return WEEKDAY_KO[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  }

  return {
    STEMS: STEMS, BRANCHES: BRANCHES, ELEMENTS: ELEMENTS,
    SAJU_STEM_IDS: SAJU_STEM_IDS,
    ZODIAC_IDS: ZODIAC_IDS, ZODIAC_KO: ZODIAC_KO,
    STAR_SIGNS: STAR_SIGNS, TAROT: TAROT,
    BLOOD_TYPES: BLOOD_TYPES, MBTI_TYPES: MBTI_TYPES,
    WEEKDAY_KO: WEEKDAY_KO,
    dayGanzhi: dayGanzhi, dayGanzhiIndex: dayGanzhiIndex, ganzhiFromIndex: ganzhiFromIndex,
    yearGanzhi: yearGanzhi, effectiveYear: effectiveYear,
    zodiacFromBirth: zodiacFromBirth, starSignFromBirth: starSignFromBirth,
    dayStemFromBirth: dayStemFromBirth,
    sipseong: sipseong, sipseongMap: sipseongMap,
    kstToday: kstToday, parseDate: parseDate, weekdayKo: weekdayKo
  };
});
