import React from 'react';
import { Paper, Typography, Box } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { buildCategoryColorMap } from '../utils/categoryColors';

interface CategoryExpenses {
    [key: string]: number; // Maps category name to total spent
}

interface MonthlySummary {
    year: number;
    month: number;
    calculated_income: number;
    total_income: number;
    is_income_overridden: boolean;
    total_expenses: number;
    balance: number;
    expenses_by_category: CategoryExpenses;
    person_contributions: {
      [key: string]: {
        paid: number;
        needs_to_pay: number;
      };
    };
}

interface CategoryPieChartProps {
    summary: MonthlySummary | null;
    summaryError: string | null;
    categoryColorMap?: Record<string, string>;
}

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

const CategoryPieChart: React.FC<CategoryPieChartProps> = ({ summary, summaryError, categoryColorMap }) => {
    const pieChartData = summary ? 
        Object.entries(summary.expenses_by_category)
              .filter(([, amount]) => amount > 0)
              .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }))
              .sort((a, b) => a.name.localeCompare(b.name, 'it')) : [];
    const fallbackColorMap = buildCategoryColorMap(pieChartData.map((item) => item.name));
    const colors = categoryColorMap || fallbackColorMap;

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
                                        {pieChartData.map((entry) => (
                                            <Cell key={`cell-${entry.name}`} fill={colors[entry.name]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} /> {/* Using custom tooltip */}
                                </PieChart>
                            </ResponsiveContainer>

                            <Box sx={{ flexGrow: 1, overflowY: 'auto', mt: 2 }}>
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                    Dettaglio Categorie:
                                </Typography>
                                {pieChartData.map((entry) => (
                                    <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                        <Box sx={{ width: 16, height: 16, bgcolor: colors[entry.name], mr: 1, borderRadius: '50%', flexShrink: 0 }} />
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
