import { useEffect, useState } from 'react';
import { buildMascotArtwork, type MascotShape } from '../art/mascot';
import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';

type Props = {
  species: CharacterSpecies;
  shapeValue: number;
  growthStage: number;
  condition: CharacterCondition;
  /** 表示サイズ(px)。指定がなければ CSS 側の .mascot-art の大きさに従う */
  size?: number;
  animate?: boolean;
};

function renderShape(shape: MascotShape, index: number, outlineColor: string, outlineWidth: number) {
  const stroke = 'stroked' in shape && shape.stroked ? outlineColor : undefined;
  const strokeWidth = stroke ? outlineWidth : undefined;

  switch (shape.kind) {
    case 'gradient-def':
      return (
        <linearGradient
          key={index}
          id={shape.id}
          x1={`${shape.x1}%`}
          y1={`${shape.y1}%`}
          x2={`${shape.x2}%`}
          y2={`${shape.y2}%`}
        >
          <stop offset="0%" stopColor={shape.from} />
          <stop offset="100%" stopColor={shape.to} />
        </linearGradient>
      );
    case 'ellipse':
      return (
        <ellipse
          key={index}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          fill={shape.fill}
          opacity={shape.opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
          transform={shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined}
        />
      );
    case 'circle':
      return (
        <circle
          key={index}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill={shape.fill}
          opacity={shape.opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      );
    case 'ring':
      return (
        <circle
          key={index}
          cx={shape.cx}
          cy={shape.cy}
          r={shape.r}
          fill="none"
          stroke={shape.stroke}
          strokeWidth={shape.width}
          opacity={shape.opacity}
        />
      );
    case 'path':
      return (
        <path
          key={index}
          d={shape.d}
          fill={shape.fill}
          opacity={shape.opacity}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      );
    case 'line':
      return (
        <line
          key={index}
          x1={shape.x1}
          y1={shape.y1}
          x2={shape.x2}
          y2={shape.y2}
          stroke={shape.stroke}
          strokeWidth={shape.width}
          strokeLinecap="round"
          opacity={shape.opacity}
        />
      );
    default:
      return null;
  }
}

/** 体型・成長段階・調子から、まるくてかわいいベクターキャラクターを描く。 */
export function MascotArt({ species, shapeValue, growthStage, condition, size = 96, animate = true }: Props) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animate) return undefined;
    const timer = window.setInterval(() => setFrame((current) => (current === 0 ? 1 : 0)), 760);
    return () => window.clearInterval(timer);
  }, [animate]);

  const artwork = buildMascotArtwork({ species, shapeValue, growthStage, condition, frame });

  return (
    <svg
      viewBox={artwork.viewBox}
      width={size}
      height={size}
      className="mascot-art"
      aria-label="キャラクター"
      role="img"
    >
      <defs>{artwork.shapes.filter((shape) => shape.kind === 'gradient-def').map((shape, index) => renderShape(shape, index, artwork.outlineColor, artwork.outlineWidth))}</defs>
      {artwork.shapes
        .filter((shape) => shape.kind !== 'gradient-def')
        .map((shape, index) => renderShape(shape, index, artwork.outlineColor, artwork.outlineWidth))}
    </svg>
  );
}
