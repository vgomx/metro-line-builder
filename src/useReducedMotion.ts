import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/**
 * Whether the person using this has asked their system for less movement.
 *
 * Worth taking seriously here rather than treating as a nicety: for someone with vestibular
 * sensitivity, large things sliding across a screen can cause real nausea, and this app moves
 * a great deal — a whole map eases under the viewport every time a line is framed, panels
 * slide in and out, markers land and bounce, deleted lines shatter.
 *
 * Most of that is handled in CSS, which can reach every keyframe and transition at once. This
 * is for the rest: the animations driven by JavaScript, which a stylesheet can't see.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(QUERY).matches
}

/** The same preference as React state, for components that need to re-render when it flips. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)

  useEffect(() => {
    const query = window.matchMedia(QUERY)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  return reduced
}
