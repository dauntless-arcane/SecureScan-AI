import React, { useState } from 'react';
import { Github, Search, AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react';
import DiffViewer from '../components/DiffViewer';

const RepoScan: React.FC = () => {
  const [repoUrl, setRepoUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState(false);
  const [expandedVuln, setExpandedVuln] = useState<number | null>(null);
  const [showDiffViewer, setShowDiffViewer] = useState(false);
  const [selectedVuln, setSelectedVuln] = useState<any>(null);

  const vulnerabilities = [
    {
      id: 1,
      severity: 'critical',
      title: 'SQL Injection Vulnerability',
      description: 'User input is directly concatenated into SQL query without sanitization',
      file: 'src/auth/login.js',
      line: 45,
      code: `const query = "SELECT * FROM users WHERE email = '" + userEmail + "' AND password = '" + password + "'";`,
      fix: `const query = "SELECT * FROM users WHERE email = ? AND password = ?";
const result = await db.query(query, [userEmail, hashedPassword]);`
    },
    {
      id: 2,
      severity: 'high',
      title: 'Cross-Site Scripting (XSS)',
      description: 'Unescaped user input rendered in HTML template',
      file: 'src/components/UserProfile.jsx',
      line: 78,
      code: `return <div dangerouslySetInnerHTML={{__html: userBio}} />;`,
      fix: `import DOMPurify from 'dompurify';
return <div dangerouslySetInnerHTML={{__html: DOMPurify.sanitize(userBio)}} />;`
    },
    {
      id: 3,
      severity: 'medium',
      title: 'Hardcoded API Key',
      description: 'Sensitive API key exposed in source code',
      file: 'src/config/api.js',
      line: 12,
      code: `const API_KEY = "sk_live_abcd1234567890";`,
      fix: `const API_KEY = process.env.REACT_APP_API_KEY;`
    },
    {
      id: 4,
      severity: 'low',
      title: 'Weak Password Policy',
      description: 'Password validation allows weak passwords',
      file: 'src/utils/validation.js',
      line: 23,
      code: `return password.length >= 6;`,
      fix: `return password.length >= 12 && /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password);`
    }
  ];

  const handleScan = () => {
    if (!repoUrl.trim()) return;
    
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      setScanResults(true);
    }, 3000);
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

  const handleViewDiff = (vuln: any) => {
    setSelectedVuln(vuln);
    setShowDiffViewer(true);
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
              <span className="text-white font-medium">Analyzing repository...</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-2">
              <div className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 h-2 rounded-full animate-pulse w-2/3"></div>
            </div>
          </div>
        )}
      </div>

      {/* Scan Results */}
      {scanResults && (
        <div className="space-y-6">
          {/* Results Summary */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Scan Results</h2>
              <div className="flex items-center space-x-2 text-green-400">
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">Scan Complete</span>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-red-400">1</div>
                <div className="text-gray-400">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-orange-400">1</div>
                <div className="text-gray-400">High</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">1</div>
                <div className="text-gray-400">Medium</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">1</div>
                <div className="text-gray-400">Low</div>
              </div>
            </div>
          </div>

          {/* Vulnerability List */}
          <div className="space-y-4">
            {vulnerabilities.map((vuln) => (
              <div key={vuln.id} className="bg-gradient-to-br from-darkpurple-900/20 to-deepblack/50 rounded-xl border border-lilac-400/20 overflow-hidden">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getSeverityColor(vuln.severity)} text-white`}>
                        {vuln.severity.toUpperCase()}
                      </span>
                      <div>
                        <h3 className="text-xl font-bold text-white mb-2">{vuln.title}</h3>
                        <p className="text-gray-400 mb-2">{vuln.description}</p>
                        <p className="text-sm text-lilac-400">{vuln.file}:{vuln.line}</p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => setExpandedVuln(expandedVuln === vuln.id ? null : vuln.id)}
                      className="text-gray-400 hover:text-white transition-colors"
                    >
                      {expandedVuln === vuln.id ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </button>
                  </div>
                </div>

                {expandedVuln === vuln.id && (
                  <div className="border-t border-lilac-400/20 p-6 bg-deepblack/30">
                    <div className="space-y-6">
                      {/* Vulnerable Code */}
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-3">Vulnerable Code</h4>
                        <div className="bg-red-900/20 rounded-lg p-4 border border-red-500/20">
                          <pre className="text-red-300 text-sm overflow-x-auto">
                            <code>{vuln.code}</code>
                          </pre>
                        </div>
                      </div>

                      {/* AI Fix Suggestion */}
                      <div>
                        <h4 className="text-lg font-semibold text-white mb-3">AI-Generated Fix</h4>
                        <div className="bg-green-900/20 rounded-lg p-4 border border-green-500/20">
                          <pre className="text-green-300 text-sm overflow-x-auto">
                            <code>{vuln.fix}</code>
                          </pre>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-4">
                        <button
                          onClick={() => handleViewDiff(vuln)}
                          className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all"
                        >
                          View Changes
                        </button>
                        <button className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
                          Approve Fix
                        </button>
                        <button className="bg-gray-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors">
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Diff Viewer Modal */}
      {showDiffViewer && selectedVuln && (
        <DiffViewer
          vulnerability={selectedVuln}
          onClose={() => setShowDiffViewer(false)}
        />
      )}
    </div>
  );
};

export default RepoScan;