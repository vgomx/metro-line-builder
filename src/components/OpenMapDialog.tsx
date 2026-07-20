import { useMemo } from 'react'
import { Button, Dialog } from 'metro-ds'
import { FolderOpenIcon, TrashIcon } from '../icons'
import type { LibrarySummary } from '../state/mapLibrary'

interface OpenMapDialogProps {
  open: boolean
  onClose: () => void
  maps: LibrarySummary[]
  /** The map already on the canvas, which is listed but can't be opened onto itself. */
  currentId: string
  onOpenMap: (id: string) => void
  onForgetMap: (id: string) => void
  onImportFile: () => void
}

const THUMB_W = 104
const THUMB_H = 62
const THUMB_PAD = 6

/** "3 minutes ago" beats a timestamp for a list whose whole ordering is recency — the useful
 * question is which of these is the one from just now, not what o'clock it was. */
function relativeTime(then: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - then) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  return new Date(then).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * A map's own shape, small.
 *
 * Worth the trouble because a list of names is nearly useless here: the names are generated
 * and half of them are two syllables of nonsense, so the thing that actually tells one city
 * from another is what it looks like. Scaled to fit whatever bounding box the routes happen
 * to occupy, which means a sprawling network and a three-station stub both fill the tile.
 */
function Thumbnail({ routes }: { routes: LibrarySummary['routes'] }) {
  const paths = useMemo(() => {
    const all = routes.flatMap(route => route.points)
    if (all.length === 0) return null

    const xs = all.map(p => p.x)
    const ys = all.map(p => p.y)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minY = Math.min(...ys)
    const maxY = Math.max(...ys)
    // A single-point-wide network would divide by zero; 1 keeps the scale finite and the
    // result centred, which is the right answer for a map that is essentially one dot.
    const spanX = Math.max(maxX - minX, 1)
    const spanY = Math.max(maxY - minY, 1)
    const scale = Math.min((THUMB_W - THUMB_PAD * 2) / spanX, (THUMB_H - THUMB_PAD * 2) / spanY)
    const offsetX = (THUMB_W - spanX * scale) / 2
    const offsetY = (THUMB_H - spanY * scale) / 2

    return routes.map(route => ({
      color: route.color,
      d: route.points
        .map((p, i) => `${i === 0 ? 'M' : 'L'}${(p.x - minX) * scale + offsetX} ${(p.y - minY) * scale + offsetY}`)
        .join(' '),
    }))
  }, [routes])

  return (
    <svg
      width={THUMB_W}
      height={THUMB_H}
      viewBox={`0 0 ${THUMB_W} ${THUMB_H}`}
      style={{
        flexShrink: 0,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-page)',
        border: '1px solid var(--border-subtle)',
      }}
      aria-hidden="true"
    >
      {paths?.map((path, i) => (
        <path key={i} d={path.d} fill="none" stroke={path.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/**
 * Opening a map.
 *
 * This used to be a bare file picker, which quietly assumed the only map worth opening was
 * one you'd already exported — while the app has been keeping every map you've worked on in
 * the browser with no way to reach any of them but the last. The list is those maps. The file
 * picker is still here, because a file is the only copy that survives a cleared browser.
 *
 * Which is the reason for the notice at the bottom. Browser storage is not a filing cabinet:
 * it goes when the cache is cleared, when a browser reclaims space from a site it hasn't seen
 * in a while, and always in a private window. Saying so once, where the consequence is
 * visible, is worth more than a warning nobody reads on the way in.
 */
export function OpenMapDialog({ open, onClose, maps, currentId, onOpenMap, onForgetMap, onImportFile }: OpenMapDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Open a map" width="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-lg)' }}>
        <div style={{ maxHeight: 'calc(100svh - 340px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {maps.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-5) var(--space-4)',
                textAlign: 'center',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                border: '1px dashed var(--border-default)',
                borderRadius: 'var(--radius-lg)',
              }}
            >
              No maps saved on this device yet.
              <br />
              Anything you draw is kept here automatically.
            </div>
          ) : (
            maps.map(map => {
              const isCurrent = map.id === currentId
              return (
                <div
                  key={map.id}
                  className="mlb-row"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--gap-md)',
                    padding: 'var(--gap-sm)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <Thumbnail routes={map.routes} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--text-sm)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {map.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {map.lineCount} line{map.lineCount === 1 ? '' : 's'} · {map.stationCount} station
                      {map.stationCount === 1 ? '' : 's'} · {relativeTime(map.savedAt)}
                    </div>
                  </div>
                  {isCurrent ? (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', paddingRight: '4px' }}>Open now</span>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => onOpenMap(map.id)}>
                      Open
                    </Button>
                  )}
                  <button
                    type="button"
                    aria-label={`Remove ${map.name} from this device`}
                    onClick={() => onForgetMap(map.id)}
                    disabled={isCurrent}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '6px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      color: isCurrent ? 'var(--text-disabled)' : 'var(--text-muted)',
                      cursor: isCurrent ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              )
            })
          )}
        </div>

        <Button variant="secondary" icon={<FolderOpenIcon />} onClick={onImportFile}>
          Import from a file…
        </Button>

        <div
          style={{
            display: 'flex',
            gap: 'var(--gap-sm)',
            padding: 'var(--gap-md)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-subtle)',
            fontSize: 'var(--text-xs)',
            lineHeight: 1.6,
            color: 'var(--text-secondary)',
          }}
        >
          <span aria-hidden="true" style={{ fontSize: '14px', lineHeight: 1.2 }}>
            ⚠️
          </span>
          <span>
            <strong style={{ color: 'var(--text-primary)' }}>These maps live in this browser only.</strong> Clearing your
            browsing data removes them, and they don&rsquo;t follow you to another device or another browser. For anything
            you&rsquo;d be sorry to lose, use <strong>Export</strong> now and then and keep the file somewhere of your own.
          </span>
        </div>
      </div>
    </Dialog>
  )
}
