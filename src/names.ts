// Curated so an auto-named station lands as somewhere you'd want to get off, not
// "Station 14". Plausible-but-whimsical, leaning gently British-transit.
const STATION_NAMES = [
  'Foxglove', 'Tin Harbour', 'Old Bellow', 'Marlowe Cross', 'Bramble End', 'Hollowmere',
  'Pewter Lane', 'Saffron Gate', 'Quill Street', 'Nettlebed', 'Copperwick', 'Thistledown',
  'Larkspur', 'Wexford', 'Mossgill', 'Dabchick', 'Fenwick', 'Bracken Hollow', 'Sparrowmoor',
  'Grindle', 'Yarrow', 'Puddleford', "Wren's Nook", 'Ambleside', 'Cinderford', 'Elderwick',
  'Frostpenny', 'Gullswater', 'Hobbs End', 'Ironmonger Row', 'Juniper Bank', 'Kettleby',
  'Lampwick', 'Mallowfield', 'Nutbourne', 'Otterspool', 'Plumtree', 'Ravenscourt', 'Snodgrass',
  'Tuppence Lane', 'Underhill', 'Vesper', 'Wobblegate', 'Yewbarrow', 'Zephyr Quay', 'Barnaby',
  'Crumblewell', 'Drumble', 'Gadwall', 'Harebell', 'Inglenook', 'Jackdaw', 'Kestrel Rise',
  'Loam', 'Marmalade Wharf', 'Nightingale', 'Oxlip', 'Pennywhistle', 'Rookery', 'Sedgemoor',
]

// Single evocative words, formatted as "<word> Line" — the London idiom (Victoria, Jubilee).
const LINE_WORDS = [
  'Kingfisher', 'Marmalade', 'Damson', 'Peppercorn', 'Cobalt', 'Verdigris', 'Firefly',
  'Halcyon', 'Mistletoe', 'Clementine', 'Wisteria', 'Vermillion', 'Mackerel', 'Harlequin',
  'Nightjar', 'Gingersnap', 'Solstice', 'Periwinkle', 'Buttercup', 'Cardinal', 'Goldcrest',
  'Heron', 'Bramble', 'Tanager', 'Moonshadow', 'Pemberton', 'Emberly', 'Foxtrot', 'Juniper',
  'Quicksilver',
]

// Playful city / authority names for a fresh or generated map.
const MAP_NAMES = [
  'Port Wobble', 'Greater Nubbin', 'New Dabble', 'Fizzlewick', 'Mudlark City', 'Puddleton',
  'Brollyhaven', 'Snugborough', 'Twizzleton', 'Lower Piddle', 'Nooksbury', 'Wobbleton-on-Sea',
  'Grumbleside', 'Fiddlewick', 'Bumbleford', 'Dawdlington', 'Squelchford', 'Tootleby',
  'Marmaladeshire', 'Crumpetshire', 'Pockle', 'Gnomesby', 'Higgleton', 'Sprocketwich',
]

/**
 * Operator names, built rather than listed.
 *
 * Real transit operators are named to a formula, which is why "VIA Metro" and "Metrolink" sound
 * like companies and "Company 1" sounds like a placeholder. Three formulas cover almost all of
 * them, and between them they produce a few hundred names — far more than a hand-written bank,
 * and every one of them plausible.
 *
 * Corporate on purpose, against a map full of Puddleford and Wren's Nook. A private operator
 * moving into a town called Port Wobble would arrive with a name like this, and the contrast
 * between the two is the joke: the city is whimsical, the company that bought its trains is not.
 * The authority keeps the city's own name, so the two registers sit side by side.
 */
const OPERATOR_QUALIFIERS = [
  'Urban', 'Metropolitan', 'Central', 'Northern', 'Southern', 'Coastal', 'Civic', 'United',
  'Crown', 'Regional', 'Capital', 'Union', 'Pioneer', 'Meridian', 'Imperial', 'Grand',
]

/** What an operator says it runs. Plural and singular both read as a company. */
const OPERATOR_MODES = ['Rail', 'Metro', 'Transit', 'Subways', 'Lines', 'Railways', 'Transport', 'Tramways']

/** The short all-caps mark a company fronts its name with — VIA Rail, SNCF, MTR. */
const OPERATOR_MARKS = ['VIA', 'NOVA', 'OMNI', 'AXIS', 'ORBIS', 'APEX']

/**
 * One-word compounds. Curated rather than cross-produced: stem and suffix collide in ways a
 * formula can't see coming ("Rail" + "line" gives Railline), and a name is either a word or it
 * isn't.
 */
const OPERATOR_COMPOUNDS = [
  'Metrolink', 'Metroway', 'Metroline', 'Metrorail', 'Metrospan', 'Translink', 'Transway',
  'Transrail', 'Raillink', 'Railspan', 'Crossrail', 'Crosslink', 'Crossway', 'Tramlink',
  'Tramway', 'Interlink', 'Loopline', 'Trackway', 'Vialink', 'Viarail',
]

/** "Metropolitan Metro" — a qualifier that already contains its mode says it twice. */
function saysItTwice(qualifier: string, mode: string): boolean {
  const a = qualifier.toLowerCase()
  const b = mode.toLowerCase()
  return a.startsWith(b) || b.startsWith(a)
}

export const COMPANY_NAMES = [
  ...OPERATOR_QUALIFIERS.flatMap(qualifier =>
    OPERATOR_MODES.filter(mode => !saysItTwice(qualifier, mode)).map(mode => `${qualifier} ${mode}`),
  ),
  ...OPERATOR_MARKS.flatMap(mark => OPERATOR_MODES.map(mode => `${mark} ${mode}`)),
  ...OPERATOR_COMPOUNDS,
]

function pickUnused(pool: string[], taken: Set<string>): string {
  const free = pool.filter(name => !taken.has(name))
  if (free.length > 0) return free[Math.floor(Math.random() * free.length)]
  // Bank exhausted (a very large map) — fall back to a numbered variant that stays unique.
  const base = pool[Math.floor(Math.random() * pool.length)]
  let n = 2
  while (taken.has(`${base} ${n}`)) n++
  return `${base} ${n}`
}

/** A whimsical station name not in `taken` (the names already on the map). */
export function pickStationName(taken: Set<string>): string {
  return pickUnused(STATION_NAMES, taken)
}

/** A whimsical "<word> Line" name not in `taken`. */
export function pickLineName(taken: Set<string>): string {
  return pickUnused(LINE_WORDS.map(w => `${w} Line`), taken)
}

/** A playful name for a fresh or generated map. */
export function pickMapName(): string {
  return MAP_NAMES[Math.floor(Math.random() * MAP_NAMES.length)]
}

/** A plausible operator name not in `taken` (the companies already on the map). */
export function pickCompanyName(taken: Set<string>): string {
  return pickUnused(COMPANY_NAMES, taken)
}
