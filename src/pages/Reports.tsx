import React, { useState } from 'react';
import { Download, Filter, Calendar, FileText, Shield, AlertTriangle } from 'lucide-react';

const Reports: React.FC = () => {
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [sortBy, setSortBy] = useState('date');

  const reports = [
    {
      id: 1,
      repo: 'frontend-app',
      date: '2025-01-02',
      vulnerabilities: { critical: 0, high: 2, medium: 3, low: 1 },
      fixed: 4,
      pending: 2,
      status: 'completed',
      scanTime: '2m 34s'
    },
    {
      id: 2,
      repo: 'api-service',
      date: '2025-01-01',
      vulnerabilities: { critical: 2, high: 5, medium: 8, low: 3 },
      fixed: 12,
      pending: 6,
      status: 'completed',
      scanTime: '4m 12s'
    },
    {
      id: 3,
      repo: 'user-dashboard',
      date: '2024-12-30',
      vulnerabilities: { critical: 0, high: 0, medium: 1, low: 2 },
      fixed: 3,
      pending: 0,
      status: 'completed',
      scanTime: '1m 45s'
    },
    {
      id: 4,
      repo: 'payment-gateway',
      date: '2024-12-29',
      vulnerabilities: { critical: 3, high: 6, medium: 4, low: 2 },
      fixed: 8,
      pending: 7,
      status: 'completed',
      scanTime: '6m 23s'
    },
    {
      id: 5,
      repo: 'mobile-app',
      date: '2024-12-28',
      vulnerabilities: { critical: 1, high: 2, medium: 5, low: 8 },
      fixed: 12,
      pending: 4,
      status: 'completed',
      scanTime: '3m 56s'
    }
  ];

  const getTotalVulns = (vulns: any) => {
    return vulns.critical + vulns.high + vulns.medium + vulns.low;
  };

  const getHighestSeverity = (vulns: any) => {
    if (vulns.critical > 0) return 'critical';
    if (vulns.high > 0) return 'high';
    if (vulns.medium > 0) return 'medium';
    return 'low';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-900/20 border-red-500/20';
      case 'high': return 'bg-orange-900/20 border-orange-500/20';
      case 'medium': return 'bg-yellow-900/20 border-yellow-500/20';
      case 'low': return 'bg-green-900/20 border-green-500/20';
      default: return 'bg-gray-900/20 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Security Reports</h1>
          <p className="text-gray-400">View and download detailed security scan reports</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-darkpurple-900 text-white px-4 py-2 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-darkpurple-900 text-white px-4 py-2 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none"
          >
            <option value="date">Sort by Date</option>
            <option value="repo">Sort by Repository</option>
            <option value="vulns">Sort by Vulnerabilities</option>
          </select>

          <button className="flex items-center space-x-2 bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all">
            <Filter className="w-4 h-4" />
            <span>Apply Filters</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-xl p-6 border border-lilac-400/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Total Scans</h3>
            <FileText className="w-6 h-6 text-lilac-400" />
          </div>
          <div className="text-3xl font-bold text-lilac-400 mb-2">{reports.length}</div>
          <div className="text-gray-400 text-sm">This month</div>
        </div>

        <div className="bg-gradient-to-br from-red-900/30 to-deepblack/50 rounded-xl p-6 border border-red-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Critical Issues</h3>
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <div className="text-3xl font-bold text-red-400 mb-2">6</div>
          <div className="text-gray-400 text-sm">Requiring attention</div>
        </div>

        <div className="bg-gradient-to-br from-green-900/30 to-deepblack/50 rounded-xl p-6 border border-green-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Issues Fixed</h3>
            <Shield className="w-6 h-6 text-green-400" />
          </div>
          <div className="text-3xl font-bold text-green-400 mb-2">39</div>
          <div className="text-gray-400 text-sm">Successfully resolved</div>
        </div>

        <div className="bg-gradient-to-br from-yellow-900/30 to-deepblack/50 rounded-xl p-6 border border-yellow-500/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">Pending Review</h3>
            <Calendar className="w-6 h-6 text-yellow-400" />
          </div>
          <div className="text-3xl font-bold text-yellow-400 mb-2">19</div>
          <div className="text-gray-400 text-sm">Awaiting approval</div>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.map((report) => {
          const totalVulns = getTotalVulns(report.vulnerabilities);
          const highestSeverity = getHighestSeverity(report.vulnerabilities);
          
          return (
            <div
              key={report.id}
              className={`bg-gradient-to-br from-darkpurple-900/20 to-deepblack/50 rounded-xl p-6 border transition-all duration-200 hover:border-lilac-400/40 ${getSeverityBg(highestSeverity)}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                {/* Report Info */}
                <div className="flex-1">
                  <div className="flex items-center space-x-4 mb-3">
                    <h3 className="text-xl font-bold text-white">{report.repo}</h3>
                    <span className={`text-sm px-3 py-1 rounded-full bg-gray-800 ${getSeverityColor(highestSeverity)}`}>
                      {highestSeverity.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-gray-400 text-sm">Scan Date</p>
                      <p className="text-white font-medium">{report.date}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Total Issues</p>
                      <p className="text-white font-medium">{totalVulns}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Fixed</p>
                      <p className="text-green-400 font-medium">{report.fixed}</p>
                    </div>
                    <div>
                      <p className="text-gray-400 text-sm">Pending</p>
                      <p className="text-yellow-400 font-medium">{report.pending}</p>
                    </div>
                  </div>

                  {/* Vulnerability Breakdown */}
                  <div className="flex items-center space-x-4">
                    {report.vulnerabilities.critical > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                        <span className="text-red-400 text-sm">{report.vulnerabilities.critical} Critical</span>
                      </div>
                    )}
                    {report.vulnerabilities.high > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                        <span className="text-orange-400 text-sm">{report.vulnerabilities.high} High</span>
                      </div>
                    )}
                    {report.vulnerabilities.medium > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                        <span className="text-yellow-400 text-sm">{report.vulnerabilities.medium} Medium</span>
                      </div>
                    )}
                    {report.vulnerabilities.low > 0 && (
                      <div className="flex items-center space-x-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-green-400 text-sm">{report.vulnerabilities.low} Low</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <p className="text-gray-400 text-sm">Scan Time</p>
                    <p className="text-white font-medium">{report.scanTime}</p>
                  </div>
                  
                  <button className="flex items-center space-x-2 bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all">
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export All */}
      <div className="text-center">
        <button className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg hover:shadow-lilac-400/25 transition-all">
          Export All Reports
        </button>
      </div>
    </div>
  );
};

export default Reports;