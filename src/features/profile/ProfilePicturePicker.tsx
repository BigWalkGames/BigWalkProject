import { ProfilePicture } from '../../components/ProfilePicture/ProfilePicture'
import { useAuth } from '../../hooks/auth/useAuth'
import { menuMoveSound } from '../audio/menuSounds'
import { playSound } from '../audio/sound'
import { PROFILE_PICTURES, setProfilePicture, type ProfilePictureId } from './profilePicture'
import { useMyProfilePicture } from './useMyProfilePicture'
import './ProfilePicturePicker.css'

const CHOICES: { id: ProfilePictureId | null; label: string }[] = [
  { id: null, label: 'Default' },
  ...PROFILE_PICTURES.map(({ id, label }) => ({ id, label })),
]

/**
 * "Change profile picture" on the Account Profile tab. Picking one updates every
 * screen showing the player's picture right away (saved in this browser for now;
 * see profilePicture.ts for the M8 database TODO).
 */
export function ProfilePicturePicker() {
  const { user } = useAuth()
  const selected = useMyProfilePicture()

  return (
    <section className="pfp-picker" aria-labelledby="pfp-picker-title">
      <h2 id="pfp-picker-title" className="pfp-picker__title">Change profile picture</h2>
      <div className="pfp-picker__options" role="group" aria-label="Profile pictures">
        {CHOICES.map(({ id, label }) => (
          <button
            key={label}
            type="button"
            className="pfp-picker__option"
            aria-pressed={selected === id}
            aria-label={label}
            title={label}
            onClick={() => {
              playSound('menuSelect')
              setProfilePicture(user?.id ?? 'local', id)
            }}
            {...menuMoveSound}
          >
            <ProfilePicture pictureId={id} size="lg" />
          </button>
        ))}
      </div>
    </section>
  )
}
