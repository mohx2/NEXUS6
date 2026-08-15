/**
 * SNAKE // NEXUS6 Module 01
 * Responsive vector engine with custom difficulty tick scaling & sound FX.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const startBtn = document.getElementById('startBtn');
  const diffSlider = document.getElementById('diffSlider');
  const diffValue = document.getElementById('diffValue');

  // Canvas Grid Specs
  const GRID_SIZE = 20;
  const TILE_COUNT = canvas.width / GRID_SIZE;

  // Difficulty Mapping (Speed in milliseconds)
  const speedLevels = {
    '1': { ms: 140, label: 'EASY (140ms)' },
    '2': { ms: 115, label: 'MODERATE (115ms)' },
    '3': { ms: 90,  label: 'NORMAL (90ms)' },
    '4': { ms: 65,  label: 'FAST (65ms)' },
    '5': { ms: 45,  label: 'EXPERT (45ms)' }
  };

  let tickInterval = speedLevels[diffSlider.value].ms;

  // Game Engine State
  let snake = [];
  let food = { x: 0, y: 0 };
  let velocity = { x: 0, y: 0 };
  let nextVelocity = { x: 0, y: 0 };
  let score = 0;
  let highScore = localStorage.getItem('nexus6_snake_hs') || 0;
  let gameTimer = null;
  let isRunning = false;
  let particles = [];

  highScoreEl.textContent = String(highScore).padStart(3, '0');

  // Web Audio Context
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function playSound(freq, duration = 0.03, type = 'sine') {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.03, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // Difficulty Slider Listener
  diffSlider.addEventListener('input', (e) => {
    const val = e.target.value;
    tickInterval = speedLevels[val].ms;
    diffValue.textContent = speedLevels[val].label;
    
    if (isRunning) {
      clearInterval(gameTimer);
      gameTimer = setInterval(gameLoop, tickInterval);
    }
  });

  function initGame() {
    if (!audioCtx) audioCtx = new AudioCtx();

    snake = [
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 }
    ];
    velocity = { x: 0, y: -1 };
    nextVelocity = { x: 0, y: -1 };
    score = 0;
    particles = [];
    scoreEl.textContent = '000';

    spawnFood();
    isRunning = true;
    overlay.classList.add('hidden');

    if (gameTimer) clearInterval(gameTimer);
    gameTimer = setInterval(gameLoop, tickInterval);
  }

  function spawnFood() {
    let valid = false;
    while (!valid) {
      food.x = Math.floor(Math.random() * TILE_COUNT);
      food.y = Math.floor(Math.random() * TILE_COUNT);
      valid = !snake.some(seg => seg.x === food.x && seg.y === food.y);
    }
  }

  function spawnParticles(x, y) {
    const px = x * GRID_SIZE + GRID_SIZE / 2;
    const py = y * GRID_SIZE + GRID_SIZE / 2;
    for (let i = 0; i < 10; i++) {
      particles.push({
        x: px,
        y: py,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1,
        color: '#3b82f6'
      });
    }
  }

  function gameLoop() {
    velocity = { ...nextVelocity };

    const head = {
      x: snake[0].x + velocity.x,
      y: snake[0].y + velocity.y
    };

    // Boundary Collisions
    if (head.x < 0 || head.x >= TILE_COUNT || head.y < 0 || head.y >= TILE_COUNT) {
      gameOver();
      return;
    }

    // Body Collisions
    if (snake.some(seg => seg.x === head.x && seg.y === head.y)) {
      gameOver();
      return;
    }

    snake.unshift(head);

    // Eating Mechanics
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      scoreEl.textContent = String(score).padStart(3, '0');
      playSound(700, 0.06, 'triangle');
      spawnParticles(food.x, food.y);
      spawnFood();

      if (score > highScore) {
        highScore = score;
        localStorage.setItem('nexus6_snake_hs', highScore);
        highScoreEl.textContent = String(highScore).padStart(3, '0');
      }
    } else {
      snake.pop();
    }

    draw();
  }

  function draw() {
    // Canvas Background
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vector Grid Overlay
    ctx.strokeStyle = '#0e0f12';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += GRID_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Render Food Node
    ctx.fillStyle = '#3b82f6';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 10;
    ctx.fillRect(
      food.x * GRID_SIZE + 3,
      food.y * GRID_SIZE + 3,
      GRID_SIZE - 6,
      GRID_SIZE - 6
    );
    ctx.shadowBlur = 0;

    // Render Snake Body
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#ffffff' : '#3b82f6';
      ctx.fillRect(
        seg.x * GRID_SIZE + 1,
        seg.y * GRID_SIZE + 1,
        GRID_SIZE - 2,
        GRID_SIZE - 2
      );
    });

    // Particle Burst System
    particles.forEach((p, idx) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.05;

      if (p.life <= 0) {
        particles.splice(idx, 1);
      } else {
        ctx.fillStyle = `rgba(59, 130, 246, ${p.life})`;
        ctx.fillRect(p.x, p.y, 2, 2);
      }
    });
  }

  function gameOver() {
    isRunning = false;
    clearInterval(gameTimer);
    playSound(140, 0.25, 'sawtooth');

    overlayTitle.textContent = 'TERMINATED';
    overlaySub.textContent = `FINAL SCORE: ${score}`;
    startBtn.textContent = 'RETRY';
    overlay.classList.remove('hidden');
  }

  // Keyboard Event Handlers
  window.addEventListener('keydown', (e) => {
    if (!isRunning) {
      if (e.code === 'Space') initGame();
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        if (velocity.y === 0) nextVelocity = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        if (velocity.y === 0) nextVelocity = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        if (velocity.x === 0) nextVelocity = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        if (velocity.x === 0) nextVelocity = { x: 1, y: 0 };
        break;
    }
  });

  // Touch Screen Controls
  document.getElementById('btnUp').addEventListener('click', () => { if (velocity.y === 0) nextVelocity = { x: 0, y: -1 }; });
  document.getElementById('btnDown').addEventListener('click', () => { if (velocity.y === 0) nextVelocity = { x: 0, y: 1 }; });
  document.getElementById('btnLeft').addEventListener('click', () => { if (velocity.x === 0) nextVelocity = { x: -1, y: 0 }; });
  document.getElementById('btnRight').addEventListener('click', () => { if (velocity.x === 0) nextVelocity = { x: 1, y: 0 }; });

  startBtn.addEventListener('click', initGame);
});