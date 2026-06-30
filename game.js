const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const CELL  = 16;   // pixels per grid cell
const COLS  = 50;
const ROWS  = 50;

canvas.width  = COLS * CELL;  // 800
canvas.height = ROWS * CELL;  // 800

// ── Grid ─────────────────────────────────────────────────────────────────────

class Grid {
  constructor() {
    // 2D array: null = empty, or a color string when claimed
    this.cells = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  draw() {
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const x = col * CELL;
        const y = row * CELL;

        // fill
        ctx.fillStyle = this.cells[row][col] ?? '#16213e';
        ctx.fillRect(x, y, CELL, CELL);

        // grid line
        ctx.strokeStyle = '#1e2d4a';
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
    this.trailColor = '#ff8fa3';  // lighter pink for the trail
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
    if (keys['ArrowUp'])    this.y -= this.speed;
    if (keys['ArrowDown'])  this.y += this.speed;
    if (keys['ArrowLeft'])  this.x -= this.speed;
    if (keys['ArrowRight']) this.x += this.speed;

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

  draw() {
    // draw trail cells
    ctx.fillStyle = this.trailColor;
    for (const { row, col } of this.trail) {
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);
    }

    // draw player square on top
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, CELL, CELL);
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

    // randomly pick a new direction after stepTimer expires
    if (this.stepTimer >= this.turnEvery) {
      this.dir = DIRS[Math.floor(Math.random() * DIRS.length)];
      this.stepTimer = 0;
      this.turnEvery = CELL * (4 + Math.floor(Math.random() * 8));
    }

    const newCol = Math.floor(this.x / CELL);
    const newRow = Math.floor(this.y / CELL);
    if (newCol !== this.col || newRow !== this.row) {
      this.col = newCol;
      this.row = newRow;
      this._updateTrail(grid);
    }
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

  draw() {
    ctx.fillStyle = this.trailColor;
    for (const { row, col } of this.trail)
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL);

    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, CELL, CELL);
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

// Place enemies in the four quadrant corners, away from the player's center start
const ENEMY_STARTS = [
  { row: 8,          col: 8          },
  { row: 8,          col: COLS - 9   },
  { row: ROWS - 9,   col: 8          },
  { row: ROWS - 9,   col: COLS - 9   },
];
const enemies = ENEMY_STARTS.map(({ row, col }, i) => {
  const e = new Enemy(row, col, ENEMY_COLORS[i]);
  e.initTerritory(grid);
  return e;
});

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('YOU LOST', canvas.width / 2, canvas.height / 2 - 20);
  ctx.font = '20px sans-serif';
  ctx.fillText('Refresh to play again', canvas.width / 2, canvas.height / 2 + 24);
}

function transferTerritory(deadColor, killerColor) {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (grid.cells[r][c] === deadColor) grid.cells[r][c] = killerColor;
}

function checkCollisions() {
  let playerDead = false;
  let playerKiller = null;

  // ── territory hits ────────────────────────────────────────────────────────
  // stepping into an owned territory cell kills the intruder
  const territorySurviving = enemies.filter(e => {
    if (grid.cells[e.row][e.col] === player.color) {
      // enemy entered player's territory → enemy dies, player gets their territory
      transferTerritory(e.color, player.color);
      return false;
    }
    if (grid.cells[player.row][player.col] === e.color) {
      // player entered enemy's territory → player dies, enemy gets player's territory
      playerDead = true;
      playerKiller = e;
    }
    return true;
  });

  // enemy-vs-enemy territory hits
  const territoryDeadEnemies = new Set();
  for (let i = 0; i < territorySurviving.length; i++) {
    for (let j = 0; j < territorySurviving.length; j++) {
      if (i === j || territoryDeadEnemies.has(i)) continue;
      const intruder = territorySurviving[i];
      const owner    = territorySurviving[j];
      if (grid.cells[intruder.row][intruder.col] === owner.color) {
        territoryDeadEnemies.add(i);
        transferTerritory(intruder.color, owner.color);
      }
    }
  }
  const afterTerritory = territorySurviving.filter((_, i) => !territoryDeadEnemies.has(i));

  // ── trail hits ────────────────────────────────────────────────────────────
  const trailSurviving = afterTerritory.filter(e => {
    if (player.trailSet.has(`${e.row},${e.col}`)) {
      // enemy touched player's trail → player (trail owner) dies
      playerDead = true;
      playerKiller = e;
    }
    if (e.trailSet.has(`${player.row},${player.col}`)) {
      // player touched enemy's trail → enemy (trail owner) dies, player gets territory
      transferTerritory(e.color, player.color);
      return false;
    }
    return true;
  });

  // ── enemy-vs-enemy trail hits ─────────────────────────────────────────────
  // touching an enemy's trail kills that enemy (trail owner loses)
  const trailDeadEnemies = new Set();
  for (let i = 0; i < trailSurviving.length; i++) {
    for (let j = 0; j < trailSurviving.length; j++) {
      if (i === j || trailDeadEnemies.has(j)) continue;
      const mover = trailSurviving[i];
      const owner = trailSurviving[j];
      if (owner.trailSet.has(`${mover.row},${mover.col}`)) {
        // mover touched owner's trail → owner dies, mover gets territory
        trailDeadEnemies.add(j);
        transferTerritory(owner.color, mover.color);
      }
    }
  }
  const bodyCheckList = trailSurviving.filter((_, i) => !trailDeadEnemies.has(i));

  // ── body-to-body hits ─────────────────────────────────────────────────────
  // The mover (attacker) kills the target and gains their territory.
  const deadEnemies = new Set();

  for (let i = 0; i < bodyCheckList.length; i++) {
    const a = bodyCheckList[i];

    // enemy moved onto player's cell → player dies, enemy gets territory
    if (a.row === player.row && a.col === player.col) {
      playerDead = true;
      playerKiller = a;
    }

    // player moved onto enemy's cell → enemy dies, player gets territory
    if (!deadEnemies.has(i) && player.row === a.row && player.col === a.col) {
      deadEnemies.add(i);
      transferTerritory(a.color, player.color);
    }

    // enemy A runs into enemy B's body → B dies, A gets territory
    for (let j = 0; j < bodyCheckList.length; j++) {
      if (i === j || deadEnemies.has(j)) continue;
      const b = bodyCheckList[j];
      if (a.row === b.row && a.col === b.col) {
        deadEnemies.add(j);
        transferTerritory(b.color, a.color);
      }
    }
  }

  const bodySurviving = bodyCheckList.filter((_, i) => !deadEnemies.has(i));

  enemies.length = 0;
  bodySurviving.forEach(e => enemies.push(e));

  if (playerDead && playerKiller) transferTerritory(player.color, playerKiller.color);

  return playerDead;
}

function loop() {
  player.update(keys, grid);
  enemies.forEach(e => e.update(grid));

  const playerDead = checkCollisions();

  grid.draw();
  enemies.forEach(e => e.draw());
  player.draw();

  if (playerDead) {
    drawGameOver();
    return;
  }

  requestAnimationFrame(loop);
}


loop();
