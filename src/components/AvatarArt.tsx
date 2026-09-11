import { useEffect, useState } from 'react';
import {
  loadPrivateAvatarImage,
  selectedCharacterSpecies,
  shouldDisplayPersonalAvatar,
  type AvatarImageSource,
} from '../lib/privateAvatarStore';
import type { Profile } from '../lib/types';
import type { CharacterCondition } from '../logic/score';
import { MascotArt } from './MascotArt';

type Props = {
  profile: Profile;
  shapeValue: number;
  growthStage: number;
  condition: CharacterCondition;
  size?: number;
  animate?: boolean;
  refreshKey?: number;
};

/** 生成済みなら本人キャラクター、未生成なら従来のキャラクターを表示する。 */
export function AvatarArt({ profile, shapeValue, growthStage, condition, size, animate, refreshKey = 0 }: Props) {
  const [hasImageError, setHasImageError] = useState(false);
  const level = Math.max(1, Math.min(10, growthStage + 1));
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    let image: AvatarImageSource | null = null;
    setHasImageError(false);
    setImageUrl(null);
    if (!shouldDisplayPersonalAvatar(profile)) return () => undefined;
    void loadPrivateAvatarImage(profile, level)
      .then((nextImage) => {
        image = nextImage;
        if (active) setImageUrl(nextImage?.url ?? null);
        else nextImage?.revoke();
      })
      .catch(() => active && setHasImageError(true));
    return () => {
      active = false;
      image?.revoke();
    };
  }, [profile, level, refreshKey]);

  if (!shouldDisplayPersonalAvatar(profile) || hasImageError || !imageUrl) {
    return (
      <MascotArt
        species={selectedCharacterSpecies(profile)}
        shapeValue={shapeValue}
        growthStage={growthStage}
        condition={condition}
        size={size}
        animate={animate}
      />
    );
  }

  const conditionClass = condition === 'exhausted' ? 'mascot-art-exhausted' : condition === 'tired' ? 'mascot-art-tired' : '';
  return (
    <img
      src={imageUrl}
      width={size}
      height={size}
      className={['mascot-art', 'avatar-art', animate === false ? '' : 'mascot-art-animate', conditionClass].filter(Boolean).join(' ')}
      alt={`${profile.displayName}の本人キャラクター（レベル${level}）`}
      onError={() => setHasImageError(true)}
    />
  );
}
