/* ==========================================================================
   Salesforce Readiness Review — engine (v4)
   --------------------------------------------------------------------------
   PRIVACY. Answers live in two places, neither of which is a server.

   1. The URL fragment (after "#"). Browsers never transmit a fragment in an
      HTTP request — not the request line, not a header, not any log. That is
      what makes the link the sharing mechanism.
   2. localStorage, so a returning visitor resumes. Deliberately NOT a cookie:
      cookies are sent to the server on every request, which would make the
      claim printed on the page false.

   ENCODING is keyed, so links survive change. Each answer is written as
   <questionId><optionKey>; role, cloud and depth are written by id. A question
   that no longer exists is ignored, a new one is simply unanswered (which never
   affects the score), and a retired option is ignored. Content can change
   freely — adding, removing, reordering, rewording — without breaking a single
   saved link. Only a change to the FORMAT constant invalidates links, and that
   should essentially never happen.

   THREE GATE QUESTIONS shape everything after them: role (rewords questions),
   cloud (forks the process sections), and depth (a tier ceiling — quick pass,
   standard review, full audit). Estimated times shown in the gate are computed
   from the live question count, never hardcoded, so they stay honest.

   No analytics, no tracking, no form service, no backend. Keep it that way.
   ========================================================================== */
(function () {
  'use strict';

  var TO = 'info@architechbc.com';
  var STORE = 'abc.review';
  var FORMAT = 2;             // encoding format, NOT content version — see header
  var M = window.ASSESSMENT;

  var role = null;      // index into M.roles
  var cloud = null;     // index into M.clouds
  var depth = null;     // index into M.depths
  var answers = {};
  var ctx = {};
  var noticeDismissed = false;

  /* --- model -------------------------------------------------------------- */
  function canon() {
    return M.sections.reduce(function (a, s) { return a.concat(s.questions); }, []);
  }
  function findQuestion(id) {
    var qs = canon();
    for (var i = 0; i < qs.length; i++) if (qs[i].id === id) return qs[i];
    return null;
  }
  function roleId() { return role === null ? null : M.roles[role].id; }
  function cloudId() { return cloud === null ? null : M.clouds[cloud].id; }
  function ready() { return role !== null && cloud !== null && depth !== null; }
  function depthTier() { return depth === null ? 3 : M.depths[depth].tier; }

  // Question counts are identical across the cloud forks, so an unchosen cloud
  // can still be costed honestly using any of them.
  function countAt(tier) {
    var ci = cloud === null ? 0 : cloud, cid = M.clouds[ci].id, n = 0;
    M.sections.forEach(function (sec) {
      if (sec.clouds && sec.clouds.indexOf(cid) === -1) return;
      sec.questions.forEach(function (q) {
        if (q.clouds && q.clouds.indexOf(cid) === -1) return;
        if ((q.t || 2) <= tier) n++;
      });
    });
    return n;   // closing questions are counted separately so this matches the progress readout
  }
  // Floor: every conditional question hidden. A question with showIf can always
  // disappear, so this is the honest lower bound on a run at this depth.
  function countMinAt(tier) {
    var ci = cloud === null ? 0 : cloud, cid = M.clouds[ci].id, n = 0;
    M.sections.forEach(function (sec) {
      if (sec.clouds && sec.clouds.indexOf(cid) === -1) return;
      sec.questions.forEach(function (q) {
        if (q.clouds && q.clouds.indexOf(cid) === -1) return;
        if (q.showIf) return;
        if ((q.t || 2) <= tier) n++;
      });
    });
    return n;
  }
  function minutesFor(n) {
    return Math.max(2, Math.round((n + M.context.length) * M.secondsPerQuestion / 60));
  }

  function inCloud(o) { return !o.clouds || (cloudId() && o.clouds.indexOf(cloudId()) !== -1); }

  function isApplicable(q) {
    if (!inCloud(q)) return false;
    if ((q.t || 2) > depthTier()) return false;
    if (!q.showIf) return true;
    var c = answers[q.showIf.q];
    if (c === undefined) return true;
    if (q.showIf.not) return q.showIf.not.indexOf(c) === -1;
    if (q.showIf.in) return q.showIf.in.indexOf(c) !== -1;
    return true;
  }
  function liveSections() { return M.sections.filter(inCloud); }
  function applicableIn(sec) { return sec.questions.filter(isApplicable); }
  function applicable() {
    return liveSections().reduce(function (a, s) { return a.concat(applicableIn(s)); }, []);
  }

  // Role-specific wording. The same question, phrased so the person answering
  // recognises that they are allowed to have an opinion about it.
  function qText(q) {
    var r = roleId();
    return (q.qr && r && q.qr[r]) ? q.qr[r] : q.q;
  }
  function qHelp(q) {
    var r = roleId();
    return (q.helpr && r && q.helpr[r]) ? q.helpr[r] : q.help;
  }

  function chosen(q) {
    var i = answers[q.id];
    return (i === undefined || !q.opts[i]) ? null : q.opts[i];
  }
  function answeredCount() { return applicable().filter(chosen).length; }
  function totalCount() { return applicable().length; }
  function unsureCount() {
    return applicable().filter(function (q) { var o = chosen(q); return o && o.unsure; }).length;
  }
  function unsureRatio() { var t = totalCount(); return t ? unsureCount() / t : 0; }
  function allAnswered() { return totalCount() > 0 && answeredCount() === totalCount(); }
  function ctxDone() { return M.context.every(function (c) { return ctx[c.id] !== undefined; }); }

  function sectionScore(sec) {
    var v = [];
    applicableIn(sec).forEach(function (q) { var o = chosen(q); if (o) v.push(o.v); });
    if (!v.length) return null;
    return Math.round(v.reduce(function (a, b) { return a + b; }, 0) / (v.length * 3) * 100);
  }
  function overallScore() {
    var v = [];
    applicable().forEach(function (q) { var o = chosen(q); if (o) v.push(o.v); });
    if (!v.length) return null;
    return Math.round(v.reduce(function (a, b) { return a + b; }, 0) / (v.length * 3) * 100);
  }
  function findings() {
    var out = [];
    liveSections().forEach(function (sec) {
      applicableIn(sec).forEach(function (q) {
        var o = chosen(q);
        if (o && o.flag) out.push({
          key: q.id, section: sec.title, v: o.v,
          name: o.fn || sec.title, text: o.flag,
          severity: o.v === 0 ? 'High' : 'Medium'
        });
      });
    });
    return out.sort(function (a, b) { return a.v - b.v; });
  }
  function band(s) {
    if (s === null) return { label: '—', tone: 'none' };
    if (s >= 80) return { label: 'Solid', tone: 'good' };
    if (s >= 60) return { label: 'Workable', tone: 'ok' };
    if (s >= 35) return { label: 'Fragile', tone: 'warn' };
    return { label: 'At risk', tone: 'bad' };
  }
  function emailValid() {
    var el = document.getElementById('fEmail');
    return /^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test((el && el.value || '').trim());
  }

  /* --- state codec -------------------------------------------------------- */
  // Answers are held internally by option INDEX (what the radio inputs use)
  // and translated to permanent option KEYS only at this boundary.
  function optKey(q, i) { var o = q.opts[i]; return (o && o.k) ? o.k : null; }
  function optIndex(q, k) {
    for (var i = 0; i < q.opts.length; i++) {
      if (q.opts[i].k === k) return q.opts[i].retired ? -1 : i;
    }
    return -1;
  }
  function idOf(list, i) { return i === null ? '' : list[i].id; }
  function indexOf(list, id) {
    if (!id) return null;
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return i;
    return null;   // unknown id — a role/cloud/depth that has since gone away
  }

  function encode() {
    var a = '', c = '';
    canon().forEach(function (q) {
      var k = answers[q.id] === undefined ? null : optKey(q, answers[q.id]);
      if (k) a += q.id + k;
    });
    M.context.forEach(function (x) {
      var k = ctx[x.id] === undefined ? null : optKey(x, ctx[x.id]);
      if (k) c += x.id + k;
    });
    return [FORMAT, idOf(M.roles, role), idOf(M.clouds, cloud), idOf(M.depths, depth), a, c].join('.');
  }

  // Tokens are <id><key> where an id is letters then digits and a key is one
  // letter, so a run like "own1asec5crel1b" splits unambiguously.
  var TOKEN = /([a-z]+\d+)([a-z])/g;
  function readTokens(str, lookup, into) {
    var m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(str || ''))) {
      var q = lookup(m[1]);
      if (!q) continue;                 // question no longer exists — ignore
      var i = optIndex(q, m[2]);
      if (i < 0) continue;              // option gone or retired — ignore
      into[q.id] = i;
    }
  }

  function decode(str) {
    try {
      var p = String(str).split('.');
      if (parseInt(p[0], 10) !== FORMAT) return false;
      role = indexOf(M.roles, p[1]);
      cloud = indexOf(M.clouds, p[2]);
      depth = indexOf(M.depths, p[3]);
      readTokens(p[4], findQuestion, answers);
      readTokens(p[5], function (id) {
        for (var i = 0; i < M.context.length; i++) if (M.context[i].id === id) return M.context[i];
        return null;
      }, ctx);
      return true;
    } catch (e) {
      if (window.console) console.error('review: decode failed', e);
      return false;
    }
  }

  var suppress = false;
  function persist() {
    var empty = role === null && cloud === null && depth === null &&
                !Object.keys(answers).length && !Object.keys(ctx).length;
    suppress = true;
    history.replaceState(null, '', location.pathname + location.search + (empty ? '' : '#r=' + encode()));
    suppress = false;
    try {
      localStorage.setItem(STORE, JSON.stringify({ f: FORMAT, s: encode(), n: noticeDismissed }));
    } catch (e) { /* private mode / quota — resuming is a convenience */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return false;
      var p = JSON.parse(raw);
      if (!p || p.f !== FORMAT) return false;
      noticeDismissed = !!p.n;
      return p.s ? decode(p.s) : false;
    } catch (e) { return false; }
  }

  /* --- DOM ---------------------------------------------------------------- */
  var elGate, elNav, elBody, elCtx, elJump;

  function buildGate() {
    function group(title, hint, name, items, current, meta) {
      var h = '<div class="gate__q"><p class="gate__label">' + title + '</p>' +
              '<p class="gate__hint">' + hint + '</p><div class="gate__opts">';
      items.forEach(function (it, i) {
        h += '<label class="gopt"><input type="radio" name="' + name + '" value="' + i + '"' +
             (current === i ? ' checked' : '') + '>' +
             '<span class="gopt__box"><span class="gopt__t">' + it.label +
             (meta ? '<span class="gopt__meta">' + meta(it, i) + '</span>' : '') + '</span>' +
             '<span class="gopt__d">' + it.desc + '</span></span></label>';
      });
      return h + '</div></div>';
    }
    elGate.innerHTML =
      group('Who is answering?',
            'Questions are worded for your vantage point, so nobody is asked something in language that makes it sound like someone else’s job.',
            'role', M.roles, role) +
      group('Which part of Salesforce?',
            'Some sections only make sense for one of these, so the rest are left out entirely.',
            'cloud', M.clouds, cloud) +
      group('How deep do you want to go?',
            'Ranges, because some questions only appear depending on your earlier answers. Plus three short closing questions either way, and you can change depth whenever you like without losing anything you have answered.',
            'depth', M.depths, depth,
            function (d) {
              // A range, not a ceiling: conditional questions mean most runs are
              // shorter than the maximum, and quoting only the maximum makes the
              // review look heavier than it is.
              var hi = countAt(d.tier), lo = countMinAt(d.tier);
              var mhi = minutesFor(hi), mlo = minutesFor(lo);
              var qs = lo === hi ? hi + ' questions'
                                 : lo + '\u2013' + hi + ' questions';
              var ms = mlo === mhi ? 'about ' + mhi + ' min'
                                   : 'about ' + mlo + '\u2013' + mhi + ' min';
              return qs + ' &middot; ' + ms;
            });
  }

  function buildNav() {
    elNav.innerHTML = '';
    elJump.innerHTML = '<option value="">Jump to section…</option>';
    var last = null;
    liveSections().forEach(function (sec) {
      if (sec.step !== last) {
        last = sec.step;
        var h = document.createElement('p');
        h.className = 'revnav__step'; h.textContent = sec.step;
        elNav.appendChild(h);
      }
      var a = document.createElement('a');
      a.className = 'revnav__item'; a.href = '#sec-' + sec.id; a.dataset.sec = sec.id;
      a.innerHTML = '<span>' + sec.title + '</span><span class="revnav__count" data-count="' + sec.id + '"></span>';
      elNav.appendChild(a);

      var o = document.createElement('option');
      o.value = 'sec-' + sec.id; o.dataset.sec = sec.id; o.textContent = sec.title;
      elJump.appendChild(o);
    });
  }

  function buildBody() {
    elBody.innerHTML = '';
    var frag = document.createDocumentFragment();
    liveSections().forEach(function (sec, si) {
      var w = document.createElement('section');
      w.className = 'qsec'; w.id = 'sec-' + sec.id; w.dataset.sec = sec.id;
      w.innerHTML =
        '<div class="qsec__head"><span class="qsec__step">' + sec.step + ' &middot; ' +
        String(si + 1).padStart(2, '0') + '</span><h2>' + sec.title + '</h2><p>' + sec.blurb + '</p>' +
        '<div class="qsec__meter"><span data-bar="' + sec.id + '"></span></div></div>';

      sec.questions.forEach(function (q) {
        if (!inCloud(q)) return;
        var d = document.createElement('div');
        d.className = 'q'; d.dataset.q = q.id;
        var h = '<p class="q__text">' + qText(q) + '</p>';
        var hp = qHelp(q);
        if (hp) h += '<p class="q__help">' + hp + '</p>';
        h += '<div class="q__opts">';
        q.opts.forEach(function (o, oi) {
          if (o.retired) return;   // index preserved so old links still resolve; never shown
          h += '<label class="qopt' + (o.unsure ? ' qopt--unsure' : '') + '">' +
               '<input type="radio" name="' + q.id + '" value="' + oi + '">' +
               '<span class="qopt__box">' + o.label + '</span></label>';
        });
        h += '</div><button type="button" class="q__clear" data-clear="' + q.id + '" hidden>Clear</button>';
        d.innerHTML = h;
        w.appendChild(d);
      });
      frag.appendChild(w);
    });
    elBody.appendChild(frag);
  }

  function buildContext() {
    elCtx.innerHTML = '';
    M.context.forEach(function (c) {
      var d = document.createElement('div');
      d.className = 'q'; d.dataset.ctxq = c.id;
      var h = '<p class="q__text">' + c.q + '</p><div class="q__opts">';
      c.opts.forEach(function (o, i) {
        h += '<label class="qopt"><input type="radio" name="' + c.id + '" value="' + i + '">' +
             '<span class="qopt__box">' + o.label + '</span></label>';
      });
      elCtx.appendChild(d);
      d.innerHTML = h + '</div>';
    });
  }

  function applyState() {
    Object.keys(answers).forEach(function (id) {
      var el = document.querySelector('input[name="' + id + '"][value="' + answers[id] + '"]');
      if (el) el.checked = true;
    });
    Object.keys(ctx).forEach(function (id) {
      var el = document.querySelector('input[name="' + id + '"][value="' + ctx[id] + '"]');
      if (el) el.checked = true;
    });
  }

  function rebuild() {
    buildNav(); buildBody(); buildContext(); applyState(); render();
  }

  /* --- render ------------------------------------------------------------- */
  function render() {
    document.getElementById('revShell').hidden = !ready();
    document.getElementById('gateHint').hidden = ready();

    if (!ready()) {
      document.getElementById('progText').textContent = 'Answer the three questions above to begin';
      document.getElementById('progBar').style.width = '0%';
      document.getElementById('ovScore').textContent = '—';
      var b0 = document.getElementById('ovBand');
      b0.textContent = '—'; b0.dataset.tone = 'none';
      document.getElementById('results').hidden = true;
      return;
    }

    liveSections().forEach(function (sec) {
      sec.questions.forEach(function (q) {
        var el = document.querySelector('[data-q="' + q.id + '"]');
        if (el) el.hidden = !isApplicable(q);
      });
      var apps = applicableIn(sec);
      var n = apps.filter(chosen).length;
      var c = document.querySelector('[data-count="' + sec.id + '"]');
      if (c) {
        c.textContent = n + '/' + apps.length;
        c.classList.toggle('is-done', apps.length > 0 && n === apps.length);
      }
      var bar = document.querySelector('[data-bar="' + sec.id + '"]');
      if (bar) bar.style.width = (apps.length ? n / apps.length * 100 : 0) + '%';
      var o = elJump.querySelector('[data-sec="' + sec.id + '"]');
      if (o) o.textContent = sec.title + '  (' + n + '/' + apps.length + ')';
      apps.forEach(function () {});
    });

    canon().forEach(function (q) {
      var b = document.querySelector('[data-clear="' + q.id + '"]');
      if (b) b.hidden = !chosen(q);
    });

    var done = answeredCount(), total = totalCount();
    var ov = overallScore(), bd = band(ov);
    document.getElementById('progText').textContent = done + ' of ' + total + ' answered';
    document.getElementById('progBar').style.width = (total ? done / total * 100 : 0) + '%';
    document.getElementById('ovScore').textContent = ov === null ? '—' : ov + '%';
    var be = document.getElementById('ovBand');
    be.textContent = bd.label; be.dataset.tone = bd.tone;

    var sc = document.getElementById('scorecard');
    sc.innerHTML = '';
    liveSections().forEach(function (sec) {
      var s = sectionScore(sec), b = band(s);
      var row = document.createElement('div');
      row.className = 'score';
      row.innerHTML = '<a class="score__name" href="#sec-' + sec.id + '">' + sec.title + '</a>' +
        '<div class="score__track"><span style="width:' + (s === null ? 0 : s) + '%" data-tone="' + b.tone + '"></span></div>' +
        '<span class="score__val" data-tone="' + b.tone + '">' + (s === null ? '—' : s + '%') + '</span>';
      sc.appendChild(row);
    });

    var f = findings(), fl = document.getElementById('findings');
    fl.innerHTML = '';
    document.getElementById('findingsWrap').hidden = !f.length;
    document.getElementById('findingsCount').textContent = f.length;
    f.forEach(function (x) {
      var li = document.createElement('li');
      li.className = 'finding'; li.dataset.sev = x.v === 0 ? 'high' : 'med';
      li.innerHTML = '<span class="finding__sec">' + x.section + ' &middot; ' + x.severity + '</span><p>' + x.text + '</p>';
      fl.appendChild(li);
    });
    document.getElementById('noFindings').hidden = !(done > 0 && !f.length);

    document.getElementById('results').hidden = done === 0;
    document.getElementById('emptyState').hidden = done !== 0;
    document.getElementById('btnLink').disabled = done === 0;
    document.getElementById('btnXlsx').disabled = done === 0;

    var remaining = total - done;
    var over = unsureRatio() > M.unsureCeiling;
    var cLeft = M.context.filter(function (c) { return ctx[c.id] === undefined; }).length;
    document.getElementById('sendReqs').innerHTML =
      '<li data-met="' + (remaining === 0) + '">' +
        (remaining === 0 ? 'All questions answered' :
         remaining + ' question' + (remaining === 1 ? '' : 's') + ' still to answer') + '</li>' +
      '<li data-met="' + (cLeft === 0) + '">' +
        (cLeft === 0 ? 'Closing questions answered' : 'Three short closing questions') + '</li>' +
      '<li data-met="' + (!over) + '">' +
        (over ? 'Too much of the org is unknown to review' : 'Enough of the org is known to review') + '</li>';

    var msg = document.getElementById('sendMsg');
    if (msg && !msg.hidden && allAnswered() && ctxDone() && !over && emailValid()) msg.hidden = true;
  }

  /* --- workbook ----------------------------------------------------------- */
  function buildWorkbook(link) {
    var S = window.XLSX_STYLE, ov = overallScore(), f = findings();

    var t1 = [[
      { v: 'Key', s: S.HEADER }, { v: 'Group', s: S.HEADER }, { v: 'Stage', s: S.HEADER },
      { v: 'Question', s: S.HEADER }, { v: 'Your answer', s: S.HEADER },
      { v: 'Score (0-3)', s: S.HEADER }, { v: 'Group readiness %', s: S.HEADER },
      { v: 'Flag raised', s: S.HEADER }
    ]];
    liveSections().forEach(function (sec) {
      var gs = sectionScore(sec);
      applicableIn(sec).forEach(function (q) {
        var o = chosen(q);
        t1.push([
          { v: q.id, s: S.BODY }, { v: sec.title, s: S.BODY }, { v: sec.step, s: S.BODY },
          { v: qText(q), s: S.BODY }, { v: o ? o.label : '', s: S.BODY },
          o ? { v: o.v, t: 'n', s: S.NUM } : { v: '', s: S.NUM },
          gs === null ? { v: '', s: S.NUM } : { v: gs, t: 'n', s: S.NUM },
          { v: o && o.flag ? 'Yes' : (o ? 'No' : ''), s: S.NUM }
        ]);
      });
    });
    M.context.forEach(function (c) {
      var i = ctx[c.id];
      t1.push([
        { v: c.id, s: S.BODY }, { v: 'Closing', s: S.BODY }, { v: 'Engage', s: S.BODY },
        { v: c.q, s: S.BODY }, { v: i === undefined ? '' : c.opts[i].label, s: S.BODY },
        { v: '', s: S.NUM }, { v: '', s: S.NUM }, { v: '', s: S.NUM }
      ]);
    });

    var t2 = [[
      { v: 'Key', s: S.HEADER }, { v: 'Group', s: S.HEADER }, { v: 'Flag', s: S.HEADER },
      { v: 'Severity', s: S.HEADER }, { v: 'What it means', s: S.HEADER }
    ]];
    if (f.length) f.forEach(function (x) {
      t2.push([
        { v: x.key, s: S.BODY }, { v: x.section, s: S.BODY }, { v: x.name, s: S.BOLD },
        { v: x.severity, s: x.severity === 'High' ? S.SEV_HIGH : S.SEV_MED },
        { v: x.text, s: S.BODY }
      ]);
    });
    else t2.push([{ v: '', s: S.BODY }, { v: '', s: S.BODY }, { v: 'No flags raised', s: S.BOLD },
                  { v: '—', s: S.NUM }, { v: 'Nothing in the answers given triggered a finding.', s: S.BODY }]);

    var bd = band(ov);
    var t3 = [
      [{ v: 'Salesforce Readiness Review', s: S.TITLE }], [],
      [{ v: 'Answering as', s: S.BOLD }, { v: role === null ? '' : M.roles[role].label }],
      [{ v: 'Area reviewed', s: S.BOLD }, { v: cloud === null ? '' : M.clouds[cloud].label }],
      [{ v: 'Depth', s: S.BOLD }, { v: depth === null ? '' : M.depths[depth].label }],
      [{ v: 'Overall readiness %', s: S.BOLD }, ov === null ? { v: '' } : { v: ov, t: 'n', s: S.NUM }],
      [{ v: 'Rating', s: S.BOLD }, { v: bd.label }],
      [{ v: 'Questions answered', s: S.BOLD }, { v: answeredCount(), t: 'n', s: S.NUM }],
      [{ v: 'Questions applicable', s: S.BOLD }, { v: totalCount(), t: 'n', s: S.NUM }],
      [{ v: 'Answered "Not sure"', s: S.BOLD }, { v: unsureCount(), t: 'n', s: S.NUM }],
      [{ v: 'Flags raised', s: S.BOLD }, { v: f.length, t: 'n', s: S.NUM }],
      [{ v: 'Generated', s: S.BOLD }, { v: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) }],
      [],
      [{ v: 'Reopen or update this review', s: S.BOLD }],
      [{ v: link, s: S.LINK, link: link }], [],
      [{ v: 'This link is the only copy of your answers. It was never sent to a server — the ' +
            'answers travel inside the link itself. Anyone you give it to can see them; nobody else can.', s: S.MUTED }],
      [{ v: 'Produced at architechbc.com/scope — free to take anywhere, including to another consultancy.', s: S.MUTED }]
    ];

    return window.buildXlsx([
      { name: 'Review', cols: [10, 22, 10, 54, 34, 11, 17, 11], freeze: 1, autofilter: 'A1:H' + t1.length, rows: t1 },
      { name: 'Flags', cols: [10, 22, 28, 11, 80], freeze: 1, autofilter: 'A1:E' + t2.length, rows: t2 },
      { name: 'Your link', cols: [26, 64], rows: t3 }
    ]);
  }

  /* --- misc --------------------------------------------------------------- */
  function download(name, blob) {
    var u = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(u); }, 1500);
  }
  function shareUrl() { persist(); return location.href; }
  function toast(m) {
    var t = document.getElementById('toast');
    t.textContent = m; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 5200);
  }
  function copy(text, m) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(m); }, function () { toast(m); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); toast(m);
    }
  }

  function initNotice() {
    var n = document.getElementById('notice');
    if (!n) return;
    if (noticeDismissed) { n.remove(); return; }
    setTimeout(function () { n.dataset.show = 'true'; }, 1400);

    function dismiss() {
      n.dataset.show = 'false'; noticeDismissed = true; persist();
      setTimeout(function () { n.remove(); }, 400);
    }
    n.querySelectorAll('[data-dismiss]').forEach(function (b) {
      b.addEventListener('click', dismiss);
    });

    var x0 = null, y0 = null;
    n.addEventListener('touchstart', function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    n.addEventListener('touchmove', function (e) {
      if (x0 === null) return;
      var dx = e.touches[0].clientX - x0, dy = Math.max(0, e.touches[0].clientY - y0);
      if (Math.abs(dx) > 10 || dy > 10) {
        n.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        n.style.opacity = String(Math.max(0, 1 - (Math.abs(dx) + dy) / 200));
      }
    }, { passive: true });
    n.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 70 || dy > 70) dismiss();
      else { n.style.transform = ''; n.style.opacity = ''; }
      x0 = y0 = null;
    });
  }

  /* --- init --------------------------------------------------------------- */
  function init() {
    elGate = document.getElementById('revGate');
    elNav = document.getElementById('revNav');
    elBody = document.getElementById('revBody');
    elCtx = document.getElementById('revContext');
    elJump = document.getElementById('revJump');

    // A link always wins over local state, and becomes the local state: the
    // page promises that a link resumes the review on any device, so opening
    // one has to leave something behind for the next visit. persist() also
    // rewrites the hash in canonical form, which quietly drops any tokens a
    // hostile or stale link carried for questions that no longer exist.
    var fromLink = false;
    var m = location.hash.match(/[#&]r=([A-Za-z0-9._\-]+)/);
    if (m) fromLink = decode(m[1]);
    if (fromLink) persist(); else restore();

    buildGate();
    rebuild();
    initNotice();

    elGate.addEventListener('change', function (e) {
      if (e.target.name === 'role') role = parseInt(e.target.value, 10);
      else if (e.target.name === 'cloud') cloud = parseInt(e.target.value, 10);
      else if (e.target.name === 'depth') depth = parseInt(e.target.value, 10);
      else return;
      persist();
      if (e.target.name === 'cloud') buildGate();   // counts change; role/depth do not move them
      rebuild();
      if (ready()) {
        var s = document.getElementById('revShell');
        setTimeout(function () { s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
      }
    });

    elBody.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      answers[e.target.name] = parseInt(e.target.value, 10);
      persist(); render();
    });
    elBody.addEventListener('click', function (e) {
      var b = e.target.closest('[data-clear]');
      if (!b) return;
      delete answers[b.dataset.clear];
      var c = document.querySelector('input[name="' + b.dataset.clear + '"]:checked');
      if (c) c.checked = false;
      persist(); render();
    });
    elCtx.addEventListener('change', function (e) {
      if (e.target.type !== 'radio') return;
      ctx[e.target.name] = parseInt(e.target.value, 10);
      persist(); render();
    });
    elJump.addEventListener('change', function () {
      if (!elJump.value) return;
      var t = document.getElementById(elJump.value);
      if (t) t.scrollIntoView({ behavior: 'smooth' });
      elJump.value = '';
    });
    document.getElementById('fEmail').addEventListener('input', render);

    document.getElementById('btnLink').addEventListener('click', function () {
      copy(shareUrl(), 'Link copied. Your answers travel inside it — they were never sent anywhere.');
    });
    document.getElementById('btnXlsx').addEventListener('click', function () {
      try {
        download('salesforce-readiness-review.xlsx', buildWorkbook(shareUrl()));
        toast('Workbook downloaded — three tabs, filterable, yours to take anywhere.');
      } catch (e) {
        toast('Could not build the workbook in this browser. Copy your link instead.');
      }
    });

    document.getElementById('btnSend').addEventListener('click', function () {
      var msg = document.getElementById('sendMsg');
      var em = document.getElementById('fEmail');
      function refuse(t) { msg.textContent = t; msg.hidden = false; }

      var total = totalCount(), done = answeredCount();
      if (done < total) {
        refuse('Please answer the remaining ' + (total - done) + ' question' +
               ((total - done) === 1 ? '' : 's') + ' first — a partial picture is not one anyone can judge fairly.');
        var f0 = applicable().filter(function (q) { return !chosen(q); })[0];
        var el = f0 && document.querySelector('[data-q="' + f0.id + '"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (!ctxDone()) {
        refuse('Just the three short closing questions to go.');
        elCtx.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (unsureRatio() > M.unsureCeiling) {
        refuse('A lot of this came back as "Not sure", which is worth knowing in itself — but it ' +
               'leaves too much unknown for anyone to review sensibly. It is worth going through ' +
               'the uncertain ones with whoever administers your org. Your answers are saved, so ' +
               'you can pick this up together. That conversation is often more valuable than this review.');
        return;
      }
      if (!(em.value || '').trim()) {
        refuse('An email address is needed to reply to. It is used for that and nothing else.');
        em.focus(); return;
      }
      if (!emailValid()) {
        refuse('That address does not look right — check for a typo, or there is no way to reach you.');
        em.focus(); em.select(); return;
      }
      msg.hidden = true;

      var ov = overallScore(), f = findings(), L = [];
      L.push('Submitting my Salesforce Readiness Review.');
      L.push('');
      L.push('Email:    ' + em.value.trim());
      var co = document.getElementById('fCompany').value.trim();
      if (co) L.push('Company:  ' + co);
      L.push('Role:     ' + (role === null ? '' : M.roles[role].label));
      L.push('Area:     ' + (cloud === null ? '' : M.clouds[cloud].label));
      L.push('Depth:    ' + (depth === null ? '' : M.depths[depth].label));
      L.push('');
      L.push('Overall readiness: ' + (ov === null ? 'n/a' : ov + '% (' + band(ov).label + ')'));
      L.push('Answered: ' + done + ' of ' + total + '  (' + unsureCount() + ' not sure)');
      L.push('Flags raised: ' + f.length);
      L.push('');
      liveSections().forEach(function (sec) {
        var s = sectionScore(sec);
        L.push('  ' + (sec.title + ':').padEnd(28) + (s === null ? 'n/a' : s + '%'));
      });
      L.push('');
      L.push('Full answers — this link contains them and is the only copy:');
      L.push(shareUrl());
      L.push('');
      window.location.href = 'mailto:' + TO +
        '?subject=' + encodeURIComponent('Readiness Review — ' + (co || 'submission')) +
        '&body=' + encodeURIComponent(L.join('\n'));
    });

    document.getElementById('btnReset').addEventListener('click', function () {
      if (role === null && cloud === null && depth === null && !Object.keys(answers).length) return;
      if (!confirm('Clear every answer and start over? This cannot be undone.')) return;
      role = null; cloud = null; depth = null; answers = {}; ctx = {};
      document.getElementById('sendMsg').hidden = true;
      try { localStorage.removeItem(STORE); } catch (e) {}
      noticeDismissed = true;
      buildGate(); persist(); rebuild();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast('Cleared. Starting fresh.');
    });

    window.addEventListener('hashchange', function () {
      if (suppress) return;
      var mm = location.hash.match(/[#&]r=([A-Za-z0-9._\-]+)/);
      if (!mm) return;
      role = null; cloud = null; depth = null; answers = {}; ctx = {};
      if (decode(mm[1])) { persist(); buildGate(); rebuild(); }
    });

    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
