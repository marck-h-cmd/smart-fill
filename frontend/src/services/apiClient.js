import axios from 'axios';

const API_BASE = 'http://localhost:5000/api';

const api = axios.create({ baseURL: API_BASE });

export const databases = {
  list: () => api.get('/databases').then(r => r.data.data || []),
  getActive: () => api.get('/databases/active').then(r => r.data.data),
  get: (id) => api.get(`/databases/${id}`).then(r => r.data.data),
  create: (data) => api.post('/databases', data).then(r => r.data),
  update: (id, data) => api.put(`/databases/${id}`, data).then(r => r.data),
  delete: (id) => api.delete(`/databases/${id}`).then(r => r.data),
  test: (id) => api.post(`/databases/${id}/test`).then(r => r.data),
  activate: (id) => api.post(`/databases/${id}/activate`).then(r => r.data),
  stats: (id) => api.post(`/databases/${id}/stats`).then(r => r.data.data),
  fragmentation: (id) => api.post(`/databases/${id}/fragmentation`).then(r => r.data.data || []),
};

export const whatsapp = {
  listSessions: () => api.get('/whatsapp/sessions').then(r => r.data.data || []),
  createSession: (name) => api.post('/whatsapp/sessions', { name }).then(r => r.data),
  startSession: (id) => api.post(`/whatsapp/sessions/${id}/start`).then(r => r.data),
  getQR: (id) => api.get(`/whatsapp/sessions/${id}/qr`).then(r => r.data),
  deleteSession: (id) => api.delete(`/whatsapp/sessions/${id}`).then(r => r.data),
  activateSession: (id) => api.post(`/whatsapp/sessions/${id}/activate`).then(r => r.data),
  sendMessage: (session, phone, text) => api.post('/whatsapp/send', { session, phone, text }).then(r => r.data),
};

export const config = {
  get: () => api.get('/config').then(r => r.data.data || {}),
  save: (data) => api.post('/config', data).then(r => r.data),
};

export const history = {
  list: (table, limit) => api.get('/history', { params: { table, limit } }).then(r => r.data.data || []),
  tables: () => api.get('/history/tables').then(r => r.data.data || []),
};

export const reports = {
  generate: () => api.get('/reports').then(r => r.data),
};

export const maintenance = {
  get: () => api.get('/maintenance').then(r => r.data.data || {}),
  save: (data) => api.post('/maintenance', data).then(r => r.data),
};

export const automation = {
  status: () => api.get('/automation/status').then(r => r.data.data || {}),
  config: (data) => api.post('/automation/config', data).then(r => r.data),
};

export default api;
