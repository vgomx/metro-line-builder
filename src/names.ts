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
