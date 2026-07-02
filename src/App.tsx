import { Button, IconButton, LineIndicator, Toolbar } from 'metro-ds'
import { useMapState } from './state/useMapState'
import { MapCanvas } from './canvas/MapCanvas'
import type { Tool } from './types'

const CursorIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M3 2l10 4.2-4 1.3-1.3 4L3 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
)
const PlusIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
)
const LineIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <circle cx="3" cy="13" r="1.75" fill="currentColor" />
    <circle cx="13" cy="3" r="1.75" fill="currentColor" />
    <path d="M4.2 11.8L11.8 4.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

function App() {
  const {
    state,
    stationList,
    lineList,
    setTool,
    addStation,
    moveStations,
    addToDraftLine,
    finishDraftLine,
    cancelDraftLine,
    setSelection,
    clearSelection,
    deleteSelected,
  } = useMapState()

  const tools: { tool: Tool; label: string; icon: JSX.Element }[] = [
    { tool: 'select', label: 'Select', icon: <CursorIcon /> },
    { tool: 'add-station', label: 'Add station', icon: <PlusIcon /> },
    { tool: 'draw-line', label: 'Draw line', icon: <LineIcon /> },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100svh' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--gap-md)' }}>
          <LineIndicator id="1" color="var(--brand-500)" shape="pill" />
          <h1 style={{ fontSize: 'var(--text-xl)', margin: 0 }}>Metro Line Builder</h1>
        </div>
        {state.draftLineStationIds.length >= 2 && (
          <Button variant="primary" onClick={finishDraftLine}>
            Finish line ({state.draftLineStationIds.length} stations)
          </Button>
        )}
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: 'var(--space-3)',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <Toolbar orientation="vertical">
            {tools.map(({ tool, label, icon }) => (
              <IconButton
                key={tool}
                icon={icon}
                label={label}
                active={state.tool === tool}
                onClick={() => setTool(tool)}
              />
            ))}
          </Toolbar>

          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              lineHeight: 1.6,
              color: 'var(--text-muted)',
              width: '120px',
              margin: 0,
            }}
          >
            SCROLL ZOOM
            <br />
            SPACE+DRAG PAN
            <br />
            DEL REMOVES
          </p>
        </aside>

        <main style={{ flex: 1, minWidth: 0 }}>
          <MapCanvas
            tool={state.tool}
            stationList={stationList}
            lineList={lineList}
            stations={state.stations}
            selectedStationIds={state.selectedStationIds}
            selectedLineIds={state.selectedLineIds}
            draftLineStationIds={state.draftLineStationIds}
            onAddStation={addStation}
            onMoveStations={moveStations}
            onAddToDraftLine={addToDraftLine}
            onFinishDraftLine={finishDraftLine}
            onCancelDraftLine={cancelDraftLine}
            onSetSelection={setSelection}
            onClearSelection={clearSelection}
            onDeleteSelected={deleteSelected}
          />
        </main>
      </div>
    </div>
  )
}

export default App
