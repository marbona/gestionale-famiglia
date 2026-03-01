import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  TextField,
  Grid,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AddIcon from '@mui/icons-material/Add';

interface Person {
  id: number;
  name: string;
}

interface Category {
  id: number;
  name: string;
}

interface AppSettings {
  id: number;
  monthly_income: number;
  monthly_contribution_per_person: number;
  smtp_server: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  email_recipients: string;
  backup_enabled: boolean;
  backup_frequency_hours: number;
  backup_recipients: string;
  backup_last_sent_at?: string | null;
}

interface TransactionDetail {
  id: number;
  date: string;
  description: string;
  amount: number;
  category_name: string;
}

interface PeriodStatistics {
  start_date: string;
  end_date: string;
  total_expenses: number;
  total_transactions: number;
  expenses_by_category: { [key: string]: number };
  average_transaction: number;
  marco_advances: number;
  anna_advances: number;
  marco_advance_details: TransactionDetail[];
  anna_advance_details: TransactionDetail[];
  current_month_summary: {
    year: number;
    month: number;
    total_income: number;
    total_expenses: number;
    balance: number;
    person_contributions: { [key: string]: { paid: number; needs_to_pay: number } };
  };
  large_advances_balance: {
    marco_total: number;
    anna_total: number;
    total_advances: number;
    difference: number;
  };
  new_major_expenses_count: number;
  new_major_expenses_total: number;
  major_expenses: {
    id: number;
    date: string;
    description: string;
    category: string;
    amount: number;
    notes?: string | null;
  }[];
}

function AdminPage() {
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  // Persons state
  const [persons, setPersons] = useState<Person[]>([]);
  const [personDialog, setPersonDialog] = useState({ open: false, editing: false, id: 0, name: '' });

  // Categories state
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDialog, setCategoryDialog] = useState({ open: false, editing: false, id: 0, name: '' });

  // Settings state
  const [settings, setSettings] = useState<AppSettings | null>(null);

  // Statistics state - default to last complete month
  const getLastMonthRange = () => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    const monthValue = `${year}-${month}`;

    return {
      startMonth: monthValue,
      endMonth: monthValue,
    };
  };

  const getMonthDateRange = (monthValue: string, isEnd: boolean): string => {
    const [yearStr, monthStr] = monthValue.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    if (!year || !month) return '';

    if (!isEnd) {
      return `${yearStr}-${monthStr}-01`;
    }

    const lastDay = new Date(year, month, 0).getDate();
    return `${yearStr}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  };

  const defaultRange = getLastMonthRange();
  const [startMonth, setStartMonth] = useState(defaultRange.startMonth);
  const [endMonth, setEndMonth] = useState(defaultRange.endMonth);
  const [statistics, setStatistics] = useState<PeriodStatistics | null>(null);
  const [sending, setSending] = useState(false);
  const [testing, setTesting] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [backupSending, setBackupSending] = useState(false);

  useEffect(() => {
    fetchPersons();
    fetchCategories();
    fetchSettings();
  }, []);

  // --- Persons Functions ---
  const fetchPersons = async () => {
    try {
      const response = await axios.get('/api/persons/');
      // Filter out COMUNE (system user)
      setPersons(response.data.filter((p: Person) => p.name !== 'COMUNE'));
    } catch (error) {
      showSnackbar('Errore caricamento persone', 'error');
    }
  };

  const handlePersonSave = async () => {
    try {
      if (personDialog.editing) {
        await axios.put(`/api/persons/${personDialog.id}`, { name: personDialog.name });
        showSnackbar('Persona aggiornata', 'success');
      } else {
        await axios.post('/api/persons/', { name: personDialog.name });
        showSnackbar('Persona creata', 'success');
      }
      setPersonDialog({ open: false, editing: false, id: 0, name: '' });
      fetchPersons();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore salvataggio persona', 'error');
    }
  };

  const handlePersonDelete = async (id: number) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa persona?')) return;
    try {
      await axios.delete(`/api/persons/${id}`);
      showSnackbar('Persona eliminata', 'success');
      fetchPersons();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore eliminazione persona', 'error');
    }
  };

  // --- Categories Functions ---
  const fetchCategories = async () => {
    try {
      const response = await axios.get('/api/categories/');
      setCategories(response.data);
    } catch (error) {
      showSnackbar('Errore caricamento categorie', 'error');
    }
  };

  const handleCategorySave = async () => {
    try {
      if (categoryDialog.editing) {
        await axios.put(`/api/categories/${categoryDialog.id}`, { name: categoryDialog.name });
        showSnackbar('Categoria aggiornata', 'success');
      } else {
        await axios.post('/api/categories/', { name: categoryDialog.name });
        showSnackbar('Categoria creata', 'success');
      }
      setCategoryDialog({ open: false, editing: false, id: 0, name: '' });
      fetchCategories();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore salvataggio categoria', 'error');
    }
  };

  const handleCategoryDelete = async (id: number) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa categoria?')) return;
    try {
      await axios.delete(`/api/categories/${id}`);
      showSnackbar('Categoria eliminata', 'success');
      fetchCategories();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore eliminazione categoria', 'error');
    }
  };

  // --- Settings Functions ---
  const fetchSettings = async () => {
    try {
      const response = await axios.get('/api/settings/');
      setSettings(response.data);
    } catch (error) {
      showSnackbar('Errore caricamento impostazioni', 'error');
    }
  };

  const handleSettingsSave = async () => {
    if (!settings) return;
    try {
      await axios.put('/api/settings/', settings);
      showSnackbar('Impostazioni salvate', 'success');
      fetchSettings();
    } catch (error) {
      showSnackbar('Errore salvataggio impostazioni', 'error');
    }
  };

  // --- Statistics Functions ---
  const fetchStatistics = async () => {
    if (!startMonth || !endMonth) {
      showSnackbar('Seleziona mese inizio e fine', 'error');
      return;
    }
    const startDate = getMonthDateRange(startMonth, false);
    const endDate = getMonthDateRange(endMonth, true);
    try {
      const response = await axios.get('/api/statistics/period/', {
        params: { start_date: startDate, end_date: endDate }
      });
      setStatistics(response.data);
    } catch (error) {
      showSnackbar('Errore caricamento statistiche', 'error');
    }
  };

  const handleSendEmail = async () => {
    if (!startMonth || !endMonth) {
      showSnackbar('Seleziona mese inizio e fine', 'error');
      return;
    }
    const startDate = getMonthDateRange(startMonth, false);
    const endDate = getMonthDateRange(endMonth, true);
    setSending(true);
    try {
      await axios.post('/api/reports/send-email/', null, {
        params: { start_date: startDate, end_date: endDate }
      });
      showSnackbar('Email inviata con successo', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore invio email', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleTestEmail = async () => {
    setTesting(true);
    try {
      const response = await axios.post('/api/reports/test-email/');
      showSnackbar(`Email di test inviata a: ${response.data.recipients.join(', ')}`, 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore invio email di test', 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!startMonth || !endMonth) {
      showSnackbar('Seleziona mese inizio e fine', 'error');
      return;
    }
    const startDate = getMonthDateRange(startMonth, false);
    const endDate = getMonthDateRange(endMonth, true);
    try {
      const response = await axios.get('/api/reports/download/', {
        params: { start_date: startDate, end_date: endDate },
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report_${startDate}_${endDate}.html`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      showSnackbar('Report scaricato con successo', 'success');
    } catch (error) {
      showSnackbar('Errore download report', 'error');
    }
  };

  const handleDownloadBackup = async () => {
    try {
      const response = await axios.get('/api/backup/export/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `backup_gestionale_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showSnackbar('Backup scaricato con successo', 'success');
    } catch (error) {
      showSnackbar('Errore download backup', 'error');
    }
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) {
      showSnackbar('Seleziona un file backup', 'error');
      return;
    }
    if (!window.confirm('Il ripristino sovrascrivera TUTTE le entry delle tre sezioni. Continuare?')) {
      return;
    }

    setRestoring(true);
    try {
      const formData = new FormData();
      formData.append('backup_file', restoreFile);
      await axios.post('/api/backup/restore/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      showSnackbar('Backup ripristinato con successo', 'success');
      setRestoreFile(null);
      fetchStatistics();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore ripristino backup', 'error');
    } finally {
      setRestoring(false);
    }
  };

  const handleSendBackupEmailNow = async () => {
    setBackupSending(true);
    try {
      const response = await axios.post('/api/backup/send-email/');
      showSnackbar(`Backup inviato a: ${response.data.recipients.join(', ')}`, 'success');
      fetchSettings();
    } catch (error: any) {
      showSnackbar(error.response?.data?.detail || 'Errore invio backup', 'error');
    } finally {
      setBackupSending(false);
    }
  };

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Pannello Amministrazione
      </Typography>

      <Paper sx={{ mt: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
          <Tab label="Persone" />
          <Tab label="Categorie" />
          <Tab label="Email SMTP" />
          <Tab label="Impostazioni" />
          <Tab label="Backup" />
          <Tab label="Report & Statistiche" />
        </Tabs>

        {/* TAB 0: Persone */}
        {tabValue === 0 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Gestione Persone</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setPersonDialog({ open: true, editing: false, id: 0, name: '' })}
                disabled={persons.length >= 2}
              >
                Aggiungi Persona
              </Button>
            </Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Qui gestisci Marco e Anna. Le spese dal conto comune vengono tracciate automaticamente.
              Quando Marco o Anna anticipano una spesa dal loro conto personale, viene registrato per calcolare quanto devono contribuire il mese successivo.
            </Alert>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell align="right">Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {persons.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell>{person.id}</TableCell>
                      <TableCell>{person.name}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => setPersonDialog({ open: true, editing: true, id: person.id, name: person.name })}
                          sx={{ mr: 1 }}
                        >
                          Modifica
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handlePersonDelete(person.id)}
                        >
                          Elimina
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 1: Categorie */}
        {tabValue === 1 && (
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">Gestione Categorie</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setCategoryDialog({ open: true, editing: false, id: 0, name: '' })}
              >
                Aggiungi Categoria
              </Button>
            </Box>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Nome</TableCell>
                    <TableCell align="right">Azioni</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {categories.map((category) => (
                    <TableRow key={category.id}>
                      <TableCell>{category.id}</TableCell>
                      <TableCell>{category.name}</TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => setCategoryDialog({ open: true, editing: true, id: category.id, name: category.name })}
                          sx={{ mr: 1 }}
                        >
                          Modifica
                        </Button>
                        <Button
                          size="small"
                          color="error"
                          startIcon={<DeleteIcon />}
                          onClick={() => handleCategoryDelete(category.id)}
                        >
                          Elimina
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* TAB 2: Email SMTP */}
        {tabValue === 2 && settings && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Configurazione Email SMTP</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Server SMTP"
                  value={settings.smtp_server}
                  onChange={(e) => setSettings({ ...settings, smtp_server: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Porta"
                  value={settings.smtp_port}
                  onChange={(e) => setSettings({ ...settings, smtp_port: parseInt(e.target.value) })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Username"
                  value={settings.smtp_username || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_username: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="password"
                  label="Password"
                  value={settings.smtp_password || ''}
                  onChange={(e) => setSettings({ ...settings, smtp_password: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Email Destinatari (JSON array)"
                  value={settings.email_recipients || ''}
                  onChange={(e) => setSettings({ ...settings, email_recipients: e.target.value })}
                  helperText='Es: ["email1@example.com", "email2@example.com"]'
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handleSettingsSave} sx={{ mr: 2 }}>
                  Salva Configurazione Email
                </Button>
                <Button variant="outlined" onClick={handleTestEmail} disabled={testing}>
                  {testing ? 'Invio...' : 'Invia Email di Test'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 3: Impostazioni */}
        {tabValue === 3 && settings && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Impostazioni Generali</Typography>
            <Alert severity="info" sx={{ mb: 2 }}>
              Le entrate mensili sono calcolate automaticamente come: Marco (€{settings.monthly_contribution_per_person.toFixed(2)}) + Anna (€{settings.monthly_contribution_per_person.toFixed(2)}) = €{settings.monthly_income.toFixed(2)}
            </Alert>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Contributo Mensile per Persona (€)"
                  value={settings.monthly_contribution_per_person}
                  onChange={(e) => setSettings({ ...settings, monthly_contribution_per_person: parseFloat(e.target.value) })}
                  inputProps={{ step: '0.01' }}
                  helperText="Quanto Marco e Anna mettono ciascuno ogni mese"
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  type="number"
                  label="Entrate Mensili Totali (€)"
                  value={settings.monthly_income}
                  disabled
                  helperText="Calcolato automaticamente (2 × contributo)"
                />
              </Grid>
              <Grid item xs={12}>
                <Button variant="contained" onClick={handleSettingsSave}>
                  Salva Impostazioni
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* TAB 4: Backup */}
        {tabValue === 4 && settings && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Backup Dati</Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Il ripristino sovrascrive completamente tutte le entry di: spese Home, grossi anticipi, grosse spese/investimenti.
            </Alert>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Backup Manuale</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Button fullWidth variant="contained" onClick={handleDownloadBackup}>
                    Scarica Backup JSON
                  </Button>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button fullWidth variant="outlined" onClick={handleSendBackupEmailNow} disabled={backupSending}>
                    {backupSending ? 'Invio...' : 'Invia Backup Ora via Email'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2, mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Ripristino Backup</Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid item xs={12} md={8}>
                  <TextField
                    fullWidth
                    type="file"
                    inputProps={{ accept: '.json,application/json' }}
                    onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                    helperText={restoreFile ? `File selezionato: ${restoreFile.name}` : 'Seleziona un file backup JSON'}
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <Button fullWidth color="error" variant="contained" onClick={handleRestoreBackup} disabled={restoring || !restoreFile}>
                    {restoring ? 'Ripristino...' : 'Ripristina Backup'}
                  </Button>
                </Grid>
              </Grid>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Typography variant="subtitle1" gutterBottom>Invio Backup Programmato (ricorsivo)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={settings.backup_enabled}
                        onChange={(e) => setSettings({ ...settings, backup_enabled: e.target.checked })}
                      />
                    }
                    label="Abilita backup programmato"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Ogni quante ore"
                    value={settings.backup_frequency_hours || 24}
                    onChange={(e) => setSettings({ ...settings, backup_frequency_hours: Math.max(1, parseInt(e.target.value) || 24) })}
                    inputProps={{ min: 1 }}
                    helperText="Esempio: 24 = una volta al giorno"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Destinatari Backup (JSON array)"
                    value={settings.backup_recipients || ''}
                    onChange={(e) => setSettings({ ...settings, backup_recipients: e.target.value })}
                    helperText='Es: ["mia-email@example.com"]'
                    multiline
                    rows={2}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Ultimo backup programmato inviato: {settings.backup_last_sent_at ? new Date(settings.backup_last_sent_at).toLocaleString('it-IT') : 'mai'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" onClick={handleSettingsSave}>
                    Salva Impostazioni Backup
                  </Button>
                </Grid>
              </Grid>
            </Paper>
          </Box>
        )}

        {/* TAB 5: Report & Statistiche */}
        {tabValue === 5 && (
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>Report e Statistiche</Typography>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="month"
                  label="Mese Inizio"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  type="month"
                  label="Mese Fine"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <Button fullWidth variant="contained" onClick={fetchStatistics} sx={{ height: '56px' }}>
                  Genera Statistiche
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  fullWidth
                  variant="outlined"
                  onClick={handleDownloadReport}
                  disabled={!statistics}
                >
                  Scarica Report HTML
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleSendEmail}
                  disabled={sending || !statistics}
                >
                  {sending ? 'Invio in corso...' : 'Invia Report via Email'}
                </Button>
              </Grid>
            </Grid>

            {statistics && (
              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" gutterBottom>Risultati</Typography>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2">Totale Spese:</Typography>
                      <Typography variant="h5">€ {statistics.total_expenses.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2">N. Transazioni:</Typography>
                      <Typography variant="h5">{statistics.total_transactions}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2">Spesa Media:</Typography>
                      <Typography variant="h5">€ {statistics.average_transaction.toFixed(2)}</Typography>
                    </Grid>
                  </Grid>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Spese per Categoria</Typography>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Categoria</TableCell>
                          <TableCell align="right">Importo</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {Object.entries(statistics.expenses_by_category).map(([cat, amount]) => (
                          <TableRow key={cat}>
                            <TableCell>{cat}</TableCell>
                            <TableCell align="right">€ {amount.toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Riepilogo Mese Corrente (Home)</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2">Entrate Totali:</Typography>
                      <Typography variant="h6">€ {statistics.current_month_summary.total_income.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2">Spese Totali:</Typography>
                      <Typography variant="h6">€ {statistics.current_month_summary.total_expenses.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <Typography variant="body2">Saldo:</Typography>
                      <Typography variant="h6">€ {statistics.current_month_summary.balance.toFixed(2)}</Typography>
                    </Grid>
                  </Grid>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Quanto versare il mese successivo (al netto degli anticipi mensili)
                    </Typography>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Persona</TableCell>
                            <TableCell align="right">Anticipato nel mese</TableCell>
                            <TableCell align="right">Da versare mese successivo</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {Object.entries(statistics.current_month_summary.person_contributions).map(([name, contribution]) => (
                            <TableRow key={name}>
                              <TableCell>{name}</TableCell>
                              <TableCell align="right">€ {contribution.paid.toFixed(2)}</TableCell>
                              <TableCell align="right">€ {contribution.needs_to_pay.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Recap Grossi Anticipi (Totale Sezione)</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2">Totale Marco:</Typography>
                      <Typography variant="h6">€ {statistics.large_advances_balance.marco_total.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2">Totale Anna:</Typography>
                      <Typography variant="h6">€ {statistics.large_advances_balance.anna_total.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2">Totale Complessivo:</Typography>
                      <Typography variant="h6">€ {statistics.large_advances_balance.total_advances.toFixed(2)}</Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <Typography variant="body2">Differenza:</Typography>
                      <Typography variant="h6">€ {statistics.large_advances_balance.difference.toFixed(2)}</Typography>
                    </Grid>
                  </Grid>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {statistics.large_advances_balance.difference > 0
                      ? `Anna deve riequilibrare € ${statistics.large_advances_balance.difference.toFixed(2)} verso Marco.`
                      : statistics.large_advances_balance.difference < 0
                        ? `Marco deve riequilibrare € ${Math.abs(statistics.large_advances_balance.difference).toFixed(2)} verso Anna.`
                        : 'Bilancio grossi anticipi in pari.'}
                  </Typography>
                </Paper>

                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>Segnalazione Grosse Spese/Investimenti nel Periodo</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    Nuove entry: <strong>{statistics.new_major_expenses_count}</strong> | Totale: <strong>€ {statistics.new_major_expenses_total.toFixed(2)}</strong>
                  </Typography>

                  {statistics.major_expenses.length > 0 ? (
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Data</TableCell>
                            <TableCell>Descrizione</TableCell>
                            <TableCell>Categoria</TableCell>
                            <TableCell align="right">Importo</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {statistics.major_expenses.slice(0, 5).map((exp) => (
                            <TableRow key={exp.id}>
                              <TableCell>{new Date(exp.date).toLocaleDateString('it-IT')}</TableCell>
                              <TableCell>{exp.description}</TableCell>
                              <TableCell>{exp.category}</TableCell>
                              <TableCell align="right">€ {exp.amount.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Nessuna nuova entry nel periodo selezionato.
                    </Typography>
                  )}
                </Paper>
              </Box>
            )}
          </Box>
        )}
      </Paper>

      {/* Person Dialog */}
      <Dialog open={personDialog.open} onClose={() => setPersonDialog({ ...personDialog, open: false })}>
        <DialogTitle>{personDialog.editing ? 'Modifica Persona' : 'Nuova Persona'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome"
            value={personDialog.name}
            onChange={(e) => setPersonDialog({ ...personDialog, name: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPersonDialog({ ...personDialog, open: false })}>Annulla</Button>
          <Button onClick={handlePersonSave} variant="contained">Salva</Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialog.open} onClose={() => setCategoryDialog({ ...categoryDialog, open: false })}>
        <DialogTitle>{categoryDialog.editing ? 'Modifica Categoria' : 'Nuova Categoria'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Nome"
            value={categoryDialog.name}
            onChange={(e) => setCategoryDialog({ ...categoryDialog, name: e.target.value })}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialog({ ...categoryDialog, open: false })}>Annulla</Button>
          <Button onClick={handleCategorySave} variant="contained">Salva</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}

export default AdminPage;
