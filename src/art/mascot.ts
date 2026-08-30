import type { CharacterSpecies } from '../lib/types';
import type { CharacterCondition } from '../logic/score';
import { buildPalette, type Palette } from './palette';

export const SPRITE_SIZE = 32;

/** 空文字は透明。それ以外は色コード。 */
export type SpriteGrid = string[][];

function createGrid(): SpriteGrid {
  return Array.from({ length: SPRITE_SIZE }, () => Array.from({ length: SPRITE_SIZE }, () => ''));
}

function setPixel(grid: SpriteGrid, x: number, y: number, color: string): void {
  const gridX = Math.round(x);
  const gridY = Math.round(y);
  if (gridX < 0 || gridY < 0 || gridX >= SPRITE_SIZE || gridY >= SPRITE_SIZE) return;
  grid[gridY][gridX] = color;
}

function fillEllipse(
  grid: SpriteGrid,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  color: string,
): void {
  for (let y = Math.floor(centerY - radiusY); y <= Math.ceil(centerY + radiusY); y += 1) {
    for (let x = Math.floor(centerX - radiusX); x <= Math.ceil(centerX + radiusX); x += 1) {
      const normalizedX = (x - centerX) / radiusX;
      const normalizedY = (y - centerY) / radiusY;
      if (normalizedX * normalizedX + normalizedY * normalizedY <= 1) setPixel(grid, x, y, color);
    }
  }
}

function fillRect(
  grid: SpriteGrid,
  left: number,
  top: number,
  right: number,
  bottom: number,
  color: string,
): void {
  for (let y = Math.round(top); y <= Math.round(bottom); y += 1) {
    for (let x = Math.round(left); x <= Math.round(right); x += 1) {
      setPixel(grid, x, y, color);
    }
  }
}

function fillTriangle(
  grid: SpriteGrid,
  apexX: number,
  apexY: number,
  halfWidth: number,
  height: number,
  color: string,
): void {
  for (let step = 0; step <= height; step += 1) {
    const spread = Math.round((halfWidth * step) / height);
    for (let x = apexX - spread; x <= apexX + spread; x += 1) {
      setPixel(grid, x, apexY + step, color);
    }
  }
}

/** 輪郭線を後から足す。塗られた画素に隣接する透明画素を輪郭色にする。 */
function addOutline(grid: SpriteGrid, color: string): void {
  const filled: Array<[number, number]> = [];
  for (let y = 0; y < SPRITE_SIZE; y += 1) {
    for (let x = 0; x < SPRITE_SIZE; x += 1) {
      if (grid[y][x] !== '') continue;
      const hasFilledNeighbour =
        (y > 0 && grid[y - 1][x] !== '') ||
        (y < SPRITE_SIZE - 1 && grid[y + 1][x] !== '') ||
        (x > 0 && grid[y][x - 1] !== '') ||
        (x < SPRITE_SIZE - 1 && grid[y][x + 1] !== '');
      if (hasFilledNeighbour) filled.push([x, y]);
    }
  }
  for (const [x, y] of filled) grid[y][x] = color;
}

function lerp(from: number, to: number, ratio: number): number {
  return from + (to - from) * Math.min(1, Math.max(0, ratio));
}

export type MascotInput = {
  species: CharacterSpecies;
  /** 0（細い）〜1（太い） */
  shapeValue: number;
  /** 0〜9 */
  growthStage: number;
  condition: CharacterCondition;
  /** 待機アニメーションのコマ。0か1 */
  frame?: number;
};

function drawEars(
  grid: SpriteGrid,
  palette: Palette,
  species: CharacterSpecies,
  headCenterX: number,
  headRadiusX: number,
  droop: number,
): void {
  if (species === 'cat') {
    // 元気がないほど耳が寝る
    const apexY = 3 + Math.round(droop * 3);
    fillTriangle(grid, headCenterX - headRadiusX + 2, apexY, 3, 6, palette.base);
    fillTriangle(grid, headCenterX + headRadiusX - 2, apexY, 3, 6, palette.base);
    fillTriangle(grid, headCenterX - headRadiusX + 2, apexY + 2, 2, 4, palette.nose);
    fillTriangle(grid, headCenterX + headRadiusX - 2, apexY + 2, 2, 4, palette.nose);
    return;
  }
  // 犬は垂れ耳。顔の横に、猫より幅広で長い耳を垂らす
  const earTop = 7 + Math.round(droop * 2);
  fillEllipse(grid, headCenterX - headRadiusX - 1, earTop + 6, 3.2, 7, palette.shade);
  fillEllipse(grid, headCenterX + headRadiusX + 1, earTop + 6, 3.2, 7, palette.shade);
}

function drawEyes(
  grid: SpriteGrid,
  palette: Palette,
  growthStage: number,
  condition: CharacterCondition,
  leftEyeX: number,
  rightEyeX: number,
  eyeY: number,
): void {
  const eyeRadius = growthStage <= 1 ? 1 : growthStage <= 4 ? 1.6 : 2.2;

  if (condition === 'exhausted') {
    // 半目にして、下に隈を入れる
    for (const eyeX of [leftEyeX, rightEyeX]) {
      fillRect(grid, eyeX - 2, eyeY, eyeX + 1, eyeY, palette.outline);
      fillRect(grid, eyeX - 2, eyeY + 2, eyeX + 1, eyeY + 2, palette.shade);
    }
    return;
  }

  for (const eyeX of [leftEyeX, rightEyeX]) {
    fillEllipse(grid, eyeX, eyeY, eyeRadius, eyeRadius + 0.4, palette.eye);
    if (growthStage >= 4) {
      setPixel(grid, eyeX - 1, eyeY - 1, palette.eyeHighlight);
      if (growthStage >= 7) setPixel(grid, eyeX + 1, eyeY + 1, palette.eyeHighlight);
    }
    if (growthStage <= 1) {
      // 目の下の隈。みすぼらしい初期状態の要
      fillRect(grid, eyeX - 2, eyeY + 2, eyeX + 1, eyeY + 2, palette.shade);
    }
  }
}

function drawMuzzle(
  grid: SpriteGrid,
  palette: Palette,
  species: CharacterSpecies,
  centerX: number,
  muzzleY: number,
  growthStage: number,
): void {
  // 犬は口吻が前に出ているので、猫より大きく下に張り出させる
  if (species === 'dog') {
    fillEllipse(grid, centerX, muzzleY + 2, 4.4, 3.2, palette.light);
  }
  fillEllipse(grid, centerX, muzzleY + 1, 3.4, 2.4, palette.light);
  setPixel(grid, centerX, muzzleY, palette.nose);
  setPixel(grid, centerX - 1, muzzleY, palette.nose);
  setPixel(grid, centerX + 1, muzzleY, palette.nose);

  if (growthStage >= 5) {
    // 口角が上がる
    setPixel(grid, centerX - 2, muzzleY + 2, palette.outline);
    setPixel(grid, centerX + 2, muzzleY + 2, palette.outline);
    setPixel(grid, centerX - 1, muzzleY + 3, palette.outline);
    setPixel(grid, centerX + 1, muzzleY + 3, palette.outline);
  } else {
    setPixel(grid, centerX, muzzleY + 2, palette.outline);
    if (growthStage <= 1) {
      // 口角が下がった不機嫌な顔
      setPixel(grid, centerX - 2, muzzleY + 1, palette.outline);
      setPixel(grid, centerX + 2, muzzleY + 1, palette.outline);
    }
  }

  if (species === 'cat' && growthStage >= 3) {
    for (const direction of [-1, 1]) {
      setPixel(grid, centerX + direction * 5, muzzleY, palette.outline);
      setPixel(grid, centerX + direction * 6, muzzleY - 1, palette.outline);
      setPixel(grid, centerX + direction * 6, muzzleY + 1, palette.outline);
    }
  }
}

/** 段階0〜1では毛が抜けた斑を入れて、見るからに手入れされていない状態にする。 */
function drawPatchyFur(
  grid: SpriteGrid,
  palette: Palette,
  centerX: number,
  bodyCenterY: number,
  bodyHalfWidth: number,
): void {
  const patches: Array<[number, number, number]> = [
    [centerX - Math.round(bodyHalfWidth * 0.5), bodyCenterY - 2, 1.8],
    [centerX + Math.round(bodyHalfWidth * 0.55), bodyCenterY + 2, 1.4],
    [centerX + 2, bodyCenterY + 4, 1.2],
  ];
  for (const [x, y, radius] of patches) {
    fillEllipse(grid, x, y, radius, radius * 0.8, palette.shade);
  }
}

function drawScruffyTufts(grid: SpriteGrid, palette: Palette, bodyHalfWidth: number): void {
  // 段階の低いうちは毛が跳ねていて、輪郭がぼろぼろに見える
  const tufts: Array<[number, number]> = [
    [16 - Math.round(bodyHalfWidth) - 1, 22],
    [16 + Math.round(bodyHalfWidth) + 1, 24],
    [16 - Math.round(bodyHalfWidth), 27],
    [10, 8],
    [22, 7],
    [16 + Math.round(bodyHalfWidth) + 1, 20],
  ];
  for (const [x, y] of tufts) setPixel(grid, x, y, palette.shade);
}

function drawAccessories(
  grid: SpriteGrid,
  palette: Palette,
  growthStage: number,
  bodyTopY: number,
  centerX: number,
  bodyHalfWidth: number,
  crownBaseY: number,
): void {
  if (growthStage >= 3) {
    // 首輪
    fillRect(grid, centerX - bodyHalfWidth + 1, bodyTopY, centerX + bodyHalfWidth - 1, bodyTopY, palette.accessoryDark);
  }
  if (growthStage >= 5) {
    // リボン
    fillTriangle(grid, centerX - 3, bodyTopY - 1, 2, 3, palette.accessory);
    fillTriangle(grid, centerX + 3, bodyTopY - 1, 2, 3, palette.accessory);
    setPixel(grid, centerX, bodyTopY, palette.accessory);
  }
  if (growthStage >= 7) {
    // 王冠。頭のてっぺんに合わせて置く
    const top = Math.max(0, crownBaseY);
    fillRect(grid, centerX - 3, top + 1, centerX + 3, top + 2, palette.accessory);
    setPixel(grid, centerX - 3, top, palette.accessory);
    setPixel(grid, centerX, top, palette.accessory);
    setPixel(grid, centerX + 3, top, palette.accessory);
  }
}

function drawSparkles(grid: SpriteGrid, palette: Palette, growthStage: number, frame: number): void {
  if (growthStage < 8) return;
  const positions: Array<[number, number]> =
    frame === 0
      ? [
          [4, 6],
          [27, 10],
          [6, 21],
          [26, 24],
        ]
      : [
          [5, 9],
          [26, 7],
          [3, 18],
          [28, 21],
        ];
  for (const [x, y] of positions) {
    setPixel(grid, x, y, palette.sparkle);
    setPixel(grid, x - 1, y, palette.aura);
    setPixel(grid, x + 1, y, palette.aura);
    setPixel(grid, x, y - 1, palette.aura);
    setPixel(grid, x, y + 1, palette.aura);
  }
}

/** 体型・成長段階・調子からドット絵の格子をつくる。 */
export function buildMascotGrid(input: MascotInput): SpriteGrid {
  const { species, condition } = input;
  const shapeValue = Math.min(1, Math.max(0, input.shapeValue));
  const growthStage = Math.min(9, Math.max(0, Math.round(input.growthStage)));
  const frame = input.frame === 1 ? 1 : 0;
  const palette = buildPalette({ species, growthStage, condition });
  const grid = createGrid();

  const droop = condition === 'exhausted' ? 1 : condition === 'tired' ? 0.5 : 0;
  const bounce = frame === 1 && condition !== 'exhausted' ? -1 : 0;

  const centerX = 16;
  // 体型は胴の幅にいちばん強く出る。頬と足の太さにも少しだけ効かせる
  const bodyHalfWidth = lerp(4.5, 11, shapeValue);
  const bodyCenterY = 24 + bounce;
  const bodyRadiusY = lerp(5.5, 7, shapeValue);
  const bodyTopY = Math.round(bodyCenterY - bodyRadiusY);

  const headRadiusX = lerp(7, 8.8, shapeValue * 0.6);
  const headRadiusY = lerp(6.4, 7.4, shapeValue * 0.5);
  // 段階が低いうちは頭が落ちて猫背に見える
  const slouch = growthStage <= 1 ? 2 : growthStage <= 3 ? 1 : 0;
  const headCenterY = 12 + bounce + Math.round(droop) + slouch;

  // 尻尾
  if (species === 'cat') {
    const tailY = frame === 1 ? 20 : 22;
    fillEllipse(grid, centerX + bodyHalfWidth + 3, tailY + 2, 1.4, 4.5, palette.shade);
    fillEllipse(grid, centerX + bodyHalfWidth + 2, tailY + 6, 1.4, 2, palette.shade);
  } else {
    fillEllipse(grid, centerX + bodyHalfWidth + 2, 23 + (frame === 1 ? -1 : 1), 2, 2.6, palette.shade);
  }

  // 足
  const footWidth = Math.round(lerp(2, 3.4, shapeValue));
  fillRect(grid, centerX - bodyHalfWidth + 1, 29, centerX - bodyHalfWidth + footWidth, 30, palette.shade);
  fillRect(grid, centerX + bodyHalfWidth - footWidth, 29, centerX + bodyHalfWidth - 1, 30, palette.shade);

  // 胴
  fillEllipse(grid, centerX, bodyCenterY, bodyHalfWidth, bodyRadiusY, palette.base);
  fillEllipse(grid, centerX, bodyCenterY + 1, bodyHalfWidth * 0.55, bodyRadiusY * 0.7, palette.light);

  if (shapeValue < 0.15) {
    // がりがりのときは肋が浮いて見える
    for (const offset of [-2, 0, 2]) {
      fillRect(grid, centerX - 2, bodyCenterY + offset, centerX + 2, bodyCenterY + offset, palette.shade);
    }
  }

  drawEars(grid, palette, species, centerX, headRadiusX, droop);

  // 頭
  fillEllipse(grid, centerX, headCenterY, headRadiusX, headRadiusY, palette.base);
  if (shapeValue > 0.78) {
    // 頬がふくらむ
    fillEllipse(grid, centerX - headRadiusX + 1, headCenterY + 2, 2.4, 2.2, palette.base);
    fillEllipse(grid, centerX + headRadiusX - 1, headCenterY + 2, 2.4, 2.2, palette.base);
  }

  drawEyes(grid, palette, growthStage, condition, centerX - 3, centerX + 3, headCenterY);
  drawMuzzle(grid, palette, species, centerX, headCenterY + 4, growthStage);

  if (growthStage >= 6 && condition !== 'exhausted') {
    fillEllipse(grid, centerX - 6, headCenterY + 3, 1.6, 1.2, palette.blush);
    fillEllipse(grid, centerX + 6, headCenterY + 3, 1.6, 1.2, palette.blush);
  }

  if (growthStage <= 2) drawScruffyTufts(grid, palette, bodyHalfWidth);
  if (growthStage <= 1) drawPatchyFur(grid, palette, centerX, bodyCenterY, bodyHalfWidth);

  // 猫は立ち耳の上、犬は頭のてっぺんに王冠が乗るようにする
  const crownBaseY =
    species === 'cat' ? 1 + Math.round(droop * 3) : Math.round(headCenterY - headRadiusY) - 3;
  drawAccessories(
    grid,
    palette,
    growthStage,
    bodyTopY,
    centerX,
    Math.round(bodyHalfWidth),
    crownBaseY,
  );

  addOutline(grid, palette.outline);

  if (condition === 'exhausted') {
    // 汗の雫
    setPixel(grid, centerX + Math.round(headRadiusX) + 1, headCenterY - 3, '#8ec9e8');
    setPixel(grid, centerX + Math.round(headRadiusX) + 1, headCenterY - 2, '#8ec9e8');
  }

  drawSparkles(grid, palette, growthStage, frame);

  return grid;
}

export const GROWTH_STAGE_NAMES = [
  'よれよれ',
  'ぼさぼさ',
  'すこし整った',
  '毛づやが出た',
  '目に光が戻った',
  'きれいになってきた',
  '見違えた',
  '自慢の姿',
  '輝いている',
  '完成された姿',
];
