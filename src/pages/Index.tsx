import { useEffect, useRef, useState, useCallback } from 'react';
import { WEAPONS, Weapon, WeaponId, getWeapon } from '@/game/weapons';
import Arena from '@/game/Arena';
import { Slider } from '@/components/ui/slider';

type Screen = 'menu' | 'weapons' | 'settings' | 'comingsoon' | 'credits' | 'arena' | 'victory';

const SAD_FACE =
  'https://cdn.poehali.dev/projects/e60a997e-ef65-4339-9ef1-3b97d10b2161/files/7ffd8625-4e77-41ac-8831-ef341bf70484.jpg';

const MENU = [
  { key: 'weapons', label: 'GO', n: 1 },
  { key: 'settings', label: 'SETTINGS', n: 2 },
  { key: 'credits', label: 'CREDITS', n: 3 },
  { key: 'comingsoon', label: 'COMING SOON...', n: 4 },
] as const;

export default function Index() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [selected, setSelected] = useState<WeaponId>('knives');
  const [playerWeapon, setPlayerWeapon] = useState<Weapon>(getWeapon('knives'));
  const [volume, setVolume] = useState([70]);
  const goMenu = useCallback(() => setScreen('menu'), []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* CRT overlay — отдельный слой, никогда не блокирует клики */}
      <div className="crt-lines crt-vignette fixed inset-0 z-[55]" style={{ pointerEvents: 'none' }} />
      {/* Alone.exe label */}
      <div className="fixed bottom-3 left-4 z-[60] font-mono text-white/40 text-sm tracking-widest animate-flicker" style={{ pointerEvents: 'none' }}>
        Alone.exe started.
      </div>

      {screen === 'menu' && <MenuScreen onSelect={(s) => setScreen(s as Screen)} />}
      {screen === 'weapons' && (
        <WeaponsScreen
          selected={selected}
          setSelected={setSelected}
          onBack={goMenu}
          onConfirm={() => { setPlayerWeapon(getWeapon(selected)); setScreen('arena'); }}
        />
      )}
      {screen === 'settings' && <SettingsScreen volume={volume} setVolume={setVolume} onBack={goMenu} />}
      {screen === 'comingsoon' && <ComingSoonScreen onBack={goMenu} />}
      {screen === 'credits' && <CreditsScreen onBack={goMenu} />}
      {screen === 'arena' && (
        <Arena playerWeapon={playerWeapon} onWin={() => setScreen('victory')} onLose={goMenu} />
      )}
      {screen === 'victory' && <VictoryScreen onBack={goMenu} />}
    </div>
  );
}

/* ── MENU ── */
function MenuScreen({ onSelect }: { onSelect: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen animate-fade-in">
      <h1 className="font-pixel text-7xl md:text-8xl text-white mb-2 animate-glitch" style={{ textShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}>
        ALONE
      </h1>
      <p className="font-mono text-white/40 text-xl mb-12 tracking-[0.5em]">MAIN MENU</p>
      <nav className="flex flex-col gap-4">
        {MENU.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => onSelect(m.key)}
            className="font-pixel text-white/70 hover:text-black hover:bg-white transition-all duration-150 px-10 py-3 border-2 border-white/20 hover:border-white text-sm tracking-wider cursor-pointer"
          >
            <span className="text-white/30 mr-3">{m.n}</span>
            {m.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ── WEAPONS ── */
function WeaponsScreen({
  selected, setSelected, onBack, onConfirm,
}: {
  selected: WeaponId; setSelected: (id: WeaponId) => void; onBack: () => void; onConfirm: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen animate-scale-in px-4">
      <h2 className="font-pixel text-3xl md:text-4xl mb-12" style={{ textShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}>
        ВЫБОР ОРУЖИЯ
      </h2>
      <div className="flex flex-col md:flex-row gap-6 mb-12">
        {WEAPONS.map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => setSelected(w.id)}
            className={`w-64 p-6 border-2 transition-all duration-200 text-center cursor-pointer ${
              selected === w.id ? 'bg-white text-black border-white scale-105' : 'bg-black text-white/70 border-white/20 hover:border-white/60'
            }`}
          >
            <div className="text-5xl mb-4">{w.emoji}</div>
            <div className="font-pixel text-sm mb-3">{w.name}</div>
            <div className="font-mono text-lg leading-tight">{w.desc}</div>
          </button>
        ))}
      </div>
      <div className="flex gap-6">
        <button type="button" onClick={onBack}
          className="font-pixel text-sm px-8 py-3 border-2 border-white/30 text-white/60 hover:text-white hover:border-white transition-all cursor-pointer">
          НАЗАД
        </button>
        <button type="button" onClick={onConfirm}
          className="font-pixel text-sm px-8 py-3 border-2 border-white bg-white text-black hover:bg-black hover:text-white transition-all cursor-pointer">
          ПОДТВЕРДИТЬ
        </button>
      </div>
    </div>
  );
}

/* ── SETTINGS ── */
function SettingsScreen({ volume, setVolume, onBack }: { volume: number[]; setVolume: (v: number[]) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen animate-scale-in px-4">
      <h2 className="font-pixel text-3xl md:text-4xl mb-12" style={{ textShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}>
        SETTINGS
      </h2>
      <div className="w-full max-w-md mb-10">
        <div className="flex justify-between font-pixel text-xs mb-4">
          <span>ГРОМКОСТЬ</span><span>{volume[0]}%</span>
        </div>
        <Slider value={volume} onValueChange={setVolume} max={100} step={1} />
      </div>
      <div className="w-full max-w-md border-2 border-white/20 p-6 mb-10">
        <div className="font-pixel text-xs mb-4 text-white/60">УПРАВЛЕНИЕ</div>
        <div className="font-mono text-xl space-y-1 text-white/80">
          {[['W','прыжок'],['A','влево'],['S','присест'],['D','вправо'],['K','атака'],['L','пинок']].map(([k,v]) => (
            <div key={k}><span className="text-white">{k}</span> — {v}</div>
          ))}
        </div>
      </div>
      <button type="button" onClick={onBack}
        className="font-pixel text-sm px-8 py-3 border-2 border-white/30 text-white/60 hover:text-white hover:border-white transition-all cursor-pointer">
        НАЗАД
      </button>
    </div>
  );
}

/* ── COMING SOON ── */
const DARK_PHRASES = ['i am useless', 'everybody hate me', 'always alone'];
interface DarkMsg { id: number; text: string; x: number; y: number; rot: number }

function ComingSoonScreen({ onBack }: { onBack: () => void }) {
  const [msgs, setMsgs] = useState<DarkMsg[]>([]);
  const [dimmed, setDimmed] = useState(false);
  const idRef = useRef(0);
  const countRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const schedule = () => {
      if (countRef.current >= 20) { setMsgs([]); setDimmed(true); return; }
      timerRef.current = setTimeout(() => {
        setMsgs((m) => [...m, {
          id: idRef.current++,
          text: DARK_PHRASES[Math.floor(Math.random() * DARK_PHRASES.length)],
          x: 5 + Math.random() * 78,
          y: 5 + Math.random() * 82,
          rot: -25 + Math.random() * 50,
        }]);
        countRef.current++;
        schedule();
      }, 900 + Math.random() * 700);
    };
    const t = setTimeout(schedule, 2000);
    return () => { clearTimeout(t); clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen animate-scale-in overflow-hidden">
      {msgs.map((m) => (
        <span key={m.id} className="absolute font-mono text-white/20 text-base"
          style={{ left: `${m.x}%`, top: `${m.y}%`, transform: `rotate(${m.rot}deg)`, whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {m.text}
        </span>
      ))}
      <h2 className="font-pixel text-3xl md:text-5xl animate-flicker mb-12 transition-colors duration-1000 relative z-10"
        style={{ color: dimmed ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.30)' }}>
        COMING SOON...
      </h2>
      <button type="button" onClick={onBack}
        className="relative z-10 font-pixel text-sm px-8 py-3 border-2 border-white/30 text-white/60 hover:text-white hover:border-white transition-all cursor-pointer">
        НАЗАД
      </button>
    </div>
  );
}

/* ── CREDITS ── */
function CreditsScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen animate-fade-in overflow-hidden">
      <img src={SAD_FACE} alt="sad" className="absolute inset-0 w-full h-full object-cover opacity-25 grayscale" style={{ pointerEvents: 'none' }} />
      <div className="relative z-10 max-w-xl text-center px-6">
        <p className="font-mono text-2xl md:text-3xl leading-relaxed text-white">
          Made by Snowy and his loneless.<br />please chat with me. i wanna friends.
        </p>
        <p className="font-pixel text-sm mt-8 text-white">tg: @GTJOF</p>
      </div>
      <button type="button" onClick={onBack}
        className="relative z-10 mt-12 font-pixel text-sm px-8 py-3 border-2 border-white/40 text-white hover:bg-white hover:text-black transition-all cursor-pointer">
        НАЗАД
      </button>
    </div>
  );
}

/* ── VICTORY ── */
function VictoryScreen({ onBack }: { onBack: () => void }) {
  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center animate-fade-in overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => (
        <div key={i} className="absolute animate-flicker" style={{
          left: `${(i * 37) % 100}%`, top: `${(i * 53) % 100}%`,
          fontSize: `${16 + (i % 4) * 12}px`, animationDelay: `${(i % 10) * 0.2}s`,
          pointerEvents: 'none',
        }}>🤍</div>
      ))}
      <h2 className="relative z-10 font-pixel text-4xl md:text-6xl text-white mb-12 animate-scale-in"
        style={{ textShadow: '4px 4px 0 rgba(0,0,0,0.5)' }}>
        YOU WIN
      </h2>
      <button type="button" onClick={onBack}
        className="relative z-10 font-pixel text-sm px-8 py-4 border-2 border-white bg-white text-black hover:bg-black hover:text-white transition-all cursor-pointer">
        В ГЛАВНОЕ МЕНЮ
      </button>
    </div>
  );
}