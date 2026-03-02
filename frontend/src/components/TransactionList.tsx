import React, { useState } from 'react';
import axios from 'axios';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';

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

interface TransactionListProps {
  transactions: Transaction[];
  onDelete: (transactionId: number) => void;
  onUpdated: () => Promise<void>;
  categories: Category[];
  persons: Person[];
  categoryColorMap: Record<string, string>;
}

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onDelete,
  onUpdated,
  categories,
  persons,
  categoryColorMap,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [personId, setPersonId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const startEdit = (transaction: Transaction) => {
    setEditingId(transaction.id);
    setDescription(transaction.description);
    setNotes(transaction.notes || '');
    setAmount(transaction.amount);
    setCategoryId(transaction.category_id);
    setPersonId(transaction.person_id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDescription('');
    setNotes('');
    setAmount('');
    setCategoryId('');
    setPersonId('');
  };

  const saveEdit = async (transaction: Transaction) => {
    if (!description.trim() || amount === '' || categoryId === '' || personId === '') {
      return;
    }
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
      return;
    }

    setSaving(true);
    try {
      await axios.put(`/api/transactions/${transaction.id}`, {
        date: transaction.date,
        description: description.trim(),
        notes: notes.trim() ? notes.trim() : null,
        amount: Number(amount),
        category_id: Number(categoryId),
        person_id: Number(personId),
      });
      cancelEdit();
      await onUpdated();
    } catch (error) {
      console.error('Error updating transaction:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650 }} aria-label="transaction table">
        <TableHead>
          <TableRow>
            <TableCell>Descrizione</TableCell>
            <TableCell>Note</TableCell>
            <TableCell align="right">Importo</TableCell>
            <TableCell>Categoria</TableCell>
            <TableCell>Pagante</TableCell>
            <TableCell align="center">Azioni</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
            <TableCell colSpan={6} align="center">Nessuna transazione trovata.</TableCell>
          </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>
                  {editingId === transaction.id ? (
                    <TextField
                      size="small"
                      fullWidth
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                    />
                  ) : (
                    transaction.description
                  )}
                </TableCell>
                <TableCell>
                  {editingId === transaction.id ? (
                    <TextField
                      size="small"
                      fullWidth
                      multiline
                      minRows={1}
                      maxRows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  ) : transaction.notes ? (
                    <Typography variant="body2">{transaction.notes}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell align="right">
                  {editingId === transaction.id ? (
                    <TextField
                      size="small"
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                      inputProps={{ step: '0.01', min: '0' }}
                    />
                  ) : (
                    <Typography variant="body2">€ {transaction.amount.toFixed(2)}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  {editingId === transaction.id ? (
                    <FormControl size="small" fullWidth>
                      <InputLabel id={`cat-inline-${transaction.id}`}>Categoria</InputLabel>
                      <Select
                        labelId={`cat-inline-${transaction.id}`}
                        value={categoryId}
                        label="Categoria"
                        onChange={(e) => setCategoryId(e.target.value as number)}
                      >
                        {categories.map((cat) => (
                          <MenuItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Chip
                      label={transaction.category.name}
                      size="small"
                      sx={{
                        backgroundColor: categoryColorMap[transaction.category.name] || '#e0e0e0',
                        color: '#111',
                        fontWeight: 600,
                      }}
                    />
                  )}
                </TableCell>
                <TableCell>
                  {editingId === transaction.id ? (
                    <FormControl size="small" fullWidth>
                      <InputLabel id={`person-inline-${transaction.id}`}>Pagante</InputLabel>
                      <Select
                        labelId={`person-inline-${transaction.id}`}
                        value={personId}
                        label="Pagante"
                        onChange={(e) => setPersonId(e.target.value as number)}
                      >
                        {persons.map((person) => (
                          <MenuItem key={person.id} value={person.id}>
                            {person.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    transaction.person.name
                  )}
                </TableCell>
                <TableCell align="center">
                  {editingId === transaction.id ? (
                    <>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => saveEdit(transaction)}
                        disabled={saving}
                        sx={{ mr: 1 }}
                      >
                        Salva
                      </Button>
                      <Button size="small" variant="outlined" onClick={cancelEdit} disabled={saving}>
                        Annulla
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => startEdit(transaction)}
                        sx={{ mr: 1 }}
                      >
                        Modifica
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={() => { if (window.confirm('Sei sicuro di voler eliminare questa transazione?')) onDelete(transaction.id); }}
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
  );
};

export default TransactionList;
