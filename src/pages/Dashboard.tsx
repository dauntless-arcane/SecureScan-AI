import React from 'react';
import { Shield, AlertTriangle, CheckCircle, Clock, TrendingUp, FileText, GitBranch } from 'lucide-react';

const Dashboard: React.FC = () => {
  const recentScans = [
    { repo: 'frontend-app', date: '2025-01-02', vulns: 3, status: 'completed', severity: 'medium' },
    { repo: 'api-service', date: '2025-01-01', vulns: 7, status: 'in-progress', severity: 'high' },
    { repo: 'user-dashboard', date: '2024-12-30', vulns: 1, status: 'completed', severity: 'low' },
    { repo: 'payment-gateway', date: '2024-12-29', vulns: 12, status: 'completed', severity: 'critical' },
    { repo: 'mobile-app', date: '2024-12-28', vulns: 5, status: 'completed', severity: 'medium' },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400';
      case 'in-progress': return 'text-yellow-400';
      case 'failed': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Security Dashboard</h1>
        <p className="text-gray-400">Monitor your code security across all repositories</p>
      </div>

      {/* Security Score Card */}
      <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white">Overall Security Score</h2>
          <TrendingUp className="w-8 h-8 text-green-400" />
        </div>
        
        <div className="flex items-center justify-center mb-6">
          <div className="relative w-40 h-40">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="currentColor"
                strokeWidth="8"
                fill="transparent"
                className="text-gray-700"
              />
              <circle
                cx="80"
                cy="80"
                r="70"
                stroke="url(#gradient)"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 70}`}
                strokeDashoffset={`${2 * Math.PI * 70 * (1 - 0.85)}`}
                className="transition-all duration-1000 ease-out"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#C8A2C8" />
                  <stop offset="100%" stopColor="#3B0A45" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-white">85%</div>
                <div className="text-gray-400">Secure</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">127</div>
            <div className="text-gray-400">Total Scans</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-400">104</div>
            <div className="text-gray-400">Issues Fixed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-400">18</div>
            <div className="text-gray-400">Pending</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-400">5</div>
            <div className="text-gray-400">Critical</div>
          </div>
        </div>
      </div>

      {/* Vulnerability Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-red-900/30 to-deepblack/50 rounded-xl p-6 border border-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Critical</h3>
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">5</div>
          <div className="text-gray-400 text-sm">Requires immediate action</div>
        </div>

        <div className="bg-gradient-to-br from-orange-900/30 to-deepblack/50 rounded-xl p-6 border border-orange-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">High</h3>
            <Shield className="w-6 h-6 text-orange-400" />
          </div>
          <div className="text-3xl font-bold text-orange-400 mb-2">13</div>
          <div className="text-gray-400 text-sm">Address within 48 hours</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/30 to-deepblack/50 rounded-xl p-6 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Medium</h3>
            <Clock className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold text-yellow-400 mb-2">28</div>
          <div className="text-gray-400 text-sm">Plan for next sprint</div>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-deepblack/50 rounded-xl p-6 border border-green-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Low</h3>
            <CheckCircle className="w-6 h-6 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">42</div>
          <div className="text-gray-400 text-sm">Low priority fixes</div>
        </div>
      </div>

      {/* Recent Scans Table */}
      <div className="bg-gradient-to-br from-darkpurple-900/20 to-deepblack/50 rounded-2xl border border-lilac-400/20">
        <div className="p-6 border-b border-lilac-400/20">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white">Recent Scans</h2>
            <button className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all duration-200">
              View All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-lilac-400/20">
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Repository</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Date</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Vulnerabilities</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Status</th>
                <th className="text-left px-6 py-4 text-gray-400 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((scan, index) => (
                <tr key={index} className="border-b border-lilac-400/10 hover:bg-lilac-400/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <GitBranch className="w-5 h-5 text-lilac-400" />
                      <span className="text-white font-medium">{scan.repo}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-400">{scan.date}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-white font-medium">{scan.vulns}</span>
                      <span className={`inline-block w-2 h-2 rounded-full ${getSeverityColor(scan.severity)}`}></span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`capitalize ${getStatusColor(scan.status)}`}>
                      {scan.status.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <button className="text-lilac-400 hover:text-lilac-300 transition-colors">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button className="text-lilac-400 hover:text-lilac-300 transition-colors">
                        View Report
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;