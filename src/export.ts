import type { Line, Station } from './types'

export function exportMapAsJson(mapName: string, stationList: Station[], lineList: Line[]) {
  const payload = {
    name: mapName,
    exportedAt: new Date().toISOString(),
    stations: stationList,
    lines: lineList,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const fileName = `${mapName.trim().replace(/\s+/g, '-').toLowerCase() || 'metro-map'}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
