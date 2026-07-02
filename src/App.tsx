import { Button, LineIndicator, Toolbar, IconButton } from 'metro-ds'

function App() {
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
        <Button variant="primary">Add line</Button>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        <aside style={{ padding: 'var(--space-3)', borderRight: '1px solid var(--border-subtle)' }}>
          <Toolbar orientation="vertical">
            <IconButton icon={<span>+</span>} label="Add station" active />
            <IconButton icon={<span>/</span>} label="Draw line" />
          </Toolbar>
        </aside>
        <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
          Canvas goes here
        </main>
      </div>
    </div>
  )
}

export default App
