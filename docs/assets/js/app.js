/**
 * app.js — 오늘의 운세 프론트엔드
 *
 * 서버·AI 호출 없음. 매일 새벽 배치가 만든 정적 JSON(data/daily/<날짜>.json)을 읽고,
 * 사용자 입력(생년월일 등) → 버킷 변환은 전부 브라우저에서 Manse(만세력 모듈)로 계산한다.
 * 운세 텍스트는 AI 생성물이므로 반드시 textContent로만 렌더링한다(HTML 주입 방지).
 */
(function () {
  'use strict';

  var PROFILE_KEY = 'fortune_profile';
  var TAROT_KEY = 'fortune_tarot_pick';

  var state = { data: null, profile: null };

  function $(id) { return document.getElementById(id); }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ---- 프로필 (localStorage) ----
  function loadProfile() {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
    catch (e) { return null; }
  }
  function saveProfile(p) { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); }

  // ---- 데이터 로드 (오늘 → latest 폴백) ----
  function fetchJSON(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  function loadData() {
    var today = Manse.kstToday();
    return fetchJSON('data/daily/' + today + '.json').catch(function () {
      return fetchJSON('data/latest.json').then(function (latest) {
        if (!latest.daily || !latest.daily.date) throw new Error('no data');
        return fetchJSON('data/daily/' + latest.daily.date + '.json').then(function (data) {
          if (latest.daily.date !== today) {
            showNotice('오늘(' + today + ') 운세가 아직 준비되지 않아 최신(' + latest.daily.date + ') 운세를 보여드려요.');
          }
          return data;
        });
      });
    });
  }

  function showNotice(msg) {
    var n = $('notice');
    n.textContent = msg;
    n.classList.remove('hidden');
  }

  // ---- 공통 렌더 ----
  function starsEl(score) {
    var wrap = el('span', 'stars');
    wrap.appendChild(el('span', null, '★'.repeat(score)));
    if (score < 5) wrap.appendChild(el('span', 'off', '★'.repeat(5 - score)));
    return wrap;
  }

  function renderEntry(card, entry, extraLine) {
    var body = card.querySelector('.body');
    body.textContent = '';
    var head = el('div');
    head.appendChild(starsEl(entry.score));
    head.appendChild(el('span', 'chip keyword', entry.keyword));
    body.appendChild(head);
    if (extraLine) body.appendChild(el('div', 'who', extraLine));
    body.appendChild(el('p', 'fortune-text', entry.text));
    body.appendChild(el('p', 'fortune-advice', entry.advice));
    if (entry.lucky && (entry.lucky.color || entry.lucky.number !== undefined)) {
      var parts = [];
      if (entry.lucky.color) parts.push('행운의 색 ' + entry.lucky.color);
      if (entry.lucky.number !== undefined) parts.push('행운의 숫자 ' + entry.lucky.number);
      body.appendChild(el('div', 'lucky', '🍀 ' + parts.join(' · ')));
    }
  }

  function renderMissing(card, label) {
    var body = card.querySelector('.body');
    body.textContent = '';
    body.appendChild(el('p', 'placeholder', label || '오늘은 이 운세가 준비되지 못했어요. 내일 다시 만나요.'));
  }

  /* 프로필 항목이 지워졌을 때 이전 운세가 화면에 남지 않도록 카드를 초기 안내 문구로 되돌린다 */
  function resetCard(card, msg) {
    setWho(card, '');
    renderMissing(card, msg);
  }

  function setWho(card, text) {
    var w = card.querySelector('.who');
    if (w) w.textContent = text || '';
  }

  // ---- 섹션별 렌더 ----
  function renderAll() {
    var data = state.data, p = state.profile;
    var types = data.types || {};

    // 상단 날짜 줄
    var ctx = data.context || {};
    var line = data.date + ' (' + (ctx.weekday || '') + ') · ' +
      (ctx.day_ganzhi ? ctx.day_ganzhi.name : '') + ' · ' +
      (ctx.year_ganzhi ? ctx.year_ganzhi.name + ' ' + ctx.year_ganzhi.zodiac + ' 해' : '');
    if (ctx.today_holiday) line += ' · 🎉 ' + ctx.today_holiday;
    $('todayLine').textContent = line;
    if (ctx.next_holiday && !ctx.today_holiday) {
      $('todayLine').textContent += ' · 다가오는 연휴: ' + ctx.next_holiday.name + '(' + ctx.next_holiday.start + ')';
    }

    var birth = p && p.birth ? Manse.parseDate(p.birth) : null;

    // 사주 (일간)
    var sajuCard = $('card-saju');
    if (!birth) { resetCard(sajuCard, '생년월일을 입력하면 일간(日干) 기준 사주 운세를 보여드려요.'); }
    else if (!types.saju) { renderMissing(sajuCard); }
    else {
      var stem = Manse.dayStemFromBirth(birth.y, birth.m, birth.d);
      setWho(sajuCard, '나의 일간: ' + stem.ko + '(' + stem.element + ') · 일주 ' + stem.dayPillar);
      var rel = ctx.saju_relations ? ctx.saju_relations[stem.id] : null;
      renderEntry(sajuCard, types.saju[stem.id],
        rel ? '오늘은 당신에게 「' + rel + '」의 날' : null);
    }

    // 띠
    var ttiCard = $('card-tti');
    if (!birth) { resetCard(ttiCard, '생년월일을 입력하면 띠를 계산해 드려요. (입춘 기준)'); }
    else if (!types.tti) { renderMissing(ttiCard); }
    else {
      var z = Manse.zodiacFromBirth(birth.y, birth.m, birth.d);
      setWho(ttiCard, '나의 띠: ' + z.ko + '띠');
      renderEntry(ttiCard, types.tti[z.id]);
    }

    // 별자리
    var zodCard = $('card-zodiac');
    if (!birth) { resetCard(zodCard, '생년월일을 입력하면 별자리 운세를 보여드려요.'); }
    else if (!types.zodiac) { renderMissing(zodCard); }
    else {
      var s = Manse.starSignFromBirth(birth.m, birth.d);
      setWho(zodCard, '나의 별자리: ' + s.ko);
      renderEntry(zodCard, types.zodiac[s.id]);
    }

    // 혈액형
    var bloodCard = $('card-blood');
    if (!p || !p.blood) { resetCard(bloodCard, '혈액형을 선택하면 보여드려요.'); }
    else if (!types.blood) { renderMissing(bloodCard); }
    else { setWho(bloodCard, p.blood + '형'); renderEntry(bloodCard, types.blood[p.blood]); }

    // MBTI
    var mbtiCard = $('card-mbti');
    if (!p || !p.mbti) { resetCard(mbtiCard, 'MBTI를 선택하면 보여드려요.'); }
    else if (!types.mbti) { renderMissing(mbtiCard); }
    else { setWho(mbtiCard, p.mbti); renderEntry(mbtiCard, types.mbti[p.mbti]); }

    renderTarot();
  }

  // ---- 타로 ----
  function loadTarotPick() {
    try { return JSON.parse(localStorage.getItem(TAROT_KEY)) || null; }
    catch (e) { return null; }
  }

  function renderTarot() {
    var card = $('card-tarot');
    var body = card.querySelector('.body');
    var types = state.data.types || {};
    if (!types.tarot) { renderMissing(card); return; }

    var pick = loadTarotPick();
    if (pick && pick.date === state.data.date && types.tarot[pick.card]) {
      renderTarotResult(body, pick.card);
      return;
    }
    renderTarotDeck(body);
  }

  function renderTarotDeck(body) {
    body.textContent = '';
    var deck = el('div', 'tarot-deck');
    // 22장 뒷면 — 어떤 위치에 어떤 카드가 있는지는 뽑는 순간의 셔플로 결정
    var order = Manse.TAROT.map(function (t) { return t.id; });
    for (var i = order.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    order.forEach(function (cardId) {
      var b = el('button', 'tarot-back');
      b.setAttribute('aria-label', '뒤집힌 타로 카드');
      b.addEventListener('click', function () {
        localStorage.setItem(TAROT_KEY, JSON.stringify({ date: state.data.date, card: cardId }));
        renderTarotResult(body, cardId);
      });
      deck.appendChild(b);
    });
    body.appendChild(deck);
  }

  function renderTarotResult(body, cardId) {
    var entry = state.data.types.tarot[cardId];
    var meta = null;
    for (var i = 0; i < Manse.TAROT.length; i++) {
      if (Manse.TAROT[i].id === cardId) { meta = Manse.TAROT[i]; break; }
    }
    body.textContent = '';
    var name = el('div', 'tarot-card-name', (meta ? meta.ko : cardId));
    if (meta) name.appendChild(el('small', null, meta.en + ' · ' + meta.id + '번'));
    body.appendChild(name);
    var head = el('div');
    head.appendChild(starsEl(entry.score));
    head.appendChild(el('span', 'chip keyword', entry.keyword));
    body.appendChild(head);
    body.appendChild(el('p', 'fortune-text', entry.text));
    body.appendChild(el('p', 'fortune-advice', entry.advice));
    var again = el('button', 'ghost', '다시 뽑기');
    again.style.marginTop = '10px';
    again.addEventListener('click', function () {
      localStorage.removeItem(TAROT_KEY);
      renderTarotDeck(body);
    });
    body.appendChild(again);
  }

  // ---- 프로필 UI ----
  function fillSelects() {
    var blood = $('inBlood');
    Manse.BLOOD_TYPES.forEach(function (b) {
      var o = el('option', null, b + '형'); o.value = b; blood.appendChild(o);
    });
    var mbti = $('inMbti');
    Manse.MBTI_TYPES.forEach(function (t) {
      var o = el('option', null, t); o.value = t; mbti.appendChild(o);
    });
  }

  function showProfileSummary() {
    var p = state.profile;
    var sum = $('profileSummary');
    var form = $('profileForm');
    if (!p || (!p.birth && !p.blood && !p.mbti)) {
      sum.classList.add('hidden'); form.classList.remove('hidden'); return;
    }
    sum.textContent = '';
    var b = p.birth ? Manse.parseDate(p.birth) : null; // 손상된 저장값 방어
    if (b) {
      var z = Manse.zodiacFromBirth(b.y, b.m, b.d);
      var s = Manse.starSignFromBirth(b.m, b.d);
      var stem = Manse.dayStemFromBirth(b.y, b.m, b.d);
      sum.appendChild(el('span', 'chip', p.birth));
      sum.appendChild(el('span', 'chip', z.ko + '띠'));
      sum.appendChild(el('span', 'chip', s.ko));
      sum.appendChild(el('span', 'chip', '일간 ' + stem.ko));
    }
    if (p.blood) sum.appendChild(el('span', 'chip', p.blood + '형'));
    if (p.mbti) sum.appendChild(el('span', 'chip', p.mbti));
    var edit = el('button', 'ghost', '수정');
    edit.addEventListener('click', function () {
      sum.classList.add('hidden'); form.classList.remove('hidden');
    });
    sum.appendChild(edit);
    sum.classList.remove('hidden');
    form.classList.add('hidden');
  }

  function wireProfile() {
    var p = state.profile;
    if (p) {
      if (p.birth) $('inBirth').value = p.birth;
      if (p.blood) $('inBlood').value = p.blood;
      if (p.mbti) $('inMbti').value = p.mbti;
    }
    $('btnSave').addEventListener('click', function () {
      var birth = $('inBirth').value || null;
      if (birth && !Manse.parseDate(birth)) birth = null;
      state.profile = { birth: birth, blood: $('inBlood').value || null, mbti: $('inMbti').value || null };
      saveProfile(state.profile);
      showProfileSummary();
      if (state.data) renderAll();
    });
  }

  // ---- 시작 ----
  document.addEventListener('DOMContentLoaded', function () {
    fillSelects();
    $('inBirth').max = Manse.kstToday(); // 미래 날짜 입력 방지 (하드코딩 대신 동적)
    state.profile = loadProfile();
    wireProfile();
    showProfileSummary();

    loadData().then(function (data) {
      state.data = data;
      renderAll();
    }).catch(function () {
      $('todayLine').textContent = '아직 발행된 운세 데이터가 없습니다.';
      showNotice('첫 운세는 자동화가 처음 실행된 다음 날 새벽부터 제공됩니다.');
    });
  });
})();
