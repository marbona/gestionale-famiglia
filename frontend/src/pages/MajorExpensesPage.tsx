import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  FormControl,
  Alert,
  Card,
  CardContent,
  Select,
  MenuItem,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';
import { format } from 'date-fns';

interface Person {
  id: number;
  name: string;
}

interface MajorExpense {
  id: number;
  person_id: number;
  person: Person;
  amount: number;
  date: string;
  description: string;
  category: string;
  notes: string | null;
}

interface MajorExpenseSummary {
  total: number;
  by_category: { category: string; amount: number; count: number }[];
  by_person: { person: string; amount: number; count: number }[];
}

const EXPENSE_CATEGORIES = [
  'Ristrutturazione',
  'Istruzione Figli',
  'Auto/Trasporti',
  'Manutenzione Casa',
  'Salute/Medicina',
  'Investimenti',
  'Altro',
];

function MajorExpensesPage() {
  const [expenses, setExpenses] = useState<MajorExpense[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [summary, setSummary] = useState<MajorExpenseSummary | null>(null);
  const [editingExpense, setEditingExpense] = useState<MajorExpense | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  // Form state
  const [personId, setPersonId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Altro');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter state
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterCategory, setFilterCategory] = useState<string>('');

  useEffect(() => {
    fetchPersons();
    fetchExpenses();
    fetchSummary();
  }, []);

  useEffect(() => {
    if (editingExpense) {
      setPersonId(editingExpense.person_id);
      setAmount(editingExpense.amount);
      setDate(format(new Date(editingExpense.date), 'yyyy-MM-dd'));
      setDescription(editingExpense.description);
      setCategory(editingExpense.category);
      setNotes(editingExpense.notes || '');
    } else {
      resetForm();
    }
  }, [editingExpense, persons]);

  const fetchPersons = async () => {
    try {
      const response = await axios.get('/api/persons/');
      setPersons(response.data);
    } catch (error) {
      console.error('Error fetching persons:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await axios.get('/api/major-expenses/', {
        params: { _ts: Date.now() },
      });
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching major expenses:', error);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get('/api/major-expenses-summary/', {
        params: { _ts: Date.now() },
      });
      setSummary(response.data);
    } catch (error) {
      console.error('Error fetching summary:', error);
    }
  };

  const resetForm = () => {
    const defaultPerson = persons.find(p => p.name !== 'COMUNE') || persons[0];
    setPersonId(defaultPerson ? defaultPerson.id : '');
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setCategory('Altro');
    setNotes('');
    setError(null);
  };

  const handleOpenDialog = () => {
    setEditingExpense(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingExpense(null);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (personId === '' || amount === '' || !date || !description || !category) {
      setError('Persona, importo, data, descrizione e categoria sono obbligatori.');
      return;
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      setError("L'importo deve essere un numero positivo.");
      return;
    }

    const expenseData = {
      person_id: personId as number,
      amount: parseFloat(amount.toString()),
      date: date,
      description: description,
      category: category,
      notes: notes || null,
    };

    try {
      if (editingExpense) {
        await axios.put(`/api/major-expenses/${editingExpense.id}`, expenseData);
        setSuccessMessage('Spesa aggiornata con successo!');
      } else {
        await axios.post('/api/major-expenses/', expenseData);
        setSuccessMessage('Spesa aggiunta con successo!');
      }
      handleCloseDialog();
      await fetchExpenses();
      await fetchSummary();
    } catch (err) {
      console.error('Error saving major expense:', err);
      setError('Errore durante il salvataggio.');
    }
  };

  const handleEdit = (expense: MajorExpense) => {
    setEditingExpense(expense);
    setOpenDialog(true);
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Sei sicuro di voler eliminare questa spesa?')) {
      try {
        await axios.delete(`/api/major-expenses/${id}`);
        window.location.reload();
      } catch (error) {
        console.error('Error deleting major expense:', error);
        setError('Errore durante l\'eliminazione.');
      }
    }
  };

  const getYearRange = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear; i >= currentYear - 10; i--) {
      years.push(i);
    }
    return years;
  };

  const filteredExpenses = expenses.filter((expense) => {
    const expenseYear = new Date(expense.date).getFullYear();
    const matchesYear = expenseYear === filterYear;
    const matchesCategory = filterCategory === '' || expense.category === filterCategory;
    return matchesYear && matchesCategory;
  });

  const totalFiltered = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 4 }}>
        📊 Grosse Spese e Investimenti
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Totale Speso
                </Typography>
                <Typography variant="h5">
                  €{summary.total.toFixed(2)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Numero Voci
                </Typography>
                <Typography variant="h5">
                  {summary.by_category.reduce((sum, cat) => sum + cat.count, 0)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Add/Edit Button */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleOpenDialog}
        >
          Aggiungi Spesa
        </Button>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Anno</InputLabel>
              <Select
                value={filterYear}
                label="Anno"
                onChange={(e) => setFilterYear(e.target.value as number)}
              >
                {getYearRange().map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Categoria</InputLabel>
              <Select
                value={filterCategory}
                label="Categoria"
                onChange={(e) => setFilterCategory(e.target.value as string)}
              >
                <MenuItem value="">Tutte</MenuItem>
                {EXPENSE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={6}>
            <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
              Totale Filtrato: €{totalFiltered.toFixed(2)}
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Expenses Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: '#1976d2', color: 'white' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Data</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Descrizione</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Persona</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }} align="right">
                Importo
              </TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }} align="center">
                Azioni
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredExpenses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    Nessuna spesa trovata per i filtri selezionati
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>{format(new Date(expense.date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>{expense.description}</TableCell>
                  <TableCell>{expense.person.name}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    €{expense.amount.toFixed(2)}
                  </TableCell>
                  <TableCell align="center">
                    <Button
                      size="small"
                      startIcon={<EditIcon />}
                      onClick={() => handleEdit(expense)}
                      sx={{ mr: 1 }}
                    >
                      Modifica
                    </Button>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon />}
                      onClick={() => handleDelete(expense.id)}
                    >
                      Elimina
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Category Summary */}
      {summary && summary.by_category.length > 0 && (
        <Paper sx={{ p: 3, mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Riepilogo per Categoria
          </Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold' }}>Categoria</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Totale
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }} align="right">
                  Voci
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary.by_category.map((cat) => (
                <TableRow key={cat.category}>
                  <TableCell>{cat.category}</TableCell>
                  <TableCell align="right">€{cat.amount.toFixed(2)}</TableCell>
                  <TableCell align="right">{cat.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Paper>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingExpense ? 'Modifica Spesa' : 'Aggiungi Spesa'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}

            <FormControl fullWidth required>
              <InputLabel>Persona</InputLabel>
              <Select
                value={personId}
                label="Persona"
                onChange={(e) => setPersonId(e.target.value as number)}
              >
                {persons.filter(p => p.name !== 'COMUNE').map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Data"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ max: format(new Date(), 'yyyy-MM-dd') }}
              required
            />

            <TextField
              label="Descrizione"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Es: Ristrutturazione bagno"
              required
            />

            <FormControl fullWidth required>
              <InputLabel>Categoria</InputLabel>
              <Select
                value={category}
                label="Categoria"
                onChange={(e) => setCategory(e.target.value)}
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Importo (€)"
              type="number"
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || '')}
              inputProps={{ step: '0.01', min: '0' }}
              required
            />

            <TextField
              label="Note (opzionale)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dettagli aggiuntivi..."
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Annulla</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            {editingExpense ? 'Aggiorna' : 'Aggiungi'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default MajorExpensesPage;
