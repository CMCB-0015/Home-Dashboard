// @ts-nocheck
// Christmas · Ridgeline (1.30.0): the scene Connor picked on the "Panel Christmas
// Screensaver" canvas. A snowy ridge, peaks, forest, big pines in multicolor
// bulbs, moon at night with Santa crossing it, sun by day (lights stay on).
// Built for any screen size; sizes scale from the 1200×800 mockup.
import { XM } from './sceneEngine'

export const RIDGELINE: any = {
  seed: 1225, santaDur: 11,
  build: function (rng, W, H) {
    var S = { W: W, H: H, s: Math.min(W, H * 1.5) / 1200 }, i, x, k = S.s;
    S.stars = [];
    for (i = 0; i < 240; i++) S.stars.push({ x: rng() * W, y: Math.pow(rng(), 1.4) * H * 0.62, r: (rng() < 0.08 ? 1.7 : 0.6 + rng() * 0.9) * Math.max(1, k), ph: rng() * 6.28, sp: 0.6 + rng() * 2.2 });
    S.r1 = XM.ridge(rng, 128, 0.56); S.r2 = XM.ridge(rng, 128, 0.58); S.r3 = XM.ridge(rng, 128, 0.5); S.r4 = XM.ridge(rng, 64, 0.45);
    S.gY = function (x) { return H * 0.865 - Math.sin(x / W * Math.PI) * H * 0.035 + Math.sin(x / W * 9 + 1.3) * H * 0.008; };
    S.f3 = [];
    for (x = -10; x < W + 10; x += (5 + rng() * 7) * k) S.f3.push({ x: x, y: H * 0.735 - XM.ridgeY(S.r3, x, W) * H * 0.12 + (3 + rng() * 9) * k, h: (9 + rng() * 12) * k });
    S.f4 = [];
    for (x = -20; x < W + 20; x += (9 + rng() * 12) * k) S.f4.push({ x: x, y: H * 0.8 - XM.ridgeY(S.r4, x, W) * H * 0.06 + (4 + rng() * 10) * k, h: (20 + rng() * 26) * k });
    var spec = [[0.44, 0.12, -34], [0.615, 0.11, -38], [0.55, 0.15, -28], [0.235, 0.34, 4], [0.79, 0.36, 4], [0.155, 0.5, 8], [0.965, 0.52, 8], [0.06, 0.66, 12], [0.875, 0.7, 12]];
    S.big = spec.map(function (s) { var bx = s[0] * W; return { x: bx, y: S.gY(bx) + s[2] * k, h: s[1] * Math.min(H, W * 0.85) }; });
    var cols = ['#ff4b3e', '#ffc23a', '#3fd06d', '#3d9bff', '#ff7ad1'];
    S.spr = XM.sprites(cols);
    S.bulbs = [];
    S.big.forEach(function (t, ti) {
      var start = S.bulbs.length;
      XM.spiralBulbs(rng, S.bulbs, t, cols, { offset: ti, density: 0.26 });
      for (var j = start; j < S.bulbs.length; j++) { var m = (j - start) % 4; S.bulbs[j].lv = m === 0 ? 1 : m === 2 ? 2 : 3; }
    });
    var forestBulbs = function (list, perTree, sz, lvFn) {
      list.forEach(function (t, ti) {
        for (var k = 0; k < perTree; k++) {
          var u = 0.15 + rng() * 0.8, yy = t.y - t.h + u * t.h * 0.9, hw = t.h * 0.3 * u;
          S.bulbs.push({ x: t.x + (rng() * 2 - 1) * hw * 0.85, y: yy, c: cols[(ti + k) % cols.length], ph: rng() * 6.28, sp: 1 + rng() * 2.4, sz: sz, vis: 0.9, lv: lvFn(k) });
        }
      });
    };
    forestBulbs(S.f4, 5, 1.15 * k, function (k) { return k < 2 ? 3 : 4; });
    forestBulbs(S.f3, 2, 0.8 * k, function () { return 4; });
    S.spk = [];
    for (i = 0; i < 80; i++) { x = rng() * W; S.spk.push({ x: x, y: S.gY(x) + 8 + rng() * (H - S.gY(x)), r: (2 + rng() * 3) * k, ph: rng() * 6.28, sp: 0.4 + rng() * 1.2 }); }
    return S;
  },
  moon: function (env, S) {
    var p = XM.nightP(env.h);
    return { x: S.W * (0.45 + 0.45 * p), y: S.H * 0.3 - Math.sin(p * Math.PI) * S.H * 0.17, r: 42 * S.s, a: XM.smooth(0.4, 0.9, env.n) };
  },
  sky: function (ctx, S, env) {
    var W = S.W, H = S.H;
    var top = XM.pal(['#040a1c', '#2a2a63', '#3f80c8'], env), hor = XM.pal(['#18284e', '#f39a6e', '#cfe5f4'], env);
    var g = ctx.createLinearGradient(0, 0, 0, H * 0.8);
    g.addColorStop(0, XM.css(top)); g.addColorStop(1, XM.css(hor));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    XM.drawStars(ctx, S.stars, XM.smooth(0.35, 0.95, env.n), env.t);
    if (env.d > 0.01) { var p = XM.clamp(XM.sunP(env.h), 0, 1); XM.drawSun(ctx, W * (0.92 - 0.55 * p), H * 0.5 - Math.sin(p * Math.PI) * H * 0.36, 30 * S.s, XM.smooth(0, 0.4, env.d), env.g); }
    var m = this.moon(env, S); XM.drawMoon(ctx, m.x, m.y, m.r, m.a);
  },
  santa: function (ctx, S, env, sa) {
    if (!sa) return;
    var m = this.moon(env, S), p = XM.santaXY(sa, m);
    XM.santa(ctx, p.x, p.y, 0.42 * S.s, 'rgba(8,12,26,0.96)', env.t, sa.dir);
  },
  land: function (ctx, S, env) {
    var W = S.W, H = S.H, P = function (a) { return XM.pal(a, env); };
    var hz = P(['#18284e', '#f39a6e', '#cfe5f4']);
    var rock1 = P(['#26355f', '#6d5f8f', '#8fa9c6']);
    XM.mountain(ctx, S.r1, W, H, H * 0.6, H * 0.32, XM.mix(rock1, hz, 0.35), XM.mix(rock1, hz, 0.5), XM.mix(P(['#7f93c2', '#f6cbbd', '#eef4fb']), hz, 0.25), 0.28);
    var rock2 = P(['#1d2a4f', '#584a78', '#6f8cab']);
    XM.mountain(ctx, S.r2, W, H, H * 0.67, H * 0.24, rock2, XM.mix(rock2, hz, 0.2), P(['#8ea3cf', '#f9d6c6', '#f7fbff']), 0.32);
    var r3 = P(['#16213f', '#3f3a5c', '#5d7894']);
    XM.mountain(ctx, S.r3, W, H, H * 0.735, H * 0.12, r3, r3, P(['#6f84b3', '#d9b5b5', '#e6eef6']), 0.15);
    var f3 = XM.css(P(['#0c1729', '#2a2c3e', '#2e4a45'])), s3 = XM.css(P(['#5a6c96', '#c9a9a8', '#dde8ef']));
    S.f3.forEach(function (t) { XM.pine(ctx, t.x, t.y, t.h, f3, s3, { tiers: 3, snow: 0.35 }); });
    var nearTop = P(['#a6b6dc', '#f1cdbf', '#f4f8fc']), nearBot = P(['#6f82b0', '#b9a3b8', '#c6d7e8']);
    XM.mountain(ctx, S.r4, W, H, H * 0.8, H * 0.06, nearBot, nearBot, nearTop, 0.35);
    var f4 = XM.css(P(['#08131f', '#1f2532', '#24443a'])), s4 = XM.css(P(['#9fb1d8', '#efcabd', '#ffffff']));
    S.f4.forEach(function (t) { XM.pine(ctx, t.x, t.y, t.h, f4, s4, { tiers: 4, snow: 0.42 }); });
    ctx.beginPath(); ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 10) ctx.lineTo(x, S.gY(x));
    ctx.lineTo(W, H); ctx.closePath();
    var g = ctx.createLinearGradient(0, H * 0.82, 0, H);
    g.addColorStop(0, XM.css(P(['#aebfe3', '#ffd8c6', '#ffffff']))); g.addColorStop(1, XM.css(P(['#5e72a3', '#9f97c0', '#cddff0'])));
    ctx.fillStyle = g; ctx.fill();
    var bt = XM.css(P(['#071816', '#18292a', '#1c4433'])), bs = XM.css(P(['#c3d1ef', '#ffe0d0', '#ffffff'])), sh = XM.css(P(['#2a3a68', '#6d5f8f', '#9fb6d2']), 0.35);
    S.big.forEach(function (t) {
      ctx.fillStyle = sh; ctx.beginPath(); ctx.ellipse(t.x + t.h * 0.06, t.y, t.h * 0.3, t.h * 0.03, 0, 0, 6.2832); ctx.fill();
      var big = t.h > 200 * S.s;
      XM.pine(ctx, t.x, t.y, t.h, bt, bs, { tiers: big ? 8 : 5, jag: big ? 7 : 4, snow: 0.42, ledge: big, trunkCol: '#2a1d16' });
    });
  },
  lights: function (ctx, S, env, o) {
    o = o || {};
    XM.drawBulbs(ctx, S.bulbs, S.spr, env, 0.42, o.level, o.glow);
    XM.drawSparkles(ctx, S.spk, env, 0.5 + 0.5 * Math.max(env.d, XM.smooth(0.4, 0.9, env.n)));
  },
  snowColor: function () { return '#ffffff'; },
  snowScale: 1
}
