/**
 * PING PONG // NEXUS6 Module 03
 * Dynamic paddle physics, CPU prediction AI, trail FX, and synthesized audio.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const playerScoreEl = document.getElementById('playerScore');
  const cpuScoreEl = document.getElementById('cpuScore');
  const ballSpeedEl = document.getElementById('ballSpeed');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const startBtn = document.getElementById('startBtn');
  const diffSlider = document.getElementById('diffSlider');
  const diffValue = document.getElementById('diffValue');

  // Difficulty Configurations
  const threatLevels = {
    '1': { aiSpeed: 2.5, reaction: 0.05, label: 'EASY (NOVICE AI)' },
    '2': { aiSpeed: 3.5, reaction: 0.08, label: 'MODERATE (COMPETENT)' },
    '3': { aiSpeed: 4.8, reaction: 0.12, label: 'NORMAL (BALANCED)' },
    '4': { aiSpeed: 6.0, reaction: 0.18, label: 'HARD (ADVANCED)' },
    '5': { aiSpeed: 7.5, reaction: 0.25, label: 'EXPERT (UNBEATABLE)' }
  };

  let currentDiff = threatLevels[diffSlider.value];

  // Engine State
  let playerScore = 0;
  let cpuScore = 0;
  const maxScore = 7;
  let isRunning = false;
  let animFrame = null;
  let screenShake = 0;

  // Audio Context
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function playSound(freq, duration = 0.04, type = 'sine') {
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

  // Entities
  const player = {
    x: canvas.width / 2 - 35,
    y: canvas.height - 25,
    width: 70,
    height: 10,
    speed: 7
  };

  const cpu = {
    x: canvas.width / 2 - 35,
    y: 15,
    width: 70,
    height: 10
  };

  const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 5,
    vx: 0,
    vy: 0,
    baseSpeed: 4.5,
    speedMultiplier: 1.0,
    trail: []
  };

  let particles = [];
  const keys = {};

  diffSlider.addEventListener('input', (e) => {
    currentDiff = threatLevels[e.target.value];
    diffValue.textContent = currentDiff.label;
  });

  function resetBall(direction = 1) {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    ball.speedMultiplier = 1.0;
    ballSpeedEl.textContent = 'BALL SPEED: 1.0X';
    ball.trail = [];

    const angle = (Math.random() * Math.PI / 4) - Math.PI / 8;
    ball.vx = ball.baseSpeed * Math.sin(angle);
    ball.vy = ball.baseSpeed * Math.cos(angle) * direction;
  }

  function initGame() {
    if (!audioCtx) audioCtx = new AudioCtx();

    playerScore = 0;
    cpuScore = 0;
    playerScoreEl.textContent = '0';
    cpuScoreEl.textContent = '0';

    player.x = canvas.width / 2 - player.width / 2;
    cpu.x = canvas.width / 2 - cpu.width / 2;

    resetBall(Math.random() > 0.5 ? 1 : -1);

    isRunning = true;
    overlay.classList.add('hidden');

    if (animFrame) cancelAnimationFrame(animFrame);
    loop();
  }

  function createExplosion(x, y, color = '#3b82f6', count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: (Math.random() - 0.5) * 4,
        life: 1,
        color: color
      });
    }
  }

  function updateAI() {
    // Only track ball if moving towards CPU half
    if (ball.vy < 0) {
      const targetX = ball.x - cpu.width / 2;
      const diff = targetX - cpu.x;
      cpu.x += diff * currentDiff.reaction;

      if (cpu.x < 10) cpu.x = 10;
      if (cpu.x + cpu.width > canvas.width - 10) cpu.x = canvas.width - 10 - cpu.width;
    }
  }

  function update() {
    // Keyboard Input
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += player.speed;

    // Boundaries
    if (player.x < 10) player.x = 10;
    if (player.x + player.width > canvas.width - 10) player.x = canvas.width - 10 - player.width;

    // CPU AI update
    updateAI();

    // Store Trail
    ball.trail.push({ x: ball.x, y: ball.y });
    if (ball.trail.length > 8) ball.trail.shift();

    // Move Ball
    ball.x += ball.vx * ball.speedMultiplier;
    ball.y += ball.vy * ball.speedMultiplier;

    // Side Walls Bounce
    if (ball.x - ball.radius <= 10) {
      ball.x = 10 + ball.radius;
      ball.vx *= -1;
      playSound(400, 0.02, 'sine');
      createExplosion(ball.x, ball.y, '#ededed', 4);
    } else if (ball.x + ball.radius >= canvas.width - 10) {
      ball.x = canvas.width - 10 - ball.radius;
      ball.vx *= -1;
      playSound(400, 0.02, 'sine');
      createExplosion(ball.x, ball.y, '#ededed', 4);
    }

    // Player Paddle Hit Detection
    if (
      ball.y + ball.radius >= player.y &&
      ball.y - ball.radius <= player.y + player.height &&
      ball.x >= player.x &&
      ball.x <= player.x + player.width &&
      ball.vy > 0
    ) {
      let hitPoint = (ball.x - (player.x + player.width / 2)) / (player.width / 2);
      let angle = hitPoint * (Math.PI / 3);

      let speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = speed * Math.sin(angle);
      ball.vy = -speed * Math.cos(angle);

      // Speed acceleration per rally
      ball.speedMultiplier = Math.min(2.2, ball.speedMultiplier + 0.05);
      ballSpeedEl.textContent = `BALL SPEED: ${ball.speedMultiplier.toFixed(1)}X`;

      playSound(600, 0.04, 'square');
      createExplosion(ball.x, player.y, '#3b82f6', 8);
      screenShake = 3;
    }

    // CPU Paddle Hit Detection
    if (
      ball.y - ball.radius <= cpu.y + cpu.height &&
      ball.y + ball.radius >= cpu.y &&
      ball.x >= cpu.x &&
      ball.x <= cpu.x + cpu.width &&
      ball.vy < 0
    ) {
      let hitPoint = (ball.x - (cpu.x + cpu.width / 2)) / (cpu.width / 2);
      let angle = hitPoint * (Math.PI / 3);

      let speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = speed * Math.sin(angle);
      ball.vy = speed * Math.cos(angle);

      ball.speedMultiplier = Math.min(2.2, ball.speedMultiplier + 0.05);
      ballSpeedEl.textContent = `BALL SPEED: ${ball.speedMultiplier.toFixed(1)}X`;

      playSound(500, 0.04, 'square');
      createExplosion(ball.x, cpu.y + cpu.height, '#ef4444', 8);
      screenShake = 3;
    }

    // Goal Check (Top / Bottom)
    if (ball.y - ball.radius < 0) {
      // Player Scores
      playerScore++;
      playerScoreEl.textContent = playerScore;
      playSound(800, 0.15, 'triangle');
      screenShake = 8;
      createExplosion(ball.x, 0, '#3b82f6', 20);

      if (playerScore >= maxScore) {
        gameOver(true);
      } else {
        resetBall(-1);
      }
    } else if (ball.y + ball.radius > canvas.height) {
      // CPU Scores
      cpuScore++;
      cpuScoreEl.textContent = cpuScore;
      playSound(180, 0.2, 'sawtooth');
      screenShake = 8;
      createExplosion(ball.x, canvas.height, '#ef4444', 20);

      if (cpuScore >= maxScore) {
        gameOver(false);
      } else {
        resetBall(1);
      }
    }

    // Particles FX
    for (let p = particles.length - 1; p >= 0; p--) {
      const pt = particles[p];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life -= 0.04;
      if (pt.life <= 0) particles.splice(p, 1);
    }

    if (screenShake > 0) screenShake--;
  }

  function draw() {
    ctx.save();

    if (screenShake > 0) {
      const rx = (Math.random() - 0.5) * screenShake;
      const ry = (Math.random() - 0.5) * screenShake;
      ctx.translate(rx, ry);
    }

    // Background
    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Arena Border Rails
    ctx.strokeStyle = '#16161a';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 0, canvas.width - 20, canvas.height);

    // Center Dashed Line
    ctx.strokeStyle = '#16161a';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(10, canvas.height / 2);
    ctx.lineTo(canvas.width - 10, canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Ball Trail
    ball.trail.forEach((t, idx) => {
      ctx.fillStyle = '#3b82f6';
      ctx.globalAlpha = (idx / ball.trail.length) * 0.4;
      ctx.beginPath();
      ctx.arc(t.x, t.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // Draw Ball
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Player Paddle
    ctx.fillStyle = '#3b82f6';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;

    // Draw CPU Paddle
    ctx.fillStyle = '#ef4444';
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 8;
    ctx.fillRect(cpu.x, cpu.y, cpu.width, cpu.height);
    ctx.shadowBlur = 0;

    // Particles FX
    particles.forEach((p) => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, 2, 2);
      ctx.globalAlpha = 1;
    });

    ctx.restore();
  }

  function loop() {
    if (!isRunning) return;
    update();
    draw();
    animFrame = requestAnimationFrame(loop);
  }

  function gameOver(playerWon) {
    isRunning = false;

    overlayTitle.textContent = playerWon ? 'VICTORY SECURED' : 'MATCH LOST';
    overlaySub.textContent = `FINAL SCORE: ${playerScore} - ${cpuScore}`;
    startBtn.textContent = 'RE-INITIALIZE MATCH';
    overlay.classList.remove('hidden');
  }

  // Input Listeners
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys[e.key] = true;
    keys[e.code] = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys[e.key] = false;
    keys[e.code] = false;
  });

  // Track Mouse Movement across Canvas
  canvas.addEventListener('mousemove', (e) => {
    if (!isRunning) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    player.x = (mouseX / rect.width) * canvas.width - player.width / 2;
  });

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startBtn.blur();
    initGame();
  });

  // Touch Handlers
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');

  btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; });
  btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowLeft'] = false; });

  btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; });
  btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowRight'] = false; });

  canvas.addEventListener('touchmove', (e) => {
    if (!isRunning) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    player.x = (touchX / rect.width) * canvas.width - player.width / 2;
  }, { passive: true });
});