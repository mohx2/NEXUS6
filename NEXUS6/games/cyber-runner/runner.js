/**
 * CYBER RUNNER // NEXUS6 Module 05 Overhaul
 * Endless Runner Engine with Double-Jump, Sliding, Parallax, Power-ups, and Dynamic Difficulty.
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const highScoreEl = document.getElementById('high-score');
  const speedMultEl = document.getElementById('speedMult');
  const orbCountEl = document.getElementById('orbCount');
  const comboCountEl = document.getElementById('comboCount');
  const powerupHud = document.getElementById('powerupHud');

  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlaySub = document.getElementById('overlaySub');
  const statsBox = document.getElementById('statsBox');
  const finalDistEl = document.getElementById('finalDist');
  const finalOrbsEl = document.getElementById('finalOrbs');
  const finalComboEl = document.getElementById('finalCombo');
  const startBtn = document.getElementById('startBtn');

  const diffSlider = document.getElementById('diffSlider');
  const diffValue = document.getElementById('diffValue');

  // Threat Levels Configuration
  const threatLevels = {
    '1': { baseSpeed: 4.0, accel: 0.0003, label: 'EASY (RELAXED)' },
    '2': { baseSpeed: 5.0, accel: 0.0005, label: 'MODERATE (STABLE)' },
    '3': { baseSpeed: 6.0, accel: 0.0007, label: 'NORMAL (BALANCED)' },
    '4': { baseSpeed: 7.2, accel: 0.0009, label: 'HARD (FAST)' },
    '5': { baseSpeed: 8.5, accel: 0.0012, label: 'EXPERT (OVERLOAD)' }
  };

  let currentDiff = threatLevels[diffSlider.value];

  // Engine Variables
  let distance = 0;
  let highScore = localStorage.getItem('nexus6_runner_hs') || 0;
  let orbCount = 0;
  let combo = 1;
  let maxCombo = 1;
  let gameSpeed = 6;
  let isRunning = false;
  let animFrame = null;
  let screenShake = 0;

  highScoreEl.textContent = `${String(highScore).padStart(4, '0')}m`;

  // Audio Context & Sound Synth
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
      gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  // Entities & World
  const groundY = canvas.height - 70;

  const player = {
    x: 50,
    y: groundY - 40,
    width: 24,
    height: 40,
    vy: 0,
    gravity: 0.65,
    jumpForce: -11.5,
    jumpsLeft: 2,
    maxJumps: 2,
    isSliding: false,
    slideTimer: 0,
    trail: []
  };

  // Active Powerup Timers
  const powerups = {
    shield: 0,
    magnet: 0
  };

  let obstacles = [];
  let pickups = [];
  let particles = [];
  let floatingTexts = [];
  let skylineBuildings = [];

  let bgGridOffset = 0;
  let spawnTimer = 0;

  // Initialize City Skyline Background
  function initBuildings() {
    skylineBuildings = [];
    for (let x = 0; x < canvas.width + 100; x += 30 + Math.random() * 30) {
      skylineBuildings.push({
        x: x,
        width: 25 + Math.random() * 25,
        height: 60 + Math.random() * 120,
        color: `hsl(${220 + Math.random() * 30}, 30%, ${8 + Math.random() * 8}%)`
      });
    }
  }

  diffSlider.addEventListener('input', (e) => {
    currentDiff = threatLevels[e.target.value];
    diffValue.textContent = currentDiff.label;
  });

  // Actions
  function jump() {
    if (player.jumpsLeft > 0 && !player.isSliding) {
      player.vy = player.jumpForce;
      player.jumpsLeft--;
      
      const pitch = player.jumpsLeft === 1 ? 400 : 620;
      playSound(pitch, 0.06, 'square');
      createParticles(player.x + player.width / 2, player.y + player.height, '#3b82f6', 6);
    }
  }

  function slide() {
    if (!player.isSliding && player.jumpsLeft === player.maxJumps) {
      player.isSliding = true;
      player.slideTimer = 26;
      player.height = 20;
      player.y = groundY - 20;
      playSound(250, 0.05, 'sawtooth', 120);
      createParticles(player.x + player.width / 2, player.y + player.height, '#06b6d4', 5);
    }
  }

  function initGame() {
    if (!audioCtx) audioCtx = new AudioCtx();

    distance = 0;
    orbCount = 0;
    combo = 1;
    maxCombo = 1;
    gameSpeed = currentDiff.baseSpeed;

    scoreEl.textContent = '0000m';
    orbCountEl.textContent = orbCount;
    comboCountEl.textContent = `x${combo}`;
    speedMultEl.textContent = `${(gameSpeed / currentDiff.baseSpeed).toFixed(1)}x`;

    player.y = groundY - 40;
    player.height = 40;
    player.vy = 0;
    player.jumpsLeft = player.maxJumps;
    player.isSliding = false;
    player.trail = [];

    powerups.shield = 0;
    powerups.magnet = 0;
    updatePowerupHud();

    obstacles = [];
    pickups = [];
    particles = [];
    floatingTexts = [];
    spawnTimer = 0;

    initBuildings();

    isRunning = true;
    overlay.classList.add('hidden');

    if (animFrame) cancelAnimationFrame(animFrame);
    loop();
  }

  function createParticles(x, y, color = '#3b82f6', count = 8) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        life: 1,
        color: color,
        size: 2 + Math.random() * 2
      });
    }
  }

  function addFloatingText(x, y, text, color = '#f1f5f9') {
    floatingTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
  }

  function updatePowerupHud() {
    powerupHud.innerHTML = '';
    if (powerups.shield > 0) {
      powerupHud.innerHTML += `<div class="powerup-badge badge-shield">SHIELD READY</div>`;
    }
    if (powerups.magnet > 0) {
      powerupHud.innerHTML += `<div class="powerup-badge badge-magnet">MAGNET (${Math.ceil(powerups.magnet / 60)}s)</div>`;
    }
  }

  // Dynamic Obstacle & Pickup Spawner
  function spawnEntities() {
    spawnTimer--;
    if (spawnTimer <= 0) {
      // Dynamic timer gap scales down as speed increases
      const minGap = Math.max(28, 65 - gameSpeed * 3.5);
      spawnTimer = Math.floor(Math.random() * 35) + minGap;

      const rand = Math.random();

      if (rand < 0.35) {
        // Low barrier -> Jump
        obstacles.push({
          x: canvas.width + 20,
          y: groundY - 28,
          width: 22,
          height: 28,
          type: 'low',
          color: '#f59e0b'
        });
      } else if (rand < 0.65) {
        // Laser Turret -> Slide
        obstacles.push({
          x: canvas.width + 20,
          y: groundY - 62,
          width: 28,
          height: 40,
          type: 'high',
          color: '#ef4444'
        });
      } else if (rand < 0.85) {
        // Drone Mine -> Jump or Duck
        obstacles.push({
          x: canvas.width + 20,
          y: groundY - 48,
          width: 20,
          height: 20,
          type: 'drone',
          color: '#ec4899',
          offsetY: 0
        });
      } else {
        // Tall Cyber Column -> High Double Jump
        obstacles.push({
          x: canvas.width + 20,
          y: groundY - 54,
          width: 18,
          height: 54,
          type: 'tall',
          color: '#8b5cf6'
        });
      }

      // Spawn Data Orbs / Powerups
      if (Math.random() > 0.3) {
        const orbY = Math.random() > 0.5 ? groundY - 70 : groundY - 25;
        const count = 1 + Math.floor(Math.random() * 3);

        for (let i = 0; i < count; i++) {
          pickups.push({
            x: canvas.width + 70 + (i * 22),
            y: orbY,
            radius: 6,
            type: 'orb'
          });
        }
      }

      // Rare Powerup Spawn
      if (Math.random() < 0.12) {
        const pType = Math.random() > 0.5 ? 'shield' : 'magnet';
        pickups.push({
          x: canvas.width + 120,
          y: groundY - 55,
          radius: 8,
          type: pType
        });
      }
    }
  }

  function update() {
    // Speed Ramp & Distance
    gameSpeed += currentDiff.accel;
    const distGain = Math.floor(gameSpeed * 0.18 * (powerups.magnet > 0 ? 1.5 : 1.0));
    distance += distGain;

    scoreEl.textContent = `${String(distance).padStart(4, '0')}m`;
    speedMultEl.textContent = `${(gameSpeed / currentDiff.baseSpeed).toFixed(1)}x`;

    if (distance > highScore) {
      highScore = distance;
      localStorage.setItem('nexus6_runner_hs', highScore);
      highScoreEl.textContent = `${String(highScore).padStart(4, '0')}m`;
    }

    // Powerup Timers
    if (powerups.magnet > 0) {
      powerups.magnet--;
      if (powerups.magnet === 0) updatePowerupHud();
    }

    // Player Gravity & Physics
    player.vy += player.gravity;
    player.y += player.vy;

    // Ground Collision
    if (player.y >= groundY - player.height) {
      player.y = groundY - player.height;
      player.vy = 0;
      player.jumpsLeft = player.maxJumps;
    }

    // Slide Duration
    if (player.isSliding) {
      player.slideTimer--;
      if (player.slideTimer <= 0) {
        player.isSliding = false;
        player.height = 40;
        player.y = groundY - 40;
      }
    }

    // Player Movement Trail Effect
    player.trail.push({ x: player.x, y: player.y, w: player.width, h: player.height, alpha: 0.5 });
    if (player.trail.length > 5) player.trail.shift();
    player.trail.forEach(t => t.alpha -= 0.08);

    // Parallax Skyline Buildings
    skylineBuildings.forEach(b => {
      b.x -= gameSpeed * 0.2;
      if (b.x + b.width < 0) {
        b.x = canvas.width + Math.random() * 20;
        b.width = 25 + Math.random() * 25;
        b.height = 60 + Math.random() * 120;
      }
    });

    // Grid Floor Offset
    bgGridOffset = (bgGridOffset + gameSpeed) % 20;

    spawnEntities();

    // Update Obstacles
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obs = obstacles[i];
      obs.x -= gameSpeed;

      if (obs.type === 'drone') {
        obs.offsetY = Math.sin(Date.now() * 0.008) * 6;
      }

      const obsY = obs.y + (obs.offsetY || 0);

      // Collision Detection
      if (
        player.x < obs.x + obs.width &&
        player.x + player.width > obs.x &&
        player.y < obsY + obs.height &&
        player.y + player.height > obsY
      ) {
        if (powerups.shield > 0) {
          // Shield Absorbs Hit
          powerups.shield = 0;
          updatePowerupHud();
          screenShake = 8;
          playSound(200, 0.15, 'triangle');
          createParticles(obs.x, obsY, '#06b6d4', 15);
          addFloatingText(player.x, player.y - 15, 'SHIELD BROKEN!', '#06b6d4');
          obstacles.splice(i, 1);
          continue;
        }

        // Game Over Crash
        screenShake = 16;
        playSound(100, 0.3, 'sawtooth');
        createParticles(player.x, player.y, '#ef4444', 25);
        gameOver();
        return;
      }

      if (obs.x + obs.width < 0) {
        obstacles.splice(i, 1);
      }
    }

    // Update Pickups (Orbs & Powerups)
    for (let p = pickups.length - 1; p >= 0; p--) {
      const item = pickups[p];
      item.x -= gameSpeed;

      // Magnet Attract Mechanics
      if (powerups.magnet > 0 && item.type === 'orb') {
        const dx = (player.x + player.width / 2) - item.x;
        const dy = (player.y + player.height / 2) - item.y;
        item.x += dx * 0.12;
        item.y += dy * 0.12;
      }

      // Collect Check
      const dx = (player.x + player.width / 2) - item.x;
      const dy = (player.y + player.height / 2) - item.y;
      const dist = Math.hypot(dx, dy);

      if (dist < player.width + item.radius) {
        if (item.type === 'orb') {
          orbCount++;
          combo++;
          if (combo > maxCombo) maxCombo = combo;

          orbCountEl.textContent = orbCount;
          comboCountEl.textContent = `x${combo}`;

          playSound(700 + Math.min(combo * 20, 400), 0.04, 'triangle');
          createParticles(item.x, item.y, '#a855f7', 6);
        } else if (item.type === 'shield') {
          powerups.shield = 1;
          updatePowerupHud();
          playSound(900, 0.1, 'sine');
          addFloatingText(player.x, player.y - 15, '+SHIELD', '#06b6d4');
          createParticles(item.x, item.y, '#06b6d4', 12);
        } else if (item.type === 'magnet') {
          powerups.magnet = 360; // 6 seconds at 60fps
          updatePowerupHud();
          playSound(850, 0.1, 'sine');
          addFloatingText(player.x, player.y - 15, '+MAGNET', '#eab308');
          createParticles(item.x, item.y, '#eab308', 12);
        }

        pickups.splice(p, 1);
        continue;
      }

      if (item.x + item.radius < 0) {
        if (item.type === 'orb') {
          combo = 1;
          comboCountEl.textContent = `x${combo}`;
        }
        pickups.splice(p, 1);
      }
    }

    // Particle FX
    for (let pt = particles.length - 1; pt >= 0; pt--) {
      const p = particles[pt];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= 0.04;
      if (p.life <= 0) particles.splice(pt, 1);
    }

    // Floating HUD Texts
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
    ctx.fillStyle = '#030305';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax Skyline
    skylineBuildings.forEach(b => {
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, groundY - b.height, b.width, b.height);
    });

    // Scrolling Grid Ground
    ctx.strokeStyle = '#12131a';
    ctx.lineWidth = 1;
    for (let x = -bgGridOffset; x < canvas.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, groundY);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    ctx.strokeStyle = '#222533';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(canvas.width, groundY);
    ctx.stroke();

    // Draw Player Trail
    player.trail.forEach(t => {
      ctx.fillStyle = `rgba(59, 130, 246, ${t.alpha * 0.4})`;
      ctx.fillRect(t.x, t.y, t.w, t.h);
    });

    // Draw Player
    ctx.fillStyle = powerups.shield > 0 ? '#06b6d4' : '#3b82f6';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 10;
    ctx.fillRect(player.x, player.y, player.width, player.height);
    ctx.shadowBlur = 0;

    // Draw Shield Aura
    if (powerups.shield > 0) {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x + player.width / 2, player.y + player.height / 2, 24, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw Obstacles
    obstacles.forEach(obs => {
      const obsY = obs.y + (obs.offsetY || 0);
      ctx.fillStyle = obs.color;
      ctx.shadowColor = obs.color;
      ctx.shadowBlur = 8;
      ctx.fillRect(obs.x, obsY, obs.width, obs.height);
      ctx.shadowBlur = 0;
    });

    // Draw Pickups
    pickups.forEach(item => {
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.radius, 0, Math.PI * 2);

      if (item.type === 'orb') {
        ctx.fillStyle = '#a855f7';
        ctx.shadowColor = '#a855f7';
      } else if (item.type === 'shield') {
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
      } else if (item.type === 'magnet') {
        ctx.fillStyle = '#eab308';
        ctx.shadowColor = '#eab308';
      }

      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Particle FX
    particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life;
      ctx.fillRect(p.x, p.y, p.size, p.size);
      ctx.globalAlpha = 1;
    });

    // Draw Floating Texts
    floatingTexts.forEach(t => {
      ctx.fillStyle = t.color;
      ctx.font = '700 11px "JetBrains Mono"';
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
    overlayTitle.textContent = 'RUN TERMINATED';
    overlaySub.textContent = 'SYSTEM OVERLOAD // HAZARD COLLISION DETECTED';

    finalDistEl.textContent = `${distance}m`;
    finalOrbsEl.textContent = orbCount;
    finalComboEl.textContent = `x${maxCombo}`;
    statsBox.classList.remove('hidden');

    startBtn.textContent = 'RE-INITIALIZE RUN';
    overlay.classList.remove('hidden');
  }

  // Key Bindings
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'KeyW', 'Space'].includes(e.code)) {
      e.preventDefault();
      jump();
    } else if (['ArrowDown', 'KeyS'].includes(e.code)) {
      e.preventDefault();
      slide();
    }
  });

  startBtn.addEventListener('click', (e) => {
    e.preventDefault();
    startBtn.blur();
    initGame();
  });

  // Touch Controls
  const btnJump = document.getElementById('btnJump');
  const btnSlide = document.getElementById('btnSlide');

  btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); });
  btnSlide.addEventListener('touchstart', (e) => { e.preventDefault(); slide(); });
});