import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Box } from '@mui/material';
import Navigation from './components/Navigation';
import HomePage from './pages/HomePage';
import LargeAdvancesPage from './pages/LargeAdvancesPage';
import AdminPage from './pages/AdminPage';

function App() {
  return (
    <Router>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navigation />
        <Box component="main" sx={{ flexGrow: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/large-advances" element={<LargeAdvancesPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </Box>
      </Box>
    </Router>
  );
}

export default App;
