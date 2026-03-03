import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Container,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Alert,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from '@mui/material';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface YearlySummaryPoint {
  year: number;
  month: number;
  label: string;
  total_income: number;
  total_expenses: number;
  balance: number;
  utilities_expenses: number;
}

interface YearlySummary {
  year: number;
  months: YearlySummaryPoint[];
  total_income: number;
  total_expenses: number;
  total_balance: number;
  total_utilities_expenses: number;
}

const euro = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

function YearlyViewPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [summary, setSummary] = useState<YearlySummary | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const yearOptions = useMemo(
    () => Array.from({ length: 16 }, (_, i) => currentYear - 10 + i),
    [currentYear]
  );

  useEffect(() => {
    const fetchYearlySummary = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/api/summary/yearly/', {
          params: {
            year: selectedYear,
            _ts: Date.now(),
          },
        });
        setSummary(response.data);
      } catch (err) {
        console.error('Error fetching yearly summary:', err);
        setError('Errore nel caricamento del recap annuale.');
        setSummary(null);
      } finally {
        setLoading(false);
      }
    };

    fetchYearlySummary();
  }, [selectedYear]);

  const chartData = useMemo(() => {
    if (!summary) return [];
    return summary.months.map((item) => ({
      ...item,
      monthLabel: format(new Date(item.year, item.month - 1, 1), 'MMM', { locale: it }),
    }));
  }, [summary]);

  const yearlyAverages = useMemo(() => {
    if (!summary || summary.months.length === 0) {
      return { balance: null as number | null, utilities: null as number | null };
    }

    const balanceMonths = summary.months.filter((item) => item.balance < 1000);
    const utilitiesMonths = summary.months.filter((item) => item.utilities_expenses > 0);

    const balanceTotal = balanceMonths.reduce((acc, item) => acc + item.balance, 0);
    const utilitiesTotal = utilitiesMonths.reduce((acc, item) => acc + item.utilities_expenses, 0);

    return {
      balance: balanceMonths.length > 0 ? balanceTotal / balanceMonths.length : null,
      utilities: utilitiesMonths.length > 0 ? utilitiesTotal / utilitiesMonths.length : null,
    };
  }, [summary]);

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Vista Anno
      </Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item>
            <FormControl sx={{ minWidth: 160 }}>
              <InputLabel id="yearly-view-year-select-label">Anno</InputLabel>
              <Select
                labelId="yearly-view-year-select-label"
                value={selectedYear}
                label="Anno"
                onChange={(e) => setSelectedYear(e.target.value as number)}
              >
                {yearOptions.map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          {summary && (
            <Grid item>
              <Typography variant="body1">
                Totale Bilancio Anno: <Box component="span" fontWeight={700} color={summary.total_balance >= 0 ? 'success.main' : 'error.main'}>{euro.format(summary.total_balance)}</Box>
              </Typography>
              <Typography variant="body2">
                Totale Bollette: <Box component="span" fontWeight={700}>{euro.format(summary.total_utilities_expenses)}</Box>
              </Typography>
            </Grid>
          )}
        </Grid>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {loading && <Typography>Caricamento recap annuale...</Typography>}

      {!loading && summary && (
        <>
          <TableContainer component={Paper} sx={{ mb: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Mese</TableCell>
                  <TableCell align="right">Entrate</TableCell>
                  <TableCell align="right">Uscite</TableCell>
                  <TableCell align="right">Bilancio</TableCell>
                  <TableCell align="right">Bollette</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summary.months.map((item) => (
                  <TableRow key={`${item.year}-${item.month}`}>
                    <TableCell>
                      {format(new Date(item.year, item.month - 1, 1), 'MMMM', { locale: it })}
                    </TableCell>
                    <TableCell align="right">{euro.format(item.total_income)}</TableCell>
                    <TableCell align="right">{euro.format(item.total_expenses)}</TableCell>
                    <TableCell
                      align="right"
                      sx={{ color: item.balance >= 0 ? 'success.main' : 'error.main', fontWeight: 700 }}
                    >
                      {euro.format(item.balance)}
                    </TableCell>
                    <TableCell align="right">{euro.format(item.utilities_expenses)}</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ backgroundColor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Totale</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell
                    align="right"
                    sx={{ fontWeight: 700, color: summary.total_balance >= 0 ? 'success.main' : 'error.main' }}
                  >
                    {euro.format(summary.total_balance)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {euro.format(summary.total_utilities_expenses)}
                  </TableCell>
                </TableRow>
                <TableRow sx={{ backgroundColor: 'action.selected' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Media annuale</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell align="right">-</TableCell>
                  <TableCell
                    align="right"
                    sx={{
                      fontWeight: 700,
                      color: yearlyAverages.balance === null
                        ? 'text.primary'
                        : yearlyAverages.balance >= 0
                          ? 'success.main'
                          : 'error.main',
                    }}
                  >
                    {yearlyAverages.balance === null ? '-' : euro.format(yearlyAverages.balance)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {yearlyAverages.utilities === null ? '-' : euro.format(yearlyAverages.utilities)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Paper sx={{ p: 2, height: 360 }}>
                <Typography variant="h6" gutterBottom>
                  Andamento Bilancio Entrate/Uscite
                </Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" />
                    <YAxis />
                    <Tooltip formatter={(value) => euro.format(Number(value))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      name="Bilancio"
                      stroke="#1976d2"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>

            <Grid item xs={12}>
              <Paper sx={{ p: 2, height: 360 }}>
                <Typography variant="h6" gutterBottom>
                  Andamento Spesa Bollette
                </Typography>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="monthLabel" />
                    <YAxis />
                    <Tooltip formatter={(value) => euro.format(Number(value))} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="utilities_expenses"
                      name="Bollette"
                      stroke="#2e7d32"
                      strokeWidth={3}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>
        </>
      )}
    </Container>
  );
}

export default YearlyViewPage;
