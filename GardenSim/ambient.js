(function(){
  const canvas = document.getElementById('ambientCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
  let width = 0, height = 0;
  let particles = [];
  let mouse = { x: null, y: null, active: false };
  let lastTime = performance.now();
  const isMobile = /Mobi|Android/i.test(navigator.userAgent) || window.innerWidth <= 768;
  const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLORS = [
    'rgba(255, 182, 193, 0.25)', // light pink
    'rgba(255, 160, 190, 0.22)',
    'rgba(255, 148, 196, 0.22)', // accent
    'rgba(255, 200, 229, 0.2)'
  ];

  // Increase particle count while reducing size for a denser field
  const BASE_TARGET_COUNT = prefersReducedMotion ? 0 : (isMobile ? 60 : 120);
  let targetCount = BASE_TARGET_COUNT;
  const BASE_SPEED = isMobile ? 0.03 : 0.05; // px per ms baseline
  const DRIFT_NOISE = 0.00015; // tiny random drift
  const MAX_SPEED = isMobile ? 0.12 : 0.18; // px per ms cap
  // Smaller particles overall
  const RADIUS_RANGE = isMobile ? [6, 16] : [8, 20];
  const REPEL_RADIUS = isMobile ? 110 : 160; // px
  const REPEL_STRENGTH = isMobile ? 30 : 50; // tuning constant

  function resize(){
    dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
    width = Math.floor(window.innerWidth);
    height = Math.floor(window.innerHeight);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max){ return min + Math.random() * (max - min); }
  function pick(arr){ return arr[(Math.random()*arr.length)|0]; }

  function makeParticle(){
    const r = rand(RADIUS_RANGE[0], RADIUS_RANGE[1]);
    return {
      x: rand(0, width),
      y: rand(0, height),
      vx: (Math.random()-0.5) * BASE_SPEED * 60, // initial small drift in px/frame-ish
      vy: (Math.random()-0.5) * BASE_SPEED * 60,
      r,
      color: pick(COLORS),
  // Slightly lower blur so many particles don't over-glow
  blur: rand(3, 10),
    };
  }

  function ensureCount(){
    if (particles.length < targetCount){
      for (let i=particles.length; i<targetCount; i++) particles.push(makeParticle());
    } else if (particles.length > targetCount) {
      particles.length = targetCount;
    }
  }

  // Lightweight adaptive throttle: sample FPS and scale density when under load
  let framesSinceCheck = 0;
  let lastFpsCheck = performance.now();
  let renderSkipEvery = 0; // 0 = render every frame, 1 = skip every other, etc.
  let skipCounter = 0;

  function applyRepel(p, dt){
    if (!mouse.active || mouse.x == null || mouse.y == null) return;
    const dx = p.x - mouse.x;
    const dy = p.y - mouse.y;
    const dist2 = dx*dx + dy*dy;
    const rr = REPEL_RADIUS * REPEL_RADIUS;
    if (dist2 > rr || dist2 === 0) return;
    const dist = Math.sqrt(dist2);
    const nx = dx / (dist || 1);
    const ny = dy / (dist || 1);
    // force falls off with distance squared, scaled by dt
    const force = (REPEL_STRENGTH * (1 - (dist2/rr))) * (dt/16);
    p.vx += nx * force * 0.02; // small accelerations
    p.vy += ny * force * 0.02;
  }

  function step(now){
    // Optionally skip this frame under load
    if (renderSkipEvery > 0) {
      if (skipCounter++ % (renderSkipEvery + 1) !== 0) {
        requestAnimationFrame(step);
        return;
      }
    }

    const dt = Math.min(40, now - lastTime); // clamp big frame gaps
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    ctx.globalCompositeOperation = 'lighter';

    for (let i=0; i<particles.length; i++){
      const p = particles[i];

      // Random tiny drift
      p.vx += (Math.random()-0.5) * DRIFT_NOISE * dt;
      p.vy += (Math.random()-0.5) * DRIFT_NOISE * dt;

      // Gentle base drift bias so they keep moving
      const bias = BASE_SPEED * 0.06 * dt;
      p.vx += (p.vx > 0 ? 1 : -1) * bias * 0.002;
      p.vy += (p.vy > 0 ? 1 : -1) * bias * 0.002;

      // Repel from pointer
      applyRepel(p, dt);

      // Clamp speed
      const speed = Math.hypot(p.vx, p.vy);
      const max = MAX_SPEED * dt;
      if (speed > max){
        const s = max / (speed || 1);
        p.vx *= s; p.vy *= s;
      }

      // Integrate
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges softly
      if (p.x < -p.r) p.x = width + p.r;
      if (p.x > width + p.r) p.x = -p.r;
      if (p.y < -p.r) p.y = height + p.r;
      if (p.y > height + p.r) p.y = -p.r;

      // Draw soft, glowing circle
      ctx.save();
      ctx.shadowColor = p.color.replace('0.', '0.8').replace('0)', '0.8)');
      ctx.shadowBlur = p.blur;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }

    // FPS sampling and adaptation every ~700ms
    framesSinceCheck++;
    const since = now - lastFpsCheck;
    if (since >= 700) {
      const fps = (framesSinceCheck * 1000) / since;
      // If consistently under 45 FPS, gently reduce effects
      if (fps < 45) {
        // Reduce particles by ~10% each check, but not below 50% of base
        const minCount = Math.floor(BASE_TARGET_COUNT * 0.5);
        targetCount = Math.max(minCount, Math.floor(targetCount * 0.9));
        // Introduce light frame skipping at very low FPS
        renderSkipEvery = fps < 35 ? 1 : renderSkipEvery; // skip every other frame
      } else if (fps > 58 && targetCount < BASE_TARGET_COUNT) {
        // Recover density slowly when performance is good
        targetCount = Math.min(BASE_TARGET_COUNT, targetCount + Math.max(1, Math.floor(BASE_TARGET_COUNT * 0.05)));
        if (fps > 58) renderSkipEvery = 0; // resume full rendering
      }
      ensureCount();
      framesSinceCheck = 0;
      lastFpsCheck = now;
    }

    requestAnimationFrame(step);
  }

  function onMove(e){
    const t = (e.touches && e.touches[0]) || e;
    if (!t) return;
    mouse.x = t.clientX;
    mouse.y = t.clientY;
    mouse.active = true;
  }
  function onLeave(){ mouse.active = false; }

  function init(){
    resize();
    ensureCount();
    lastTime = performance.now();
    requestAnimationFrame(step);
  }

  // Pause on hidden tab for battery/perf
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Pause effects aggressively while hidden
      targetCount = 0;
      renderSkipEvery = 1;
      ensureCount();
    } else {
      // Restore baseline on return
      targetCount = BASE_TARGET_COUNT;
      renderSkipEvery = 0;
      ensureCount();
      lastTime = performance.now();
    }
  });

  window.addEventListener('resize', () => { resize(); ensureCount(); });
  window.addEventListener('mousemove', onMove, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: true });
  window.addEventListener('mouseleave', onLeave, { passive: true });
  window.addEventListener('touchend', onLeave, { passive: true });

  // Defer start slightly to not compete with main layout
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
