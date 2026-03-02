import React from 'react';
import { AppBar, Toolbar, Button, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';

function Navigation() {
  const location = useLocation();

  const navItems = [
    { to: '/', label: 'Spese\nMensili', icon: <HomeIcon /> },
    { to: '/vista-anno', label: 'Vista\nAnno', icon: <CalendarMonthIcon /> },
    { to: '/large-advances', label: 'Grossi\nAnticipi', icon: <AccountBalanceWalletIcon /> },
    { to: '/major-expenses', label: 'Grosse\nSpese', icon: <TrendingUpIcon /> },
    { to: '/admin', label: 'Admin', icon: <SettingsIcon /> },
  ];

  return (
    <AppBar position="static">
      <Toolbar sx={{ px: { xs: 0.5, sm: 1 }, py: 0.5, minHeight: 'auto !important' }}>
        <Box sx={{ display: 'flex', gap: 0.5, width: '100%' }}>
          {navItems.map((item) => (
            <Button
              key={item.to}
              color="inherit"
              component={Link}
              to={item.to}
              startIcon={item.icon}
              variant={location.pathname === item.to ? 'outlined' : 'text'}
              sx={{
                borderColor: location.pathname === item.to ? 'white' : 'transparent',
                minWidth: 0,
                flex: 1,
                px: { xs: 0.5, sm: 1 },
                py: { xs: 0.4, sm: 0.7 },
                fontSize: { xs: '0.68rem', sm: '0.8rem' },
                lineHeight: 1.05,
                textAlign: 'center',
                '& .MuiButton-startIcon': {
                  display: { xs: 'none', sm: 'inline-flex' },
                  mr: { xs: 0.3, sm: 0.6 },
                  ml: 0,
                },
              }}
            >
              <Box component="span" sx={{ whiteSpace: 'pre-line' }}>
                {item.label}
              </Box>
            </Button>
          ))}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navigation;
