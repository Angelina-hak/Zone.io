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

  update(keys) {
    if (keys['ArrowUp'])    this.y -= this.speed;
    if (keys['ArrowDown'])  this.y += this.speed;
    if (keys['ArrowLeft'])  this.x -= this.speed;
    if (keys['ArrowRight']) this.x += this.speed;

    this.x = Math.max(0, Math.min(canvas.width  - CELL, this.x));
    this.y = Math.max(0, Math.min(canvas.height - CELL, this.y));

    this.col = Math.floor(this.x / CELL);
    this.row = Math.floor(this.y / CELL);
  }

  draw() {
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
  player.update(keys);

  grid.draw();
  player.draw();

  requestAnimationFrame(loop);
}

loop();
