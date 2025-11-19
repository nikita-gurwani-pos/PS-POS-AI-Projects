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
        return 'bg-green-500';
      case 'Warning':
        return 'bg-yellow-500';
      case 'Critical':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const handleViewDetails = (orgCode: string) => {
    navigate(`/merchant/${orgCode}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900">Merchant Health Dashboard</h1>
            <button
              onClick={logout}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="card mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* Search */}
            <div className="flex-1 w-full sm:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search org code"
                  className="input-field pl-10"
                />
              </div>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Time Filter:</span>
              <div className="flex gap-2 flex-wrap">
                {TIME_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    onClick={() => setTimeFilter(filter.value)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                      timeFilter === filter.value
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
              className="btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="card overflow-hidden">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin mx-auto text-primary-600 mb-4" size={32} />
              <p className="text-gray-600">Loading merchants...</p>
            </div>
          ) : filteredMerchants.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-600">No merchants found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Org Code
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Successful Txns
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Failed Txns
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Health
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Additional Details
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMerchants.map((merchant) => (
                    <tr key={merchant.orgCode} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{merchant.orgCode}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-green-600 font-semibold">
                          {merchant.successfulTxns.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-red-600 font-semibold">
                          {merchant.failedTxns.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-3 h-3 rounded-full ${getHealthColor(merchant.healthStatus)}`}
                          />
                          <span className="text-sm font-medium text-gray-900">
                            {merchant.healthStatus}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewDetails(merchant.orgCode)}
                          className="flex items-center gap-2 text-primary-600 hover:text-primary-700 transition-colors group"
                          title="Click Eye Button - Opens detailed holistic view with extra information"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center group-hover:bg-primary-200 transition-colors">
                            <Eye size={16} className="text-primary-600" />
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

