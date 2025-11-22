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
    const iconClass = "transition-all duration-300 transform hover:scale-125";
    switch (status) {
      case 'SETTLED':
      case 'AUTHORIZED':
        return <CheckCircle2 className={`text-green-400 ${iconClass} animate-pulse`} size={20} />;
      case 'FAILED':
        return <XCircle className={`text-red-400 ${iconClass} animate-pulse`} size={20} />;
      case 'PENDING':
        return <Clock className={`text-yellow-400 ${iconClass} animate-spin`} size={20} />;
      default:
        return <AlertCircle className={`text-gray-400 ${iconClass}`} size={20} />;
    }
  };

  const formatAmount = (amount?: number) => {
    if (!amount) return 'N/A';
    // Amount is in paise, convert to rupees
    return `₹${(amount / 100).toFixed(2)}`;
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
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="animate-spin mx-auto text-primary-400 mb-4 pulse-glow" size={40} />
          <p className="text-gray-400 text-lg">Loading merchant details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      {/* Header */}
      <header className="relative bg-gray-800/80 backdrop-blur-md border-b border-gray-700/50 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-700/50 rounded-lg transition-all duration-200 border border-gray-700/50 hover:border-gray-600 transform hover:scale-105"
            >
              <ArrowLeft size={20} className="text-gray-300" />
            </button>
            <div>
              <h1 className="text-2xl font-bold gradient-text">{orgCode} - Detailed Health View</h1>
              <p className="text-sm text-gray-400">Comprehensive transaction and health analysis</p>
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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg backdrop-blur-sm">
            {error}
          </div>
        )}

        {/* Overview Metrics */}
        {overview && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card card-glow hover:scale-105 transition-transform duration-300">
              <div className="text-sm text-gray-400 mb-2">Successful</div>
              <div className="text-3xl font-bold text-green-400 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-400 animate-pulse"></span>
                {overview.metrics?.totalSuccessRequests?.toLocaleString() || '0'}
              </div>
            </div>
            <div className="card card-glow hover:scale-105 transition-transform duration-300">
              <div className="text-sm text-gray-400 mb-2">Failed</div>
              <div className="text-3xl font-bold text-red-400 flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-400 animate-pulse"></span>
                {overview.metrics?.errorCount?.toLocaleString() || '0'}
              </div>
            </div>
            <div className="card card-glow hover:scale-105 transition-transform duration-300">
              <div className="text-sm text-gray-400 mb-2">Avg Response</div>
              <div className="text-3xl font-bold text-gray-100">
                {overview.metrics?.avgResponseTime
                  ? `${Math.round(overview.metrics.avgResponseTime)}ms`
                  : 'N/A'}
              </div>
            </div>
            <div className="card card-glow hover:scale-105 transition-transform duration-300">
              <div className="text-sm text-gray-400 mb-2">Success Rate</div>
              <div className="text-3xl font-bold gradient-text">
                {overview.metrics?.successRate
                  ? `${overview.metrics.successRate.toFixed(1)}%`
                  : 'N/A'}
              </div>
            </div>
          </div>
        )}

        {/* Coralogix Summary */}
        {coralogixSummary && (
          <div className="card bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-500/30 backdrop-blur-sm">
            <h2 className="text-lg font-semibold gradient-text mb-3">Coralogix Log Insights (Powered by MCP)</h2>
            <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{coralogixSummary}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Transaction Timeline */}
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Recent Transaction Timeline</h2>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">No transactions found</div>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {transactions.map((txn: Transaction, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-4 bg-gray-700/30 rounded-lg hover:bg-gray-700/50 transition-all duration-200 border border-gray-600/30 hover:border-gray-500/50 transform hover:scale-[1.02]"
                  >
                    <div className="flex-shrink-0">{getStatusIcon(txn.status)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-200">
                          {formatTime(txn.timestamp)}
                        </span>
                        <span
                          className={`text-sm font-semibold ${
                            txn.status === 'FAILED' ? 'text-red-400' : 'text-green-400'
                          }`}
                        >
                          {txn.status === 'FAILED' && txn.errorMessage
                            ? `❌ ${txn.status} ${formatAmount(txn.amount)} - ${txn.errorMessage}`
                            : `✅ ${txn.status} ${formatAmount(txn.amount)}`}
                        </span>
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
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
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Trend Analysis</h2>
            {trends ? (
              <div className="space-y-4">
                {/* Mini Chart */}
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trends.hourlyVolume}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis
                        dataKey="time"
                        tickFormatter={(value) => format(new Date(value), 'HH:mm')}
                        stroke="#9ca3af"
                        fontSize={12}
                      />
                      <YAxis stroke="#9ca3af" fontSize={12} />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px',
                          color: '#f3f4f6'
                        }}
                        labelFormatter={(value) => format(new Date(value), 'HH:mm')}
                        formatter={(value: number) => [value, 'Volume']}
                      />
                      <Line
                        type="monotone"
                        dataKey="volume"
                        stroke="#0ea5e9"
                        strokeWidth={3}
                        dot={{ r: 4, fill: '#0ea5e9' }}
                        activeDot={{ r: 6, fill: '#38bdf8' }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Today vs Yesterday */}
                <div className="border-t border-gray-700 pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Today vs Yesterday:</span>
                    <div className="flex items-center gap-2">
                      {trends.todayVsYesterday.percentageChange >= 0 ? (
                        <TrendingUp className="text-green-400" size={20} />
                      ) : (
                        <TrendingDown className="text-red-400" size={20} />
                      )}
                      <span
                        className={`text-lg font-semibold ${
                          trends.todayVsYesterday.percentageChange >= 0
                            ? 'text-green-400'
                            : 'text-red-400'
                        }`}
                      >
                        {trends.todayVsYesterday.percentageChange >= 0 ? '+' : ''}
                        {trends.todayVsYesterday.percentageChange.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Today: {trends.todayVsYesterday.todayTotal.toLocaleString()} | Yesterday:{' '}
                    {trends.todayVsYesterday.yesterdayTotal.toLocaleString()}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400">No trend data available</div>
            )}
          </div>
        </div>
      </div>

      {/* Chatbot with context */}
      <Chatbot orgCode={orgCode} context={`Viewing detailed health data for ${orgCode}`} />
    </div>
  );
}

