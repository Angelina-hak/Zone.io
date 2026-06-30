const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const miniCanvas = document.getElementById('minimap');
const mctx = miniCanvas.getContext('2d');

const deathScreen = document.getElementById('death-screen');
const playBtn     = document.getElementById('play-btn');
const timerBar    = document.getElementById('timer-bar');
const timerText   = document.getElementById('timer-text');
const coinText    = document.getElementById('coin-text');
const scoreScreen  = document.getElementById('score-screen');
const scoreText    = document.getElementById('score-text');
const restartBtn   = document.getElementById('restart-btn');
const scoreboard   = document.getElementById('scoreboard');

let playerAlive = true;
let gameState   = 'playing'; // 'playing' | 'won'
let pickups     = [];
let coinCount   = 0;
let timeLeft    = 0;
let lastTs      = null;

playBtn.addEventListener('click', () => {
  deathScreen.classList.remove('visible');
  player.respawn(grid);
  playerAlive = true;
});

restartBtn.addEventListener('click', () => {
  scoreScreen.classList.remove('visible');
  resetGame();
});

function resetGame() {
  // wipe grid
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      grid.cells[r][c] = null;

  // reset player
  player.col = Math.floor(COLS / 2);
  player.row = Math.floor(ROWS / 2);
  player.x   = player.col * CELL;
  player.y   = player.row * CELL;
  player.trail    = [];
  player.trailSet = new Set();
  player.initTerritory(grid);
  playerAlive = true;

  // reset enemies
  enemies.length = 0;
  ENEMY_COLORS.forEach(color => {
    const spawn = findFreeSpawn(grid);
    if (!spawn) return;
    const e = new Enemy(spawn.row, spawn.col, color);
    e.initTerritory(grid);
    enemies.push(e);
  });

  gameState = 'playing';
  pickups   = [];
}

function allCellsOwned() {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid.cells[r][c] !== player.color) return false;
  return true;
}

function triggerWin() {
  gameState = 'won';
  timeLeft  = 6;
  coinCount = 0;
  lastTs    = null;
  coinText.textContent  = '0';
  timerText.textContent = '6.0s';
  timerBar.classList.add('visible');
  scoreScreen.classList.remove('visible');
  spawnPickups();
}

function spawnPickups() {
  // collect all player-owned cells
  const owned = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid.cells[r][c] === player.color) owned.push({ row: r, col: c });

  // shuffle
  for (let i = owned.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [owned[i], owned[j]] = [owned[j], owned[i]];
  }

  pickups = [];
  // ~40 coins spread across territory
  owned.slice(0, Math.min(40, owned.length)).forEach(p => pickups.push({ ...p, type: 'coin' }));
}

function updateWin(ts) {
  if (lastTs === null) { lastTs = ts; return; }
  const dt = (ts - lastTs) / 1000;
  lastTs = ts;
  timeLeft = Math.max(0, timeLeft - dt);
  timerText.textContent = `${timeLeft.toFixed(1)}s`;

  pickups = pickups.filter(p => {
    if (p.row === player.row && p.col === player.col) {
      coinCount++;
      coinText.textContent = String(coinCount);
      return false;
    }
    return true;
  });

  if (timeLeft <= 0) {
    timerBar.classList.remove('visible');
    scoreText.textContent = `You collected ${coinCount} coin${coinCount !== 1 ? 's' : ''}`;
    scoreScreen.classList.add('visible');
    gameState = 'playing';
    pickups   = [];
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawPickups() {
  for (const p of pickups) {
    const x  = p.col * CELL + CELL / 2;
    const y  = p.row * CELL + CELL / 2;
    const r  = CELL * 0.32;
    const color = p.type === 'coin' ? '#ffd700' : '#06d6a0';
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // inner shine
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
    ctx.restore();
  }
}

const CELL  = 16;
const COLS  = 50;
const ROWS  = 50;

canvas.width  = COLS * CELL;  // 800
canvas.height = ROWS * CELL;  // 800

const ZOOM   = 2;
const VIEW_W = canvas.width  / ZOOM;  // visible world pixels
const VIEW_H = canvas.height / ZOOM;
let camX = 0, camY = 0;

// ── Grid ─────────────────────────────────────────────────────────────────────

class Grid {
  constructor() {
    // 2D array: null = empty, or a color string when claimed
    this.cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  draw() {
    const c0 = Math.max(0, Math.floor(camX / CELL));
    const c1 = Math.min(COLS, Math.ceil((camX + VIEW_W) / CELL) + 1);
    const r0 = Math.max(0, Math.floor(camY / CELL));
    const r1 = Math.min(ROWS, Math.ceil((camY + VIEW_H) / CELL) + 1);
    for (let row = r0; row < r1; row++) {
      for (let col = c0; col < c1; col++) {
        const x = col * CELL;
        const y = row * CELL;
        const owned = this.cells[row][col];

        if (owned) {
          // owned cell: solid fill + lighter inner highlight
          ctx.fillStyle = owned;
          ctx.fillRect(x, y, CELL, CELL);
          ctx.fillStyle = 'rgba(255,255,255,0.07)';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        } else {
          // empty cell: dark base
          ctx.fillStyle = '#0f1929';
          ctx.fillRect(x, y, CELL, CELL);
        }

        // subtle grid line
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(x, y, CELL, CELL);
      }
    }
  }
}

// ── Player ────────────────────────────────────────────────────────────────────

const TERRITORY_RADIUS = 2; // cells in each direction from start

class Player {
  constructor() {
    this.col = Math.floor(COLS / 2);
    this.row = Math.floor(ROWS / 2);
    this.speed = 3;           // px per frame (sub-cell movement)
    this.x = this.col * CELL;
    this.y = this.row * CELL;
    this.color = '#e94560';
    this.trailColor = 'rgba(233,69,96,0.6)';
    this.trail = [];              // ordered list of {row, col}
    this.trailSet = new Set();    // fast lookup
  }

  initTerritory(grid) {
    for (let r = this.row - TERRITORY_RADIUS; r <= this.row + TERRITORY_RADIUS; r++) {
      for (let c = this.col - TERRITORY_RADIUS; c <= this.col + TERRITORY_RADIUS; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
          grid.cells[r][c] = this.color;
        }
      }
    }
  }

  update(keys, grid) {
    const spd = (keys['Shift'] || keys['ShiftLeft'] || keys['ShiftRight']) ? 5 : this.speed;
    this.boosting = spd > this.speed;
    if (keys['ArrowUp'])    this.y -= spd;
    if (keys['ArrowDown'])  this.y += spd;
    if (keys['ArrowLeft'])  this.x -= spd;
    if (keys['ArrowRight']) this.x += spd;

    this.x = Math.max(0, Math.min(canvas.width  - CELL, this.x));
    this.y = Math.max(0, Math.min(canvas.height - CELL, this.y));

    const newCol = Math.floor(this.x / CELL);
    const newRow = Math.floor(this.y / CELL);

    if (newCol !== this.col || newRow !== this.row) {
      this.col = newCol;
      this.row = newRow;
      this._updateTrail(grid);
    }
  }

  _updateTrail(grid) {
    const inTerritory = grid.cells[this.row][this.col] === this.color;

    if (inTerritory && this.trail.length > 0) {
      // returned home — claim trail + enclosed area
      this._closeLoop(grid);
    } else if (!inTerritory) {
      const key = `${this.row},${this.col}`;
      if (!this.trailSet.has(key)) {
        this.trailSet.add(key);
        this.trail.push({ row: this.row, col: this.col });
      }
    }
  }

  _closeLoop(grid) {
    // 1. Paint trail cells as territory
    for (const { row, col } of this.trail) {
      grid.cells[row][col] = this.color;
    }

    // 2. Flood-fill from every border cell that isn't owned territory,
    //    marking all reachable non-territory cells as "outside".
    //    Anything not reached is enclosed → claim it.
    const outside = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const queue = [];

    const enqueue = (r, c) => {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      if (outside[r][c] || grid.cells[r][c] === this.color) return;
      outside[r][c] = true;
      queue.push([r, c]);
    };

    for (let r = 0; r < ROWS; r++) { enqueue(r, 0); enqueue(r, COLS - 1); }
    for (let c = 0; c < COLS; c++) { enqueue(0, c); enqueue(ROWS - 1, c); }

    while (queue.length) {
      const [r, c] = queue.shift();
      enqueue(r - 1, c); enqueue(r + 1, c);
      enqueue(r, c - 1); enqueue(r, c + 1);
    }

    // 3. Claim enclosed cells
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!outside[r][c] && grid.cells[r][c] !== this.color) {
          grid.cells[r][c] = this.color;
        }
      }
    }

    // 4. Reset trail
    this.trail = [];
    this.trailSet = new Set();
  }

  respawn(grid) {
    const spawn = findFreeSpawn(grid);
    if (!spawn) return false;
    this.row = spawn.row; this.col = spawn.col;
    this.x = spawn.col * CELL; this.y = spawn.row * CELL;
    this.trail = []; this.trailSet = new Set();
    this.initTerritory(grid);
    return true;
  }

  draw() {
    // trail — dashed bright line with transparency
    for (const { row, col } of this.trail) {
      const tx = col * CELL, ty = row * CELL;
      ctx.fillStyle = this.trailColor;
      ctx.fillRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
    }

    const cx = this.x + CELL / 2, cy = this.y + CELL / 2;
    ctx.save();
    ctx.shadowColor  = this.color;
    ctx.shadowBlur   = this.boosting ? 22 : 12;
    ctx.fillStyle    = this.color;
    roundRect(ctx, this.x + 1, this.y + 1, CELL - 2, CELL - 2, 4);
    ctx.fill();
    // bright centre dot
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,255,255,0.55)';
    roundRect(ctx, cx - 3, cy - 3, 6, 6, 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Enemy ─────────────────────────────────────────────────────────────────────

const ENEMY_COLORS = ['#3a86ff', '#06d6a0', '#ffbe0b', '#8338ec'];
const DIRS = [
  { dr: -1, dc:  0 },
  { dr:  1, dc:  0 },
  { dr:  0, dc: -1 },
  { dr:  0, dc:  1 },
];

class Enemy {
  constructor(startRow, startCol, color) {
    this.row = startRow;
    this.col = startCol;
    this.x   = startCol * CELL;
    this.y   = startRow * CELL;
    this.color      = color;
    this.trailColor = color + '88';  // semi-transparent via hex alpha
    this.speed      = 2;
    this.trail      = [];
    this.trailSet   = new Set();
    this.dir        = DIRS[Math.floor(Math.random() * DIRS.length)];
    this.stepTimer  = 0;   // px traveled in current direction
    this.turnEvery  = CELL * (4 + Math.floor(Math.random() * 8)); // change dir every N px
  }

  initTerritory(grid) {
    for (let r = this.row - TERRITORY_RADIUS; r <= this.row + TERRITORY_RADIUS; r++) {
      for (let c = this.col - TERRITORY_RADIUS; c <= this.col + TERRITORY_RADIUS; c++) {
        if (r >= 0 && r < ROWS && c >= 0 && c < COLS && !grid.cells[r][c]) {
          grid.cells[r][c] = this.color;
        }
      }
    }
  }

  update(grid) {
    // move in current direction
    this.x += this.dir.dc * this.speed;
    this.y += this.dir.dr * this.speed;
    this.stepTimer += this.speed;

    // bounce off walls
    if (this.x < 0 || this.x > canvas.width  - CELL) { this.dir = { dr: this.dir.dr, dc: -this.dir.dc }; this.x = Math.max(0, Math.min(canvas.width  - CELL, this.x)); }
    if (this.y < 0 || this.y > canvas.height - CELL) { this.dir = { dr: -this.dir.dr, dc: this.dir.dc }; this.y = Math.max(0, Math.min(canvas.height - CELL, this.y)); }

    if (this.stepTimer >= this.turnEvery) {
      this.dir = this._chooseBestDir(grid);
      this.stepTimer = 0;
      this.turnEvery = CELL * 3;
    }

    const newCol = Math.floor(this.x / CELL);
    const newRow = Math.floor(this.y / CELL);
    if (newCol !== this.col || newRow !== this.row) {
      this.col = newCol;
      this.row = newRow;
      this._updateTrail(grid);
    }
  }

  _chooseBestDir(grid) {
    // If player is trailing outside territory, 70% chance intercept their trail
    if (player.trail.length > 0 && Math.random() < 0.7) {
      const target = player.trail[Math.floor(player.trail.length / 2)];
      const dr = target.row - this.row;
      const dc = target.col - this.col;
      const byRow = Math.abs(dr) >= Math.abs(dc);
      const pref = byRow
        ? (dr > 0 ? DIRS[1] : DIRS[0])
        : (dc > 0 ? DIRS[3] : DIRS[2]);
      const alt  = byRow
        ? (dc > 0 ? DIRS[3] : DIRS[2])
        : (dr > 0 ? DIRS[1] : DIRS[0]);
      // don't reverse into own trail
      const reverse = { dr: -this.dir.dr, dc: -this.dir.dc };
      if (pref.dr !== reverse.dr || pref.dc !== reverse.dc) return pref;
      if (alt.dr  !== reverse.dr || alt.dc  !== reverse.dc) return alt;
    }
    // Otherwise pick direction toward most unclaimed cells (3-cell lookahead)
    let best = null, bestScore = -1;
    for (const d of DIRS) {
      if (d.dr === -this.dir.dr && d.dc === -this.dir.dc) continue; // no reverse
      let score = 0;
      for (let step = 1; step <= 3; step++) {
        const nr = this.row + d.dr * step;
        const nc = this.col + d.dc * step;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) { score -= 5; break; }
        if (grid.cells[nr][nc] === null) score += 2;
        else if (grid.cells[nr][nc] !== this.color) score += 1;
      }
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best ?? DIRS[Math.floor(Math.random() * DIRS.length)];
  }

  _updateTrail(grid) {
    if (grid.cells[this.row][this.col] === this.color && this.trail.length > 0) {
      this._closeLoop(grid);
    } else if (grid.cells[this.row][this.col] !== this.color) {
      const key = `${this.row},${this.col}`;
      if (!this.trailSet.has(key)) {
        this.trailSet.add(key);
        this.trail.push({ row: this.row, col: this.col });
      }
    }
  }

  _closeLoop(grid) {
    for (const { row, col } of this.trail) grid.cells[row][col] = this.color;

    const outside = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
    const queue   = [];
    const enqueue = (r, c) => {
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return;
      if (outside[r][c] || grid.cells[r][c] === this.color) return;
      outside[r][c] = true;
      queue.push([r, c]);
    };
    for (let r = 0; r < ROWS; r++) { enqueue(r, 0); enqueue(r, COLS - 1); }
    for (let c = 0; c < COLS; c++) { enqueue(0, c); enqueue(ROWS - 1, c); }
    while (queue.length) {
      const [r, c] = queue.shift();
      enqueue(r-1,c); enqueue(r+1,c); enqueue(r,c-1); enqueue(r,c+1);
    }
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (!outside[r][c] && grid.cells[r][c] !== this.color)
          grid.cells[r][c] = this.color;

    this.trail    = [];
    this.trailSet = new Set();
  }

  respawn(grid) {
    const spawn = findFreeSpawn(grid);
    if (!spawn) return false;
    this.row = spawn.row; this.col = spawn.col;
    this.x = spawn.col * CELL; this.y = spawn.row * CELL;
    this.trail = []; this.trailSet = new Set();
    this.initTerritory(grid);
    return true;
  }

  draw() {
    for (const { row, col } of this.trail) {
      const tx = col * CELL, ty = row * CELL;
      ctx.fillStyle = this.trailColor;
      ctx.fillRect(tx + 2, ty + 2, CELL - 4, CELL - 4);
    }

    const cx = this.x + CELL / 2, cy = this.y + CELL / 2;
    ctx.save();
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = this.color;
    roundRect(ctx, this.x + 1, this.y + 1, CELL - 2, CELL - 2, 4);
    ctx.fill();
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = 'rgba(255,255,255,0.4)';
    roundRect(ctx, cx - 3, cy - 3, 6, 6, 2);
    ctx.fill();
    ctx.restore();
  }
}

// ── Input ─────────────────────────────────────────────────────────────────────

const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true;  e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

// ── Game loop ─────────────────────────────────────────────────────────────────

const grid   = new Grid();
const player = new Player();
player.initTerritory(grid);

const enemies = ENEMY_COLORS.map(color => {
  const spawn = findFreeSpawn(grid);
  if (!spawn) return null;
  const e = new Enemy(spawn.row, spawn.col, color);
  e.initTerritory(grid);
  return e;
}).filter(Boolean);

function findFreeSpawn(grid) {
  const CHECK = TERRITORY_RADIUS + 1; // one extra cell buffer around the new territory
  for (let attempt = 0; attempt < 400; attempt++) {
    const r = Math.floor(Math.random() * ROWS);
    const c = Math.floor(Math.random() * COLS);
    let free = true;
    for (let dr = -CHECK; dr <= CHECK && free; dr++)
      for (let dc = -CHECK; dc <= CHECK && free; dc++) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS || grid.cells[nr][nc] !== null)
          free = false;
      }
    if (free) return { row: r, col: c };
  }
  return null;
}

function clearTerritory(color) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid.cells[r][c] === color) grid.cells[r][c] = null;
}

function transferTerritory(deadColor, killerColor) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid.cells[r][c] === deadColor) grid.cells[r][c] = killerColor;
}

function checkCollisions() {
  const deadEnemyIndices = new Set();

  // ── trail hits ────────────────────────────────────────────────────────────
  enemies.forEach((e, i) => {
    if (player.trailSet.has(`${e.row},${e.col}`) && playerAlive) {
      // enemy touched player's trail → reset player progress
      clearTerritory(player.color);
      player.trail = []; player.trailSet = new Set();
      playerAlive = false;
      deathScreen.classList.add('visible');
    }
    if (e.trailSet.has(`${player.row},${player.col}`)) {
      // player touched enemy's trail → enemy respawns
      transferTerritory(e.color, player.color);
      deadEnemyIndices.add(i);
    }
  });

  // enemy-vs-enemy trail hits
  for (let i = 0; i < enemies.length; i++) {
    for (let j = 0; j < enemies.length; j++) {
      if (i === j || deadEnemyIndices.has(j)) continue;
      if (enemies[j].trailSet.has(`${enemies[i].row},${enemies[i].col}`)) {
        transferTerritory(enemies[j].color, enemies[i].color);
        deadEnemyIndices.add(j);
      }
    }
  }

  // ── body-to-body hits ─────────────────────────────────────────────────────
  enemies.forEach((a, i) => {
    if (deadEnemyIndices.has(i)) return;

    // enemy moved onto player → reset player progress
    if (a.row === player.row && a.col === player.col && playerAlive) {
      clearTerritory(player.color);
      player.trail = []; player.trailSet = new Set();
      playerAlive = false;
      deathScreen.classList.add('visible');
    }

    // player moved onto enemy → enemy respawns
    if (playerAlive && player.row === a.row && player.col === a.col) {
      transferTerritory(a.color, player.color);
      deadEnemyIndices.add(i);
    }

    // enemy A onto enemy B → B respawns
    for (let j = 0; j < enemies.length; j++) {
      if (i === j || deadEnemyIndices.has(j)) continue;
      const b = enemies[j];
      if (a.row === b.row && a.col === b.col) {
        transferTerritory(b.color, a.color);
        deadEnemyIndices.add(j);
      }
    }
  });

  // respawn dead enemies; remove those with no free space
  const survived = enemies.filter((e, i) => {
    if (!deadEnemyIndices.has(i)) return true;
    return e.respawn(grid); // false = no space, drop them
  });
  enemies.length = 0;
  survived.forEach(e => enemies.push(e));
}

function drawMinimap() {
  const W = miniCanvas.width;
  const H = miniCanvas.height;
  const cw = W / COLS;
  const ch = H / ROWS;

  mctx.clearRect(0, 0, W, H);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      mctx.fillStyle = grid.cells[r][c] ?? '#16213e';
      mctx.fillRect(c * cw, r * ch, cw, ch);
    }
  }

  // player dot
  mctx.fillStyle = '#fff';
  mctx.fillRect(player.col * cw, player.row * ch, cw, ch);

  // enemy dots
  enemies.forEach(e => {
    mctx.fillStyle = '#fff';
    mctx.fillRect(e.col * cw, e.row * ch, cw, ch);
  });
}

function updateScoreboard() {
  const total = ROWS * COLS;
  const counts = new Map();
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const col = grid.cells[r][c];
      if (col) counts.set(col, (counts.get(col) || 0) + 1);
    }

  const entries = [
    { label: 'You', color: player.color, count: counts.get(player.color) || 0 },
    ...enemies.map((e, i) => ({ label: `Bot ${i + 1}`, color: e.color, count: counts.get(e.color) || 0 })),
  ].sort((a, b) => b.count - a.count);

  scoreboard.innerHTML = entries.map(e =>
    `<div class="sb-row">
      <span class="sb-dot" style="background:${e.color}"></span>
      <span class="sb-name">${e.label}</span>
      <span class="sb-pct">${(e.count / total * 100).toFixed(1)}%</span>
    </div>`
  ).join('');
}

function loop(ts) {
  if (playerAlive) player.update(keys, grid);

  if (gameState === 'playing') {
    enemies.forEach(e => e.update(grid));
    checkCollisions();
    if (playerAlive && allCellsOwned()) triggerWin();
  }

  if (gameState === 'won') updateWin(ts);

  // update camera
  camX = Math.max(0, Math.min(canvas.width  - VIEW_W, player.x + CELL / 2 - VIEW_W / 2));
  camY = Math.max(0, Math.min(canvas.height - VIEW_H, player.y + CELL / 2 - VIEW_H / 2));

  // draw world (zoomed + translated)
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-camX, -camY);
  grid.draw();
  drawPickups();
  enemies.forEach(e => e.draw());
  if (playerAlive) player.draw();
  ctx.restore();

  drawMinimap();
  updateScoreboard();

  requestAnimationFrame(loop);
}


loop();
