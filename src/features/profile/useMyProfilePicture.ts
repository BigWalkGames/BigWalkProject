import { useAuth } from '../../hooks/auth/useAuth'
import { useProfilePicture, type ProfilePictureId } from './profilePicture'

/** The signed-in player's picture (Guest or Member), or null for the default. */
export function useMyProfilePicture(): ProfilePictureId | null {
  const { user } = useAuth()
  return useProfilePicture(user?.id ?? 'local')
}
