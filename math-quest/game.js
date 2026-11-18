// game.js - 算数クエスト（画面・進行・記録）

const $ = id => document.getElementById(id);

// ===== 記録（localStorage） =====
const STORAGE_KEY = 'math-quest-progress-v1';

function defaultProgress() {
    return {
        stages: {},        // { [stageId]: { s1, s2, boss, passedCheck, bestMs, bestHearts } }
        cards: {},         // { [cardId]: { n, ok, streak, lastWrong } }  streak = はやく正解した連続回数（最大3）
        method: 'genka',   // ひき算のとき方: 'genka'（減加法） | 'gengen'（減減法）
        checkDone: false,
        lastPlayedDate: null,
        streak: 0,
        totalCorrect: 0,
        totalAnswered: 0,
    };
}

function loadProgress() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultProgress();
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return defaultProgress();
        return Object.assign(defaultProgress(), parsed);
    } catch (e) {
        return defaultProgress();
    }
}

function saveProgress() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) { /* 保存できなくても遊べる */ }
}

let progress = loadProgress();

// ===== 日付・連続日数 =====
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(dateStr, n) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function touchStreak() {
    const t = todayStr();
    if (progress.lastPlayedDate === t) return;
    progress.streak = progress.lastPlayedDate === addDays(t, -1) ? progress.streak + 1 : 1;
    progress.lastPlayedDate = t;
}
function currentStreak() {
    const t = todayStr();
    return progress.lastPlayedDate === t || progress.lastPlayedDate === addDays(t, -1) ? progress.streak : 0;
}

// ===== ステージの状態 =====
function stageById(id) { return STAGES.find(s => s.id === id); }
function peekRec(id) { return progress.stages[id] || {}; }
function stageRec(id) {
    if (!progress.stages[id]) progress.stages[id] = {};
    return progress.stages[id];
}
function isCleared(id) { const r = peekRec(id); return !!(r.boss || r.passedCheck); }
function isUnlocked(id) { return id === 1 || isCleared(id) || isCleared(id - 1); }
function isStepDone(stage, step) {
    const r = peekRec(stage.id);
    return step === 'guided' ? !!r.s1 : step === 'practice' ? !!r.s2 : !!r.boss;
}
function isStepUnlocked(stage, step) {
    if (!isUnlocked(stage.id)) return false;
    if (peekRec(stage.id).passedCheck) return true;
    const i = stage.steps.indexOf(step);
    return i <= 0 || isStepDone(stage, stage.steps[i - 1]);
}
function nextStepOf(stage) { return stage.steps.find(st => isStepUnlocked(stage, st) && !isStepDone(stage, st)) || null; }
function recommendedStageId() {
    const s = STAGES.find(s => isUnlocked(s.id) && !isCleared(s.id));
    return s ? s.id : null;
}
function stepLabel(stage, step) { return step === 'guided' && stage.guidedLabel ? stage.guidedLabel : STEP_INFO[step].label; }
function stepMeta(stage, step) {
    if (step === 'guided' && stage.guidedMeta) return stage.guidedMeta;
    if (step === 'boss' && stage.kind === 'mix') return `${MIX_BOSS_COUNT}問・時間制限あり・ハート${MAX_HEARTS}つ`;
    return STEP_INFO[step].meta;
}
function masteredCount(facts, kind) {
    const ids = facts ? facts.map(([a, b]) => cardIdOf(kind, a, b)) : Object.keys(progress.cards);
    return ids.filter(id => progress.cards[id] && progress.cards[id].streak >= 3).length;
}
function fmtSec(ms) { return (ms / 1000).toFixed(1); }
function heartsHtml(h) { return '❤️'.repeat(Math.max(0, h)) + '🖤'.repeat(Math.max(0, MAX_HEARTS - h)); }

// ===== 画面切替 =====
let screenShownAt = 0;
function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $(id).classList.add('active');
    screenShownAt = performance.now();
    window.scrollTo(0, 0);
}

// ===== タイトル =====
function renderTitle() {
    // 実力チェックがまだなら、チェックを一番上・一番目立つボタンにする
    const checkBtn = $('titleCheckBtn'), mapBtn = $('titleMapBtn');
    checkBtn.className = 'btn ' + (progress.checkDone ? 'btn-secondary' : 'btn-primary');
    mapBtn.className = 'btn ' + (progress.checkDone ? 'btn-primary' : 'btn-secondary');
    checkBtn.textContent = progress.checkDone ? '🎯 実力チェックをもう一度' : '🎯 まずは実力チェック';
    checkBtn.style.order = progress.checkDone ? 2 : 1;
    mapBtn.style.order = progress.checkDone ? 1 : 2;
}
function showTitle() { renderTitle(); show('titleScreen'); }

function resetAll() {
    if (!confirm('学習データをぜんぶ消して、はじめからにする？')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* 何もしない */ }
    progress = defaultProgress();
    showTitle();
}

// ===== マップ =====
function openMap() { renderMap(); show('mapScreen'); }
function renderMap() {
    $('mapCleared').textContent = `クリアしたステージ: ${STAGES.filter(s => isCleared(s.id)).length} / ${STAGES.length}`;
    $('mapCards').textContent = `★3の計算カード: ${masteredCount()} / ${CARD_TOTAL}まい`;
    $('mapStreak').textContent = currentStreak();
    const rec = recommendedStageId();
    $('stageGrid').innerHTML = STAGES.map(s => {
        const unlocked = isUnlocked(s.id), r = peekRec(s.id);
        const cls = ['stage-card',
            isCleared(s.id) ? 'cleared' : '',
            unlocked ? '' : 'locked',
            s.kind === 'mix' ? 'boss' : '',
            s.id === rec ? 'recommended' : ''].join(' ');
        const dots = s.steps.map(st => `<span class="step-dot ${isStepDone(s, st) ? 'done' : ''}">${STEP_INFO[st].num}</span>`).join('');
        let status = '';
        if (r.passedCheck && !r.boss) status = '<div class="stage-status">🎯 実力チェック合格</div>';
        else if (r.bestMs != null) status = `<div class="stage-status">ボス戦ベスト ${fmtSec(r.bestMs)}秒</div>`;
        return `<div class="${cls}" ${unlocked ? `onclick="openStage(${s.id})"` : ''}>
            ${s.id === rec ? '<div class="rec-tag">おすすめ</div>' : ''}
            <div class="stage-icon">${unlocked ? s.icon : '🔒'}</div>
            <div class="stage-no">ステージ${s.id}</div>
            <div class="stage-name">${s.name}</div>
            <div class="stage-example">${s.example}</div>
            <div class="step-dots">${dots}</div>
            ${status}
        </div>`;
    }).join('');
}

// ===== ステージ紹介 =====
let currentStageId = null;
function openStage(id) {
    currentStageId = id;
    renderStageIntro();
    show('stageScreen');
}

function renderStageIntro() {
    const s = stageById(currentStageId), r = peekRec(s.id), next = nextStepOf(s);
    let html = `<div class="intro-enemy">${s.enemy}</div>
        <div class="intro-title">ステージ${s.id}　${s.name}</div>
        <div class="intro-enemy-name">${s.enemyName}が あらわれた！</div>
        <div class="intro-skill-box">${s.lesson}</div>`;
    if (s.examples) {
        const sub = s.kind === 'sub1' || s.kind === 'sub2';
        const p = makeProblem(...(sub ? s.examples[progress.method] : s.examples.any));
        html += `<div class="example-box"><div class="explain-title">れい</div>${sub ? methodToggleHtml(p) : ''}${renderExplain(p, progress.method)}</div>`;
    }
    html += '<div class="step-list">' + s.steps.map(st => {
        const done = isStepDone(s, st), unlocked = isStepUnlocked(s, st);
        const best = st === 'boss' && r.bestMs != null ? `<span class="step-best">ベスト ${fmtSec(r.bestMs)}秒</span>` : '';
        return `<button class="step-btn ${done ? 'done' : ''} ${st === next ? 'next' : ''}" ${unlocked ? '' : 'disabled'} onclick="startSession('${st}', ${s.id})">
            <span class="step-num">${STEP_INFO[st].num}</span>
            <span class="step-body"><span class="step-label">${stepLabel(s, st)}</span><span class="step-meta">${stepMeta(s, st)}</span>${best}</span>
            <span class="step-state">${done ? '✅' : unlocked ? '▶' : '🔒'}</span>
        </button>`;
    }).join('') + '</div>';
    if (r.passedCheck && !r.boss) html += '<p class="intro-note">実力チェック合格！ どのステップからでもちょうせんできるよ。</p>';
    $('stageContent').innerHTML = html;
}

// ===== ひき算のとき方（減加法・減減法）の切りかえ =====
function methodToggleHtml(p) {
    if (p && p.kind === 'sub2' && p.a % 10 === 0) {
        return '<div class="method-toggle"><span>一の位が0なので、この問題は減加法でとこう</span></div>';
    }
    const m = progress.method;
    return `<div class="method-toggle"><span>とき方：</span>
        <button class="method-btn ${m === 'genka' ? 'active' : ''}" onclick="setMethod('genka')">減加法<small>（10からひく）</small></button>
        <button class="method-btn ${m === 'gengen' ? 'active' : ''}" onclick="setMethod('gengen')">減減法<small>（ばらからひく）</small></button>
    </div>`;
}

function setMethod(m) {
    if (progress.method === m) return;
    progress.method = m;
    saveProgress();
    if ($('modal').classList.contains('open')) renderModal();
    const active = document.querySelector('.screen.active');
    if (!active) return;
    if (active.id === 'stageScreen') renderStageIntro();
    if (active.id === 'battleScreen' && isSubKind(S.cur)) {
        if (S.phase === 'answer' && S.plan) {
            // 手順モードのとちゅうで切りかえたら、その問題を新しいとき方で1からやり直す
            S.plan = buildPlan(S.cur, effectiveMethod(S.cur, m));
            S.stepIdx = 0; S.stepWrong = 0; S.stepMsg = null;
            renderQArea();
            focusInput();
        } else if (S.phase === 'feedback' && $('fbExplain')) {
            $('fbExplain').innerHTML = explainBlockInner(S.cur);
        }
    }
}

// ===== 式・さくらんぼ・10のわく の描画 =====
// blank: 'input'（答えを入れる）/ 'q'（？）/ { value, cls }（答えを表示）
function renderEq(p, { blank, plan = null, done = 0, small = false }) {
    const colors = plan ? plan.colors : {};
    let hasCherry = false;
    const parts = tokensOf(p).map((t, i) => {
        if (t.t === 'blank') {
            if (blank === 'input') {
                return '<input id="ansInput" class="ans-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="3" aria-label="こたえ">';
            }
            if (blank === 'q') return '<span class="tok blank-q">？</span>';
            return `<span class="tok blank-val ${blank.cls || ''}">${blank.value}</span>`;
        }
        if (t.t === 'num') {
            let cherry = '';
            if (plan && plan.cherryAt === i) {
                hasCherry = true;
                const balls = plan.balls.map((v, bi) => done >= plan.ballShownAfter[bi]
                    ? `<span class="ball">${v}</span>`
                    : '<span class="ball q">？</span>').join('');
                cherry = `<span class="cherry"><svg class="cherry-stem" viewBox="0 0 110 34" aria-hidden="true"><path d="M55 3 L22 33 M55 3 L88 33"/></svg><span class="balls">${balls}</span></span>`;
            }
            return `<span class="tok num ${colors[i] || ''}">${t.v}${cherry}</span>`;
        }
        return `<span class="tok ${t.t}">${t.v}</span>`;
    });
    return `<div class="eq${hasCherry ? ' with-cherry' : ''}${small ? ' eq-sm' : ''}">${parts.join('')}</div>`;
}

function renderFrames(fr) {
    if (!fr) return '';
    const frames = fr.frames.map(f =>
        `<div class="tenframe${f.hl ? ' hl' : ''}">${f.cells.map(c => `<span class="cell ${c}"></span>`).join('')}</div>`).join('');
    return `<div class="frames">${frames}</div>${fr.caption ? `<div class="frame-caption">${fr.caption}</div>` : ''}`;
}

function renderLines(lines) {
    if (!lines.length) return '';
    return `<div class="work-lines">${lines.map(l => `<div class="work-line">${l}</div>`).join('')}</div>`;
}

// 答えつきの「とき方」（式＋さくらんぼ＋10のわく＋計算のあと）
function renderExplain(p, method) {
    const plan = buildPlan(p, effectiveMethod(p, method));
    return renderEq(p, { blank: { value: p.answer, cls: 'ok' }, plan, done: Infinity, small: true })
        + renderFrames(framesFor(p, plan, Infinity))
        + renderLines(explainLines(p, plan));
}

function explainBlockInner(p) {
    const toggle = isSubKind(p) && buildPlan(p, 'genka') ? methodToggleHtml(p) : '';
    return `<div class="explain-title">とき方</div>${toggle}${renderExplain(p, progress.method)}`;
}

// ===== バトル（問題を解く画面） =====
const S = {
    mode: null,        // 'guided' | 'practice' | 'boss' | 'check' | 'weak'
    stage: null,
    queue: [], total: 0,
    cur: null, plan: null,
    stepIdx: 0, stepWrong: 0, stepMsg: null, guidedMiss: false,
    phase: 'done',     // 'answer' | 'feedback' | 'done'
    waitEnter: false,
    enemyHp: 0, enemyMaxHp: 0, hearts: MAX_HEARTS,
    answered: 0, correct: 0, wrong: 0, sessionMs: 0,
    results: [], newlyMastered: [],
    startTs: 0, timer: null, pending: null, limitMs: 0,
    wasCleared: false,
};

function startSession(mode, stageId, opts = {}) {
    clearTimers();
    const stage = stageId ? stageById(stageId) : null;
    let queue;
    if (mode === 'check') queue = genCheckProblems();
    else if (mode === 'weak') queue = opts.problems;
    else {
        const count = mode === 'guided' ? GUIDED_COUNT : mode === 'practice' ? PRACTICE_COUNT
            : stage.kind === 'mix' ? MIX_BOSS_COUNT : BOSS_COUNT;
        queue = genStageProblems(stage.kind, mode, count, progress.cards, progress.method);
    }
    Object.assign(S, {
        mode, stage, queue, total: queue.length,
        enemyHp: queue.length, enemyMaxHp: queue.length, hearts: MAX_HEARTS,
        answered: 0, correct: 0, wrong: 0, sessionMs: 0,
        results: [], newlyMastered: [],
        cur: null, plan: null, phase: 'answer', waitEnter: false,
        wasCleared: stage ? isCleared(stage.id) : false,
    });
    setupBattleHud();
    show('battleScreen');
    nextProblem();
}

function startCheck() { startSession('check', null); }

function setupBattleHud() {
    const check = S.mode === 'check';
    $('battleHps').style.display = check ? 'none' : '';
    $('battleScene').style.display = check ? 'none' : '';
    $('timerWrap').style.display = S.mode === 'boss' ? '' : 'none';
    const enemy = S.mode === 'weak' ? { icon: '👺', name: 'にがてオニ' }
        : S.stage ? { icon: S.stage.enemy, name: S.stage.enemyName } : null;
    if (enemy) {
        $('enemySprite').textContent = enemy.icon;
        $('enemyLabel').textContent = `${enemy.icon} ${enemy.name}`;
    }
    $('enemySprite').className = 'enemy-sprite';
    let chip;
    if (check) chip = '🎯 実力チェック';
    else if (S.mode === 'weak') chip = '🃏 にがてカード特訓';
    else chip = `ステージ${S.stage.id} ${S.stage.name} ・ ${STEP_INFO[S.mode].num} ${stepLabel(S.stage, S.mode)}`;
    $('battleStageChip').textContent = chip;
    updateHud();
}

function updateHud() {
    if (S.mode !== 'check') {
        $('enemyHpFill').style.width = (S.enemyMaxHp ? S.enemyHp / S.enemyMaxHp * 100 : 0) + '%';
        $('enemyHpText').textContent = `${S.enemyHp}/${S.enemyMaxHp}`;
        $('playerStatus').innerHTML = S.mode === 'boss' ? `<span class="hearts">${heartsHtml(S.hearts)}</span>` : `⭕ 正解 ${S.correct}`;
        $('qProgress').textContent = `たおすまで あと${S.enemyHp}問`;
    } else {
        $('qProgress').textContent = `${Math.min(S.answered + 1, S.total)} / ${S.total} 問目`;
    }
}

function nextProblem() {
    clearTimers();
    const finished = S.queue.length === 0 || (S.mode !== 'check' && S.enemyHp <= 0);
    if (finished) { finishSession(); return; }
    S.cur = S.queue.shift();
    S.plan = S.mode === 'guided' ? buildPlan(S.cur, effectiveMethod(S.cur, progress.method)) : null;
    S.stepIdx = 0; S.stepWrong = 0; S.stepMsg = null; S.guidedMiss = false;
    S.phase = 'answer';
    S.waitEnter = false;
    $('fbBox').innerHTML = '';
    renderQArea();
    updateHud();
    S.startTs = performance.now();
    if (S.mode === 'boss') startTimer();
    focusInput();
}

let imeTipShown = false;

// 問題エリアを描く。answered: 答えたあと（{ given, ok }）
function renderQArea(answered) {
    const p = S.cur;
    let html = '';
    if (S.plan) {
        // ① 手順モード（さくらんぼ計算を1ステップずつ）
        const steps = S.plan.steps, done = S.stepIdx, complete = done >= steps.length;
        html += renderEq(p, { blank: complete ? { value: p.answer, cls: 'ok' } : 'q', plan: S.plan, done });
        html += renderFrames(framesFor(p, S.plan, done));
        html += renderLines(steps.slice(0, done).map(s => s.line).filter(Boolean));
        if (!complete) {
            if (isSubKind(p)) html += methodToggleHtml(p);
            html += `<div class="step-prompt"><span class="step-chip">手順 ${done + 1}/${steps.length}</span>${steps[done].prompt}</div>
                <div class="answer-row">
                    <input id="ansInput" class="step-input" type="text" inputmode="numeric" autocomplete="off" spellcheck="false" maxlength="3" aria-label="こたえ">
                    <button class="btn btn-primary btn-answer" onclick="submitAnswer()">こたえる</button>
                </div>`;
        }
        if (S.stepMsg) html += `<div class="step-msg ${S.stepMsg.cls}">${S.stepMsg.text}</div>`;
    } else {
        const blank = answered
            ? { value: answered.given == null ? '…' : answered.given, cls: answered.ok ? 'ok' : 'ng' }
            : 'input';
        html += renderEq(p, { blank });
        // 10のまとまりの「見て考える」は●の図を出す
        if (S.mode === 'guided') html += renderFrames(framesFor(p, null, answered && answered.ok ? Infinity : 0));
        if (!answered) html += '<div class="enter-hint">数字を入れて <span class="kbd">Enter</span></div>';
    }
    if (!answered && (!S.plan || S.stepIdx < S.plan.steps.length)) {
        html += `<div class="ime-tip" id="imeTip" style="display:${imeTipShown ? 'block' : 'none'}">💡 日本語入力がONになっているよ。「半角/全角」キーでOFFにすると、Enter 1回で答えられるよ。</div>`;
    }
    $('qArea').innerHTML = html;
    bindInput();
}

// ===== 入力 =====
function toHalfWidth(s) { return s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)); }
function parseAnswer(s) {
    const v = toHalfWidth(s).trim();
    return /^\d{1,3}$/.test(v) ? Number(v) : null;
}
function normalizeInput(el) {
    const v = toHalfWidth(el.value).replace(/[^0-9]/g, '').slice(0, 3);
    if (v !== el.value) el.value = v;
}
function bindInput() {
    const el = $('ansInput');
    if (!el) return;
    el.addEventListener('input', e => { if (!e.isComposing) normalizeInput(el); });
    el.addEventListener('compositionend', () => normalizeInput(el));
    el.addEventListener('compositionstart', () => {
        imeTipShown = true;
        const tip = $('imeTip');
        if (tip) tip.style.display = 'block';
    });
}
function focusInput() {
    const el = $('ansInput');
    if (el) el.focus();
}
function nudge(el) {
    if (!el) return;
    el.classList.remove('nudge');
    void el.offsetWidth;
    el.classList.add('nudge');
}

function submitAnswer() {
    if (S.phase !== 'answer') return;
    const el = $('ansInput');
    if (!el) return;
    const val = parseAnswer(el.value);
    if (val === null) { nudge(el); el.focus(); return; }
    if (S.plan) { submitStep(val); return; }
    stopTimer();
    judge(val, performance.now() - S.startTs, false);
}

// ① 手順モードの1ステップ
function submitStep(val) {
    const steps = S.plan.steps, st = steps[S.stepIdx];
    if (val === st.answer) {
        S.stepIdx++;
        S.stepWrong = 0;
        S.stepMsg = { cls: 'ok', text: '⭕ そのとおり！' };
    } else if (++S.stepWrong >= 2) {
        // 2回まちがえたら答えを見せて、つぎの手順へ進む
        S.guidedMiss = true;
        S.stepIdx++;
        S.stepWrong = 0;
        S.stepMsg = { cls: 'ng', text: `答えは ${st.answer} だよ。つぎの手順にすすもう。` };
    } else {
        S.guidedMiss = true;
        S.stepMsg = { cls: 'hint', text: `🤔 ${st.hint}` };
    }
    if (S.stepIdx >= steps.length) { completeGuided(); return; }
    renderQArea();
    focusInput();
    if (S.stepMsg.cls === 'hint') nudge($('ansInput'));
}

function completeGuided() {
    const p = S.cur;
    S.phase = 'feedback';
    S.answered++;
    if (!S.guidedMiss) S.correct++;
    if (S.stepMsg && S.stepMsg.cls !== 'ng') S.stepMsg = null;
    renderQArea();
    hitEnemy();
    $('fbBox').innerHTML = `<div class="feedback ok">
        <div class="fb-head">🎉 できた！ ${p.a} ${p.op} ${p.b} = ${p.answer}</div>
        <button class="btn btn-primary" onclick="proceed()">つぎの問題 ▶ <span class="kbd">Enter</span></button>
    </div>`;
    S.waitEnter = true;
    scrollFeedbackIntoView();
}

// ② 練習・③ ボス戦・実力チェック・にがて特訓 の答えあわせ
function judge(val, ms, timedOut) {
    const p = S.cur;
    const ok = !timedOut && val === p.answer;
    S.phase = 'feedback';
    S.waitEnter = false;
    S.answered++;
    S.sessionMs += ms;
    progress.totalAnswered++;
    if (ok) { S.correct++; progress.totalCorrect++; } else S.wrong++;
    S.results.push({ p, ok, ms, val: timedOut ? null : val });
    if (p.cardId) recordCard(p, ok, ms);
    saveProgress();
    renderQArea({ given: timedOut ? null : val, ok });

    const fb = $('fbBox');
    if (ok) {
        const fast = ms <= FAST_MS[p.kind];
        if (S.mode !== 'check') hitEnemy();
        fb.innerHTML = `<div class="feedback ok">⭕ せいかい！${fast && S.mode !== 'guided' ? ' <span class="fast">⚡ はやい！</span>' : ''}</div>`;
        S.pending = setTimeout(proceed, S.mode === 'boss' ? 450 : S.mode === 'check' ? 500 : 750);
        return;
    }
    if (S.mode === 'check') {
        fb.innerHTML = `<div class="feedback ng">答えは <b>${p.answer}</b></div>`;
        S.pending = setTimeout(proceed, 1500);
        return;
    }
    if (S.mode === 'boss') {
        S.hearts--;
        hurtPlayer();
        S.queue.push(p);                                   // ボス戦：まちがえた問題はさいごにもう一度
    } else {
        S.queue.splice(Math.min(2, S.queue.length), 0, p); // 練習：少しあとにもう一度
    }
    const msg = analyzeMistake(p, timedOut ? null : val);
    const head = timedOut ? `⏰ 時間切れ！ 答えは <b>${p.answer}</b>` : `❌ ざんねん！ 答えは <b>${p.answer}</b>`;
    fb.innerHTML = `<div class="feedback ng">
        <div class="fb-head">${head}</div>
        ${msg ? `<div class="fb-msg">💡 ${msg}</div>` : ''}
        <div class="explain" id="fbExplain">${explainBlockInner(p)}</div>
        <button class="btn btn-primary" onclick="proceed()">つぎへ ▶ <span class="kbd">Enter</span></button>
    </div>`;
    S.waitEnter = true;
    scrollFeedbackIntoView();
}

function scrollFeedbackIntoView() {
    const fb = $('fbBox');
    if (fb && fb.scrollIntoView) fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function recordCard(p, ok, ms) {
    const c = progress.cards[p.cardId] || (progress.cards[p.cardId] = { n: 0, ok: 0, streak: 0, lastWrong: false });
    const before = c.streak;
    c.n++;
    if (ok) {
        c.ok++;
        c.lastWrong = false;
        if (ms <= FAST_MS[p.kind]) c.streak = Math.min(3, c.streak + 1);
    } else {
        c.streak = 0;
        c.lastWrong = true;
    }
    if (before < 3 && c.streak >= 3 && !S.newlyMastered.includes(p.cardId)) S.newlyMastered.push(p.cardId);
}

function proceed() {
    if (S.phase !== 'feedback') return;
    clearTimers();
    if (S.mode === 'boss' && S.hearts <= 0) { gameOver(); return; }
    nextProblem();
}

// ===== ボス戦の時間制限 =====
function startTimer() {
    stopTimer();
    S.limitMs = LIMIT_MS[S.cur.kind];
    const fill = $('timerFill');
    fill.style.width = '100%';
    fill.className = 'timer-fill';
    S.timer = setInterval(() => {
        if (S.phase !== 'answer') { stopTimer(); return; }
        const rest = Math.max(0, 1 - (performance.now() - S.startTs) / S.limitMs);
        fill.style.width = (rest * 100) + '%';
        fill.className = 'timer-fill' + (rest < 0.25 ? ' danger' : rest < 0.5 ? ' warning' : '');
        if (rest <= 0) { stopTimer(); judge(null, S.limitMs, true); }
    }, 50);
}
function stopTimer() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }
function clearTimers() {
    stopTimer();
    if (S.pending) { clearTimeout(S.pending); S.pending = null; }
}

// ===== 演出 =====
function restartAnim(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
}
function hitEnemy() {
    S.enemyHp = Math.max(0, S.enemyHp - 1);
    const sp = $('enemySprite');
    restartAnim(sp, 'hit');
    if (S.enemyHp === 0) sp.classList.add('defeated');
    const pop = $('dmgPop');
    pop.textContent = '💥';
    restartAnim(pop, 'show');
    updateHud();
}
function hurtPlayer() {
    const pop = $('playerDmgPop');
    pop.textContent = '💔';
    restartAnim(pop, 'show');
    restartAnim($('battleScene'), 'shake');
    updateHud();
}

function exitBattle() {
    const t0 = performance.now();
    const msg = S.mode === 'check' ? '実力チェックをとちゅうでやめる？' : 'とちゅうでやめる？（ここまでの計算カードの記録はのこるよ）';
    if (!confirm(msg)) {
        S.startTs += performance.now() - t0;   // 考えていた時間は時間制限にふくめない
        focusInput();
        return;
    }
    clearTimers();
    S.phase = 'done';
    const mode = S.mode;
    S.mode = null;
    if (mode === 'weak') openCards();
    else if (mode === 'check') showTitle();
    else openStage(S.stage.id);
}

// ===== けっか =====
function finishSession() {
    clearTimers();
    S.phase = 'done';
    touchStreak();
    if (S.mode === 'check') { finishCheck(); return; }
    const s = S.stage, mode = S.mode;
    let best = false;
    if (s) {
        const r = stageRec(s.id);
        if (mode === 'guided') r.s1 = true;
        else if (mode === 'practice') r.s2 = true;
        else if (mode === 'boss') {
            r.boss = true;
            const t = Math.round(S.sessionMs);
            if (r.bestMs == null || t < r.bestMs) { r.bestMs = t; best = true; }
            r.bestHearts = Math.max(r.bestHearts || 0, S.hearts);
        }
    }
    saveProgress();

    const allClear = mode === 'boss' && s && s.kind === 'mix';
    const title = allClear ? '👑 けいさんドラゴンをたおした！'
        : { guided: `⭐ ${STEP_INFO.guided.num} ${s ? stepLabel(s, 'guided') : ''} クリア！`, practice: '⭐ ② 練習 クリア！', boss: '🏆 ボスをたおした！', weak: '🃏 にがて特訓 おわり！' }[mode];

    const row = (k, v) => `<div class="score-row"><span>${k}</span><span>${v}</span></div>`;
    let rows = mode === 'guided' ? row('ノーミスで解けた問題', `${S.correct} / ${S.total}`) : row('正解', `${S.correct} / ${S.answered}`);
    if (mode === 'boss') {
        rows += row('タイム', `${fmtSec(S.sessionMs)}秒${best ? ' 🎉ベスト記録！' : ''}`);
        rows += row('のこりハート', `<span class="hearts">${heartsHtml(S.hearts)}</span>`);
    }
    let html = `<div class="score-box">${rows}</div>`;
    if (S.newlyMastered.length) {
        html += `<div class="mastered-box"><div class="mastered-title">★3になった計算カード</div>${S.newlyMastered.map(id => `<span class="card-chip">${cardLabel(id)}</span>`).join('')}</div>`;
    }
    const nextStage = s ? stageById(s.id + 1) : null;
    if (mode === 'boss' && !S.wasCleared && nextStage) {
        html += `<div class="skill-up">🔓 ステージ${nextStage.id}「${nextStage.name}」がひらいた！</div>`;
    }
    if (allClear) html += '<p class="clear-msg">すべてのステージをクリア！ あなたは本物の「10の勇者」だ！</p>';

    let primary, secondary;
    if (mode === 'weak') {
        primary = ['🃏 カードずかんへ', 'openCards()'];
        secondary = ['もう一度特訓する', 'startWeakTraining()'];
    } else {
        const nextStep = s.steps[s.steps.indexOf(mode) + 1];
        if (nextStep) primary = [`${STEP_INFO[nextStep].num} ${stepLabel(s, nextStep)}へ ▶`, `startSession('${nextStep}', ${s.id})`];
        else if (nextStage) primary = [`ステージ${nextStage.id}へ ▶`, `openStage(${nextStage.id})`];
        else primary = ['🗺️ マップへ', 'openMap()'];
        secondary = [`ステージ${s.id}にもどる`, `openStage(${s.id})`];
    }
    html += `<div class="clear-buttons">
        <button class="btn btn-primary" onclick="${primary[1]}">${primary[0]}</button>
        <button class="btn btn-secondary" onclick="${secondary[1]}">${secondary[0]}</button>
    </div>`;
    $('clearTitle').textContent = title;
    $('clearContent').innerHTML = html;
    show('clearScreen');
}

function gameOver() {
    clearTimers();
    S.phase = 'done';
    saveProgress();
    const s = S.stage;
    $('gameOverButtons').innerHTML = `
        <button class="btn btn-primary" onclick="startSession('boss', ${s.id})">⚔️ もう一度</button>
        ${s.steps.includes('practice') ? `<button class="btn btn-secondary" onclick="startSession('practice', ${s.id})">② 練習でとっくん</button>` : ''}
        <button class="btn btn-secondary" onclick="openStage(${s.id})">ステージにもどる</button>`;
    show('gameOverScreen');
}

// ===== 実力チェックのけっか =====
function finishCheck() {
    const stats = {};
    CHECK_PLAN.forEach(({ stageId }) => { stats[stageId] = { n: 0, ok: 0, fast: 0, wrongs: [] }; });
    S.results.forEach(r => {
        const st = stats[r.p.checkStage];
        st.n++;
        if (r.ok) { st.ok++; if (r.ms <= FAST_MS[r.p.kind]) st.fast++; }
        else st.wrongs.push(r);
    });
    // 全問正解したステージは合格。さいしょに不合格になったステージから始める
    let firstFail = null;
    CHECK_PLAN.forEach(({ stageId }) => {
        const st = stats[stageId];
        st.pass = st.n > 0 && st.ok === st.n;
        if (!st.pass && firstFail === null) firstFail = stageId;
    });
    CHECK_PLAN.forEach(({ stageId }) => {
        if (firstFail === null || stageId < firstFail) stageRec(stageId).passedCheck = true;
    });
    progress.checkDone = true;
    saveProgress();
    const rec = firstFail || recommendedStageId() || STAGES[STAGES.length - 1].id;

    const problemText = p => p.kind === 'make10' ? tokensOf(p).map(t => t.t === 'blank' ? '□' : t.v).join(' ') : `${p.a} ${p.op} ${p.b}`;
    let html = '<div class="check-list">';
    CHECK_PLAN.forEach(({ stageId }) => {
        const s = stageById(stageId), st = stats[stageId];
        const mark = !st.pass ? '△' : st.fast === st.n ? '◎' : '○';
        const comment = !st.pass ? 'ここを練習しよう' : st.fast === st.n ? 'かんぺき！' : '正解！つぎはスピードアップ';
        const wrongs = st.wrongs.map(r => `<div class="check-wrong">${problemText(r.p)} → ${r.val}と答えた（正しくは${r.p.answer}）</div>`).join('');
        html += `<div class="check-row${stageId === rec ? ' rec' : ''}">
            <div class="check-mark">${mark}</div>
            <div class="check-body">
                <div class="check-name">ステージ${stageId} ${s.name}</div>
                <div class="check-score">${st.ok} / ${st.n} 正解・${comment}</div>
                ${wrongs}
            </div>
        </div>`;
    });
    html += '</div>';
    const recStage = stageById(rec);
    html += `<p class="check-rec">おすすめのスタート：<b>ステージ${rec}「${recStage.name}」</b></p>
        <div class="clear-buttons">
            <button class="btn btn-primary" onclick="openStage(${rec})">ステージ${rec}へ ▶</button>
            <button class="btn btn-secondary" onclick="openMap()">🗺️ マップへ</button>
        </div>`;
    $('checkResultContent').innerHTML = html;
    show('checkResultScreen');
}

// ===== 計算カードずかん =====
function openCards() { renderCards(); show('cardsScreen'); }

function cardCellHtml(kind, a, b) {
    const id = cardIdOf(kind, a, b), c = progress.cards[id], s = c ? c.streak : 0;
    const cls = ['card-cell', c ? 'tried' : '', `s${s}`, c && c.lastWrong ? 'weak' : ''].join(' ');
    return `<button class="${cls}" onclick="openCardModal('${kind}', ${a}, ${b})">
        <span class="card-eq">${a}${kind === 'add1' ? '+' : '−'}${b}</span>
        <span class="card-stars">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</span>
    </button>`;
}

function renderCards() {
    let addHtml = '', subHtml = '';
    for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) {
        addHtml += a + b >= 11 ? cardCellHtml('add1', a, b) : '<span class="card-cell blank"></span>';
    }
    for (let a = 11; a <= 18; a++) for (let b = 2; b <= 9; b++) {
        subHtml += b > a - 10 ? cardCellHtml('sub1', a, b) : '<span class="card-cell blank"></span>';
    }
    $('addCardGrid').innerHTML = addHtml;
    $('subCardGrid').innerHTML = subHtml;
    $('addCardCount').textContent = `★3：${masteredCount(ADD_FACTS, 'add1')} / ${ADD_FACTS.length}まい`;
    $('subCardCount').textContent = `★3：${masteredCount(SUB_FACTS, 'sub1')} / ${SUB_FACTS.length}まい`;
    const weak = Object.values(progress.cards).filter(c => c.streak < 3).length;
    $('weakNote').textContent = weak ? `★3になっていないカード：${weak}まい` : 'まだ出ていないカードからも出題するよ';
}

function startWeakTraining() {
    const all = [...ADD_FACTS.map(([a, b]) => makeProblem('add1', a, b)), ...SUB_FACTS.map(([a, b]) => makeProblem('sub1', a, b))];
    const stat = p => progress.cards[p.cardId];
    // さいごにまちがえた → ★が少ない → まちがえた回数が多い じゅんに出す
    const weak = all.filter(p => stat(p) && stat(p).streak < 3).sort((x, y) => {
        const a = stat(x), b = stat(y);
        return (Number(b.lastWrong) - Number(a.lastWrong)) || (a.streak - b.streak) || ((b.n - b.ok) - (a.n - a.ok));
    });
    let picked = weak.slice(0, WEAK_COUNT);
    const fill = pool => {
        if (picked.length >= WEAK_COUNT) return;
        const keys = new Set(picked.map(p => p.key));
        picked = picked.concat(shuffle(pool.filter(p => !keys.has(p.key))).slice(0, WEAK_COUNT - picked.length));
    };
    fill(all.filter(p => !stat(p)));   // まだ出ていないカード
    fill(all);                         // ぜんぶ★3なら、どれでも
    startSession('weak', null, { problems: shuffle(picked) });
}

// カードのとき方（モーダル）
let modalCard = null;
function openCardModal(kind, a, b) {
    modalCard = makeProblem(kind, a, b);
    renderModal();
    $('modal').classList.add('open');
}
function renderModal() {
    const p = modalCard;
    if (!p) return;
    const c = progress.cards[p.cardId];
    const stat = c ? `${c.n}回中 ${c.ok}回正解・★${c.streak}` : 'まだ出ていないカード';
    $('modalContent').innerHTML = `<div class="modal-title">${p.a} ${p.op} ${p.b}</div>
        <div class="modal-stat">${stat}</div>
        ${isSubKind(p) ? methodToggleHtml(p) : ''}
        ${renderExplain(p, progress.method)}`;
}
function closeModal() {
    $('modal').classList.remove('open');
    modalCard = null;
}

// ===== キーボード =====
document.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;   // 日本語入力の変換中は何もしない
    if ($('modal').classList.contains('open')) {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); closeModal(); }
        return;
    }
    const active = document.querySelector('.screen.active');
    if (!active) return;
    if (active.id === 'battleScreen') {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (e.repeat) return;
            if (S.phase === 'answer') submitAnswer();
            else if (S.phase === 'feedback' && S.waitEnter) proceed();
            return;
        }
        // 入力らんの外で数字をおしても、入力らんに入るようにする
        if (S.phase === 'answer' && /^[0-9０-９]$/.test(e.key)) {
            const el = $('ansInput');
            if (el && document.activeElement !== el) el.focus();
        }
        return;
    }
    // けっか画面では Enter で「つぎへ」（連打で読み飛ばさないよう少し待つ）
    if (e.key === 'Enter' && !e.repeat && ['clearScreen', 'checkResultScreen', 'gameOverScreen'].includes(active.id)) {
        if (performance.now() - screenShownAt < 800) { e.preventDefault(); return; }
        const btn = active.querySelector('.btn-primary');
        if (btn) { e.preventDefault(); btn.click(); }
    }
});

// ===== 起動 =====
showTitle();
