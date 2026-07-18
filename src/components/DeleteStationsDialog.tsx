import { createPortal } from 'react-dom'
import { Button, Dialog, Tag } from 'metro-ds'

interface DeleteStationsDialogProps {
  open: boolean
  /** What's being deleted, as it should read in the title — "Delete Piccadilly Line?" */
  title: string
  /** Every station the lines being deleted call at, whether or not it's at stake. */
  totalStationCount: number
  /** Names of the stations no surviving line would serve, in the order they'd be removed. */
  atRisk: string[]
  onCancel: () => void
  onKeep: () => void
  onDeleteAll: () => void
}

/**
 * The question a line's deletion raises: its stations outlive it by default, which is right
 * when another route still calls at them and tidying-up work when nothing does.
 *
 * Shared by both ways a line can be deleted — the button in the Inspector and the Delete key
 * on the canvas — so the two can't drift into asking differently about the same thing. The
 * caller decides whether the question is worth asking at all; this only renders it.
 *
 * Portalled to the body for the same reason the More menu's dialogs are: the panel it's
 * invoked from is frosted, and a backdrop-filter makes the element the containing block for
 * any fixed descendant, which would lay the dialog out inside a 272px column.
 */
export function DeleteStationsDialog({
  open,
  title,
  totalStationCount,
  atRisk,
  onCancel,
  onKeep,
  onDeleteAll,
}: DeleteStationsDialogProps) {
  const shared = totalStationCount - atRisk.length

  return createPortal(
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      width="440px"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={onKeep}>
            Keep stations
          </Button>
          <Button variant="destructive" size="sm" onClick={onDeleteAll}>
            Delete {atRisk.length} station{atRisk.length === 1 ? '' : 's'} too
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--gap-md)' }}>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          {atRisk.length} of the {totalStationCount} stations served are served by no other line. They can go too, or
          stay on the map for another route to pick up.
        </p>
        {shared > 0 && (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            The other {shared} also {shared === 1 ? 'serves' : 'serve'} another line and {shared === 1 ? 'is' : 'are'}{' '}
            kept either way.
          </p>
        )}
        {/* Named rather than only counted: three tags are cheaper to check than a number is
            to trust, and this is the last moment before they're gone. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--gap-tight)' }}>
          {atRisk.map(name => (
            <Tag key={name}>{name}</Tag>
          ))}
        </div>
      </div>
    </Dialog>,
    document.body,
  )
}
