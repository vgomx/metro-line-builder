import { Badge, Button, Divider, Input } from 'metro-ds'
import { PlusIcon } from '../icons'
import { CompanySymbolIcon } from '../companySymbols'
import type { Company } from '../types'

interface CompaniesPanelProps {
  companies: Company[]
  selectedCompanyId: string | null
  onSelect: (companyId: string) => void
  onAddCompany: () => void
  mapName: string
  authorityName: string
  onSetAuthorityName: (name: string) => void
}

export function CompaniesPanel({
  companies,
  selectedCompanyId,
  onSelect,
  onAddCompany,
  mapName,
  authorityName,
  onSetAuthorityName,
}: CompaniesPanelProps) {
  const syncedName = `${mapName.trim() || 'Untitled Map'} Transit Authority`

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--gap-sm)' }}>
        <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--text-secondary)' }}>
          Local Transport Authority
        </label>
        <Input
          size="sm"
          value={authorityName}
          placeholder={syncedName}
          onChange={e => onSetAuthorityName(e.target.value)}
        />
        {authorityName ? (
          <button
            type="button"
            onClick={() => onSetAuthorityName('')}
            style={{
              alignSelf: 'flex-start',
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-link)',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Sync with map name
          </button>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Synced with the map name</span>
        )}
      </div>

      <Divider />

      {companies.length === 0 && (
        <p style={{ padding: 'var(--space-4)', color: 'var(--text-muted)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          No companies yet. Lines with no company belong to the Local Transport Authority.
        </p>
      )}

      {companies.map(company => {
        const isSelected = company.id === selectedCompanyId
        return (
          <div
            key={company.id}
            onClick={() => onSelect(company.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--gap-sm)',
              padding: '8px 12px',
              cursor: 'pointer',
              background: isSelected ? 'var(--color-info-bg)' : 'transparent',
              borderLeft: `3px solid ${isSelected ? 'var(--interactive-primary)' : 'transparent'}`,
            }}
          >
            <span style={{ color: 'var(--text-muted)', flexShrink: 0, display: 'flex' }}>
              <CompanySymbolIcon symbol={company.symbol} />
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-primary)',
                fontWeight: isSelected ? 500 : 400,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {company.name}
            </span>
            <Badge variant={company.type === 'public' ? 'primary' : 'outline'} style={{ fontSize: '9px', padding: '1px 6px' }}>
              {company.type === 'public' ? 'Public' : 'Private'}
            </Badge>
          </div>
        )
      })}

      <div style={{ padding: '8px 12px' }}>
        <Button
          size="sm"
          variant="ghost"
          icon={<PlusIcon />}
          onClick={onAddCompany}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          Add company
        </Button>
      </div>
    </div>
  )
}
