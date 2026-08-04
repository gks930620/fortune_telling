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

  var STEMS_HANJA = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];

  var ZODIAC_IDS = ['rat', 'ox', 'tiger', 'rabbit', 'dragon', 'snake', 'horse', 'sheep', 'monkey', 'rooster', 'dog', 'pig'];
  var ZODIAC_KO = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
  var ZODIAC_EMOJI = ['🐭', '🐮', '🐯', '🐰', '🐲', '🐍', '🐴', '🐑', '🐵', '🐔', '🐶', '🐷'];

  /* 한국 잡지 관례 날짜 구간.
     서양 천문 기준(사수 ~12/21, 염소 12/22~)과 최대 3일 차이가 나는데, 이건 오차가 아니라
     의도다 — 국내 잡지·포털 운세가 오래 써 온 표(사수 11/23~12/24, 염소 12/25~1/19)를 따랐다.
     방문자가 다른 사이트에서 본 자기 별자리와 어긋나지 않는 쪽을 택한 것이다.
     바꾸려면 이 주석과 zodiac.html의 안내 문구를 함께 고칠 것. */
  /* `element`는 서양 4원소(화면 표시용), `ohaeng`은 그것을 오행으로 옮긴 값이다.
     4원소↔오행은 전해 내려오는 대응표가 없다 — 아래는 이 프로젝트가 정한 것이다:
       불→화 · 흙→토 · 물→수 · 공기→목(바람·확산의 기운)
     금(金)이 남는데, 원소가 넷뿐이라 어느 매핑을 써도 하나는 남는다.
     이 대응을 바꾸면 별자리 점수 경향이 통째로 달라지니 근거를 남기고 바꿀 것. */
  var STAR_SIGNS = [
    { id: 'aquarius',    ko: '물병자리',   symbol: '♒', from: [1, 20],  to: [2, 18],  element: '공기', ohaeng: '목' },
    { id: 'pisces',      ko: '물고기자리', symbol: '♓', from: [2, 19],  to: [3, 20],  element: '물',   ohaeng: '수' },
    { id: 'aries',       ko: '양자리',     symbol: '♈', from: [3, 21],  to: [4, 19],  element: '불',   ohaeng: '화' },
    { id: 'taurus',      ko: '황소자리',   symbol: '♉', from: [4, 20],  to: [5, 20],  element: '흙',   ohaeng: '토' },
    { id: 'gemini',      ko: '쌍둥이자리', symbol: '♊', from: [5, 21],  to: [6, 21],  element: '공기', ohaeng: '목' },
    { id: 'cancer',      ko: '게자리',     symbol: '♋', from: [6, 22],  to: [7, 22],  element: '물',   ohaeng: '수' },
    { id: 'leo',         ko: '사자자리',   symbol: '♌', from: [7, 23],  to: [8, 22],  element: '불',   ohaeng: '화' },
    { id: 'virgo',       ko: '처녀자리',   symbol: '♍', from: [8, 23],  to: [9, 23],  element: '흙',   ohaeng: '토' },
    { id: 'libra',       ko: '천칭자리',   symbol: '♎', from: [9, 24],  to: [10, 22], element: '공기', ohaeng: '목' },
    { id: 'scorpio',     ko: '전갈자리',   symbol: '♏', from: [10, 23], to: [11, 22], element: '물',   ohaeng: '수' },
    { id: 'sagittarius', ko: '사수자리',   symbol: '♐', from: [11, 23], to: [12, 24], element: '불',   ohaeng: '화' },
    { id: 'capricorn',   ko: '염소자리',   symbol: '♑', from: [12, 25], to: [1, 19],  element: '흙',   ohaeng: '토' }
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

  /**
   * 지지 관계(충·육합·삼합) — 십성과 똑같이 결정적 계산이므로 코드가 한다.
   * 예전엔 이 표가 없어서 역할 AI가 12지지의 충·합을 기억으로 추론했다.
   * 지금까지 결과는 맞았지만 틀려도 아무도 모르는 구조였다. AI는 이 값을 해석만 한다.
   *
   *   충(沖)   마주 보는 자리 — 자오 축미 인신 묘유 진술 사해   (인덱스 +6)
   *   육합(合) 짝을 이루는 자리 — 자축 인해 묘술 진유 사신 오미  (인덱스 합 = 1 또는 13)
   *   삼합(三合) 한 국(局)을 이루는 셋 — 신자진(수) 해묘미(목) 인오술(화) 사유축(금)
   *              (인덱스를 4로 나눈 나머지가 같다)
   * 셋은 서로 겹치지 않는다(수학적으로 배타적).
   */
  var SAMHAP_ELEMENT = ['수', '금', '화', '목'];   // (branchIndex % 4) → 국의 오행

  /** 두 지지의 관계. 없으면 null */
  function branchRelation(a, b) {
    if (a === b) return '같음';
    if (mod(a + 6, 12) === b) return '충';
    if (mod(13 - a, 12) === b) return '육합';
    if (mod(a, 4) === mod(b, 4)) return '삼합';
    return null;
  }

  /**
   * 오늘 일진의 지지가 12띠 각각에 갖는 관계 맵.
   * { rat: { relation: '충', element: null }, tiger: { relation: '삼합', element: '화' }, … }
   * `element`는 삼합일 때 그 국의 오행, 아니면 null.
   */
  function branchRelationMap(todayBranchIndex) {
    var map = {};
    for (var i = 0; i < 12; i++) {
      var rel = branchRelation(todayBranchIndex, i);
      map[ZODIAC_IDS[i]] = {
        relation: rel,
        element: rel === '삼합' ? SAMHAP_ELEMENT[mod(i, 4)] : null
      };
    }
    return map;
  }

  /**
   * 오행 상생·상극 — 오늘 일진의 오행(day)이 상대 기운(target)에 어떻게 작용하는지.
   * 별자리 역할 AI가 "오늘이 이 별자리에 순한 날인가"를 판단하는 근거다.
   * 이름은 전부 **target(별자리) 입장**에서 붙였다.
   *
   *   같음  같은 기운이 겹친다 (증폭)
   *   생    오늘이 target을 살려준다        (목→화: 순한 날)
   *   극    오늘이 target을 눌러 온다        (목→토: 버거운 날)
   *   설    target이 오늘을 생한다 — 기운이 빠져나간다 (목→수, 즉 수생목: 소모되는 날)
   *   역극  target이 오늘을 극한다 — 힘을 써야 한다   (목→금, 즉 금극목: 분발하는 날)
   */
  function elementRelation(day, target) {
    var i = ELEMENTS.indexOf(day), j = ELEMENTS.indexOf(target);
    if (i < 0 || j < 0) return null;
    if (i === j) return '같음';
    if (mod(i + 1, 5) === j) return '생';
    if (mod(i + 2, 5) === j) return '극';
    if (mod(j + 1, 5) === i) return '설';
    return '역극';
  }

  /**
   * 오늘 일진이 12별자리 각각에 갖는 오행 관계 맵.
   * { aries: { element: '불', stem: '역극', branch: '생' }, … }
   * 별자리 역할 AI가 매일 성격론만 되풀이하지 않도록, '그날의 근거'를 코드가 준다.
   *
   * 천간·지지를 **둘 다** 준다. 천간 오행은 이틀마다 바뀌어서(갑을=목, 병정=화 …)
   * 그것만 쓰면 별자리 운세가 이틀씩 똑같아진다. 지지를 겹쳐야 매일 달라진다.
   */
  function starSignRelationMap(stemElement, branchElement) {
    var map = {};
    for (var i = 0; i < STAR_SIGNS.length; i++) {
      var s = STAR_SIGNS[i];
      map[s.id] = {
        element: s.element,
        stem: elementRelation(stemElement, s.ohaeng),
        branch: elementRelation(branchElement, s.ohaeng)
      };
    }
    return map;
  }

  // ---- 화면 표시용 조회 --------------------------------------------------

  /**
   * 띠 id → 그 띠에 해당하는 출생연도 목록.
   * 주의: 입춘(2/4) 기준이라 1/1~2/3 출생자는 앞 띠에 속한다. 화면에 그 안내를 함께 띄울 것.
   */
  function zodiacYears(id, from, to) {
    var idx = ZODIAC_IDS.indexOf(id);
    if (idx < 0) return [];
    var out = [];
    for (var y = (from || 1936); y <= (to || 2032); y++) if (mod(y - 4, 12) === idx) out.push(y);
    return out;
  }

  /** 띠 id → { id, ko, emoji, index } */
  function zodiacInfo(id) {
    var i = ZODIAC_IDS.indexOf(id);
    if (i < 0) return null;
    return { id: id, ko: ZODIAC_KO[i], emoji: ZODIAC_EMOJI[i], index: i };
  }

  /** 별자리 기간 문자열. 예: "5월 21일 ~ 6월 21일" */
  function starSignRange(sign) {
    return sign.from[0] + '월 ' + sign.from[1] + '일 ~ ' + sign.to[0] + '월 ' + sign.to[1] + '일';
  }

  /** 별자리 id → STAR_SIGNS 항목 */
  function starSignById(id) {
    for (var i = 0; i < STAR_SIGNS.length; i++) if (STAR_SIGNS[i].id === id) return STAR_SIGNS[i];
    return null;
  }

  /** 일간 id → { id, ko, hanja, element, yang }. 예: gap → 갑(甲) 목 양 */
  function sajuStemInfo(id) {
    var i = SAJU_STEM_IDS.indexOf(id);
    if (i < 0) return null;
    return {
      id: id, ko: STEMS[i], hanja: STEMS_HANJA[i],
      element: ELEMENTS[STEM_ELEMENT[i]], yang: i % 2 === 0
    };
  }

  /** 타로 id → TAROT 항목 */
  function tarotById(id) {
    for (var i = 0; i < TAROT.length; i++) if (TAROT[i].id === id) return TAROT[i];
    return null;
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
    STEMS: STEMS, STEMS_HANJA: STEMS_HANJA, BRANCHES: BRANCHES, ELEMENTS: ELEMENTS,
    SAJU_STEM_IDS: SAJU_STEM_IDS,
    ZODIAC_IDS: ZODIAC_IDS, ZODIAC_KO: ZODIAC_KO, ZODIAC_EMOJI: ZODIAC_EMOJI,
    STAR_SIGNS: STAR_SIGNS, TAROT: TAROT,
    WEEKDAY_KO: WEEKDAY_KO,
    dayGanzhi: dayGanzhi, dayGanzhiIndex: dayGanzhiIndex, ganzhiFromIndex: ganzhiFromIndex,
    yearGanzhi: yearGanzhi, effectiveYear: effectiveYear,
    zodiacFromBirth: zodiacFromBirth, starSignFromBirth: starSignFromBirth,
    dayStemFromBirth: dayStemFromBirth,
    sipseong: sipseong, sipseongMap: sipseongMap,
    branchRelation: branchRelation, branchRelationMap: branchRelationMap,
    elementRelation: elementRelation, starSignRelationMap: starSignRelationMap,
    zodiacYears: zodiacYears, zodiacInfo: zodiacInfo,
    starSignRange: starSignRange, starSignById: starSignById,
    sajuStemInfo: sajuStemInfo, tarotById: tarotById,
    kstToday: kstToday, parseDate: parseDate, weekdayKo: weekdayKo
  };
});
