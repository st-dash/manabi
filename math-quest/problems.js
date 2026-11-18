// problems.js - 問題づくり・さくらんぼ計算の手順・まちがいの分析
// 画面（DOM）には依存しないロジックだけをまとめている。

// ===== 汎用 =====
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ===== 計算カード（くり上がりのたし算36枚・くり下がりのひき算36枚） =====
const ADD_FACTS = [];   // [a, b]  a + b >= 11（1けた + 1けた）
for (let a = 2; a <= 9; a++) for (let b = 2; b <= 9; b++) if (a + b >= 11) ADD_FACTS.push([a, b]);
const SUB_FACTS = [];   // [a, b]  11〜18 − 1けた で、一の位からひけないもの
for (let a = 11; a <= 18; a++) for (let b = 2; b <= 9; b++) if (b > a - 10) SUB_FACTS.push([a, b]);
const CARD_TOTAL = ADD_FACTS.length + SUB_FACTS.length;

function cardIdOf(kind, a, b) { return kind === 'add1' ? `${a}+${b}` : `${a}-${b}`; }
function cardLabel(id) { return id.includes('+') ? id.replace('+', ' + ') : id.replace('-', ' − '); }

// ===== 問題オブジェクト =====
// kind: make10（10のまとまり） / add1・sub1（1けたのくり上がり・くり下がり） / add2・sub2（2けたと1けた）
function makeProblem(kind, a, b, sub) {
    switch (kind) {
        case 'make10': {
            // sub: complement（7と□で10） / tenMinus（10−3） / split（14は10と□） / compose（10と6で□）
            const answer = sub === 'split' ? a - 10 : sub === 'compose' ? 10 + a : 10 - a;
            return { kind, sub, n: a, answer, key: `${sub}:${a}` };
        }
        case 'add1': return { kind, a, b, op: '+', answer: a + b, cardId: cardIdOf(kind, a, b), key: `${a}+${b}`, carry: true };
        case 'sub1': return { kind, a, b, op: '−', answer: a - b, cardId: cardIdOf(kind, a, b), key: `${a}-${b}`, borrow: true };
        case 'add2': return { kind, a, b, op: '+', answer: a + b, key: `${a}+${b}`, carry: (a % 10) + b >= 10 };
        case 'sub2': return { kind, a, b, op: '−', answer: a - b, key: `${a}-${b}`, borrow: (a % 10) < b };
    }
    return null;
}

function isSubKind(p) { return !!p && (p.kind === 'sub1' || p.kind === 'sub2'); }

// 式の部品。blank が答えを入れる場所
function tokensOf(p) {
    const N = v => ({ t: 'num', v }), O = v => ({ t: 'op', v }), W = v => ({ t: 'txt', v }), B = { t: 'blank' };
    if (p.kind === 'make10') {
        switch (p.sub) {
            case 'complement': return [N(p.n), W('と'), B, W('で'), N(10)];
            case 'tenMinus':   return [N(10), O('−'), N(p.n), O('='), B];
            case 'split':      return [N(p.n), W('は'), N(10), W('と'), B];
            case 'compose':    return [N(10), W('と'), N(p.n), W('で'), B];
        }
    }
    return [N(p.a), O(p.op), N(p.b), O('='), B];
}

// ===== 問題の生成 =====
function genMake10(sub) {
    if (!sub) {
        const r = Math.random();
        sub = r < 0.4 ? 'complement' : r < 0.6 ? 'tenMinus' : r < 0.85 ? 'split' : 'compose';
    }
    return makeProblem('make10', sub === 'split' ? randInt(11, 19) : randInt(1, 9), 0, sub);
}

// carry=true: 一の位でくり上がる（一の位の和が11以上）/ false: くり上がらない
function genAdd2(carry) {
    for (;;) {
        const T = randInt(1, 8), U = randInt(1, 9), b = randInt(2, 9);
        if (carry ? U + b >= 11 : U + b <= 9) return makeProblem('add2', T * 10 + U, b);
    }
}

// borrow=true: 一の位からひけない / needOnes: 一の位が0の数をさける（減減法の手順用）
function genSub2(borrow, needOnes) {
    for (;;) {
        const T = randInt(2, 9), u = randInt(0, 9), b = randInt(2, 9);
        if (borrow ? (u < b && (!needOnes || u >= 1)) : u >= b) return makeProblem('sub2', T * 10 + u, b);
    }
}

function uniqueProblems(count, gen) {
    const out = [], keys = new Set();
    for (let guard = 0; out.length < count && guard < 2000; guard++) {
        const p = gen();
        if (!keys.has(p.key)) { keys.add(p.key); out.push(p); }
    }
    return out;
}

// 計算カードのにがて度。★が少ないカード・さいごにまちがえたカードほどよく出る
function factWeight(stat) {
    if (!stat || !stat.n) return 3;
    if (stat.streak >= 3) return 0.6;
    return (stat.lastWrong ? 6 : 2) + (2 - stat.streak);
}

function pickFacts(facts, kind, count, cards, weighted) {
    const pool = facts.map(([a, b]) => makeProblem(kind, a, b));
    const out = [], used = new Set();
    while (out.length < count && used.size < pool.length) {
        const avail = pool.filter(p => !used.has(p.key));
        const w = avail.map(p => weighted ? factWeight(cards[p.cardId]) : 1);
        let r = Math.random() * w.reduce((s, x) => s + x, 0);
        let i = 0;
        while (i < avail.length - 1 && r >= w[i]) { r -= w[i]; i++; }
        used.add(avail[i].key);
        out.push(avail[i]);
    }
    return out;
}

function genMix(count, cards) {
    const nMake = Math.max(1, Math.round(count * 0.1));
    const nAdd1 = Math.round(count * 0.25), nSub1 = Math.round(count * 0.25), nAdd2 = Math.round(count * 0.2);
    const nSub2 = count - nMake - nAdd1 - nSub1 - nAdd2;
    return shuffle([
        ...uniqueProblems(nMake, () => genMake10()),
        ...pickFacts(ADD_FACTS, 'add1', nAdd1, cards, true),
        ...pickFacts(SUB_FACTS, 'sub1', nSub1, cards, true),
        ...uniqueProblems(nAdd2, () => genAdd2(Math.random() < 0.8)),
        ...uniqueProblems(nSub2, () => genSub2(Math.random() < 0.8, false)),
    ]);
}

// mode: guided（手順）/ practice（練習）/ boss（ボス戦）
// ①手順モードは、くり上がり・くり下がりのある問題だけを出す
function genStageProblems(kind, mode, count, cards, method) {
    const guided = mode === 'guided';
    if (kind === 'add1') return pickFacts(ADD_FACTS, 'add1', count, cards, !guided);
    if (kind === 'sub1') return pickFacts(SUB_FACTS, 'sub1', count, cards, !guided);
    if (kind === 'mix') return genMix(count, cards);
    if (kind === 'make10') return uniqueProblems(count, () => genMake10());
    if (kind === 'add2') return uniqueProblems(count, () => genAdd2(guided || Math.random() < 0.8));
    return uniqueProblems(count, () => genSub2(guided || Math.random() < 0.8, guided && method === 'gengen'));
}

// 実力チェック：各ステージから数問ずつ（くり上がり・くり下がりのある問題）
function genCheckProblems() {
    const out = [];
    CHECK_PLAN.forEach(({ stageId, count }) => {
        const kind = STAGES.find(s => s.id === stageId).kind;
        let ps;
        if (kind === 'make10') ps = shuffle(['complement', 'split', 'tenMinus', 'compose']).slice(0, count).map(sub => genMake10(sub));
        else if (kind === 'add1') ps = pickFacts(ADD_FACTS, 'add1', count, {}, false);
        else if (kind === 'sub1') ps = pickFacts(SUB_FACTS, 'sub1', count, {}, false);
        else if (kind === 'add2') ps = uniqueProblems(count, () => genAdd2(true));
        else ps = uniqueProblems(count, () => genSub2(true, false));
        ps.forEach(p => { p.checkStage = stageId; out.push(p); });
    });
    return out;
}

// ===== さくらんぼ計算の手順 =====
// 減減法は「先にばらをひく」ので、一の位が0の数（40−7など）では使えない
function effectiveMethod(p, method) {
    if (p.kind === 'sub2' && p.a % 10 === 0) return 'genka';
    return method === 'gengen' ? 'gengen' : 'genka';
}

// くり上がり・くり下がりのある問題の手順を返す（それ以外は null）
//   cherryAt: さくらんぼをつける数（式の部品の番号）
//   balls: さくらんぼの2つの実 / ballShownAfter: 何ステップ終わったら実の数を見せるか
//   steps: { prompt, answer, hint, line }  line は「計算のあと」にのこす式
//   colors: 式の数の色（10のわくの●の色とそろえる）
function buildPlan(p, method) {
    if (p.kind === 'add1') {
        const firstBig = p.a >= p.b;
        const base = firstBig ? p.a : p.b, other = firstBig ? p.b : p.a;
        const baseAt = firstBig ? 0 : 2, cherryAt = firstBig ? 2 : 0;
        const k = 10 - base, r = other - k;
        return {
            method: firstBig ? 'kasu' : 'hikasu', base, other,
            cherryAt, balls: [k, r], ballShownAfter: [1, 2],
            colors: { [baseAt]: 'ca', [cherryAt]: 'cb' },
            steps: [
                { prompt: `${base}は あといくつで10？`, answer: k, hint: `${base}に いくつたすと10になるかな？ ●の図で、あいているところを数えよう。`, line: null },
                { prompt: `${other}を ${k}と□に分けよう`, answer: r, hint: `${other}から${k}をとると、のこりはいくつ？`, line: `${base} + ${k} = 10` },
                { prompt: `10と${r}で いくつ？`, answer: 10 + r, hint: `10と${r}で、十の位が1、一の位が${r}の数だよ。`, line: `10 + ${r} = ${10 + r}` },
            ],
        };
    }
    if (p.kind === 'sub1') {
        const u = p.a - 10;
        if (method === 'gengen') {
            const r = p.b - u;
            return {
                method: 'gengen', cherryAt: 2, balls: [u, r], ballShownAfter: [0, 1],
                colors: { 0: 'ca', 2: 'cx' },
                steps: [
                    { prompt: `先に${p.a}のばらの${u}をひくよ。${p.b}を ${u}と□に分けよう`, answer: r, hint: `${p.b}から${u}をとると、のこりはいくつ？`, line: null },
                    { prompt: `${p.a} − ${u} は？`, answer: 10, hint: `${p.a}から ばらの${u}をひくと、10のまとまりだけがのこるよ。`, line: `${p.a} − ${u} = 10` },
                    { prompt: `10 − ${r} は？`, answer: 10 - r, hint: `${r}と□で10。□はいくつ？`, line: `10 − ${r} = ${10 - r}` },
                ],
            };
        }
        const d = 10 - p.b;
        return {
            method: 'genka', cherryAt: 0, balls: [10, u], ballShownAfter: [0, 1],
            colors: { 0: 'ca', 2: 'cx' },
            steps: [
                { prompt: `${p.a}を 10と□に分けよう`, answer: u, hint: `${p.a}は、10と いくつ？`, line: null },
                { prompt: `10 − ${p.b} は？`, answer: d, hint: `${p.b}と□で10。□はいくつ？`, line: `10 − ${p.b} = ${d}` },
                { prompt: `${d}と${u}で いくつ？`, answer: d + u, hint: `${d} + ${u} を計算しよう。`, line: `${d} + ${u} = ${d + u}` },
            ],
        };
    }
    if (p.kind === 'add2' && p.carry) {
        const U = p.a % 10, next = p.a - U + 10, k = next - p.a, r = p.b - k;
        return {
            method: 'next10', cherryAt: 2, balls: [k, r], ballShownAfter: [1, 2], colors: {},
            steps: [
                { prompt: `${p.a}は あといくつで${next}？`, answer: k, hint: `一の位の${U}は、あといくつで10？`, line: null },
                { prompt: `${p.b}を ${k}と□に分けよう`, answer: r, hint: `${p.b}から${k}をとると、のこりはいくつ？`, line: `${p.a} + ${k} = ${next}` },
                { prompt: `${next}と${r}で いくつ？`, answer: next + r, hint: `${next}と${r}で、一の位が${r}になるよ。`, line: `${next} + ${r} = ${next + r}` },
            ],
        };
    }
    if (p.kind === 'sub2' && p.borrow) {
        const T = Math.floor(p.a / 10), u = p.a % 10;
        if (method === 'gengen' && u >= 1) {
            const r = p.b - u, tens = T * 10;
            return {
                method: 'gengen', cherryAt: 2, balls: [u, r], ballShownAfter: [0, 1], colors: {},
                steps: [
                    { prompt: `先に${p.a}のばらの${u}をひくよ。${p.b}を ${u}と□に分けよう`, answer: r, hint: `${p.b}から${u}をとると、のこりはいくつ？`, line: null },
                    { prompt: `${p.a} − ${u} は？`, answer: tens, hint: `ばらの${u}をひくと、${tens}がのこるよ。`, line: `${p.a} − ${u} = ${tens}` },
                    { prompt: `${tens} − ${r} は？`, answer: tens - r, hint: `十のまとまりを1つくずして、10 − ${r} = ${10 - r}。十の位は1へるよ。`, line: `${tens} − ${r} = ${tens - r}` },
                ],
            };
        }
        const rest = (T - 1) * 10, big = 10 + u, d = big - p.b;
        return {
            method: 'genka', cherryAt: 0, balls: [rest, big], ballShownAfter: [0, 1], colors: {},
            steps: [
                { prompt: `${p.a}を ${rest}と□に分けよう`, answer: big, hint: `十のまとまりを1つ ばらにすると、${p.a}は${rest}と いくつ？`, line: null },
                { prompt: `${big} − ${p.b} は？`, answer: d, hint: u === 0 ? `${p.b}と□で10。□はいくつ？` : `${big}を10と${u}に分けて、10 − ${p.b} = ${10 - p.b}。${10 - p.b}と${u}で…？`, line: `${big} − ${p.b} = ${d}` },
                { prompt: `${rest}と${d}で いくつ？`, answer: rest + d, hint: `${rest}と${d}で、一の位が${d}になるよ。`, line: `${rest} + ${d} = ${rest + d}` },
            ],
        };
    }
    return null;
}

// とき方の説明に出す式
function explainLines(p, plan) {
    if (plan) return plan.steps.map(s => s.line).filter(Boolean);
    if (p.kind === 'make10') {
        const n = p.n;
        return [{
            complement: `${n} + ${10 - n} = 10`,
            tenMinus: `10 − ${n} = ${10 - n}`,
            split: `${n} は 10 と ${n - 10}`,
            compose: `10 + ${n} = ${10 + n}`,
        }[p.sub]];
    }
    const U = p.a % 10, T = Math.floor(p.a / 10);
    if (p.kind === 'add2') return [`一の位：${U} + ${p.b} = ${U + p.b}`, `十の位は${T}のまま → ${p.answer}`];
    if (p.kind === 'sub2') return [`一の位：${U} − ${p.b} = ${U - p.b}`, `十の位は${T}のまま → ${p.answer}`];
    return [];
}

// ===== 10のわく（●の図） =====
// セルの状態: 'a'=オレンジの● 'b'=青の● 'x'=とった● 'slot'=あと何こ（点線） ''=空き
function cells(...groups) {
    const out = [];
    groups.forEach(([state, n]) => { for (let i = 0; i < n; i++) out.push(state); });
    while (out.length < 10) out.push('');
    return out;
}
function frame(c, hl) { return { cells: c, hl: !!hl }; }

// done: 終わった手順の数（とき方の説明では Infinity）。10のわくを使わない問題は null
function framesFor(p, plan, done) {
    if (p.kind === 'make10') {
        const n = p.n, solved = done > 0;
        switch (p.sub) {
            case 'complement': return { frames: [frame(cells(['a', n], [solved ? 'b' : 'slot', 10 - n]))], caption: solved ? '' : `●は${n}こ。あと何こで10になる？` };
            case 'tenMinus':   return { frames: [frame(cells(['a', 10 - n], ['x', n]))], caption: solved ? '' : `10こから${n}ことると、のこりは？` };
            case 'split':      return { frames: [frame(cells(['a', 10]), true), frame(cells(['b', n - 10]))], caption: solved ? '' : '10のまとまりと、ばらが何こ？' };
            case 'compose':    return { frames: [frame(cells(['a', 10]), true), frame(cells(['b', n]))], caption: solved ? '' : `10と${n}を あわせると？` };
        }
    }
    if (!plan) return null;
    if (p.kind === 'add1') {
        const [k, r] = plan.balls, X = plan.base, Y = plan.other;
        if (done < 1) return { frames: [frame(cells(['a', X])), frame(cells(['b', Y]))] };
        if (done < 2) return { frames: [frame(cells(['a', X], ['slot', k])), frame(cells(['b', Y]))] };
        return { frames: [frame(cells(['a', X], ['b', k]), true), frame(cells(['b', r]))] };
    }
    if (p.kind === 'sub1') {
        const u = p.a - 10;
        if (plan.method === 'genka') {
            if (done < 1) return { frames: [frame(cells(['a', 10])), frame(cells(['a', u]))] };
            if (done < 2) return { frames: [frame(cells(['a', 10]), true), frame(cells(['a', u]))] };
            return { frames: [frame(cells(['a', 10 - p.b], ['x', p.b]), true), frame(cells(['a', u]))] };
        }
        const r = p.b - u;
        if (done < 1) return { frames: [frame(cells(['a', 10])), frame(cells(['a', u]))] };
        if (done < 2) return { frames: [frame(cells(['a', 10])), frame(cells(['a', u]), true)] };
        if (done < 3) return { frames: [frame(cells(['a', 10]), true), frame(cells(['x', u]))] };
        return { frames: [frame(cells(['a', 10 - r], ['x', r]), true), frame(cells(['x', u]))] };
    }
    return null;
}

// ===== まちがいの分析 =====
// よくあるまちがいの型を見分けて、それに合ったひと言を返す
function analyzeMistake(p, ans) {
    const c = p.answer;
    if (ans == null || ans === c) return '';
    if (p.kind === 'make10') {
        if (p.sub === 'complement' && ans === p.n + 10) return 'たし算になっているよ。「あわせて10」になる数をさがそう。';
        if (Math.abs(ans - c) === 1) return 'おしい！1ちがいだよ。●の数をていねいに数えてみよう。';
        return '●の図で、10の組み合わせをたしかめよう。';
    }
    const swapped = c >= 10 && c <= 99 && c % 10 !== 0 ? (c % 10) * 10 + Math.floor(c / 10) : null;  // 15 → 51
    if (p.kind === 'add1' || p.kind === 'add2') {
        if (p.carry && ans === c - 10) return 'くり上がりをわすれているよ！ 一の位で10ができたら、十の位が1ふえるよ。';
        if (ans === Math.abs(p.a - p.b)) return 'ひき算になっているよ。「＋」はたし算だね。';
        if (swapped !== null && ans === swapped) return '十の位と一の位が逆になっているよ。';
        if (Math.abs(ans - c) === 1) return 'おしい！1ちがいだよ。10をつくってから考えると、まちがえにくいよ。';
        if (p.carry && ans === c + 10) return '十の位が1多いよ。くり上がりは1回だけだね。';
        return p.carry ? 'さくらんぼ計算で、10をつくってみよう。' : '一の位どうし、十の位どうしで計算しよう。';
    }
    const u = p.a % 10, T = Math.floor(p.a / 10);
    if (p.borrow) {
        if (ans === T * 10 + (p.b - u) || ans === p.b - u) {
            return `一の位の「${u} − ${p.b}」はできないね。「${p.b} − ${u}」と逆にひいていないかな？ 10のまとまりからひこう。`;
        }
        if (ans === c + 10) return '十の位から10をかりたから、十の位は1へるよ。';
    }
    if (ans === p.a + p.b) return 'たし算になっているよ。「−」はひき算だね。';
    if (swapped !== null && ans === swapped) return '十の位と一の位が逆になっているよ。';
    if (Math.abs(ans - c) === 1) return 'おしい！1ちがいだよ。';
    return p.borrow ? '10のまとまりを使って考えよう。' : '一の位どうし、十の位どうしで計算しよう。';
}
