/**
 * ZzFX ships as plain JS with no types and has no @types package, so this declares the
 * surface `sound.ts` uses, checked against node_modules/zzfx/ZzFX.js. Deliberately partial:
 * the library also exports a ZZFXSound class and note helpers we don't touch, and typing
 * those from the outside would only invite them to drift.
 */
declare module 'zzfx' {
  /** Builds and plays a sound from ZzFX's 20 positional parameters. */
  export function zzfx(...parameters: number[]): AudioBufferSourceNode

  export const ZZFX: {
    /** Master scale applied on top of each sound's own volume parameter. */
    volume: number
    sampleRate: number
    /** Constructed at import time, so it arrives suspended until a user gesture resumes it. */
    audioContext: AudioContext
    play(...parameters: number[]): AudioBufferSourceNode
    /** Renders a sound's samples without playing it. */
    buildSamples(...parameters: number[]): number[]
  }
}
