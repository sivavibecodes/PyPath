export const colors = {
  bg: '#0A0E17',
  surface: '#121826',
  surfaceAlt: '#171F30',
  border: '#263045',
  text: '#E6EDF3',
  textMuted: '#8B98AE',
  primary: '#FFD43B', // Python yellow
  secondary: '#4B8BBE', // Python blue
  success: '#3FB950',
  danger: '#F85149',
  warning: '#D29922',
  xp: '#A371F7',
  streak: '#FF8A3D',
  editorBg: '#0F1420',
  key: '#232C3F',
  keyAccent: '#1E2A44',
  keyPressed: '#33405A',
  nodeLocked: '#2A3244',
} as const;

export const fonts = {
  mono: 'Menlo', // replaced with JetBrains Mono via expo-font in production builds
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
