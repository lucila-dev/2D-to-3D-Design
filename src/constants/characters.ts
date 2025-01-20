export interface CharacterPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Local GLB from three.js examples (free, MIT) */
  url: string;
}

/**
 * Premade models from the three.js examples pack
 * (https://github.com/mrdoob/three.js — free to use).
 */
export const CHARACTER_PRESETS: CharacterPreset[] = [
  {
    id: 'soldier',
    label: 'Soldier',
    description: 'Humanoid game character',
    icon: '🪖',
    url: '/characters/soldier.glb',
  },
  {
    id: 'xbot',
    label: 'X Bot',
    description: 'Rigged humanoid figure',
    icon: '🧍',
    url: '/characters/xbot.glb',
  },
  {
    id: 'robot',
    label: 'Robot',
    description: 'Expressive robot figure',
    icon: '🤖',
    url: '/characters/robot.glb',
  },
  {
    id: 'horse',
    label: 'Horse',
    description: 'Animated horse',
    icon: '🐴',
    url: '/characters/horse.glb',
  },
  {
    id: 'flamingo',
    label: 'Flamingo',
    description: 'Bird character',
    icon: '🦩',
    url: '/characters/flamingo.glb',
  },
  {
    id: 'parrot',
    label: 'Parrot',
    description: 'Colorful bird',
    icon: '🦜',
    url: '/characters/parrot.glb',
  },
  {
    id: 'stork',
    label: 'Stork',
    description: 'Flying bird',
    icon: '🕊️',
    url: '/characters/stork.glb',
  },
];
