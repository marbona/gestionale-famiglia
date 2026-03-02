import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import HomeIcon from '@mui/icons-material/Home';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import SettingsIcon from '@mui/icons-material/Settings';

function Navigation() {
  const location = useLocation();

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" component="div" sx={{ flexGrow: 0, mr: 4 }}>
          Gestionale Famiglia
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button
            color="inherit"
            component={Link}
            to="/"
            startIcon={<HomeIcon />}
            variant={location.pathname === '/' ? 'outlined' : 'text'}
            sx={{
              borderColor: location.pathname === '/' ? 'white' : 'transparent',
            }}
          >
            Spese Mensili
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/vista-anno"
            startIcon={<CalendarMonthIcon />}
            variant={location.pathname === '/vista-anno' ? 'outlined' : 'text'}
            sx={{
              borderColor: location.pathname === '/vista-anno' ? 'white' : 'transparent',
            }}
          >
            Vista Anno
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/large-advances"
            startIcon={<AccountBalanceWalletIcon />}
            variant={location.pathname === '/large-advances' ? 'outlined' : 'text'}
            sx={{
              borderColor: location.pathname === '/large-advances' ? 'white' : 'transparent',
            }}
          >
            Grossi Anticipi
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/major-expenses"
            startIcon={<TrendingUpIcon />}
            variant={location.pathname === '/major-expenses' ? 'outlined' : 'text'}
            sx={{
              borderColor: location.pathname === '/major-expenses' ? 'white' : 'transparent',
            }}
          >
            Grosse Spese
          </Button>
          <Button
            color="inherit"
            component={Link}
            to="/admin"
            startIcon={<SettingsIcon />}
            variant={location.pathname === '/admin' ? 'outlined' : 'text'}
            sx={{
              borderColor: location.pathname === '/admin' ? 'white' : 'transparent',
            }}
          >
            Admin
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default Navigation;
