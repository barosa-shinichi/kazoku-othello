'use strict';
const $ = id => document.getElementById(id);
const E = window.Othello;
let board, turn, lastMove, moveNumber, finished, history, timer;
let cpuColor = -1, aiWorker = null, aiRequest = 0;
let helping = false;
const helpButton = document.createElement('button');
helpButton.type = 'button';
helpButton.id = 'ai-help';
helpButton.className = 'ai-help';
helpButton.textContent = '最強AIお助け';
$('ai-help-control').prepend(helpButton);
helpButton.addEventListener('click', () => {
  if (helping || attacking || finished || (mode === 'cpu' && turn === cpuColor)) return;
  cancelComputer();
  helping = true;
  render();
  startComputer(turn, 'strongest', true);
});
let mode = 'cpu';
let notice = '';
let attackTimer, attacking = false;
const attackLayer = document.createElement('div');
attackLayer.className = 'attack-layer';
attackLayer.setAttribute('aria-hidden', 'true');
$('board').parentElement.appendChild(attackLayer);
let victoryPlayed = false;
const victoryLayer = document.createElement('div');
victoryLayer.className = 'victory-layer';
victoryLayer.hidden = true;
$('board').parentElement.appendChild(victoryLayer);
function dismissVictory() {
  const restoreFocus = victoryLayer.contains(document.activeElement);
  victoryLayer.hidden = true;
  victoryLayer.replaceChildren();
  if (restoreFocus) $('new-game').focus({ preventScroll: true });
  saveGame();
}
function clearVictory() {
  dismissVictory();
  victoryPlayed = false;
  $('black-player').classList.remove('winner');
  $('white-player').classList.remove('winner');
}
function renderVictory(black, white) {
  const winner = finished && black !== white ? (black > white ? 1 : -1) : null;
  for (const color of [1, -1]) {
    $(color === 1 ? 'black-player' : 'white-player').classList.toggle('winner', winner === color && !attacking);
  }
  if (winner === null || attacking) return;
  if (!victoryPlayed) {
    victoryPlayed = true;
    const scene = document.createElement('div');
    scene.className = 'victory-scene';
    scene.innerHTML = '<div class="victory-card"><div class="victory-hero" aria-hidden="true"><div class="victory-art" id="victory-art"></div><span class="victory-crown">♛</span><span class="victory-portrait" id="victory-portrait"></span></div><small id="victory-title"></small><strong id="victory-name"></strong><span class="victory-score"></span><p id="victory-message"></p><span class="victory-hint">クリック・タップで閉じる</span></div>';
    scene.querySelector('.victory-score').textContent = `黒 ${black} — ${white} 白`;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < 24; i++) {
        const confetti = document.createElement('span');
        confetti.className = 'victory-confetti';
        confetti.style.setProperty('--i', i);
        confetti.style.setProperty('--x', `${(i * 37) % 100}%`);
        confetti.textContent = i % 3 === 0 ? '✦' : '●';
        scene.appendChild(confetti);
      }
    }
    const dismiss = document.createElement('button');
    dismiss.type = 'button';
    dismiss.className = 'victory-dismiss';
    dismiss.setAttribute('aria-label', '勝利の演出を閉じる');
    dismiss.addEventListener('click', dismissVictory);
    scene.appendChild(dismiss);
    victoryLayer.appendChild(scene);
    victoryLayer.hidden = false;
    dismiss.focus({ preventScroll: true });
  }
  // Face choices remain usable, including while the celebration is visible.
  if ($('victory-name')) {
    const key = players[winner];
    const art = $('victory-art');
    if (art.dataset.character !== key) {
      art.dataset.character = key;
      art.innerHTML = artFor(key).replace('class="attack-creature"', 'class="victory-creature"');
      const scene = victoryLayer.querySelector('.victory-scene');
      scene.className = `victory-scene victory-${key}`;
      const caption = victoryFor(key);
      $('victory-title').textContent = caption[0];
      $('victory-message').textContent = caption[1];
      scene.querySelectorAll('.victory-confetti').forEach((particle, i) => {
        particle.textContent = particleFor(key, i, i % 3 === 0 ? '✦' : '●');
      });
    }
    $('victory-name').textContent = `${person(winner).name}の勝ち！`;
    const portrait = $('victory-portrait');
    portrait.className = `victory-portrait score-disc ${winner === 1 ? 'black' : 'white'}`;
    portrait.replaceChildren();
    addFace(portrait, winner);
  }
}
const attackArt = {
  kuma: `<svg viewBox="0 0 400 320" class="attack-creature" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#173b26" stroke-width="7" stroke-linejoin="round">
      <path fill="#448a40" d="M210 194C152 178 95 243 28 198C54 271 131 285 196 253Z"/>
      <path fill="#a6cd55" d="M166 203L165 174L190 182L200 155L222 175L237 153L252 188Z"/>
      <path fill="#65a947" d="M171 202C176 173 205 160 221 144L230 87C231 50 259 29 308 36L354 49Q377 53 373 89L364 111L292 113L288 135L353 126Q367 130 357 148L311 168L277 168L265 213L248 254L274 280L271 293L221 293L200 254L179 291L139 291L140 274L163 247Z"/>
      <path fill="#c5d777" stroke="none" d="M235 162L267 161L251 214L231 249L211 240L215 201Z"/>
      <path fill="#632634" d="M290 109L366 105L354 137L287 142Z"/>
      <path fill="#fff6ce" stroke-width="3" d="M299 111L307 128L316 111M324 111L333 125L342 109M348 109L354 122L362 108M300 141L309 129L316 140M328 138L335 127L342 135"/>
      <path fill="#70b04d" d="M250 183L279 193L294 179L303 188L285 212L249 207"/>
      <path d="M229 278L231 292M246 278L248 292M154 279L154 290M168 278L168 290" stroke="#f8ebbd" stroke-width="5"/>
      <path d="M289 72L320 66" stroke-width="9"/>
      <ellipse cx="307" cy="81" rx="9" ry="11" fill="#ffd858" stroke-width="3"/>
      <path d="M309 77V85" stroke="#152d25" stroke-width="5"/>
      <circle cx="354" cy="79" r="4" fill="#173b26" stroke="none"/>
    </g>
  </svg>`,
  panda: `<svg viewBox="0 0 400 320" class="attack-creature" fill="none" xmlns="http://www.w3.org/2000/svg">
    <g stroke="#593b2b" stroke-width="7" stroke-linejoin="round">
      <path fill="#a46c43" d="M275 206C353 162 384 224 346 264C328 283 299 278 270 261Z"/>
      <ellipse cx="207" cy="227" rx="83" ry="66" fill="#aa7850"/>
      <ellipse cx="204" cy="231" rx="54" ry="48" fill="#f7ddb2" stroke="none"/>
      <path fill="#765038" d="M144 267Q117 285 139 293L174 292L184 276M231 278L236 293L269 291Q287 278 261 265"/>
      <path fill="#ad7952" d="M134 183Q90 165 92 195L135 221M277 181Q315 154 322 181L279 218"/>
      <circle cx="141" cy="95" r="35" fill="#ad7952"/>
      <circle cx="270" cy="95" r="35" fill="#ad7952"/>
      <circle cx="141" cy="95" r="19" fill="#674638" stroke="none"/>
      <circle cx="270" cy="95" r="19" fill="#674638" stroke="none"/>
      <path fill="#bd8c5f" d="M205 81C154 80 126 106 110 149L92 165L118 172C127 204 164 220 206 220C252 220 282 203 292 174L318 165L298 149C284 105 255 80 205 81Z"/>
      <path fill="#f7ddb2" stroke="none" d="M119 174Q151 146 204 180Q259 145 290 176C271 228 143 233 119 174Z"/>
      <ellipse cx="160" cy="151" rx="32" ry="27" fill="#593f34" stroke="none" transform="rotate(18 160 151)"/>
      <ellipse cx="252" cy="151" rx="32" ry="27" fill="#593f34" stroke="none" transform="rotate(-18 252 151)"/>
      <path d="M149 153Q160 139 172 152M240 152Q253 139 264 153" stroke="#fff6db" stroke-width="5" stroke-linecap="round"/>
      <path fill="#382b28" d="M193 170Q205 161 217 170L205 182Z" stroke-width="3"/>
      <path d="M188 190Q205 207 224 190" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="137" cy="180" rx="13" ry="7" fill="#ea9a80" stroke="none"/>
      <ellipse cx="274" cy="180" rx="13" ry="7" fill="#ea9a80" stroke="none"/>
      <path fill="#72ab47" stroke="#3b713a" stroke-width="5" d="M196 85C161 48 200 18 252 28C252 68 223 91 196 85Z"/>
      <path d="M192 94L231 44" stroke="#3b713a" stroke-width="4"/>
    </g>
  </svg>`,
  neko: `<div class="hack-terminal"><div class="terminal-top"><span>● ● ●</span><span>NEKO // SYSTEM</span></div><div class="terminal-line">&gt; target: OTHELLO_BOARD</div><div class="terminal-line">&gt; scanning discs… <b>OK</b></div><div class="hack-lock">⌘</div><strong>ACCESS GRANTED</strong><div class="terminal-line">&gt; flip_protocol <b>COMPLETE</b></div><div class="hack-progress"><i></i></div></div>`
};
// New family members use a friendly emoji character for their attack and victory scenes.
const emojiMembers = {
  usagi: { creature: '🐰', particle: '⭐', attack: ['BUNNY JUMP', 'うさぎのぴょんぴょんジャンプ！'], victory: ['BUNNY VICTORY!', 'ぴょーん！ うさぎもいっしょにお祝い！'] },
  inu: { art: '<svg viewBox="0 0 400 320" class="attack-creature" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="58" y="22" width="284" height="176" rx="10" fill="#8a5a2e"/><rect x="72" y="36" width="256" height="148" rx="4" fill="#2e5b45"/><path d="M72 170h256" stroke="#244a38" stroke-width="6"/><text x="98" y="92" fill="#f4f1e6" font-size="30" font-family="sans-serif" font-weight="700">1+1=2</text><text x="98" y="140" fill="#f4f1e6" font-size="24" font-family="sans-serif">よくできました</text><path d="M268 70c-26 0-34 34-8 40 24 6 38-24 18-36-14-8-30 6-22 18 6 8 18 4 16-4" stroke="#ff9fc4" stroke-width="5" stroke-linecap="round"/><rect x="96" y="192" width="208" height="12" rx="3" fill="#6d4522"/><rect x="120" y="186" width="22" height="7" rx="2" fill="#fff"/><rect x="150" y="186" width="16" height="7" rx="2" fill="#ffd166"/><path d="M352 300 236 118" stroke="#9a6a3a" stroke-width="10" stroke-linecap="round"/><path d="M244 131 232 112" stroke="#d93434" stroke-width="12" stroke-linecap="round"/><rect x="36" y="268" width="150" height="30" rx="4" fill="#3f6fb3"/><rect x="36" y="268" width="14" height="30" fill="#2f5790"/><rect x="48" y="240" width="132" height="28" rx="4" fill="#d9534f"/><rect x="48" y="240" width="14" height="28" fill="#b03f3b"/><rect x="42" y="214" width="124" height="26" rx="4" fill="#e8b84a"/><rect x="42" y="214" width="14" height="26" fill="#c49434"/><path d="M66 227h86M74 254h92M60 283h110" stroke="#ffffff99" stroke-width="3" stroke-linecap="round"/></svg>', particle: '💮', attack: ['HANAMARU LESSON', 'いぬ先生のはなまる授業！'], victory: ['TEACHER VICTORY!', 'よくできました！ はなまるで勝利！'] },
  hiyoko: { creature: '🐤', particle: '⭐', attack: ['PIYO KICK', 'ひよこのぴよぴよキック！'], victory: ['PIYO VICTORY!', 'ぴよぴよ！ みんなでお祝い！'] }
};
for (const [key, member] of Object.entries(emojiMembers)) attackArt[key] = member.art || `<div class="attack-creature emoji-creature">${member.creature}</div>`;
const emojiArt = emoji => `<div class="attack-creature emoji-creature">${emoji}</div>`;
// Edited or newly added family members get a simple emoji character.
const artFor = key => attackArt[key] || emojiArt((family[key] && family[key].emoji) || '✨');
const particleFor = (key, i, fallback) => emojiMembers[key] ? emojiMembers[key].particle
  : family[key] && family[key].emoji ? family[key].emoji
  : key === 'panda' ? '🍃' : key === 'neko' ? ['0101', '1100', '0010'][i % 3] : fallback;
const namesFor = key => attackNames[key] || ['FAMILY POWER', `${family[key] ? family[key].name : ''}のきらきらパンチ！`];
const victoryFor = key => victoryNames[key] || ['FAMILY VICTORY!', `やったね！ ${family[key] ? family[key].name : ''}のかち！`];
const attackNames = { kuma: ['DINO ATTACK', 'くまの恐竜アタック！'], panda: ['TANUKI MAGIC', 'ぱんだのたぬき変身！'], neko: ['SYSTEM HACK', 'ねこのハッキング！'] };
const victoryNames = {
  kuma: ['DINO VICTORY!', 'ガオー！ 恐竜もいっしょにお祝い！'],
  panda: ['TANUKI VICTORY!', 'ぽんぽこ！ たぬきもいっしょにお祝い！'],
  neko: ['SYSTEM VICTORY!', 'ハッキング成功！ 勝利をゲット！']
};
for (const [key, member] of Object.entries(emojiMembers)) victoryNames[key] = member.victory;
for (const [key, member] of Object.entries(emojiMembers)) attackNames[key] = member.attack;
function clearAttack() {
  clearTimeout(attackTimer);
  attacking = false;
  attackLayer.className = 'attack-layer';
  attackLayer.replaceChildren();
  $('board').classList.remove('dino-impact');
}
function playAttack(color, index, changed) {
  clearAttack();
  attacking = true;
  const key = players[color];
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  attackLayer.className = `attack-layer is-active attack-${key}`;
  const scene = document.createElement('div');
  scene.className = 'attack-scene';
  scene.innerHTML = `<div class="attack-aura"></div><div class="attack-ring"></div>${artFor(key)}<div class="attack-caption"><small>${namesFor(key)[0]}</small><strong>${namesFor(key)[1]}</strong><span>${changed.length}枚くるりん！</span></div>`;
  attackLayer.appendChild(scene);
  for (let i = 0; i < 12; i++) {
    const particle = document.createElement('span');
    particle.className = 'attack-particle';
    particle.style.setProperty('--i', i);
    particle.style.setProperty('--angle', `${i * 30}deg`);
    particle.textContent = particleFor(key, i, '✦');
    scene.appendChild(particle);
  }
  if (key === 'kuma') {
    $('board').classList.add('dino-impact');
    const claws = document.createElement('div');
    claws.className = 'dino-claws';
    claws.innerHTML = '<i></i><i></i><i></i>';
    scene.appendChild(claws);
  }
  const bounds = $('board').getBoundingClientRect();
  for (const target of [index, ...changed]) {
    const rect = cells[target].getBoundingClientRect();
    const spark = document.createElement('span');
    spark.className = 'attack-hit';
    spark.style.left = `${(rect.left + rect.width / 2 - bounds.left) / bounds.width * 100}%`;
    spark.style.top = `${(rect.top + rect.height / 2 - bounds.top) / bounds.height * 100}%`;
    spark.style.width = `${rect.width / bounds.width * 100}%`;
    attackLayer.appendChild(spark);
  }
  attackTimer = setTimeout(() => {
    clearAttack();
    render();
    scheduleComputer();
  }, reduced ? 550 : 1500);
}
const FAMILY_KEY = 'family-othello-family-v1';
const builtinFamily = [
  ['kuma', 'くま'], ['panda', 'ぱんだ'], ['neko', 'ねこ'],
  ['usagi', 'うさぎ'], ['inu', 'いぬ'], ['hiyoko', 'ひよこ']
];
const familyEmojis = ['✨', '🐱', '🐶', '🐰', '🦖', '🌸', '⚽', '🚀', '🍰', '🎵', '🐢', '🦄'];
// Photos and names live in this device's storage, so each family can set up their own faces.
function defaultFamily() {
  const members = {};
  for (const [key, name] of builtinFamily) members[key] = { name, image: `assets/${key}.jpg`, builtin: true };
  return members;
}
let family = defaultFamily();
function validFamily(data) {
  return Array.isArray(data) && data.length >= 2 && data.length <= 12 && data.every(m => m
    && typeof m.key === 'string' && /^[a-z0-9_-]{1,32}$/.test(m.key)
    && typeof m.name === 'string' && m.name.length > 0 && m.name.length <= 20
    && (m.photo === null || typeof m.photo === 'string' && m.photo.startsWith('data:image/') && m.photo.length <= 400000)
    && (m.emoji === undefined || m.emoji === null || typeof m.emoji === 'string' && m.emoji.length <= 8))
    && new Set(data.map(m => m.key)).size === data.length;
}
function loadFamily() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(FAMILY_KEY)); } catch { return; }
  if (!validFamily(saved)) return;
  const defaults = defaultFamily();
  family = {};
  for (const member of saved) {
    const base = defaults[member.key];
    family[member.key] = {
      name: member.name,
      image: base ? base.image : null,
      photo: member.photo || null,
      emoji: member.emoji || null,
      builtin: !!base
    };
  }
}
function saveFamily() {
  const data = Object.entries(family).map(([key, member]) => ({
    key, name: member.name, photo: member.photo || null, emoji: member.emoji || null
  }));
  try { localStorage.setItem(FAMILY_KEY, JSON.stringify(data)); return true; }
  catch { return false; }
}
const faceSource = member => member.photo || member.image;
const players = { '1': 'kuma', '-1': 'panda' };
const person = color => family[players[color]] || Object.values(family)[0];
function fillFace(face, key) {
  const member = family[key];
  const source = member ? faceSource(member) : null;
  face.className = `face ${!source ? 'face-blank' : member.photo ? 'face-photo' : `face-${key}`}`;
  face.replaceChildren();
  if (!source) {
    // A newly added member has no photo yet, so their character stands in for one.
    const mark = document.createElement('span');
    mark.className = 'face-mark';
    mark.textContent = (member && member.emoji) || '✨';
    face.appendChild(mark);
    return;
  }
  const photo = document.createElement('img');
  photo.src = source;
  photo.alt = '';
  photo.draggable = false;
  face.appendChild(photo);
}
function addFace(element, color) {
  const face = document.createElement('span');
  face.setAttribute('aria-hidden', 'true');
  fillFace(face, players[color]);
  element.appendChild(face);
}
function renderFamily() {
  for (const color of [1, -1]) {
    const picker = color === 1 ? $('black-faces') : $('white-faces');
    picker.replaceChildren();
    for (const [key, member] of Object.entries(family)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'face-choice';
      button.setAttribute('aria-pressed', String(players[color] === key));
      button.setAttribute('aria-label', `${color === 1 ? '黒' : '白'}の顔を${member.name}にする`);
      const portrait = document.createElement('span');
      fillFace(portrait, key);
      portrait.classList.add('choice-portrait');
      const label = document.createElement('span'); label.textContent = member.name;
      button.append(portrait, label);
      button.addEventListener('click', () => {
        if (players[color] === key) return;
        if (players[-color] === key) players[-color] = players[color];
        players[color] = key;
        renderFamily(); render();
      });
      picker.appendChild(button);
    }
  }
}
const cells = Array.from({ length: 64 }, (_, index) => {
  const cell = document.createElement('button');
  cell.className = 'cell';
  cell.addEventListener('click', () => humanMove(index));
  $('board').appendChild(cell);
  return cell;
});
function reset() {
  cancelComputer();
  clearAttack();
  clearVictory();
  board = E.initialBoard(); turn = 1; lastMove = null; moveNumber = 0; finished = false; history = []; notice = '';
  $('mode').value = mode;
  $('difficulty').disabled = mode === 'local';
  render();
  scheduleComputer();
}
function snapshot() { return { board: board.slice(), turn, lastMove, moveNumber, finished, notice }; }
function restore(state) { ({ board, turn, lastMove, moveNumber, finished, notice } = state); }
function saveGame() {
  if (!Array.isArray(board)) return;
  try {
    window.GameStore.write(localStorage, {
      version: 1, state: snapshot(), history, mode, players,
      difficulty: $('difficulty').value, hints: $('hints').checked,
      victoryDismissed: finished && victoryPlayed && victoryLayer.hidden
    });
  } catch { /* The game remains playable if browser storage is unavailable. */ }
}
function humanMove(index) {
  if (helping || attacking || finished || (mode === 'cpu' && turn === cpuColor) || !E.flips(board, index, turn).length) return;
  makeMove(index);
}
function makeMove(index) {
  const mover = turn;
  const changed = E.flips(board, index, turn);
  const next = E.play(board, index, turn);
  if (!next) return;
  history.push(snapshot());
  board = next; lastMove = index; moveNumber++; turn *= -1; notice = '';
  if (!E.legalMoves(board, turn).length) {
    if (!E.legalMoves(board, -turn).length) finished = true;
    else { notice = `${turn === 1 ? '黒' : '白'}は置ける場所がないためパス。`; turn *= -1; }
  }
  playAttack(mover, index, changed);
  render([index, ...changed]);
  if (!finished) {
    $('family-cheer').textContent = changed.length >= 4
      ? `${person(mover).name}、大フィーバー！ ${changed.length}枚もくるりん！ 🎉`
      : `${person(mover).name}に、${changed.length}枚くるりん！ ${changed.length >= 2 ? '😆' : '✨'}`;
  }
  scheduleComputer();
}
function cancelComputer() {
  clearTimeout(timer);
  helping = false;
  aiRequest++;
  if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
}
function scheduleComputer() {
  cancelComputer();
  if (attacking || finished || mode !== 'cpu' || turn !== cpuColor) return;
  startComputer(cpuColor, $('difficulty').value);
}
function startComputer(color, level, assist = false) {
  const request = aiRequest;
  timer = setTimeout(() => {
    let done = false, watchdog = null;
    const accept = move => {
      if (done || request !== aiRequest || turn !== color || finished || attacking) return;
      if (assist ? !helping : mode !== 'cpu' || color !== cpuColor) return;
      done = true;
      clearTimeout(watchdog);
      if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
      helping = false;
      if (move !== null && E.flips(board, move, color).length) makeMove(move);
      else render();
    };
    // If the background worker cannot start (file:// pages, some WebViews) or never answers,
    // think on the page itself instead so 「最強AIお助け」 and the CPU always make a move.
    const fallback = () => {
      if (done || request !== aiRequest) return;
      clearTimeout(watchdog);
      if (aiWorker) { aiWorker.terminate(); aiWorker = null; }
      setTimeout(() => {
        if (done || request !== aiRequest) return;
        accept(E.chooseMove(board.slice(), color, level));
      }, 40);
    };
    try {
      aiWorker = new Worker('ai-worker.js');
      aiWorker.onmessage = ({ data }) => accept(data.move);
      aiWorker.onerror = event => { if (event && event.preventDefault) event.preventDefault(); fallback(); };
      aiWorker.postMessage({ board, player: color, level });
      watchdog = setTimeout(fallback, 8000);
    } catch { fallback(); }
  }, 450);
}
function changeController() {
  cancelComputer();
  mode = $('mode').value;
  render();
  scheduleComputer();
}
function render(changed = []) {
  const legal = E.legalMoves(board, turn);
  const cpuTurn = mode === 'cpu' && turn === cpuColor;
  const thinking = !finished && (helping || cpuTurn);
  $('difficulty').disabled = mode === 'local' || helping;
  $('mode-note').textContent = mode === 'cpu' ? `${person(cpuColor).name}の代わりにコンピューターが対戦します。自分の番には「最強AIお助け」も使えます。` : '自分の番に「最強AIお助け」を押すと、一手だけ代わりに打ってくれます。';
  $('ai-help-control').hidden = finished || cpuTurn || attacking;
  $('ai-help-player').textContent = `${person(turn).name}をお助け`;
  helpButton.disabled = helping;
  helpButton.textContent = helping ? '最強AI\n考え中…' : '最強AI\nお助け';
  helpButton.setAttribute('aria-label', helping ? `${person(turn).name}を最強AIがお助け中` : `${person(turn).name}の最強AIお助け（一手をおまかせ）`);
  $('difficulty-note').textContent = $('difficulty').value === 'strongest' ? '最強：1手あたり約3秒、じっくり先読みします。' : '';
  const black = board.filter(v => v === 1).length, white = board.filter(v => v === -1).length;
  cells.forEach((cell, index) => {
    const canPlay = !attacking && !finished && !thinking && legal.includes(index);
    cell.className = `cell${canPlay ? ' legal' : ''}`;
    cell.disabled = !canPlay;
    cell.replaceChildren();
    const coordinate = `${String.fromCharCode(65 + index % 8)}${Math.floor(index / 8) + 1}`;
    cell.setAttribute('aria-label', `${coordinate}、${board[index] ? `${board[index] === 1 ? '黒' : '白'}・${person(board[index]).name}` : canPlay ? '置けます' : '空き'}`);
    if (board[index]) {
      const disc = document.createElement('span');
      disc.className = `disc ${board[index] === 1 ? 'black' : 'white'}${lastMove === index ? ' last' : ''}${changed.includes(index) ? ' changed' : ''}`;
      addFace(disc, board[index]);
      if (changed.includes(index)) disc.style.animationDelay = `${changed.indexOf(index) * 35}ms`;
      cell.appendChild(disc);
    } else if (canPlay && $('hints').checked) {
      const dot = document.createElement('span'); dot.className = 'legal-dot'; cell.appendChild(dot);
    }
  });
  $('black-score').textContent = black; $('white-score').textContent = white;
  $('black-player').classList.toggle('active', !finished && turn === 1);
  $('white-player').classList.toggle('active', !finished && turn === -1);
  $('black-name').textContent = `${person(1).name}${mode === 'cpu' ? cpuColor === 1 ? '（CPU）' : '（あなた）' : ''}`;
  $('white-name').textContent = `${person(-1).name}${mode === 'cpu' ? cpuColor === -1 ? '（CPU）' : '（あなた）' : ''}`;
  for (const color of [1, -1]) {
    const portrait = $(color === 1 ? 'black-portrait' : 'white-portrait');
    portrait.replaceChildren(); addFace(portrait, color);
  }
  $('family-cheer').textContent = finished ? '家族みんなに拍手〜！ 👏' : lastMove === null ? 'はさんで、くるりん。盤面を自分の顔でいっぱいに！' : '次はだれの顔が増えるかな？ ✨';
  $('mode-badge').textContent = mode === 'cpu' ? 'VS COMPUTER' : 'LOCAL 2 PLAYERS';
  $('status').classList.toggle('thinking', thinking);
  $('undo').disabled = history.length === 0;
  $('move-count').textContent = `MOVE ${String(moveNumber + (finished ? 0 : 1)).padStart(2, '0')}`;
  $('round-label').textContent = finished ? '対局終了' : '対局中';
  $('last-move').textContent = lastMove === null ? '黒からスタート' : `直前の一手：${String.fromCharCode(65 + lastMove % 8)}${Math.floor(lastMove / 8) + 1}`;
  if (finished) {
    const winner = person(black > white ? 1 : -1).name;
    $('status-title').textContent = black === white ? 'なかよく引き分け！ 🤝' : `${winner}の勝ち！ おめでとう！ 🎉`;
    $('status-detail').textContent = `${black} 対 ${white}。おつかれさまでした。もう一局いかがですか？`;
  } else {
    $('status-title').textContent = helping ? `${person(turn).name}を最強AIがお助け中…` : thinking ? `${person(cpuColor).name}（CPU）が考え中…` : `${person(turn).name}の番です！`;
    $('status-detail').textContent = notice + (thinking ? helping || $('difficulty').value === 'strongest' ? '最強AIが先読み中…（約3秒）' : '次の一手を選んでいます。' : $('hints').checked ? '点のあるマスに石を置きましょう。' : '相手の石をはさめるマスに置きましょう。');
  }
  renderVictory(black, white);
  saveGame();
}
$('hints').addEventListener('change', () => render());
$('difficulty').addEventListener('change', () => { render(); scheduleComputer(); });
$('undo').addEventListener('click', () => {
  if (!history.length) return;
  cancelComputer(); clearAttack(); clearVictory();
  do { restore(history.pop()); } while (history.length && mode === 'cpu' && turn === cpuColor);
  render(); scheduleComputer();
});
function requestRestart() {
  if (!moveNumber || finished) { reset(); return; }
  $('restart-dialog').showModal();
}
$('new-game').addEventListener('click', () => requestRestart());
$('mode').addEventListener('change', changeController);
$('cancel-restart').addEventListener('click', () => $('restart-dialog').close());
$('confirm-restart').addEventListener('click', () => { $('restart-dialog').close(); reset(); });
$('rules-button').addEventListener('click', () => $('rules-dialog').showModal());
$('close-rules').addEventListener('click', () => $('rules-dialog').close());
window.addEventListener('pagehide', saveGame);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelComputer(); clearAttack(); render();
  } else { render(); scheduleComputer(); }
});
loadFamily();
if (!family[players['1']] || !family[players['-1']] || players['1'] === players['-1']) {
  const keys = Object.keys(family);
  players['1'] = keys[0]; players['-1'] = keys[1] || keys[0];
}
let savedGame = null;
try { savedGame = window.GameStore.read(localStorage); } catch { }
if (savedGame) {
  restore(savedGame.state);
  history = savedGame.history;
  mode = savedGame.mode;
  Object.assign(players, savedGame.players);
  $('mode').value = mode;
  $('difficulty').value = savedGame.difficulty;
  $('hints').checked = savedGame.hints;
  victoryPlayed = savedGame.victoryDismissed;
  renderFamily(); render(); scheduleComputer();
} else { renderFamily(); reset(); }

/* ---- Editing the family: photos, names, adding and removing members ---- */
const familyDialog = $('family-dialog');
const cropDialog = $('crop-dialog');
const cropCanvas = $('crop-canvas');
const cropZoom = $('crop-zoom');
const photoInput = $('photo-input');
const CROP_SIZE = 300, SAVED_SIZE = 360;
let cropState = null, photoTarget = null;
function newMemberKey() {
  let key;
  do { key = `m${Math.random().toString(36).slice(2, 8)}`; } while (family[key]);
  return key;
}
function drawCrop() {
  const context = cropCanvas.getContext('2d');
  const { image, scale, x, y } = cropState;
  context.clearRect(0, 0, CROP_SIZE, CROP_SIZE);
  context.fillStyle = '#e7dcc5';
  context.fillRect(0, 0, CROP_SIZE, CROP_SIZE);
  context.drawImage(image, x, y, image.width * scale, image.height * scale);
}
function clampCrop() {
  const { image, scale } = cropState;
  const width = image.width * scale, height = image.height * scale;
  cropState.x = Math.min(0, Math.max(CROP_SIZE - width, cropState.x));
  cropState.y = Math.min(0, Math.max(CROP_SIZE - height, cropState.y));
}
function openCrop(key, file) {
  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const base = Math.max(CROP_SIZE / image.width, CROP_SIZE / image.height);
      cropState = { key, image, base, scale: base, x: 0, y: 0 };
      cropState.x = (CROP_SIZE - image.width * base) / 2;
      cropState.y = (CROP_SIZE - image.height * base) / 2;
      cropZoom.value = '1';
      drawCrop();
      cropDialog.showModal();
    };
    image.onerror = () => window.alert('この写真は読み込めませんでした。別の写真を選んでください。');
    image.src = reader.result;
  };
  reader.onerror = () => window.alert('写真を読み込めませんでした。');
  reader.readAsDataURL(file);
}
cropZoom.addEventListener('input', () => {
  if (!cropState) return;
  const previous = cropState.scale;
  cropState.scale = cropState.base * Number(cropZoom.value);
  const middle = CROP_SIZE / 2;
  cropState.x = middle - (middle - cropState.x) * (cropState.scale / previous);
  cropState.y = middle - (middle - cropState.y) * (cropState.scale / previous);
  clampCrop();
  drawCrop();
});
let dragging = null;
cropCanvas.addEventListener('pointerdown', event => {
  if (!cropState) return;
  dragging = { x: event.clientX - cropState.x, y: event.clientY - cropState.y };
  cropCanvas.setPointerCapture(event.pointerId);
});
cropCanvas.addEventListener('pointermove', event => {
  if (!dragging || !cropState) return;
  cropState.x = event.clientX - dragging.x;
  cropState.y = event.clientY - dragging.y;
  clampCrop();
  drawCrop();
});
for (const type of ['pointerup', 'pointercancel']) cropCanvas.addEventListener(type, () => { dragging = null; });
$('cancel-crop').addEventListener('click', () => { cropDialog.close(); cropState = null; });
$('confirm-crop').addEventListener('click', () => {
  if (!cropState) return;
  const output = document.createElement('canvas');
  output.width = output.height = SAVED_SIZE;
  const ratio = SAVED_SIZE / CROP_SIZE;
  const context = output.getContext('2d');
  context.fillStyle = '#e7dcc5';
  context.fillRect(0, 0, SAVED_SIZE, SAVED_SIZE);
  const { image, scale, x, y } = cropState;
  context.drawImage(image, x * ratio, y * ratio, image.width * scale * ratio, image.height * scale * ratio);
  const member = family[cropState.key];
  if (member) {
    member.photo = output.toDataURL('image/jpeg', 0.85);
    if (!saveFamily()) window.alert('写真を保存できませんでした。端末の空き容量を確認してください。');
  }
  cropDialog.close();
  cropState = null;
  renderFamilyEditor(); renderFamily(); render();
});
photoInput.addEventListener('change', () => {
  const file = photoInput.files && photoInput.files[0];
  if (file && photoTarget) openCrop(photoTarget, file);
  photoInput.value = '';
});
function removeMember(key) {
  if (Object.keys(family).length <= 2) { window.alert('かぞくは2人以上にしてください。'); return; }
  if (!window.confirm(`${family[key].name}を けしますか？`)) return;
  delete family[key];
  for (const color of ['1', '-1']) {
    if (!family[players[color]]) players[color] = Object.keys(family).find(k => k !== players[color === '1' ? '-1' : '1']);
  }
  saveFamily();
  renderFamilyEditor(); renderFamily(); render();
}
function renderFamilyEditor() {
  const list = $('family-editor');
  list.replaceChildren();
  for (const [key, member] of Object.entries(family)) {
    const row = document.createElement('li');
    row.className = 'editor-row';
    const portrait = document.createElement('span');
    fillFace(portrait, key);
    portrait.classList.add('editor-portrait');
    const name = document.createElement('input');
    name.type = 'text'; name.value = member.name; name.maxLength = 20;
    name.className = 'editor-name';
    name.setAttribute('aria-label', `${member.name}の名前`);
    name.addEventListener('change', () => {
      const value = name.value.trim().slice(0, 20);
      if (!value) { name.value = member.name; return; }
      member.name = value;
      saveFamily(); renderFamily(); render();
    });
    const buttons = document.createElement('div');
    buttons.className = 'editor-buttons';
    const choose = document.createElement('button');
    choose.type = 'button'; choose.className = 'editor-button';
    choose.textContent = '写真をかえる';
    choose.addEventListener('click', () => { photoTarget = key; photoInput.click(); });
    buttons.appendChild(choose);
    if (member.builtin && member.photo) {
      const reset = document.createElement('button');
      reset.type = 'button'; reset.className = 'editor-button';
      reset.textContent = 'もとにもどす';
      reset.addEventListener('click', () => {
        member.photo = null;
        saveFamily(); renderFamilyEditor(); renderFamily(); render();
      });
      buttons.appendChild(reset);
    }
    if (!member.builtin) {
      const emoji = document.createElement('select');
      emoji.className = 'editor-emoji';
      emoji.setAttribute('aria-label', `${member.name}のキャラクター`);
      for (const option of familyEmojis) {
        const item = document.createElement('option');
        item.value = item.textContent = option;
        if ((member.emoji || '✨') === option) item.selected = true;
        emoji.appendChild(item);
      }
      emoji.addEventListener('change', () => { member.emoji = emoji.value; saveFamily(); });
      buttons.appendChild(emoji);
    }
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'editor-button editor-remove';
    remove.textContent = 'けす';
    remove.addEventListener('click', () => removeMember(key));
    buttons.appendChild(remove);
    row.append(portrait, name, buttons);
    list.appendChild(row);
  }
}
$('add-member').addEventListener('click', () => {
  if (Object.keys(family).length >= 12) { window.alert('かぞくは12人までです。'); return; }
  const key = newMemberKey();
  family[key] = { name: 'あたらしいかぞく', image: null, photo: null, emoji: '✨', builtin: false };
  saveFamily();
  renderFamilyEditor(); renderFamily(); render();
  photoTarget = key; photoInput.click();
});
$('family-edit').addEventListener('click', () => { renderFamilyEditor(); familyDialog.showModal(); });
$('close-family').addEventListener('click', () => familyDialog.close());
$('close-family-done').addEventListener('click', () => familyDialog.close());
