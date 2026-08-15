/**
 * RADIAL DODGE // NEXUS6 OVERDRIVE
 * Ultra-addictive Bullet-Hell Survival Game with Graze Combo System, Boss Laser Sweeps,
 * Shockwave Waves, and Enhanced Particle Effects.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const waveCountEl = document.getElementById('waveCount');
  const comboCountEl = document.getElementById('comboCount');
  const dashStatusEl = document.getElementById('dashStatus');
  const powerupHud = document.getElementById('powerupHud');

  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const statsBox = document.getElementById('statsBox');
  const finalScoreEl = document.getElementById('finalScore');
  const finalTimeEl = document.getElementById('finalTime');
  const finalWaveEl = document.getElementById('finalWave');
  const finalGrazesEl = document.getElementById('finalGrazes');
  const startBtn = document.getElementById('startBtn');

  const diffSlider = document.getElementById('diffSlider');
  const diffValue = document.getElementById('diffValue');

  // Threat Levels
  const threatLevels = {
    '1': { bulletSpeed: 2.3, spawnRate: 40, label: 'EASY (RELAXED)' },
    '2': { bulletSpeed: 2.9, spawnRate: 30, label: 'MODERATE (STABLE)' },
    '3': { bulletSpeed: 3.6, spawnRate: 22, label: 'NORMAL (BALANCED)' },
    '4': { bulletSpeed: 4.5, spawnRate: 15, label: 'HARD (INTENSE)' },
    '5': { bulletSpeed: 5.4, spawnRate: 9, label: 'EXPERT (HELL)' }
  };

  let currentDiff = threatLevels[diffSlider.value];

  // Engine Variables
  let startTime = 0;
  let elapsedTime = 0;
  let score = 0;
  let highScore = localStorage.getItem('nexus6_dodge_hs_score') || 0;
  let wave = 1;
  let multiplier = 1.0;
  let comboTimer = 0;
  let grazesCount = 0;
  let isRunning = false;
  let animFrame = null;
  let screenShake = 0;

  highScoreEl.textContent = Math.floor(highScore);

  // Audio Context & Web Audio Synth
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function playSound(freq, duration = 0.05, type = 'sine', slideFreq = null) {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      if (slideFreq) {
        osc.frequency.exponentialRampToValueAtTime(slideFreq, audioCtx.currentTime + duration);
      }
      gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // Player State
  const player = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    radius: 7,
    grazeRadius: 22,
    speed: 4.2,
    dashCooldown: 0,
    maxDashCooldown: 70,
    isDashing: false,
    dashTimer: 0,
    dashDir: { x: 0, y: 0 },
    ghosts: []
  };

  // Input Mapping
  const keys = {
    w: false, a: false, s: false, d: false,
    ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
  };

  // Active Powerups
  const powerups = {
    shield: 0,
    freeze: 0
  };

  let bullets = [];
  let items = [];
  let particles = [];
  let floatingTexts = [];
  let laserBeams = [];

  let spawnTimer = 0;
  let waveTimer = 0;

  diffSlider.addEventListener('input', (e) => {
    currentDiff = threatLevels[e.target.value];
    diffValue.textContent = currentDiff.label;
  });

  function triggerDash() {
    if (player.dashCooldown === 0) {
      let dx = 0;
      let dy = 0;

      if (keys.w || keys.ArrowUp) dy -= 1;
      if (keys.s || keys.ArrowDown) dy += 1;
      if (keys.a || keys.ArrowLeft) dx -= 1;
      if (keys.d || keys.ArrowRight) dx += 1;

      if (touchVector.x !== 0 || touchVector.y !== 0) {
        dx = touchVector.x;
        dy = touchVector.y;
      }

      if (dx === 0 && dy === 0) dy = -1; // Default upwards dash

      const len = Math.hypot(dx, dy);
      player.dashDir = { x: dx / len, y: dy / len };

      player.isDashing = true;
      player.dashTimer = 10;
      player.dashCooldown = player.maxDashCooldown;
      dashStatusEl.textContent = 'RECHARGING';
      dashStatusEl.style.color = '#f43f5e';

      playSound(900, 0.08, 'sawtooth', 350);
      createParticles(player.x, player.y, '#22d3ee', 14);
    }
  }

  function initGame() {
    if (!audioCtx) audioCtx = new AudioCtx();

    startTime = Date.now();
    elapsedTime = 0;
    score = 0;
    wave = 1;
    multiplier = 1.0;
    comboTimer = 0;
    grazesCount = 0;

    scoreEl.textContent = '0';
    waveCountEl.textContent = wave;
    comboCountEl.textContent = '1.0x';

    player.x = canvas.width / 2;
    player.y = canvas.height / 2;
    player.dashCooldown = 0;
    player.isDashing = false;
    player.ghosts = [];
    dashStatusEl.textContent = 'READY';
    dashStatusEl.style.color = '#22d3ee';

    powerups.shield = 0;
    powerups.freeze = 0;
    updatePowerupHud();

    bullets = [];
    items = [];
    particles = [];
    floatingTexts = [];
    laserBeams = [];

    spawnTimer = 0;
    waveTimer = 0;

    isRunning = true;
    overlay.classList.add('hidden');

    if (animFrame) cancelAnimationFrame(animFrame);
    loop();
  }

  function createParticles(x, y, color = '#3b82f6', count = 10) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        life: 1.0,
        color: color,
        size: 2 + Math.random() * 3
      });
    }
  }

  function addFloatingText(x, y, text, color = '#f8fafc') {
    floatingTexts.push({ x, y, text, color, life: 1.0, vy: -1.2 });
  }

  function updatePowerupHud() {
    powerupHud.innerHTML = '';
    if (powerups.shield > 0) {
      powerupHud.innerHTML += `<div class="powerup-badge badge-shield">SHIELD ACTIVE</div>`;
    }
    if (powerups.freeze > 0) {
      powerupHud.innerHTML += `<div class="powerup-badge badge-freeze">FREEZE (${Math.ceil(powerups.freeze / 60)}s)</div>`;
    }
  }

  // Trigger Boss Laser Hazard
  function spawnBossLaser() {
    const isHorizontal = Math.random() > 0.5;
    const pos = isHorizontal 
      ? 50 + Math.random() * (canvas.height - 100)
      : 50 + Math.random() * (canvas.width - 100);

    laserBeams.push({
      isHorizontal,
      pos,
      warningTimer: 70, // Frames warning beam renders before firing
      activeTimer: 35,  // Firing phase frames
      width: 18
    });
    
    playSound(400, 0.3, 'square', 800);
  }

  // Entity Spawner
  function spawnEntities() {
    spawnTimer--;
    const currentSpawnRate = Math.max(6, currentDiff.spawnRate - (wave * 2));

    if (spawnTimer <= 0) {
      spawnTimer = currentSpawnRate;

      // Spawn Bullet Ring / Radial Pattern
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = 290;
      const bx = canvas.width / 2 + Math.cos(angle) * spawnRadius;
      const by = canvas.height / 2 + Math.sin(angle) * spawnRadius;

      const targetAngle = Math.atan2(player.y - by, player.x - bx) + (Math.random() - 0.5) * 0.15;
      const speed = currentDiff.bulletSpeed + (wave * 0.25);

      bullets.push({
        x: bx,
        y: by,
        vx: Math.cos(targetAngle) * speed,
        vy: Math.sin(targetAngle) * speed,
        radius: 4.5,
        color: '#f43f5e',
        grazed: false
      });

      // Periodic Multi-Bullet Spiral Waves
      if (wave >= 2 && Math.random() < 0.15) {
        for (let i = -1; i <= 1; i++) {
          const spreadAngle = targetAngle + (i * 0.22);
          bullets.push({
            x: bx,
            y: by,
            vx: Math.cos(spreadAngle) * (speed * 0.85),
            vy: Math.sin(spreadAngle) * (speed * 0.85),
            radius: 4,
            color: '#c084fc',
            grazed: false
          });
        }
      }

      // Collectible Orbs & Powerups
      if (Math.random() < 0.22 && items.length < 5) {
        items.push({
          x: 40 + Math.random() * (canvas.width - 80),
          y: 40 + Math.random() * (canvas.height - 80),
          radius: 6,
          type: 'orb'
        });
      }

      if (Math.random() < 0.04 && items.length < 6) {
        items.push({
          x: 50 + Math.random() * (canvas.width - 100),
          y: 50 + Math.random() * (canvas.height - 100),
          radius: 8,
          type: Math.random() > 0.5 ? 'shield' : 'freeze'
        });
      }
    }
  }

  function update() {
    elapsedTime = (Date.now() - startTime) / 1000;
    
    // Multiplier Combo Decay
    if (comboTimer > 0) {
      comboTimer--;
      if (comboTimer === 0) {
        multiplier = 1.0;
        comboCountEl.textContent = '1.0x';
      }
    }

    // Passive Score Gain
    score += (1 + wave * 0.5) * multiplier;
    scoreEl.textContent = Math.floor(score);

    if (score > highScore) {
      highScore = score;
      localStorage.setItem('nexus6_dodge_hs_score', highScore);
      highScoreEl.textContent = Math.floor(highScore);
    }

    // Wave Advancement (Every 12 seconds)
    waveTimer += 1 / 60;
    if (waveTimer >= 12) {
      waveTimer = 0;
      wave++;
      waveCountEl.textContent = wave;
      playSound(1100, 0.25, 'triangle');
      addFloatingText(canvas.width / 2 - 40, 80, `WAVE ${wave} ENGAGED!`, '#f43f5e');

      if (wave >= 3) {
        spawnBossLaser();
      }
    }

    // Freeze Powerup Counter
    if (powerups.freeze > 0) {
      powerups.freeze--;
      if (powerups.freeze === 0) updatePowerupHud();
    }

    // Dash Mechanics & Cooldown
    if (player.dashCooldown > 0) {
      player.dashCooldown--;
      if (player.dashCooldown === 0) {
        dashStatusEl.textContent = 'READY';
        dashStatusEl.style.color = '#22d3ee';
      }
    }

    if (player.isDashing) {
      player.x += player.dashDir.x * 13;
      player.y += player.dashDir.y * 13;

      // Add Dash Afterimage Ghost
      player.ghosts.push({ x: player.x, y: player.y, alpha: 0.7 });

      player.dashTimer--;
      if (player.dashTimer <= 0) {
        player.isDashing = false;
      }
    } else {
      let moveX = 0;
      let moveY = 0;

      if (keys.w || keys.ArrowUp) moveY -= 1;
      if (keys.s || keys.ArrowDown) moveY += 1;
      if (keys.a || keys.ArrowLeft) moveX -= 1;
      if (keys.d || keys.ArrowRight) moveX += 1;

      if (touchVector.x !== 0 || touchVector.y !== 0) {
        moveX = touchVector.x;
        moveY = touchVector.y;
      }

      if (moveX !== 0 && moveY !== 0) {
        moveX *= 0.7071;
        moveY *= 0.7071;
      }

      player.x += moveX * player.speed;
      player.y += moveY * player.speed;
    }

    // Clamp Player Inside Arena
    player.x = Math.max(player.radius + 10, Math.min(canvas.width - player.radius - 10, player.x));
    player.y = Math.max(player.radius + 10, Math.min(canvas.height - player.radius - 10, player.y));

    // Update Ghosts
    for (let g = player.ghosts.length - 1; g >= 0; g--) {
      player.ghosts[g].alpha -= 0.08;
      if (player.ghosts[g].alpha <= 0) player.ghosts.splice(g, 1);
    }

    spawnEntities();

    // Update Boss Lasers
    for (let l = laserBeams.length - 1; l >= 0; l--) {
      const laser = laserBeams[l];
      if (laser.warningTimer > 0) {
        laser.warningTimer--;
      } else if (laser.activeTimer > 0) {
        laser.activeTimer--;
        
        // Laser Hit Detection
        if (!player.isDashing) {
          const hit = laser.isHorizontal 
            ? Math.abs(player.y - laser.pos) < laser.width / 2 + player.radius
            : Math.abs(player.x - laser.pos) < laser.width / 2 + player.radius;

          if (hit) {
            if (powerups.shield > 0) {
              powerups.shield = 0;
              updatePowerupHud();
              screenShake = 12;
              playSound(200, 0.2, 'sawtooth');
              addFloatingText(player.x - 20, player.y - 15, 'SHIELD BROKEN!', '#22d3ee');
            } else {
              gameOver();
              return;
            }
          }
        }
      } else {
        laserBeams.splice(l, 1);
      }
    }

    // Update Bullets & Bullet-Graze System
    const freezeMult = powerups.freeze > 0 ? 0.3 : 1.0;

    for (let b = bullets.length - 1; b >= 0; b--) {
      const bullet = bullets[b];
      bullet.x += bullet.vx * freezeMult;
      bullet.y += bullet.vy * freezeMult;

      const dist = Math.hypot(player.x - bullet.x, player.y - bullet.y);

      // Bullet Graze Check
      if (!bullet.grazed && dist < player.grazeRadius + bullet.radius && dist > player.radius + bullet.radius) {
        bullet.grazed = true;
        grazesCount++;
        multiplier = Math.min(5.0, multiplier + 0.2);
        comboTimer = 120; // 2 Seconds refresh time
        comboCountEl.textContent = `${multiplier.toFixed(1)}x`;
        playSound(1200, 0.03, 'sine');
        addFloatingText(bullet.x, bullet.y, 'GRAZE!', '#facc15');
      }

      // Direct Collision Check
      if (!player.isDashing && dist < player.radius + bullet.radius) {
        if (powerups.shield > 0) {
          powerups.shield = 0;
          updatePowerupHud();
          screenShake = 12;
          playSound(250, 0.15, 'triangle');
          createParticles(bullet.x, bullet.y, '#22d3ee', 16);
          addFloatingText(player.x - 20, player.y - 15, 'SHIELD BROKEN!', '#22d3ee');
          bullets.splice(b, 1);
          continue;
        }

        screenShake = 20;
        playSound(100, 0.35, 'sawtooth');
        createParticles(player.x, player.y, '#f43f5e', 30);
        gameOver();
        return;
      }

      // Cleanup Out-of-Bounds
      if (
        bullet.x < -20 || bullet.x > canvas.width + 20 ||
        bullet.y < -20 || bullet.y > canvas.height + 20
      ) {
        bullets.splice(b, 1);
      }
    }

    // Update Items / Powerups
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const dist = Math.hypot(player.x - item.x, player.y - item.y);

      if (dist < player.radius + item.radius) {
        if (item.type === 'orb') {
          score += 250 * multiplier;
          playSound(800, 0.05, 'triangle');
          createParticles(item.x, item.y, '#c084fc', 8);
          addFloatingText(item.x, item.y, `+${Math.floor(250 * multiplier)}`, '#c084fc');
        } else if (item.type === 'shield') {
          powerups.shield = 1;
          updatePowerupHud();
          playSound(950, 0.1, 'sine');
          addFloatingText(player.x - 15, player.y - 15, '+SHIELD', '#22d3ee');
          createParticles(item.x, item.y, '#22d3ee', 12);
        } else if (item.type === 'freeze') {
          powerups.freeze = 300;
          updatePowerupHud();
          playSound(900, 0.1, 'sine');
          addFloatingText(player.x - 15, player.y - 15, '+FREEZE', '#c084fc');
          createParticles(item.x, item.y, '#c084fc', 12);
        }

        items.splice(i, 1);
      }
    }

    // Particle FX
    for (let pt = particles.length - 1; pt >= 0; pt--) {
      const p = particles[pt];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.035;
      if (p.life <= 0) particles.splice(pt, 1);
    }

    // Floating Texts
    for (let ft = floatingTexts.length - 1; ft >= 0; ft--) {
      const t = floatingTexts[ft];
      t.y += t.vy;
      t.life -= 0.025;
      if (t.life <= 0) floatingTexts.splice(ft, 1);
    }

    if (screenShake > 0) screenShake--;
  }

  function draw() {
    ctx.save();

    if (screenShake > 0) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // Background Clear
    ctx.fillStyle = '#020204';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Arena Perimeter Ring
    ctx.strokeStyle = '#161822';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Dynamic Pulsing Radar Rings
    ctx.strokeStyle = 'rgba(244, 63, 94, 0.04)';
    ctx.beginPath();
    ctx.arc(canvas.width / 2, canvas.height / 2, (Date.now() * 0.06) % 280, 0, Math.PI * 2);
    ctx.stroke();

    // Render Laser Beams
    laserBeams.forEach(laser => {
      if (laser.warningTimer > 0) {
        // Warning Beam Indicator
        ctx.strokeStyle = 'rgba(244, 63, 94, 0.35)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        if (laser.isHorizontal) {
          ctx.moveTo(10, laser.pos);
          ctx.lineTo(canvas.width - 10, laser.pos);
        } else {
          ctx.moveTo(laser.pos, 10);
          ctx.lineTo(laser.pos, canvas.height - 10);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        // Firing High-Energy Beam
        ctx.fillStyle = '#f43f5e';
        ctx.shadowColor = '#f43f5e';
        ctx.shadowBlur = 15;
        if (laser.isHorizontal) {
          ctx.fillRect(10, laser.pos - laser.width / 2, canvas.width - 20, laser.width);
        } else {
          ctx.fillRect(laser.pos - laser.width / 2, 10, laser.width, canvas.height - 20);
        }
        ctx.shadowBlur = 0;
      }
    });

    // Draw Graze Zone Outer Ring
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.grazeRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw Player Ghost Afterimages
    player.ghosts.forEach(g => {
      ctx.fillStyle = `rgba(34, 211, 238, ${g.alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(g.x, g.y, player.radius, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw Player Body
    ctx.fillStyle = player.isDashing ? '#facc15' : (powerups.shield > 0 ? '#22d3ee' : '#3b82f6');
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw Shield Barrier
    if (powerups.shield > 0) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.radius + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Bullets
    bullets.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Items
    items.forEach(item => {
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);

      if (item.type === 'orb') {
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#c084fc';
      } else if (item.type === 'shield') {
        ctx.fillStyle = '#22d3ee';
        ctx.shadowColor = '#22d3ee';
      } else if (item.type === 'freeze') {
        ctx.fillStyle = '#c084fc';
        ctx.shadowColor = '#c084fc';
      }

      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Particles
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    });

    // Draw Floating Text FX
    floatingTexts.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.font = '800 11px "JetBrains Mono"';
      ctx.globalAlpha = t.life;
      ctx.fillText(t.text, t.x, t.y);
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
    overlayTitle.textContent = 'SYSTEM OVERLOAD';
    overlaySub.textContent = 'CRITICAL HULL DAMAGE // ARENA SURVIVAL TERMINATED';

    finalScoreEl.textContent = Math.floor(score);
    finalTimeEl.textContent = `${elapsedTime.toFixed(1)}s`;
    finalWaveEl.textContent = wave;
    finalGrazesEl.textContent = grazesCount;
    statsBox.classList.remove('hidden');

    startBtn.textContent = 'RE-INITIALIZE ARENA';
    overlay.classList.remove('hidden');
  }

  // Keyboard Control Listeners
  window.addEventListener('keydown', (e) => {
    if (e.key in keys) keys[e.key] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      triggerDash();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.key in keys) keys[e.key] = false;
  });

  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    triggerDash();
  });

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    initGame();
  });

  // Mobile Touch Control Implementation (Fixed clampDist variable binding)
  const touchPad = document.getElementById('touchPad');
  const touchKnob = document.getElementById('touchKnob');
  const btnDash = document.getElementById('btnDash');
  let touchVector = { x: 0, y: 0 };

  touchPad.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = touchPad.getBoundingClientRect();
    const touch = e.touches[0];
    const dx = touch.clientX - (rect.left + rect.width / 2);
    const dy = touch.clientY - (rect.top + rect.height / 2);
    const dist = Math.hypot(dx, dy);
    const maxRadius = rect.width / 2 - 15;

    if (dist === 0) {
      touchVector = { x: 0, y: 0 };
      touchKnob.style.transform = `translate(0px, 0px)`;
    } else {
      const clampDist = Math.min(dist, maxRadius);
      touchVector = { x: dx / dist, y: dy / dist };
      touchKnob.style.transform = `translate(${(dx / dist) * clampDist}px, ${(dy / dist) * clampDist}px)`;
    }
  });

  touchPad.addEventListener('touchend', () => {
    touchVector = { x: 0, y: 0 };
    touchKnob.style.transform = `translate(0px, 0px)`;
  });

  btnDash.addEventListener('touchstart', (e) => {
    e.preventDefault();
    triggerDash();
  });
});