export const LINE_COLORS = [
  '#C62828', // Vermelho
  '#1565C0', // Azul
  '#2E7D32', // Verde
  '#F9A825', // Amarelo
  '#6A1B9A', // Lilás
  '#00695C', // Verde-água
  '#E65100', // Laranja
  '#37474F', // Grafite
  '#AD1457', // Rosa
  '#0277BD', // Celeste
]

export function nextLineColor(usedCount: number): string {
  return LINE_COLORS[usedCount % LINE_COLORS.length]
}
