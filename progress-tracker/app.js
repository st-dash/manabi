// ===== 設定 =====
const STORAGE_KEY = 'manabi-rank-v1';
const SUBJECTS = ['算数', '国語', '理科', '社会', '英語'];
const TIER_NAMES = ['ブロンズ', 'シルバー', 'ゴールド', 'プラチナ', 'ダイヤモンド'];
const TIER_COLORS = {
    'ブロンズ': '#a9673c',
    'シルバー': '#7c8791',
    'ゴールド': '#c99a26',
    'プラチナ': '#2fa89c',
    'ダイヤモンド': '#3f7fd9',
    'マスター': '#8b5cf6',
};
const SUB_LABELS = ['III', 'II', 'I'];

// 6段階 × サブランク(III/II/I) + マスター = 16レベルのはしごを作る
function buildLevels() {
    const levels = [];
    TIER_NAMES.forEach((tier) => {
        [3, 2, 1].forEach((sub) => {
            levels.push({
                tier,
                sub,
                label: `${tier} ${SUB_LABELS[3 - sub]}`,
                color: TIER_COLORS[tier],
            });
        });
    });
    levels.push({ tier: 'マスター', sub: null, label: 'マスター', color: TIER_COLORS['マスター'] });
    return levels;
}
const LEVELS = buildLevels();
const MASTER_INDEX = LEVELS.length - 1;

// ===== データ永続化 =====
function loadData() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return { people: [], selectedId: null };
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.people)) return { people: [], selectedId: null };
        return parsed;
    } catch (e) {
        return { people: [], selectedId: null };
    }
}

function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadData();
if (!state.selectedId && state.people.length) {
    state.selectedId = state.people[0].id;
}

function uid() {
    return Math.random().toString(36).slice(2, 10);
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
}

// ===== 人物の操作 =====
function addPerson(rawName) {
    const name = rawName.trim();
    if (!name) return;
    const subjects = {};
    SUBJECTS.forEach((s) => { subjects[s] = 0; });
    const person = { id: uid(), name, subjects };
    state.people.push(person);
    state.selectedId = person.id;
    saveData();
    render();
}

function deletePerson(id) {
    state.people = state.people.filter((p) => p.id !== id);
    if (state.selectedId === id) {
        state.selectedId = state.people.length ? state.people[0].id : null;
    }
    saveData();
    render();
}

function selectPerson(id) {
    state.selectedId = id;
    saveData();
    render();
}

function setLevel(personId, subject, levelIndex) {
    const person = state.people.find((p) => p.id === personId);
    if (!person) return;
    person.subjects[subject] = levelIndex;
    saveData();
    closeModal();
    render();
}

function computeOverall(person) {
    const vals = SUBJECTS.map((s) => person.subjects[s] ?? 0);
    const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    return LEVELS[avg];
}

// ===== モーダル =====
function openModal(personId, subject) {
    const person = state.people.find((p) => p.id === personId);
    if (!person) return;
    const currentIdx = person.subjects[subject] ?? 0;

    let rows = '';
    TIER_NAMES.forEach((tier, tIdx) => {
        rows += `<div class="tier-row"><span class="tier-name" style="color:${TIER_COLORS[tier]}">${tier}</span><div class="tier-buttons">`;
        [3, 2, 1].forEach((sub) => {
            const idx = tIdx * 3 + (3 - sub);
            const label = SUB_LABELS[3 - sub];
            const active = idx === currentIdx ? 'active' : '';
            rows += `<button class="tier-btn ${active}" style="--tier-color:${TIER_COLORS[tier]}" onclick="setLevel('${personId}','${subject}',${idx})">${label}</button>`;
        });
        rows += '</div></div>';
    });
    const masterActive = MASTER_INDEX === currentIdx ? 'active' : '';
    rows += `<div class="tier-row"><span class="tier-name" style="color:${TIER_COLORS['マスター']}">マスター</span><div class="tier-buttons"><button class="tier-btn ${masterActive}" style="--tier-color:${TIER_COLORS['マスター']}" onclick="setLevel('${personId}','${subject}',${MASTER_INDEX})">★</button></div></div>`;

    document.getElementById('modalBox').innerHTML = `
        <h3>${escapeHtml(person.name)} さんの「${subject}」ランクを選ぶ</h3>
        <div class="tier-grid">${rows}</div>
        <button class="btn-cancel" onclick="closeModal()">閉じる</button>
    `;
    document.getElementById('modalOverlay').classList.add('open');
}

function closeModal() {
    document.getElementById('modalOverlay').classList.remove('open');
}

// ===== 描画 =====
function renderPeopleBar() {
    const bar = document.getElementById('peopleBar');
    const chips = state.people.map((p) => `
        <button class="person-chip ${p.id === state.selectedId ? 'active' : ''}" onclick="selectPerson('${p.id}')">
            ${escapeHtml(p.name)}
            <span class="chip-delete" onclick="event.stopPropagation();if(confirm('${escapeHtml(p.name)}さんのデータを削除しますか？'))deletePerson('${p.id}')">×</span>
        </button>
    `).join('');

    bar.innerHTML = `
        <div class="people-list">${chips}</div>
        <form class="add-person-form" onsubmit="return handleAddPerson(event)">
            <input type="text" id="newPersonName" placeholder="名前を入力（例：たろう）" maxlength="20">
            <button type="submit">＋ 追加</button>
        </form>
    `;
}

function handleAddPerson(e) {
    e.preventDefault();
    const input = document.getElementById('newPersonName');
    addPerson(input.value);
    input.value = '';
    return false;
}

function renderOverview() {
    const section = document.getElementById('overviewSection');
    if (state.people.length === 0) {
        section.innerHTML = `<p class="empty-state">まだ登録されていません。上の「＋追加」から名前を登録しましょう。</p>`;
        return;
    }

    const headCols = SUBJECTS.map((s) => `<th>${s}</th>`).join('');
    const rows = state.people.map((p) => {
        const cells = SUBJECTS.map((subj) => {
            const idx = p.subjects[subj] ?? 0;
            const level = LEVELS[idx];
            return `<td><button class="rank-badge" style="background:${level.color}" onclick="openModal('${p.id}','${subj}')">${level.label}</button></td>`;
        }).join('');
        const overall = computeOverall(p);
        const rowActive = p.id === state.selectedId ? 'row-active' : '';
        return `<tr class="${rowActive}"><td class="person-name-cell" onclick="selectPerson('${p.id}')">${escapeHtml(p.name)}</td>${cells}<td><span class="rank-chip" style="background:${overall.color}">${overall.label}</span></td></tr>`;
    }).join('');

    section.innerHTML = `
        <div class="table-scroll">
            <table class="rank-table">
                <thead><tr><th>名前</th>${headCols}<th>総合</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

function renderDetail() {
    const container = document.getElementById('detailSection');
    const person = state.people.find((p) => p.id === state.selectedId);
    if (!person) {
        container.innerHTML = '';
        return;
    }

    const rowsHtml = SUBJECTS.map((subj) => {
        const idx = person.subjects[subj] ?? 0;
        const level = LEVELS[idx];
        const pct = Math.round(((idx + 1) / LEVELS.length) * 100);
        const zoneNames = TIER_NAMES.concat(['マスター']);
        const ticks = zoneNames.map((t, i) => `<span class="meter-tick" style="left:${(i / zoneNames.length) * 100}%"><i style="background:${TIER_COLORS[t]}"></i>${t}</span>`).join('');
        return `
            <div class="meter-row">
                <div class="meter-label">
                    <span>${subj}</span>
                    <button class="rank-chip" style="background:${level.color};cursor:pointer" onclick="openModal('${person.id}','${subj}')">${level.label}</button>
                </div>
                <div class="meter-track">
                    <div class="meter-fill" style="width:${pct}%;background:${level.color}"></div>
                </div>
                <div class="meter-ticks">${ticks}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<h2 class="detail-title">${escapeHtml(person.name)} さんの詳細</h2>${rowsHtml}`;
}

function render() {
    renderPeopleBar();
    renderOverview();
    renderDetail();
}

render();
