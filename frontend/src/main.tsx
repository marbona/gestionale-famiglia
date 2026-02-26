import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { CssBaseline, ThemeProvider, createTheme, useMediaQuery } from '@mui/material'; // Added imports

const Root = () => {
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: prefersDarkMode ? 'dark' : 'light',
          primary: {
            main: prefersDarkMode ? '#90caf9' : '#1976d2', // Example blue
          },
          secondary: {
            main: prefersDarkMode ? '#f48fb1' : '#dc004e', // Example pink
          },
        },
      }),
    [prefersDarkMode],
  );

  return (
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline /> {/* CssBaseline kickstart an elegant, consistent, and simple baseline to build upon. */}
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(<Root />);
