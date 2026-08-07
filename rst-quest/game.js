// game.js - RSTクエスト ゲームエンジン

// ===== ゲーム状態 =====
const gs = {
    playerHp: 100,
    playerMaxHp: 100,
    skills: [0, 0, 0, 0, 0, 0],   // 各RSTスキル（0〜100）
    cleared: [],                    // クリア済みステージID
    stageId: null,                  // 現在のステージ
    qIdx: 0,                        // 現在の問題番号
    correctCount: 0,
    enemyHp: 0,
    enemyMaxHp: 0,
    currentQuestions: [],           // バトルごとにランダム選択した問題
};

const QUESTIONS_PER_BATTLE = 5;

function pickQuestions(pool, n) {
    const arr = pool.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, Math.min(n, arr.length));
}

// ===== タイトル BGM =====
let bgmCtx    = null;
let bgmTimer  = null;
let bgmWanted = false;

const BGM_BPM  = 132;
const BGM_BEAT = 60 / BGM_BPM;

const HZ = {
    D3:146.83, E3:164.81, G3:196.00, A3:220.00, B3:246.94,
    C4:261.63, D4:293.66, E4:329.63, G4:392.00, A4:440.00,
    B4:493.88, C5:523.25, D5:587.33, E5:659.25, G5:783.99,
};

// メロディ: [Hz, 拍数]  8小節ループ (Gメジャー)
const MELODY_SEQ = [
    [HZ.G4,1],[HZ.B4,.5],[HZ.D5,.5],[HZ.G5,.5],[HZ.D5,.5],[HZ.B4,1],
    [HZ.C5,.5],[HZ.A4,.5],[HZ.G4,1],[HZ.A4,.5],[HZ.B4,.5],[HZ.C5,1],
    [HZ.D5,1],[HZ.E5,.5],[HZ.D5,.5],[HZ.C5,.5],[HZ.B4,.5],[HZ.A4,1],
    [HZ.G4,2],[HZ.D4,1],[HZ.G4,1],
    [HZ.E5,1],[HZ.G5,.5],[HZ.E5,.5],[HZ.D5,1],[HZ.B4,1],
    [HZ.C5,1],[HZ.E5,.5],[HZ.C5,.5],[HZ.B4,1],[HZ.G4,1],
    [HZ.A4,.5],[HZ.B4,.5],[HZ.C5,.5],[HZ.D5,.5],[HZ.E5,.5],[HZ.D5,.5],[HZ.C5,.5],[HZ.B4,.5],
    [HZ.G4,4],
];

// バス: [Hz, 拍数]  スクエア波メロディに対してトライアングル波バス
const BASS_SEQ = [
    [HZ.G3,2],[HZ.G3,2],
    [HZ.C4,2],[HZ.C4,2],
    [HZ.D3,2],[HZ.D3,2],
    [HZ.G3,2],[HZ.G3,2],
    [HZ.E3,2],[HZ.E3,2],
    [HZ.A3,2],[HZ.C4,2],
    [HZ.D3,2],[HZ.D3,2],
    [HZ.G3,4],
];

const BGM_LOOP_BEATS = 32;

function bgmPlayNote(ctx, dest, hz, startT, beats, wave, vol) {
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(dest);
    osc.type = wave;
    osc.frequency.value = hz;
    const dur = beats * BGM_BEAT;
    gain.gain.setValueAtTime(0, startT);
    gain.gain.linearRampToValueAtTime(vol, startT + 0.012);
    gain.gain.linearRampToValueAtTime(vol * 0.6, startT + Math.min(0.1, dur * 0.4));
    gain.gain.linearRampToValueAtTime(0, startT + dur - 0.015);
    osc.start(startT);
    osc.stop(startT + dur);
}

function bgmSchedule(ctx, dest, loopStart) {
    if (!bgmWanted || bgmCtx !== ctx) return;

    let t = loopStart;
    MELODY_SEQ.forEach(([hz, b]) => {
        bgmPlayNote(ctx, dest, hz, t, b, 'square', 0.13);
        t += b * BGM_BEAT;
    });

    t = loopStart;
    BASS_SEQ.forEach(([hz, b]) => {
        bgmPlayNote(ctx, dest, hz, t, b, 'triangle', 0.09);
        t += b * BGM_BEAT;
    });

    const nextStart = loopStart + BGM_LOOP_BEATS * BGM_BEAT;
    const msUntil  = (nextStart - 0.3 - ctx.currentTime) * 1000;
    bgmTimer = setTimeout(() => bgmSchedule(ctx, dest, nextStart), Math.max(msUntil, 0));
}

function startTitleMusic() {
    if (bgmCtx) return;
    try {
        bgmCtx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = bgmCtx.createDynamicsCompressor();
        comp.connect(bgmCtx.destination);
        bgmSchedule(bgmCtx, comp, bgmCtx.currentTime + 0.05);
    } catch (_) {}
}

function stopTitleMusic() {
    bgmWanted = false;
    clearTimeout(bgmTimer);
    bgmTimer = null;
    if (bgmCtx) { bgmCtx.close().catch(() => {}); bgmCtx = null; }
}

// ===== 画面切替 =====
function show(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    window.scrollTo(0, 0);
    if (id === 'titleScreen' || id === 'howToPlayScreen') {
        bgmWanted = true;
    } else {
        stopTitleMusic();
    }
}

// ===== タイトル =====
function goTitle() { show('titleScreen'); }

function startGame() {
    gs.playerHp = 100;
    gs.playerMaxHp = 100;
    gs.skills = [0, 0, 0, 0, 0, 0];
    gs.cleared = [];
    renderMap();
    show('mapScreen');
}

function showHowToPlay() { show('howToPlayScreen'); }

// ===== マップ =====
function renderMap() {
    const grid = document.getElementById('stageGrid');
    grid.innerHTML = '';

    STAGES.forEach((stage, idx) => {
        const locked   = idx > 0 && !gs.cleared.includes(idx - 1);
        const cleared  = gs.cleared.includes(idx);

        const card = document.createElement('div');
        card.className = 'stage-card' + (locked ? ' locked' : '') + (cleared ? ' cleared' : '');
        card.innerHTML = `
            <div class="stage-icon">${locked ? '🔒' : stage.icon}</div>
            <div class="stage-name">${stage.name}</div>
            <div class="stage-skill">${stage.skillName}</div>
            <div class="stage-status">${cleared ? '⭐ クリア済み' : locked ? '🔒 まだ開かない' : '▶ 挑戦できる！'}</div>`;
        if (!locked) card.addEventListener('click', () => openStageIntro(idx));
        grid.appendChild(card);
    });

    // HP表示
    setHpBar('mapHpFill', 'mapHpText', gs.playerHp, gs.playerMaxHp);
    document.getElementById('mapLevel').textContent =
        `クリア: ${gs.cleared.length} / ${STAGES.length} エリア`;

    drawRadar('radarChart', 150);
}

function setHpBar(fillId, textId, hp, max) {
    const pct = Math.max(0, (hp / max) * 100);
    const fill = document.getElementById(fillId);
    fill.style.width = pct + '%';
    fill.className = 'hp-fill' +
        (pct < 30 ? ' danger' : pct < 60 ? ' warning' : '');
    if (textId) document.getElementById(textId).textContent = `${hp}/${max}`;
}

// ===== ステージ紹介 =====
function openStageIntro(idx) {
    gs.stageId = idx;
    const s = STAGES[idx];
    document.getElementById('introContent').innerHTML = `
        <div class="intro-title">エリア${idx + 1}：${s.name}</div>
        <div class="intro-enemy">${s.enemy.sprite}</div>
        <div class="intro-enemy-name">「${s.enemy.name}」が立ちふさがった！</div>
        <div class="intro-skill-box">
            <strong>📖 今回のスキル：${s.skillName}</strong><br>${s.description}
        </div>
        <div class="intro-meta">問題数：${s.questions.length}問 ／ 敵HP：${s.enemy.maxHp}</div>`;
    show('stageIntroScreen');
}

function backToMap() { renderMap(); show('mapScreen'); }

// ===== バトル開始 =====
function startBattle() {
    const s = STAGES[gs.stageId];
    gs.qIdx             = 0;
    gs.correctCount     = 0;
    gs.enemyHp          = s.enemy.maxHp;
    gs.enemyMaxHp       = s.enemy.maxHp;
    gs.currentQuestions = pickQuestions(s.questions, QUESTIONS_PER_BATTLE);

    document.getElementById('enemySprite').textContent = s.enemy.sprite;
    document.getElementById('enemyLabel').textContent  = `👾 ${s.enemy.name}`;
    document.getElementById('battleStageChip').textContent = `${s.icon} ${s.name}`;

    updateBattleHPs();
    show('battleScreen');
    renderQuestion();
}

function updateBattleHPs() {
    setHpBar('playerHpFill', 'playerHpText', gs.playerHp, gs.playerMaxHp);
    setHpBar('enemyHpFill',  'enemyHpText',  gs.enemyHp,  gs.enemyMaxHp);
    // 敵HPバーは常に赤
    document.getElementById('enemyHpFill').className = 'hp-fill enemy-fill';
}

// ===== 問題表示 =====
function renderQuestion() {
    const s = STAGES[gs.stageId];
    const q = gs.currentQuestions[gs.qIdx];

    document.getElementById('qProgress').textContent =
        `問題 ${gs.qIdx + 1} / ${gs.currentQuestions.length}`;
    document.getElementById('skillBadge').textContent = `📚 ${s.skillName}`;

    const pb = document.getElementById('passageBox');
    if (q.passage) {
        pb.textContent = q.passage;
        pb.style.display = 'block';
    } else {
        pb.style.display = 'none';
    }

    document.getElementById('qText').innerText = q.question;

    const choicesEl = document.getElementById('choices');
    choicesEl.innerHTML = '';
    q.choices.forEach((text, i) => {
        const btn = document.createElement('button');
        btn.className = 'choice-btn';
        btn.textContent = text;
        btn.addEventListener('click', () => onAnswer(i));
        choicesEl.appendChild(btn);
    });

    document.getElementById('feedbackBox').style.display = 'none';
}

// ===== 回答処理 =====
function onAnswer(chosen) {
    const s = STAGES[gs.stageId];
    const q = gs.currentQuestions[gs.qIdx];
    const correct = chosen === q.answer;

    // ボタン無効化 & 色付け
    document.querySelectorAll('.choice-btn').forEach((btn, i) => {
        btn.disabled = true;
        if (i === q.answer)                    btn.classList.add('correct');
        else if (i === chosen && !correct)     btn.classList.add('wrong');
    });

    const dmgPerQ = Math.ceil(gs.enemyMaxHp / gs.currentQuestions.length);

    if (correct) {
        gs.correctCount++;
        gs.enemyHp = Math.max(0, gs.enemyHp - dmgPerQ);
        gs.skills[s.skillIndex] = Math.min(100, gs.skills[s.skillIndex] + 15);
        popDamage(`-${dmgPerQ}!!`, false);
        shakeEnemy();
        showFeedback(true, q.explanation);
    } else {
        const penalty = 12;
        gs.playerHp = Math.max(0, gs.playerHp - penalty);
        popDamage(`-${penalty}`, true);
        flashPlayer();
        showFeedback(false, q.explanation);
    }

    updateBattleHPs();
}

function showFeedback(ok, explanation) {
    const fb = document.getElementById('feedbackBox');
    fb.className = 'feedback ' + (ok ? 'ok' : 'ng');
    fb.innerHTML = `
        <strong>${ok ? '⭕ 正解！' : '❌ まちがい！'}</strong>
        <div class="expl">${explanation}</div>
        <button class="btn btn-primary" onclick="nextQ()">つぎへ ▶</button>`;
    fb.style.display = 'block';
}

function nextQ() {
    // HP0ならゲームオーバー
    if (gs.playerHp <= 0) { show('gameOverScreen'); return; }

    gs.qIdx++;

    // 全問終了 or 敵HP0で終了判定
    if (gs.qIdx >= gs.currentQuestions.length || gs.enemyHp <= 0) {
        endBattle();
    } else {
        renderQuestion();
    }
}

// ===== バトル終了 =====
function endBattle() {
    const s = STAGES[gs.stageId];
    const need = Math.ceil(gs.currentQuestions.length / 2); // 半分以上正解でクリア
    const win  = gs.correctCount >= need && gs.playerHp > 0;

    if (win) {
        if (!gs.cleared.includes(gs.stageId)) gs.cleared.push(gs.stageId);
        gs.playerHp = Math.min(gs.playerMaxHp, gs.playerHp + 20); // HP回復
        showClear();
    } else {
        show('gameOverScreen');
    }
}

function showClear() {
    const s = STAGES[gs.stageId];
    const allClear = gs.cleared.length === STAGES.length;

    document.getElementById('clearContent').innerHTML = `
        <div class="score-box">
            <div class="score-row"><span>正解数</span><span style="color:#2ecc71;font-weight:bold">${gs.correctCount} / ${gs.currentQuestions.length}</span></div>
            <div class="score-row"><span>クリア</span><span style="color:#f7d774">${s.name}</span></div>
            <div class="score-row"><span>HP回復</span><span style="color:#2ecc71">＋20</span></div>
        </div>
        <div class="skill-up">📈 ${s.skillName} スキルアップ！</div>
        ${allClear ? '<div style="color:#f7d774;font-size:1.05rem;margin-top:8px">✨ すべてのエリアを制覇！</div>' : ''}`;

    document.getElementById('clearNextBtn').textContent =
        allClear ? '結果を見る 🏆' : 'マップへもどる 🗺️';
    document.getElementById('clearNextBtn').onclick =
        allClear ? showGameComplete : () => { renderMap(); show('mapScreen'); };

    show('stageClearScreen');
}

// ===== ゲームオーバー =====
function retryStage() {
    gs.playerHp = Math.max(40, gs.playerHp); // 最低40で再挑戦
    startBattle();
}

// ===== ゲームクリア =====
function showGameComplete() {
    show('gameCompleteScreen');
    const sum = document.getElementById('finalSkillSummary');
    sum.innerHTML = '<div class="skill-summary">' +
        SKILL_NAMES.map((name, i) => `
            <div class="skill-chip">
                <div class="sk-name">${name}</div>
                <div class="sk-val" style="color:${SKILL_COLORS[i]}">${gs.skills[i]}pt</div>
            </div>`).join('') +
        '</div>';
    setTimeout(() => drawRadar('finalRadarChart', 280), 80);
}

function resetGame() { startGame(); }

// ===== エフェクト =====
function popDamage(text, isPlayer) {
    const el = document.getElementById(isPlayer ? 'playerDmgPop' : 'dmgPop');
    el.textContent = text;
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            el.style.transition = 'opacity 0.9s ease, transform 0.9s ease';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-50px)';
        });
    });
}

function shakeEnemy() {
    const el = document.getElementById('enemySprite');
    const frames = ['-12px','12px','-6px','6px','0'];
    frames.forEach((x, i) =>
        setTimeout(() => el.style.transform = `translateX(${x})`, i * 80));
}

function flashPlayer() {
    const fill = document.getElementById('playerHpFill');
    fill.style.background = '#e74c3c';
    setTimeout(() => {
        const pct = (gs.playerHp / gs.playerMaxHp) * 100;
        fill.style.background = '';
        fill.className = 'hp-fill' + (pct < 30 ? ' danger' : pct < 60 ? ' warning' : '');
    }, 500);
}

// ===== レーダーチャート =====
function drawRadar(canvasId, size) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.width  = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const cx = size / 2, cy = size / 2;
    const R  = size * 0.36;
    const N  = 6;
    ctx.clearRect(0, 0, size, size);

    const angle = i => (Math.PI * 2 * i / N) - Math.PI / 2;
    const pt    = (i, r) => ({
        x: cx + r * Math.cos(angle(i)),
        y: cy + r * Math.sin(angle(i))
    });

    // 背景グリッド
    [0.25, 0.5, 0.75, 1].forEach(ratio => {
        ctx.beginPath();
        for (let i = 0; i < N; i++) {
            const p = pt(i, R * ratio);
            i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth   = 1;
        ctx.stroke();
    });

    // 軸
    for (let i = 0; i < N; i++) {
        const p = pt(i, R);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(p.x, p.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth   = 1;
        ctx.stroke();
    }

    // スキルエリア
    ctx.beginPath();
    for (let i = 0; i < N; i++) {
        const r = (gs.skills[i] / 100) * R;
        const p = pt(i, r);
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.fillStyle   = 'rgba(247,215,116,0.22)';
    ctx.fill();
    ctx.strokeStyle = '#f7d774';
    ctx.lineWidth   = 2;
    ctx.stroke();

    // 頂点ドット
    for (let i = 0; i < N; i++) {
        const r = (gs.skills[i] / 100) * R;
        const p = pt(i, r);
        ctx.beginPath();
        ctx.arc(p.x, p.y, size > 200 ? 5 : 3, 0, Math.PI * 2);
        ctx.fillStyle = '#f7d774';
        ctx.fill();
    }

    // ラベル（大きいチャートのみ）
    if (size > 200) {
        ctx.font      = `${Math.round(size * 0.048)}px sans-serif`;
        ctx.fillStyle = '#a8b8c8';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let i = 0; i < N; i++) {
            const p = pt(i, R + size * 0.1);
            ctx.fillText(SKILL_NAMES[i], p.x, p.y);
        }
    }
}

// ===== 起動 =====
// タイトル・あそびかた画面でのクリックで音楽を開始（ブラウザの自動再生制限への対応）
document.addEventListener('click', () => {
    if (bgmWanted && !bgmCtx) startTitleMusic();
}, true);

window.addEventListener('load', () => show('titleScreen'));
