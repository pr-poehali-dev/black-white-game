import { useEffect, useRef, useState, useCallback } from 'react';
import { Weapon, randomWeapon } from './weapons';

interface ArenaProps {
  playerWeapon: Weapon;
  onWin: () => void;
  onLose: () => void;
}

interface Fighter {
  x: number;
  y: number;
  vy: number;
  facing: 1 | -1;
  hp: number;
  crouch: boolean;
  attackUntil: number;
  cooldownUntil: number;
  blocking: boolean;
  kickUntil: number;
  hitFlash: number;
}

const GROUND = 320;
const ARENA_W = 900;
const MOVE = 4;
const GRAVITY = 0.9;
const JUMP = -15;
const FIGHTER_W = 44;

const Arena = ({ playerWeapon, onWin, onLose }: ArenaProps) => {
  const enemyWeapon = useRef<Weapon>(randomWeapon());
  const keys = useRef<Record<string, boolean>>({});
  const attackReq = useRef(false);
  const kickReq = useRef(false);
  const raf = useRef<number>();
  const ended = useRef(false);

  const [, force] = useState(0);
  const [effects, setEffects] = useState<
    { id: number; x: number; y: number; kind: 'hit' | 'kick' | 'block' }[]
  >([]);
  const effId = useRef(0);

  const player = useRef<Fighter>({
    x: 180, y: GROUND, vy: 0, facing: 1, hp: 100,
    crouch: false, attackUntil: 0, cooldownUntil: 0, blocking: false, kickUntil: 0, hitFlash: 0,
  });
  const enemy = useRef<Fighter>({
    x: 680, y: GROUND, vy: 0, facing: -1, hp: 100,
    crouch: false, attackUntil: 0, cooldownUntil: 0, blocking: false, kickUntil: 0, hitFlash: 0,
  });
  const aiNext = useRef(0);
  const aiState = useRef<'idle' | 'approach' | 'retreat'>('approach');

  const spawnEffect = useCallback((x: number, y: number, kind: 'hit' | 'kick' | 'block') => {
    const id = effId.current++;
    setEffects((e) => [...e, { id, x, y, kind }]);
    setTimeout(() => setEffects((e) => e.filter((f) => f.id !== id)), 320);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keys.current[k] = true;
      if (k === 'k') attackReq.current = true;
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

  useEffect(() => {
    const step = (now: number) => {
      const p = player.current;
      const en = enemy.current;

      // ---- PLAYER INPUT ----
      p.blocking = !!keys.current['j'];
      p.crouch = !!keys.current['s'];
      if (keys.current['a']) { p.x -= MOVE; p.facing = -1; }
      if (keys.current['d']) { p.x += MOVE; p.facing = 1; }
      if (keys.current['w'] && p.y >= GROUND) { p.vy = JUMP; }

      p.facing = en.x >= p.x ? 1 : -1;

      // gravity
      p.vy += GRAVITY;
      p.y += p.vy;
      if (p.y > GROUND) { p.y = GROUND; p.vy = 0; }
      p.x = Math.max(30, Math.min(ARENA_W - FIGHTER_W - 30, p.x));

      // player attack
      if (attackReq.current && now > p.cooldownUntil && !p.blocking) {
        attackReq.current = false;
        p.attackUntil = now + 150;
        p.cooldownUntil = now + playerWeapon.cooldown;
        const dist = Math.abs(en.x - p.x);
        if (dist < playerWeapon.reach + FIGHTER_W) {
          if (en.blocking && Math.sign(en.x - p.x) !== en.facing * -1) {
            spawnEffect((p.x + en.x) / 2, p.y - 40, 'block');
          } else if (en.blocking) {
            spawnEffect((p.x + en.x) / 2, p.y - 40, 'block');
          } else {
            en.hp -= playerWeapon.damage;
            en.hitFlash = now + 120;
            spawnEffect((p.x + en.x) / 2, p.y - 50, 'hit');
          }
        }
      }
      attackReq.current = false;

      // player kick
      if (kickReq.current && now > p.cooldownUntil) {
        kickReq.current = false;
        p.kickUntil = now + 180;
        p.cooldownUntil = now + 500;
        const dist = Math.abs(en.x - p.x);
        if (dist < 70 + FIGHTER_W) {
          en.hp -= 4;
          en.x += p.facing * 40;
          en.hitFlash = now + 120;
          spawnEffect((p.x + en.x) / 2, p.y - 20, 'kick');
        }
      }
      kickReq.current = false;

      // ---- ENEMY AI ----
      en.facing = p.x >= en.x ? 1 : -1;
      const dist = Math.abs(p.x - en.x);
      if (now > aiNext.current) {
        aiNext.current = now + 300 + Math.random() * 500;
        const r = Math.random();
        if (dist > enemyWeapon.current.reach) aiState.current = 'approach';
        else if (r < 0.25) aiState.current = 'retreat';
        else aiState.current = 'idle';
        en.blocking = r > 0.8;
      }
      if (aiState.current === 'approach') en.x += (p.x > en.x ? 1 : -1) * (MOVE - 1.2);
      if (aiState.current === 'retreat') en.x += (p.x > en.x ? -1 : 1) * (MOVE - 1.5);
      en.x = Math.max(30, Math.min(ARENA_W - FIGHTER_W - 30, en.x));

      // enemy attack
      if (dist < enemyWeapon.current.reach + FIGHTER_W && now > en.cooldownUntil && !en.blocking) {
        en.attackUntil = now + 150;
        en.cooldownUntil = now + enemyWeapon.current.cooldown + 200;
        if (!p.blocking) {
          p.hp -= enemyWeapon.current.damage;
          p.hitFlash = now + 120;
          spawnEffect((p.x + en.x) / 2, en.y - 50, 'hit');
        } else {
          spawnEffect((p.x + en.x) / 2, en.y - 40, 'block');
        }
      }

      // ---- WIN / LOSE ----
      if (!ended.current) {
        if (en.hp <= 0) { ended.current = true; cancelAnimationFrame(raf.current!); onWin(); return; }
        if (p.hp <= 0) { ended.current = true; cancelAnimationFrame(raf.current!); onLose(); return; }
      }

      force((n) => (n + 1) % 1000000);
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current!);
  }, [playerWeapon, onWin, onLose, spawnEffect]);

  const p = player.current;
  const en = enemy.current;
  const now = performance.now();

  const renderFighter = (f: Fighter, weapon: Weapon, color: string) => {
    const attacking = now < f.attackUntil;
    const kicking = now < f.kickUntil;
    const flash = now < f.hitFlash;
    return (
      <div
        className="absolute transition-transform"
        style={{
          left: f.x,
          top: f.y - (f.crouch ? 60 : 90),
          width: FIGHTER_W,
          transform: `scaleX(${f.facing}) ${f.crouch ? 'scaleY(0.7)' : ''}`,
          transformOrigin: 'bottom center',
        }}
      >
        {/* body */}
        <div
          style={{
            width: FIGHTER_W,
            height: f.crouch ? 60 : 90,
            background: flash ? '#fff' : color,
            border: f.blocking ? '3px solid #888' : '2px solid #000',
            boxShadow: f.blocking ? '0 0 0 4px rgba(255,255,255,0.4)' : 'none',
          }}
          className="pixelated"
        />
        {/* weapon / arm */}
        <div
          className="absolute pixelated"
          style={{
            top: f.crouch ? 12 : 24,
            left: attacking || kicking ? FIGHTER_W - 4 : FIGHTER_W - 16,
            width: kicking ? 34 : attacking ? weapon.reach * 0.5 : 14,
            height: kicking ? 12 : 8,
            background: kicking ? color : '#000',
            transition: 'all 0.05s',
          }}
        />
      </div>
    );
  };

  return (
    <div className="w-full h-screen flex items-center justify-center bg-[#9a9a9a] animate-fade-in overflow-hidden">
      <div
        className="relative pixelated"
        style={{ width: ARENA_W, height: 460, background: '#8a8a8a' }}
      >
        {/* HP bars */}
        <div className="absolute top-4 left-6 right-6 flex justify-between gap-8 font-pixel text-[10px] text-black z-20">
          <div className="flex-1">
            <div className="mb-1">YOU · {playerWeapon.emoji}</div>
            <div className="h-4 border-2 border-black bg-white">
              <div className="h-full bg-black transition-all" style={{ width: `${Math.max(0, p.hp)}%` }} />
            </div>
          </div>
          <div className="flex-1 text-right">
            <div className="mb-1">{enemyWeapon.current.emoji} · BOT</div>
            <div className="h-4 border-2 border-black bg-white">
              <div className="h-full bg-black ml-auto transition-all" style={{ width: `${Math.max(0, en.hp)}%` }} />
            </div>
          </div>
        </div>

        {/* floor */}
        <div className="absolute left-0 right-0 bg-black" style={{ top: GROUND + 90, height: 460 - GROUND - 90 }} />

        {renderFighter(p, playerWeapon, '#2a2a2a')}
        {renderFighter(en, enemyWeapon.current, '#4a4a4a')}

        {/* effects */}
        {effects.map((e) => (
          <div
            key={e.id}
            className="absolute font-pixel pointer-events-none animate-scale-in z-30"
            style={{ left: e.x, top: e.y, transform: 'translate(-50%,-50%)' }}
          >
            {e.kind === 'hit' && <span className="text-black text-2xl">✦</span>}
            {e.kind === 'kick' && <span className="text-black text-xl">✕</span>}
            {e.kind === 'block' && <span className="text-white text-lg">▢</span>}
          </div>
        ))}

        {/* controls hint */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-black text-sm opacity-60 whitespace-nowrap">
          A/D — движение · W — прыжок · S — присест · K — атака · L — пинок · J — блок
        </div>
      </div>
    </div>
  );
};

export default Arena;
