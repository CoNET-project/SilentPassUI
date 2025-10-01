// src/pages/PitchDesks/theme.js

export const theme = {
  // Define all colors in one place for consistency
  colors: {
    primary: '#ffffff',      // Main text color
    secondary: '#00BFFF',    // Accent color
    tertiary: '#8A94A0',     // Sub-text or muted color
    background: '#1D2129',   // Slide background
    text: '#ffffff',         // Default text color
  },
  // Define fonts
  fonts: {
    header: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    text: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  // Define font sizes for different elements
  fontSizes: {
    h1: '72px',
    h2: '56px',
    h3: '48px',
    text: '24px',
    monospace: '20px',
  },
  // Define global styles for slide elements
  styles: {
    h1: {
      color: 'primary',
      fontWeight: 'bold',
    },
    h2: {
      color: 'primary',
      fontWeight: 'bold',
    },
    h3: {
      color: 'primary',
    },
    p: {
      color: 'primary',
      margin: '20px 0',
    },
  },
};