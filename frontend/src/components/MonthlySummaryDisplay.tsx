import React from 'react';
import { Paper, Typography, Grid, Select, MenuItem, FormControl, InputLabel, Box } from '@mui/material';
// Removed Recharts imports
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface CategoryExpenses {
    [key: string]: number;
}

interface PersonContributions {
    [key: string]: {
        paid: number;
        needs_to_pay: number;
    };
}

interface MonthlySummary {
    year: number;
    month: number;
    total_income: number;
    total_expenses: number;
    balance: number;
    expenses_by_category: CategoryExpenses;
    person_contributions: PersonContributions;
}


interface MonthlySummaryDisplayProps {
    summary: MonthlySummary | null;
    year: number;
    month: number;
    setYear: (year: number) => void;
    setMonth: (month: number) => void;
    summaryError: string | null;
}

// Removed COLORS constant

const MonthlySummaryDisplay: React.FC<MonthlySummaryDisplayProps> = ({ summary, year, month, setYear, setMonth, summaryError }) => {
    const currentYear = new Date().getFullYear(); // Still needed for years array

    const months = Array.from({ length: 12 }, (_, i) => ({
        value: i + 1,
        label: format(new Date(currentYear, i, 1), 'MMMM', { locale: it })
    }));
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    // Removed pieChartData processing

    return (
        <Paper elevation={3} sx={{ p: 2, mb: 4, height: '100%' }}> {/* Added height: '100%' for consistent Grid item sizing */}
            <Typography variant="h6" gutterBottom>
                Riepilogo Mensile
            </Typography>

            <Grid container spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <Grid item>
                    <FormControl sx={{ minWidth: 120 }}>
                        <InputLabel id="month-select-label">Mese</InputLabel>
                        <Select
                            labelId="month-select-label"
                            value={month}
                            label="Mese"
                            onChange={(e) => setMonth(e.target.value as number)}
                        >
                            {months.map((m) => (
                                <MenuItem key={m.value} value={m.value}>
                                    {m.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
                <Grid item>
                    <FormControl sx={{ minWidth: 120 }}>
                        <InputLabel id="year-select-label">Anno</InputLabel>
                        <Select
                            labelId="year-select-label"
                            value={year}
                            label="Anno"
                            onChange={(e) => setYear(e.target.value as number)}
                        >
                            {years.map((y) => (
                                <MenuItem key={y} value={y}>
                                    {y}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Grid>
            </Grid>

            {summaryError && <Typography color="error">{summaryError}</Typography>}

            {summary ? (
                <Box>
                    <Typography>
                        Entrate Totali: <Typography component="span" fontWeight="bold">€ {summary.total_income.toFixed(2)}</Typography>
                    </Typography>
                    <Typography>
                        Spese Totali: <Typography component="span" fontWeight="bold">€ {summary.total_expenses.toFixed(2)}</Typography>
                    </Typography>
                    <Typography variant="h5" sx={{ mt: 1 }}>
                        Saldo: <Typography component="span" fontWeight="bold" color={summary.balance >= 0 ? 'success.main' : 'error.main'}>€ {summary.balance.toFixed(2)}</Typography>
                    </Typography>

                    <Typography variant="subtitle1" sx={{ mt: 2 }}>
                        Anticipi Personali (Mese Corrente):
                    </Typography>
                    {Object.entries(summary.person_contributions).map(([name, contribution]) => (
                        <Box key={name} sx={{ mb: 1 }}>
                            <Typography>
                                {name} ha anticipato: <Typography component="span" fontWeight="bold">€ {contribution.paid.toFixed(2)}</Typography>
                            </Typography>
                            <Typography>
                                {name} dovrà versare: <Typography component="span" fontWeight="bold" color={contribution.needs_to_pay >= 0 ? 'primary.main' : 'error.main'}>€ {contribution.needs_to_pay.toFixed(2)}</Typography>
                            </Typography>
                        </Box>
                    ))}
                </Box>
            ) : (
                !summaryError && <Typography>Caricamento riepilogo...</Typography>
            )}
        </Paper>
    );
};

export default MonthlySummaryDisplay;
