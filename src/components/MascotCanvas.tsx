import { useEffect, useRef, useState } from 'react';
import { SPRITE_SIZE, buildMascotGrid } from '../art/mascot';
import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';

type Props = {
  species: CharacterSpecies;
  shapeValue: number;
  growthStage: number;
  condition: CharacterCondition;
  /** 1ドットあたりの画面上の大きさ */
  pixelSize?: number;
  animate?: boolean;
};

export function MascotCanvas({
  species,
  shapeValue,
  growthStage,
  condition,
  pixelSize = 8,
  animate = true,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!animate) return undefined;
    const timer = window.setInterval(() => setFrame((current) => (current === 0 ? 1 : 0)), 720);
    return () => window.clearInterval(timer);
  }, [animate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const grid = buildMascotGrid({ species, shapeValue, growthStage, condition, frame });
    context.clearRect(0, 0, canvas.width, canvas.height);
    for (let y = 0; y < SPRITE_SIZE; y += 1) {
      for (let x = 0; x < SPRITE_SIZE; x += 1) {
        const color = grid[y][x];
        if (!color) continue;
        context.fillStyle = color;
        context.fillRect(x * pixelSize, y * pixelSize, pixelSize, pixelSize);
      }
    }
  }, [species, shapeValue, growthStage, condition, frame, pixelSize]);

  // canvas の width/height は描画解像度。画面上の大きさは CSS 側で決める
  const side = SPRITE_SIZE * pixelSize;
  return (
    <canvas
      ref={canvasRef}
      width={side}
      height={side}
      className="mascot-canvas"
      aria-label="キャラクター"
      role="img"
    />
  );
}
