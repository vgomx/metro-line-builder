import { Dialog } from 'metro-ds'

interface ShortcutsDialogProps {
  open: boolean
  onClose: () => void
}

/** Whether this machine calls the modifier Cmd or Ctrl. Read once — nobody changes platform
 * mid-session, and getting it wrong means the reference is lying on half the desktops. */
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'

/**
 * Grouped by when you'd need them rather than alphabetically or by key, because someone
 * opening this is stuck in the middle of something and looking for the group they're in.
 *
 * The drawing group is the reason this dialog exists: Enter, Backspace and Escape all do
 * something specific to a half-drawn line and none of them are written anywhere except a
 * hint that shows once and leaves.
 */
const GROUPS: { title: string; items: { keys: string[]; what: string }[] }[] = [
  {
    title: 'Tools',
    items: [
      { keys: ['V'], what: 'Select' },
      { keys: ['P'], what: 'Draw line' },
      { keys: ['S'], what: 'Add station' },
      { keys: ['H'], what: 'Pan' },
      { keys: ['R'], what: 'Draw river' },
      { keys: ['G'], what: 'Draw park' },
      { keys: ['I'], what: 'Place a landmark' },
    ],
  },
  {
    title: 'While drawing',
    items: [
      { keys: ['Enter'], what: 'Finish the line or shape' },
      { keys: ['Backspace'], what: 'Take back the last point' },
      { keys: ['Esc'], what: 'Cancel the draft, then put the tool down' },
    ],
  },
  {
    title: 'Editing',
    items: [
      { keys: ['Double-click'], what: 'Rename a station on the canvas' },
      { keys: ['Delete'], what: 'Delete what’s selected' },
      { keys: [MOD, 'Z'], what: 'Undo' },
      { keys: [MOD, '⇧', 'Z'], what: 'Redo' },
      { keys: ['Esc'], what: 'Clear the selection' },
    ],
  },
  {
    title: 'View',
    items: [
      { keys: ['Scroll'], what: 'Pan the map' },
      { keys: ['Pinch'], what: 'Zoom' },
      { keys: ['Space', 'drag'], what: 'Pan without putting the current tool down' },
      { keys: ['?'], what: 'This list' },
    ],
  },
]

/**
 * The shortcuts, all in one place.
 *
 * Until now they were taught one at a time by tooltips, which works for the seven tool keys
 * that have a button to hover and not at all for the ten that don't. Enter to finish a line
 * had exactly one mention, in a hint that disappears after ten seconds and never returns.
 */
export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Keyboard shortcuts" width="480px">
      {/* Four groups of shortcuts is taller than a laptop viewport, and Dialog neither caps
          its height nor scrolls — so without this the list runs off both ends of the screen
          with the title cut off above it. svh rather than vh so a mobile browser's retracting
          toolbar doesn't crop the last group. */}
      <div
        style={{
          maxHeight: 'calc(100svh - 200px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--gap-lg)',
        }}
      >
        {GROUPS.map(group => (
          <div key={group.title} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '4px',
              }}
            >
              {group.title}
            </div>
            {group.items.map(item => (
              <div
                key={item.what}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--gap-md)',
                  padding: '5px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)', flex: 1 }}>{item.what}</span>
                <span style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                  {item.keys.map(key => (
                    <kbd
                      key={key}
                      style={{
                        padding: '2px 6px',
                        minWidth: '22px',
                        textAlign: 'center',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        borderBottomWidth: '2px',
                        background: 'var(--bg-subtle)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </Dialog>
  )
}
