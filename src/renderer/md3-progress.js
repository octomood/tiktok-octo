'use strict';

/**
 * Настоящие волновые и круговые индикаторы прогресса Material Design 3 Expressive.
 *
 * Рисуют плавную синусоидальную волну с округлыми концами, зазором до неактивного
 * трека и конечной точкой-ограничителем на HiDPI <canvas> без растяжения
 * статичной SVG-маски. При скрытии элемента или prefers-reduced-motion: reduce
 * цикл анимации автоматически останавливается.
 */
(() => {
  const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;

  const clamp01 = (value) => Math.min(1, Math.max(0, Number(value) || 0));

  const smoothstep = (edge0, edge1, x) => {
    const t = clamp01((x - edge0) / (edge1 - edge0 || 1));
    return t * t * (3 - 2 * t);
  };

  const easeOutQuad = (t) => 1 - (1 - clamp01(t)) ** 2;
  const easeInOutCubic = (t) => {
    const x = clamp01(t);
    return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
  };

  function readThemeColors(host) {
    const rootStyle = getComputedStyle(document.documentElement);
    const hostStyle = getComputedStyle(host);
    const active =
      rootStyle.getPropertyValue('--md-primary').trim() || hostStyle.color || '#8c84a9';
    const track =
      rootStyle.getPropertyValue('--md-surface-container-highest').trim() ||
      rootStyle.getPropertyValue('--md-secondary-container').trim() ||
      '#4c4566';
    return { active, track };
  }

  function isElementVisible(host) {
    if (!host || !host.isConnected || host.hidden) return false;
    if (host.closest('[hidden]')) return false;
    const style = getComputedStyle(host);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    return host.getClientRects().length > 0;
  }

  function syncCanvasSize(canvas, host) {
    const rect = host.getBoundingClientRect();
    const width = Math.max(0, Math.round(rect.width));
    const height = Math.max(0, Math.round(rect.height));
    if (!width || !height) return null;
    const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
    const targetW = Math.round(width * dpr);
    const targetH = Math.round(height * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    return { ctx, width, height };
  }

  function strokeSineWave(ctx, x1, x2, midY, amp, wavelength, phase) {
    if (x2 <= x1 + 0.25) return;
    ctx.beginPath();
    if (amp <= 0.08) {
      ctx.moveTo(x1, midY);
      ctx.lineTo(x2, midY);
      ctx.stroke();
      return;
    }
    const step = 1.5;
    const twoPiOverLambda = (Math.PI * 2) / wavelength;
    const yAt = (x) => midY + amp * Math.sin((x - phase) * twoPiOverLambda);
    ctx.moveTo(x1, yAt(x1));
    for (let x = x1 + step; x < x2; x += step) {
      ctx.lineTo(x, yAt(x));
    }
    ctx.lineTo(x2, yAt(x2));
    ctx.stroke();
  }

  function strokeStraight(ctx, x1, x2, midY) {
    if (x2 <= x1 + 0.25) return;
    ctx.beginPath();
    ctx.moveTo(x1, midY);
    ctx.lineTo(x2, midY);
    ctx.stroke();
  }

  function drawStopDot(ctx, x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  function indeterminateSegments(cycleT) {
    const segs = [];
    // Два плавных MD3 Expressive отрезка в одном цикле.
    if (cycleT < 0.72) {
      const head = easeOutQuad(cycleT / 0.44);
      const tail = easeInOutCubic((cycleT - 0.16) / 0.54);
      if (head > tail + 0.01) segs.push([tail, head]);
    }
    if (cycleT > 0.42) {
      const head = easeOutQuad((cycleT - 0.42) / 0.42);
      const tail = easeInOutCubic((cycleT - 0.62) / 0.38);
      if (head > tail + 0.01) segs.push([tail, head]);
    }
    return segs;
  }

  function attachLinear(host, initial = {}) {
    if (!host) return null;
    if (host.__octoProgress) {
      host.__octoProgress.set(initial);
      return host.__octoProgress;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'md3-progress-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);

    const state = {
      mode: initial.mode === 'indeterminate' ? 'indeterminate' : 'determinate',
      value: clamp01(initial.value),
      displayedValue: clamp01(initial.value),
      active: initial.active !== false,
      showTrack: initial.showTrack !== false,
      showDot: initial.showDot !== false,
      strokeWidth: Number(initial.strokeWidth) || 3.4,
      amplitude: Number(initial.amplitude) || 2.1,
      wavelength: Number(initial.wavelength) || 24,
      speed: Number(initial.speed) || 34,
      displayedAmp: 0,
      phase: 0,
      cycleStart: window.performance.now(),
      lastTime: window.performance.now(),
      rafId: 0,
      destroyed: false,
    };

    const draw = (now) => {
      state.rafId = 0;
      if (state.destroyed) return;

      const dt = Math.min(0.05, Math.max(0, (now - state.lastTime) / 1000));
      state.lastTime = now;

      const visible = isElementVisible(host);
      if (!visible) return;

      const frame = syncCanvasSize(canvas, host);
      if (!frame) return;

      const { ctx, width, height } = frame;
      const { active: activeColor, track: trackColor } = readThemeColors(host);
      const reduced = Boolean(reducedMotionQuery && reducedMotionQuery.matches);

      const strokeW = Math.min(state.strokeWidth, Math.max(2, height * 0.45));
      const maxAmp = Math.min(state.amplitude, Math.max(0, (height - strokeW - 1.5) / 2));
      const pad = strokeW / 2 + 1.5;
      const usable = Math.max(0, width - pad * 2);
      const midY = height / 2;
      const gap = strokeW + 3.5;

      // Плавное сглаживание прогресса и амплитуды волны.
      if (reduced) {
        state.displayedValue = state.value;
      } else {
        const alpha = 1 - Math.exp(-dt * 14);
        state.displayedValue += (state.value - state.displayedValue) * alpha;
      }

      const targetAmp =
        !state.active || reduced
          ? 0
          : state.mode === 'indeterminate'
            ? maxAmp
            : maxAmp *
              smoothstep(0.005, 0.045, state.displayedValue) *
              smoothstep(0.995, 0.955, state.displayedValue);

      if (reduced) {
        state.displayedAmp = targetAmp;
      } else {
        const ampAlpha = 1 - Math.exp(-dt * 12);
        state.displayedAmp += (targetAmp - state.displayedAmp) * ampAlpha;
        if (state.active) {
          state.phase = (state.phase + dt * state.speed) % state.wavelength;
        }
      }

      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (state.mode === 'indeterminate') {
        const cycleDuration = 1850;
        const cycleT = reduced ? 0.35 : ((now - state.cycleStart) % cycleDuration) / cycleDuration;
        const rawSegs = indeterminateSegments(cycleT);
        const segs = rawSegs
          .map(([a, b]) => [pad + usable * clamp01(a), pad + usable * clamp01(b)])
          .filter(([x1, x2]) => x2 - x1 > 1.5)
          .sort((a, b) => a[0] - b[0]);

        // Рисуем неактивные участки дорожки в промежутках с зазорами.
        if (state.showTrack) {
          ctx.strokeStyle = trackColor;
          let cursor = pad;
          for (const [x1, x2] of segs) {
            const trackEnd = x1 - gap;
            if (trackEnd > cursor + 0.5) strokeStraight(ctx, cursor, trackEnd, midY);
            cursor = Math.max(cursor, x2 + gap);
          }
          if (width - pad > cursor + 0.5) {
            strokeStraight(ctx, cursor, width - pad, midY);
          }
          if (state.showDot && (!segs.length || segs[segs.length - 1][1] < width - pad - strokeW)) {
            drawStopDot(ctx, width - pad, midY, Math.max(1.4, strokeW * 0.38), activeColor);
          }
        }

        // Активные волновые отрезки.
        ctx.strokeStyle = activeColor;
        for (const [x1, x2] of segs) {
          strokeSineWave(ctx, x1, x2, midY, state.displayedAmp, state.wavelength, state.phase);
        }
      } else {
        const v = clamp01(state.displayedValue);
        const activeEnd = pad + usable * v;

        if (state.showTrack) {
          const trackStart = v > 0.005 ? activeEnd + gap : pad;
          if (width - pad > trackStart + 0.5) {
            ctx.strokeStyle = trackColor;
            strokeStraight(ctx, trackStart, width - pad, midY);
          }
          if (state.showDot && v < 0.985) {
            drawStopDot(ctx, width - pad, midY, Math.max(1.4, strokeW * 0.38), activeColor);
          }
        }

        if (v > 0.005) {
          ctx.strokeStyle = activeColor;
          strokeSineWave(
            ctx,
            pad,
            Math.max(pad + 0.5, activeEnd),
            midY,
            state.displayedAmp,
            state.wavelength,
            state.phase,
          );
        }
      }

      const needsMoreFrames =
        !reduced &&
        (state.active ||
          Math.abs(state.displayedValue - state.value) > 0.002 ||
          Math.abs(state.displayedAmp - targetAmp) > 0.05);

      if (needsMoreFrames) {
        state.rafId = window.requestAnimationFrame(draw);
      }
    };

    const schedule = () => {
      if (state.destroyed || state.rafId) return;
      state.lastTime = window.performance.now();
      state.rafId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => schedule());
    observer.observe(host);

    const onMediaChange = () => schedule();
    reducedMotionQuery?.addEventListener?.('change', onMediaChange);

    const api = {
      set(patch = {}) {
        if (state.destroyed) return;
        if (patch.mode === 'indeterminate' || patch.mode === 'determinate') {
          if (patch.mode !== state.mode && patch.mode === 'indeterminate') {
            state.cycleStart = window.performance.now();
          }
          state.mode = patch.mode;
        }
        if (patch.value !== undefined) state.value = clamp01(patch.value);
        if (patch.active !== undefined) {
          if (patch.active && !state.active && state.mode === 'indeterminate') {
            state.cycleStart = window.performance.now();
          }
          state.active = Boolean(patch.active);
        }
        if (patch.showTrack !== undefined) state.showTrack = Boolean(patch.showTrack);
        if (patch.showDot !== undefined) state.showDot = Boolean(patch.showDot);
        schedule();
      },
      refresh: schedule,
      destroy() {
        state.destroyed = true;
        if (state.rafId) window.cancelAnimationFrame(state.rafId);
        observer.disconnect();
        reducedMotionQuery?.removeEventListener?.('change', onMediaChange);
        canvas.remove();
        delete host.__octoProgress;
      },
    };

    host.__octoProgress = api;
    schedule();
    return api;
  }

  function attachCircular(host, initial = {}) {
    if (!host) return null;
    if (host.__octoCircularProgress) {
      host.__octoCircularProgress.refresh();
      return host.__octoCircularProgress;
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'md3-progress-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);

    const state = {
      strokeWidth: Number(initial.strokeWidth) || 5,
      startTime: window.performance.now(),
      rafId: 0,
      destroyed: false,
    };

    const draw = (now) => {
      state.rafId = 0;
      if (state.destroyed) return;
      if (!isElementVisible(host)) return;

      const frame = syncCanvasSize(canvas, host);
      if (!frame) return;

      const { ctx, width, height } = frame;
      const { active: activeColor, track: trackColor } = readThemeColors(host);
      const reduced = Boolean(reducedMotionQuery && reducedMotionQuery.matches);

      const strokeW = Math.min(state.strokeWidth, Math.max(2, Math.min(width, height) * 0.1));
      const radius = Math.max(4, Math.min(width, height) / 2 - strokeW / 2 - 2);
      const cx = width / 2;
      const cy = height / 2;

      const elapsed = reduced ? 0 : (now - state.startTime) / 1000;
      const breathPhase = (elapsed * 0.68) % 1;
      const sweep = reduced
        ? Math.PI * 0.65
        : Math.PI * (0.34 + 1.12 * (0.5 - 0.5 * Math.cos(breathPhase * Math.PI * 2)));
      const baseRot = reduced
        ? -Math.PI / 2
        : -Math.PI / 2 + elapsed * 3.1 + Math.sin(breathPhase * Math.PI * 2) * 0.45;

      const gapAngle = Math.min(0.42, (strokeW * 2.15) / radius);

      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';

      // Неактивная дуга трека с разрывом на концах активной дуги.
      const trackStart = baseRot + sweep + gapAngle;
      const trackEnd = baseRot + Math.PI * 2 - gapAngle;
      if (trackEnd > trackStart + 0.05) {
        ctx.strokeStyle = trackColor;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, trackStart, trackEnd);
        ctx.stroke();
      }

      // Активная дуга с округлыми концами.
      ctx.strokeStyle = activeColor;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, baseRot, baseRot + sweep);
      ctx.stroke();

      if (!reduced) {
        state.rafId = window.requestAnimationFrame(draw);
      }
    };

    const schedule = () => {
      if (state.destroyed || state.rafId) return;
      state.rafId = window.requestAnimationFrame(draw);
    };

    const observer = new ResizeObserver(() => schedule());
    observer.observe(host);

    const onMediaChange = () => schedule();
    reducedMotionQuery?.addEventListener?.('change', onMediaChange);

    const api = {
      refresh: schedule,
      destroy() {
        state.destroyed = true;
        if (state.rafId) window.cancelAnimationFrame(state.rafId);
        observer.disconnect();
        reducedMotionQuery?.removeEventListener?.('change', onMediaChange);
        canvas.remove();
        delete host.__octoCircularProgress;
      },
    };

    host.__octoCircularProgress = api;
    schedule();
    return api;
  }

  window.octoProgress = { attachLinear, attachCircular };
})();
