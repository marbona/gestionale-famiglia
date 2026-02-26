import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { TextField, Button, MenuItem, Select, FormControl, InputLabel, RadioGroup, FormControlLabel, Radio, Box, Alert } from '@mui/material';
import { format } from 'date-fns';

interface Category {
  id: number;
  name: string;
}

interface Person {
  id: number;
  name: string;
}

interface TransactionData {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  category_id: number;
  person_id: number;
}

interface Transaction extends TransactionData {
    id: number;
    category: Category;
    person: Person;
}

interface TransactionFormProps {
  categories: Category[];
  persons: Person[];
  onSave: () => void;
  transactionToEdit: Transaction | null;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ categories, persons, onSave, transactionToEdit }) => {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [personId, setPersonId] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (transactionToEdit) {
      setDate(format(new Date(transactionToEdit.date), 'yyyy-MM-dd'));
      setDescription(transactionToEdit.description);
      setAmount(transactionToEdit.amount);
      setCategoryId(transactionToEdit.category_id);
      setPersonId(transactionToEdit.person_id);
    } else {
      // Reset form if not editing
      setDate(format(new Date(), 'yyyy-MM-dd'));
      setDescription('');
      setAmount('');
      setCategoryId('');
      // Set default to first person (usually COMUNE)
      setPersonId(persons.length > 0 ? persons[0].id : '');
      setError(null);
    }
  }, [transactionToEdit, persons]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!date || !description || amount === '' || categoryId === '' || personId === '') {
      setError('Tutti i campi sono obbligatori.');
      return;
    }
    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      setError('L\'importo deve essere un numero positivo.');
      return;
    }

    const transactionData: TransactionData = {
      date: date,
      description: description,
      amount: parseFloat(amount.toString()),
      category_id: categoryId as number,
      person_id: personId as number,
    };

    console.log("Form: Submitting transaction data:", transactionData);

    try {
      if (transactionToEdit) {
        console.log("Form: Sending PUT request for ID:", transactionToEdit.id);
        await axios.put(`/api/transactions/${transactionToEdit.id}`, transactionData);
        console.log("Form: PUT request successful.");
      } else {
        console.log("Form: Sending POST request.");
        await axios.post('/api/transactions/', transactionData);
        console.log("Form: POST request successful.");
      }
      onSave();
    } catch (err) {
      console.error("Form: Error saving transaction:", err);
      setError('Errore durante il salvataggio della transazione.');
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ '& .MuiTextField-root': { m: 1, width: '25ch' }, mb: 4 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <div>
        <TextField
          label="Data"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          InputLabelProps={{
            shrink: true,
          }}
          required
        />
        <TextField
          label="Descrizione"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
        />
        <TextField
          label="Importo"
          type="number"
          value={amount}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          inputProps={{ step: "0.01" }}
          required
        />
      </div>
      <div>
        <FormControl sx={{ m: 1, minWidth: 220 }} required>
          <InputLabel id="category-select-label">Categoria</InputLabel>
          <Select
            labelId="category-select-label"
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

        <FormControl sx={{ m: 1, minWidth: 220 }} required>
          <InputLabel id="person-select-label">Pagante</InputLabel>
          <Select
            labelId="person-select-label"
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
      </div>
      <Button type="submit" variant="contained" sx={{ m: 1 }}>
        {transactionToEdit ? 'Aggiorna Spesa' : 'Aggiungi Spesa'}
      </Button>
      {transactionToEdit && (
        <Button 
          variant="outlined" 
          sx={{ m: 1 }} 
          onClick={() => { onSave(); }} // Clear editing and refresh list
        >
          Annulla Modifica
        </Button>
      )}
    </Box>
  );
};

export default TransactionForm;
