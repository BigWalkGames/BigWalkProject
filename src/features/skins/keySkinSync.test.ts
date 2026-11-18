import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeLocalStorage } from '../../tests/wordEngineFixtures'

const supabase = vi.hoisted(() => ({ current: null as unknown }))
vi.mock('../../lib/supabase', () => ({ getSupabase: () => supabase.current }))

type RpcResult = { data: unknown; error: unknown }

// Stands in for Supabase: the two skin functions, with a controllable reply.
class FakeSkinSupabase {
  equipped: unknown
  saves: string[] = []
  failSaves = false
  failLoad = false
  /** Holds the next load until release() is called. */
  private held: ((value: RpcResult) => void) | null = null
  holdLoad = false

  constructor(equipped: unknown = 'classic') {
    this.equipped = equipped
  }

  rpc = async (fn: string, args?: { p_skin: string }): Promise<RpcResult> => {
    if (fn === 'get_my_keyboard_skin') {
      if (this.failLoad) return { data: null, error: new Error('offline') }
      if (this.holdLoad) return new Promise((resolve) => (this.held = resolve))
      return { data: this.equipped, error: null }
    }
    if (fn === 'equip_keyboard_skin') {
      if (this.failSaves) return { data: null, error: new Error('offline') }
      this.saves.push(args!.p_skin)
      this.equipped = args!.p_skin
      return { data: null, error: null }
    }
    throw new Error(`Unexpected rpc: ${fn}`)
  }

  release() {
    this.held?.({ data: this.equipped, error: null })
  }
}

// The store and the sync module keep state at module level, so each test loads fresh copies.
async function setUp(equipped: unknown = 'classic') {
  const fake = new FakeSkinSupabase(equipped)
  supabase.current = fake
  vi.resetModules()
  const sync = await import('./keySkinSync')
  const store = await import('./keySkins')
  return { fake, sync, store }
}

beforeEach(() => {
  fakeLocalStorage()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('keyboard skin sync', () => {
  it("loads a Member's equipped skin from their account", async () => {
    const { sync, store } = await setUp('wood')
    await sync.loadKeySkin('member-1')
    expect(store.getKeySkin('member-1')).toBe('wood')
  })

  it("replaces this device's skin with the account's", async () => {
    const { sync, store } = await setUp('classic')
    store.setKeySkin('member-1', 'mint')
    await sync.loadKeySkin('member-1')
    expect(store.getKeySkin('member-1')).toBe('classic')
  })

  it('keeps the current skin when the account has an unknown ID', async () => {
    const { sync, store } = await setUp('lava')
    store.setKeySkin('member-1', 'mint')
    await sync.loadKeySkin('member-1')
    expect(store.getKeySkin('member-1')).toBe('mint')
  })

  it("keeps this device's skin when loading fails", async () => {
    const { fake, sync, store } = await setUp('wood')
    fake.failLoad = true
    store.setKeySkin('member-1', 'mint')
    await sync.loadKeySkin('member-1')
    expect(store.getKeySkin('member-1')).toBe('mint')
  })

  it('keeps a pick made while the account is loading', async () => {
    const { fake, sync, store } = await setUp('wood')
    fake.holdLoad = true
    const loading = sync.loadKeySkin('member-1')
    await sync.equipKeySkin('member-1', 'speckle', true)
    fake.release()
    await loading
    expect(store.getKeySkin('member-1')).toBe('speckle')
    expect(fake.saves).toEqual(['speckle'])
  })

  it('equips right away and saves to the account for a Member', async () => {
    const { fake, sync, store } = await setUp()
    const saved = sync.equipKeySkin('member-1', 'wood', true)
    expect(store.getKeySkin('member-1')).toBe('wood')
    await saved
    expect(fake.saves).toEqual(['wood'])
  })

  it('saves quick picks in order, ending on the last one', async () => {
    const { fake, sync } = await setUp()
    void sync.equipKeySkin('member-1', 'wood', true)
    void sync.equipKeySkin('member-1', 'mint', true)
    await sync.equipKeySkin('member-1', 'speckle', true)
    expect(fake.saves).toEqual(['wood', 'mint', 'speckle'])
    expect(fake.equipped).toBe('speckle')
  })

  it('keeps the skin on this device when saving fails', async () => {
    const { fake, sync, store } = await setUp()
    fake.failSaves = true
    await sync.equipKeySkin('member-1', 'wood', true)
    expect(store.getKeySkin('member-1')).toBe('wood')
    expect(console.warn).toHaveBeenCalled()
  })

  it('never saves for a guest', async () => {
    const { fake, sync } = await setUp()
    await sync.equipKeySkin('guest-1', 'classic', false)
    expect(fake.saves).toEqual([])
  })
})
