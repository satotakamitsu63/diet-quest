import { useEffect, useState } from 'react';
import { loadPrivateAvatarImage } from '../lib/privateAvatarStore';
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
    let url: string | null = null;
    setHasImageError(false);
    setImageUrl(null);
    if (!profile.avatarEnabled) return () => undefined;
    void loadPrivateAvatarImage(profile, level)
      .then((nextUrl) => {
        url = nextUrl;
        if (active) setImageUrl(nextUrl);
        else if (nextUrl) URL.revokeObjectURL(nextUrl);
      })
      .catch(() => active && setHasImageError(true));
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [profile, level, refreshKey]);

  if (!profile.avatarEnabled || hasImageError || !imageUrl) {
    return (
      <MascotArt
        species={profile.species}
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
