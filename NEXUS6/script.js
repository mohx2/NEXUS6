/**
 * NEXUS6 — Core Hub Controller
 * Lightweight UI micro-interactions & Web Audio interface feedback.
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[NEXUS6] Engine initialized.');

  // --- 1. WEB AUDIO FEEDBACK (Zero External Files) ---
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
  }

  // Soft, futuristic click/hover tick
  function playTick(freq = 800, duration = 0.015, type = 'sine') {
    if (!audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      
      gain.gain.setValueAtTime(0.02, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {
      // Audio fallback silent fail
    }
  }

  // --- 2. CARD INTERACTION & 3D MAGNETIC EFFECT ---
  const cards = document.querySelectorAll('.card');

  cards.forEach((card) => {
    // Play tick sound on first interaction init
    card.addEventListener('mouseenter', () => {
      initAudio();
      playTick(1200, 0.02, 'sine');
      card.style.willChange = 'transform, border-color';
    });

    // Subtle 3D tilt tracking on desktop
    card.addEventListener('mousemove', (e) => {
      if (window.innerWidth < 768) return; // Skip on mobile/tablets for performance
      
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;

      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.willChange = 'auto';
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
    });

    card.addEventListener('click', () => {
      initAudio();
      playTick(400, 0.04, 'triangle');
    });
  });

  // --- 3. LIVE STATUS MONITOR ---
  const statusText = document.querySelector('.status-text');
  if (statusText) {
    const updateLatency = () => {
      const start = performance.now();
      fetch(window.location.href, { method: 'HEAD', cache: 'no-store' })
        .then(() => {
          const latency = Math.round(performance.now() - start);
          statusText.textContent = `SYS.READY // ${latency}MS`;
        })
        .catch(() => {
          statusText.textContent = 'SYS.ONLINE';
        });
    };

    updateLatency();
    setInterval(updateLatency, 15000); // Check every 15s
  }
});