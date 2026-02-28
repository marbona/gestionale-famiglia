import React from 'react';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Button, Chip, Typography } from '@mui/material';
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
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: number) => void;
  categoryColorMap: Record<string, string>;
}

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEdit, onDelete, categoryColorMap }) => {
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
                <TableCell>{transaction.description}</TableCell>
                <TableCell>
                  {transaction.notes ? (
                    <Typography variant="body2">{transaction.notes}</Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">-</Typography>
                  )}
                </TableCell>
                <TableCell align="right">€ {transaction.amount.toFixed(2)}</TableCell>
                <TableCell>
                  <Chip
                    label={transaction.category.name}
                    size="small"
                    sx={{
                      backgroundColor: categoryColorMap[transaction.category.name] || '#e0e0e0',
                      color: '#111',
                      fontWeight: 600,
                    }}
                  />
                </TableCell>
                <TableCell>{transaction.person.name}</TableCell>
                <TableCell align="center">
                  <Button
                    variant="outlined"
                    startIcon={<EditIcon />}
                    onClick={() => onEdit(transaction)}
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
