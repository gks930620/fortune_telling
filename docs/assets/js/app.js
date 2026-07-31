/**
 * app.js — 오늘의 운세 프론트엔드
 *
 * 서버·AI 호출 없음. 매일 새벽 배치가 만든 정적 JSON(data/daily/<날짜>.json)을 읽는다.
 * 페이지 진입점은 window.PAGE 로 구분한다 (home / tti / zodiac / saju / tarot).
 *
 * 데이터 경로는 window.DATA_BASE(Jekyll이 baseurl을 붙여 주입)를 쓴다.
 * 상대경로('data/…')를 쓰면 하위 경로 페이지에서 깨지므로 직접 조립하지 말 것.
 *
 * 운세 텍스트는 AI 생성물이므로 반드시 textContent로만 렌더링한다(HTML 주입 방지).
 */
(function () {
  'use strict';

  var BASE = window.DATA_BASE || 'data/';
  var PAGE = window.PAGE || 'home';
  var PROFILE_KEY = 'fortune_profile';
  var TAROT_KEY = 'fortune_tarot_pick';

  var state = { data: null, profile: null };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  }

  // ---- 데이터 로드 (오늘 → latest 폴백) ----

  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function loadData() {
    var today = Manse.kstToday();
    return fetchJSON(BASE + 'daily/' + today + '.json').catch(function () {
      return fetchJSON(BASE + 'latest.json').then(function (latest) {
        if (!latest.daily || !latest.daily.date) throw new Error('no data');
        return fetchJSON(BASE + 'daily/' + latest.daily.date + '.json').then(function (data) {
          if (latest.daily.date !== today) {
            showNotice('오늘 운세 준비 중 · ' + latest.daily.date + ' 운세 표시 중');
          }
          return data;
        });
      });
    });
  }

  function showNotice(msg) {
    var n = $('notice');
    if (!n) return;
    n.textContent = msg;
    n.classList.remove('hidden');
  }

  // ---- 공통 렌더 ----

  // 빈 별은 ☆ 로 그린다. 같은 ★ 를 색만 흐리게 쓰면 복사·고대비 모드·색약 사용자에게
  // 전부 5점으로 보인다.
  function starsEl(score) {
    var wrap = el('span', 'stars');
    wrap.appendChild(el('span', null, '★'.repeat(score)));
    if (score < 5) wrap.appendChild(el('span', 'off', '☆'.repeat(5 - score)));
    wrap.setAttribute('aria-label', '5점 만점에 ' + score + '점');
    return wrap;
  }

  /** 운세 본문(키워드·텍스트·조언·행운) 노드들을 target에 붙인다 */
  function appendEntry(target, entry) {
    target.appendChild(el('span', 'chip keyword', entry.keyword));
    target.appendChild(el('p', 'fortune-text', entry.text));
    target.appendChild(el('p', 'fortune-advice', entry.advice));
    if (entry.lucky && (entry.lucky.color || entry.lucky.number !== undefined)) {
      var parts = [];
      if (entry.lucky.color) parts.push('행운의 색 ' + entry.lucky.color);
      if (entry.lucky.number !== undefined) parts.push('행운의 숫자 ' + entry.lucky.number);
      target.appendChild(el('div', 'lucky', '🍀 ' + parts.join(' · ')));
    }
  }

  /** 버킷 카드 하나 — { icon, title, sub, entry, highlight, badge } */
  function bucketCard(o) {
    var card = el('article', 'bucket-card' + (o.highlight ? ' highlight' : ''));
    var head = el('header', 'b-head');
    if (o.icon) head.appendChild(el('span', 'b-icon', o.icon));
    head.appendChild(el('span', 'b-title', o.title));
    if (o.badge) head.appendChild(el('span', 'b-badge', o.badge));
    head.appendChild(starsEl(o.entry.score));
    card.appendChild(head);
    if (o.sub) card.appendChild(el('div', 'b-sub', o.sub));
    appendEntry(card, o.entry);
    return card;
  }

  function renderTodayLine() {
    var line = $('todayLine');
    if (!line) return;
    var d = state.data, ctx = d.context || {};
    var txt = d.date + ' (' + (ctx.weekday || '') + ')';
    if (ctx.day_ganzhi) txt += ' · ' + ctx.day_ganzhi.name;
    if (ctx.year_ganzhi) txt += ' · ' + ctx.year_ganzhi.name + ' ' + ctx.year_ganzhi.zodiac + ' 해';
    line.textContent = txt;
  }

  function typeMissing(container, label) {
    container.textContent = '';
    container.appendChild(el('p', 'placeholder', '오늘 ' + label + ' 운세 준비 중'));
  }

  // ---- 띠 ----

  function ttiYearsText(id) {
    var ys = Manse.zodiacYears(id, 1936, 2025);
    return ys.map(function (y) { return String(y).slice(2); }).join(' · ') + '년생';
  }

  function initTti() {
    var list = $('list');
    var buckets = (state.data.types || {}).tti;
    if (!buckets) return typeMissing(list, '띠');

    // 올해의 띠 — 입춘 기준이라 코드로 계산한다 (1~2월 초는 아직 작년 띠)
    var d = Manse.parseDate(state.data.date);
    var yg = d ? Manse.yearGanzhi(d.y, d.m, d.d) : null;
    var yearTag = $('yearTti');
    if (yg && yearTag) {
      yearTag.textContent = yg.effectiveYear + '년은 ' +
        Manse.zodiacInfo(yg.zodiacId).emoji + ' ' + yg.zodiacKo + '띠 해';
      yearTag.classList.remove('hidden');
    }

    Manse.ZODIAC_IDS.forEach(function (id) {
      var info = Manse.zodiacInfo(id);
      if (!buckets[id]) return;
      list.appendChild(bucketCard({
        icon: info.emoji,
        title: info.ko + '띠',
        badge: yg && id === yg.zodiacId ? '올해의 띠' : null,
        sub: ttiYearsText(id),
        entry: buckets[id]
      }));
    });
  }

  // ---- 별자리 ----

  function initZodiac() {
    var list = $('list');
    var buckets = (state.data.types || {}).zodiac;
    if (!buckets) return typeMissing(list, '별자리');
    Manse.STAR_SIGNS.forEach(function (s) {
      if (!buckets[s.id]) return;
      list.appendChild(bucketCard({
        icon: s.symbol,
        title: s.ko,
        sub: Manse.starSignRange(s),
        entry: buckets[s.id]
      }));
    });
  }

  // ---- 사주 ----

  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
    catch (e) { return null; }
  }

  /* 사주 용어를 화면에 그대로 노출하지 않는다.
     일간(壬)·일주(壬申)·십성(편재) 같은 말은 아는 사람에게만 의미가 있고,
     처음 온 사람에게는 벽이 된다. 오행은 자연물로, 십성은 "오늘 어떤 날인지"로 풀어 쓴다. */
  var ELEMENT_NATURE = { '목': '나무', '화': '불', '토': '흙', '금': '쇠', '수': '물' };

  var SIPSEONG_PLAIN = {
    '비견': '내 페이스를 지키면 좋은 날',
    '겁재': '경쟁심이 붙는 날',
    '식신': '즐겁게 몰입하는 날',
    '상관': '말과 재능이 앞서는 날',
    '편재': '뜻밖의 기회가 들어오는 날',
    '정재': '착실하게 쌓이는 날',
    '편관': '압박을 이겨내는 날',
    '정관': '책임이 인정받는 날',
    '편인': '직관이 살아나는 날',
    '정인': '배움과 도움이 들어오는 날'
  };

  // 열 가지 일간을 자연물로 — 화면에서 서로 구분되게 하는 용도
  var STEM_NATURE = {
    gap: '큰 나무', eul: '풀과 덩굴', byeong: '태양', jeong: '촛불', mu: '산',
    gi: '밭흙', gyeong: '무쇠', sin: '보석', im: '바다', gye: '이슬'
  };
  var ELEMENT_EMOJI = { '목': '🌳', '화': '🔥', '토': '⛰️', '금': '🪙', '수': '💧' };

  function natureOf(id) {
    var s = Manse.sajuStemInfo(id);
    return ELEMENT_NATURE[s.element] || s.element;
  }

  /** 목록용 라벨. 예: 임(壬) 바다 */
  function stemLabel(id) {
    var s = Manse.sajuStemInfo(id);
    return s.ko + '(' + s.hanja + ') ' + STEM_NATURE[id];
  }

  function stemEmoji(id) {
    return ELEMENT_EMOJI[Manse.sajuStemInfo(id).element] || '📜';
  }

  function todayRelation(id) {
    var rel = (state.data.context || {}).saju_relations;
    rel = rel ? rel[id] : null;
    return rel && SIPSEONG_PLAIN[rel] ? '오늘은 ' + SIPSEONG_PLAIN[rel] : '';
  }

  /** 열 가지 일간 전체 — 내 것에는 '나' 배지를 단다 */
  function renderSajuList() {
    var list = $('list');
    if (!list) return;
    list.textContent = '';
    var buckets = (state.data.types || {}).saju;
    if (!buckets) return typeMissing(list, '사주');

    var p = state.profile;
    var birth = p && p.birth ? Manse.parseDate(p.birth) : null;
    var mine = birth ? Manse.dayStemFromBirth(birth.y, birth.m, birth.d).id : null;

    Manse.SAJU_STEM_IDS.forEach(function (id) {
      if (!buckets[id]) return;
      list.appendChild(bucketCard({
        icon: stemEmoji(id),
        title: stemLabel(id),
        badge: id === mine ? '나' : null,
        sub: todayRelation(id),
        entry: buckets[id],
        highlight: id === mine
      }));
    });
  }

  function renderMySaju() {
    var box = $('myResult');
    box.textContent = '';
    var p = state.profile;
    var birth = p && p.birth ? Manse.parseDate(p.birth) : null;

    if (!birth) {
      box.appendChild(el('p', 'empty-hint', '생년월일 입력 → 내 운세'));
      return;
    }

    var buckets = (state.data.types || {}).saju;
    if (!buckets) return typeMissing(box, '사주');

    var stem = Manse.dayStemFromBirth(birth.y, birth.m, birth.d);
    var entry = buckets[stem.id];
    if (!entry) return typeMissing(box, '사주');

    box.appendChild(el('h2', 'section-title', '나의 오늘'));
    box.appendChild(bucketCard({
      icon: '📜',
      title: natureOf(stem.id) + '의 기운을 타고난 당신',
      sub: todayRelation(stem.id),
      entry: entry,
      highlight: true
    }));
  }

  /* 생년월일 선택 — 년/월/일 셀렉트 세 개.
     <input type="date">는 브라우저마다 생김새가 다르고, 무엇보다 출생연도를 고르려면
     달력을 수십 번 넘겨야 한다. 연도를 바로 집을 수 있는 쪽이 낫다. */

  function addOption(sel, value, label) {
    var o = document.createElement('option');
    o.value = value;
    o.textContent = label;
    sel.appendChild(o);
  }

  function daysInMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function syncDayOptions() {
    var y = +$('inYear').value, m = +$('inMonth').value, d = $('inDay');
    var max = (y && m) ? daysInMonth(y, m) : 31;   // 연·월 미선택이면 넉넉히 열어둔다
    var keep = +d.value;
    d.textContent = '';
    addOption(d, '', '일');
    for (var i = 1; i <= max; i++) addOption(d, i, i);
    if (keep && keep <= max) d.value = keep;       // 2/30 같은 조합은 자동으로 풀린다
  }

  function buildBirthPicker(preset) {
    var y = $('inYear'), m = $('inMonth');
    var thisYear = Manse.parseDate(Manse.kstToday()).y;

    addOption(y, '', '연도');
    for (var i = thisYear; i >= 1900; i--) addOption(y, i, i);   // 최근 연도가 위로
    addOption(m, '', '월');
    for (var j = 1; j <= 12; j++) addOption(m, j, j);

    y.addEventListener('change', syncDayOptions);
    m.addEventListener('change', syncDayOptions);
    syncDayOptions();

    var p = preset ? Manse.parseDate(preset) : null;
    if (p) { y.value = p.y; m.value = p.m; syncDayOptions(); $('inDay').value = p.d; }
  }

  function resetBirthPicker() {
    $('inYear').value = ''; $('inMonth').value = ''; syncDayOptions();
  }

  /** 세 셀렉트 → 'YYYY-MM-DD'. 미선택·미래 날짜면 null */
  function readBirthPicker() {
    var y = +$('inYear').value, m = +$('inMonth').value, d = +$('inDay').value;
    if (!y || !m || !d || d > daysInMonth(y, m)) return null;
    var s = y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
    return s > Manse.kstToday() ? null : s;
  }

  function showSajuSummary() {
    var p = state.profile;
    var sum = $('profileSummary'), form = $('profileForm');
    var b = p && p.birth ? Manse.parseDate(p.birth) : null;
    if (!b) { sum.classList.add('hidden'); form.classList.remove('hidden'); return; }

    sum.textContent = '';
    var stem = Manse.dayStemFromBirth(b.y, b.m, b.d);

    var main = el('div', 'summary-main');
    main.appendChild(el('span', 'summary-date', b.y + '년 ' + b.m + '월 ' + b.d + '일'));
    main.appendChild(el('span', 'chip', stemEmoji(stem.id) + ' ' + natureOf(stem.id) + ' 기운'));
    sum.appendChild(main);

    var acts = el('div', 'summary-actions');
    var edit = el('button', 'ghost', '수정');
    edit.addEventListener('click', function () {
      sum.classList.add('hidden'); form.classList.remove('hidden');
    });
    acts.appendChild(edit);

    var clear = el('button', 'ghost', '지우기');
    clear.addEventListener('click', function () {
      localStorage.removeItem(PROFILE_KEY);
      state.profile = null;
      resetBirthPicker();
      showSajuSummary();
      renderMySaju();
      renderSajuList();   // '나' 배지도 함께 걷어낸다
    });
    acts.appendChild(clear);
    sum.appendChild(acts);

    sum.classList.remove('hidden');
    form.classList.add('hidden');
  }

  function initSaju() {
    state.profile = loadProfile();
    buildBirthPicker(state.profile && state.profile.birth);

    $('btnSave').addEventListener('click', function () {
      var v = readBirthPicker();
      if (!v) { showNotice('생년월일을 모두 골라주세요.'); return; }
      state.profile = { birth: v };
      localStorage.setItem(PROFILE_KEY, JSON.stringify(state.profile));
      showSajuSummary();
      renderMySaju();
      renderSajuList();
    });

    showSajuSummary();
    renderMySaju();
    renderSajuList();
  }

  /* 설명 팝업 — 네 페이지가 같은 구조를 쓴다(버튼 #btnWhat, 다이얼로그 #whatModal).
     운세를 보러 온 흐름을 막지 않도록 기본은 숨김이고, 궁금한 사람만 연다.
     <dialog>을 쓰면 ESC 닫기와 포커스 가둠을 브라우저가 처리해 준다. */
  function wireModal() {
    var modal = $('whatModal'), open = $('btnWhat'), close = $('btnClose');
    if (!modal || !open) return;

    open.addEventListener('click', function () {
      if (modal.showModal) modal.showModal();
      else modal.setAttribute('open', '');       // 아주 오래된 브라우저 폴백
    });
    if (close) close.addEventListener('click', function () {
      if (modal.close) modal.close();
      else modal.removeAttribute('open');
    });
    // 바깥 여백을 눌러도 닫히게
    modal.addEventListener('click', function (e) {
      if (e.target === modal && modal.close) modal.close();
    });
  }

  // ---- 타로 ----

  function loadPick() {
    try { return JSON.parse(localStorage.getItem(TAROT_KEY)) || null; }
    catch (e) { return null; }
  }

  function initTarot() {
    var stage = $('stage');
    var buckets = (state.data.types || {}).tarot;
    if (!buckets) return typeMissing(stage, '타로');

    var pick = loadPick();
    if (pick && pick.date === state.data.date && buckets[pick.card]) showResult(stage, pick.card);
    else showDeck(stage);
  }

  function showDeck(stage) {
    stage.textContent = '';
    stage.appendChild(el('p', 'deck-guide', '마음이 가는 카드 한 장'));

    var deck = el('div', 'tarot-deck');
    // 위치와 카드의 대응은 뽑는 순간마다 새로 섞인다
    var order = Manse.TAROT.map(function (t) { return t.id; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    order.forEach(function (cardId, idx) {
      var b = el('button', 'tarot-back');
      b.setAttribute('aria-label', (idx + 1) + '번째 뒤집힌 카드 뽑기');
      b.addEventListener('click', function () {
        localStorage.setItem(TAROT_KEY, JSON.stringify({ date: state.data.date, card: cardId }));
        showResult(stage, cardId);
      });
      deck.appendChild(b);
    });
    stage.appendChild(deck);
  }

  function showResult(stage, cardId) {
    var entry = state.data.types.tarot[cardId];
    var meta = Manse.tarotById(cardId);
    stage.textContent = '';

    var card = el('article', 'bucket-card highlight tarot-result');

    var face = el('div', 'tarot-face');
    face.appendChild(el('span', 'tarot-num', meta ? meta.id : cardId));
    face.appendChild(el('span', 'tarot-ko', meta ? meta.ko : ''));
    face.appendChild(el('span', 'tarot-en', meta ? meta.en : ''));
    card.appendChild(face);

    var head = el('header', 'b-head');
    head.appendChild(el('span', 'b-title', '오늘 뽑은 카드'));
    head.appendChild(starsEl(entry.score));
    card.appendChild(head);

    appendEntry(card, entry);
    stage.appendChild(card);

    stage.appendChild(el('p', 'fineprint', '하루 한 장 · 내일 새 카드'));

    var again = el('button', 'ghost', '다시 뽑기');
    again.addEventListener('click', function () {
      if (!window.confirm('오늘 뽑은 카드를 버리고 다시 뽑을까요?')) return;
      localStorage.removeItem(TAROT_KEY);
      showDeck(stage);
    });
    stage.appendChild(again);
  }

  // ---- 시작 ----

  var ROUTES = { tti: initTti, zodiac: initZodiac, saju: initSaju, tarot: initTarot };

  document.addEventListener('DOMContentLoaded', function () {
    wireModal();   // 데이터 로드와 무관하게 항상 열 수 있어야 한다
    loadData().then(function (data) {
      state.data = data;
      renderTodayLine();
      if (ROUTES[PAGE]) ROUTES[PAGE]();
    }).catch(function () {
      var line = $('todayLine');
      if (line) line.textContent = '운세를 불러오지 못했어요.';
      showNotice('잠시 후 다시 시도해 주세요.');
    });
  });
})();
