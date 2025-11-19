import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export interface Merchant {
  orgCode: string;
  successfulTxns: number;
  failedTxns: number;
  pendingTxns: number;
  healthStatus: 'Good' | 'Warning' | 'Critical' | 'Unknown';
  healthColor: string;
}

export interface Transaction {
  timestamp: string;
  status: 'SETTLED' | 'AUTHORIZED' | 'FAILED' | 'PENDING';
  amount?: number;
  responseTime: number;
  errorMessage?: string;
  errorCode?: string;
}

export interface TrendAnalysis {
  hourlyVolume: Array<{ time: string; volume: number }>;
  todayVsYesterday: {
    todayTotal: number;
    yesterdayTotal: number;
    percentageChange: number;
  };
}

export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/api/auth/login', { username, password });
    return response.data;
  },
};

export const merchantAPI = {
  getMerchants: async (params?: {
    page?: number;
    limit?: number;
    orgCode?: string;
    filter?: string;
  }) => {
    const response = await api.get('/api/merchants', { params });
    return response.data;
  },
  searchMerchants: async (org: string) => {
    const response = await api.get('/api/merchants/filter', { params: { org } });
    return response.data;
  },
};

export const dashboardAPI = {
  getOverview: async (orgCode: string, startTime?: string, endTime?: string) => {
    const response = await api.get('/api/dashboard/overview', {
      params: { orgCode, startTime, endTime },
    });
    return response.data;
  },
  getTransactionTimeline: async (
    orgCode: string,
    limit?: number,
    startTime?: string,
    endTime?: string
  ) => {
    const response = await api.get('/api/dashboard/transactions/timeline', {
      params: { orgCode, limit, startTime, endTime },
    });
    return response.data;
  },
  getTrends: async (orgCode: string) => {
    const response = await api.get('/api/dashboard/trends', {
      params: { orgCode },
    });
    return response.data;
  },
};

export const promptAPI = {
  sendPrompt: async (prompt: string) => {
    const response = await api.post('/api/coralogix/prompt', { prompt });
    return response.data;
  },
  getOrgSummary: async (orgCode: string) => {
    const response = await api.get(`/api/coralogix/prompt/org/summary/${orgCode}`);
    return response.data;
  },
};

export default api;

