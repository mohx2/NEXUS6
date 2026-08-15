/**
 * BRICK BREAKER ULTIMATE // NEXUS6 Module 04
 * Advanced physics, dynamic power-up drops, fireballs, explosive bombs, combo scaling.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const livesEl = document.getElementById('lives');
  const comboTag = document.getElementById('comboTag');
  const buffStatus = document.getElementById('buffStatus');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const startBtn = document.getElementById('startBtn');
  const diffSlider = document.getElementById('diffSlider');
  const diffValue = document.getElementById('diffValue');

  // Threat Levels Configuration
  const threatLevels = {
    '1': { speedMult: 0.85, baseWidth: 80, label: 'EASY (RELAXED)' },
    '2': { speedMult: 0.95, baseWidth: 70, label: 'MODERATE (STABLE)' },
    '3': { speedMult: 1.1, baseWidth: 65, label: 'NORMAL (BALANCED)' },
    '4': { speedMult: 1.3, baseWidth: 55, label: 'HARD (OVERDRIVE)' },
    '5': { speedMult: 1.5, baseWidth: 45, label: 'EXPERT (HYPER)' }
  };

  let currentDiff = threatLevels[diffSlider.value];

  // Engine State
  let score = 0;
  let highScore = localStorage.getItem('nexus6_breaker_hs') || 0;
  let lives = 3;
  let combo = 1;
  let isRunning = false;
  let animFrame = null;
  let screenShake = 0;
  let hasShield = false;

  highScoreEl.textContent = String(highScore).padStart(5, '0');

  // Web Audio Context Synthesizer
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playSound(freq, duration = 0.04, type = 'sine') {
    if (!audioCtx || audioCtx.state !== 'running') return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // Game Objects
  const paddle = {
    x: canvas.width / 2 - 32,
    y: canvas.height - 24,
    width: 65,
    height: 10,
    speed: 7.5,
    hasLaser: false,
    laserTimer: 0
  };

  let balls = [];
  let bricks = [];
  let powerups = [];
  let lasers = [];
  let particles = [];
  let popups = [];
  const keys = {};

  const brickConfig = {
    rows: 6,
    cols: 7,
    padding: 6,
    offsetTop: 40,
    offsetLeft: 15,
    height: 15
  };

  diffSlider.addEventListener('input', (e) => {
    currentDiff = threatLevels[e.target.value];
    diffValue.textContent = currentDiff.label;
  });

  function createBricks() {
    bricks = [];
    const brickWidth = (canvas.width - (brickConfig.offsetLeft * 2) - ((brickConfig.cols - 1) * brickConfig.padding)) / brickConfig.cols;

    for (let r = 0; r < brickConfig.rows; r++) {
      for (let c = 0; c < brickConfig.cols; c++) {
        let hp = 1;
        let color = '#3b82f6';

        if (r === 0) { hp = 3; color = '#a855f7'; }
        else if (r === 1 || r === 2) { hp = 2; color = '#f59e0b'; }

        bricks.push({
          x: brickConfig.offsetLeft + c * (brickWidth + brickConfig.padding),
          y: brickConfig.offsetTop + r * (brickConfig.height + brickConfig.padding),
          width: brickWidth,
          height: brickConfig.height,
          hp: hp,
          maxHp: hp,
          color: color,
          alive: true
        });
      }
    }
  }

  function spawnBall() {
    balls = [{
      x: canvas.width / 2,
      y: canvas.height - 40,
      radius: 4.5,
      vx: (Math.random() - 0.5) * 4,
      vy: -4.5 * currentDiff.speedMult,
      isFireball: false,
      trail: []
    }];
  }

  function initGame() {
    initAudio();

    paddle.width = currentDiff.baseWidth;
    paddle.x = canvas.width / 2 - paddle.width / 2;
    paddle.hasLaser = false;
    paddle.laserTimer = 0;
    hasShield = false;
    combo = 1;

    score = 0;
    lives = 3;
    scoreEl.textContent = '00000';
    livesEl.textContent = lives;
    comboTag.textContent = 'COMBO 1x';
    buffStatus.textContent = 'STATUS: NOMINAL';

    powerups = [];
    lasers = [];
    particles = [];
    popups = [];

    createBricks();
    spawnBall();

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
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 1,
        color: color
      });
    }
  }

  function createPopup(x, y, text, color = '#f59e0b') {
    popups.push({ x, y, text, color, opacity: 1, vy: -1 });
  }

  function fireLaser() {
    if (!paddle.hasLaser || !isRunning) return;
    lasers.push({ x: paddle.x + 8, y: paddle.y, vy: -9 });
    lasers.push({ x: paddle.x + paddle.width - 8, y: paddle.y, vy: -9 });
    playSound(800, 0.03, 'square');
  }

  function triggerAreaBomb(centerX, centerY) {
    playSound(180, 0.25, 'sawtooth');
    screenShake = 12;
    createExplosion(centerX, centerY, '#ef4444', 25);

    bricks.forEach(b => {
      if (!b.alive) return;
      const dist = Math.hypot((b.x + b.width / 2) - centerX, (b.y + b.height / 2) - centerY);
      if (dist < 55) {
        b.hp = 0;
        b.alive = false;
        score += 150 * combo;
      }
    });
  }

  function update() {
    // Paddle Movement
    if (keys['ArrowLeft'] || keys['a'] || keys['A']) paddle.x -= paddle.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) paddle.x += paddle.speed;

    if (paddle.x < 10) paddle.x = 10;
    if (paddle.x + paddle.width > canvas.width - 10) paddle.x = canvas.width - 10 - paddle.width;

    // Laser Buff Timer
    if (paddle.hasLaser) {
      paddle.laserTimer--;
      if (paddle.laserTimer <= 0) {
        paddle.hasLaser = false;
        buffStatus.textContent = 'STATUS: NOMINAL';
      }
    }

    // Laser Bullets
    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];
      laser.y += laser.vy;

      if (laser.y < 0) {
        lasers.splice(l, 1);
        continue;
      }

      for (let b of bricks) {
        if (b.alive && laser.x >= b.x && laser.x <= b.x + b.width && laser.y >= b.y && laser.y <= b.y + b.height) {
          b.hp--;
          createExplosion(laser.x, laser.y, '#ef4444', 4);
          lasers.splice(l, 1);

          if (b.hp <= 0) {
            b.alive = false;
            score += 100 * combo;
            scoreEl.textContent = String(score).padStart(5, '0');
          }
          break;
        }
      }
    }

    // Powerups Falling
    for (let p = powerups.length - 1; p >= 0; p--) {
      const pow = powerups[p];
      pow.y += 1.6;

      if (pow.y + 10 >= paddle.y && pow.y <= paddle.y + paddle.height && pow.x >= paddle.x && pow.x <= paddle.x + paddle.width) {
        playSound(900, 0.08, 'triangle');

        if (pow.type === 'wide') {
          paddle.width = Math.min(115, paddle.width + 25);
          buffStatus.textContent = 'BUFF: WIDE PADDLE';
        } else if (pow.type === 'laser') {
          paddle.hasLaser = true;
          paddle.laserTimer = 400;
          buffStatus.textContent = 'BUFF: LASERS';
        } else if (pow.type === 'multiball') {
          buffStatus.textContent = 'BUFF: MULTI-BALL';
          if (balls.length > 0) {
            const b = balls[0];
            balls.push({ x: b.x, y: b.y, radius: 4.5, vx: -b.vx, vy: b.vy, isFireball: b.isFireball, trail: [] });
          }
        } else if (pow.type === 'shield') {
          hasShield = true;
          buffStatus.textContent = 'BUFF: FLOOR SHIELD';
        } else if (pow.type === 'fireball') {
          balls.forEach(b => b.isFireball = true);
          buffStatus.textContent = 'BUFF: FIREBALL';
        } else if (pow.type === 'bomb') {
          if (balls.length > 0) triggerAreaBomb(balls[0].x, balls[0].y);
        }

        powerups.splice(p, 1);
      } else if (pow.y > canvas.height) {
        powerups.splice(p, 1);
      }
    }

    // Balls Physics Loop
    for (let i = balls.length - 1; i >= 0; i--) {
      const ball = balls[i];

      ball.trail.push({ x: ball.x, y: ball.y });
      if (ball.trail.length > 6) ball.trail.shift();

      ball.x += ball.vx;
      ball.y += ball.vy;

      // Wall Bouncing
      if (ball.x - ball.radius <= 10) {
        ball.x = 10 + ball.radius;
        ball.vx *= -1;
        playSound(400, 0.02, 'sine');
      } else if (ball.x + ball.radius >= canvas.width - 10) {
        ball.x = canvas.width - 10 - ball.radius;
        ball.vx *= -1;
        playSound(400, 0.02, 'sine');
      }

      if (ball.y - ball.radius <= 10) {
        ball.y = 10 + ball.radius;
        ball.vy *= -1;
        playSound(400, 0.02, 'sine');
      }

      // Shield Bounce
      if (hasShield && ball.y + ball.radius >= canvas.height - 8) {
        ball.vy *= -1;
        hasShield = false;
        buffStatus.textContent = 'STATUS: NOMINAL';
        playSound(700, 0.1, 'triangle');
        createExplosion(ball.x, canvas.height - 8, '#3b82f6', 15);
      }

      // Paddle Collision
      if (
        ball.y + ball.radius >= paddle.y &&
        ball.y - ball.radius <= paddle.y + paddle.height &&
        ball.x >= paddle.x &&
        ball.x <= paddle.x + paddle.width &&
        ball.vy > 0
      ) {
        combo = 1;
        comboTag.textContent = 'COMBO 1x';

        let hitPoint = (ball.x - (paddle.x + paddle.width / 2)) / (paddle.width / 2);
        let angle = hitPoint * (Math.PI / 3);
        let speed = Math.hypot(ball.vx, ball.vy);

        ball.vx = speed * Math.sin(angle);
        ball.vy = -speed * Math.cos(angle);
        playSound(550, 0.03, 'square');
        createExplosion(ball.x, paddle.y, '#3b82f6', 5);
      }

      // Brick Collision
      for (let b of bricks) {
        if (!b.alive) continue;

        if (
          ball.x + ball.radius >= b.x &&
          ball.x - ball.radius <= b.x + b.width &&
          ball.y + ball.radius >= b.y &&
          ball.y - ball.radius <= b.y + b.height
        ) {
          if (!ball.isFireball) {
            ball.vy *= -1;
          }

          b.hp--;
          combo = Math.min(8, combo + 1);
          comboTag.textContent = `COMBO ${combo}x`;

          const earnedScore = 100 * combo;
          score += earnedScore;
          scoreEl.textContent = String(score).padStart(5, '0');

          if (score > highScore) {
            highScore = score;
            localStorage.setItem('nexus6_breaker_hs', highScore);
            highScoreEl.textContent = String(highScore).padStart(5, '0');
          }

          createPopup(b.x + b.width / 2, b.y, `+${earnedScore}`);
          playSound(250 + (combo * 60), 0.04, 'square');
          createExplosion(ball.x, ball.y, b.color, 8);

          if (b.hp <= 0) {
            b.alive = false;

            if (Math.random() < 0.22) {
              const types = ['wide', 'laser', 'multiball', 'shield', 'fireball', 'bomb'];
              powerups.push({
                x: b.x + b.width / 2,
                y: b.y + b.height / 2,
                type: types[Math.floor(Math.random() * types.length)]
              });
            }
          }
          break;
        }
      }

      // Ball Death
      if (ball.y - ball.radius > canvas.height) {
        balls.splice(i, 1);
      }
    }

    // Life Lost Check
    if (balls.length === 0) {
      lives--;
      livesEl.textContent = lives;
      screenShake = 10;
      playSound(150, 0.2, 'sawtooth');

      if (lives <= 0) {
        gameOver(false);
      } else {
        spawnBall();
      }
    }

    // Win Check
    if (bricks.every(b => !b.alive)) {
      gameOver(true);
    }

    // Update Floating Popups
    for (let p = popups.length - 1; p >= 0; p--) {
      const pop = popups[p];
      pop.y += pop.vy;
      pop.opacity -= 0.025;
      if (pop.opacity <= 0) popups.splice(p, 1);
    }

    // Update Particles FX
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

    ctx.fillStyle = '#050507';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Wall Rails
    ctx.strokeStyle = '#16161a';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 0, canvas.width - 20, canvas.height);

    // Floor Shield
    if (hasShield) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(10, canvas.height - 4);
      ctx.lineTo(canvas.width - 10, canvas.height - 4);
      ctx.stroke();
    }

    // Bricks Matrix
    bricks.forEach((b) => {
      if (!b.alive) return;
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = b.hp === b.maxHp ? 6 : 0;
      ctx.fillRect(b.x, b.y, b.width, b.height);

      if (b.hp < b.maxHp) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fillRect(b.x, b.y, b.width, b.height * (1 - b.hp / b.maxHp));
      }
      ctx.shadowBlur = 0;
    });

    // Paddle
    ctx.fillStyle = paddle.hasLaser ? '#ef4444' : '#3b82f6';
    ctx.shadowColor = paddle.hasLaser ? '#ef4444' : '#3b82f6';
    ctx.shadowBlur = 8;
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowBlur = 0;

    // Lasers
    ctx.fillStyle = '#ef4444';
    lasers.forEach(l => ctx.fillRect(l.x - 1, l.y, 2, 7));

    // Powerups
    powerups.forEach(p => {
      ctx.fillStyle = p.type === 'laser' || p.type === 'bomb' ? '#ef4444' : (p.type === 'wide' || p.type === 'shield' ? '#3b82f6' : '#a855f7');
      ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
    });

    // Balls & Trails
    balls.forEach(ball => {
      ball.trail.forEach((t, idx) => {
        ctx.fillStyle = ball.isFireball ? '#ef4444' : '#3b82f6';
        ctx.globalAlpha = (idx / ball.trail.length) * 0.4;
        ctx.beginPath();
        ctx.arc(t.x, t.y, ball.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      });

      ctx.fillStyle = ball.isFireball ? '#ef4444' : '#ffffff';
      ctx.shadowColor = ball.isFireball ? '#ef4444' : '#3b82f6';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Score Popups
    popups.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.font = 'bold 10px JetBrains Mono';
      ctx.fillText(p.text, p.x, p.y);
      ctx.globalAlpha = 1;
    });

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

  function gameOver(won) {
    isRunning = false;
    overlayTitle.textContent = won ? 'MATRIX CLEARED' : 'RUN TERMINATED';
    overlaySub.textContent = `FINAL SCORE: ${score}`;
    startBtn.textContent = 'RE-INITIALIZE RUN';
    overlay.classList.remove('hidden');
  }

  // Event Listeners for Game Start
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    initGame();
  });

  startBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    initGame();
  });

  // Keyboard Handlers
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      fireLaser();
    }
    keys[e.key] = true;
    keys[e.code] = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') e.preventDefault();
    keys[e.key] = false;
    keys[e.code] = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isRunning) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    paddle.x = (mouseX / rect.width) * canvas.width - paddle.width / 2;
  });

  // Touch Screen Handlers
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnFire = document.getElementById('btnFire');

  btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; });
  btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowLeft'] = false; });

  btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; });
  btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowRight'] = false; });

  btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); fireLaser(); });

  canvas.addEventListener('touchmove', (e) => {
    if (!isRunning) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    paddle.x = (touchX / rect.width) * canvas.width - paddle.width / 2;
  }, { passive: true });
});