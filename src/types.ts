export interface Station {
  id: string
  name: string
  x: number
  y: number
  transfer: boolean
}

export interface Line {
  id: string
  name: string
  color: string
  stationIds: string[]
  visible: boolean
}

export type Tool = 'select' | 'add-station' | 'draw-line' | 'pan'
