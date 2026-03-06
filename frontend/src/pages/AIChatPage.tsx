import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AIChartPoint {
  label: string;
  value: number;
}

interface AIChartSpec {
  type: 'line' | 'bar' | 'pie';
  title: string;
  data: AIChartPoint[];
}

interface AIToolCall {
  tool_name: string;
  arguments: Record<string, number | string>;
}

interface AISuggestedAction {
  label: string;
  tool_call?: AIToolCall;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  charts?: AIChartSpec[];
  suggestedActions?: AISuggestedAction[];
}

interface HealthResponse {
  enabled: boolean;
  reachable: boolean;
  model: string;
  model_available: boolean;
  detail?: string | null;
}

const COLORS = ['#1976d2', '#2e7d32', '#ed6c02', '#9c27b0', '#d32f2f', '#0288d1', '#558b2f', '#6d4c41'];

function AIChatPage() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedSession = sessionStorage.getItem('ai_chat_session_id');
    if (storedSession) {
      setSessionId(storedSession);
    }

    const fetchHealth = async () => {
      try {
        const response = await axios.get('/api/ai-chat/health');
        setHealth(response.data);
      } catch (err) {
        console.error('AI health check failed:', err);
        setHealth(null);
        setError('Impossibile verificare lo stato del servizio AI.');
      }
    };

    fetchHealth();
  }, []);

  const modelBadge = useMemo(() => {
    if (!health) return 'Stato AI sconosciuto';
    if (!health.enabled) return 'AI disabilitata';
    if (!health.reachable) return 'AI non raggiungibile';
    if (!health.model_available) return `Modello non trovato: ${health.model}`;
    return `Modello attivo: ${health.model}`;
  }, [health]);

  const ensureSession = async (): Promise<string> => {
    if (sessionId) return sessionId;

    const response = await axios.post('/api/ai-chat/session');
    const id = response.data.session_id as string;
    setSessionId(id);
    sessionStorage.setItem('ai_chat_session_id', id);
    return id;
  };

  const handleSend = async (customMessage?: string, followUpTool?: AIToolCall) => {
    const candidate = customMessage ?? input;
    const trimmed = candidate.trim();
    if (!trimmed || loading) return;

    setError(null);
    const newUserMessage: ChatMessage = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, newUserMessage]);
    if (!customMessage) {
      setInput('');
    }
    setLoading(true);

    try {
      const sid = await ensureSession();
      const response = await axios.post('/api/ai-chat/message', {
        session_id: sid,
        message: trimmed,
        follow_up_tool: followUpTool ?? null,
      });
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.data.answer,
        charts: response.data.charts,
        suggestedActions: response.data.suggested_actions ?? [],
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error('AI message error:', err);
      const detail = err?.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Errore durante la richiesta AI.');
    } finally {
      if (customMessage) {
        setInput('');
      }
      setLoading(false);
    }
  };

  const handleResetSession = async () => {
    try {
      const response = await axios.post('/api/ai-chat/session');
      const id = response.data.session_id as string;
      setSessionId(id);
      sessionStorage.setItem('ai_chat_session_id', id);
      setMessages([]);
      setError(null);
    } catch (err) {
      console.error('AI session reset error:', err);
      setError('Impossibile creare una nuova sessione AI.');
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        AI Chat
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Typography variant="body1">{modelBadge}</Typography>
          <Button variant="outlined" onClick={handleResetSession}>Nuova Sessione</Button>
        </Stack>
        {health?.detail && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{health.detail}</Typography>}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper sx={{ p: 2, mb: 2, minHeight: 260 }}>
        <Stack spacing={2}>
          {messages.length === 0 && (
            <Typography color="text.secondary">
              Fai domande sui dati del gestionale, ad esempio: "Confronta febbraio e marzo 2026".
            </Typography>
          )}

          {messages.map((message, index) => (
            <Box key={index} sx={{ alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '100%' }}>
              <Paper
                sx={{
                  p: 1.5,
                  backgroundColor: message.role === 'user' ? 'primary.main' : 'background.paper',
                  color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  border: '1px solid',
                  borderColor: message.role === 'user' ? 'primary.dark' : 'divider',
                }}
              >
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
              </Paper>

              {message.role === 'assistant' && message.suggestedActions && message.suggestedActions.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                  {message.suggestedActions.map((action, questionIdx) => (
                    <Chip
                      key={`${index}-q-${questionIdx}`}
                      label={action.label}
                      variant="outlined"
                      onClick={() => handleSend(action.label, action.tool_call)}
                      sx={{
                        maxWidth: '100%',
                        '& .MuiChip-label': {
                          whiteSpace: 'normal',
                          textOverflow: 'clip',
                          display: 'block',
                        },
                      }}
                    />
                  ))}
                </Stack>
              )}

              {message.role === 'assistant' && message.charts && message.charts.length > 0 && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  {message.charts.map((chart, chartIndex) => (
                    <Paper key={`${index}-${chartIndex}`} sx={{ p: 2 }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>{chart.title}</Typography>
                      <Box sx={{ width: '100%', height: 280 }}>
                        <ResponsiveContainer>
                          {chart.type === 'line' ? (
                            <LineChart data={chart.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Line dataKey="value" name="Valore" stroke="#1976d2" strokeWidth={3} dot={{ r: 3 }} />
                            </LineChart>
                          ) : chart.type === 'bar' ? (
                            <BarChart data={chart.data}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="label" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="value" name="Valore" fill="#2e7d32" />
                            </BarChart>
                          ) : (
                            <PieChart>
                              <Pie data={chart.data} dataKey="value" nameKey="label" outerRadius={90} label>
                                {chart.data.map((entry, idx) => (
                                  <Cell key={`${entry.label}-${idx}`} fill={COLORS[idx % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                              <Legend />
                            </PieChart>
                          )}
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={20} />
              <Typography variant="body2">L'assistente sta elaborando...</Typography>
            </Box>
          )}
        </Stack>
      </Paper>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
            fullWidth
            multiline
            minRows={2}
            maxRows={6}
            label="Scrivi la tua domanda"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button variant="contained" onClick={handleSend} disabled={loading || input.trim().length === 0}>
            Invia
          </Button>
        </Stack>
      </Paper>
    </Container>
  );
}

export default AIChatPage;
