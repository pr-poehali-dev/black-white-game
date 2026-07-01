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

/* ---- Articulated silhouette fighter ---- */
const Silhouette = ({ f, color }: { f: Fighter; color: string }) => {
  const now = performance.now();
  const feetY = GROUND_Y + f.y;
  const t = f.animT;
  const face = f.facing;
  const hurt = now < f.hurtUntil;

  const swing = Math.sin(t) * (f.action === 'walk' ? 26 : 6);
  let frontArm = 40 + swing;
  let backArm = 40 - swing;
  let frontLeg = 8 + swing;
  let backLeg = 8 - swing;
  let torsoLean = 0;
  let bodyH = 100;

  if (f.action === 'punch') { frontArm = -85; backArm = 55; torsoLean = 8; }
  else if (f.action === 'kick') { frontLeg = -78; backLeg = 22; torsoLean = -10; }
  else if (f.action === 'block') { frontArm = -40; backArm = -40; torsoLean = 4; }
  else if (f.action === 'crouch') { bodyH = 62; frontLeg = 55; backLeg = -55; }
  else if (f.action === 'jump') { frontLeg = 50; backLeg = 50; frontArm = -30; backArm = -30; }
  else if (f.action === 'hurt') { torsoLean = -18; frontArm = 70; backArm = 70; }

  const hipY = feetY - bodyH * 0.5;
  const shoulderY = feetY - bodyH;
  const headY = shoulderY - 22;

  const limb = (angleDeg: number, len: number, w: number, oy: number) => (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: oy,
        width: w,
        height: len,
        background: color,
        transformOrigin: 'top center',
        transform: `translateX(-50%) rotate(${angleDeg}deg)`,
        borderRadius: w,
      }}
    />
  );

  return (
    <div
      className="absolute z-10"
      style={{
        left: f.x,
        top: 0,
        transform: `scaleX(${face})`,
        transformOrigin: 'center',
        filter: hurt ? 'invert(1) brightness(0.35)' : 'none',
        transition: 'filter 0.05s',
      }}
    >
      <div style={{ transform: `rotate(${torsoLean}deg)`, transformOrigin: `0px ${hipY}px` }}>
        {limb(180 + backLeg, feetY - hipY, 12, hipY)}
        {limb(180 + backArm, bodyH * 0.42, 9, shoulderY + 4)}
        <div style={{ position: 'absolute', left: -8, top: shoulderY, width: 16, height: bodyH * 0.55, background: color, borderRadius: 8 }} />
        {limb(180 + frontLeg, feetY - hipY, 13, hipY)}
        {limb(180 + frontArm, bodyH * 0.42, 10, shoulderY + 4)}
        <div style={{ position: 'absolute', left: -13, top: headY, width: 26, height: 26, background: color, borderRadius: '50%' }} />
      </div>
    </div>
  );
};

export default Arena;
