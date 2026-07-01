import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Weapon, WeaponId, randomWeapon } from './weapons';

interface ArenaProps {
  playerWeapon: Weapon;
  onWin: () => void;
  onLose: () => void;
}

type Action = 'idle' | 'walk' | 'punch' | 'kick' | 'jump' | 'crouch' | 'hurt';

interface Fighter {
  x: number;
  y: number;       // offset from ground, negative = up
  vy: number;
  facing: 1 | -1;
  hp: number;
  action: Action;
  actionUntil: number;
  cooldownUntil: number;
  hurtUntil: number;
  animT: number;
  weaponId: WeaponId;
}

const W = 960;
const H = 520;
const GY = 400; // ground Y in canvas
const MOVE = 3.6;
const GRAV = 1.05;
const JUMP_V = -18;
const REACH_A = 100;  // punch reach
const REACH_K = 130;  // kick reach

function mkFighter(x: number, facing: 1 | -1, weaponId: WeaponId): Fighter {
  return { x, y: 0, vy: 0, facing, hp: 100, action: 'idle', actionUntil: 0, cooldownUntil: 0, hurtUntil: 0, animT: 0, weaponId };
}

export default function Arena({ playerWeapon, onWin, onLose }: ArenaProps) {
  const enemyWeapon = useRef<Weapon>(randomWeapon());
  const keys = useRef<Record<string, boolean>>({});
  const atkReq = useRef(false);
  const kickReq = useRef(false);
  const raf = useRef<number>();
  const ended = useRef(false);
  const last = useRef(0);
  const aiNext = useRef(0);
  const aiMode = useRef<'chase' | 'wait' | 'attack' | 'back'>('chase');

  const P = useRef<Fighter>(mkFighter(220, 1, playerWeapon.id));
  const E = useRef<Fighter>(mkFighter(740, -1, enemyWeapon.current.id));

  const [tick, setTick] = useState(0);
  const [sparks, setSparks] = useState<{ id: number; x: number; y: number; big: boolean }[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const sparkId = useRef(0);
  const [torchFlicker, setTorchFlicker] = useState(0);

  const addSpark = useCallback((x: number, y: number, big: boolean) => {
    const id = sparkId.current++;
    setSparks((s) => [...s, { id, x, y, big }]);
    if (big) { setScreenShake(true); setTimeout(() => setScreenShake(false), 120); }
    setTimeout(() => setSparks((s) => s.filter((f) => f.id !== id)), 350);
  }, []);

  useEffect(() => {
    const dn = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ('wasdklj'.includes(k)) e.preventDefault();
      keys.current[k] = true;
      if (k === 'k') atkReq.current = true;
      if (k === 'l') kickReq.current = true;
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    // torch flicker
    const tf = setInterval(() => setTorchFlicker(Math.random()), 80);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); clearInterval(tf); };
  }, []);

  const canAct = (f: Fighter, now: number) => now > f.actionUntil && now > f.cooldownUntil && now > f.hurtUntil;

  const tryHit = useCallback((atk: Fighter, def: Fighter, reach: number, dmg: number, now: number, isKick: boolean) => {
    const dist = Math.abs(def.x - atk.x);
    if (dist > reach) return;
    if (atk.facing !== (def.x >= atk.x ? 1 : -1)) return;
    if (!isKick && def.action === 'crouch') return;
    def.hp = Math.max(0, def.hp - dmg);
    def.hurtUntil = now + 280;
    def.action = 'hurt';
    def.x = Math.max(50, Math.min(W - 50, def.x + atk.facing * 30));
    addSpark((atk.x + def.x) / 2, GY + def.y - 80, isKick || dmg >= 16);
  }, [addSpark]);

  useEffect(() => {
    const loop = (now: number) => {
      if (!last.current) last.current = now;
      const dt = Math.min(3, (now - last.current) / 16.67);
      last.current = now;

      const p = P.current;
      const e = E.current;
      p.facing = e.x >= p.x ? 1 : -1;
      e.facing = p.x >= e.x ? 1 : -1;

      // ── player ──
      let pWalking = false;
      if (canAct(p, now)) {
        if (atkReq.current) {
          atkReq.current = false;
          p.action = 'punch'; p.actionUntil = now + 220;
          p.cooldownUntil = now + playerWeapon.cooldown;
          tryHit(p, e, REACH_A, playerWeapon.damage, now, false);
        } else if (kickReq.current) {
          kickReq.current = false;
          p.action = 'kick'; p.actionUntil = now + 300;
          p.cooldownUntil = now + playerWeapon.cooldown + 120;
          tryHit(p, e, REACH_K, playerWeapon.damage + 4, now, true);
        } else if (keys.current['w'] && p.y === 0) {
          p.vy = JUMP_V; p.action = 'jump';
        } else if (keys.current['s']) {
          p.action = 'crouch'; p.actionUntil = now + 60;
        } else if (keys.current['a']) { p.x -= MOVE * dt; pWalking = true; }
        else if (keys.current['d']) { p.x += MOVE * dt; pWalking = true; }
      }

      p.vy += GRAV * dt; p.y += p.vy * dt;
      if (p.y >= 0) { p.y = 0; p.vy = 0; }
      p.x = Math.max(50, Math.min(W - 50, p.x));
      if (now > p.actionUntil && now > p.hurtUntil && p.y === 0) p.action = pWalking ? 'walk' : 'idle';
      if (p.y < 0) p.action = 'jump';
      p.animT += dt * (pWalking ? 0.32 : 0.1);

      // ── enemy AI ──
      const dist = Math.abs(p.x - e.x);
      let eWalking = false;
      if (now > aiNext.current) {
        aiNext.current = now + 200 + Math.random() * 500;
        if (dist > REACH_A + 40) aiMode.current = 'chase';
        else {
          const r = Math.random();
          aiMode.current = r < 0.55 ? 'attack' : r < 0.75 ? 'back' : 'wait';
        }
      }
      if (canAct(e, now)) {
        const dir = p.x > e.x ? 1 : -1;
        if (aiMode.current === 'chase') { e.x += dir * (MOVE - 0.8) * dt; eWalking = true; }
        else if (aiMode.current === 'back') { e.x -= dir * (MOVE - 1.2) * dt; eWalking = true; }
        else if (aiMode.current === 'attack' && dist < REACH_K) {
          const kick = Math.random() < 0.35;
          e.action = kick ? 'kick' : 'punch';
          e.actionUntil = now + (kick ? 300 : 220);
          e.cooldownUntil = now + enemyWeapon.current.cooldown + 300;
          tryHit(e, p, kick ? REACH_K : REACH_A, enemyWeapon.current.damage, now, kick);
          aiMode.current = 'wait';
        }
      }
      e.x = Math.max(50, Math.min(W - 50, e.x));
      if (now > e.actionUntil && now > e.hurtUntil) e.action = eWalking ? 'walk' : 'idle';
      e.animT += dt * (eWalking ? 0.32 : 0.1);

      if (!ended.current) {
        if (e.hp <= 0) { ended.current = true; cancelAnimationFrame(raf.current!); onWin(); return; }
        if (p.hp <= 0) { ended.current = true; cancelAnimationFrame(raf.current!); onLose(); return; }
      }

      setTick((t) => (t + 1) & 0xffffff);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current!);
  }, [playerWeapon, onWin, onLose, tryHit]);

  const p = P.current;
  const e = E.current;
  const sx = screenShake ? (Math.random() - 0.5) * 8 : 0;
  const sy = screenShake ? (Math.random() - 0.5) * 8 : 0;

  return (
    <div className="w-full h-screen flex items-center justify-center bg-black overflow-hidden animate-fade-in">
      <div
        className="relative overflow-hidden"
        style={{ width: W, height: H, transform: `translate(${sx}px,${sy}px)` }}
      >
        {/* ── BACKGROUND ── */}
        <ArenaBackground torchFlicker={torchFlicker} />

        {/* ── HP BARS ── */}
        <HpBars p={p} e={e} pw={playerWeapon} ew={enemyWeapon.current} />

        {/* ── FIGHTERS ── */}
        <FighterSVG f={p} weapon={playerWeapon} />
        <FighterSVG f={e} weapon={enemyWeapon.current} />

        {/* ── SPARKS ── */}
        {sparks.map((s) => (
          <div key={s.id} className="absolute pointer-events-none z-40 animate-scale-in font-pixel"
            style={{ left: s.x, top: s.y, transform: 'translate(-50%,-50%)', fontSize: s.big ? 52 : 32, color: '#fff', textShadow: '0 0 12px #fff' }}>
            {s.big ? '✸' : '✦'}
          </div>
        ))}

        {/* ── CONTROLS HINT ── */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-black/50 text-xs whitespace-nowrap z-20 tracking-wide">
          A/D движение · W прыжок · S присест · K удар · L пинок
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   ARENA BACKGROUND
═══════════════════════════════════════ */
function ArenaBackground({ torchFlicker }: { torchFlicker: number }) {
  const tf = 0.82 + torchFlicker * 0.18;
  return (
    <>
      {/* Sky gradient */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,#1a1a1a 0%,#2e2e2e 40%,#3c3c3c 60%,#4a4a4a 100%)' }} />

      {/* Distant pillars */}
      {[120, 300, 500, 660, 840].map((x, i) => (
        <div key={i} className="absolute" style={{ left: x - 18, top: 60, width: 36, height: 280, background: '#1c1c1c', borderLeft: '2px solid #2a2a2a', borderRight: '2px solid #2a2a2a' }}>
          <div style={{ position: 'absolute', top: 0, left: -6, right: -6, height: 20, background: '#222' }} />
          <div style={{ position: 'absolute', bottom: 0, left: -6, right: -6, height: 20, background: '#222' }} />
          {/* Pillar detail lines */}
          {[60, 120, 180, 240].map((y) => (
            <div key={y} style={{ position: 'absolute', top: y, left: 4, right: 4, height: 1, background: '#282828' }} />
          ))}
        </div>
      ))}

      {/* Wall back */}
      <div className="absolute left-0 right-0" style={{ top: 60, height: 300, background: '#262626', borderBottom: '3px solid #1a1a1a' }}>
        {/* Brick pattern */}
        {Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 16 }).map((_, col) => (
            <div key={`${row}-${col}`} style={{
              position: 'absolute',
              left: col * 60 + (row % 2 ? 30 : 0),
              top: row * 36,
              width: 56, height: 32,
              border: '1px solid #1e1e1e',
              background: row % 3 === 0 ? '#252525' : '#232323',
            }} />
          ))
        )}
      </div>

      {/* Torches */}
      {[160, 800].map((x, i) => (
        <React.Fragment key={i}>
          <div className="absolute" style={{ left: x - 4, top: 130, width: 8, height: 40, background: '#1a1a1a', zIndex: 5 }} />
          <div className="absolute" style={{ left: x - 12, top: 118, width: 24, height: 14, background: '#1e1e1e', zIndex: 5, borderRadius: 2 }} />
          {/* Flame */}
          <div className="absolute" style={{
            left: x - 10, top: 94,
            width: 20, height: 28,
            background: `radial-gradient(ellipse at 50% 100%, rgba(255,255,255,${0.9 * tf}) 0%, rgba(180,180,180,${0.6 * tf}) 40%, transparent 80%)`,
            zIndex: 6, borderRadius: '50% 50% 40% 40%',
            transform: `scaleY(${0.85 + torchFlicker * 0.3}) scaleX(${0.8 + torchFlicker * 0.2})`,
          }} />
          {/* Glow */}
          <div className="absolute" style={{
            left: x - 60, top: 80,
            width: 120, height: 100,
            background: `radial-gradient(ellipse at 50% 30%, rgba(255,255,255,${0.08 * tf}) 0%, transparent 70%)`,
            zIndex: 4, pointerEvents: 'none',
          }} />
        </React.Fragment>
      ))}

      {/* Ground platform */}
      <div className="absolute left-0 right-0" style={{ top: GY, height: H - GY, background: '#1a1a1a' }}>
        {/* Floor tiles */}
        {Array.from({ length: 17 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute', left: i * 57, top: 0,
            width: 55, height: 24,
            background: i % 2 === 0 ? '#202020' : '#1d1d1d',
            borderRight: '1px solid #161616', borderBottom: '1px solid #161616',
          }}>
            {/* Tile crack detail */}
            {i % 3 === 1 && <div style={{ position: 'absolute', left: 8, top: 6, width: 20, height: 1, background: '#2a2a2a', transform: 'rotate(-15deg)' }} />}
          </div>
        ))}
        {/* Floor edge highlight */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#333' }} />
        <div style={{ position: 'absolute', top: 3, left: 0, right: 0, height: 1, background: '#2a2a2a' }} />
        {/* Floor depth lines */}
        {[40, 80, 120].map((y) => (
          <div key={y} style={{ position: 'absolute', top: y, left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.3)' }} />
        ))}
      </div>

      {/* Chains */}
      {[200, 760].map((x, i) => (
        <div key={i} className="absolute" style={{ left: x, top: 60, width: 2, height: 120, background: 'repeating-linear-gradient(180deg,#2a2a2a 0 8px,transparent 8px 12px)', zIndex: 3 }} />
      ))}

      {/* Ground mist */}
      <div className="absolute left-0 right-0" style={{
        top: GY - 20, height: 40,
        background: 'linear-gradient(180deg, transparent, rgba(40,40,40,0.4) 50%, transparent)',
        pointerEvents: 'none', zIndex: 8,
      }} />
    </>
  );
}

/* ═══════════════════════════════════════
   HP BARS
═══════════════════════════════════════ */
function HpBars({ p, e, pw, ew }: { p: Fighter; e: Fighter; pw: Weapon; ew: Weapon }) {
  return (
    <div className="absolute top-4 left-4 right-4 z-30 flex gap-4 items-start">
      {/* Player */}
      <div className="flex-1">
        <div className="font-pixel text-[9px] text-white/80 mb-1 flex items-center gap-1">
          <span className="text-white">YOU</span>
          <span className="text-white/40">{pw.name}</span>
        </div>
        <div className="relative h-5 border border-white/40" style={{ background: '#111' }}>
          <div className="h-full transition-all duration-150" style={{ width: `${Math.max(0, p.hp)}%`, background: p.hp > 50 ? '#e0e0e0' : p.hp > 25 ? '#888' : '#555' }} />
          <div className="absolute inset-0 border-t border-white/10" />
        </div>
        <div className="font-mono text-[10px] text-white/30 mt-0.5">{Math.max(0, Math.round(p.hp))} / 100</div>
      </div>
      {/* VS */}
      <div className="font-pixel text-white/30 text-xs pt-2">VS</div>
      {/* Enemy */}
      <div className="flex-1 text-right">
        <div className="font-pixel text-[9px] text-white/80 mb-1 flex items-center justify-end gap-1">
          <span className="text-white/40">{ew.name}</span>
          <span className="text-white">BOT</span>
        </div>
        <div className="relative h-5 border border-white/40" style={{ background: '#111' }}>
          <div className="h-full ml-auto transition-all duration-150" style={{ width: `${Math.max(0, e.hp)}%`, background: e.hp > 50 ? '#e0e0e0' : e.hp > 25 ? '#888' : '#555' }} />
          <div className="absolute inset-0 border-t border-white/10" />
        </div>
        <div className="font-mono text-[10px] text-white/30 mt-0.5">{Math.max(0, Math.round(e.hp))} / 100</div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════
   FIGHTER SVG  — SF2-style silhouette
═══════════════════════════════════════ */
interface FighterProps { f: Fighter; weapon: Weapon }

function FighterSVG({ f, weapon }: FighterProps) {
  const now = performance.now();
  const t = f.animT;
  const hurt = now < f.hurtUntil;

  // Canvas: 120×260, feet at y=250
  const SVG_W = 120;
  const SVG_H = 260;
  const FEET_Y = 250;

  // Body proportions (SF2-ish)
  const HEAD_R = 16;
  const HEAD_CY = 28;
  const NECK_Y = HEAD_CY + HEAD_R + 2;
  const SHOULDER_Y = NECK_Y + 12;
  const HIP_Y = SHOULDER_Y + 62;
  const CX = 60;

  // Arm segments
  const U_ARM = 38;  // upper arm length
  const L_ARM = 34;  // forearm
  // Leg segments
  const THIGH = 48;
  const SHIN = 46;

  // Walk cycle
  const sw = Math.sin(t) * (f.action === 'walk' ? 28 : 5);

  // Default relaxed pose angles (degrees, 0=straight down from joint)
  let lUA = 20 + sw;   // left upper arm (front)
  let lLA = 15;        // left forearm
  let rUA = 20 - sw;   // right upper arm (back)
  let rLA = 15;
  let lTh = 8 + sw;    // left thigh (front leg)
  let lSh = 10;        // left shin
  let rTh = 8 - sw;    // right thigh (back leg)
  let rSh = 10;
  let torsoTilt = 0;
  let crouching = false;
  let bodyScale = 1;

  // Action overrides
  if (f.action === 'punch') {
    lUA = -70; lLA = -50; rUA = 35; rLA = 25; torsoTilt = 18;
  } else if (f.action === 'kick') {
    lTh = -90; lSh = -35; rTh = 20; rSh = 15; torsoTilt = -15;
    lUA = -20; rUA = 40;
  } else if (f.action === 'crouch') {
    crouching = true; bodyScale = 0.78;
    lTh = 65; lSh = -100; rTh = -65; rSh = 100;
    lUA = 30; rUA = 30; lLA = 40; rLA = 40; torsoTilt = 10;
  } else if (f.action === 'jump') {
    lTh = -40; rTh = -40; lSh = -50; rSh = -50;
    lUA = -50; rUA = -50; lLA = -20; rLA = -20;
  } else if (f.action === 'hurt') {
    torsoTilt = -22; lUA = 80; rUA = 80; lLA = 30; rLA = 30;
    lTh = 15; rTh = -10;
  }

  const d2r = (deg: number) => (deg * Math.PI) / 180;

  // Compute endpoint given start, angle-from-vertical-down, length
  const ep = (x: number, y: number, angleDeg: number, len: number) => ({
    x: x + Math.sin(d2r(angleDeg)) * len,
    y: y + Math.cos(d2r(angleDeg)) * len,
  });

  // Joints (in local un-tilted space, tilting applied via SVG transform)
  const shoulderL = { x: CX - 11, y: SHOULDER_Y };
  const shoulderR = { x: CX + 11, y: SHOULDER_Y };
  const hipL = { x: CX - 8, y: HIP_Y };
  const hipR = { x: CX + 8, y: HIP_Y };

  const elbowL = ep(shoulderL.x, shoulderL.y, lUA, U_ARM);
  const handL = ep(elbowL.x, elbowL.y, lUA + lLA, L_ARM);
  const elbowR = ep(shoulderR.x, shoulderR.y, rUA, U_ARM);
  const handR = ep(elbowR.x, elbowR.y, rUA + rLA, L_ARM);

  const kneeL = ep(hipL.x, hipL.y, lTh, THIGH);
  const footL = ep(kneeL.x, kneeL.y, lTh + lSh, SHIN);
  const kneeR = ep(hipR.x, hipR.y, rTh, THIGH);
  const footR = ep(kneeR.x, kneeR.y, rTh + rSh, SHIN);

  // Weapon geometry
  const weaponLines = getWeaponLines(weapon.id, handL, lUA + lLA, f.action);

  const color = '#0a0a0a';
  const strokeW = 7;
  const pivotX = CX;
  const pivotY = (SHOULDER_Y + HIP_Y) / 2;

  // Screen position: feet at GY + f.y
  const screenFeetY = GY + f.y;

  return (
    <svg
      width={SVG_W} height={SVG_H}
      className="absolute z-20 overflow-visible"
      style={{
        left: f.x - CX,
        top: screenFeetY - FEET_Y,
        transform: `scaleX(${f.facing}) scaleY(${bodyScale})`,
        transformOrigin: `${CX}px ${FEET_Y}px`,
        filter: hurt ? 'brightness(3) saturate(0)' : 'none',
        transition: 'filter 0.04s',
      }}
    >
      <g transform={`rotate(${torsoTilt}, ${pivotX}, ${pivotY})`}>
        {/* === BACK ARM === */}
        <line x1={shoulderR.x} y1={shoulderR.y} x2={elbowR.x} y2={elbowR.y} stroke={color} strokeWidth={strokeW - 1} strokeLinecap="round" />
        <line x1={elbowR.x} y1={elbowR.y} x2={handR.x} y2={handR.y} stroke={color} strokeWidth={strokeW - 2} strokeLinecap="round" />
        <circle cx={elbowR.x} cy={elbowR.y} r={3} fill={color} />

        {/* === BACK LEG === */}
        <line x1={hipR.x} y1={hipR.y} x2={kneeR.x} y2={kneeR.y} stroke={color} strokeWidth={strokeW + 1} strokeLinecap="round" />
        <line x1={kneeR.x} y1={kneeR.y} x2={footR.x} y2={footR.y} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
        <circle cx={kneeR.x} cy={kneeR.y} r={4} fill={color} />
        {/* Foot */}
        <line x1={footR.x} y1={footR.y} x2={footR.x + 14} y2={footR.y + 2} stroke={color} strokeWidth={5} strokeLinecap="round" />

        {/* === TORSO === */}
        <line x1={CX} y1={SHOULDER_Y} x2={CX} y2={HIP_Y} stroke={color} strokeWidth={strokeW + 5} strokeLinecap="round" />
        {/* Neck */}
        <line x1={CX} y1={NECK_Y} x2={CX} y2={SHOULDER_Y} stroke={color} strokeWidth={strokeW - 1} strokeLinecap="round" />

        {/* === FRONT LEG === */}
        <line x1={hipL.x} y1={hipL.y} x2={kneeL.x} y2={kneeL.y} stroke={color} strokeWidth={strokeW + 2} strokeLinecap="round" />
        <line x1={kneeL.x} y1={kneeL.y} x2={footL.x} y2={footL.y} stroke={color} strokeWidth={strokeW + 1} strokeLinecap="round" />
        <circle cx={kneeL.x} cy={kneeL.y} r={5} fill={color} />
        {/* Foot */}
        <line x1={footL.x} y1={footL.y} x2={footL.x + 16} y2={footL.y + 2} stroke={color} strokeWidth={6} strokeLinecap="round" />

        {/* === FRONT ARM === */}
        <line x1={shoulderL.x} y1={shoulderL.y} x2={elbowL.x} y2={elbowL.y} stroke={color} strokeWidth={strokeW} strokeLinecap="round" />
        <line x1={elbowL.x} y1={elbowL.y} x2={handL.x} y2={handL.y} stroke={color} strokeWidth={strokeW - 1} strokeLinecap="round" />
        <circle cx={elbowL.x} cy={elbowL.y} r={4} fill={color} />
        {/* Fist */}
        <circle cx={handL.x} cy={handL.y} r={6} fill={color} />

        {/* === WEAPON === */}
        {weaponLines}

        {/* === HEAD === */}
        <circle cx={CX} cy={HEAD_CY} r={HEAD_R} fill={color} />
        {/* Eyes */}
        <circle cx={CX + 5} cy={HEAD_CY - 3} r={2.5} fill="#1a1a1a" />
        <circle cx={CX + 5} cy={HEAD_CY - 3} r={1} fill="#fff" opacity={0.15} />
      </g>
    </svg>
  );
}

/* ═══════════════════════════════════════
   WEAPON GEOMETRY
═══════════════════════════════════════ */
interface Pt { x: number; y: number }

function getWeaponLines(id: WeaponId, handPt: Pt, armAngle: number, action: Action): React.ReactNode {
  const d2r = (deg: number) => (deg * Math.PI) / 180;
  const ep = (x: number, y: number, ang: number, len: number) => ({
    x: x + Math.sin(d2r(ang)) * len,
    y: y + Math.cos(d2r(ang)) * len,
  });

  const attacking = action === 'punch';
  const wc = '#2a2a2a';

  if (id === 'knuckles') {
    // Brass knuckles: rectangle over fist
    return (
      <g>
        <rect x={handPt.x - 10} y={handPt.y - 5} width={20} height={10} rx={3} fill={wc} stroke="#444" strokeWidth={1} />
        {[-5, 0, 5].map((dx) => (
          <rect key={dx} x={handPt.x + dx - 3} y={handPt.y - 9} width={5} height={5} rx={2} fill={wc} stroke="#444" strokeWidth={0.5} />
        ))}
      </g>
    );
  }

  if (id === 'knives') {
    // Two knives — one on hand
    const tip = ep(handPt.x, handPt.y, armAngle - 10, attacking ? 52 : 36);
    const guard1 = ep(handPt.x, handPt.y, armAngle + 80, 9);
    const guard2 = ep(handPt.x, handPt.y, armAngle - 80, 9);
    return (
      <g>
        {/* blade */}
        <line x1={handPt.x} y1={handPt.y} x2={tip.x} y2={tip.y} stroke={wc} strokeWidth={3} strokeLinecap="round" />
        {/* guard */}
        <line x1={guard1.x} y1={guard1.y} x2={guard2.x} y2={guard2.y} stroke={wc} strokeWidth={4} strokeLinecap="round" />
        {/* blade edge glint */}
        <line x1={handPt.x} y1={handPt.y} x2={tip.x} y2={tip.y} stroke="#555" strokeWidth={1} strokeLinecap="round" />
      </g>
    );
  }

  if (id === 'katana') {
    // Long katana blade
    const len = attacking ? 110 : 82;
    const tip = ep(handPt.x, handPt.y, armAngle - 5, len);
    const pommel = ep(handPt.x, handPt.y, armAngle + 180, 18);
    const guard1 = ep(handPt.x, handPt.y, armAngle + 82, 14);
    const guard2 = ep(handPt.x, handPt.y, armAngle - 82, 14);
    return (
      <g>
        {/* handle */}
        <line x1={handPt.x} y1={handPt.y} x2={pommel.x} y2={pommel.y} stroke={wc} strokeWidth={5} strokeLinecap="round" />
        {/* guard */}
        <line x1={guard1.x} y1={guard1.y} x2={guard2.x} y2={guard2.y} stroke={wc} strokeWidth={5} strokeLinecap="round" />
        {/* blade */}
        <line x1={handPt.x} y1={handPt.y} x2={tip.x} y2={tip.y} stroke={wc} strokeWidth={3.5} strokeLinecap="round" />
        {/* glint edge */}
        <line x1={handPt.x} y1={handPt.y} x2={tip.x} y2={tip.y} stroke="#666" strokeWidth={1} strokeLinecap="round" />
      </g>
    );
  }

  return null;
}