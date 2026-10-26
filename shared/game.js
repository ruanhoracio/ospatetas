// Simulação do jogo (física + regras). Roda no servidor (online) ou no navegador (treino com bots).
import * as CANNON from 'cannon-es';
import { MAPS } from './maps.js';

export const DT = 1 / 60;
export const MAX_PLAYERS = 6;
const GRAV = 22;
const HOVER = 1.38;
const SPEED = 5.2;
const MAX_V = 24;
const G_STATIC = 1, G_OBJ = 2;
const ALL = 0xffff;

const V = (x = 0, y = 0, z = 0) => new CANNON.Vec3(x, y, z);
const UP = V(0, 1, 0);
const HAND = V(0, -0.36, 0);
const FOOT = V(0, -0.35, 0);
const SHOULDER = { L: V(0.5, 0.32, 0), R: V(-0.5, 0.32, 0) };
const HIP = { L: V(0.2, -0.5, 0), R: V(-0.2, -0.5, 0) };
const PARTS = ['torso', 'head', 'armL', 'armR', 'legL', 'legR'];

const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const r3 = (n) => Math.round(n * 1000) / 1000;

function capsule(body, r, ys) { for (const y of ys) body.addShape(new CANNON.Sphere(r), V(0, y, 0)); }

class Player {
  constructor(id, info, slot, isBot) {
    this.id = id;
    this.slot = slot;
    this.isBot = isBot;
    this.setInfo(info);
    this.wins = 0;
    this.alive = false;
    this.bodies = null;
    this.input = { mx: 0, mz: 0, jump: false, punch: false, grab: false, lift: false };
    this.prev = { jump: false, punch: false, grab: false };
    this.group = 1 << (slot + 2);
    this.respawnT = 0;
    this.bot = isBot ? { t: 0, grabT: 0, holdT: 0, wander: Math.random() * 6 } : null;
  }
  setInfo(info = {}) {
    this.name = String(info.name || 'Boneco').slice(0, 16);
    this.color = Number.isFinite(info.color) ? info.color : 0xf97316;
    this.hat = String(info.hat || 'nenhum').slice(0, 16);
    this.eyes = String(info.eyes || 'normal').slice(0, 16);
    this.acc = String(info.acc || 'nenhum').slice(0, 16);
  }
  resetState() {
    this.cons = 100; this.koT = 0; this.lastHit = -10;
    this.punchT = 0; this.punchCd = 0; this.punchArm = 'L'; this.punchHit = false;
    this.grab = { L: null, R: null };
    this.facing = 0; this.phase = 0; this.airT = 0; this.stunT = 0; this.heldT = 0; this.lifting = false; this.grounded = false;
  }
}

export class Game {
  constructor(opts = {}) {
    this.mapIndex = opts.mapIndex ?? 0;
    this.players = new Map();
    this.time = 0;
    this.state = 'lobby'; // lobby | round | end
    this.stateT = 0;
    this.msg = '';
    this.events = [];
    this.botN = 0;
    this.buildWorld();
  }

  // ---------- mundo ----------
  get map() { return MAPS[this.mapIndex]; }

  buildWorld() {
    const w = new CANNON.World({ gravity: V(0, -GRAV, 0) });
    w.broadphase = new CANNON.SAPBroadphase(w);
    w.solver.iterations = 12;
    w.defaultContactMaterial.friction = 0.2;
    w.defaultContactMaterial.restitution = 0.05;
    this.world = w;
    this.mapT = 0;
    this.objects = [];
    for (const s of this.map.statics) {
      const b = new CANNON.Body({ mass: 0, collisionFilterGroup: G_STATIC, collisionFilterMask: ALL });
      b.addShape(new CANNON.Box(V(s.s[0] / 2, s.s[1] / 2, s.s[2] / 2)));
      b.position.set(...s.p);
      if (s.r) b.quaternion.setFromEuler(...s.r);
      if (s.conveyor) b.conveyor = V(...s.conveyor);
      b.isStatic = true;
      w.addBody(b);
    }
    for (const o of this.map.objects) {
      let b;
      if (o.type === 'crate') {
        b = new CANNON.Body({ mass: o.mass, collisionFilterGroup: G_OBJ, collisionFilterMask: ALL, linearDamping: 0.05, angularDamping: 0.1 });
        b.position.set(...o.p);
      } else {
        b = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, collisionFilterGroup: G_OBJ, collisionFilterMask: ALL });
        b.position.set(...o.path(0));
        b.path = o.path;
        b.hazard = !!o.hazard;
      }
      b.addShape(new CANNON.Box(V(o.s[0] / 2, o.s[1] / 2, o.s[2] / 2)));
      w.addBody(b);
      this.objects.push(b);
    }
  }

  spawn(p) {
    const sp = this.map.spawns[p.slot % this.map.spawns.length];
    const pos = V(sp[0], sp[1], sp[2]);
    const yaw = Math.atan2(-sp[0], -sp[2]) || 0; // olhando pro centro
    const q = new CANNON.Quaternion(); q.setFromAxisAngle(UP, yaw);
    const mk = (mass, local, part) => {
      const b = new CANNON.Body({ mass, collisionFilterGroup: p.group, collisionFilterMask: ALL & ~p.group, linearDamping: 0.05, angularDamping: 0.4 });
      b.position.copy(pos.vadd(q.vmult(local)));
      b.quaternion.copy(q);
      b.owner = p; b.part = part;
      return b;
    };
    const torso = mk(10, V(), 'torso'); capsule(torso, 0.4, [-0.2, 0.2]);
    const head = mk(2.5, V(0, 0.92, 0), 'head'); head.addShape(new CANNON.Sphere(0.3));
    const armL = mk(1.5, V(0.5, -0.04, 0), 'armL'); capsule(armL, 0.13, [0.25, 0, -0.25]); armL.addShape(new CANNON.Sphere(0.15), V(0, -0.33, 0));
    const armR = mk(1.5, V(-0.5, -0.04, 0), 'armR'); capsule(armR, 0.13, [0.25, 0, -0.25]); armR.addShape(new CANNON.Sphere(0.15), V(0, -0.33, 0));
    const legL = mk(2, V(0.2, -0.85, 0), 'legL'); capsule(legL, 0.15, [0.2, -0.05]); legL.addShape(new CANNON.Sphere(0.17), V(0, -0.33, 0.04));
    const legR = mk(2, V(-0.2, -0.85, 0), 'legR'); capsule(legR, 0.15, [0.2, -0.05]); legR.addShape(new CANNON.Sphere(0.17), V(0, -0.33, 0.04));
    const bodies = { torso, head, armL, armR, legL, legR };
    const cons = [
      new CANNON.ConeTwistConstraint(torso, head, { pivotA: V(0, 0.6, 0), pivotB: V(0, -0.32, 0), axisA: V(0, 1, 0), axisB: V(0, 1, 0), angle: 0.5, twistAngle: 0.4 }),
      new CANNON.PointToPointConstraint(torso, SHOULDER.L, armL, V(0, 0.36, 0)),
      new CANNON.PointToPointConstraint(torso, SHOULDER.R, armR, V(0, 0.36, 0)),
      new CANNON.ConeTwistConstraint(torso, legL, { pivotA: HIP.L, pivotB: V(0, 0.35, 0), axisA: V(0, -1, 0), axisB: V(0, -1, 0), angle: 1.1, twistAngle: 0.3 }),
      new CANNON.ConeTwistConstraint(torso, legR, { pivotA: HIP.R, pivotB: V(0, 0.35, 0), axisA: V(0, -1, 0), axisB: V(0, -1, 0), angle: 1.1, twistAngle: 0.3 }),
    ];
    for (const b of Object.values(bodies)) this.world.addBody(b);
    for (const c of cons) this.world.addConstraint(c);
    p.bodies = bodies; p.joints = cons;
    p.mass = 19;
    p.resetState();
    p.facing = yaw;
    p.alive = true;
  }

  despawn(p) {
    if (!p.bodies) return;
    this.release(p, 'L'); this.release(p, 'R');
    const set = new Set(Object.values(p.bodies));
    for (const o of this.players.values()) for (const s of ['L', 'R']) if (o.grab?.[s] && set.has(o.grab[s].bodyB)) this.release(o, s);
    for (const c of p.joints) this.world.removeConstraint(c);
    for (const b of set) this.world.removeBody(b);
    p.bodies = null; p.alive = false;
  }

  // ---------- jogadores ----------
  addPlayer(id, info, isBot = false) {
    if (this.players.size >= MAX_PLAYERS) return null;
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const p = new Player(id, info, slot, isBot);
    this.players.set(id, p);
    if (this.state !== 'round') this.spawn(p);
    this.event({ type: 'join', name: p.name });
    return p;
  }

  addBot() {
    const names = ['Gelatina', 'Pudim', 'Marshmallow', 'Chiclete', 'Biscoito', 'Torresmo', 'Paçoca', 'Bolacha'];
    const colors = [0x22c55e, 0x3b82f6, 0xeab308, 0xec4899, 0x8b5cf6, 0x14b8a6, 0xef4444];
    const hats = ['nenhum', 'bone', 'cartola', 'coroa', 'gorro', 'chifres', 'cone'];
    const n = this.botN++;
    return this.addPlayer('bot' + n, { name: names[n % names.length] + ' (bot)', color: colors[n % colors.length], hat: hats[(n * 3 + 1) % hats.length], eyes: ['normal', 'bravo', 'sono'][n % 3] }, true);
  }

  removeBot() {
    const bots = [...this.players.values()].filter((p) => p.isBot);
    if (bots.length) this.removePlayer(bots[bots.length - 1].id);
  }

  removePlayer(id) {
    const p = this.players.get(id);
    if (!p) return;
    this.despawn(p);
    this.players.delete(id);
    this.event({ type: 'leave', name: p.name });
  }

  setInput(id, i) {
    const p = this.players.get(id);
    if (!p || p.isBot || !i) return;
    const mx = +i.mx || 0, mz = +i.mz || 0;
    const l = Math.hypot(mx, mz);
    p.input.mx = l > 1 ? mx / l : mx; p.input.mz = l > 1 ? mz / l : mz;
    // guarda o toque mesmo se apertar e soltar entre dois passos da física
    if (i.jump && !p.input.jump) p.jumpQ = true;
    if (i.punch && !p.input.punch) p.punchQ = true;
    p.input.jump = !!i.jump; p.input.punch = !!i.punch; p.input.grab = !!i.grab; p.input.lift = !!i.lift;
  }

  event(e) { this.events.push(e); if (this.events.length > 40) this.events.shift(); }

  // ---------- rodadas ----------
  resetRound(nextMap) {
    for (const p of this.players.values()) this.despawn(p);
    if (nextMap) this.mapIndex = (this.mapIndex + 1) % MAPS.length;
    this.buildWorld();
    for (const p of this.players.values()) this.spawn(p);
  }

  setMap(i) {
    if (!(i >= 0 && i < MAPS.length)) return;
    this.mapIndex = i;
    this.resetRound(false);
    this.state = 'lobby';
    this.msg = '';
  }

  rules(dt) {
    const ps = [...this.players.values()];
    this.stateT -= dt;
    if (this.state === 'lobby') {
      this.msg = ps.length < 2 ? 'Aguardando mais jogadores… (adicione bots para treinar)' : '';
      for (const p of ps) if (!p.alive) { p.respawnT -= dt; if (p.respawnT <= 0) this.spawn(p); }
      if (ps.length >= 2) {
        this.resetRound(false);
        this.state = 'round';
        this.stateT = 0;
        this.msg = 'BRIGA!';
        this.event({ type: 'start', map: this.map.name });
      }
    } else if (this.state === 'round') {
      if (this.stateT < -2) this.msg = '';
      const alive = ps.filter((p) => p.alive);
      if (ps.length < 2) { this.state = 'lobby'; return; }
      if (alive.length <= 1) {
        const w = alive[0];
        if (w) { w.wins++; this.msg = `${w.name} venceu!`; this.event({ type: 'win', name: w.name }); }
        else this.msg = 'Empate!';
        this.state = 'end';
        this.stateT = 4;
      }
    } else if (this.state === 'end') {
      if (this.stateT <= 0) {
        this.resetRound(true);
        this.state = ps.length >= 2 ? 'round' : 'lobby';
        this.stateT = 0;
        this.msg = this.state === 'round' ? 'BRIGA!' : '';
        this.event({ type: 'start', map: this.map.name });
      }
    }
  }

  // ---------- passo de simulação ----------
  step() {
    const dt = DT;
    this.time += dt;
    this.mapT += dt;
    for (const b of this.objects) {
      if (!b.path) continue;
      const tgt = b.path(this.mapT + dt);
      const dx = tgt[0] - b.position.x, dy = tgt[1] - b.position.y, dz = tgt[2] - b.position.z;
      if (dx * dx + dy * dy + dz * dz > 25) {
        b.position.set(...tgt);
        const n = b.path(this.mapT + dt * 2);
        b.velocity.set((n[0] - tgt[0]) / dt, (n[1] - tgt[1]) / dt, (n[2] - tgt[2]) / dt);
      } else b.velocity.set(dx / dt, dy / dt, dz / dt);
    }
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      if (p.isBot) this.botThink(p, dt);
      this.control(p, dt);
    }
    this.world.step(dt);
    this.contacts();
    this.safety();
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      p.prev.jump = p.input.jump; p.prev.punch = p.input.punch; p.prev.grab = p.input.grab;
      const t = p.bodies.torso.position;
      if (t.y < this.map.killY || Math.abs(t.x) > this.map.bound || Math.abs(t.z) > this.map.bound || !isFinite(t.y) || p.badState) {
        p.badState = false;
        this.event({ type: 'out', name: p.name });
        this.despawn(p);
        p.respawnT = 2;
      }
    }
    this.rules(dt);
  }

  control(p, dt) {
    const B = p.bodies, t = B.torso;
    p.punchT -= dt; p.punchCd -= dt; p.airT -= dt; p.stunT -= dt; p.heldT -= dt;
    if (p.koT > 0) {
      p.koT -= dt;
      if (p.koT <= 0) { p.cons = 55; this.event({ type: 'wake', name: p.name }); }
      this.release(p, 'L'); this.release(p, 'R');
      return;
    }
    if (this.time - p.lastHit > 2) p.cons = Math.min(100, p.cons + 10 * dt);
    const limp = p.stunT > 0 || p.heldT > 0;

    const inp = p.input;
    // chão
    const ray = new CANNON.RaycastResult();
    const from = t.position.clone();
    const to = from.vadd(V(0, -2.4, 0));
    this.world.raycastClosest(from, to, { collisionFilterMask: ALL & ~p.group, skipBackfaces: true }, ray);
    const dist = ray.hasHit ? ray.distance : 99;
    p.grounded = ray.hasHit && dist < HOVER + 0.3 && p.airT <= 0;
    const gv = V();
    if (p.grounded && ray.body) {
      gv.copy(ray.body.velocity);
      if (ray.body.conveyor) gv.vadd(ray.body.conveyor, gv);
    }

    const mv = V(inp.mx, 0, inp.mz);
    const moving = mv.length() > 0.15;
    if (moving) p.facing = Math.atan2(mv.x, mv.z);
    const holding = !!(p.grab.L?.bodyB.owner || p.grab.R?.bodyB.owner || p.grab.L?.bodyB.mass || p.grab.R?.bodyB.mass);

    let load = p.mass;
    if (inp.grab && inp.lift) {
      const seen = new Set();
      for (const sd of ['L', 'R']) {
        const ob = p.grab[sd]?.bodyB;
        if (!ob || ob.mass === 0) continue;
        const key = ob.owner || ob;
        if (!seen.has(key)) { seen.add(key); load += ob.owner ? ob.owner.mass : ob.mass; }
      }
    }
    if (p.grounded && !limp) {
      const err = HOVER - dist;
      const vy = t.velocity.y - gv.y;
      const f = Math.max(0, Math.min(load * GRAV * 2.5, load * (GRAV + err * 110 - vy * 13)));
      t.force.y += f;
    }
    const sp = holding ? SPEED * 0.75 : SPEED;
    const k = limp ? 0.01 : p.grounded ? 0.2 : 0.045;
    t.velocity.x += (gv.x + mv.x * sp - t.velocity.x) * k;
    t.velocity.z += (gv.z + mv.z * sp - t.velocity.z) * k;
    const jumpNow = p.jumpQ || (inp.jump && !p.prev.jump); p.jumpQ = false;
    if (jumpNow && p.grounded) {
      t.velocity.y = 8.6 + Math.max(0, gv.y);
      B.head.velocity.y = 7;
      p.airT = 0.3;
      p.grounded = false;
    }

    // manter em pé + girar pra direção
    const up = t.quaternion.vmult(UP);
    const fwdB = t.quaternion.vmult(V(0, 0, 1));
    const lean = moving ? 0.12 : 0;
    const desUp = V(mv.x * lean, 1, mv.z * lean); desUp.normalize();
    const axis = up.cross(desUp);
    const s = axis.length();
    const ang = Math.asin(Math.min(1, s));
    if (s > 1e-5) axis.scale(1 / s, axis);
    const yawErr = wrap(p.facing - Math.atan2(fwdB.x, fwdB.z));
    const wDes = axis.scale(ang * 13).vadd(V(0, yawErr * 9, 0));
    const a = 0.3;
    t.angularVelocity.x += (wDes.x - t.angularVelocity.x) * a;
    t.angularVelocity.y += (wDes.y - t.angularVelocity.y) * a;
    t.angularVelocity.z += (wDes.z - t.angularVelocity.z) * a;
    // cabeça molinha
    const hup = B.head.quaternion.vmult(UP);
    const hax = hup.cross(UP);
    B.head.angularVelocity.vadd(hax.scale(0.6), B.head.angularVelocity);

    const fwd = V(Math.sin(p.facing), 0, Math.cos(p.facing));
    const left = V(Math.cos(p.facing), 0, -Math.sin(p.facing));

    // pernas (andar molenga)
    const hv = Math.hypot(t.velocity.x - gv.x, t.velocity.z - gv.z);
    if (p.grounded && hv > 0.6) p.phase += dt * (5 + hv * 1.6);
    for (const side of ['L', 'R']) {
      const leg = B['leg' + side];
      const hip = t.pointToWorldFrame(HIP[side]);
      const off = side === 'L' ? 0 : Math.PI;
      let tgt;
      if (p.grounded && hv > 0.6) {
        const sw = Math.sin(p.phase + off);
        const lift = Math.max(0, Math.cos(p.phase + off));
        const dir = V(t.velocity.x - gv.x, 0, t.velocity.z - gv.z); dir.normalize();
        tgt = hip.vadd(V(0, -0.72 + lift * 0.25, 0)).vadd(dir.scale(sw * 0.4));
      } else if (!p.grounded) {
        tgt = hip.vadd(V(0, -0.6, 0)).vadd(fwd.scale(0.25 + (side === 'L' ? 0.1 : -0.1)));
      } else {
        tgt = hip.vadd(V(0, -0.72, 0)).vadd(left.scale(side === 'L' ? 0.06 : -0.06));
      }
      this.limbForce(leg, FOOT, tgt, 90, 1.0, 700, t.velocity, t, hip);
    }

    // soco
    const punchNow = p.punchQ || (inp.punch && !p.prev.punch); p.punchQ = false;
    if (punchNow && p.punchCd <= 0) {
      let arm = p.punchArm === 'L' ? 'R' : 'L';
      if (p.grab[arm] && !p.grab[arm === 'L' ? 'R' : 'L']) arm = arm === 'L' ? 'R' : 'L';
      if (!p.grab[arm]) {
        this.release(p, arm);
        p.punchArm = arm; p.punchT = 0.2; p.punchCd = 0.36; p.punchHit = false;
        t.velocity.vadd(fwd.scale(1.6), t.velocity);
        this.event({ type: 'swing' });
      }
    }

    // agarrar / soltar / arremessar
    if (inp.grab) p.lifting = inp.lift;
    if (!inp.grab && p.prev.grab) {
      const thrown = new Set();
      for (const side of ['L', 'R']) {
        const g = p.grab[side];
        if (g && p.lifting) {
          const ob = g.bodyB;
          const target = ob.owner ? Object.values(ob.owner.bodies || {}) : [ob];
          const key = ob.owner || ob;
          if (!thrown.has(key) && ob.mass > 0) {
            thrown.add(key);
            const imp = fwd.scale(11).vadd(V(0, 7.5, 0));
            for (const b of target) b.velocity.vadd(imp, b.velocity);
            if (ob.owner) { ob.owner.stunT = 1.0; ob.owner.airT = 0.5; }
            this.event({ type: 'throw' });
          }
        }
        this.release(p, side);
      }
      p.lifting = false;
    }

    for (const side of ['L', 'R']) {
      const arm = B['arm' + side];
      const sh = t.pointToWorldFrame(SHOULDER[side]);
      const sv = left.scale(side === 'L' ? 1 : -1);
      if (p.punchT > 0 && p.punchArm === side) {
        this.limbForce(arm, HAND, sh.vadd(fwd.scale(1.15)).vadd(V(0, 0.15, 0)), 450, 0.7, 1400, t.velocity, t, sh);
      } else if (inp.grab) {
        const tgt = inp.lift
          ? sh.vadd(V(0, 0.75, 0)).vadd(fwd.scale(0.35)).vadd(sv.scale(-0.12))
          : sh.vadd(fwd.scale(0.72)).vadd(sv.scale(-0.18)).vadd(V(0, 0.05, 0));
        this.limbForce(arm, HAND, tgt, p.grab[side] ? 650 : 160, 0.8, p.grab[side] ? 1800 : 700, t.velocity, t, sh);
        const ow = p.grab[side]?.bodyB.owner;
        if (ow && inp.lift) ow.heldT = 0.15;
      } else {
        this.limbForce(arm, HAND, sh.vadd(V(0, -0.62, 0)).vadd(sv.scale(0.14)).vadd(fwd.scale(0.06)), 30, 1.0, 200, t.velocity, t, sh);
      }
    }
  }

  // força interna: puxa o membro e empurra o tronco ao contrário (sem "força mágica" que faz voar)
  safety() {
    for (const p of this.players.values()) {
      if (!p.alive) continue;
      // solta pegada que esticou demais (evita estilingue)
      for (const sd of ['L', 'R']) {
        const g = p.grab[sd];
        if (!g) continue;
        const wa = g.bodyA.pointToWorldFrame(g.pivotA), wb = g.bodyB.pointToWorldFrame(g.pivotB);
        if (wa.distanceTo(wb) > 0.55) this.release(p, sd);
      }
      for (const b of Object.values(p.bodies)) {
        if (!isFinite(b.position.x + b.position.y + b.position.z + b.velocity.x + b.velocity.y + b.velocity.z)) { p.badState = true; continue; }
        const v = b.velocity.length();
        if (v > MAX_V) b.velocity.scale(MAX_V / v, b.velocity);
        const w = b.angularVelocity.length();
        if (w > 30) b.angularVelocity.scale(30 / w, b.angularVelocity);
      }
    }
  }

  limbForce(body, localPt, target, k, damp, fmax, ref, anchor, anchorPt) {
    const w = body.pointToWorldFrame(localPt);
    const r = w.vsub(body.position);
    let v = body.velocity.vadd(body.angularVelocity.cross(r));
    if (ref) v = v.vsub(ref);
    const m = body.mass;
    const c = 2 * Math.sqrt(k) * damp;
    const f = target.vsub(w).scale(k * m).vsub(v.scale(c * m));
    const l = f.length();
    if (l > fmax) f.scale(fmax / l, f);
    body.applyForce(f, r);
    if (anchor) anchor.applyForce(f.negate(), anchorPt.vsub(anchor.position));
  }

  release(p, side) {
    const g = p.grab?.[side];
    if (!g) return;
    this.world.removeConstraint(g);
    p.grab[side] = null;
  }

  contacts() {
    for (const c of this.world.contacts) {
      this.touch(c.bi, c.bj, c.ri);
      this.touch(c.bj, c.bi, c.rj);
    }
  }

  touch(a, b, ra) {
    if (a.conveyor && b.mass > 0 && !(b.owner && b.owner.koT <= 0 && b.part === 'torso')) {
      b.velocity.x += (a.conveyor.x - b.velocity.x) * 0.04;
      b.velocity.z += (a.conveyor.z - b.velocity.z) * 0.04;
    }
    if (a.hazard && b.owner && b.owner.alive && (b.part === 'torso' || b.part === 'head')) {
      const q = b.owner;
      if (q.koT <= 0 && a.velocity.length() > 6) {
        q.koT = 3; q.cons = 0; this.event({ type: 'ko', name: q.name });
        this.event({ type: 'hit', x: r3(b.position.x), y: r3(b.position.y), z: r3(b.position.z), power: 2 });
      }
    }
    const p = a.owner;
    if (!p || !p.alive || (a.part !== 'armL' && a.part !== 'armR')) return;
    if (b.owner === p) return;
    const side = a.part === 'armL' ? 'L' : 'R';
    const cp = a.position.vadd(ra);
    const hw = a.pointToWorldFrame(HAND);
    if (cp.distanceTo(hw) > 0.34) return;

    if (p.punchT > 0 && p.punchArm === side && !p.punchHit && b.owner && b.owner.alive) {
      const hv = a.velocity.vadd(a.angularVelocity.cross(hw.vsub(a.position)));
      const rel = hv.vsub(b.velocity).length();
      if (rel > 2.5) this.hit(p, b, Math.min(1.5, Math.max(0.7, rel / 8)));
      return;
    }
    if (p.input.grab && p.koT <= 0 && !p.grab[side] && !(p.punchT > 0 && p.punchArm === side)) {
      const pivB = b.pointToLocalFrame(cp);
      const g = new CANNON.PointToPointConstraint(a, HAND, b, pivB, 1200);
      g.bodyB = b;
      this.world.addConstraint(g);
      p.grab[side] = g;
      this.event({ type: 'grab' });
    }
  }

  hit(p, b, power) {
    p.punchHit = true;
    const q = b.owner;
    const dmg = (b.part === 'head' ? 34 : b.part === 'torso' ? 24 : 10) * power;
    q.stunT = Math.max(q.stunT, 0.3);
    const fwd = V(Math.sin(p.facing), 0, Math.cos(p.facing));
    b.velocity.vadd(fwd.scale(b.part === 'head' ? 6 : 4).vadd(V(0, 1.2, 0)), b.velocity);
    q.bodies.torso.velocity.vadd(fwd.scale(2 * power), q.bodies.torso.velocity);
    q.lastHit = this.time;
    this.event({ type: 'hit', x: r3(b.position.x), y: r3(b.position.y), z: r3(b.position.z), power: r3(power) });
    if (q.koT > 0) { q.koT = Math.min(6, q.koT + 0.4); return; }
    q.cons -= dmg;
    if (q.cons <= 0) {
      q.cons = 0; q.koT = 3.5 + Math.random();
      this.event({ type: 'ko', name: q.name });
    }
  }

  // ---------- bots ----------
  groundAhead(p, dir, dist = 1.6) {
    const t = p.bodies.torso.position;
    const from = V(t.x + dir.x * dist, t.y + 0.5, t.z + dir.z * dist);
    const ray = new CANNON.RaycastResult();
    this.world.raycastClosest(from, from.vadd(V(0, -5, 0)), { collisionFilterMask: G_STATIC | G_OBJ }, ray);
    return ray.hasHit && !ray.body?.hazard;
  }

  botThink(p, dt) {
    const bt = p.bot, inp = p.input;
    bt.t -= dt;
    inp.jump = false;
    if (p.koT > 0) { inp.grab = false; inp.mx = inp.mz = 0; return; }
    const me = p.bodies.torso.position;
    let best = null, bd = 1e9;
    for (const o of this.players.values()) {
      if (o === p || !o.alive) continue;
      const d = o.bodies.torso.position.distanceTo(me);
      if (d < bd) { bd = d; best = o; }
    }
    const holding = (p.grab.L && p.grab.L.bodyB.owner) || (p.grab.R && p.grab.R.bodyB.owner);
    let dir = V();
    if (holding) {
      bt.holdT += dt;
      inp.grab = true; inp.lift = bt.holdT > 0.4;
      dir = V(me.x, 0, me.z); if (dir.length() < 0.5) dir.set(Math.sin(bt.wander), 0, Math.cos(bt.wander));
      dir.normalize();
      if (!this.groundAhead(p, dir, 1.2) || bt.holdT > 3.5) { inp.grab = false; bt.holdT = 0; bt.grabT = 1.2; }
    } else {
      bt.holdT = 0;
      bt.grabT -= dt;
      if (best) {
        const tp = best.bodies.torso.position;
        dir = V(tp.x - me.x, 0, tp.z - me.z);
        const d = dir.length(); dir.normalize();
        if (d < 1.0) dir.scale(0.3, dir);
        const close = d < 1.6;
        inp.grab = close && bt.grabT <= 0 && (inp.grab || best.koT > 0 || Math.random() < 0.05);
        inp.lift = false;
        inp.punch = close && !inp.grab && bt.t <= 0 ? !inp.punch : false;
        if (bt.t <= 0) bt.t = 0.25 + Math.random() * 0.35;
        if (inp.grab && bt.grabT < -2.5) { inp.grab = false; bt.grabT = 1; }
      } else {
        bt.wander += dt * 0.5;
        dir = V(Math.sin(bt.wander), 0, Math.cos(bt.wander)).scale(0.4);
        inp.grab = false; inp.punch = false;
      }
      const n = dir.clone(); if (n.length() > 0) n.normalize();
      if (n.length() > 0 && !this.groundAhead(p, n)) {
        // perigo! volta pro meio
        const c = V(-me.x, 0, -me.z); c.normalize();
        dir = c;
        if (Math.random() < 0.02) inp.jump = true;
      }
    }
    inp.mx = dir.x; inp.mz = dir.z;
  }

  // ---------- rede ----------
  snapshot() {
    const players = [];
    for (const p of this.players.values()) {
      const b = [];
      if (p.alive) for (const k of PARTS) {
        const x = p.bodies[k];
        b.push(r3(x.position.x), r3(x.position.y), r3(x.position.z), r3(x.quaternion.x), r3(x.quaternion.y), r3(x.quaternion.z), r3(x.quaternion.w));
      }
      players.push({
        id: p.id, name: p.name, color: p.color, hat: p.hat, eyes: p.eyes, acc: p.acc, slot: p.slot,
        bot: p.isBot, alive: p.alive, ko: p.koT > 0, cons: Math.round(p.cons), wins: p.wins,
        grab: !!(p.grab?.L || p.grab?.R), b,
      });
    }
    const objs = this.objects.map((x) => [r3(x.position.x), r3(x.position.y), r3(x.position.z), r3(x.quaternion.x), r3(x.quaternion.y), r3(x.quaternion.z), r3(x.quaternion.w)]);
    const ev = this.events; this.events = [];
    return { t: r3(this.time), mt: r3(this.mapT), map: this.mapIndex, state: this.state, msg: this.msg, players, objs, ev };
  }
}
