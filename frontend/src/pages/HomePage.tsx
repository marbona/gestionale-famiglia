import React, { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  Grid,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  List,
  ListItemButton,
  ListItemText,
  Checkbox,
  Alert,
} from '@mui/material';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import MonthlySummaryDisplay from '../components/MonthlySummaryDisplay';
import { CategoryPieChart } from '../components/CategoryPieChart';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { buildCategoryColorMap } from '../utils/categoryColors';

interface Category {
  id: number;
  name: string;
}

interface Person {
  id: number;
  name: string;
}

interface Transaction {
  id: number;
  date: string;
  description: string;
  notes?: string | null;
  amount: number;
  category_id: number;
  person_id: number;
  category: Category;
  person: Person;
}

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
  calculated_income: number;
  total_income: number;
  is_income_overridden: boolean;
  total_expenses: number;
  balance: number;
  expenses_by_category: CategoryExpenses;
  person_contributions: PersonContributions;
}

const getPreviousMonthYear = () => {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return {
    year: previous.getFullYear(),
    month: previous.getMonth() + 1,
  };
};

const getDefaultHomeMonthYear = () => {
  const now = new Date();
  const defaultMonthDate = now.getDate() >= 27
    ? new Date(now.getFullYear(), now.getMonth() + 1, 1)
    : new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    year: defaultMonthDate.getFullYear(),
    month: defaultMonthDate.getMonth() + 1,
  };
};

function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const defaultHomeMonth = getDefaultHomeMonthYear();
  const currentInitialMonth = defaultHomeMonth.month;
  const currentInitialYear = defaultHomeMonth.year;
  const [selectedYear, setSelectedYear] = useState<number>(currentInitialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentInitialMonth);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [incomeSaving, setIncomeSaving] = useState<boolean>(false);

  const previousMonth = getPreviousMonthYear();
  const [copySourceYear, setCopySourceYear] = useState<number>(previousMonth.year);
  const [copySourceMonth, setCopySourceMonth] = useState<number>(previousMonth.month);
  const [copyTargetYear, setCopyTargetYear] = useState<number>(currentInitialYear);
  const [copyTargetMonth, setCopyTargetMonth] = useState<number>(currentInitialMonth);
  const [templateTransactions, setTemplateTransactions] = useState<Transaction[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);
  const [copyLoading, setCopyLoading] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copySuccess, setCopySuccess] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => currentYear - 3 + i);
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: format(new Date(currentYear, i, 1), 'MMMM', { locale: it }),
  }));

  useEffect(() => {
    axios.get('/api/categories/')
      .then((response) => {
        setCategories(response.data);
      })
      .catch((error) => {
        console.error('Error fetching categories:', error);
      });

    axios.get('/api/persons/')
      .then((response) => {
        setPersons(response.data);
      })
      .catch((error) => {
        console.error('Error fetching persons:', error);
      });
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get('/api/transactions/', {
        params: {
          year: selectedYear,
          month: selectedMonth,
          _ts: Date.now(),
        },
      });
      setTransactions(response.data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
  };

  const fetchMonthlySummary = async () => {
    setSummaryError(null);
    try {
      const response = await axios.get('/api/summary/monthly/', {
        params: {
          year: selectedYear,
          month: selectedMonth,
          _ts: Date.now(),
        },
      });
      setMonthlySummary(response.data);
    } catch (err) {
      console.error('Error fetching monthly summary:', err);
      setSummaryError('Errore nel recupero del riepilogo mensile.');
      setMonthlySummary(null);
    }
  };

  const fetchTemplateTransactions = async () => {
    setCopyError(null);
    setCopySuccess(null);
    try {
      const response = await axios.get('/api/transactions/', {
        params: {
          year: copySourceYear,
          month: copySourceMonth,
          _ts: Date.now(),
        },
      });
      const items: Transaction[] = response.data;
      const sorted = [...items].sort((a, b) => {
        const byCategory = a.category.name.localeCompare(b.category.name, 'it');
        if (byCategory !== 0) return byCategory;
        return a.description.localeCompare(b.description, 'it');
      });
      setTemplateTransactions(sorted);
      setSelectedTemplateIds(sorted.map((item) => item.id));
    } catch (error) {
      console.error('Error fetching template transactions:', error);
      setCopyError('Errore nel caricamento del mese template.');
      setTemplateTransactions([]);
      setSelectedTemplateIds([]);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchTemplateTransactions();
  }, [copySourceYear, copySourceMonth]);

  useEffect(() => {
    setCopyTargetYear(selectedYear);
    setCopyTargetMonth(selectedMonth);
  }, [selectedYear, selectedMonth]);

  const handleSaveTransaction = async () => {
    await fetchTransactions();
    await fetchMonthlySummary();
  };

  const handleTransactionListUpdated = async () => {
    await fetchTransactions();
    await fetchMonthlySummary();
    await fetchTemplateTransactions();
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    try {
      await axios.delete(`/api/transactions/${transactionId}`);
      await fetchTransactions();
      await fetchMonthlySummary();
      await fetchTemplateTransactions();
    } catch (error) {
      console.error(`Error deleting transaction ID: ${transactionId}`, error);
    }
  };

  const handleToggleTemplateTransaction = (transactionId: number) => {
    setSelectedTemplateIds((prev) => (
      prev.includes(transactionId)
        ? prev.filter((id) => id !== transactionId)
        : [...prev, transactionId]
    ));
  };

  const handleCopyMonthTemplate = async () => {
    setCopyError(null);
    setCopySuccess(null);
    if (selectedTemplateIds.length === 0) {
      setCopyError('Seleziona almeno una voce da copiare.');
      return;
    }

    if (copySourceYear === copyTargetYear && copySourceMonth === copyTargetMonth) {
      setCopyError('Mese sorgente e mese destinazione devono essere diversi.');
      return;
    }

    setCopyLoading(true);
    try {
      const response = await axios.post('/api/transactions/copy-month/', {
        source_year: copySourceYear,
        source_month: copySourceMonth,
        target_year: copyTargetYear,
        target_month: copyTargetMonth,
        transaction_ids: selectedTemplateIds,
      });

      setCopySuccess(`Copiate ${response.data.copied_count} voci nel mese di destinazione.`);
      setSelectedYear(copyTargetYear);
      setSelectedMonth(copyTargetMonth);
      await fetchTransactions();
      await fetchMonthlySummary();
      await fetchTemplateTransactions();
    } catch (error: any) {
      console.error('Error copying month template:', error);
      setCopyError(error.response?.data?.detail || 'Errore durante la copia del mese.');
    } finally {
      setCopyLoading(false);
    }
  };

  const handleSaveIncomeOverride = async (value: number | null) => {
    if (value !== null && (!Number.isFinite(value) || value < 0)) {
      setSummaryError('Inserisci un importo valido maggiore o uguale a 0.');
      return;
    }

    setIncomeSaving(true);
    try {
      await axios.put('/api/summary/monthly-income/', { total_income: value }, {
        params: {
          year: selectedYear,
          month: selectedMonth,
        },
      });
      await fetchMonthlySummary();
    } catch (error) {
      console.error('Error saving monthly income override:', error);
      setSummaryError('Errore nel salvataggio delle entrate mensili.');
    } finally {
      setIncomeSaving(false);
    }
  };

  const orderedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => {
      const byCategory = a.category.name.localeCompare(b.category.name, 'it');
      if (byCategory !== 0) return byCategory;
      const byDescription = a.description.localeCompare(b.description, 'it');
      if (byDescription !== 0) return byDescription;
      return a.id - b.id;
    });
  }, [transactions]);

  const categoryNamesForColors = useMemo(() => {
    const fromSummary = monthlySummary
      ? Object.entries(monthlySummary.expenses_by_category)
        .filter(([, amount]) => amount > 0)
        .map(([name]) => name)
      : [];
    const fromCurrentMonth = orderedTransactions.map((item) => item.category.name);
    const fromTemplate = templateTransactions.map((item) => item.category.name);
    return [...fromSummary, ...fromCurrentMonth, ...fromTemplate];
  }, [monthlySummary, orderedTransactions, templateTransactions]);

  const categoryColorMap = useMemo(
    () => buildCategoryColorMap(categoryNamesForColors),
    [categoryNamesForColors],
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Spese Mensili
        </Typography>
      </Box>

      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: { xs: 460, md: '100%' } }}>
            <MonthlySummaryDisplay
              summary={monthlySummary}
              year={selectedYear}
              month={selectedMonth}
              setYear={setSelectedYear}
              setMonth={setSelectedMonth}
              summaryError={summaryError}
              onSaveIncomeOverride={handleSaveIncomeOverride}
              incomeSaving={incomeSaving}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ width: '100%', maxWidth: { xs: 460, md: '100%' } }}>
            <CategoryPieChart
              summary={monthlySummary}
              summaryError={summaryError}
              categoryColorMap={categoryColorMap}
            />
          </Box>
        </Grid>

        <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
          <Box sx={{ mb: 4, width: '100%', maxWidth: { xs: 460, md: '100%' } }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Aggiungi Nuova Spesa
            </Typography>
            <TransactionForm
              categories={categories}
              persons={persons}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
              onSave={handleSaveTransaction}
              transactionToEdit={null}
            />
          </Box>
        </Grid>
      </Grid>

      <Box sx={{ mt: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          {`Lista Spese ${format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy', { locale: it })}`}
        </Typography>
        <TransactionList
          transactions={orderedTransactions}
          onDelete={handleDeleteTransaction}
          onUpdated={handleTransactionListUpdated}
          categories={categories}
          persons={persons}
          categoryColorMap={categoryColorMap}
        />
      </Box>

      <Paper sx={{ p: 2, mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Copia mese (template)
        </Typography>

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Mese origine</InputLabel>
              <Select
                value={copySourceMonth}
                label="Mese origine"
                onChange={(e) => setCopySourceMonth(e.target.value as number)}
              >
                {months.map((m) => (
                  <MenuItem key={`src-month-${m.value}`} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Anno origine</InputLabel>
              <Select
                value={copySourceYear}
                label="Anno origine"
                onChange={(e) => setCopySourceYear(e.target.value as number)}
              >
                {years.map((y) => (
                  <MenuItem key={`src-year-${y}`} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Mese destinazione</InputLabel>
              <Select
                value={copyTargetMonth}
                label="Mese destinazione"
                onChange={(e) => setCopyTargetMonth(e.target.value as number)}
              >
                {months.map((m) => (
                  <MenuItem key={`tgt-month-${m.value}`} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Anno destinazione</InputLabel>
              <Select
                value={copyTargetYear}
                label="Anno destinazione"
                onChange={(e) => setCopyTargetYear(e.target.value as number)}
              >
                {years.map((y) => (
                  <MenuItem key={`tgt-year-${y}`} value={y}>{y}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
          <Button
            size="small"
            onClick={() => setSelectedTemplateIds(templateTransactions.map((item) => item.id))}
            disabled={templateTransactions.length === 0}
          >
            Seleziona tutto
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedTemplateIds([])}
            disabled={templateTransactions.length === 0}
          >
            Deseleziona tutto
          </Button>
        </Box>

        <List dense sx={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
          {templateTransactions.length === 0 && (
            <ListItemText
              primary="Nessuna spesa trovata nel mese origine."
              sx={{ px: 2, py: 1, color: 'text.secondary' }}
            />
          )}
          {templateTransactions.map((tx) => (
            <ListItemButton
              key={tx.id}
              onClick={() => handleToggleTemplateTransaction(tx.id)}
              sx={{ borderLeft: `4px solid ${categoryColorMap[tx.category.name] || '#9e9e9e'}` }}
            >
              <Checkbox edge="start" checked={selectedTemplateIds.includes(tx.id)} tabIndex={-1} disableRipple />
              <ListItemText
                primary={`${tx.category.name} | ${tx.description} | € ${tx.amount.toFixed(2)}`}
                secondary={tx.notes || tx.person.name}
              />
            </ListItemButton>
          ))}
        </List>

        {copyError && <Alert severity="error" sx={{ mb: 1 }}>{copyError}</Alert>}
        {copySuccess && <Alert severity="success" sx={{ mb: 1 }}>{copySuccess}</Alert>}

        <Button
          variant="contained"
          fullWidth
          onClick={handleCopyMonthTemplate}
          disabled={copyLoading || templateTransactions.length === 0}
        >
          {copyLoading ? 'Copia in corso...' : 'Copia record selezionati'}
        </Button>
      </Paper>
    </Container>
  );
}

export default HomePage;
