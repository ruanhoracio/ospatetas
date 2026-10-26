// Definições dos mapas. Usado pelo servidor (física) e pelo cliente (visual).
// statics: caixas fixas  { p:[x,y,z], s:[w,h,d], c:cor, r?:[rx,ry,rz], conveyor?:[vx,0,vz], look?:string }
// objects: corpos que se mexem { type:'crate'|'mover', ... } (posição vem do servidor)
// decor: só visual

const TAU = Math.PI * 2;

function grid(n, cx, cz, dx, dz, y = 1.5) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.4;
    out.push([cx + Math.cos(a) * dx, y, cz + Math.sin(a) * dz]);
  }
  return out;
}

function city(seed, ring, y0) {
  // prédios decorativos em volta
  const out = [];
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 46; i++) {
    const a = rnd() * TAU;
    const d = ring + rnd() * 40;
    const w = 5 + rnd() * 9, h = 10 + rnd() * 35;
    out.push({ p: [Math.cos(a) * d, y0 + h / 2, Math.sin(a) * d], s: [w, h, w * (0.7 + rnd() * 0.6)], c: rnd() < 0.5 ? 0x4b5563 : 0x64748b, look: 'building' });
  }
  return out;
}

export const MAPS = [
  {
    id: 'telhado',
    name: 'Telhado',
    theme: { skyTop: 0xf59e8b, skyBottom: 0xfde2b8, fog: 0xf7c9a4, fogNear: 30, fogFar: 140, sun: 0xffe2c0 },
    killY: -12,
    bound: 40,
    spawns: grid(6, 0, 0, 5, 4),
    statics: [
      { p: [0, -0.5, 0], s: [18, 1, 14], c: 0x9ca3af, look: 'roof' },
      { p: [-5, 0.6, -4], s: [2.2, 1.2, 1.6], c: 0xcbd5e1, look: 'metal' },
      { p: [4.5, 0.6, 3.6], s: [2.2, 1.2, 1.6], c: 0xcbd5e1, look: 'metal' },
      { p: [6.8, 1.4, -5.4], s: [1.2, 2.8, 1.2], c: 0xb45309 },
      { p: [-7.5, 0.25, 5], s: [2, 0.5, 3], c: 0x78716c },
    ],
    objects: [
      { type: 'crate', p: [-2, 0.5, 2], s: [0.9, 0.9, 0.9], mass: 4, c: 0xc28a4a },
      { type: 'crate', p: [2.5, 0.5, -2.5], s: [0.9, 0.9, 0.9], mass: 4, c: 0xc28a4a },
      { type: 'crate', p: [0, 0.5, -5], s: [1.2, 0.6, 0.8], mass: 3, c: 0x3b82f6 },
      { type: 'crate', p: [-6, 0.5, 1], s: [0.9, 0.9, 0.9], mass: 4, c: 0xc28a4a },
    ],
    decor: [
      ...city(7, 30, -60),
      { p: [0, -30, 0], s: [18.4, 59, 14.4], c: 0x6b7280, look: 'building' },
    ],
  },
  {
    id: 'metro',
    name: 'Metrô',
    theme: { skyTop: 0x1e293b, skyBottom: 0x475569, fog: 0x334155, fogNear: 25, fogFar: 90, sun: 0xdbeafe },
    killY: -10,
    bound: 40,
    spawns: [[-1.5, 1.5, -6], [1.5, 1.5, 6], [1.5, 1.5, -2], [-1.5, 1.5, 2], [0, 1.5, -9], [0, 1.5, 9]],
    statics: [
      { p: [0, -0.5, 0], s: [6, 1, 26], c: 0xa8a29e, look: 'tiles' },
      { p: [0, -1.5, 0], s: [5.6, 1, 25.6], c: 0x57534e },
      { p: [2.7, 0.03, 0], s: [0.5, 0.06, 26], c: 0xfacc15 },
      { p: [-2.7, 0.03, 0], s: [0.5, 0.06, 26], c: 0xfacc15 },
      { p: [5.2, -1.75, 0], s: [3.4, 0.5, 140], c: 0x44403c, look: 'track' },
      { p: [-5.2, -1.75, 0], s: [3.4, 0.5, 140], c: 0x44403c, look: 'track' },
      { p: [0, 0.3, -4], s: [2.2, 0.6, 0.6], c: 0x7c2d12 },
      { p: [0, 0.3, 4], s: [2.2, 0.6, 0.6], c: 0x7c2d12 },
      { p: [0, 2, 12.6], s: [6, 4, 0.8], c: 0x64748b },
    ],
    objects: [
      {
        type: 'mover', s: [3, 2.8, 16], c: 0xdc2626, look: 'train', hazard: true,
        path: (t) => [5.2, -0.1, -70 + ((t * 22 + 0) % 160)],
      },
      {
        type: 'mover', s: [3, 2.8, 16], c: 0x2563eb, look: 'train', hazard: true,
        path: (t) => [-5.2, -0.1, 70 - ((t * 19 + 60) % 160)],
      },
      { type: 'crate', p: [1, 0.5, -1], s: [0.9, 0.9, 0.9], mass: 4, c: 0xc28a4a },
    ],
    decor: [
      { p: [9.5, 1, 0], s: [0.8, 5, 120], c: 0x374151, look: 'building' },
      { p: [-9.5, 1, 0], s: [0.8, 5, 120], c: 0x374151, look: 'building' },
      ...city(11, 30, -30),
    ],
  },
  {
    id: 'moedor',
    name: 'Moedor',
    theme: { skyTop: 0x3f3f46, skyBottom: 0x78716c, fog: 0x57534e, fogNear: 30, fogFar: 100, sun: 0xfff7ed },
    killY: -5,
    bound: 40,
    spawns: [[-6, 1.5, -6], [6, 1.5, 6], [6, 1.5, -6], [-6, 1.5, 6], [-6, 1.5, 0], [6, 1.5, 0]],
    statics: [
      { p: [0, -0.5, -5.5], s: [18, 1, 7], c: 0x52525b, conveyor: [0, 0, 2.4], look: 'belt' },
      { p: [0, -0.5, 5.5], s: [18, 1, 7], c: 0x52525b, conveyor: [0, 0, -2.4], look: 'belt' },
      { p: [-5.5, -0.5, 0], s: [7, 1, 4], c: 0xa1a1aa, look: 'metal' },
      { p: [5.5, -0.5, 0], s: [7, 1, 4], c: 0xa1a1aa, look: 'metal' },
      { p: [-9.3, 0.6, 0], s: [0.6, 1.2, 18], c: 0xeab308 },
      { p: [9.3, 0.6, 0], s: [0.6, 1.2, 18], c: 0xeab308 },
    ],
    objects: [
      { type: 'crate', p: [-6, 0.5, 0], s: [0.9, 0.9, 0.9], mass: 4, c: 0xc28a4a },
      { type: 'crate', p: [6, 0.5, 0], s: [0.9, 0.9, 0.9], mass: 4, c: 0xc28a4a },
    ],
    decor: [
      { p: [0, -3.2, -0.9], s: [4, 1.6, 1.6], c: 0x991b1b, look: 'roller' },
      { p: [0, -3.2, 0.9], s: [4, 1.6, 1.6], c: 0x991b1b, look: 'roller', reverse: true },
      { p: [0, -6, 0], s: [30, 1, 30], c: 0x292524 },
      { p: [0, 8, -14], s: [30, 18, 1], c: 0x44403c },
    ],
  },
  {
    id: 'vigas',
    name: 'Vigas',
    theme: { skyTop: 0x60a5fa, skyBottom: 0xe0f2fe, fog: 0xdbeafe, fogNear: 35, fogFar: 160, sun: 0xffffff },
    killY: -25,
    bound: 45,
    spawns: [[-4, 1.5, -5], [4, 1.5, 5], [4, 1.5, -5], [-4, 1.5, 5], [0, 1.5, -7], [0, 1.5, 7]],
    statics: [
      { p: [-4, -0.25, 0], s: [1.5, 0.5, 20], c: 0xef4444, look: 'girder' },
      { p: [0, -0.25, 0], s: [1.5, 0.5, 20], c: 0xef4444, look: 'girder' },
      { p: [4, -0.25, 0], s: [1.5, 0.5, 20], c: 0xef4444, look: 'girder' },
      { p: [0, -0.24, -6], s: [12, 0.5, 1.5], c: 0xef4444, look: 'girder' },
      { p: [0, -0.24, 6], s: [12, 0.5, 1.5], c: 0xef4444, look: 'girder' },
      { p: [0, -0.23, 0], s: [4.5, 0.5, 4.5], c: 0x9ca3af, look: 'metal' },
    ],
    objects: [
      { type: 'mover', s: [4, 0.5, 3], c: 0xf97316, look: 'girder', path: (t) => [Math.sin(t * 0.5) * 7, -0.25, 11.6] },
      { type: 'mover', s: [4, 0.5, 3], c: 0xf97316, look: 'girder', path: (t) => [-Math.sin(t * 0.5) * 7, -0.25, -11.6] },
    ],
    decor: [
      { p: [14, -60, -10], s: [2, 120, 2], c: 0xef4444 },
      { p: [14, 30, -10], s: [2, 60, 2], c: 0xef4444 },
      { p: [2, 58, -10], s: [26, 2, 2], c: 0xef4444 },
      ...city(3, 40, -120),
    ],
  },
  {
    id: 'roda',
    name: 'Roda Gigante',
    theme: { skyTop: 0x312e81, skyBottom: 0xf472b6, fog: 0x9d4edd, fogNear: 35, fogFar: 140, sun: 0xffd6f0 },
    killY: -14,
    bound: 40,
    spawns: [[-4.5, -1.6, 1.5], [4.5, -1.6, -1.5], [-1.5, -1.6, -1.5], [1.5, -1.6, 1.5], [-4.5, -1.6, -1.5], [4.5, -1.6, 1.5]],
    statics: [
      { p: [0, -3.6, 0], s: [13, 1, 6], c: 0xa78bfa, look: 'tiles' },
    ],
    objects: Array.from({ length: 6 }, (_, i) => ({
      type: 'mover', s: [3.2, 0.4, 3.2], c: [0xf43f5e, 0xfacc15, 0x22c55e, 0x06b6d4, 0x6366f1, 0xf97316][i], look: 'gondola',
      path: (t) => {
        const a = t * (TAU / 26) + (i / 6) * TAU + Math.PI / 6;
        return [Math.cos(a) * 7.5, 4.6 + Math.sin(a) * 7.5, 0];
      },
    })),
    decor: [
      { p: [0, 4.6, -1.8], s: [1.2, 1.2, 1.2], c: 0xe5e7eb, look: 'hub' },
      { p: [-4, -2, -2.6], s: [0.6, 13.5, 0.6], c: 0xe5e7eb, r: [0, 0, -0.62] },
      { p: [4, -2, -2.6], s: [0.6, 13.5, 0.6], c: 0xe5e7eb, r: [0, 0, 0.62] },
      { p: [0, -40, 0], s: [200, 1, 200], c: 0x1e1b4b },
    ],
    wheel: { center: [0, 4.6, -1.8] },
  },
];
