// Chart colours. Recharts needs literal colour values (CSS variables are not supported in SVG attributes),
// so neutrals use semi-transparent greys that read correctly on both the light and the dark theme.
export const CHART = {
  primary: '#4f55ee', // indigo accent (reads in both themes)
  grid: 'rgba(128, 128, 128, 0.18)',
  axisLine: 'rgba(128, 128, 128, 0.35)',
  axisText: '#8c8c8c', // mid grey: readable on white and on charcoal
  cursor: 'rgba(128, 128, 128, 0.10)',
  track: 'rgba(128, 128, 128, 0.25)', // empty legend underline / tracks
};

export const AXIS_TICK = { fontSize: 12, fill: CHART.axisText };

// Categorical series (no status meaning), led by the accent.
export const SERIES = ['#4f55ee', '#14b8a6', '#8b5cf6', '#f59e0b', '#3b82f6', '#ec4899'];
