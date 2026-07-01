import { useEffect, useState, useCallback } from 'react';
import { WEAPONS, Weapon, WeaponId, getWeapon } from '@/game/weapons';
import Arena from '@/game/Arena';
import { Slider } from '@/components/ui/slider';

type Screen =
  | 'menu'
  | 'weapons'
  | 'settings'
  | 'comingsoon'
  | 'credits'
  | 'blackscreen'
  | 'arena'
  | 'victory';

const SAD_FACE = 'https://cdn.poehali.dev/projects/e60a997e-ef65-4339-9ef1-3b97d10b2161/files/7ffd8625-4e77-41ac-8831-ef341bf70484.jpg';

const MENU = [
  { key: 'weapons', label: 'GO', n: 1 },
  { key: 'settings', label: 'SETTINGS', n: 2 },
  { key: 'credits', label: 'CREDITS', n: 3 },
  { key: 'comingsoon', label: 'COMING SOON...', n: 4 },
  { key: 'blackscreen', label: 'BLACK SCREEN', n: 5 },
] as const;

// floating pixel-art background icons
const BG_ICONS = ['💀', '🐱', '🖤'];

const Index = () => {
  const [screen, setScreen] = useState<Screen>('menu');
  const [selected, setSelected] = useState<WeaponId>('knives');
  const [playerWeapon, setPlayerWeapon] = useState<Weapon>(getWeapon('knives'));
  const [volume, setVolume] = useState([70]);

  const goMenu = useCallback(() => setScreen('menu'), []);

  // BLACK SCREEN — любая клавиша возвращает в меню
  useEffect(() => {
    if (screen !== 'blackscreen') return;
    const handler = () => goMenu();
    window.addEventListener('keydown', handler);
    window.addEventListener('click', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
    };
  }, [screen, goMenu]);

  return (
    <div className="crt-lines crt-vignette min-h-screen bg-black text-white overflow-hidden select-none">
      {screen === 'menu' && <MenuScreen onSelect={(s) => setScreen(s)} />}

      {screen === 'weapons' && (
        <WeaponsScreen
          selected={selected}
          setSelected={setSelected}
          onBack={goMenu}
          onConfirm={() => {
            setPlayerWeapon(getWeapon(selected));
            setScreen('arena');
          }}
        />
      )}

      {screen === 'settings' && <SettingsScreen volume={volume} setVolume={setVolume} onBack={goMenu} />}

      {screen === 'comingsoon' && <ComingSoonScreen onBack={goMenu} />}

      {screen === 'credits' && <CreditsScreen onBack={goMenu} />}

      {screen === 'blackscreen' && (
        <div className="fixed inset-0 bg-black flex items-center justify-center animate-fade-in">
          <p className="font-mono text-white/20 text-lg tracking-widest animate-flicker">
            нажми любую клавишу
          </p>
        </div>
      )}

      {screen === 'arena' && (
        <Arena
          playerWeapon={playerWeapon}
          onWin={() => setScreen('victory')}
          onLose={goMenu}
        />
      )}

      {screen === 'victory' && <VictoryScreen onBack={goMenu} />}
    </div>
  );
};

/* ---------- MAIN MENU ---------- */
const MenuScreen = ({ onSelect }: { onSelect: (s: Screen) => void }) => (
  <div className="relative flex flex-col items-center justify-center min-h-screen animate-fade-in">
    {/* floating bg icons */}
    {BG_ICONS.map((icon, i) => (
      <div
        key={i}
        className="absolute animate-float-bg pointer-events-none pixelated"
        style={{
          left: `${15 + i * 30}%`,
          top: `${20 + (i % 2) * 40}%`,
          fontSize: '120px',
          animationDelay: `${i * 2}s`,
          filter: 'grayscale(1) contrast(2)',
        }}
      >
        {icon}
      </div>
    ))}

    <h1 className="font-pixel text-7xl md:text-8xl text-white text-shadow-pixel mb-2 z-10 animate-glitch">
      ALONE
    </h1>
    <p className="font-mono text-white/40 text-xl mb-12 z-10 tracking-[0.5em]">MAIN MENU</p>

    <nav className="flex flex-col gap-4 z-10">
      {MENU.map((m, i) => (
        <button
          key={m.key}
          onClick={() => onSelect(m.key as Screen)}
          className="group font-pixel text-white/70 hover:text-black hover:bg-white transition-all duration-200 px-8 py-3 border-2 border-white/20 hover:border-white text-sm md:text-base tracking-wider animate-fade-in"
          style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'backwards' }}
        >
          <span className="text-white/30 group-hover:text-black mr-3">{m.n}</span>
          {m.label}
        </button>
      ))}
    </nav>
  </div>
);

/* ---------- WEAPONS ---------- */
const WeaponsScreen = ({
  selected,
  setSelected,
  onBack,
  onConfirm,
}: {
  selected: WeaponId;
  setSelected: (id: WeaponId) => void;
  onBack: () => void;
  onConfirm: () => void;
}) => (
  <div className="flex flex-col items-center justify-center min-h-screen animate-scale-in px-4">
    <h2 className="font-pixel text-3xl md:text-4xl mb-12 text-shadow-pixel">ВЫБОР ОРУЖИЯ</h2>

    <div className="flex flex-col md:flex-row gap-6 mb-12">
      {WEAPONS.map((w) => (
        <button
          key={w.id}
          onClick={() => setSelected(w.id)}
          className={`w-64 p-6 border-2 transition-all duration-200 text-center ${
            selected === w.id
              ? 'bg-white text-black border-white scale-105'
              : 'bg-black text-white/70 border-white/20 hover:border-white/60'
          }`}
        >
          <div className="text-5xl mb-4 pixelated">{w.emoji}</div>
          <div className="font-pixel text-sm mb-3">{w.name}</div>
          <div className="font-mono text-lg leading-tight">{w.desc}</div>
        </button>
      ))}
    </div>

    <div className="flex gap-6">
      <button
        onClick={onBack}
        className="font-pixel text-sm px-8 py-3 border-2 border-white/30 text-white/60 hover:text-white hover:border-white transition-all"
      >
        НАЗАД
      </button>
      <button
        onClick={onConfirm}
        className="font-pixel text-sm px-8 py-3 border-2 border-white bg-white text-black hover:bg-black hover:text-white transition-all animate-flicker"
      >
        ПОДТВЕРДИТЬ
      </button>
    </div>
  </div>
);

/* ---------- SETTINGS ---------- */
const SettingsScreen = ({
  volume,
  setVolume,
  onBack,
}: {
  volume: number[];
  setVolume: (v: number[]) => void;
  onBack: () => void;
}) => (
  <div className="flex flex-col items-center justify-center min-h-screen animate-scale-in px-4">
    <h2 className="font-pixel text-3xl md:text-4xl mb-12 text-shadow-pixel">SETTINGS</h2>

    <div className="w-full max-w-md mb-10">
      <div className="flex justify-between font-pixel text-xs mb-4">
        <span>ГРОМКОСТЬ</span>
        <span>{volume[0]}%</span>
      </div>
      <Slider value={volume} onValueChange={setVolume} max={100} step={1} className="mb-2" />
    </div>

    <div className="w-full max-w-md border-2 border-white/20 p-6 mb-10">
      <div className="font-pixel text-xs mb-4 text-white/60">УПРАВЛЕНИЕ</div>
      <div className="font-mono text-lg space-y-1 text-white/80">
        <div><span className="text-white">W</span> — прыжок</div>
        <div><span className="text-white">A</span> — движение влево</div>
        <div><span className="text-white">S</span> — присест</div>
        <div><span className="text-white">D</span> — движение вправо</div>
        <div><span className="text-white">K</span> — атака</div>
        <div><span className="text-white">L</span> — пинок</div>
        <div><span className="text-white">J</span> — блокировка</div>
      </div>
    </div>

    <button
      onClick={onBack}
      className="font-pixel text-sm px-8 py-3 border-2 border-white/30 text-white/60 hover:text-white hover:border-white transition-all"
    >
      НАЗАД
    </button>
  </div>
);

/* ---------- COMING SOON ---------- */
const ComingSoonScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="flex flex-col items-center justify-center min-h-screen animate-scale-in">
    <h2 className="font-pixel text-3xl md:text-5xl text-white/30 animate-flicker mb-12">
      COMING SOON...
    </h2>
    <button
      onClick={onBack}
      className="font-pixel text-sm px-8 py-3 border-2 border-white/30 text-white/60 hover:text-white hover:border-white transition-all"
    >
      НАЗАД
    </button>
  </div>
);

/* ---------- CREDITS ---------- */
const CreditsScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="relative flex flex-col items-center justify-center min-h-screen animate-fade-in overflow-hidden">
    <img
      src={SAD_FACE}
      alt="sad"
      className="absolute inset-0 w-full h-full object-cover opacity-30 pixelated grayscale"
    />
    <div className="relative z-10 max-w-xl text-center px-6">
      <p className="font-mono text-2xl md:text-3xl leading-relaxed text-white">
        Made by Snowy and his loneless. please chat with me. i wanna friends.
      </p>
      <p className="font-pixel text-sm mt-8 text-white">tg: @GTJOF</p>
    </div>
    <button
      onClick={onBack}
      className="relative z-10 mt-12 font-pixel text-sm px-8 py-3 border-2 border-white/40 text-white hover:bg-white hover:text-black transition-all"
    >
      НАЗАД
    </button>
  </div>
);

/* ---------- VICTORY ---------- */
const VictoryScreen = ({ onBack }: { onBack: () => void }) => (
  <div className="fixed inset-0 bg-black flex flex-col items-center justify-center animate-fade-in overflow-hidden">
    {Array.from({ length: 40 }).map((_, i) => (
      <div
        key={i}
        className="absolute pixelated animate-flicker"
        style={{
          left: `${(i * 37) % 100}%`,
          top: `${(i * 53) % 100}%`,
          fontSize: `${16 + (i % 4) * 12}px`,
          animationDelay: `${(i % 10) * 0.2}s`,
          filter: 'grayscale(1) brightness(2)',
        }}
      >
        🤍
      </div>
    ))}
    <h2 className="relative z-10 font-pixel text-4xl md:text-6xl text-white text-shadow-pixel mb-12 animate-scale-in">
      YOU WIN
    </h2>
    <button
      onClick={onBack}
      className="relative z-10 font-pixel text-sm px-8 py-4 border-2 border-white bg-white text-black hover:bg-black hover:text-white transition-all"
    >
      В ГЛАВНОЕ МЕНЮ
    </button>
  </div>
);

export default Index;
