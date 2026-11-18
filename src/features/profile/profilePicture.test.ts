import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'

// The store reads localStorage when it loads, so each test gets a fresh copy.
async function freshStore() {
  vi.resetModules()
  return import('./profilePicture')
}

describe('profile pictures', () => {
  beforeEach(() => {
    fakeLocalStorage()
  })

  it('starts with the default picture for everyone', async () => {
    const { getProfilePicture } = await freshStore()
    expect(getProfilePicture('member-1')).toBeNull()
  })

  it('saves each account separately and keeps them after a reload', async () => {
    const first = await freshStore()
    first.setProfilePicture('member-1', 'frog')
    first.setProfilePicture('guest-1', 'wolf')
    const reloaded = await freshStore()
    expect(reloaded.getProfilePicture('member-1')).toBe('frog')
    expect(reloaded.getProfilePicture('guest-1')).toBe('wolf')
    expect(reloaded.getProfilePicture('member-2')).toBeNull()
  })

  it('goes back to the default when cleared', async () => {
    const { getProfilePicture, setProfilePicture } = await freshStore()
    setProfilePicture('member-1', 'bear')
    setProfilePicture('member-1', null)
    expect(getProfilePicture('member-1')).toBeNull()
  })

  it('ignores unknown or corrupt saved pictures', async () => {
    localStorage.setItem('bigwalk.profilePictures', '{"member-1":"dragon","member-2":"bird"}')
    const store = await freshStore()
    expect(store.getProfilePicture('member-1')).toBeNull()
    expect(store.getProfilePicture('member-2')).toBe('bird')
    localStorage.setItem('bigwalk.profilePictures', 'not json')
    expect((await freshStore()).getProfilePicture('member-2')).toBeNull()
  })

  it('looks up pictures by id, with no picture for unknown ids', async () => {
    const { PROFILE_PICTURES, isProfilePictureId, profilePicture } = await freshStore()
    expect(PROFILE_PICTURES.map((p) => p.id)).toEqual(['bear', 'bird', 'pigeon', 'frog', 'wolf'])
    expect(isProfilePictureId('frog')).toBe(true)
    expect(isProfilePictureId('dragon')).toBe(false)
    expect(profilePicture('frog')?.label).toBe('Frog')
    expect(profilePicture(null)).toBeUndefined()
    expect(profilePicture('dragon')).toBeUndefined()
  })

  it('shows every opponent as "Opponent" with the default picture until the server sends profiles', async () => {
    const { opponentProfile } = await freshStore()
    expect(opponentProfile()).toEqual({ name: 'Opponent', picture: null })
  })
})
