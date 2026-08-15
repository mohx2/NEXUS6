/**
 * SPACE SHOOTER // NEXUS6 Module 02
 * Fixed spacebar focus re-trigger bug and click bubbling issue.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const shieldBar = document.getElementById('shieldBar');
  const weaponStatus = document.getElementById('weaponStatus');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const startBtn = document.getElementById('startBtn');
  const diffSlider = document.getElementById('diffSlider');
  const diffValue = document.getElementById('diffValue');

  // Threat Levels
  const threatLevels = {
    '1': { spawnRate: 0.015, speedMult: 0.8, label: 'EASY (RECON)' },
    '2': { spawnRate: 0.025, speedMult: 1.0, label: 'MODERATE (PATROL)' },
    '3': { spawnRate: 0.035, speedMult: 1.2, label: 'NORMAL (INVASION)' },
    '4': { spawnRate: 0.050, speedMult: 1.4, label: 'HARD (ARMADA)' },
    '5': { spawnRate: 0.070, speedMult: 1.6, label: 'EXPERT (TOTAL WAR)' }
  };

  let currentDiff = threatLevels[diffSlider.value];

  // Engine State
  let score = 0;
  let highScore = localStorage.getItem('nexus6_space_hs') || 0;
  let isRunning = false;
  let animFrame = null;
  let screenShake = 0;

  highScoreEl.textContent = String(highScore).padStart(5, '0');

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

  // Interceptor Specs
  const player = {
    x: canvas.width / 2,
    y: canvas.height - 40,
    width: 24,
    height: 28,
    speed: 5,
    maxShield: 100,
    shield: 100,
    weaponLevel: 1,
    weaponTimer: 0,
    fireCooldown: 0,
    fireRate: 10
  };

  let lasers = [];
  let enemies = [];
  let powerups = [];
  let particles = [];
  let starfield = [];
  const keys = {};

  for (let i = 0; i < 50; i++) {
    starfield.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 2 + 0.5
    });
  }

  diffSlider.addEventListener('input', (e) => {
    currentDiff = threatLevels[e.target.value];
    diffValue.textContent = currentDiff.label;
  });

  function updateShieldHUD() {
    const pct = Math.max(0, (player.shield / player.maxShield) * 100);
    shieldBar.style.width = `${pct}%`;
    if (pct < 30) shieldBar.style.backgroundColor = '#ef4444';
    else if (pct < 60) shieldBar.style.backgroundColor = '#f59e0b';
    else shieldBar.style.backgroundColor = '#3b82f6';
  }

  function initGame() {
    if (!audioCtx) audioCtx = new AudioCtx();

    player.x = canvas.width / 2;
    player.y = canvas.height - 40;
    player.shield = 100;
    player.weaponLevel = 1;
    player.weaponTimer = 0;
    player.fireCooldown = 0;
    weaponStatus.textContent = 'WEAPON: MK-I SINGLE';
    updateShieldHUD();

    lasers = [];
    enemies = [];
    powerups = [];
    particles = [];
    score = 0;
    scoreEl.textContent = '00000';

    isRunning = true;
    overlay.classList.add('hidden');

    if (animFrame) cancelAnimationFrame(animFrame);
    loop();
  }

  function spawnEnemies() {
    if (Math.random() < currentDiff.spawnRate) {
      const rand = Math.random();
      if (rand > 0.85) {
        enemies.push({
          type: 'heavy',
          x: Math.random() * (canvas.width - 50) + 25,
          y: -30,
          width: 32,
          height: 28,
          hp: 6,
          maxHp: 6,
          speed: (Math.random() * 0.3 + 0.7) * currentDiff.speedMult,
          color: '#a855f7'
        });
      } else if (rand > 0.55) {
        enemies.push({
          type: 'zigzag',
          x: Math.random() * (canvas.width - 30) + 15,
          y: -20,
          width: 20,
          height: 20,
          hp: 2,
          maxHp: 2,
          speed: (Math.random() * 1.0 + 1.2) * currentDiff.speedMult,
          color: '#f59e0b',
          angle: 0
        });
      } else {
        enemies.push({
          type: 'scout',
          x: Math.random() * (canvas.width - 24) + 12,
          y: -20,
          width: 16,
          height: 16,
          hp: 1,
          maxHp: 1,
          speed: (Math.random() * 1.2 + 1.8) * currentDiff.speedMult,
          color: '#ef4444'
        });
      }
    }
  }

  function createExplosion(x, y, color = '#ef4444', count = 12) {
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

  function fireLasers() {
    if (!isRunning) return;

    if (player.fireCooldown <= 0) {
      if (player.weaponLevel === 1) {
        lasers.push({ x: player.x, y: player.y - player.height / 2, vx: 0, vy: -9 });
      } else if (player.weaponLevel === 2) {
        lasers.push({ x: player.x - 7, y: player.y - player.height / 4, vx: 0, vy: -9 });
        lasers.push({ x: player.x + 7, y: player.y - player.height / 4, vx: 0, vy: -9 });
      } else {
        lasers.push({ x: player.x, y: player.y - player.height / 2, vx: 0, vy: -9 });
        lasers.push({ x: player.x - 8, y: player.y - player.height / 4, vx: -1.5, vy: -8.5 });
        lasers.push({ x: player.x + 8, y: player.y - player.height / 4, vx: 1.5, vy: -8.5 });
      }

      player.fireCooldown = player.fireRate;
      playSound(800, 0.03, 'square');
    }
  }

  function update() {
    if (player.weaponTimer > 0) {
      player.weaponTimer--;
      if (player.weaponTimer <= 0) {
        player.weaponLevel = 1;
        weaponStatus.textContent = 'WEAPON: MK-I SINGLE';
      }
    }

    if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= player.speed;
    if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += player.speed;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) player.y -= player.speed;
    if (keys['ArrowDown'] || keys['s'] || keys['S']) player.y += player.speed;

    if (keys['Space']) fireLasers();

    if (player.x - player.width / 2 < 0) player.x = player.width / 2;
    if (player.x + player.width / 2 > canvas.width) player.x = canvas.width - player.width / 2;
    if (player.y - player.height / 2 < 20) player.y = 20 + player.height / 2;
    if (player.y + player.height / 2 > canvas.height) player.y = canvas.height - player.height / 2;

    if (player.fireCooldown > 0) player.fireCooldown--;

    starfield.forEach((star) => {
      star.y += star.speed;
      if (star.y > canvas.height) {
        star.y = 0;
        star.x = Math.random() * canvas.width;
      }
    });

    for (let l = lasers.length - 1; l >= 0; l--) {
      const laser = lasers[l];
      laser.x += laser.vx;
      laser.y += laser.vy;

      if (laser.y < -10 || laser.x < 0 || laser.x > canvas.width) {
        lasers.splice(l, 1);
      }
    }

    for (let p = powerups.length - 1; p >= 0; p--) {
      const pow = powerups[p];
      pow.y += 1.2;

      const dist = Math.hypot(pow.x - player.x, pow.y - player.y);
      if (dist < 20) {
        player.weaponLevel = Math.min(3, player.weaponLevel + 1);
        player.weaponTimer = 400;
        weaponStatus.textContent = player.weaponLevel === 2 ? 'WEAPON: MK-II DUAL' : 'WEAPON: MK-III TRIPLE';
        playSound(1000, 0.1, 'triangle');
        createExplosion(pow.x, pow.y, '#3b82f6', 10);
        powerups.splice(p, 1);
      } else if (pow.y > canvas.height + 20) {
        powerups.splice(p, 1);
      }
    }

    spawnEnemies();
    for (let e = enemies.length - 1; e >= 0; e--) {
      const enemy = enemies[e];

      if (enemy.type === 'zigzag') {
        enemy.angle += 0.08;
        enemy.x += Math.sin(enemy.angle) * 2;
      }
      enemy.y += enemy.speed;

      if (enemy.y > canvas.height + 20) {
        player.shield -= 15;
        updateShieldHUD();
        screenShake = 6;
        enemies.splice(e, 1);

        if (player.shield <= 0) {
          gameOver();
          return;
        }
        continue;
      }

      const shipDist = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (shipDist < (enemy.width + player.width) / 2.5) {
        player.shield -= 25;
        updateShieldHUD();
        screenShake = 10;
        playSound(160, 0.15, 'sawtooth');
        createExplosion(enemy.x, enemy.y, enemy.color, 16);
        enemies.splice(e, 1);

        if (player.shield <= 0) {
          gameOver();
          return;
        }
        continue;
      }

      for (let l = lasers.length - 1; l >= 0; l--) {
        const laser = lasers[l];
        const hitDist = Math.hypot(enemy.x - laser.x, enemy.y - laser.y);

        if (hitDist < enemy.width / 1.5) {
          enemy.hp--;
          createExplosion(laser.x, laser.y, '#ffffff', 3);
          lasers.splice(l, 1);

          if (enemy.hp <= 0) {
            playSound(220, 0.08, 'sawtooth');
            createExplosion(enemy.x, enemy.y, enemy.color, enemy.type === 'heavy' ? 22 : 12);

            if (Math.random() < 0.15) {
              powerups.push({ x: enemy.x, y: enemy.y });
            }

            score += enemy.type === 'heavy' ? 300 : (enemy.type === 'zigzag' ? 120 : 60);
            scoreEl.textContent = String(score).padStart(5, '0');

            if (score > highScore) {
              highScore = score;
              localStorage.setItem('nexus6_space_hs', highScore);
              highScoreEl.textContent = String(highScore).padStart(5, '0');
            }

            enemies.splice(e, 1);
          }
          break;
        }
      }
    }

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

    ctx.fillStyle = '#52525b';
    starfield.forEach((star) => {
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    ctx.fillStyle = '#3b82f6';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    powerups.forEach((pow) => {
      ctx.fillRect(pow.x - 5, pow.y - 5, 10, 10);
    });
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#3b82f6';
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
    lasers.forEach((laser) => {
      ctx.fillRect(laser.x - 1.5, laser.y - 4, 3, 8);
    });
    ctx.shadowBlur = 0;

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y - player.height / 2);
    ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2);
    ctx.lineTo(player.x, player.y + player.height / 4);
    ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2);
    ctx.closePath();
    ctx.stroke();
    ctx.shadowBlur = 0;

    enemies.forEach((enemy) => {
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 1.8;
      ctx.shadowColor = enemy.color;
      ctx.shadowBlur = 6;

      if (enemy.type === 'scout') {
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y + enemy.height / 2);
        ctx.lineTo(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2);
        ctx.lineTo(enemy.x + enemy.width / 2, enemy.y - enemy.height / 2);
        ctx.closePath();
        ctx.stroke();
      } else if (enemy.type === 'zigzag') {
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y - enemy.height / 2);
        ctx.lineTo(enemy.x + enemy.width / 2, enemy.y);
        ctx.lineTo(enemy.x, enemy.y + enemy.height / 2);
        ctx.lineTo(enemy.x - enemy.width / 2, enemy.y);
        ctx.closePath();
        ctx.stroke();
      } else if (enemy.type === 'heavy') {
        ctx.strokeRect(enemy.x - enemy.width / 2, enemy.y - enemy.height / 2, enemy.width, enemy.height);

        if (enemy.hp < enemy.maxHp) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#16161a';
          ctx.fillRect(enemy.x - 14, enemy.y - enemy.height / 2 - 6, 28, 3);
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(enemy.x - 14, enemy.y - enemy.height / 2 - 6, (enemy.hp / enemy.maxHp) * 28, 3);
        }
      }
      ctx.shadowBlur = 0;
    });

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

  function gameOver() {
    isRunning = false;
    playSound(100, 0.4, 'sawtooth');

    overlayTitle.textContent = 'INTERCEPTOR CRASHED';
    overlaySub.textContent = `FINAL SCORE: ${score}`;
    startBtn.textContent = 'RE-INITIALIZE';
    overlay.classList.remove('hidden');
  }

  // Prevent Spacebar from clicking buttons automatically
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault(); // Stop native page scroll or focused button clicks
    }
    keys[e.key] = true;
    keys[e.code] = true;
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
    }
    keys[e.key] = false;
    keys[e.code] = false;
  });

  // Shoot on canvas click
  canvas.addEventListener('click', (e) => {
    if (isRunning) {
      fireLasers();
    }
  });

  // Start button initialization (Removes focus immediately)
  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    startBtn.blur(); // Unfocus button to prevent spacebar trigger
    initGame();
  });

  // Touch Handlers
  const btnLeft = document.getElementById('btnLeft');
  const btnRight = document.getElementById('btnRight');
  const btnFire = document.getElementById('btnFire');

  btnLeft.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowLeft'] = true; });
  btnLeft.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowLeft'] = false; });

  btnRight.addEventListener('touchstart', (e) => { e.preventDefault(); keys['ArrowRight'] = true; });
  btnRight.addEventListener('touchend', (e) => { e.preventDefault(); keys['ArrowRight'] = false; });

  btnFire.addEventListener('touchstart', (e) => { e.preventDefault(); fireLasers(); });

  canvas.addEventListener('touchmove', (e) => {
    if (!isRunning) return;
    const rect = canvas.getBoundingClientRect();
    const touchX = e.touches[0].clientX - rect.left;
    const touchY = e.touches[0].clientY - rect.top;
    player.x = (touchX / rect.width) * canvas.width;
    player.y = (touchY / rect.height) * canvas.height;
  }, { passive: true });
});