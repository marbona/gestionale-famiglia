import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface CategoryExpenses {
    [key: string]: number; // Maps category name to total spent
}

interface MonthlySummary {
    year: number;
    month: number;
    total_income: number;
    total_expenses: number;
    balance: number;
    expenses_by_category: CategoryExpenses;
    marco_paid_personal_this_month: number;
    anna_paid_personal_this_month: number;
    marco_next_month_contribution: number;
    anna_next_month_contribution: number;
}

interface CategoryPieChartProps {
    summary: MonthlySummary | null;
    summaryError: string | null;
}

// Color palette for the pie chart
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#d0ed57', '#a4de6c'];

// Custom Tooltip component
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <Paper sx={{ p: 1, backgroundColor: 'background.paper', border: '1px solid #ccc', whiteSpace: 'normal', wordBreak: 'break-word' }}> {/* Changed background color to theme-aware */}
        <Typography variant="body2" color="text.primary" fontWeight="bold">{`${payload[0].name}`}</Typography> {/* MODIFIED COLOR */}
        <Typography variant="body2" color="text.primary">{`€ ${payload[0].value.toFixed(2)}`}</Typography> {/* MODIFIED COLOR */}
      </Paper>
    );
  }

  return null;
};

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ summary, summaryError }) => {
    const pieChartData = summary ? 
        Object.entries(summary.expenses_by_category)
              .filter(([, amount]) => amount > 0)
              .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) })) : [];

    return (
        <Paper elevation={3} sx={{ p: 2, mb: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
                Spese per Categoria
            </Typography>

            {summaryError && <Typography color="error">{summaryError}</Typography>}

            {summary ? (
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {pieChartData.length > 0 ? (
                        <>
                            <ResponsiveContainer width="100%" height={200} style={{ flexShrink: 0 }}>
                                <PieChart>
                                    <Pie
                                        data={pieChartData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {pieChartData.map((_entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} /> {/* Using custom tooltip */}
                                </PieChart>
                            </ResponsiveContainer>

                            <Box sx={{ flexGrow: 1, overflowY: 'auto', mt: 2 }}>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                    Dettaglio Categorie:
                                </Typography>
                                {pieChartData.map((entry, index) => (
                                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <Box sx={{ width: 16, height: 16, bgcolor: COLORS[index % COLORS.length], mr: 1, borderRadius: '50%', flexShrink: 0 }} />
                                        <Typography variant="body2">{entry.name}: <Typography component="span" fontWeight="bold">€ {entry.value.toFixed(2)}</Typography></Typography>
                                    </Box>
                                ))}
                            </Box>
                        </>
                    ) : (
                        <Typography variant="body2">Nessuna spesa da visualizzare nel grafico per questo mese.</Typography>
                    )}
                </Box>
            ) : (
                !summaryError && <Typography>Caricamento grafico...</Typography>
            )}
        </Paper>
    );
};

export { CategoryPieChart };
