import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Eye, LogOut, RefreshCw } from 'lucide-react';
import { merchantAPI, Merchant } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import Chatbot from '../components/Chatbot';

const TIME_FILTERS = [
  { label: '30d', value: '30d' },
  { label: '7d', value: '7d' },
  { label: '1d', value: '1d' },
  { label: '6h', value: '6h' },
  { label: '1hr', value: '1hr' },
  { label: '10m', value: '10m' },
  { label: '1m', value: '1m' },
];

export default function Dashboard() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState('1d');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const fetchMerchants = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await merchantAPI.getMerchants({ filter: timeFilter });
      setMerchants(data.merchants || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch merchants');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMerchants();
  }, [timeFilter]);

  const filteredMerchants = useMemo(() => {
    if (!searchQuery.trim()) return merchants;
    const query = searchQuery.toLowerCase();
    return merchants.filter((m: Merchant) => m.orgCode.toLowerCase().includes(query));
  }, [merchants, searchQuery]);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'Good':
        return 'bg-green-500 shadow-green-500/50 health-glow-good';
      case 'Warning':
        return 'bg-yellow-500 shadow-yellow-500/50 health-glow-warning';
      case 'Critical':
        return 'bg-red-500 shadow-red-500/50 health-glow-critical';
      default:
        return 'bg-gray-500 shadow-gray-500/50';
    }
  };
  
  const getHealthIndicatorClass = (status: string) => {
    switch (status) {
      case 'Good':
        return 'health-indicator good';
      case 'Warning':
        return 'health-indicator warning';
      case 'Critical':
        return 'health-indicator critical';
      default:
        return 'health-indicator';
    }
  };
  
  const getHealthBadgeClass = (status: string) => {
    switch (status) {
      case 'Good':
        return 'health-badge';
      case 'Warning':
        return 'health-badge';
      case 'Critical':
        return 'health-badge';
      default:
        return '';
    }
  };

  const handleViewDetails = (orgCode: string) => {
    navigate(`/merchant/${orgCode}`);
  };

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
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold gradient-text">Merchant Health Dashboard</h1>
            <button
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700/50 text-gray-300 hover:bg-gray-700 hover:text-white transition-all duration-200 border border-gray-600/50 hover:border-gray-500 transform hover:scale-105"
            >
              <LogOut size={18} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="card card-glow mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Search */}
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 group-focus-within:text-primary-400 transition-colors" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search org code..."
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-400">Time Filter:</span>
              <div className="flex gap-2 flex-wrap">
                {TIME_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setTimeFilter(filter.value)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 transform hover:scale-105 ${
                      timeFilter === filter.value
                        ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30'
                        : 'bg-gray-700/50 text-gray-300 hover:bg-gray-700 border border-gray-600/50'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchMerchants}
              disabled={isLoading}
              className="btn-secondary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6 backdrop-blur-sm animate-pulse">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="text-center py-16">
              <RefreshCw className="animate-spin mx-auto text-primary-400 mb-4 pulse-glow" size={40} />
              <p className="text-gray-400 text-lg">Loading merchants...</p>
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg">No merchants found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700/50 border-b border-gray-600/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Org Code
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Successful Txns
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Failed Txns
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Health
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">
                      Additional Details
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filteredMerchants.map((merchant, index) => (
                    <tr 
                      key={merchant.orgCode} 
                      className="hover:bg-gray-700/30 transition-all duration-200 group cursor-pointer"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-100 group-hover:text-primary-300 transition-colors">
                          {merchant.orgCode}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-green-400 font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                          {merchant.successfulTxns.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-red-400 font-semibold flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
                          {merchant.failedTxns.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3 health-status-enter group/health">
                          <div className="relative">
                            <div
                              className={`w-4 h-4 rounded-full ${getHealthColor(merchant.healthStatus)} ${getHealthIndicatorClass(merchant.healthStatus)} health-bounce`}
                              style={{ animationDelay: `${index * 100}ms` }}
                            />
                            {/* Ripple effect on hover */}
                            <div className={`absolute inset-0 rounded-full ${getHealthColor(merchant.healthStatus)} opacity-0 group-hover/health:opacity-50 group-hover/health:animate-ping`}></div>
                            {/* Outer glow ring */}
                            <div className={`absolute -inset-1 rounded-full ${getHealthColor(merchant.healthStatus)} opacity-30 blur-sm ${getHealthIndicatorClass(merchant.healthStatus)}`}></div>
                          </div>
                          <div className="flex flex-col">
                            <span className={`text-sm font-semibold ${getHealthBadgeClass(merchant.healthStatus)} ${
                              merchant.healthStatus === 'Good' ? 'text-green-400' :
                              merchant.healthStatus === 'Warning' ? 'text-yellow-400' :
                              merchant.healthStatus === 'Critical' ? 'text-red-400' :
                              'text-gray-400'
                            }`}
                            style={{ animationDelay: `${index * 100}ms` }}>
                              {merchant.healthStatus}
                            </span>
                            {/* Health percentage bar */}
                            <div className="w-16 h-1 bg-gray-700 rounded-full mt-1 overflow-hidden">
                              <div 
                                className={`h-full rounded-full transition-all duration-1000 ${
                                  merchant.healthStatus === 'Good' ? 'bg-green-500' :
                                  merchant.healthStatus === 'Warning' ? 'bg-yellow-500' :
                                  merchant.healthStatus === 'Critical' ? 'bg-red-500' :
                                  'bg-gray-500'
                                }`}
                                style={{ 
                                  width: merchant.healthStatus === 'Good' ? '100%' :
                                         merchant.healthStatus === 'Warning' ? '70%' :
                                         merchant.healthStatus === 'Critical' ? '30%' : '0%',
                                  animation: 'slideIn 0.8s ease-out',
                                  animationDelay: `${index * 150}ms`
                                }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(merchant.orgCode)}
                          className="flex items-center gap-2 text-primary-400 hover:text-primary-300 transition-all duration-200 group/btn transform hover:scale-110"
                          title="Click Eye Button - Opens detailed holistic view with extra information"
                        >
                          <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center group-hover/btn:bg-primary-500/30 transition-all duration-200 border border-primary-500/30 group-hover/btn:border-primary-500/50">
                            <Eye size={18} className="text-primary-400" />
                          </div>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Chatbot */}
      <Chatbot />
    </div>
  );
}

