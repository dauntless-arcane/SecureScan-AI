import React, { useEffect, useRef, useState } from 'react';
import { Github, Search, CheckCircle, ChevronDown, ChevronUp, XCircle, ShieldOff, Sparkles, Loader2 } from 'lucide-react';
import { generateFindingFix, getScanReport, getScanStatus, submitScan, type Finding, type ScanStatus } from '../lib/api';

type FixState = { status: 'loading' | 'ready' | 'error'; content?: string };

const POLL_INTERVAL_MS = 2000;

type SeverityBucket = 'critical' | 'high' | 'medium' | 'low' | 'info';

const SEVERITY_ORDER: SeverityBucket[] = ['critical', 'high', 'medium', 'low', 'info'];

const SEVERITY_STYLES: Record<SeverityBucket, { label: string; badge: string; text: string }> = {
  critical: { label: 'CRITICAL', badge: 'bg-red-500', text: 'text-red-400' },
  high: { label: 'HIGH', badge: 'bg-orange-500', text: 'text-orange-400' },
  medium: { label: 'MEDIUM', badge: 'bg-yellow-500', text: 'text-yellow-400' },
  low: { label: 'LOW', badge: 'bg-green-500', text: 'text-green-400' },
  info: { label: 'INFO', badge: 'bg-blue-500', text: 'text-blue-400' },
};

// Semgrep reports ERROR/WARNING/INFO; map those onto our severity scale.
function toSeverityBucket(severity: string | null): SeverityBucket {
  switch ((severity ?? '').toUpperCase()) {
    case 'ERROR':
      return 'critical';
    case 'WARNING':
      return 'medium';
    case 'INFO':
      return 'low';
    default:
      return 'info';
  }
}

const RepoScan: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [scanId, setScanId] = useState<string | null>(null);
  const [status, setStatus] = useState<ScanStatus | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<number | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [reportError, setReportError] = useState<string | null>(null);
  const [fixes, setFixes] = useState<Record<number, FixState>>({});

  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scanning = status === 'QUEUED' || status === 'CLONING' || status === 'CLONED' || status === 'SCANNING';
  const scanComplete = status === 'COMPLETED';

  const stopPolling = () => {
    if (pollTimerRef.current !== null) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const handleScan = async () => {
    if (!repoUrl.trim()) return;

    stopPolling();
    setErrorMessage(null);
    setReportError(null);
    setFindings([]);
    setExpandedFinding(null);
    setScanId(null);
    setStatus('QUEUED');

    try {
      const scan = await submitScan(repoUrl.trim());
      setScanId(scan.scan_id);
      setStatus(scan.status);

      if (scan.status !== 'COMPLETED' && scan.status !== 'FAILED') {
        pollTimerRef.current = setInterval(() => pollStatus(scan.scan_id), POLL_INTERVAL_MS);
      } else if (scan.status === 'COMPLETED') {
        loadReport(scan.scan_id);
      }
    } catch (err) {
      setStatus('FAILED');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit scan.');
    }
  };

  const pollStatus = async (id: string) => {
    try {
      const scan = await getScanStatus(id);
      setStatus(scan.status);

      if (scan.status === 'COMPLETED' || scan.status === 'FAILED') {
        stopPolling();
        if (scan.status === 'FAILED') {
          setErrorMessage(scan.error ?? 'Repository scan failed.');
        } else {
          loadReport(id);
        }
      }
    } catch (err) {
      stopPolling();
      setStatus('FAILED');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to fetch scan status.');
    }
  };

  const loadReport = async (id: string) => {
    try {
      const report = await getScanReport(id);
      setFindings(report.findings);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to load scan report.');
    }
  };

  const handleSeeFix = async (index: number) => {
    if (!scanId) return;

    setExpandedFinding(index);
    setFixes((prev) => ({ ...prev, [index]: { status: 'loading' } }));

    try {
      const result = await generateFindingFix(scanId, index);
      setFixes((prev) => ({ ...prev, [index]: { status: 'ready', content: result.content } }));
    } catch (err) {
      setFixes((prev) => ({
        ...prev,
        [index]: { status: 'error', content: err instanceof Error ? err.message : 'Failed to generate fix.' },
      }));
    }
  };

  const severityCounts = SEVERITY_ORDER.reduce((acc, bucket) => {
    acc[bucket] = 0;
    return acc;
  }, {} as Record<SeverityBucket, number>);
  findings.forEach((finding) => {
    severityCounts[toSeverityBucket(finding.severity)] += 1;
  });

  const sortedFindings = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(toSeverityBucket(a.severity)) - SEVERITY_ORDER.indexOf(toSeverityBucket(b.severity))
  );

  const statusLabel: Record<string, string> = {
    QUEUED: 'Queued for cloning...',
    CLONING: 'Cloning repository...',
    CLONED: 'Repository cloned. Preparing scan...',
    SCANNING: 'Running Semgrep security scan...',
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Repository Scanner</h1>
        <p className="text-gray-400">Analyze your GitHub repositories for security vulnerabilities</p>
      </div>

      {/* Scan Input */}
      <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
        <h2 className="text-2xl font-bold text-white mb-6">Scan New Repository</h2>

        <div className="space-y-6">
          <div>
            <label className="block text-white font-medium mb-3">Repository URL</label>
            <div className="relative">
              <Github className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="https://github.com/username/repository"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full bg-darkpurple-900/50 text-lilac-300 placeholder-gray-400 pl-12 pr-4 py-4 rounded-xl border border-lilac-400/30 focus:border-lilac-400 focus:ring-2 focus:ring-lilac-400/20 outline-none transition-all"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleScan}
              disabled={!repoUrl.trim() || scanning}
              className={`flex items-center justify-center space-x-2 px-8 py-4 rounded-xl font-semibold transition-all ${
                !repoUrl.trim() || scanning
                  ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                  : 'bg-lilac-400 text-darkpurple-900 hover:bg-lilac-300 hover:shadow-lg hover:shadow-lilac-400/25'
              }`}
            >
              <Search className="w-5 h-5" />
              <span>{scanning ? 'Scanning...' : 'Start Security Scan'}</span>
            </button>

            <button className="flex items-center justify-center space-x-2 px-8 py-4 rounded-xl font-semibold border-2 border-lilac-400/50 text-white hover:border-lilac-400 hover:bg-lilac-400/10 transition-colors">
              <Github className="w-5 h-5" />
              <span>Connect with GitHub</span>
            </button>
          </div>
        </div>

        {scanning && (
          <div className="mt-8 p-6 bg-darkpurple-900/20 rounded-xl border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-lilac-400"></div>
              <span className="text-white font-medium">{statusLabel[status ?? ''] ?? 'Working...'}</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 h-2 rounded-full animate-pulse w-2/3"></div>
            </div>
            {scanId && <p className="mt-3 text-xs text-gray-500">Scan ID: {scanId}</p>}
          </div>
        )}

        {status === 'FAILED' && (
          <div className="mt-8 p-6 bg-red-900/20 rounded-xl border border-red-500/30">
            <div className="flex items-center space-x-3 mb-2">
              <XCircle className="w-6 h-6 text-red-400" />
              <span className="text-white font-medium">Repository scan failed</span>
            </div>
            <p className="text-red-300 text-sm break-words">{errorMessage}</p>
          </div>
        )}

        {scanComplete && (
          <div className="mt-8 p-6 bg-green-900/20 rounded-xl border border-green-500/30">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <span className="text-white font-medium">Scan complete</span>
            </div>
            {scanId && <p className="mt-2 text-xs text-gray-500">Scan ID: {scanId}</p>}
          </div>
        )}
      </div>

      {/* Scan Results */}
      {scanComplete && (
        <div className="space-y-6">
          {/* Results Summary */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Scan Results</h2>
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">{findings.length} finding{findings.length === 1 ? '' : 's'}</span>
              </div>
            </div>

            {reportError && (
              <p className="text-red-300 text-sm mb-4">{reportError}</p>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              {SEVERITY_ORDER.map((bucket) => (
                <div key={bucket} className="text-center">
                  <div className={`text-3xl font-bold ${SEVERITY_STYLES[bucket].text}`}>{severityCounts[bucket]}</div>
                  <div className="text-gray-400">{SEVERITY_STYLES[bucket].label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Finding List */}
          {sortedFindings.length === 0 ? (
            <div className="flex items-center space-x-3 p-6 bg-green-900/20 rounded-xl border border-green-500/30">
              <ShieldOff className="w-6 h-6 text-green-400" />
              <span className="text-white font-medium">No vulnerabilities found.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedFindings.map((finding, index) => {
                const bucket = toSeverityBucket(finding.severity);
                return (
                  <div key={`${finding.rule_id}-${index}`} className="bg-gradient-to-br from-darkpurple-900/20 to-deepblack/50 rounded-xl border border-lilac-400/20 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-4">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${SEVERITY_STYLES[bucket].badge} text-white whitespace-nowrap`}>
                            {SEVERITY_STYLES[bucket].label}
                          </span>
                          <div>
                            <h3 className="text-xl font-bold text-white mb-2">{finding.message ?? finding.rule_id}</h3>
                            <p className="text-sm text-gray-500 mb-2 break-all">{finding.rule_id}</p>
                            <p className="text-sm text-lilac-400">
                              {finding.file}
                              {finding.start_line ? `:${finding.start_line}` : ''}
                              {finding.end_line && finding.end_line !== finding.start_line ? `-${finding.end_line}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3 shrink-0">
                          <button
                            onClick={() => handleSeeFix(index)}
                            disabled={fixes[index]?.status === 'loading'}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              fixes[index]?.status === 'loading'
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white hover:shadow-lg hover:shadow-lilac-400/25'
                            }`}
                          >
                            {fixes[index]?.status === 'loading' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span>See Fix</span>
                          </button>

                          <button
                            onClick={() => setExpandedFinding(expandedFinding === index ? null : index)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            {expandedFinding === index ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedFinding === index && (
                      <div className="border-t border-lilac-400/20 p-6 bg-deepblack/30 space-y-6">
                        <div>
                          <h4 className="text-lg font-semibold text-white mb-3">Details</h4>
                          <dl className="text-sm text-gray-300 space-y-2">
                            <div className="flex gap-2">
                              <dt className="text-gray-500 min-w-[90px]">Rule</dt>
                              <dd className="break-all">{finding.rule_id}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-gray-500 min-w-[90px]">Severity</dt>
                              <dd>{finding.severity ?? 'Unknown'}</dd>
                            </div>
                            <div className="flex gap-2">
                              <dt className="text-gray-500 min-w-[90px]">Location</dt>
                              <dd className="break-all">
                                {finding.file}
                                {finding.start_line ? `:${finding.start_line}` : ''}
                                {finding.end_line && finding.end_line !== finding.start_line ? `-${finding.end_line}` : ''}
                              </dd>
                            </div>
                          </dl>
                        </div>

                        {fixes[index] && (
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-3">AI-Generated Fix</h4>
                            {fixes[index].status === 'loading' ? (
                              <div className="flex items-center space-x-3 bg-darkpurple-900/30 rounded-lg p-4 border border-lilac-400/20">
                                <Loader2 className="w-5 h-5 text-lilac-400 animate-spin" />
                                <span className="text-gray-300 text-sm">Asking AI to review the code and suggest a fix...</span>
                              </div>
                            ) : fixes[index].status === 'error' ? (
                              <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/20">
                                <p className="text-red-300 text-sm">{fixes[index].content}</p>
                              </div>
                            ) : (
                              <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/20">
                                <pre className="text-green-300 text-sm whitespace-pre-wrap font-sans">{fixes[index].content}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RepoScan;
