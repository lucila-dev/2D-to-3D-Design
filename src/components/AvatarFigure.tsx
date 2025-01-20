import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Center } from '@react-three/drei';
import type { Group } from 'three';
import { useDesignStore } from '../store/designStore';
import {
  avatarItemColor,
  avatarItemStyle,
  type AvatarConfig,
} from '../constants/avatarCatalog';

function bodyScale(style: string): [number, number, number] {
  switch (style) {
    case 'slim':
      return [0.85, 1.05, 0.85];
    case 'athletic':
      return [1.05, 1.08, 0.95];
    case 'stocky':
      return [1.2, 0.95, 1.15];
    case 'tall':
      return [0.95, 1.2, 0.95];
    case 'petite':
      return [0.8, 0.85, 0.8];
    case 'wide':
      return [1.25, 1, 1.1];
    case 'hero':
      return [1.15, 1.15, 1.05];
    default:
      return [1, 1, 1];
  }
}

function Hair({ style, color }: { style: string; color: string }) {
  if (style === 'none') return null;
  const mat = <meshStandardMaterial color={color} roughness={0.75} />;

  if (style === 'buzz' || style === 'crew') {
    return (
      <mesh position={[0, 1.52, 0]} scale={[1.02, 0.55, 1.02]} castShadow>
        <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
        {mat}
      </mesh>
    );
  }
  if (style === 'spiky' || style === 'mohawk') {
    return (
      <group>
        {[-0.06, 0, 0.06].map((x, i) => (
          <mesh key={i} position={[x, 1.62, 0]} rotation={[0.15, 0, x * 2]} castShadow>
            <coneGeometry args={[0.05, 0.22, 5]} />
            {mat}
          </mesh>
        ))}
      </group>
    );
  }
  if (style === 'bun' || style === 'ponytail') {
    return (
      <group>
        <mesh position={[0, 1.52, 0]} scale={[1.05, 0.7, 1.05]} castShadow>
          <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
          {mat}
        </mesh>
        <mesh position={[0, style === 'bun' ? 1.72 : 1.35, style === 'bun' ? 0 : -0.18]} castShadow>
          <sphereGeometry args={[style === 'bun' ? 0.09 : 0.08, 12, 12]} />
          {mat}
        </mesh>
      </group>
    );
  }
  if (style === 'long' || style === 'braids' || style === 'curly') {
    return (
      <group>
        <mesh position={[0, 1.5, 0]} scale={[1.08, 0.75, 1.08]} castShadow>
          <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
          {mat}
        </mesh>
        <mesh position={[0, 1.15, -0.05]} castShadow>
          <boxGeometry args={[0.38, 0.45, 0.18]} />
          {mat}
        </mesh>
      </group>
    );
  }
  if (style === 'afro') {
    return (
      <mesh position={[0, 1.58, 0]} castShadow>
        <sphereGeometry args={[0.28, 16, 16]} />
        {mat}
      </mesh>
    );
  }
  if (style === 'bob' || style === 'bowl') {
    return (
      <mesh position={[0, 1.48, 0]} scale={[1.1, 0.85, 1.1]} castShadow>
        <sphereGeometry args={[0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7]} />
        {mat}
      </mesh>
    );
  }
  // short / messy / side-part default
  return (
    <mesh position={[0, 1.52, 0]} scale={[1.05, 0.65, 1.05]} castShadow>
      <sphereGeometry args={[0.22, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58]} />
      {mat}
    </mesh>
  );
}

function Eyes({ style, color }: { style: string; color: string }) {
  const scale =
    style === 'wide' ? 1.25 : style === 'narrow' || style === 'sleepy' ? 0.75 : style === 'almond' ? 1.1 : 1;
  const y = style === 'sleepy' ? 1.42 : 1.45;
  const z = 0.18;
  return (
    <group>
      {([-1, 1] as const).map((side) => (
        <group key={side} position={[side * 0.08, y, z]}>
          <mesh scale={[scale, style === 'almond' ? 0.7 : 1, 1]} castShadow>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0, 0, 0.02]} scale={[0.55 * scale, 0.55, 0.55]}>
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Accessory({ style, hairColor }: { style: string; hairColor: string }) {
  if (style === 'none') return null;
  if (style === 'glasses' || style === 'sunglasses') {
    const lens = style === 'sunglasses' ? '#111827' : '#93c5fd';
    return (
      <group position={[0, 1.45, 0.2]}>
        <mesh position={[-0.08, 0, 0]}>
          <torusGeometry args={[0.045, 0.008, 8, 16]} />
          <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <torusGeometry args={[0.045, 0.008, 8, 16]} />
          <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[-0.08, 0, 0]}>
          <circleGeometry args={[0.035, 16]} />
          <meshStandardMaterial color={lens} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0.08, 0, 0]}>
          <circleGeometry args={[0.035, 16]} />
          <meshStandardMaterial color={lens} transparent opacity={0.55} />
        </mesh>
      </group>
    );
  }
  if (style === 'cap' || style === 'beanie' || style === 'crown') {
    return (
      <mesh position={[0, 1.68, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, style === 'crown' ? 0.12 : 0.1, 16]} />
        <meshStandardMaterial
          color={style === 'crown' ? '#fbbf24' : style === 'beanie' ? hairColor : '#1d4ed8'}
          metalness={style === 'crown' ? 0.7 : 0.1}
          roughness={0.45}
        />
      </mesh>
    );
  }
  if (style === 'headphones') {
    return (
      <group position={[0, 1.48, 0]}>
        <mesh position={[-0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0.24, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 12]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>
    );
  }
  if (style === 'scarf') {
    return (
      <mesh position={[0, 1.12, 0.05]} castShadow>
        <torusGeometry args={[0.14, 0.04, 8, 20]} />
        <meshStandardMaterial color="#dc2626" roughness={0.9} />
      </mesh>
    );
  }
  if (style === 'backpack') {
    return (
      <mesh position={[0, 0.95, -0.18]} castShadow>
        <boxGeometry args={[0.28, 0.32, 0.12]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
    );
  }
  if (style === 'earrings') {
    return (
      <group>
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * 0.2, 1.4, 0]}>
            <sphereGeometry args={[0.02, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" metalness={0.8} roughness={0.25} />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

function buildFromConfig(config: AvatarConfig) {
  const body = avatarItemStyle('body', config.body, 'average');
  const skin = avatarItemColor('skin', config.skin, '#c68642');
  const hairStyle = avatarItemStyle('hairStyle', config.hairStyle, 'short');
  const hairColor = avatarItemColor('hairColor', config.hairColor, '#1a1a1a');
  const eyes = avatarItemStyle('eyes', config.eyes, 'round');
  const eyeColor = avatarItemColor('eyeColor', config.eyeColor, '#3b82f6');
  const top = avatarItemStyle('top', config.top, 'tee');
  const topColor = avatarItemColor('topColor', config.topColor, '#3b82f6');
  const bottom = avatarItemStyle('bottom', config.bottom, 'jeans');
  const bottomColor = avatarItemColor('bottomColor', config.bottomColor, '#374151');
  const shoes = avatarItemStyle('shoes', config.shoes, 'sneakers');
  const shoeColor = avatarItemColor('shoeColor', config.shoeColor, '#111827');
  const accessory = avatarItemStyle('accessory', config.accessory, 'none');
  const scale = bodyScale(body);

  const topH = top === 'crop' ? 0.22 : top === 'dress' || top === 'cloak' ? 0.55 : 0.38;
  const topY = top === 'crop' ? 1.05 : 0.95;
  const bottomH = bottom === 'shorts' || bottom === 'skirt' ? 0.28 : 0.45;
  const shoeH = shoes === 'bare' ? 0.02 : shoes === 'heels' ? 0.1 : 0.08;

  return {
    skin,
    hairStyle,
    hairColor,
    eyes,
    eyeColor,
    top,
    topColor,
    topH,
    topY,
    bottom,
    bottomColor,
    bottomH,
    shoes,
    shoeColor,
    shoeH,
    accessory,
    scale,
  };
}

export function AvatarFigure() {
  const config = useDesignStore((s) => s.avatarConfig);
  const autoRotate = useDesignStore((s) => s.autoRotate);
  const groupRef = useRef<Group>(null);
  const parts = useMemo(() => buildFromConfig(config), [config]);

  useFrame(() => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y += 0.008;
    }
  });

  return (
    <Center top>
      <group ref={groupRef} scale={parts.scale}>
        {/* Head */}
        <mesh position={[0, 1.45, 0]} castShadow>
          <sphereGeometry args={[0.2, 24, 24]} />
          <meshStandardMaterial color={parts.skin} roughness={0.65} />
        </mesh>
        {/* Neck */}
        <mesh position={[0, 1.22, 0]} castShadow>
          <cylinderGeometry args={[0.06, 0.07, 0.1, 12]} />
          <meshStandardMaterial color={parts.skin} roughness={0.65} />
        </mesh>
        <Hair style={parts.hairStyle} color={parts.hairColor} />
        <Eyes style={parts.eyes} color={parts.eyeColor} />
        <Accessory style={parts.accessory} hairColor={parts.hairColor} />

        {/* Torso / top */}
        <mesh position={[0, parts.topY, 0]} castShadow>
          <boxGeometry
            args={[
              parts.top === 'tank' || parts.top === 'vest' ? 0.38 : 0.42,
              parts.topH,
              0.22,
            ]}
          />
          <meshStandardMaterial color={parts.topColor} roughness={0.7} />
        </mesh>

        {/* Arms */}
        {([-1, 1] as const).map((side) => (
          <group key={side}>
            <mesh position={[side * 0.28, 1.0, 0]} castShadow>
              <capsuleGeometry args={[0.055, 0.28, 4, 8]} />
              <meshStandardMaterial
                color={parts.top === 'tank' || parts.top === 'vest' ? parts.skin : parts.topColor}
                roughness={0.7}
              />
            </mesh>
            <mesh position={[side * 0.28, 0.72, 0]} castShadow>
              <sphereGeometry args={[0.05, 12, 12]} />
              <meshStandardMaterial color={parts.skin} roughness={0.65} />
            </mesh>
          </group>
        ))}

        {/* Bottom */}
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry
            args={[
              parts.bottom === 'skirt' ? 0.4 : 0.36,
              parts.bottomH,
              parts.bottom === 'skirt' ? 0.28 : 0.2,
            ]}
          />
          <meshStandardMaterial color={parts.bottomColor} roughness={0.75} />
        </mesh>

        {/* Legs */}
        {([-1, 1] as const).map((side) => (
          <mesh key={side} position={[side * 0.1, 0.28, 0]} castShadow>
            <capsuleGeometry args={[0.06, 0.28, 4, 8]} />
            <meshStandardMaterial
              color={parts.bottom === 'shorts' || parts.bottom === 'skirt' ? parts.skin : parts.bottomColor}
              roughness={0.75}
            />
          </mesh>
        ))}

        {/* Shoes */}
        {parts.shoes !== 'bare' &&
          ([-1, 1] as const).map((side) => (
            <mesh key={side} position={[side * 0.1, parts.shoeH / 2, 0.04]} castShadow>
              <boxGeometry args={[0.12, parts.shoeH, 0.2]} />
              <meshStandardMaterial color={parts.shoeColor} roughness={0.55} />
            </mesh>
          ))}
      </group>
    </Center>
  );
}
