import * as THREE from 'three';
import { Game, DT } from './shared/game.js';
import { MAPS } from './shared/maps.js';

// ================= opções de customização =================
const COLORS = [0xff5a36, 0xffc531, 0x4ade80, 0x22d3ee, 0x3b82f6, 0xa855f7, 0xf472b6, 0xffffff, 0x9ca3af, 0x1f2937, 0x92400e, 0x84cc16];
const HATS = [['nenhum', 'Nenhum'], ['bone', 'Boné'], ['cartola', 'Cartola'], ['coroa', 'Coroa'], ['gorro', 'Gorro'], ['chifres', 'Chifres'], ['cone', 'Cone'], ['capacete', 'Capacete'], ['cowboy', 'Cowboy'], ['orelhas', 'Orelhas']];
const EYES = [['normal', 'Normal'], ['bravo', 'Bravo'], ['sono', 'Sonolento'], ['feliz', 'Feliz'], ['vesgo', 'Vesgo']];
const ACCS = [['nenhum', 'Nenhum'], ['oculos', 'Óculos'], ['bigode', 'Bigode'], ['gravata', 'Gravata'], ['cachecol', 'Cachecol'], ['mascara', 'Máscara']];
const PARTS = ['torso', 'head', 'armL', 'armR', 'legL', 'legR'];

const store = {
  get(k, d) { try { const v = localStorage.getItem('pm_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('pm_' + k, JSON.stringify(v)); } catch {} },
};
const me = store.get('info', null) || {
  name: '', color: COLORS[Math.floor(Math.random() * COLORS.length)], hat: 'bone', eyes: 'normal', acc: 'nenhum',
};

const $ = (id) => document.getElementById(id);

// ================= renderização base =================
const canvas = $('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 900);
camera.position.set(0, 12, 16);
const hemi = new THREE.HemisphereLight(0xffffff, 0x554466, 1.0);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 120 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target);

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vp; void main(){ float h = clamp(vp.y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bottom, top, smoothstep(0.35,0.9,h)),1.0); }',
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), skyMat);
scene.add(sky);

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ================= texturas procedurais =================
function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const shade = (c, f) => { const col = new THREE.Color(c); col.multiplyScalar(f); return '#' + col.getHexString(); };

const texCache = new Map();
function lookTex(look, color) {
  const key = look + color;
  if (texCache.has(key)) return texCache.get(key);
  let t = null;
  const base = hex(color);
  if (look === 'roof') t = canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    g.strokeStyle = shade(color, 0.75); g.lineWidth = 4; g.strokeRect(0, 0, s, s);
  });
  else if (look === 'tiles') t = canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.strokeStyle = shade(color, 0.8); g.lineWidth = 3;
    g.strokeRect(0, 0, s / 2, s / 2); g.strokeRect(s / 2, s / 2, s / 2, s / 2); g.strokeRect(s / 2, 0, s / 2, s / 2); g.strokeRect(0, s / 2, s / 2, s / 2);
  });
  else if (look === 'belt') t = canvasTex(128, (g, s) => {
    g.fillStyle = '#2b2b30'; g.fillRect(0, 0, s, s);
    g.fillStyle = '#facc15';
    for (let i = 0; i < 2; i++) { g.beginPath(); const y = i * s / 2; g.moveTo(0, y + s / 4); g.lineTo(s / 2, y); g.lineTo(s, y + s / 4); g.lineTo(s, y + s / 4 + 14); g.lineTo(s / 2, y + 14); g.lineTo(0, y + s / 4 + 14); g.fill(); }
  });
  else if (look === 'girder') t = canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.fillStyle = shade(color, 0.6);
    for (let x = 16; x < s; x += 32) for (let y = 16; y < s; y += 32) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
    g.fillStyle = shade(color, 0.8); g.fillRect(0, 0, s, 6); g.fillRect(0, s - 6, s, 6);
  });
  else if (look === 'metal') t = canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.strokeStyle = shade(color, 0.85); g.lineWidth = 2;
    for (let i = -s; i < s * 2; i += 12) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + s / 3, s); g.stroke(); }
    g.strokeStyle = shade(color, 0.6); g.lineWidth = 4; g.strokeRect(0, 0, s, s);
  });
  else if (look === 'building') t = canvasTex(128, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    for (let x = 8; x < s; x += 24) for (let y = 8; y < s; y += 24) { g.fillStyle = Math.random() < 0.45 ? '#fde68a' : shade(color, 0.6); g.fillRect(x, y, 12, 14); }
  });
  else if (look === 'train') t = canvasTex(256, (g, s) => {
    g.fillStyle = base; g.fillRect(0, 0, s, s);
    g.fillStyle = '#e5e7eb'; g.fillRect(0, s * 0.62, s, s * 0.06);
    g.fillStyle = '#bae6fd'; for (let x = 10; x < s; x += 64) g.fillRect(x, s * 0.2, 44, s * 0.32);
  });
  else if (look === 'track') t = canvasTex(128, (g, s) => {
    g.fillStyle = '#57534e'; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(Math.random() * s, Math.random() * s, 3, 3); }
    g.fillStyle = '#78350f'; for (let y = 0; y < s; y += 32) g.fillRect(0, y, s, 12);
  });
  texCache.set(key, t);
  return t;
}
const TILE = { roof: 3, tiles: 2, belt: 2, girder: 2, metal: 2, building: 8, train: 16, track: 2 };

function boxGeo(w, h, d, tile) {
  const g = new THREE.BoxGeometry(w, h, d);
  if (!tile) return g;
  const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i));
    let u, v;
    if (nx > 0.5) { u = p.getZ(i); v = p.getY(i); }
    else if (ny > 0.5) { u = p.getX(i); v = p.getZ(i); }
    else { u = p.getX(i); v = p.getY(i); }
    uv.setXY(i, u / tile, v / tile);
  }
  return g;
}

function boxMesh(def) {
  const tile = TILE[def.look];
  const tex = def.look ? lookTex(def.look, def.c) : null;
  const mat = new THREE.MeshStandardMaterial({ color: tex ? 0xffffff : def.c, map: tex, roughness: 0.75, metalness: def.look === 'metal' ? 0.25 : 0.02 });
  if (tex && def.look === 'belt') { mat.map = tex.clone(); mat.map.needsUpdate = true; }
  const m = new THREE.Mesh(boxGeo(def.s[0], def.s[1], def.s[2], tile), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

// ================= mapa visual =================
let mapGroup = null, mapView = null;
function buildMap(index) {
  if (mapGroup) { scene.remove(mapGroup); mapGroup.traverse((o) => { o.geometry?.dispose(); }); }
  const def = MAPS[index];
  mapGroup = new THREE.Group();
  scene.add(mapGroup);
  const th = def.theme;
  skyMat.uniforms.top.value.set(th.skyTop);
  skyMat.uniforms.bottom.value.set(th.skyBottom);
  scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
  sun.color.set(th.sun);
  hemi.color.set(th.skyBottom);
  const belts = [], rollers = [], movers = [];
  for (const s of def.statics) {
    const m = boxMesh(s);
    m.position.set(...s.p);
    if (s.r) m.rotation.set(...s.r);
    mapGroup.add(m);
    if (s.conveyor) belts.push({ tex: m.material.map, v: s.conveyor });
    if (s.look === 'track') {
      for (const dx of [-0.75, 0.75]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, s.s[2]), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.8, roughness: 0.3 }));
        rail.position.set(s.p[0] + dx, s.p[1] + s.s[1] / 2 + 0.08, s.p[2]);
        mapGroup.add(rail);
      }
    }
  }
  for (const d of def.decor || []) {
    let m;
    if (d.look === 'roller') {
      m = new THREE.Group();
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(d.s[1] / 2, d.s[1] / 2, d.s[0], 20), new THREE.MeshStandardMaterial({ color: d.c, metalness: 0.5, roughness: 0.4 }));
      cyl.rotation.z = Math.PI / 2;
      m.add(cyl);
      for (let i = 0; i < 10; i++) {
        const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.7, roughness: 0.3 }));
        const a = (i / 10) * Math.PI * 2;
        tooth.position.set(-1.6 + (i % 5) * 0.8, Math.cos(a) * 0.9, Math.sin(a) * 0.9);
        tooth.rotation.x = a;
        m.add(tooth);
      }
      rollers.push({ m, dir: d.reverse ? -1 : 1 });
      const glow = new THREE.PointLight(0xff4d1a, 30, 12);
      glow.position.set(d.p[0], d.p[1] - 1, d.p[2]);
      mapGroup.add(glow);
    } else if (d.look === 'hub') {
      m = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 20), new THREE.MeshStandardMaterial({ color: d.c, metalness: 0.4 }));
      m.rotation.x = Math.PI / 2;
    } else {
      m = boxMesh(d);
      m.castShadow = false;
    }
    m.position.set(...d.p);
    if (d.r) m.rotation.set(...d.r);
    mapGroup.add(m);
  }
  for (const o of def.objects) {
    let m;
    if (o.type === 'crate') {
      m = boxMesh({ s: o.s, c: o.c, look: 'crate' });
      m.material = new THREE.MeshStandardMaterial({ map: crateTex(o.c), roughness: 0.8 });
    } else if (o.look === 'train') {
      m = boxMesh({ s: o.s, c: o.c, look: 'train' });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff7cc }));
      lamp.position.set(0, -0.4, Math.sign(o.path(1)[2] - o.path(0)[2]) * o.s[2] / 2);
      m.add(lamp);
    } else if (o.look === 'gondola') {
      m = boxMesh({ s: o.s, c: o.c });
      const rim = new THREE.Mesh(new THREE.BoxGeometry(o.s[0] + 0.1, 0.12, o.s[2] + 0.1), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      rim.scale.set(1, 1, 0.08); rim.position.set(0, o.s[1] / 2, o.s[2] / 2);
      m.add(rim);
    } else m = boxMesh({ s: o.s, c: o.c, look: o.look });
    mapGroup.add(m);
    movers.push(m);
  }
  let spokes = null;
  if (def.wheel) {
    const n = def.objects.length;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 2 * 3 * 2), 3));
    spokes = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
    spokes.frustumCulled = false;
    mapGroup.add(spokes);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7.5, 0.12, 8, 64), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff77cc, emissiveIntensity: 0.5 }));
    ring.position.set(...def.wheel.center);
    mapGroup.add(ring);
  }
  mapView = { index, def, belts, rollers, movers, spokes };
}

function crateTex(color) {
  const key = 'crate' + color;
  if (texCache.has(key)) return texCache.get(key);
  const t = canvasTex(128, (g, s) => {
    g.fillStyle = hex(color); g.fillRect(0, 0, s, s);
    g.strokeStyle = shade(color, 0.6); g.lineWidth = 12; g.strokeRect(6, 6, s - 12, s - 12);
    g.lineWidth = 9; g.beginPath(); g.moveTo(10, 10); g.lineTo(s - 10, s - 10); g.stroke();
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  texCache.set(key, t);
  return t;
}

// ================= bonecos =================
const geo = {
  torso: new THREE.CapsuleGeometry(0.45, 0.34, 10, 24),
  head: new THREE.SphereGeometry(0.31, 32, 20),
  arm: new THREE.CapsuleGeometry(0.155, 0.4, 8, 16),
  hand: new THREE.SphereGeometry(0.2, 20, 14),
  leg: new THREE.CapsuleGeometry(0.2, 0.18, 8, 16),
  foot: new THREE.SphereGeometry(0.2, 20, 14),
  eye: new THREE.SphereGeometry(0.075, 18, 12),
  pupil: new THREE.SphereGeometry(0.045, 14, 10),
  shine: new THREE.SphereGeometry(0.016, 8, 6),
  blush: new THREE.CircleGeometry(0.055, 20),
};
// sombreado de desenho (3 tons) + contorno escuro
const toonGrad = (() => {
  const d = new Uint8Array([110, 110, 110, 255, 185, 185, 185, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
})();
const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: { w: { value: 0.028 } },
  vertexShader: 'uniform float w; void main(){ vec3 p = position + normal * w; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
  fragmentShader: 'void main(){ gl_FragColor = vec4(0.12, 0.06, 0.16, 1.0); }',
});
const black = new THREE.MeshBasicMaterial({ color: 0x15101c });
const white = new THREE.MeshBasicMaterial({ color: 0xffffff });

function std(color, extra = {}) {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: toonGrad });
  if (extra.side) m.side = extra.side;
  if (extra.emissive) { m.emissive = new THREE.Color(extra.emissive); m.emissiveIntensity = extra.emissiveIntensity ?? 1; }
  return m;
}
function add(parent, g, mat, pos, rot, scale, outline = true) {
  const m = new THREE.Mesh(g, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  m.castShadow = true;
  parent.add(m);
  if (outline && g.type !== 'BoxGeometry' && !(g.parameters?.openEnded)) {
    const o = new THREE.Mesh(g, outlineMat);
    o.castShadow = false;
    m.add(o);
  }
  return m;
}

function makeHat(head, kind, color) {
  const h = new THREE.Group();
  head.add(h);
  const col = new THREE.Color(color);
  const contrast = col.getHSL({}).l > 0.6 ? 0x1f2937 : 0xffffff;
  if (kind === 'bone') {
    add(h, new THREE.SphereGeometry(0.32, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xef4444), [0, 0.08, 0]);
    add(h, new THREE.CylinderGeometry(0.22, 0.22, 0.03, 20), std(0xef4444), [0, 0.09, 0.3], null, [1, 1, 1.2]);
  } else if (kind === 'cartola') {
    add(h, new THREE.CylinderGeometry(0.42, 0.42, 0.04, 24), black, [0, 0.22, 0]);
    add(h, new THREE.CylinderGeometry(0.24, 0.26, 0.5, 24), black, [0, 0.47, 0]);
    add(h, new THREE.CylinderGeometry(0.265, 0.265, 0.08, 24), std(0xdc2626), [0, 0.28, 0]);
  } else if (kind === 'coroa') {
    const gold = std(0xfacc15, { metalness: 0.8, roughness: 0.25 });
    add(h, new THREE.CylinderGeometry(0.24, 0.24, 0.14, 20, 1, true), gold, [0, 0.3, 0]).material.side = THREE.DoubleSide;
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(h, new THREE.ConeGeometry(0.06, 0.16, 6), gold, [Math.sin(a) * 0.22, 0.44, Math.cos(a) * 0.22]); }
    add(h, new THREE.SphereGeometry(0.05, 8, 6), std(0xef4444), [0, 0.3, 0.24]);
  } else if (kind === 'gorro') {
    add(h, new THREE.SphereGeometry(0.325, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0x2563eb), [0, 0.05, 0], null, [1, 1.15, 1]);
    add(h, new THREE.TorusGeometry(0.3, 0.06, 8, 24), std(0xffffff), [0, 0.07, 0], [Math.PI / 2, 0, 0]);
    add(h, new THREE.SphereGeometry(0.1, 10, 8), std(0xffffff), [0, 0.44, 0]);
  } else if (kind === 'chifres') {
    for (const s of [-1, 1]) add(h, new THREE.ConeGeometry(0.07, 0.3, 10), std(0xfafaf9), [s * 0.18, 0.3, 0], [0, 0, -s * 0.5]);
  } else if (kind === 'cone') {
    add(h, new THREE.ConeGeometry(0.26, 0.6, 20), std(0xf97316), [0, 0.45, 0]);
    add(h, new THREE.CylinderGeometry(0.2, 0.22, 0.08, 20), std(0xffffff), [0, 0.43, 0]);
    add(h, new THREE.BoxGeometry(0.62, 0.05, 0.62), std(0xf97316), [0, 0.17, 0]);
  } else if (kind === 'capacete') {
    add(h, new THREE.SphereGeometry(0.34, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xfacc15), [0, 0.05, 0]);
    add(h, new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24), std(0xfacc15), [0, 0.06, 0.04]);
  } else if (kind === 'cowboy') {
    const brown = std(0x92400e);
    add(h, new THREE.CylinderGeometry(0.5, 0.5, 0.04, 24), brown, [0, 0.2, 0], null, [1, 1, 0.85]);
    add(h, new THREE.CylinderGeometry(0.2, 0.25, 0.3, 20), brown, [0, 0.36, 0]);
    add(h, new THREE.CylinderGeometry(0.255, 0.255, 0.06, 20), std(0x1f2937), [0, 0.25, 0]);
  } else if (kind === 'orelhas') {
    for (const s of [-1, 1]) {
      add(h, new THREE.SphereGeometry(0.12, 12, 10), std(color), [s * 0.22, 0.28, 0], null, [1, 1, 0.5]);
      add(h, new THREE.SphereGeometry(0.07, 10, 8), std(0xf9a8d4), [s * 0.22, 0.28, 0.04], null, [1, 1, 0.5]);
    }
  }
  return contrast;
}

function makeFace(head, eyes, color) {
  const face = new THREE.Group();
  head.add(face);
  const open = new THREE.Group(), ko = new THREE.Group();
  face.add(open, ko);
  const skin = std(color);
  for (const s of [-1, 1]) {
    const x = s * 0.1;
    add(open, geo.eye, white, [x, 0.045, 0.268], null, [1, 1.3, 0.55], false);
    const px = eyes === 'vesgo' ? x - s * 0.025 : x;
    add(open, geo.pupil, black, [px, 0.035, 0.3], null, [1, 1.25, 0.6], false);
    add(open, geo.shine, white, [px + 0.016, 0.065, 0.33], null, null, false);
    if (eyes === 'bravo') add(open, new THREE.CapsuleGeometry(0.018, 0.1, 4, 8), black, [x, 0.17, 0.27], [0, 0, Math.PI / 2 + s * 0.45], null, false);
    if (eyes === 'sono') add(open, new THREE.SphereGeometry(0.08, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, [x, 0.05, 0.27], [0.25, 0, 0], [1.05, 1.3, 0.62], false);
    if (eyes === 'feliz') add(open, new THREE.TorusGeometry(0.055, 0.016, 6, 14, Math.PI), black, [x, 0.17, 0.28], null, null, false);
    const blush = new THREE.Mesh(geo.blush, new THREE.MeshBasicMaterial({ color: 0xff6b9e, transparent: true, opacity: 0.7, depthWrite: false }));
    blush.position.set(s * 0.18, -0.05, 0.255); blush.rotation.y = s * 0.62;
    face.add(blush);
    for (const r of [0.8, -0.8]) add(ko, new THREE.CapsuleGeometry(0.016, 0.11, 4, 6), black, [x, 0.045, 0.29], [0, 0, r], null, false);
  }
  // boca
  const smile = add(open, new THREE.TorusGeometry(0.045, 0.013, 6, 14, Math.PI), black, [0, -0.085, 0.29], [0, 0, Math.PI], eyes === 'bravo' ? [1, 0.35, 1] : null, false);
  if (eyes === 'bravo') smile.rotation.z = 0;
  add(ko, new THREE.TorusGeometry(0.035, 0.013, 6, 14), black, [0, -0.09, 0.285], null, null, false);
  ko.visible = false;
  return { open, ko };
}

function makeAcc(rig, acc) {
  const { head, torso } = rig;
  if (acc === 'oculos') {
    for (const s of [-1, 1]) add(head, new THREE.BoxGeometry(0.17, 0.11, 0.04), black, [s * 0.11, 0.05, 0.31]);
    add(head, new THREE.BoxGeometry(0.08, 0.02, 0.02), black, [0, 0.07, 0.31]);
  } else if (acc === 'bigode') {
    for (const s of [-1, 1]) add(head, new THREE.CapsuleGeometry(0.035, 0.1, 4, 8), std(0x3f2a1d), [s * 0.065, -0.1, 0.28], [0, 0, s * 1.2]);
  } else if (acc === 'gravata') {
    add(torso, new THREE.BoxGeometry(0.1, 0.08, 0.04), std(0xdc2626), [0, 0.43, 0.36]);
    add(torso, new THREE.ConeGeometry(0.08, 0.42, 4), std(0xdc2626), [0, 0.18, 0.39], [Math.PI, Math.PI / 4, -0.15]);
  } else if (acc === 'cachecol') {
    add(torso, new THREE.TorusGeometry(0.3, 0.09, 10, 24), std(0x16a34a), [0, 0.52, 0], [Math.PI / 2, 0, 0]);
    add(torso, new THREE.BoxGeometry(0.14, 0.38, 0.06), std(0x16a34a), [0.16, 0.32, 0.31], [0, 0, 0.15]);
  } else if (acc === 'mascara') {
    add(head, new THREE.TorusGeometry(0.29, 0.06, 8, 30), std(0x111827), [0, 0.05, 0], [0, 0, 0], [1, 1, 1]).rotation.x = Math.PI / 2 + 0.05;
  }
}

function makeCharacter(info) {
  const mat = std(info.color);
  const rig = {};
  const root = new THREE.Group();
  rig.torso = new THREE.Group(); add(rig.torso, geo.torso, mat, [0, -0.02, 0], null, [1.04, 1, 0.94]);
  rig.head = new THREE.Group();
  const hv = new THREE.Group(); // cabeça visual maior e encaixada no corpo
  hv.scale.setScalar(1.32); hv.position.y = -0.12;
  rig.head.add(hv);
  add(hv, geo.head, mat);
  for (const s of ['L', 'R']) {
    const a = new THREE.Group(); add(a, geo.arm, mat, [0, 0.05, 0]); add(a, geo.hand, mat, [0, -0.32, 0.02], null, [1, 0.95, 1]);
    rig['arm' + s] = a;
    const l = new THREE.Group(); add(l, geo.leg, mat, [0, 0.07, 0]); add(l, geo.foot, mat, [0, -0.32, 0.07], null, [1.05, 0.75, 1.35]);
    rig['leg' + s] = l;
  }
  for (const k of PARTS) root.add(rig[k]);
  rig.face = makeFace(hv, info.eyes, info.color);
  makeHat(hv, info.hat, info.color);
  makeAcc({ head: hv, torso: rig.torso }, info.acc);
  rig.root = root;
  return rig;
}

function poseRest(rig) {
  const L = { torso: [0, 0, 0], head: [0, 0.92, 0], armL: [0.5, -0.04, 0], armR: [-0.5, -0.04, 0], legL: [0.2, -0.85, 0], legR: [-0.2, -0.85, 0] };
  for (const k of PARTS) { rig[k].position.set(...L[k]); rig[k].quaternion.identity(); }
}

function nameSprite(text, color, isMe) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = '900 54px Nunito, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#1f1633'; g.lineJoin = 'round';
  const label = (isMe ? '▼ ' : '') + text;
  g.strokeText(label, 256, 64);
  g.fillStyle = hex(color);
  const col = new THREE.Color(color);
  if (col.getHSL({}).l < 0.3) g.fillStyle = '#ffffff';
  g.fillText(label, 256, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(2.4, 0.6, 1);
  s.renderOrder = 10;
  return s;
}

const starGeo = new THREE.OctahedronGeometry(0.09);
const starMat = new THREE.MeshBasicMaterial({ color: 0xffe14a });

// ================= estado de jogo no cliente =================
let net = null;        // transporte (online ou local)
let myId = null;
let snaps = [];        // buffer de estados para interpolar
let clockOff = null;
let lastMap = -1;
const views = new Map(); // id -> { rig, tag, info, stars }
let mode = 'menu';
let latest = null;

function infoKey(p) { return [p.name, p.color, p.hat, p.eyes, p.acc].join('|'); }

function onSnapshot(s) {
  const now = performance.now() / 1000;
  const off = s.t - now;
  clockOff = clockOff == null || Math.abs(off - clockOff) > 1 ? off : clockOff * 0.97 + off * 0.03;
  if (s.map !== lastMap) { snaps = []; lastMap = s.map; buildMap(s.map); }
  snaps.push(s);
  if (snaps.length > 30) snaps.shift();
  latest = s;
  if (net && !net.local && mode === 'game') predSync(s);
  for (const e of s.ev) handleEvent(e);
}

// ================= previsão (online) =================
// O navegador roda a mesma física do servidor: o seu boneco responde na hora
// e o estado do servidor só vai corrigindo aos poucos.
let pred = null;
function predReset(s) {
  const game = new Game({ mapIndex: s.map, predict: true });
  game.mapT = s.mt;
  pred = { game, acc: 0, last: performance.now(), seq: pred?.seq || 0, hist: new Map(), round: s.round, map: s.map };
}
function snapBodies(p, sp, lead) {
  PARTS.forEach((k, i) => {
    const b = p.bodies[k], o = i * 7, ov = i * 3;
    const v = sp.v || [];
    b.position.set(sp.b[o] + (v[ov] || 0) * lead, sp.b[o + 1] + (v[ov + 1] || 0) * lead, sp.b[o + 2] + (v[ov + 2] || 0) * lead);
    b.quaternion.set(sp.b[o + 3], sp.b[o + 4], sp.b[o + 5], sp.b[o + 6]);
    b.velocity.set(v[ov] || 0, v[ov + 1] || 0, v[ov + 2] || 0);
  });
}
const cq = new THREE.Quaternion(), sq = new THREE.Quaternion();
function blendBody(b, P, o, Vv, ov, lead, ap, av, aq) {
  const vx = Vv?.[ov] || 0, vy = Vv?.[ov + 1] || 0, vz = Vv?.[ov + 2] || 0;
  b.position.x += (P[o] + vx * lead - b.position.x) * ap;
  b.position.y += (P[o + 1] + vy * lead - b.position.y) * ap;
  b.position.z += (P[o + 2] + vz * lead - b.position.z) * ap;
  b.velocity.x += (vx - b.velocity.x) * av;
  b.velocity.y += (vy - b.velocity.y) * av;
  b.velocity.z += (vz - b.velocity.z) * av;
  if (aq) {
    cq.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w);
    sq.set(P[o + 3], P[o + 4], P[o + 5], P[o + 6]);
    cq.slerp(sq, aq);
    b.quaternion.set(cq.x, cq.y, cq.z, cq.w);
  }
}
function predSync(s) {
  if (!pred || s.round !== pred.round || s.map !== pred.map) predReset(s);
  const g = pred.game;
  g.state = s.state;
  const lead = Math.min(0.2, (net.rtt ?? 0.15) / 2);
  g.mapT = s.mt + lead;
  const ids = new Set();
  for (const sp of s.players) {
    ids.add(sp.id);
    let p = g.players.get(sp.id);
    if (!p) { p = g.addPlayer(sp.id, sp, false, sp.slot); if (!p) continue; p.fresh = true; }
    if (!sp.alive || sp.b.length !== 42) { if (p.alive) g.despawn(p); continue; }
    if (!p.alive) { g.spawn(p); p.fresh = true; }
    p.koT = sp.kt; p.cons = sp.cons;
    if (sp.st > 0) p.stunT = Math.max(p.stunT, sp.st);
    const isMe = sp.id === myId;
    if (!isMe) g.setInput(sp.id, { mx: sp.in[0], mz: sp.in[1], grab: !!sp.in[2], lift: !!sp.in[3], punch: !!sp.in[4], jump: !!sp.in[5] });
    if (p.fresh) { snapBodies(p, sp, lead); p.facing = sp.f; p.fresh = false; continue; }
    const tb = p.bodies.torso.position;
    if (Math.hypot(sp.b[0] - tb.x, sp.b[1] - tb.y, sp.b[2] - tb.z) > 3.5) { snapBodies(p, sp, lead); continue; }
    if (isMe && sp.kt <= 0) {
      // compara com onde o seu boneco estava quando o servidor leu aquele comando
      const h = pred.hist.get(sp.ack);
      if (h) {
        const ex = sp.b[0] - h[0], ey = sp.b[1] - h[1], ez = sp.b[2] - h[2];
        const e = Math.hypot(ex, ey, ez);
        if (e > 0.03) {
          const k = e > 1 ? 0.35 : 0.15;
          for (const b of Object.values(p.bodies)) { b.position.x += ex * k; b.position.y += ey * k; b.position.z += ez * k; }
          for (const [q, v] of pred.hist) if (q > sp.ack) { v[0] += ex * k; v[1] += ey * k; v[2] += ez * k; }
          if (e > 0.4) PARTS.forEach((kk, i) => blendBody(p.bodies[kk], sp.b, i * 7, sp.v, i * 3, 0, 0, 0.25, 0));
        }
        for (const q of pred.hist.keys()) if (q <= sp.ack) pred.hist.delete(q); else break;
      }
    } else {
      PARTS.forEach((kk, i) => blendBody(p.bodies[kk], sp.b, i * 7, sp.v, i * 3, lead, 0.3, 0.5, 0.3));
      p.facing = sp.f;
    }
  }
  for (const id of [...g.players.keys()]) if (!ids.has(id)) g.removePlayer(id);
  s.objs.forEach((o, i) => {
    const b = g.objects[i];
    if (!b || b.mass === 0) return;
    if (Math.hypot(o[0] - b.position.x, o[1] - b.position.y, o[2] - b.position.z) > 3) { b.position.set(o[0], o[1], o[2]); b.quaternion.set(o[3], o[4], o[5], o[6]); b.velocity.set(o[7] || 0, o[8] || 0, o[9] || 0); }
    else blendBody(b, o, 0, o, 7, lead, 0.3, 0.5, 0.3);
  });
  g.events.length = 0;
}
function predStep() {
  const now = performance.now();
  pred.acc += Math.min(0.25, (now - pred.last) / 1000); pred.last = now;
  while (pred.acc >= DT) {
    pred.acc -= DT;
    const i = readInput();
    i.s = ++pred.seq;
    pred.game.setInput(myId, i);
    net.send({ type: 'input', i });
    pred.game.step();
    const meP = pred.game.players.get(myId);
    if (meP?.alive) { const t = meP.bodies.torso.position; pred.hist.set(i.s, [t.x, t.y, t.z]); }
    if (pred.hist.size > 300) pred.hist.delete(pred.hist.keys().next().value);
  }
  pred.game.events.length = 0;
}
function predView() {
  const g = pred.game, out = [];
  for (const sp of latest.players) {
    const p = g.players.get(sp.id);
    const b = [];
    if (p?.alive && sp.alive) for (const k of PARTS) { const x = p.bodies[k]; b.push(x.position.x, x.position.y, x.position.z, x.quaternion.x, x.quaternion.y, x.quaternion.z, x.quaternion.w); }
    out.push({ ...sp, alive: b.length === 42, b });
  }
  const objs = g.objects.map((x) => [x.position.x, x.position.y, x.position.z, x.quaternion.x, x.quaternion.y, x.quaternion.z, x.quaternion.w]);
  return { players: out, objs };
}

function ensureView(p) {
  let v = views.get(p.id);
  const key = infoKey(p);
  if (v && v.key !== key) { scene.remove(v.rig.root, v.tag); views.delete(p.id); v = null; }
  if (!v) {
    const rig = makeCharacter(p);
    const tag = nameSprite(p.name, p.color, p.id === myId);
    const stars = new THREE.Group();
    for (let i = 0; i < 3; i++) stars.add(new THREE.Mesh(starGeo, starMat));
    rig.head.add(stars);
    stars.position.y = 0.55;
    scene.add(rig.root, tag);
    v = { rig, tag, stars, key };
    views.set(p.id, v);
  }
  return v;
}

const qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
function applyBodies(v, a, b, t) {
  for (let i = 0; i < 6; i++) {
    const o = i * 7, part = v.rig[PARTS[i]];
    if (b) {
      part.position.set(a[o] + (b[o] - a[o]) * t, a[o + 1] + (b[o + 1] - a[o + 1]) * t, a[o + 2] + (b[o + 2] - a[o + 2]) * t);
      qa.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]); qb.set(b[o + 3], b[o + 4], b[o + 5], b[o + 6]);
      part.quaternion.slerpQuaternions(qa, qb, t);
    } else {
      part.position.set(a[o], a[o + 1], a[o + 2]);
      part.quaternion.set(a[o + 3], a[o + 4], a[o + 5], a[o + 6]);
    }
  }
}

const camTarget = new THREE.Vector3(0, 0, 0);
let camDist = 16, shake = 0;

function renderGame(dt, time) {
  if (!snaps.length) return;
  let a = snaps[0], b = null, t = 0;
  if (pred && net && !net.local && mode === 'game') {
    a = predView();
  } else {
    const delay = net?.local ? 0.02 : 0.075;
    const rt = performance.now() / 1000 + clockOff - delay;
    for (let i = snaps.length - 1; i >= 0; i--) if (snaps[i].t <= rt) { a = snaps[i]; b = snaps[i + 1] || null; break; }
    t = b ? Math.min(1, Math.max(0, (rt - a.t) / (b.t - a.t))) : 0;
  }

  const seen = new Set();
  const center = new THREE.Vector3(); let n = 0;
  for (const p of a.players) {
    seen.add(p.id);
    const v = ensureView(p);
    const show = p.alive && p.b.length === 42;
    v.rig.root.visible = show; v.tag.visible = show;
    if (!show) continue;
    const pb = b?.players.find((x) => x.id === p.id);
    applyBodies(v, p.b, pb && pb.alive && pb.b.length === 42 ? pb.b : null, t);
    const hp = v.rig.head.position;
    v.tag.position.set(hp.x, hp.y + 0.85, hp.z);
    const live = latest.players.find((x) => x.id === p.id) || p;
    v.rig.face.open.visible = !live.ko; v.rig.face.ko.visible = live.ko;
    v.stars.visible = live.ko;
    if (live.ko) v.stars.children.forEach((s, i) => { const ang = time * 4 + (i * Math.PI * 2) / 3; s.position.set(Math.cos(ang) * 0.35, Math.sin(time * 6 + i) * 0.05, Math.sin(ang) * 0.35); s.rotation.y = ang; });
    const tp = v.rig.torso.position;
    if (tp.y > mapView.def.killY + 3) { center.add(tp); n++; }
  }
  for (const [id, v] of views) if (!seen.has(id)) { scene.remove(v.rig.root, v.tag); views.delete(id); }

  // objetos do mapa (caixas, trens, gôndolas)
  if (mapView && a.objs) {
    a.objs.forEach((o, i) => {
      const m = mapView.movers[i]; if (!m) return;
      const ob = b?.objs?.[i];
      if (ob && Math.abs(ob[2] - o[2]) < 5) {
        m.position.set(o[0] + (ob[0] - o[0]) * t, o[1] + (ob[1] - o[1]) * t, o[2] + (ob[2] - o[2]) * t);
        qa.set(o[3], o[4], o[5], o[6]); qb.set(ob[3], ob[4], ob[5], ob[6]); m.quaternion.slerpQuaternions(qa, qb, t);
      } else { m.position.set(o[0], o[1], o[2]); m.quaternion.set(o[3], o[4], o[5], o[6]); }
    });
    if (mapView.spokes) {
      const arr = mapView.spokes.geometry.attributes.position.array;
      const c = mapView.def.wheel.center;
      mapView.movers.forEach((m, i) => {
        const j = i * 12;
        arr.set([c[0], c[1], c[2], m.position.x, m.position.y - 0.2, m.position.z - 1.4], j);
        arr.set([c[0], c[1], c[2] + 0.4, m.position.x, m.position.y - 0.2, m.position.z + 1.4], j + 6);
      });
      mapView.spokes.geometry.attributes.position.needsUpdate = true;
    }
  }
  if (mapView) {
    for (const bt of mapView.belts) { bt.tex.offset.y -= (bt.v[2] * dt) / 2; bt.tex.offset.x -= (bt.v[0] * dt) / 2; }
    for (const r of mapView.rollers) r.m.rotation.x += dt * 4 * r.dir;
  }

  // câmera enquadra todo mundo
  if (n) center.multiplyScalar(1 / n); else center.set(0, 0, 0);
  let spread = 0;
  for (const v of views.values()) if (v.rig.root.visible) spread = Math.max(spread, v.rig.torso.position.distanceTo(center));
  camTarget.lerp(center, 1 - Math.exp(-dt * 3));
  const want = (10 + Math.min(spread, 14) * 1.15) * (camera.aspect < 1 ? Math.pow(1 / camera.aspect, 0.6) : 1);
  camDist += (want - camDist) * (1 - Math.exp(-dt * 2));
  camera.position.set(camTarget.x, camTarget.y + camDist * 0.62, camTarget.z + camDist * 0.95);
  if (shake > 0) { camera.position.x += (Math.random() - 0.5) * shake; camera.position.y += (Math.random() - 0.5) * shake; shake = Math.max(0, shake - dt * 1.5); }
  camera.lookAt(camTarget.x, camTarget.y + 0.6, camTarget.z);
  sun.position.set(camTarget.x + 12, camTarget.y + 30, camTarget.z + 8);
  sun.target.position.copy(camTarget);
}

// ================= partículas =================
const parts = [];
const partGeo = new THREE.SphereGeometry(0.07, 6, 4);
function burst(x, y, z, power) {
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(partGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffffff : 0xffe14a, transparent: true }));
    m.position.set(x, y, z);
    m.userData.v = new THREE.Vector3((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6).multiplyScalar(power);
    m.userData.life = 0.45;
    scene.add(m); parts.push(m);
  }
}
function updateParts(dt) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const m = parts[i];
    m.userData.life -= dt;
    m.userData.v.y -= 15 * dt;
    m.position.addScaledVector(m.userData.v, dt);
    m.material.opacity = Math.max(0, m.userData.life / 0.45);
    if (m.userData.life <= 0) { scene.remove(m); m.material.dispose(); parts.splice(i, 1); }
  }
}

// ================= som =================
let actx = null;
function audio() { if (!actx) { try { actx = new AudioContext(); } catch {} } return actx; }
function blip(freq, dur, type = 'sine', vol = 0.2, slide = 0.5) {
  const ac = audio(); if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), ac.currentTime + dur);
  g.gain.setValueAtTime(vol, ac.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination); o.start(); o.stop(ac.currentTime + dur);
}
function thud(power) {
  const ac = audio(); if (!ac) return;
  const len = 0.12, buf = ac.createBuffer(1, ac.sampleRate * len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
  const src = ac.createBufferSource(); src.buffer = buf;
  const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900;
  const g = ac.createGain(); g.gain.value = 0.5 * power;
  src.connect(f).connect(g).connect(ac.destination); src.start();
  blip(140, 0.15, 'sine', 0.35 * power, 0.4);
}

// ================= HUD =================
const feed = $('feed');
function feedMsg(text) {
  const d = document.createElement('div');
  d.textContent = text;
  feed.appendChild(d);
  setTimeout(() => d.remove(), 6000);
  while (feed.children.length > 6) feed.firstChild.remove();
}
function handleEvent(e) {
  if (mode !== 'game') return;
  if (e.type === 'hit') { burst(e.x, e.y, e.z, e.power); thud(Math.min(1.4, e.power)); shake = Math.max(shake, 0.12 * e.power); }
  else if (e.type === 'swing') blip(500, 0.08, 'triangle', 0.05, 0.6);
  else if (e.type === 'grab') blip(300, 0.06, 'square', 0.04, 1.4);
  else if (e.type === 'throw') blip(220, 0.35, 'sawtooth', 0.08, 3);
  else if (e.type === 'ko') { feedMsg(`💫 ${e.name} apagou!`); blip(880, 0.5, 'sine', 0.12, 0.3); }
  else if (e.type === 'out') { feedMsg(`👋 ${e.name} caiu fora!`); blip(600, 0.7, 'triangle', 0.12, 0.2); }
  else if (e.type === 'win') { blip(523, 0.2, 'square', 0.08, 1); setTimeout(() => blip(659, 0.2, 'square', 0.08, 1), 150); setTimeout(() => blip(784, 0.4, 'square', 0.08, 1), 300); }
  else if (e.type === 'join') feedMsg(`➕ ${e.name} entrou`);
  else if (e.type === 'leave') feedMsg(`➖ ${e.name} saiu`);
  else if (e.type === 'chat') feedMsg(`💬 ${e.name}: ${e.text}`);
}

let hudKey = '';
function updateHud() {
  if (!latest) return;
  const s = latest;
  const banner = $('banner');
  banner.textContent = s.msg;
  banner.classList.toggle('small', s.msg.length > 22);
  $('mapname').textContent = MAPS[s.map].name;
  if ($('mapSel').value !== String(s.map)) $('mapSel').value = String(s.map);
  const key = s.players.map((p) => `${p.id}${p.name}${p.color}${p.alive}${p.ko}${p.wins}${Math.round(p.cons / 10)}`).join();
  if (key === hudKey) return;
  hudKey = key;
  const list = $('plist');
  list.innerHTML = '';
  for (const p of [...s.players].sort((x, y) => y.wins - x.wins)) {
    const row = document.createElement('div');
    row.className = 'pl' + (p.alive ? '' : ' out');
    const dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = hex(p.color);
    const name = document.createElement('span'); name.className = 'name';
    name.textContent = `${p.id === myId ? '★ ' : ''}${p.name}  🏆${p.wins}${p.ko ? ' 💫' : ''}`;
    const bar = document.createElement('span'); bar.className = 'bar';
    const fill = document.createElement('i'); fill.style.width = (p.alive ? p.cons : 0) + '%';
    fill.style.background = p.cons > 50 ? '#4ade80' : p.cons > 25 ? '#facc15' : '#ef4444';
    bar.appendChild(fill);
    row.append(dot, name, bar);
    list.appendChild(row);
  }
}

// ================= entrada =================
const keys = new Set();
const mouse = { punch: false, grab: false };
const latch = { jump: 0, punch: 0 };
const touch = { mx: 0, mz: 0, jump: false, punch: false, grab: false, lift: false };
let chatOpen = false;

addEventListener('keydown', (e) => {
  if (mode !== 'game') return;
  if (chatOpen) {
    if (e.key === 'Enter') { const v = $('chatin').value.trim(); if (v) net?.send({ type: 'chat', text: v }); closeChat(); }
    else if (e.key === 'Escape') closeChat();
    return;
  }
  if (e.key === 'Enter') { openChat(); e.preventDefault(); return; }
  if (!e.repeat) {
    if (e.code === 'Space') latch.jump = performance.now() + 90;
    if (e.code === 'KeyJ') latch.punch = performance.now() + 90;
  }
  keys.add(e.code);
  pushInput();
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => { keys.delete(e.code); pushInput(); });
addEventListener('blur', () => { keys.clear(); mouse.grab = mouse.punch = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());
canvas.addEventListener('mousedown', (e) => {
  if (mode !== 'game') return;
  audio();
  if (e.button === 0) latch.punch = performance.now() + 90;
  if (e.button === 2) mouse.grab = true;
  pushInput();
});
addEventListener('mouseup', (e) => { if (e.button === 2) mouse.grab = false; pushInput(); });

// manda a entrada na hora que muda (sem esperar o próximo envio)
let lastSent = '', lastSentT = 0;
function pushInput(force) {
  if (mode !== 'game' || !net || !net.local) return; // online: vai junto com cada passo da previsão
  const i = readInput();
  const k = JSON.stringify(i);
  const now = performance.now();
  if (k === lastSent && !force && now - lastSentT < 100) return;
  lastSent = k; lastSentT = now;
  net.send({ type: 'input', i });
}

function openChat() { chatOpen = true; $('chatbox').classList.remove('hidden'); $('chatin').value = ''; $('chatin').focus(); keys.clear(); }
function closeChat() { chatOpen = false; $('chatbox').classList.add('hidden'); $('chatin').blur(); }

function readInput() {
  const now = performance.now();
  let mx = 0, mz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) mz -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) mz += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) mx -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) mx += 1;
  mx += touch.mx; mz += touch.mz;
  const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
  return {
    mx, mz,
    jump: keys.has('Space') || now < latch.jump || touch.jump,
    punch: keys.has('KeyJ') || now < latch.punch || touch.punch,
    grab: keys.has('KeyK') || mouse.grab || touch.grab,
    lift: keys.has('KeyL') || keys.has('ShiftLeft') || keys.has('ShiftRight') || touch.lift,
  };
}

// controles de toque
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
(() => {
  const stick = $('stick'), knob = $('knob');
  let sid = null, cx = 0, cy = 0;
  stick.addEventListener('pointerdown', (e) => { sid = e.pointerId; const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; stick.setPointerCapture(sid); move(e); audio(); });
  const move = (e) => {
    if (e.pointerId !== sid) return;
    let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy), m = 50;
    if (l > m) { dx *= m / l; dy *= m / l; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    touch.mx = dx / m; touch.mz = dy / m;
  };
  stick.addEventListener('pointermove', move);
  const end = (e) => { if (e.pointerId !== sid) return; sid = null; touch.mx = touch.mz = 0; knob.style.transform = ''; };
  stick.addEventListener('pointerup', end); stick.addEventListener('pointercancel', end);
  for (const b of document.querySelectorAll('#tbtns button')) {
    const k = b.dataset.k;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); b.setPointerCapture(e.pointerId);
      if (k === 'grab' || k === 'lift') { touch[k] = !touch[k]; b.classList.toggle('on', touch[k]); }
      else { touch[k] = true; setTimeout(() => (touch[k] = false), 110); }
    });
  }
})();

// ================= transporte =================
function localTransport() {
  const game = new Game({ mapIndex: Math.floor(Math.random() * MAPS.length) });
  const id = 'eu';
  game.addPlayer(id, me);
  game.addBot(); game.addBot();
  let acc = 0, last = performance.now(), tick = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    acc += Math.min(0.1, (now - last) / 1000); last = now;
    while (acc >= DT) { game.step(); acc -= DT; if (++tick % 2 === 0) onSnapshot(game.snapshot()); }
  }, 8);
  return {
    local: true, id,
    send(m) {
      if (m.type === 'input') game.setInput(id, m.i);
      else if (m.type === 'addBot') game.addBot();
      else if (m.type === 'removeBot') game.removeBot();
      else if (m.type === 'map') game.setMap(+m.map);
      else if (m.type === 'chat') game.event({ type: 'chat', name: me.name, text: m.text });
    },
    close() { clearInterval(timer); },
  };
}

function onlineTransport(room) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + location.pathname.replace(/[^/]*$/, '') + 'ws');
    const t = { local: false, id: null, rtt: null, send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)), close: () => { clearInterval(t.pinger); ws.close(); } };
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'join', room, info: me }));
      t.pinger = setInterval(() => t.send({ type: 'ping', t: performance.now() }), 1500);
    };
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.type === 'welcome') { t.id = m.id; t.room = m.room; resolve(t); }
      else if (m.type === 'full') { reject(new Error('Sala cheia (máximo 6).')); ws.close(); }
      else if (m.type === 'snap') onSnapshot(m.s);
      else if (m.type === 'pong') { const r = (performance.now() - m.t) / 1000; t.rtt = t.rtt == null ? r : t.rtt * 0.8 + r * 0.2; }
    };
    ws.onerror = () => reject(new Error('Não deu pra conectar no servidor.'));
    ws.onclose = () => { if (mode === 'game' && net === t) { feedMsg('Conexão perdida.'); setTimeout(leaveGame, 1500); } };
  });
}

let inputTimer = null;
async function startGame(online) {
  saveInfo();
  if (!me.name.trim()) { $('name').focus(); $('name').placeholder = 'Escolha um nome primeiro!'; return; }
  audio();
  stopAttract();
  snaps = []; latest = null; lastMap = -1; clockOff = null; pred = null;
  for (const v of views.values()) scene.remove(v.rig.root, v.tag);
  views.clear();
  try {
    if (online) {
      const room = $('room').value.trim().toUpperCase() || randomRoom();
      net = await onlineTransport(room);
      history.replaceState(null, '', '?sala=' + net.room);
    } else net = localTransport();
  } catch (err) {
    $('netnote').textContent = err.message;
    startAttract();
    return;
  }
  myId = net.id;
  mode = 'game';
  $('lobby').classList.add('hidden');
  $('hud').classList.remove('hidden');
  $('touch').classList.toggle('hidden', !isTouch);
  $('help').classList.toggle('hidden', isTouch);
  $('invite').classList.toggle('hidden', net.local);
  // online: a física local roda num relógio próprio, sem depender da taxa de quadros
  inputTimer = setInterval(() => (net && !net.local ? pred && predStep() : pushInput()), 1000 / 120);
}

function leaveGame() {
  clearInterval(inputTimer);
  pred = null;
  net?.close(); net = null;
  mode = 'menu';
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  $('lobby').classList.remove('hidden');
  for (const v of views.values()) scene.remove(v.rig.root, v.tag);
  views.clear();
  startAttract();
}

// ================= lobby =================
function randomRoom() { return Math.random().toString(36).slice(2, 7).toUpperCase(); }
function saveInfo() { me.name = $('name').value.trim().slice(0, 16); store.set('info', me); refreshPreview(); }

function chips(el, list, key) {
  el.innerHTML = '';
  for (const [id, label] of list) {
    const b = document.createElement('button');
    b.className = 'chip' + (me[key] === id ? ' on' : '');
    b.textContent = label;
    b.onclick = () => { me[key] = id; chips(el, list, key); saveInfo(); };
    el.appendChild(b);
  }
}
function swatches() {
  const el = $('colors');
  el.innerHTML = '';
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.className = 'sw' + (me.color === c ? ' on' : '');
    b.style.background = hex(c);
    b.setAttribute('aria-label', 'cor ' + hex(c));
    b.onclick = () => { me.color = c; swatches(); saveInfo(); };
    el.appendChild(b);
  }
}
$('name').value = me.name;
$('name').addEventListener('input', saveInfo);
swatches();
chips($('hats'), HATS, 'hat');
chips($('eyes'), EYES, 'eyes');
chips($('accs'), ACCS, 'acc');
const params = new URLSearchParams(location.search);
$('room').value = (params.get('sala') || randomRoom()).toUpperCase();
$('playOnline').onclick = () => startGame(true);
$('playLocal').onclick = () => startGame(false);
$('botAdd').onclick = () => net?.send({ type: 'addBot' });
$('botDel').onclick = () => net?.send({ type: 'removeBot' });
$('leave').onclick = leaveGame;
$('invite').onclick = async () => {
  const url = location.origin + location.pathname + '?sala=' + (net?.room || '');
  try { await navigator.clipboard.writeText(url); feedMsg('Link da sala copiado! Mande pros amigos.'); } catch { feedMsg(url); }
};
const mapSel = $('mapSel');
MAPS.forEach((m, i) => { const o = document.createElement('option'); o.value = i; o.textContent = '🗺 ' + m.name; mapSel.appendChild(o); });
mapSel.onchange = () => { net?.send({ type: 'map', map: +mapSel.value }); mapSel.blur(); };

// o online só existe quando a página vem do nosso servidor
fetch('./api/ping', { cache: 'no-store' }).then((r) => r.ok ? r.json() : Promise.reject()).then(() => {
  $('netnote').textContent = 'Mande o link com ?sala=CÓDIGO pros amigos entrarem na mesma sala.';
}).catch(() => {
  $('playOnline').disabled = true;
  $('netnote').textContent = 'Modo online desligado nesta versão de demonstração (precisa do servidor). Treine contra os bots!';
});

// prévia do boneco + partida de fundo com bots
const preview = { scene: new THREE.Scene(), cam: new THREE.PerspectiveCamera(30, 1, 0.1, 50), rig: null, holder: new THREE.Group() };
preview.scene.add(new THREE.HemisphereLight(0xffffff, 0x8866aa, 1.4));
const pl = new THREE.DirectionalLight(0xffffff, 2.2); pl.position.set(2, 4, 5); preview.scene.add(pl);
preview.scene.add(preview.holder);
const ped = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.1, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0xffc531, roughness: 0.4 }));
ped.position.y = -1.55; preview.holder.add(ped);
preview.cam.position.set(0, 0.6, 7.2); preview.cam.lookAt(0, -0.1, 0);
function refreshPreview() {
  const k = infoKey(me);
  if (preview.key === k) return;
  preview.key = k;
  if (preview.rig) preview.holder.remove(preview.rig.root);
  preview.rig = makeCharacter(me);
  poseRest(preview.rig);
  preview.rig.armL.rotation.z = 0.5; preview.rig.armL.position.x += 0.12;
  preview.rig.armR.rotation.z = -0.5; preview.rig.armR.position.x -= 0.12;
  preview.holder.add(preview.rig.root);
}
refreshPreview();

let attract = null;
function startAttract() {
  if (attract) return;
  const game = new Game({ mapIndex: Math.floor(Math.random() * MAPS.length) });
  for (let i = 0; i < 4; i++) game.addBot();
  snaps = []; lastMap = -1; clockOff = null; myId = null;
  attract = { game, acc: 0, tick: 0, last: performance.now() };
}
function stopAttract() {
  attract = null;
  for (const v of views.values()) scene.remove(v.rig.root, v.tag);
  views.clear();
}
function stepAttract() {
  const now = performance.now();
  attract.acc += Math.min(0.1, (now - attract.last) / 1000); attract.last = now;
  while (attract.acc >= DT) { attract.game.step(); attract.acc -= DT; if (++attract.tick % 2 === 0) onSnapshot(attract.game.snapshot()); }
}
startAttract();

// ================= laço principal =================
let lastT = performance.now();
function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const time = now / 1000;
  if (mode === 'menu' && attract) stepAttract();
  renderGame(dt, time);
  updateParts(dt);
  if (mode === 'game') updateHud();
  for (const v of views.values()) v.tag.visible = v.tag.visible && mode === 'game';

  const w = innerWidth, h = innerHeight;
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, w, h);
  renderer.render(scene, camera);

  if (mode === 'menu') {
    // prévia do boneco à direita (ou em cima no celular)
    const narrow = w <= 640;
    const pw = narrow ? w : Math.min(w * 0.42, 520), ph = narrow ? h * 0.3 : Math.min(h * 0.8, 640);
    const px = narrow ? 0 : w - pw - w * 0.05, py = narrow ? h - ph : (h - ph) / 2;
    if (!narrow || h > 500) {
      const y = h - py - ph;
      renderer.setScissorTest(true);
      renderer.setScissor(px, y, pw, ph);
      renderer.setViewport(px, y, pw, ph);
      renderer.clearDepth();
      preview.cam.aspect = pw / ph; preview.cam.updateProjectionMatrix();
      preview.holder.rotation.y = Math.sin(time * 0.8) * 0.6;
      if (preview.rig) {
        preview.rig.head.rotation.z = Math.sin(time * 2.2) * 0.08;
        preview.rig.root.position.y = Math.abs(Math.sin(time * 2.2)) * 0.08;
      }
      const autoClear = renderer.autoClear; renderer.autoClear = false;
      renderer.render(preview.scene, preview.cam);
      renderer.autoClear = autoClear;
      renderer.setScissorTest(false);
    }
  }
}
frame();
window.__pm = { get pred() { return pred; }, get latest() { return latest; }, get myId() { return myId; } };

// ================= abertura (logo + carregamento) =================
(() => {
  const sp = $('splash');
  for (let i = 0; i < 18; i++) {
    const b = document.createElement('div');
    b.className = 'bub';
    const size = 20 + Math.random() * 70;
    Object.assign(b.style, { width: size + 'px', height: size + 'px', left: Math.random() * 100 + '%', animationDuration: 4 + Math.random() * 5 + 's', animationDelay: -Math.random() * 6 + 's' });
    b.style.setProperty('--dx', (Math.random() - 0.5) * 120 + 'px');
    sp.appendChild(b);
  }
  const tips = ['Enchendo os bonecos de gelatina…', 'Amolecendo os braços…', 'Encerando as beiradas do mapa…', 'Ensinando a cair com estilo…', 'Pronto pra pancadaria!'];
  const DUR = 3000, t0 = performance.now();
  let done = false;
  const finish = () => {
    if (done) return; done = true;
    sp.classList.add('bye');
    $('lobby').classList.remove('hidden');
    setTimeout(() => sp.remove(), 700);
  };
  const tick = () => {
    if (done) return;
    const k = Math.min(1, (performance.now() - t0) / DUR);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    const pct = Math.round(e * 100);
    $('fill').style.width = pct + '%';
    $('runner').style.left = pct + '%';
    $('pct').textContent = pct + '%';
    $('tip').textContent = tips[Math.min(tips.length - 1, Math.floor(k * tips.length))];
    if (k >= 1) setTimeout(finish, 350); else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  sp.addEventListener('click', () => { audio(); });
})();
