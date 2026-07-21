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
  /** Taking hold of a station: the lowest, softest thing in the set. A grab isn't an edit —
   * nothing has changed yet — so it reads as a muted thunk under the pips rather than
   * alongside them, and it fires on every pick-up including ones that go nowhere. */
  grab: [0.4, 0.02, 190, 0.001, 0.02, 0.05, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.03],
  /** A drag pulling a line into a new shape. A slide rather than a fixed pitch — the one
   * sound in the set that bends, because it's the only one standing for something still in
   * motion. Fires once per drag, when the route first gives, not per frame. */
  reroute: [0.4, 0.03, 300, 0.005, 0.06, 0.1, 0, 1, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.06],
  /** A landmark landing on the map. The one weighty sound in the set: low, with a fast
   * downward slide and a touch of noise, so it reads as something with mass settling rather
   * than another pip. It answers a gesture that ends by letting go, and it can't be mistaken
   * for the station pip an octave and a half above it. */
  drop: [0.55, 0.05, 150, 0.001, 0.04, 0.14, 0, 1.4, -6, 0, 0, 0, 0, 0.12, 0, 0, 0, 0.35, 0.06],
  /** The elastic snap when a dropped line springs into its new shape. Answers `reroute` — that
   * one bends upward as the route gives, this one dips and comes back (slide down, deltaSlide
   * up) the way the easing overshoots and settles. Released on the drop, so the pair brackets
   * the drag: a stretch, then the sling. */
  snap: [0.45, 0.02, 440, 0.002, 0.05, 0.12, 0, 1, -4, 6, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.08],
  /** Deleting: the only descending patch, so it can't be mistaken for placing something. */
  remove: [0.5, 0.02, 460, 0.002, 0.04, 0.11, 0, 1, -3, 0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.06],
  /** A whole city arriving at once, so it earns a little more than a tick. */
  generate: [0.5, 0.03, 523, 0.01, 0.16, 0.2, 0, 1, 0, 0, 262, 0.12, 0, 0, 0, 0, 0, 0.6, 0.12],
} satisfies Record<string, number[]>

export type SoundName = keyof typeof PATCHES

/**
 * Composed sounds — more than one note, scheduled. The set's only one so far is the arrival
 * chime a line selection earns: a warm two-note bell, F#5 then D5 a beat later, the sound a
 * train makes pulling into a platform. It's longer and more present than the pips on purpose,
 * because picking a line is a deliberate act rather than a rattled-off click — but it's built
 * from the same soft sine envelope, so it belongs to the same family.
 */
const SEQUENCES = {
  lineSelect: [
    { at: 0, patch: [0.5, 0.02, 740, 0.003, 0.12, 0.5, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.3] },
    { at: 260, patch: [0.55, 0.02, 587, 0.003, 0.16, 0.6, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.35] },
  ],
} satisfies Record<string, { at: number; patch: number[] }[]>

export type SequenceName = keyof typeof SEQUENCES

/** A finger rather than a mouse. Read without React so the module-load default can use it. */
function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

function loadEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'on') return true
    if (stored === 'off') return false
  } catch {
    return true
  }
  // No saved preference. On at a desk, where a click is a click and a soft tick is welcome;
  // off on a tablet, where making sound audible means overriding the silent switch (below),
  // and doing that to someone who never asked for sound would be rude. They can turn it on.
  return !isTouchDevice()
}

// Read by playSound, which is called from event handlers rather than from React, so the
// live value lives here and the hook below mirrors it into the UI.
let enabled = loadEnabled()

export function isSoundEnabled(): boolean {
  return enabled
}

export function setSoundEnabled(next: boolean) {
  enabled = next
  // Turning sound on is a click, which is the gesture the playback session needs to start —
  // so a touch user's first sound is the one right after they enable it, not the one after.
  if (next) ensurePlaybackSession()
  try {
    localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
  } catch {
    // A blocked localStorage shouldn't cost the user their sound toggle for this session.
  }
}

let unlocked = false
let playbackSession: HTMLAudioElement | null = null

/** A short silent WAV as a data URI, built rather than shipped. Mono, 8-bit, half a second —
 * a few kB, looped forever. */
function silentWavUri(): string {
  const rate = 8000
  const samples = rate / 2
  const bytes = new Uint8Array(44 + samples)
  const view = new DataView(bytes.buffer)
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + samples, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, rate, true)
  view.setUint32(28, rate, true) // byte rate
  view.setUint16(32, 1, true) // block align
  view.setUint16(34, 8, true) // bits per sample
  ascii(36, 'data')
  view.setUint32(40, samples, true)
  bytes.fill(128, 44) // 8-bit unsigned silence
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return `data:audio/wav;base64,${btoa(binary)}`
}

/**
 * Makes the app's sounds audible on an iPad with its silent switch on.
 *
 * iOS plays Web Audio in a session category the hardware mute governs, so on a silenced device
 * the synthesised sounds reach earphones but never the speaker — which is exactly the report.
 * There's no web API to change the category directly, but a rule of the platform does it for
 * us: while an HTMLMediaElement is playing, the whole page's session becomes "playback", which
 * the mute switch doesn't touch, and every sound the AudioContext makes rides along.
 *
 * So a silent clip loops quietly in the background for as long as sound is on. It must be
 * started inside a user gesture, like the context resume, and only on touch: on the desktop
 * there's no silent switch to beat, and a forever-playing media element would light the "this
 * tab is playing audio" indicator over nothing.
 */
function ensurePlaybackSession() {
  if (playbackSession || !isTouchDevice()) return
  try {
    const audio = new Audio(silentWavUri())
    audio.loop = true
    audio.volume = 0
    void audio.play().catch(() => {
      // Refused outside a gesture, or no autoplay for media. Try again on the next gesture.
      playbackSession = null
    })
    playbackSession = audio
  } catch {
    playbackSession = null
  }
}

/**
 * Wakes the audio context on the first touch, click or key the page receives.
 *
 * ZzFX builds its AudioContext when this module is imported, and every browser hands that
 * back suspended until the user has interacted. Resuming it at play time is enough on the
 * desktop, where `resume()` settles before the next line runs — but not on iOS, where it
 * resolves a turn later, so the buffer was scheduled against a context that was still asleep
 * and thrown away. Sound was simply absent on an iPad no matter what the toggle said.
 *
 * So the unlock happens once, up front, on a real gesture, and the silent one-frame buffer is
 * the part iOS actually requires: a context there has to have *played* something inside a
 * gesture before it will play anything afterwards.
 *
 * Listeners are registered whether or not sound is currently on, because the toggle can be
 * turned on later and the gesture that turns it on is not guaranteed to come again.
 */
function unlockAudio() {
  if (unlocked) return
  unlocked = true
  try {
    const context = ZZFX.audioContext
    void context.resume()
    const source = context.createBufferSource()
    source.buffer = context.createBuffer(1, 1, 22050)
    source.connect(context.destination)
    source.start(0)
    if (enabled) ensurePlaybackSession()
  } catch {
    // A browser without usable audio. Nothing here is worth interrupting anyone for.
  }
}

if (typeof window !== 'undefined') {
  const events: (keyof WindowEventMap)[] = ['pointerdown', 'touchend', 'keydown']
  const onFirstGesture = () => {
    unlockAudio()
    for (const event of events) window.removeEventListener(event, onFirstGesture)
  }
  for (const event of events) window.addEventListener(event, onFirstGesture, { passive: true })
}

/**
 * Fires one patch. The resume is a backstop for a context the browser suspended again — a tab
 * left in the background long enough, which Safari does.
 */
function emit(patch: number[]) {
  try {
    const context = ZZFX.audioContext
    if (context.state === 'suspended') void context.resume()
    ZZFX.volume = MASTER_VOLUME
    zzfx(...patch)
  } catch {
    // Audio is decoration. A browser that refuses it shouldn't take the interaction with it.
  }
}

/** Plays one of the patches, if sound is on. */
export function playSound(name: SoundName) {
  if (!enabled) return
  emit(PATCHES[name])
}

/** Plays a composed sound, scheduling each note. The on/off flag is re-checked at each note
 * rather than only up front, so muting mid-chime silences the notes still to come. */
export function playSequence(name: SequenceName) {
  if (!enabled) return
  for (const { at, patch } of SEQUENCES[name]) {
    window.setTimeout(() => {
      if (enabled) emit(patch)
    }, at)
  }
}
