import { zzfx, ZZFX } from 'zzfx'

/**
 * UI sounds, synthesised rather than sampled. ZzFX (MIT, ~1kB) builds each sound from
 * parameters at play time, so the app ships no audio files — which is what makes a sound
 * layer proportionate here at all.
 *
 * The vocabulary is deliberately small and quiet: this is a drawing tool, and a map takes
 * dozens of clicks to build, so anything with personality would wear out within a minute.
 * Every patch is a sine (shape 0) with a short envelope — the softest thing ZzFX makes,
 * closer to a station chime than to a game blip.
 */

const STORAGE_KEY = 'metro-line-builder:sound'

/**
 * Master gain, applied at the output on top of each patch's own volume parameter.
 *
 * Don't read this as "quiet" on its own — the two stages multiply, and the trim already
 * happened upstream. ZzFX's sample builder bakes in a ~0.3 scale (a patch at volume 1 peaks
 * at .297), then this multiplies again at the gain node. So a patch's real output is roughly
 * 0.3 x its volume x this. The patches below sit at .45–.6 rather than 1, which is where the
 * restraint lives; holding this at ZzFX's own default lands them near .045 peak, about half
 * the library's typical .089. Turning this down as well would attenuate twice and make the
 * whole set inaudible.
 */
const MASTER_VOLUME = 0.3

/**
 * ZzFX parameter lists, in its own positional order:
 * volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide,
 * deltaSlide, pitchJump, pitchJumpTime, repeatTime, noise, modulation, bitCrush, delay,
 * sustainVolume, decay, tremolo.
 *
 * Only the first handful matter here; the rest stay at defaults. Pitch carries the meaning —
 * the scale rises from a tool tick through placing a station, and falls for a deletion.
 */
const PATCHES = {
  /** Picking a tool: the lightest tick in the set — it fires on every keyboard shortcut too. */
  tool: [0.5, 0.02, 1400, 0.001, 0.01, 0.04, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.02],
  /** A toggle landing (grid, trains, theme, sound itself): the tick, a note lower. */
  toggle: [0.5, 0.02, 900, 0.001, 0.012, 0.05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.02],
  /** Dropping a station: a clean pip, the sound the map makes most often after a tool tick. */
  station: [0.6, 0.03, 880, 0.002, 0.03, 0.09, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.05],
  /** Each node while drawing a line: below the station pip, so a run of them stays a texture
   * rather than a melody competing with it. */
  node: [0.45, 0.03, 520, 0.002, 0.02, 0.06, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.03],
  /** Finishing a line — the one two-note sound, a door chime's falling third. pitchJump is
   * negative so it settles rather than asks a question. */
  lineDone: [0.55, 0.02, 784, 0.004, 0.12, 0.16, 0, 1, 0, 0, -196, 0.09, 0, 0, 0, 0, 0, 0.6, 0.1],
  /** Deleting: the only descending patch, so it can't be mistaken for placing something. */
  remove: [0.5, 0.02, 460, 0.002, 0.04, 0.11, 0, 1, -3, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.06],
  /** A whole city arriving at once, so it earns a little more than a tick. */
  generate: [0.5, 0.03, 523, 0.01, 0.16, 0.2, 0, 1, 0, 0, 262, 0.12, 0, 0, 0, 0, 0, 0.6, 0.12],
} satisfies Record<string, number[]>

export type SoundName = keyof typeof PATCHES

function loadEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  } catch {
    return true
  }
}

// Read by playSound, which is called from event handlers rather than from React, so the
// live value lives here and the hook below mirrors it into the UI.
let enabled = loadEnabled()

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(next: boolean) {
  enabled = next
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // A blocked localStorage shouldn't cost the user their sound toggle for this session.
  }
}

/**
 * Plays one of the patches, if sound is on.
 *
 * ZzFX constructs its AudioContext when this module is imported, which browsers hand back
 * suspended until the user has interacted with the page — so it needs resuming or every
 * sound is discarded silently. Doing it here works because there's no path to a sound that
 * isn't already inside a user gesture.
 */
export function playSound(name: SoundName) {
  if (!enabled) return
  try {
    const context = ZZFX.audioContext
    if (context.state === 'suspended') void context.resume()
    ZZFX.volume = MASTER_VOLUME
    zzfx(...PATCHES[name])
  } catch {
    // Audio is decoration. A browser that refuses it shouldn't take the interaction with it.
  }
}
