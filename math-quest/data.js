// data.js - 算数クエストのステージ・設定データ

// ===== 1回のプレイで出す問題数 =====
const GUIDED_COUNT = 5;      // ① 手順で考える
const PRACTICE_COUNT = 10;   // ② 練習
const BOSS_COUNT = 15;       // ③ ボス戦
const MIX_BOSS_COUNT = 20;   // さいごのステージ（ミックス）
const WEAK_COUNT = 10;       // にがてカード特訓
const MAX_HEARTS = 3;        // ボス戦のハート

// 「はやい！」と判定する時間（ミリ秒）。これ以内に正解すると計算カードの★がふえる
const FAST_MS = { make10: 4000, add1: 5000, sub1: 5000, add2: 8000, sub2: 8000 };
// ボス戦の1問あたりの時間制限（ミリ秒）
const LIMIT_MS = { make10: 8000, add1: 10000, sub1: 10000, add2: 15000, sub2: 15000 };

// 実力チェックで各ステージから出す問題数
const CHECK_PLAN = [
    { stageId: 1, count: 3 },
    { stageId: 2, count: 4 },
    { stageId: 3, count: 4 },
    { stageId: 4, count: 3 },
    { stageId: 5, count: 3 },
];

// 各ステージの3ステップ
const STEP_INFO = {
    guided:   { num: '①', label: '手順で考える', meta: `${GUIDED_COUNT}問・さくらんぼ図を見ながら1つずつ` },
    practice: { num: '②', label: '練習',         meta: `${PRACTICE_COUNT}問・まちがえると とき方が出るよ` },
    boss:     { num: '③', label: 'ボス戦',       meta: `${BOSS_COUNT}問・時間制限あり・ハート${MAX_HEARTS}つ` },
};

// examples: ステージ紹介に出す「れい」。makeProblem() の引数そのまま。
//   ひき算は とき方（genka=減加法 / gengen=減減法）ごとに用意する
const STAGES = [
    {
        id: 1, kind: 'make10', icon: '🔟',
        name: '10のまとまり', example: '7と□で10',
        enemy: '👻', enemyName: 'バラバラおばけ',
        steps: ['guided', 'practice', 'boss'],
        guidedLabel: '見て考える', guidedMeta: `${GUIDED_COUNT}問・●の図を見ながら`,
        lesson: '10は計算の「ひみつ兵器」！<br>「7と3」「6と4」のように、あわせて10になる組み合わせを、すぐに言えるようにしよう。くり上がり・くり下がりの計算は、ぜんぶこの力を使うよ。',
        examples: { any: ['make10', 7, 0, 'complement'] },
    },
    {
        id: 2, kind: 'add1', icon: '🍒',
        name: 'くり上がりのたし算', example: '8 + 7',
        enemy: '🐸', enemyName: 'ピョンピョンガエル',
        steps: ['guided', 'practice', 'boss'],
        lesson: '<b>さくらんぼ計算</b>で10をつくろう。<br>大きい方の数を10にするために、もう1つの数を2つに分けるよ。',
        examples: { any: ['add1', 8, 7] },
    },
    {
        id: 3, kind: 'sub1', icon: '🍒',
        name: 'くり下がりのひき算', example: '13 − 8',
        enemy: '🦇', enemyName: 'ぶらさがりコウモリ',
        steps: ['guided', 'practice', 'boss'],
        lesson: 'とき方は2つ。すきな方をえらんでね。<br><b>減加法</b>：10からひいて、ばらとたす<br><b>減減法</b>：先にばらをひいて、10からひく',
        examples: { genka: ['sub1', 13, 8], gengen: ['sub1', 12, 3] },
    },
    {
        id: 4, kind: 'add2', icon: '🚀',
        name: '2けたのたし算', example: '38 + 5',
        enemy: '🐙', enemyName: 'よくばりダコ',
        steps: ['guided', 'practice', 'boss'],
        lesson: '2けたになっても考え方は同じ。<br>38をあと2で<b>40</b>にするように、<b>つぎの何十</b>をつくろう。',
        examples: { any: ['add2', 38, 5] },
    },
    {
        id: 5, kind: 'sub2', icon: '🛡️',
        name: '2けたのひき算', example: '42 − 7',
        enemy: '🦊', enemyName: 'いたずらギツネ',
        steps: ['guided', 'practice', 'boss'],
        lesson: '一の位がひけないときは、十のまとまりを1つ<b>ばら</b>にしよう。<br><b>減加法</b>：42を30と12に分けて、12−7<br><b>減減法</b>：先にばらの2をひいて40、40から5をひく',
        examples: { genka: ['sub2', 42, 7], gengen: ['sub2', 42, 7] },
    },
    {
        id: 6, kind: 'mix', icon: '🏰',
        name: 'まおうの城', example: 'ぜんぶミックス',
        enemy: '🐲', enemyName: 'けいさんドラゴン',
        steps: ['boss'],
        lesson: `ここまでの計算が、まざって出てくるよ。<br>${MIX_BOSS_COUNT}問たおして、けいさんドラゴンをやっつけよう！`,
        examples: null,
    },
];
