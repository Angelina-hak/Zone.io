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

    if (inTerritory) {
      // stepped back onto own territory — clear trail
      this.trail = [];
    } else {
      // mark this cell as trail if not already
      const key = `${this.row},${this.col}`;
      if (!this.trailSet.has(key)) {
        this.trailSet.add(key);
        this.trail.push({ row: this.row, col: this.col });
      }
    }
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

// ── Input ─────────────────────────────────────────────────────────────────────

const keys = {};
window.addEventListener('keydown', e => { keys[e.key] = true;  e.preventDefault(); });
window.addEventListener('keyup',   e => { keys[e.key] = false; });

// ── Game loop ─────────────────────────────────────────────────────────────────

const grid   = new Grid();
const player = new Player();
player.initTerritory(grid);

function loop() {
  player.update(keys, grid);

  grid.draw();
  player.draw();

  requestAnimationFrame(loop);
}

loop();
