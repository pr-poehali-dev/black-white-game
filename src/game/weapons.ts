export type WeaponId = 'knuckles' | 'knives' | 'katana';

export interface Weapon {
  id: WeaponId;
  name: string;
  emoji: string;
  desc: string;
  damage: number;
  speed: number;
  cooldown: number;
  reach: number;
}

export const WEAPONS: Weapon[] = [
  {
    id: 'knuckles',
    name: '2 КАСТЕТА',
    emoji: '👊',
    desc: 'Низкий урон · Высокая скорость',
    damage: 6,
    speed: 3,
    cooldown: 350,
    reach: 60,
  },
  {
    id: 'knives',
    name: '2 НОЖА',
    emoji: '🔪',
    desc: 'Средний урон · Средняя скорость',
    damage: 12,
    speed: 2,
    cooldown: 650,
    reach: 80,
  },
  {
    id: 'katana',
    name: 'КАТАНА',
    emoji: '⚔️',
    desc: 'Высокий урон · Низкая скорость',
    damage: 24,
    speed: 1,
    cooldown: 1050,
    reach: 110,
  },
];

export const getWeapon = (id: WeaponId) =>
  WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];

export const randomWeapon = (): Weapon =>
  WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
