import { characterImagePath } from '../lib/characterArt';
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

/** 体型・成長段階・調子から、手描きイラスト（public/characters）の該当ページを表示する。 */
export function MascotArt({ species, shapeValue, growthStage, condition, size = 96, animate = true }: Props) {
  const src = `${import.meta.env.BASE_URL}${characterImagePath(species, shapeValue, growthStage)}`;

  const conditionClass =
    condition === 'exhausted' ? 'mascot-art-exhausted' : condition === 'tired' ? 'mascot-art-tired' : '';

  return (
    <img
      src={src}
      width={size}
      height={size}
      className={['mascot-art', animate ? 'mascot-art-animate' : '', conditionClass].filter(Boolean).join(' ')}
      alt="キャラクター"
    />
  );
}
