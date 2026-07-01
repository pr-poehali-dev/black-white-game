import { useEffect, useRef, useState, useCallback } from 'react';
import { Weapon, randomWeapon } from './weapons';

interface ArenaProps {
  playerWeapon: Weapon;
  onWin: () => void;
  onLose: () => void;
}

type Action = 'idle' | 'walk' | 'punch' | 'kick' | 'block' | 'crouch' | 'jump' | 'hurt';

interface Fighter {
  x: number;
  vy: number;
  y: number; // vertical offset (0 = ground, negative = up)
  facing: 1 | -1;
  hp: number;
  action: Action;
  actionUntil: number;
  cooldownUntil: number;
  hurtUntil: number;
  animT: number;
}

const ARENA_W = 960;
const ARENA_H = 500;
const GROUND_Y = 420;
const MOVE = 3.4;
const GRAVITY = 1.1;
const JUMP = -17;
const REACH_PUNCH = 92;
const REACH_KICK = 120;

const makeFighter = (x: number, facing: 1 | -1): Fighter => ({
  x, vy: 0, y: 0, facing, hp: 100,
  action: 'idle', actionUntil: 0, cooldownUntil: 0, hurtUntil: 0, animT: 0,
});

const Arena = ({ playerWeapon, onWin, onLose }: ArenaProps) => {
  const enemyWeapon = useRef<Weapon>(randomWeapon());
  const keys = useRef<Record<string, boolean>>({});
  const punchReq = useRef(false);
  const kickReq = useRef(false);
  const raf = useRef<number>();
  const ended = useRef(false);
  const last = useRef(performance.now());

  const player = useRef<Fighter>(makeFighter(260, 1));
  const enemy = useRef<Fighter>(makeFighter(700, -1));
  const aiNext = useRef(0);
  const aiIntent = useRef<'chase' | 'back' | 'wait' | 'attack'>('chase');

  const [, force] = useState(0);
  const [hits, setHits] = useState<{ id: number; x: number; y: number; big: boolean }[]>([]);
  const hitId = useRef(0);
  const [shake, setShake] = useState(0);

  const spawnHit = useCallback((x: number, y: number, big: boolean) => {
    const id = hitId.current++;
    setHits((h) => [...h, { id, x, y, big }]);
    setShake(big ? 10 : 5);
    setTimeout(() => setHits((h) => h.filter((f) => f.id !== id)), 300);
    setTimeout(() => setShake(0), 120);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'k', 'l', 'j'].includes(k)) e.preventDefault();
      keys.current[k] = true;
      if (k === 'k') punchReq.current = true;
      if (k === 'l') kickReq.current = true;
    };
    const up = (e: KeyboardEvent) => { keys.current[e.key.toLowerCase()] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const canAct = (f: Fighter, now: number) =>
    now > f.actionUntil && now > f.cooldownUntil && now > f.hurtUntil;

  const tryHit = useCallback(
    (attacker: Fighter, target: Fighter, reach: number, dmg: number, now: number, kick: boolean) => {
      const dist = Math.abs(target.x - attacker.x);
      const facingRight = target.x > attacker.x ? 1 : -1;
      if (attacker.facing !== facingRight) return;
      if (dist > reach) return;
      if (!kick && target.action === 'crouch') return;
      const blocked = target.action === 'block' && now < target.actionUntil + 400;
      const hy = GROUND_Y + target.y - 120;
      if (blocked) {
        spawnHit((attacker.x + target.x) / 2, hy, false);
        return;
      }
      target.hp -= dmg;
      target.hurtUntil = now + 260;
      target.action = 'hurt';
      target.x += attacker.facing * 26;
      target.x = Math.max(40, Math.min(ARENA_W - 40, target.x));
      spawnHit((attacker.x + target.x) / 2, hy, dmg >= 16 || kick);
    },
    [spawnHit],
  );

  useEffect(() => {
    const step = (now: number) => {
      const dt = Math.min(2.5, (now - last.current) / 16.67);
      last.current = now;
      const p = player.current;
      const en = enemy.current;

      p.facing = en.x >= p.x ? 1 : -1;
      en.facing = p.x >= en.x ? 1 : -1;

      // ---------- PLAYER ----------
      let pMoving = false;
      if (canAct(p, now)) {
        if (keys.current['j']) {
          p.action = 'block';
          p.actionUntil = now + 80;
        } else if (punchReq.current) {
          p.action = 'punch';
          p.actionUntil = now + 220;
          p.cooldownUntil = now + playerWeapon.cooldown;
          tryHit(p, en, REACH_PUNCH, playerWeapon.damage, now, false);
        } else if (kickReq.current) {
          p.action = 'kick';
          p.actionUntil = now + 300;
          p.cooldownUntil = now + playerWeapon.cooldown + 150;
          tryHit(p, en, REACH_KICK, playerWeapon.damage + 3, now, true);
        } else if (keys.current['w'] && p.y === 0) {
          p.vy = JUMP;
          p.action = 'jump';
        } else if (keys.current['s']) {
          p.action = 'crouch';
          p.actionUntil = now + 60;
        } else if (keys.current['a']) {
          p.x -= MOVE * dt; pMoving = true;
        } else if (keys.current['d']) {
          p.x += MOVE * dt; pMoving = true;
        }
      }
      punchReq.current = false;
      kickReq.current = false;

      p.vy += GRAVITY * dt;
      p.y += p.vy * dt;
      if (p.y >= 0) { p.y = 0; p.vy = 0; }
      p.x = Math.max(40, Math.min(ARENA_W - 40, p.x));
      if (now > p.actionUntil && now > p.hurtUntil && p.y === 0)
        p.action = pMoving ? 'walk' : 'idle';
      if (p.y < 0 && p.action !== 'kick' && p.action !== 'punch') p.action = 'jump';
      p.animT += dt * (pMoving ? 0.35 : 0.12);

      // ---------- ENEMY AI ----------
      const dist = Math.abs(p.x - en.x);
      const dir = p.x > en.x ? 1 : -1;
      let eMoving = false;
      if (now > aiNext.current) {
        aiNext.current = now + 260 + Math.random() * 420;
        if (dist > REACH_KICK + 30) aiIntent.current = 'chase';
        else {
          const r = Math.random();
          if (r < 0.5) aiIntent.current = 'attack';
          else if (r < 0.7) aiIntent.current = 'back';
          else if (r < 0.85) aiIntent.current = 'wait';
          else aiIntent.current = 'chase';
        }
      }
      if (canAct(en, now)) {
        if (aiIntent.current === 'chase') {
          en.x += dir * (MOVE - 0.6) * dt; eMoving = true;
        } else if (aiIntent.current === 'back') {
          en.x -= dir * (MOVE - 1) * dt; eMoving = true;
        } else if (aiIntent.current === 'attack' && dist < REACH_KICK) {
          const useKick = Math.random() < 0.4;
          en.action = useKick ? 'kick' : 'punch';
          en.actionUntil = now + (useKick ? 300 : 220);
          en.cooldownUntil = now + enemyWeapon.current.cooldown + 250;
          tryHit(en, p, useKick ? REACH_KICK : REACH_PUNCH, enemyWeapon.current.damage, now, useKick);
          aiIntent.current = 'wait';
        }
      }
      en.x = Math.max(40, Math.min(ARENA_W - 40, en.x));
      if (now > en.actionUntil && now > en.hurtUntil) en.action = eMoving ? 'walk' : 'idle';
      en.animT += dt * (eMoving ? 0.35 : 0.12);

      // ---------- END ----------
      if (!ended.current) {
        if (en.hp <= 0) { ended.current = true; cancelAnimationFrame(raf.current!); onWin(); return; }
        if (p.hp <= 0) { ended.current = true; cancelAnimationFrame(raf.current!); onLose(); return; }
      }

      force((n) => (n + 1) % 1e9);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current!);
  }, [playerWeapon, onWin, onLose, tryHit]);

  const p = player.current;
  const en = enemy.current;

  return (
    <div className="w-full h-screen flex items-center justify-center bg-black animate-fade-in overflow-hidden">
      <div
        className="relative overflow-hidden border-2 border-white/10"
        style={{
          width: ARENA_W,
          height: ARENA_H,
          transform: shake ? `translate(${(Math.random() - 0.5) * shake}px, ${(Math.random() - 0.5) * shake}px)` : 'none',
          background: 'linear-gradient(180deg, #d8d8d8 0%, #b8b8b8 55%, #9a9a9a 55%, #7a7a7a 100%)',
        }}
      >
        <div className="absolute rounded-full" style={{ width: 140, height: 140, left: 400, top: 40, background: 'radial-gradient(circle,#fff,#e5e5e5)', opacity: 0.5 }} />
        <div className="absolute left-0 right-0" style={{ top: GROUND_Y, height: 3, background: '#000' }} />
        <div className="absolute left-0 right-0 bottom-0" style={{ top: GROUND_Y, background: 'repeating-linear-gradient(90deg,#6a6a6a 0 40px,#5a5a5a 40px 80px)' }} />

        <div className="absolute top-4 left-6 right-6 flex justify-between gap-10 font-pixel text-[9px] text-black z-20">
          <div className="flex-1">
            <div className="mb-1">YOU {playerWeapon.emoji}</div>
            <div className="h-4 border-2 border-black bg-white/70">
              <div className="h-full bg-black transition-all duration-200" style={{ width: `${Math.max(0, p.hp)}%` }} />
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="mb-1">{enemyWeapon.current.emoji} BOT</div>
            <div className="h-4 border-2 border-black bg-white/70">
              <div className="h-full bg-black ml-auto transition-all duration-200" style={{ width: `${Math.max(0, en.hp)}%` }} />
            </div>
          </div>
        </div>

        <Silhouette f={p} color="#050505" />
        <Silhouette f={en} color="#242424" />

        {hits.map((h) => (
          <div
            key={h.id}
            className="absolute z-30 pointer-events-none animate-scale-in font-pixel text-black"
            style={{ left: h.x, top: h.y, transform: 'translate(-50%,-50%)', fontSize: h.big ? 46 : 30 }}
          >
            {h.big ? '✸' : '✦'}
          </div>
        ))}

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-black/60 text-sm whitespace-nowrap z-20">
          A/D ходьба · W прыжок · S присесть · K удар · L пинок · J блок
        </div>
      </div>
    </div>
  );
};

/* ---- Articulated silhouette fighter via SVG skeleton ---- */
const Silhouette = ({ f, color }: { f: Fighter; color: string }) => {
  const now = performance.now();
  const t = f.animT;
  const hurt = now < f.hurtUntil;

  // Body proportions (relative to SVG canvas 80x200)
  const cx = 40; // center X
  const headR = 13;
  const headCY = 22;
  const neckY = headCY + headR;
  const shoulderY = neckY + 8;
  const hipY = shoulderY + 54;
  const armLen = 44;
  const foreLen = 38;
  const thighLen = 46;
  const shinLen = 44;

  // Walk swing
  const swing = Math.sin(t) * (f.action === 'walk' ? 22 : 4);

  // Arm angles (deg from vertical down = 0, left = -90, right = +90, up = ±180)
  let lArmA = 30 + swing;   // front arm
  let rArmA = 30 - swing;   // back arm
  let lForeA = 20;
  let rForeA = 20;

  // Leg angles
  let lLegA = 10 + swing;
  let rLegA = 10 - swing;
  let lShinA = 12;
  let rShinA = 12;

  let torsoTilt = 0;
  let crouching = false;

  if (f.action === 'punch') {
    lArmA = -60; lForeA = -70; rArmA = 45; torsoTilt = 15;
  } else if (f.action === 'kick') {
    lLegA = -85; lShinA = -30; rLegA = 25; torsoTilt = -12;
  } else if (f.action === 'block') {
    lArmA = -50; lForeA = -80; rArmA = -50; rForeA = -80; torsoTilt = 8;
  } else if (f.action === 'crouch') {
    crouching = true;
    lLegA = 50; lShinA = -85; rLegA = -50; rShinA = 85; torsoTilt = 20;
  } else if (f.action === 'jump') {
    lLegA = -35; rLegA = -35; lShinA = -40; rShinA = -40;
    lArmA = -40; rArmA = -40;
  } else if (f.action === 'hurt') {
    lArmA = 80; rArmA = 80; torsoTilt = -20;
  }

  const toRad = (d: number) => (d * Math.PI) / 180;

  // Endpoint from pivot at given angle (0=down) and length
  const ep = (px: number, py: number, angleDeg: number, len: number) => ({
    x: px + Math.sin(toRad(angleDeg)) * len,
    y: py + Math.cos(toRad(angleDeg)) * len,
  });

  // Shoulder joints
  const lShoulder = { x: cx - 9, y: shoulderY };
  const rShoulder = { x: cx + 9, y: shoulderY };
  // Elbow
  const lElbow = ep(lShoulder.x, lShoulder.y, lArmA, armLen);
  const rElbow = ep(rShoulder.x, rShoulder.y, rArmA, armLen);
  // Hand
  const lHand = ep(lElbow.x, lElbow.y, lArmA + lForeA, foreLen);
  const rHand = ep(rElbow.x, rElbow.y, rArmA + rForeA, foreLen);

  // Hip joints
  const lHip = { x: cx - 7, y: hipY };
  const rHip = { x: cx + 7, y: hipY };
  // Knee
  const lKnee = ep(lHip.x, lHip.y, lLegA, thighLen);
  const rKnee = ep(rHip.x, rHip.y, rLegA, thighLen);
  // Foot
  const lFoot = ep(lKnee.x, lKnee.y, lLegA + lShinA, shinLen);
  const rFoot = ep(rKnee.x, rKnee.y, rLegA + rShinA, shinLen);

  const svgH = 220;
  const sw = 5; // stroke width

  return (
    <svg
      width={80}
      height={svgH}
      className="absolute z-10 overflow-visible"
      style={{
        left: f.x - 40,
        top: (GROUND_Y + f.y) - svgH,
        transform: `scaleX(${f.facing})`,
        transformOrigin: '40px center',
        filter: hurt ? 'invert(1) brightness(0.4)' : 'none',
        transition: 'filter 0.05s',
      }}
    >
      <g style={{ transform: `rotate(${torsoTilt}deg)`, transformOrigin: `${cx}px ${crouching ? hipY - 10 : (shoulderY + hipY) / 2}px` }}>
        {/* back arm */}
        <line x1={rShoulder.x} y1={rShoulder.y} x2={rElbow.x} y2={rElbow.y} stroke={color} strokeWidth={sw - 1} strokeLinecap="round" />
        <line x1={rElbow.x} y1={rElbow.y} x2={rHand.x} y2={rHand.y} stroke={color} strokeWidth={sw - 1} strokeLinecap="round" />
        {/* back leg */}
        <line x1={rHip.x} y1={rHip.y} x2={rKnee.x} y2={rKnee.y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1={rKnee.x} y1={rKnee.y} x2={rFoot.x} y2={rFoot.y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {/* torso */}
        <line x1={cx} y1={shoulderY} x2={cx} y2={hipY} stroke={color} strokeWidth={sw + 3} strokeLinecap="round" />
        {/* front leg */}
        <line x1={lHip.x} y1={lHip.y} x2={lKnee.x} y2={lKnee.y} stroke={color} strokeWidth={sw + 1} strokeLinecap="round" />
        <line x1={lKnee.x} y1={lKnee.y} x2={lFoot.x} y2={lFoot.y} stroke={color} strokeWidth={sw + 1} strokeLinecap="round" />
        {/* front arm */}
        <line x1={lShoulder.x} y1={lShoulder.y} x2={lElbow.x} y2={lElbow.y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        <line x1={lElbow.x} y1={lElbow.y} x2={lHand.x} y2={lHand.y} stroke={color} strokeWidth={sw} strokeLinecap="round" />
        {/* head */}
        <circle cx={cx} cy={headCY} r={headR} fill={color} />
      </g>
    </svg>
  );
};

export default Arena;