import type { CSSProperties } from 'react';
import { profilePicture } from '../../features/profile/profilePicture';
import './ProfilePicture.css';

/** Diameter in px for each place a picture shows. */
const SIZES = { sm: 34, md: 48, lg: 120 } as const;

type ProfilePictureProps = {
  /** A picture id; none (or an unknown id) shows the default silhouette. */
  pictureId?: string | null;
  size?: keyof typeof SIZES;
  /** Read out for the picture, e.g. "Your profile picture". Leave out when a name is shown beside it. */
  label?: string;
};

/** A round, outlined profile picture. Pixel art stays crisp at any size. */
export function ProfilePicture({ pictureId, size = 'md', label }: ProfilePictureProps) {
  const picture = profilePicture(pictureId);
  const style = { '--pfp-size': `${SIZES[size]}px` } as CSSProperties;

  return (
    <span
      className="profile-picture"
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {picture ? <img src={picture.src} alt="" /> : <DefaultPicture />}
    </span>
  );
}

/** The gray silhouette shown when there's no picture. */
function DefaultPicture() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <rect width="100" height="100" fill="#c8c8c8" />
      <circle cx="50" cy="40" r="19" fill="#fff" />
      <ellipse cx="50" cy="98" rx="34" ry="30" fill="#fff" />
    </svg>
  );
}
