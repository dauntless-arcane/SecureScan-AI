import React, { useEffect, useRef, useState } from 'react';
import { Github, Search, CheckCircle, ChevronDown, ChevronUp, XCircle, ShieldOff, Sparkles, Loader2, GitPullRequest, ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import {
  generateFindingFix,
  getScanReport,
  getScanStatus,
  submitScan,
  verifyFindingFix,
  type Finding,
  type FixResult,
  type ScanStatus,
  type VerificationResult,
} from '../lib/api';

type FixState =
  | { status: 'loading' }
  | { status: 'ready'; fix: FixResult }
  | { status: 'error'; message: string };

type VerifyState =
  | { status: 'loading' }
  | { status: 'done'; result: VerificationResult }
  | { status: 'error'; message: string };

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
  const [verifications, setVerifications] = useState<Record<number, VerifyState>>({});
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [view, setView] = useState<'results' | 'pr'>('results');

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
    setFixes({});
    setVerifications({});
    setSelected(new Set());
    setView('results');
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

  const fetchFix = async (index: number) => {
    if (!scanId) return;

    setFixes((prev) => ({ ...prev, [index]: { status: 'loading' } }));

    try {
      const fix = await generateFindingFix(scanId, index);
      setFixes((prev) => ({ ...prev, [index]: { status: 'ready', fix } }));
    } catch (err) {
      setFixes((prev) => ({
        ...prev,
        [index]: { status: 'error', message: err instanceof Error ? err.message : 'Failed to generate fix.' },
      }));
    }
  };

  const handleSeeFix = (index: number) => {
    setExpandedFinding(index);
    fetchFix(index);
  };

  const handleVerifyFix = async (index: number) => {
    if (!scanId) return;

    setVerifications((prev) => ({ ...prev, [index]: { status: 'loading' } }));

    try {
      const result = await verifyFindingFix(scanId, index);
      setVerifications((prev) => ({ ...prev, [index]: { status: 'done', result } }));
    } catch (err) {
      setVerifications((prev) => ({
        ...prev,
        [index]: { status: 'error', message: err instanceof Error ? err.message : 'Failed to verify fix.' },
      }));
    }
  };

  const toggleSelected = (index: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === findings.length ? new Set() : new Set(findings.map((_, i) => i))));
  };

  const handleAiFix = () => {
    if (selected.size === 0) return;
    setView('pr');
    selected.forEach((index) => {
      if (!fixes[index] || fixes[index].status === 'error') {
        fetchFix(index);
      }
    });
  };

  const severityCounts = SEVERITY_ORDER.reduce((acc, bucket) => {
    acc[bucket] = 0;
    return acc;
  }, {} as Record<SeverityBucket, number>);
  findings.forEach((finding) => {
    severityCounts[toSeverityBucket(finding.severity)] += 1;
  });

  const sortedFindings = findings
    .map((finding, originalIndex) => ({ finding, originalIndex }))
    .sort(
      (a, b) =>
        SEVERITY_ORDER.indexOf(toSeverityBucket(a.finding.severity)) -
        SEVERITY_ORDER.indexOf(toSeverityBucket(b.finding.severity))
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
      {scanComplete && view === 'results' && (
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

            {findings.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-4 mt-8 pt-6 border-t border-lilac-400/20">
                <label className="flex items-center space-x-2 text-gray-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.size === findings.length}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded accent-lilac-400"
                  />
                  <span>Select all ({selected.size}/{findings.length})</span>
                </label>

                <button
                  onClick={handleAiFix}
                  disabled={selected.size === 0}
                  className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-xl font-semibold transition-all ${
                    selected.size === 0
                      ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white hover:shadow-lg hover:shadow-lilac-400/25'
                  }`}
                >
                  <Sparkles className="w-5 h-5" />
                  <span>AI Fix{selected.size > 0 ? ` (${selected.size})` : ''}</span>
                </button>
              </div>
            )}
          </div>

          {/* Finding List */}
          {sortedFindings.length === 0 ? (
            <div className="flex items-center space-x-3 p-6 bg-green-900/20 rounded-xl border border-green-500/30">
              <ShieldOff className="w-6 h-6 text-green-400" />
              <span className="text-white font-medium">No vulnerabilities found.</span>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedFindings.map(({ finding, originalIndex }) => {
                const bucket = toSeverityBucket(finding.severity);
                return (
                  <div key={`${finding.rule_id}-${originalIndex}`} className="bg-gradient-to-br from-darkpurple-900/20 to-deepblack/50 rounded-xl border border-lilac-400/20 overflow-hidden">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-4">
                          <input
                            type="checkbox"
                            checked={selected.has(originalIndex)}
                            onChange={() => toggleSelected(originalIndex)}
                            className="mt-1 w-4 h-4 rounded accent-lilac-400 shrink-0"
                          />
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
                            onClick={() => handleSeeFix(originalIndex)}
                            disabled={fixes[originalIndex]?.status === 'loading'}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              fixes[originalIndex]?.status === 'loading'
                                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                                : 'bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white hover:shadow-lg hover:shadow-lilac-400/25'
                            }`}
                          >
                            {fixes[originalIndex]?.status === 'loading' ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Sparkles className="w-4 h-4" />
                            )}
                            <span>See Fix</span>
                          </button>

                          <button
                            onClick={() => setExpandedFinding(expandedFinding === originalIndex ? null : originalIndex)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            {expandedFinding === originalIndex ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {expandedFinding === originalIndex && (
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

                        {fixes[originalIndex] && (
                          <div>
                            <h4 className="text-lg font-semibold text-white mb-3">AI-Generated Fix</h4>
                            {fixes[originalIndex].status === 'loading' ? (
                              <div className="flex items-center space-x-3 bg-darkpurple-900/30 rounded-lg p-4 border border-lilac-400/20">
                                <Loader2 className="w-5 h-5 text-lilac-400 animate-spin" />
                                <span className="text-gray-300 text-sm">Asking AI to review the code and suggest a fix...</span>
                              </div>
                            ) : fixes[originalIndex].status === 'error' ? (
                              <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/20">
                                <p className="text-red-300 text-sm">{fixes[originalIndex].message}</p>
                              </div>
                            ) : (
                              <>
                                <AiFixDetails fix={fixes[originalIndex].fix} />
                                <VerifyFixSection
                                  verification={verifications[originalIndex]}
                                  onVerify={() => handleVerifyFix(originalIndex)}
                                />
                              </>
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

      {/* AI Fix -> Create PR */}
      {scanComplete && view === 'pr' && (
        <PrScreen
          findings={findings}
          selected={selected}
          fixes={fixes}
          onBack={() => setView('results')}
        />
      )}
    </div>
  );
};

const PrScreen: React.FC<{
  findings: Finding[];
  selected: Set<number>;
  fixes: Record<number, FixState>;
  onBack: () => void;
}> = ({ findings, selected, fixes, onBack }) => {
  const selectedIndexes = Array.from(selected).sort((a, b) => a - b);
  const total = selectedIndexes.length;
  const readyCount = selectedIndexes.filter((i) => fixes[i]?.status === 'ready').length;
  const errorCount = selectedIndexes.filter((i) => fixes[i]?.status === 'error').length;
  const allDone = readyCount + errorCount === total;

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
        <button onClick={onBack} className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to results</span>
        </button>

        <div className="flex items-center space-x-3 mb-2">
          {allDone ? (
            <GitPullRequest className="w-7 h-7 text-lilac-400" />
          ) : (
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-lilac-400"></div>
          )}
          <h2 className="text-2xl font-bold text-white">
            {allDone ? 'Fixes ready' : 'Generating fixes...'}
          </h2>
        </div>
        <p className="text-gray-400">
          {allDone
            ? `${readyCount}/${total} fix${total === 1 ? '' : 'es'} generated${errorCount > 0 ? `, ${errorCount} failed` : ''}.`
            : `Reviewing ${total} selected vulnerability${total === 1 ? '' : 'ies'} with AI...`}
        </p>
      </div>

      <div className="space-y-4">
        {selectedIndexes.map((index) => {
          const finding = findings[index];
          const fix = fixes[index];
          if (!finding) return null;

          return (
            <div key={`${finding.rule_id}-${index}`} className="bg-gradient-to-br from-darkpurple-900/20 to-deepblack/50 rounded-xl border border-lilac-400/20 p-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold text-white">{finding.message ?? finding.rule_id}</h3>
                  <p className="text-sm text-lilac-400">
                    {finding.file}
                    {finding.start_line ? `:${finding.start_line}` : ''}
                  </p>
                </div>
                {fix?.status === 'ready' && <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />}
                {fix?.status === 'error' && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                {(!fix || fix.status === 'loading') && <Loader2 className="w-5 h-5 text-lilac-400 animate-spin shrink-0" />}
              </div>

              {fix?.status === 'ready' && <AiFixDetails fix={fix.fix} />}
              {fix?.status === 'error' && (
                <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/20">
                  <p className="text-red-300 text-sm">{fix.message}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Create pull request</h3>
          <p className="text-gray-400 text-sm">Bundle the selected fixes into a PR against the source repository.</p>
        </div>
        <button
          disabled={!allDone || readyCount === 0}
          className={`flex items-center justify-center space-x-2 px-8 py-4 rounded-xl font-semibold transition-all whitespace-nowrap ${
            !allDone || readyCount === 0
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
              : 'bg-lilac-400 text-darkpurple-900 hover:bg-lilac-300 hover:shadow-lg hover:shadow-lilac-400/25'
          }`}
        >
          <GitPullRequest className="w-5 h-5" />
          <span>Create PR</span>
        </button>
      </div>
    </div>
  );
};

const VerifyFixSection: React.FC<{ verification: VerifyState | undefined; onVerify: () => void }> = ({
  verification,
  onVerify,
}) => (
  <div className="mt-4 space-y-3">
    <button
      onClick={onVerify}
      disabled={verification?.status === 'loading'}
      className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
        verification?.status === 'loading'
          ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
          : 'border-2 border-lilac-400/50 text-white hover:border-lilac-400 hover:bg-lilac-400/10'
      }`}
    >
      {verification?.status === 'loading' ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <ShieldCheck className="w-4 h-4" />
      )}
      <span>Verify Fix</span>
    </button>

    {verification?.status === 'loading' && (
      <div className="flex items-center space-x-3 bg-darkpurple-900/30 rounded-lg p-4 border border-lilac-400/20">
        <Loader2 className="w-5 h-5 text-lilac-400 animate-spin" />
        <span className="text-gray-300 text-sm">
          Applying the fix in an isolated workspace and re-running Semgrep...
        </span>
      </div>
    )}

    {verification?.status === 'error' && (
      <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/20">
        <p className="text-red-300 text-sm">{verification.message}</p>
      </div>
    )}

    {verification?.status === 'done' && verification.result.status === 'VERIFIED' && (
      <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/20">
        <div className="flex items-center space-x-2 mb-2">
          <ShieldCheck className="w-5 h-5 text-green-400" />
          <span className="text-green-400 font-semibold">VERIFIED</span>
        </div>
        <p className="text-green-300 text-sm">Semgrep no longer detects the original finding.</p>
      </div>
    )}

    {verification?.status === 'done' && verification.result.status === 'FAILED' && (
      <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/20 space-y-3">
        <div className="flex items-center space-x-2 mb-1">
          <ShieldAlert className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-semibold">VERIFICATION FAILED</span>
        </div>
        <p className="text-red-300 text-sm">The original finding is still detected.</p>
        {verification.result.remaining_findings.length > 0 && (
          <div>
            <p className="text-xs text-gray-400 mb-1">Remaining finding(s):</p>
            <ul className="text-xs text-red-300 space-y-1">
              {verification.result.remaining_findings.map((f, i) => (
                <li key={i} className="break-all">
                  {f.rule_id} — {f.file}
                  {f.start_line ? `:${f.start_line}` : ''}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    )}
  </div>
);

const AiFixDetails: React.FC<{ fix: FixResult }> = ({ fix }) => (
  <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/20 space-y-4">
    <div>
      <p className="text-sm text-gray-400 mb-1">Affected file</p>
      <p className="text-sm text-lilac-400 break-all">{fix.file_path}</p>
    </div>
    <div>
      <p className="text-sm text-gray-400 mb-1">Explanation</p>
      <p className="text-green-300 text-sm whitespace-pre-wrap">{fix.explanation}</p>
    </div>
    {fix.changes.length > 0 && (
      <div>
        <p className="text-sm text-gray-400 mb-1">Changes</p>
        <ul className="list-disc list-inside text-green-300 text-sm space-y-1">
          {fix.changes.map((change, i) => (
            <li key={i}>{change}</li>
          ))}
        </ul>
      </div>
    )}
    <div>
      <p className="text-sm text-gray-400 mb-1">Corrected code</p>
      <pre className="text-green-300 text-sm whitespace-pre-wrap font-sans bg-deepblack/40 rounded-lg p-3 overflow-x-auto">
        {fix.fixed_code}
      </pre>
    </div>
  </div>
);

export default RepoScan;
