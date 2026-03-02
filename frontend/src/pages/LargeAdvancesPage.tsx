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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { format } from 'date-fns';

interface Person {
  id: number;
  name: string;
}

interface LargeAdvance {
  id: number;
  person_id: number;
  person: Person;
  amount: number;
  date: string;
  description: string | null;
}

interface BalanceSummary {
  marco_total: number;
  anna_total: number;
  total_advances: number;
  difference: number;
}

function LargeAdvancesPage() {
  const [advances, setAdvances] = useState<LargeAdvance[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [balance, setBalance] = useState<BalanceSummary | null>(null);
  const [editingAdvanceId, setEditingAdvanceId] = useState<number | null>(null);
  const [editPersonId, setEditPersonId] = useState<number | ''>('');
  const [editAmount, setEditAmount] = useState<number | ''>('');
  const [editDate, setEditDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [inlineSaving, setInlineSaving] = useState<boolean>(false);

  // Form state
  const [personId, setPersonId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAdvances();
    fetchBalance();
    fetchPersons();
  }, []);

  useEffect(() => {
    resetForm();
  }, [persons]);

  const fetchAdvances = async () => {
    try {
      const response = await axios.get('/api/large-advances/', {
        params: { _ts: Date.now() },
      });
      setAdvances(response.data);
    } catch (error) {
      console.error('Error fetching large advances:', error);
    }
  };

  const fetchBalance = async () => {
    try {
      const response = await axios.get('/api/large-advances/balance/summary', {
        params: { _ts: Date.now() },
      });
      setBalance(response.data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    }
  };

  const fetchPersons = async () => {
    try {
      const response = await axios.get('/api/persons/');
      setPersons(response.data);
    } catch (error) {
      console.error('Error fetching persons:', error);
    }
  };

  const resetForm = () => {
    // Set default to first non-COMUNE person or first person
    const defaultPerson = persons.find(p => p.name !== 'COMUNE') || persons[0];
    setPersonId(defaultPerson ? defaultPerson.id : '');
    setAmount('');
    setDate(format(new Date(), 'yyyy-MM-dd'));
    setDescription('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (personId === '' || amount === '' || !date) {
      setError('Persona, importo e data sono obbligatori.');
      return;
    }

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      setError("L'importo deve essere un numero positivo.");
      return;
    }

    const advanceData = {
      person_id: personId as number,
      amount: parseFloat(amount.toString()),
      date: date,
      description: description || null,
    };

    try {
      await axios.post('/api/large-advances/', advanceData);
      await fetchAdvances();
      await fetchBalance();
      resetForm();
    } catch (err) {
      console.error('Error saving large advance:', err);
      setError('Errore durante il salvataggio.');
    }
  };

  const handleStartInlineEdit = (advance: LargeAdvance) => {
    setEditingAdvanceId(advance.id);
    setEditPersonId(advance.person_id);
    setEditAmount(advance.amount);
    setEditDate(format(new Date(advance.date), 'yyyy-MM-dd'));
    setEditDescription(advance.description || '');
  };

  const handleCancelInlineEdit = () => {
    setEditingAdvanceId(null);
    setEditPersonId('');
    setEditAmount('');
    setEditDate('');
    setEditDescription('');
  };

  const handleSaveInlineEdit = async (advanceId: number) => {
    if (editPersonId === '' || editAmount === '' || !editDate) {
      setError('Persona, importo e data sono obbligatori.');
      return;
    }
    if (typeof editAmount !== 'number' || !Number.isFinite(editAmount) || editAmount <= 0) {
      setError("L'importo deve essere un numero positivo.");
      return;
    }

    setInlineSaving(true);
    setError(null);
    try {
      await axios.put(`/api/large-advances/${advanceId}`, {
        person_id: Number(editPersonId),
        amount: Number(editAmount),
        date: editDate,
        description: editDescription.trim() || null,
      });
      handleCancelInlineEdit();
      await fetchAdvances();
      await fetchBalance();
    } catch (saveError) {
      console.error('Error updating large advance:', saveError);
      setError('Errore durante il salvataggio modifica.');
    } finally {
      setInlineSaving(false);
    }
  };

  const handleDelete = async (advanceId: number) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo anticipo?')) return;

    try {
      await axios.delete(`/api/large-advances/${advanceId}`);
      if (editingAdvanceId === advanceId) {
        handleCancelInlineEdit();
      }
      await fetchAdvances();
      await fetchBalance();
    } catch (error) {
      console.error('Error deleting advance:', error);
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Grossi Anticipi
        </Typography>
        <Typography variant="subtitle1" align="center" color="text.secondary" sx={{ mb: 4 }}>
          Gestione anticipi straordinari (eredità, piani di accumulo, ecc.)
        </Typography>
      </Box>

      <Grid container spacing={4}>
        {/* Balance Summary */}
        <Grid item xs={12} md={4}>
          <Card elevation={3}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Riepilogo Bilancio
              </Typography>
              {balance && (
                <Box>
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    <strong>Marco ha anticipato:</strong> € {balance.marco_total.toFixed(2)}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Anna ha anticipato:</strong> € {balance.anna_total.toFixed(2)}
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 2, mb: 3 }}>
                    <strong>Totale anticipi:</strong> € {balance.total_advances.toFixed(2)}
                  </Typography>

                  {balance.difference === 0 ? (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
                      <Typography variant="body1" fontWeight="bold" align="center">
                        ✓ Sono in pari!
                      </Typography>
                    </Box>
                  ) : balance.difference > 0 ? (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                      <Typography variant="body1" fontWeight="bold">
                        Marco ha anticipato € {balance.difference.toFixed(2)} in più
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Anna deve mettere € {balance.difference.toFixed(2)} per pareggiare
                      </Typography>
                    </Box>
                  ) : (
                    <Box sx={{ mt: 3, p: 2, bgcolor: 'warning.light', borderRadius: 1 }}>
                      <Typography variant="body1" fontWeight="bold">
                        Anna ha anticipato € {Math.abs(balance.difference).toFixed(2)} in più
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Marco deve mettere € {Math.abs(balance.difference).toFixed(2)} per pareggiare
                      </Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Form */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Aggiungi Nuovo Anticipo
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Data"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    required
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Importo"
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    inputProps={{ step: '0.01' }}
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Descrizione"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth required>
                    <InputLabel id="person-select-label">Chi ha anticipato?</InputLabel>
                    <Select
                      labelId="person-select-label"
                      value={personId}
                      label="Chi ha anticipato?"
                      onChange={(e) => setPersonId(e.target.value as number)}
                    >
                      {persons.filter(p => p.name !== 'COMUNE').map((person) => (
                        <MenuItem key={person.id} value={person.id}>
                          {person.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <Button type="submit" variant="contained" sx={{ mr: 2 }}>
                    Aggiungi
                  </Button>
                </Grid>
              </Grid>
            </Box>
          </Paper>

          {/* List */}
          <Paper elevation={3}>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Data</TableCell>
                    <TableCell>Descrizione</TableCell>
                    <TableCell align="right">Importo</TableCell>
                    <TableCell>Chi</TableCell>
                    <TableCell align="center">Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {advances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        Nessun anticipo registrato.
                      </TableCell>
                    </TableRow>
                  ) : (
                    advances.map((advance) => (
                      <TableRow key={advance.id}>
                        <TableCell>
                          {editingAdvanceId === advance.id ? (
                            <TextField
                              size="small"
                              type="date"
                              value={editDate}
                              onChange={(e) => setEditDate(e.target.value)}
                              InputLabelProps={{ shrink: true }}
                            />
                          ) : (
                            format(new Date(advance.date), 'dd/MM/yyyy')
                          )}
                        </TableCell>
                        <TableCell>
                          {editingAdvanceId === advance.id ? (
                            <TextField
                              size="small"
                              fullWidth
                              value={editDescription}
                              onChange={(e) => setEditDescription(e.target.value)}
                            />
                          ) : (
                            advance.description || '-'
                          )}
                        </TableCell>
                        <TableCell align="right">
                          {editingAdvanceId === advance.id ? (
                            <TextField
                              size="small"
                              type="number"
                              value={editAmount}
                              onChange={(e) => setEditAmount(e.target.value === '' ? '' : Number(e.target.value))}
                              inputProps={{ step: '0.01', min: '0' }}
                            />
                          ) : (
                            <>€ {advance.amount.toFixed(2)}</>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingAdvanceId === advance.id ? (
                            <FormControl fullWidth size="small">
                              <InputLabel id={`inline-person-${advance.id}`}>Chi</InputLabel>
                              <Select
                                labelId={`inline-person-${advance.id}`}
                                value={editPersonId}
                                label="Chi"
                                onChange={(e) => setEditPersonId(e.target.value as number)}
                              >
                                {persons.filter(p => p.name !== 'COMUNE').map((person) => (
                                  <MenuItem key={person.id} value={person.id}>
                                    {person.name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          ) : (
                            advance.person.name
                          )}
                        </TableCell>
                        <TableCell align="center">
                          {editingAdvanceId === advance.id ? (
                            <>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => handleSaveInlineEdit(advance.id)}
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
                                onClick={() => handleStartInlineEdit(advance)}
                                sx={{ mr: 1 }}
                              >
                                Modifica
                              </Button>
                              <Button
                                size="small"
                                color="error"
                                startIcon={<DeleteIcon />}
                                onClick={() => handleDelete(advance.id)}
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
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default LargeAdvancesPage;
