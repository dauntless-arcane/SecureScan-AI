import React from 'react';
import { X, Check, XIcon, Download } from 'lucide-react';

interface DiffViewerProps {
  vulnerability: any;
  onClose: () => void;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ vulnerability, onClose }) => {
  const originalLines = vulnerability.code.split('\n');
  const fixedLines = vulnerability.fix.split('\n');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gradient-to-br from-darkpurple-900/50 to-deepblack/70 rounded-2xl border border-lilac-400/20 max-w-6xl w-full max-h-[90vh] overflow-hidden backdrop-blur-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-lilac-400/20">
          <div>
            <h2 className="text-2xl font-bold text-white">Code Diff Viewer</h2>
            <p className="text-gray-400">{vulnerability.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Diff Content */}
        <div className="p-6 overflow-auto max-h-[60vh]">
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Original Code */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Original Code</h3>
                <span className="text-sm text-red-400 bg-red-900/20 px-3 py-1 rounded-full">Vulnerable</span>
              </div>
              <div className="bg-red-900/10 rounded-lg border border-red-500/20 overflow-hidden">
                <div className="bg-red-900/20 px-4 py-2 border-b border-red-500/20">
                  <span className="text-sm text-red-300">{vulnerability.file}:{vulnerability.line}</span>
                </div>
                <div className="p-4">
                  <pre className="text-sm text-red-300 whitespace-pre-wrap">
                    {originalLines.map((line, index) => (
                      <div key={index} className="flex">
                        <span className="text-red-400 mr-4 select-none w-8 text-right">{index + 1}</span>
                        <span className={`flex-1 ${line.trim() ? 'bg-red-900/30' : ''}`}>
                          {line || '\u00A0'}
                        </span>
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
            </div>

            {/* Fixed Code */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">AI-Generated Fix</h3>
                <span className="text-sm text-green-400 bg-green-900/20 px-3 py-1 rounded-full">Secure</span>
              </div>
              <div className="bg-green-900/10 rounded-lg border border-green-500/20 overflow-hidden">
                <div className="bg-green-900/20 px-4 py-2 border-b border-green-500/20">
                  <span className="text-sm text-green-300">{vulnerability.file}:{vulnerability.line}</span>
                </div>
                <div className="p-4">
                  <pre className="text-sm text-green-300 whitespace-pre-wrap">
                    {fixedLines.map((line, index) => (
                      <div key={index} className="flex">
                        <span className="text-green-400 mr-4 select-none w-8 text-right">{index + 1}</span>
                        <span className={`flex-1 ${line.trim() ? 'bg-green-900/30' : ''}`}>
                          {line || '\u00A0'}
                        </span>
                      </div>
                    ))}
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* Changes Summary */}
          <div className="mt-6 p-4 bg-darkpurple-900/20 rounded-lg border border-lilac-400/20">
            <h4 className="text-white font-semibold mb-2">Change Summary</h4>
            <div className="flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-red-500 rounded"></span>
                <span className="text-gray-400">{originalLines.length} lines removed</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded"></span>
                <span className="text-gray-400">{fixedLines.length} lines added</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-lilac-400/20">
          <div className="flex items-center space-x-4">
            <button className="flex items-center space-x-2 text-gray-400 hover:text-white transition-colors">
              <Download className="w-4 h-4" />
              <span>Export Diff</span>
            </button>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={onClose}
              className="flex items-center space-x-2 bg-gray-700 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-600 transition-colors"
            >
              <XIcon className="w-4 h-4" />
              <span>Cancel</span>
            </button>
            <button className="flex items-center space-x-2 bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors">
              <XIcon className="w-4 h-4" />
              <span>Reject All</span>
            </button>
            <button className="flex items-center space-x-2 bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all">
              <Check className="w-4 h-4" />
              <span>Approve All</span>
            </button>
            <button className="flex items-center space-x-2 bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors">
              <Check className="w-4 h-4" />
              <span>Commit Changes</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiffViewer;