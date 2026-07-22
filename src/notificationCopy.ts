/**
 * The Gazette's voice. Each map event becomes a headline with a bit of civic bluster — the tone
 * of a small-town transit authority that takes itself gladly too seriously. A few variants each,
 * so a run of the same kind of edit doesn't read as a stuck record.
 */

// Deliberately not seeded/deterministic — a headline's exact wording carries no state and never
// needs to reproduce, so a plain random pick is fine here.
function pick(options: string[]): string {
  return options[Math.floor(Math.random() * options.length)]
}

function lineLabel(name: string, number: number): string {
  const trimmed = name.trim()
  return trimmed || `Line ${number}`
}

export const notificationCopy = {
  founded: (mapName: string) => {
    const name = mapName.trim() || 'A new city'
    return pick([
      `📰 EXTRA! ${name} is founded — the map is drawn and the network begins.`,
      `${name} rises from the drawing board. Let the trains run!`,
      `A transit authority is born: ${name} opens for business.`,
    ])
  },

  renamedMap: (from: string, to: string) => {
    const before = from.trim() || 'The untitled map'
    const after = to.trim()
    return pick([
      `By civic decree, ${before} shall henceforth be known as ${after}.`,
      `${before} is renamed ${after}. New signage is already on order.`,
      `The city formerly called ${before} answers to ${after} now.`,
    ])
  },

  lineOpened: (name: string, number: number, stops: number) => {
    const label = lineLabel(name, number)
    const calling = stops > 0 ? ` — ${stops} station${stops === 1 ? '' : 's'} and counting` : ''
    return pick([
      `Ribbon cut! The ${label} opens for service${calling}.`,
      `The ${label} enters service today${calling}. Mind the gap.`,
      `A new line on the map: the ${label} is running${calling}.`,
    ])
  },

  lineExtended: (name: string, number: number, added: number) => {
    const label = lineLabel(name, number)
    const stops = `${added} new stop${added === 1 ? '' : 's'}`
    return pick([
      `The ${label} extends its reach — ${stops} added to the timetable.`,
      `End of the line, no more: the ${label} grows by ${stops}.`,
      `Commuters rejoice — the ${label} pushes on with ${stops}.`,
    ])
  },

  companyFounded: (name: string) => {
    const label = name.trim() || 'A new operator'
    return pick([
      `A new operator enters the market: ${label}.`,
      `${label} hangs out its shingle, ready to run the rails.`,
      `Say hello to ${label}, the latest name in local transit.`,
    ])
  },

  lineConceded: (lineName: string, lineNumber: number, company: string) => {
    const label = lineLabel(lineName, lineNumber)
    const operator = company.trim() || 'a private operator'
    return pick([
      `Concession granted: the ${label} passes to ${operator}.`,
      `The ${label} changes hands — ${operator} takes the reins.`,
      `${operator} wins the ${label}. The paperwork, they say, was thrilling.`,
    ])
  },

  lineReturned: (lineName: string, lineNumber: number) => {
    const label = lineLabel(lineName, lineNumber)
    return pick([
      `The ${label} returns to public hands. The authority thanks you for your patience.`,
      `Back under municipal control: the ${label} is public once more.`,
      `The ${label} comes home to the local authority.`,
    ])
  },

  stationMilestone: (count: number) => {
    return pick([
      `Milestone! The network reaches its ${count}th station.`,
      `${count} stations and growing — the map is filling out nicely.`,
      `A round of applause: station number ${count} joins the network.`,
    ])
  },
}
