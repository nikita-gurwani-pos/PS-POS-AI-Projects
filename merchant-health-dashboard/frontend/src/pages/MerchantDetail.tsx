import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { dashboardAPI, Transaction, TrendAnalysis } from '../services/api';
import { promptAPI } from '../services/api';
import Chatbot from '../components/Chatbot';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

export default function MerchantDetail() {
  const { orgCode } = useParams<{ orgCode: string }>();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trends, setTrends] = useState<TrendAnalysis | null>(null);
  const [overview, setOverview] = useState<any>(null);
  const [coralogixSummary, setCoralogixSummary] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (orgCode) {
      fetchData();
    }
  }, [orgCode]);

  const fetchData = async () => {
    if (!orgCode) return;
    
    setIsLoading(true);
    setError('');
    
    try {
      const [timelineData, trendsData, overviewData, summaryData] = await Promise.all([
        dashboardAPI.getTransactionTimeline(orgCode, 20),
        dashboardAPI.getTrends(orgCode),
        dashboardAPI.getOverview(orgCode),
        promptAPI.getOrgSummary(orgCode).catch(() => null),
      ]);

      setTransactions(timelineData.transactions || []);
      setTrends(trendsData);
      setOverview(overviewData);
      if (summaryData?.data?.naturalLanguageResponse) {
        setCoralogixSummary(summaryData.data.naturalLanguageResponse);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SETTLED':
      case 'AUTHORIZED':
        return <CheckCircle2 className="text-green-500" size={20} />;
      case 'FAILED':
        return <XCircle className="text-red-500" size={20} />;
      case 'PENDING':
        return <Clock className="text-yellow-500" size={20} />;
      default:
        return <AlertCircle className="text-gray-500" size={20} />;
    }
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return 'N/A';
    return `$${(amount / 100).toFixed(2)}`;
  };

  const formatResponseTime = (time: number) => {
    if (time < 1000) {
      return `${Math.round(time)}ms`;
    }
    return `${(time / 1000).toFixed(1)}s`;
  };

  const formatTime = (timestamp: string) => {
    try {
      return format(new Date(timestamp), 'HH:mm');
    } catch {
      return timestamp;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-primary-600 mb-4" size={32} />
          <p className="text-gray-600">Loading merchant details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{orgCode} - Detailed Health View</h1>
              <p className="text-sm text-gray-600">Comprehensive transaction and health analysis</p>
            </div>
            <button
              onClick={fetchData}
              disabled={isLoading}
              className="ml-auto btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Overview Metrics */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Successful</div>
              <div className="text-2xl font-bold text-green-600">
                {overview.metrics?.totalSuccessRequests?.toLocaleString() || '0'}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-600">
                {overview.metrics?.errorCount?.toLocaleString() || '0'}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Avg Response</div>
              <div className="text-2xl font-bold text-gray-900">
                {overview.metrics?.avgResponseTime
                  ? `${Math.round(overview.metrics.avgResponseTime)}ms`
                  : 'N/A'}
              </div>
            </div>
            <div className="card">
              <div className="text-sm text-gray-600 mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-primary-600">
                {overview.metrics?.successRate
                  ? `${overview.metrics.successRate.toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Coralogix Summary */}
        {coralogixSummary && (
          <div className="card bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Coralogix Log Insights (Powered by MCP)</h2>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{coralogixSummary}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transaction Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Transaction Timeline</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No transactions found</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.map((txn: Transaction, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex-shrink-0">{getStatusIcon(txn.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">
                          {formatTime(txn.timestamp)}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            txn.status === 'FAILED' ? 'text-red-600' : 'text-green-600'
                          }`}
                        >
                          {txn.status === 'FAILED' && txn.errorMessage
                            ? `❌ ${txn.status} ${formatAmount(txn.amount)} - ${txn.errorMessage}`
                            : `✅ ${txn.status} ${formatAmount(txn.amount)}`}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Response Time: {formatResponseTime(txn.responseTime)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend Analysis */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Trend Analysis</h2>
            {trends ? (
              <div className="space-y-4">
                {/* Mini Chart */}
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.hourlyVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                        stroke="#6b7280"
                        fontSize={12}
                      />
                      <YAxis stroke="#6b7280" fontSize={12} />
                      <Tooltip
                        labelFormatter={(value) => format(new Date(value), 'HH:mm')}
                        formatter={(value: number) => [value, 'Volume']}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Today vs Yesterday */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Today vs Yesterday:</span>
                    <div className="flex items-center gap-2">
                      {trends.todayVsYesterday.percentageChange >= 0 ? (
                        <TrendingUp className="text-green-500" size={20} />
                      ) : (
                        <TrendingDown className="text-red-500" size={20} />
                      )}
                      <span
                        className={`text-lg font-semibold ${
                          trends.todayVsYesterday.percentageChange >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      >
                        {trends.todayVsYesterday.percentageChange >= 0 ? '+' : ''}
                        {trends.todayVsYesterday.percentageChange.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Today: {trends.todayVsYesterday.todayTotal.toLocaleString()} | Yesterday:{' '}
                    {trends.todayVsYesterday.yesterdayTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">No trend data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Chatbot with context */}
      <Chatbot orgCode={orgCode} context={`Viewing detailed health data for ${orgCode}`} />
    </div>
  );
}

