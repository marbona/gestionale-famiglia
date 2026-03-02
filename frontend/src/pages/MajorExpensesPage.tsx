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

interface MajorExpense {
  id: number;
  amount: number;
  date: string;
  description: string;
  category: string;
  notes: string | null;
}

interface MajorExpenseSummary {
  total: number;
  by_category: { category: string; amount: number; count: number }[];
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
  const [summary, setSummary] = useState<MajorExpenseSummary | null>(null);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [openDialog, setOpenDialog] = useState(false);

  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Altro');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [inlineSaving, setInlineSaving] = useState<boolean>(false);

  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategory, setEditCategory] = useState('Altro');
  const [editNotes, setEditNotes] = useState('');

  useEffect(() => {
    fetchExpenses();
    fetchSummary();
  }, []);

  const fetchExpenses = async () => {
    try {
      const response = await axios.get('/api/major-expenses/', {
        params: { _ts: Date.now() },
      });
      setExpenses(response.data);
    } catch (fetchError) {
      console.error('Error fetching major expenses:', fetchError);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await axios.get('/api/major-expenses-summary/', {
        params: { _ts: Date.now() },
      });
      setSummary(response.data);
    } catch (fetchError) {
      console.error('Error fetching summary:', fetchError);
    }
  };

  const resetForm = () => {
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setCategory('Altro');
    setNotes('');
    setError(null);
  };

  const handleOpenDialog = () => {
    resetForm();
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    resetForm();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (amount === '' || !date || !description || !category) {
      setError('Importo, data, descrizione e categoria sono obbligatori.');
      return;
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      setError("L'importo deve essere un numero positivo.");
      return;
    }

    const expenseData = {
      amount: parseFloat(amount.toString()),
      date,
      description,
      category,
      notes: notes || null,
    };

    try {
      await axios.post('/api/major-expenses/', expenseData);
      setSuccessMessage('Spesa aggiunta con successo.');
      handleCloseDialog();
      await fetchExpenses();
      await fetchSummary();
    } catch (submitError) {
      console.error('Error saving major expense:', submitError);
      setError('Errore durante il salvataggio.');
    }
  };

  const handleStartInlineEdit = (expense: MajorExpense) => {
    setEditingExpenseId(expense.id);
    setEditAmount(expense.amount);
    setEditDate(format(new Date(expense.date), 'yyyy-MM-dd'));
    setEditDescription(expense.description);
    setEditCategory(expense.category);
    setEditNotes(expense.notes || '');
  };

  const handleCancelInlineEdit = () => {
    setEditingExpenseId(null);
    setEditAmount('');
    setEditDate('');
    setEditDescription('');
    setEditCategory('Altro');
    setEditNotes('');
  };

  const handleSaveInlineEdit = async (id: number) => {
    if (editAmount === '' || !editDate || !editDescription.trim() || !editCategory) {
      setError('Importo, data, descrizione e categoria sono obbligatori.');
      return;
    }
    if (typeof editAmount !== 'number' || !Number.isFinite(editAmount) || editAmount <= 0) {
      setError("L'importo deve essere un numero positivo.");
      return;
    }

    setInlineSaving(true);
    setError(null);
    try {
      await axios.put(`/api/major-expenses/${id}`, {
        amount: Number(editAmount),
        date: editDate,
        description: editDescription.trim(),
        category: editCategory,
        notes: editNotes.trim() ? editNotes.trim() : null,
      });
      handleCancelInlineEdit();
      setSuccessMessage('Spesa aggiornata con successo.');
      await fetchExpenses();
      await fetchSummary();
    } catch (saveError) {
      console.error('Error updating major expense:', saveError);
      setError('Errore durante il salvataggio.');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa spesa?')) {
      return;
    }

    try {
      await axios.delete(`/api/major-expenses/${id}`);
      if (editingExpenseId === id) {
        handleCancelInlineEdit();
      }
      setSuccessMessage('Spesa eliminata con successo.');
      await fetchExpenses();
      await fetchSummary();
    } catch (deleteError) {
      console.error('Error deleting major expense:', deleteError);
      setError("Errore durante l'eliminazione.");
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
        Grosse Spese Familiari
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {successMessage && <Alert severity="success" sx={{ mb: 2 }}>{successMessage}</Alert>}

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

      <TableContainer component={Paper}>
        <Table>
          <TableHead sx={{ backgroundColor: '#1976d2', color: 'white' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Data</TableCell>
              <TableCell sx={{ fontWeight: 'bold', color: 'white' }}>Descrizione</TableCell>
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
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography color="textSecondary">
                    Nessuna spesa trovata per i filtri selezionati
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredExpenses.map((expense) => (
                <TableRow key={expense.id} hover>
                  <TableCell>
                    {editingExpenseId === expense.id ? (
                      <TextField
                        size="small"
                        type="date"
                        value={editDate}
                        onChange={(e) => setEditDate(e.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                    ) : (
                      format(new Date(expense.date), 'dd/MM/yyyy')
                    )}
                  </TableCell>
                  <TableCell>
                    {editingExpenseId === expense.id ? (
                      <Box sx={{ display: 'flex', gap: 1, flexDirection: 'column' }}>
                        <TextField
                          size="small"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          placeholder="Descrizione"
                        />
                        <FormControl size="small">
                          <InputLabel>Categoria</InputLabel>
                          <Select
                            value={editCategory}
                            label="Categoria"
                            onChange={(e) => setEditCategory(e.target.value)}
                          >
                            {EXPENSE_CATEGORIES.map((cat) => (
                              <MenuItem key={cat} value={cat}>
                                {cat}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Note"
                          multiline
                          minRows={1}
                          maxRows={3}
                        />
                      </Box>
                    ) : (
                      expense.description
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                    {editingExpenseId === expense.id ? (
                      <TextField
                        size="small"
                        type="number"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        inputProps={{ step: '0.01', min: '0' }}
                      />
                    ) : (
                      <>€{expense.amount.toFixed(2)}</>
                    )}
                  </TableCell>
                  <TableCell align="center">
                    {editingExpenseId === expense.id ? (
                      <>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleSaveInlineEdit(expense.id)}
                          disabled={inlineSaving}
                          sx={{ mr: 1 }}
                        >
                          Salva
                        </Button>
                        <Button size="small" variant="outlined" onClick={handleCancelInlineEdit}>
                          Annulla
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => handleStartInlineEdit(expense)}
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
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

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

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Aggiungi Spesa</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {error && <Alert severity="error">{error}</Alert>}

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
            Aggiungi
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default MajorExpensesPage;
