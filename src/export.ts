import type { DataSnapshot } from './state/useMapState'

/** Bump if the on-disk shape ever changes in a way loadMap can't backfill on its own. */
const FILE_FORMAT_VERSION = 1

export function exportMapAsJson(snapshot: DataSnapshot) {
  const payload = {
    formatVersion: FILE_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    ...snapshot,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const fileName = `${snapshot.mapName.trim().replace(/\s+/g, '-').toLowerCase() || 'metro-map'}.json`

  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Opens a file picker for a previously-exported map and hands the parsed JSON to onLoad. */
export function pickMapFile(onLoad: (data: unknown) => void, onError: (message: string) => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json,.json'
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        onLoad(JSON.parse(reader.result as string))
      } catch {
        onError(`"${file.name}" isn't valid JSON.`)
      }
    }
    reader.onerror = () => onError(`Couldn't read "${file.name}".`)
    reader.readAsText(file)
  }
  input.click()
}
