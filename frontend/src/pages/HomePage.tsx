import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Container, Box, Typography, Grid } from '@mui/material';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import MonthlySummaryDisplay from '../components/MonthlySummaryDisplay';
import { CategoryPieChart } from '../components/CategoryPieChart';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

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
    total_income: number;
    total_expenses: number;
    balance: number;
    expenses_by_category: CategoryExpenses;
    person_contributions: PersonContributions;
}

function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const currentInitialMonth = new Date().getMonth() + 1;
  const currentInitialYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentInitialYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentInitialMonth);
  const [monthlySummary, setMonthlySummary] = useState<MonthlySummary | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    axios.get('/api/categories/')
      .then(response => {
        setCategories(response.data);
      })
      .catch(error => {
        console.error("Error fetching categories:", error);
      });

    axios.get('/api/persons/')
      .then(response => {
        setPersons(response.data);
      })
      .catch(error => {
        console.error("Error fetching persons:", error);
      });
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await axios.get(`/api/transactions/?year=${selectedYear}&month=${selectedMonth}`);
      console.log("App: fetchTransactions API response data:", response.data);
      setTransactions(response.data);
    } catch (error) {
      console.error("App: Error fetching transactions:", error);
    }
  };

  const fetchMonthlySummary = async () => {
    setSummaryError(null);
    try {
        const response = await axios.get(`/api/summary/monthly/?year=${selectedYear}&month=${selectedMonth}`);
        setMonthlySummary(response.data);
    } catch (err) {
        console.error("Error fetching monthly summary:", err);
        setSummaryError("Errore nel recupero del riepilogo mensile.");
        setMonthlySummary(null);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    fetchMonthlySummary();
  }, [selectedYear, selectedMonth]);

  const handleSaveTransaction = async () => {
    console.log("App: handleSaveTransaction called. Refreshing data.");
    setEditingTransaction(null);
    await fetchTransactions();
    await fetchMonthlySummary();
    console.log("App: Data refreshed after save.");
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleDeleteTransaction = async (transactionId: number) => {
    console.log(`App: Attempting to delete transaction with ID: ${transactionId}`);
    try {
      await axios.delete(`/api/transactions/${transactionId}`);
      // Optimistic UI update: remove row immediately without requiring full page refresh.
      const idToDelete = Number(transactionId);
      setTransactions((prev) => prev.filter((t) => Number(t.id) !== idToDelete));
      if (editingTransaction?.id === idToDelete) {
        setEditingTransaction(null);
      }
      console.log(`App: Successfully deleted transaction ID: ${transactionId}. Refreshing list and summary.`);
      await fetchTransactions();
      await fetchMonthlySummary();
      console.log("App: State after delete - transactions:", transactions, "monthlySummary:", monthlySummary);
    } catch (error) {
      console.error(`App: Error deleting transaction ID: ${transactionId}`, error);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Spese Mensili
        </Typography>
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <MonthlySummaryDisplay
            summary={monthlySummary}
            year={selectedYear}
            month={selectedMonth}
            setYear={setSelectedYear}
            setMonth={setSelectedMonth}
            summaryError={summaryError}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <CategoryPieChart
            summary={monthlySummary}
            summaryError={summaryError}
          />
        </Grid>

        <Grid item xs={12} md={4}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom>
              {editingTransaction ? 'Modifica Spesa' : 'Aggiungi Nuova Spesa'}
            </Typography>
            <TransactionForm
              categories={categories}
              persons={persons}
              onSave={handleSaveTransaction}
              transactionToEdit={editingTransaction}
            />
          </Box>

          <Box>
            <Typography variant="h5" component="h2" gutterBottom>
              {`Lista Spese ${format(new Date(selectedYear, selectedMonth - 1, 1), 'MMMM yyyy', { locale: it })}`}
            </Typography>
            {console.log("App: transactions state passed to TransactionList:", transactions)}
            <TransactionList
              transactions={transactions}
              onEdit={handleEditTransaction}
              onDelete={handleDeleteTransaction}
              selectedYear={selectedYear}
              selectedMonth={selectedMonth}
            />
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
}

export default HomePage;
