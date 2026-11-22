// @ts-nocheck
// Drawing helpers for the holiday screensaver scenes (1.30.0): time-of-day
// light, sky, moon, sun, mountains, layered pines, twinkling bulbs, snow and
// the Santa silhouette. Plain canvas 2D. Shared by every holiday scene.
// (Untyped on purpose: it is a straight drawing port of the approved mockup.)

export const XM: any = (function () {
  var U = {};
  U.rng = function (seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  U.lerp = function (a, b, t) { return a + (b - a) * t; };
  U.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  U.smooth = function (e0, e1, x) { var t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  U.hex = function (h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  U.mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };
  U.css = function (c, a) { return 'rgba(' + Math.round(c[0]) + ',' + Math.round(c[1]) + ',' + Math.round(c[2]) + ',' + (a == null ? 1 : a) + ')'; };
  /* palette entry = [night, dusk, day] */
  U.pal = function (p, env) {
    var base = U.mix(U.hex(p[0]), U.hex(p[2]), env.d);
    return U.mix(base, U.hex(p[1]), env.g * 0.8);
  };
  U.SUNRISE = 6.85; U.SUNSET = 16.75;
  U.env = function (h) {
    var d = U.smooth(U.SUNRISE - 0.45, U.SUNRISE + 0.75, h) * (1 - U.smooth(U.SUNSET - 0.75, U.SUNSET + 0.45, h));
    var g = Math.exp(-Math.pow((h - U.SUNRISE - 0.1) / 0.6, 2)) + Math.exp(-Math.pow((h - U.SUNSET + 0.1) / 0.6, 2));
    return { h: h, d: d, g: U.clamp(g, 0, 1), n: 1 - d };
  };
  U.sunP = function (h) { return (h - U.SUNRISE) / (U.SUNSET - U.SUNRISE); };
  U.nightP = function (h) { return U.clamp(((h - U.SUNSET + 24) % 24) / (24 - (U.SUNSET - U.SUNRISE)), 0, 1); };
  U.ridge = function (rng, n, rough) {
    var p = new Array(n + 1); p[0] = rng(); p[n] = rng();
    var step = n, a = 1;
    while (step > 1) {
      var half = step / 2;
      for (var i = half; i < n; i += step) p[i] = (p[i - half] + p[i + half]) / 2 + (rng() - 0.5) * a;
      a *= rough; step = half;
    }
    var mn = Infinity, mx = -Infinity;
    for (var j = 0; j <= n; j++) { if (p[j] < mn) mn = p[j]; if (p[j] > mx) mx = p[j]; }
    for (var k = 0; k <= n; k++) p[k] = (p[k] - mn) / ((mx - mn) || 1);
    return p;
  };
  U.ridgeY = function (p, x, W) {
    var n = p.length - 1, f = U.clamp(x / W, 0, 1) * n, i = Math.floor(f);
    if (i >= n) return p[n];
    return p[i] + (p[i + 1] - p[i]) * (f - i);
  };
  U.glow = function (col, size) {
    var c = document.createElement('canvas'); c.width = c.height = size;
    var x = c.getContext('2d'), r = size / 2, rgb = U.hex(col);
    var g = x.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.12, U.css(U.mix(rgb, [255, 255, 255], 0.45), 0.95));
    g.addColorStop(0.32, U.css(rgb, 0.5));
    g.addColorStop(1, U.css(rgb, 0));
    x.fillStyle = g; x.fillRect(0, 0, size, size);
    return c;
  };
  U.sprites = function (cols) {
    var s = {}, core = {};
    cols.forEach(function (c) { s[c] = U.glow(c, 64); core[c] = U.css(U.mix(U.hex(c), [255, 255, 255], 0.3)); });
    return { glow: s, core: core };
  };
  U.drawStars = function (ctx, stars, a, t) {
    if (a <= 0.01) return;
    ctx.fillStyle = '#ffffff';
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.globalAlpha = a * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph));
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;
  };
  U.drawMoon = function (ctx, x, y, r, a) {
    if (a <= 0.01) return;
    ctx.save(); ctx.globalAlpha = a;
    var h = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 5);
    h.addColorStop(0, 'rgba(210,225,255,0.32)'); h.addColorStop(1, 'rgba(210,225,255,0)');
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, r * 5, 0, 6.2832); ctx.fill();
    var d = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r);
    d.addColorStop(0, '#fffdf3'); d.addColorStop(1, '#e6e1cf');
    ctx.fillStyle = d; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(160,160,150,0.22)';
    [[-0.3, -0.2, 0.22], [0.25, 0.15, 0.16], [0.05, 0.45, 0.12], [0.4, -0.35, 0.1], [-0.35, 0.35, 0.09]].forEach(function (c) {
      ctx.beginPath(); ctx.arc(x + c[0] * r, y + c[1] * r, c[2] * r, 0, 6.2832); ctx.fill();
    });
    ctx.restore();
  };
  U.drawSun = function (ctx, x, y, r, a, g) {
    if (a <= 0.01) return;
    var warm = U.mix([255, 246, 220], [255, 170, 100], g);
    ctx.save(); ctx.globalAlpha = a;
    var h = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 7);
    h.addColorStop(0, U.css(warm, 0.55)); h.addColorStop(1, U.css(warm, 0));
    ctx.fillStyle = h; ctx.beginPath(); ctx.arc(x, y, r * 7, 0, 6.2832); ctx.fill();
    ctx.fillStyle = U.css(U.mix(warm, [255, 255, 255], 0.5));
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
    ctx.restore();
  };
  U.mountain = function (ctx, pts, W, H, base, amp, rock, rockBot, snow, snowLine) {
    var n = pts.length - 1;
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var i = 0; i <= n; i++) ctx.lineTo(i / n * W, base - pts[i] * amp);
    ctx.lineTo(W, H); ctx.closePath();
    var g = ctx.createLinearGradient(0, base - amp, 0, base + amp * 0.15);
    g.addColorStop(0, U.css(snow)); g.addColorStop(snowLine, U.css(snow));
    g.addColorStop(Math.min(0.98, snowLine + 0.3), U.css(rock)); g.addColorStop(1, U.css(rockBot));
    ctx.fillStyle = g; ctx.fill();
  };
  /* layered pine: o = {tiers, w, jag, snow, ledge, trunkCol} */
  U.pine = function (ctx, x, y, h, col, snow, o) {
    o = o || {};
    var T = o.tiers || 4, w = (o.w || 0.34) * h, trunk = h * 0.06, H = h - trunk, b0 = y - trunk, top = y - h;
    ctx.fillStyle = o.trunkCol || col;
    ctx.fillRect(x - h * 0.022, b0 - 2, h * 0.044, trunk + 2);
    for (var i = 0; i < T; i++) {
      var f = T > 1 ? i / (T - 1) : 0;
      var by = b0 - H * 0.74 * (i / T);
      var ay = (i === T - 1) ? top : by - H * (0.42 - 0.06 * f);
      var ww = w * (1 - 0.66 * (i / T));
      var th = by - ay;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(x, ay);
      ctx.quadraticCurveTo(x - ww * 0.38, by - th * 0.36, x - ww, by);
      if (o.jag) {
        var k = o.jag * 2;
        for (var j = 1; j <= k; j++) ctx.lineTo(x - ww + 2 * ww * (j / k), (j % 2) ? by - th * 0.12 : by + th * 0.02);
      } else {
        ctx.quadraticCurveTo(x, by - th * 0.2, x + ww, by);
      }
      ctx.quadraticCurveTo(x + ww * 0.38, by - th * 0.36, x, ay);
      ctx.closePath(); ctx.fill();
      if (snow && o.snow) {
        var sd = o.snow, sy = ay + th * sd, sw = ww * sd * 0.6;
        ctx.fillStyle = snow;
        ctx.beginPath(); ctx.moveTo(x, ay);
        ctx.quadraticCurveTo(x - sw * 0.55, ay + th * sd * 0.5, x - sw, sy);
        ctx.quadraticCurveTo(x - sw * 0.55, sy - th * 0.08, x - sw * 0.15, sy + th * 0.02);
        ctx.quadraticCurveTo(x + sw * 0.3, sy - th * 0.1, x + sw * 0.75, sy - th * 0.02);
        ctx.quadraticCurveTo(x + sw * 0.45, ay + th * sd * 0.5, x, ay);
        ctx.closePath(); ctx.fill();
        if (o.ledge) {
          ctx.strokeStyle = snow; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.2, h * 0.009);
          ctx.beginPath(); ctx.moveTo(x - ww * 0.9, by - th * 0.04);
          ctx.quadraticCurveTo(x - ww * 0.45, by - th * 0.16, x - ww * 0.08, by - th * 0.1);
          ctx.stroke();
        }
      }
    }
  };
  U.spiralBulbs = function (rng, out, t, cols, opt) {
    opt = opt || {};
    var top = t.y - t.h, b0 = t.y - t.h * 0.06;
    var turns = opt.turns || (t.h > 300 ? 6 : t.h > 150 ? 4.5 : 3.2);
    var M = Math.round(t.h * (opt.density || 0.16)) + 10, ph = rng() * 6.28;
    for (var k = 0; k < M; k++) {
      var s = (k + 0.5) / M;
      var yy = top + t.h * 0.1 + s * (b0 - top - t.h * 0.12);
      var hw = t.h * (opt.w || 0.34) * (0.12 + 0.88 * ((yy - top) / (b0 - top))) * 0.8;
      var th = s * turns * 6.2832 + ph, dep = Math.cos(th);
      if (dep < -0.15) continue;
      out.push({
        x: t.x + hw * Math.sin(th), y: yy + (rng() - 0.5) * 2,
        c: cols[(k + (opt.offset || 0)) % cols.length], ph: rng() * 6.28, sp: 1 + rng() * 2.4,
        sz: Math.max(1.1, t.h * (opt.sz || 0.0066)) * (0.75 + 0.25 * dep),
        vis: 0.55 + 0.45 * Math.max(0, dep)
      });
    }
  };
  U.drawBulbs = function (ctx, list, spr, env, dayGlow, level, glow) {
    var t = env.t, i, b, lv = level || 4, gm = glow == null ? 1 : glow;
    var gA = Math.min(1, U.lerp(dayGlow == null ? 0.4 : dayGlow, 1, env.n) * gm), sm = 0.75 + 0.25 * gm;
    ctx.save();
    for (i = 0; i < list.length; i++) {
      b = list[i];
      if (b.lv && b.lv > lv) continue;
      ctx.globalAlpha = b.vis * Math.min(1, 0.55 + 0.45 * gm); ctx.fillStyle = spr.core[b.c];
      ctx.beginPath(); ctx.arc(b.x, b.y, b.sz * 0.9, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < list.length; i++) {
      b = list[i];
      if (b.lv && b.lv > lv) continue;
      var tw = 0.7 + 0.3 * Math.sin(t * b.sp + b.ph);
      var s = b.sz * (2.8 + env.n * 2.8) * tw * sm;
      ctx.globalAlpha = gA * tw * b.vis;
      ctx.drawImage(spr.glow[b.c], b.x - s, b.y - s, s * 2, s * 2);
    }
    ctx.restore();
  };
  U.drawSparkles = function (ctx, list, env, strength) {
    var t = env.t;
    ctx.save(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (var i = 0; i < list.length; i++) {
      var p = list[i], v = Math.pow(Math.max(0, Math.sin(t * p.sp + p.ph)), 10) * (strength || 1);
      if (v < 0.03) continue;
      var r = p.r * v;
      ctx.globalAlpha = v;
      ctx.beginPath(); ctx.moveTo(p.x - r, p.y); ctx.lineTo(p.x + r, p.y); ctx.moveTo(p.x, p.y - r); ctx.lineTo(p.x, p.y + r); ctx.stroke();
    }
    ctx.restore();
  };
  U.makeSnow = function (rng, W, H, count, scale) {
    var a = [];
    for (var i = 0; i < count; i++) {
      var L = rng();
      a.push({ x: rng() * W, y: rng() * H, r: (0.6 + L * L * 3) * (scale || 1), v: 14 + L * 46, sw: 6 + rng() * 18, ph: rng() * 6.28, a: 0.35 + L * 0.6 });
    }
    return a;
  };
  U.drawSnow = function (ctx, s, W, H, dt, t, amt, col) {
    var n = Math.round(s.length * U.clamp(amt, 0, 2) / 2);
    ctx.fillStyle = col;
    for (var i = 0; i < n; i++) {
      var p = s[i];
      p.y += p.v * dt * (0.7 + 0.3 * amt);
      if (p.y > H + 6) { p.y = -6; p.x = Math.random() * W; }
      ctx.globalAlpha = p.a;
      ctx.beginPath(); ctx.arc(p.x + Math.sin(t * 0.6 + p.ph) * p.sw, p.y, p.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  };
  U.santaXY = function (sa, m) {
    var p = sa.age / sa.dur, x = U.lerp(sa.x0, sa.x1, p);
    return { x: x, y: m.y + sa.slope * (x - m.x) + Math.sin(sa.age * 1.7) * 3, p: p };
  };
  /* sleigh + 4 reindeer silhouette, facing +x when dir = 1 */
  U.santa = function (ctx, x, y, s, col, t, dir) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s * dir, s);
    ctx.fillStyle = col; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.arc(-30, -24, 9, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-14, -18, 9, 9, 0, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(-12, -31, 5.5, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-17.5, -34); ctx.lineTo(-6.5, -35); ctx.lineTo(-19, -45); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.arc(-20, -45, 2.2, 0, 6.2832); ctx.fill();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-8, -22); ctx.lineTo(6, -20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-40, -26);
    ctx.quadraticCurveTo(-44, -2, -30, 0); ctx.lineTo(20, 0);
    ctx.quadraticCurveTo(34, 0, 36, -14); ctx.quadraticCurveTo(30, -12, 26, -8);
    ctx.lineTo(-28, -10); ctx.quadraticCurveTo(-34, -14, -34, -26); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(-36, 8); ctx.lineTo(28, 8); ctx.quadraticCurveTo(40, 8, 40, 0);
    ctx.moveTo(-24, 0); ctx.lineTo(-24, 8); ctx.moveTo(14, 0); ctx.lineTo(14, 8); ctx.stroke();
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(6, -20);
    for (var r = 0; r < 4; r++) {
      var rx0 = 62 + r * 36, bb = Math.sin(t * 9 + r * 0.9) * 1.6;
      ctx.lineTo(rx0 + 10, -22 + bb);
    }
    ctx.stroke();
    for (var i = 0; i < 4; i++) {
      var rx = 62 + i * 36, ph = t * 9 + i * 0.9, bob = Math.sin(ph) * 1.6, a = Math.sin(ph) * 0.9;
      ctx.beginPath(); ctx.ellipse(rx, -18 + bob, 12, 5.5, 0, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 3.5; ctx.beginPath(); ctx.moveTo(rx + 8, -20 + bob); ctx.lineTo(rx + 14, -28 + bob); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(rx + 17, -29 + bob, 4.2, 2.6, 0.2, 0, 6.2832); ctx.fill();
      ctx.lineWidth = 1.3; ctx.beginPath();
      ctx.moveTo(rx + 14, -31 + bob); ctx.lineTo(rx + 11, -38 + bob);
      ctx.moveTo(rx + 12.2, -34.6 + bob); ctx.lineTo(rx + 8, -36 + bob);
      ctx.moveTo(rx + 16, -31 + bob); ctx.lineTo(rx + 17, -38 + bob);
      ctx.moveTo(rx + 16.5, -35 + bob); ctx.lineTo(rx + 20, -37 + bob);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(rx + 8, -15 + bob); ctx.lineTo(rx + 8 + Math.sin(0.5 + a) * 10, -15 + bob + Math.cos(0.5 + a) * 10);
      ctx.moveTo(rx + 5, -15 + bob); ctx.lineTo(rx + 5 + Math.sin(0.2 - a * 0.6) * 10, -15 + bob + Math.cos(0.2 - a * 0.6) * 10);
      ctx.moveTo(rx - 8, -15 + bob); ctx.lineTo(rx - 8 + Math.sin(-0.5 - a) * 10, -15 + bob + Math.cos(-0.5 - a) * 10);
      ctx.moveTo(rx - 5, -15 + bob); ctx.lineTo(rx - 5 + Math.sin(-0.2 + a * 0.6) * 10, -15 + bob + Math.cos(-0.2 + a * 0.6) * 10);
      ctx.stroke();
    }
    ctx.restore();
  };
  return U;
})();
