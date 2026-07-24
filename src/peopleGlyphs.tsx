/**
 * The passengers — the little crowd that gathers under a station's name while a train sits in it.
 *
 * From OpenMoji's colour set, the same project the landmark icons and the karma faces come from, so
 * the CC BY-SA credit the app already carries covers them. A spread of `person` and `person-role`
 * between them, so a crowd looks like a crowd and not like one commuter cloned.
 *
 * Front-facing busts only, and that has to be checked per figure rather than assumed by group. The
 * obvious ones — walking, running, dancing — are plainly in profile and read as people going
 * somewhere else rather than people waiting on a platform. But a few otherwise ordinary figures are
 * drawn side-on too (the pregnant one is, so that the belly reads), and those look just as wrong
 * among a row of faces. Anything added here should be eyeballed before it ships.
 *
 * Their own directory, because `scripts/fetch-openmoji.mjs` wipes the landmark one on every run and
 * these aren't in the travel-places group it refetches. Fetched from
 * https://cdn.jsdelivr.net/npm/openmoji@17.0.0/color/svg/<hexcode>.svg, as published — nothing
 * rewritten. jsDelivr rather than the unpkg the icon script uses: unpkg serves what it has cached
 * promptly but times out fetching anything cold, which is most of a set being assembled for the
 * first time. The professions are ZWJ sequences, so their filenames carry the joiners and, for the
 * few built on a bare symbol (health worker, judge, pilot), a trailing FE0F.
 */
const PEOPLE_SVGS = import.meta.glob('./assets/openmoji-people/*.svg', {
  eager: true,
  query: '?raw',
  import: 'default',
}) as Record<string, string>

/** Each figure's inner markup, its outer <svg> stripped so it can nest under the map's own SVG with
 * a fresh viewBox. Computed once at load, in a stable order so nothing depends on glob ordering. */
const PEOPLE: string[] = Object.keys(PEOPLE_SVGS)
  .sort()
  .map(path => PEOPLE_SVGS[path].replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, ''))

/** The drawn size of one passenger, and the gap between two of them. */
export const PERSON_SIZE = 13
export const PERSON_GAP = 1

/** How wide a row of `count` passengers runs — what the caller centres. */
export function peopleRowWidth(count: number): number {
  return count > 0 ? count * PERSON_SIZE + (count - 1) * PERSON_GAP : 0
}

/**
 * A handful of distinct passengers, picked at random.
 *
 * Distinct because a crowd of identical figures reads as a repeat rather than as people, so this
 * draws without replacement and gives up early if the set is somehow smaller than asked for.
 */
export function pickPeople(count: number): number[] {
  const pool = PEOPLE.map((_, i) => i)
  const picked: number[] = []
  for (let i = 0; i < count && pool.length > 0; i++) {
    picked.push(...pool.splice(Math.floor(Math.random() * pool.length), 1))
  }
  return picked
}

/** One passenger, nested into the map's own <svg>. */
export function PersonGlyph({ index, x, y, size }: { index: number; x: number; y: number; size: number }) {
  const inner = PEOPLE[index]
  if (!inner) return null
  return (
    <svg x={x} y={y} width={size} height={size} viewBox="0 0 72 72" aria-hidden dangerouslySetInnerHTML={{ __html: inner }} />
  )
}
