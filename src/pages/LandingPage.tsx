import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Zap, GitBranch, CheckCircle, Github, ArrowRight } from 'lucide-react';

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-deepblack via-darkpurple-900 to-deepblack">
      {/* Navigation */}
      <nav className="px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-lilac-400 to-darkpurple-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">SecureScan AI</span>
          </div>
          <Link
            to="/dashboard"
            className="bg-lilac-400 text-darkpurple-900 px-6 py-3 rounded-lg font-semibold hover:bg-lilac-300 hover:shadow-lg hover:shadow-lilac-400/25 transition-all duration-300"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl lg:text-7xl font-bold text-white mb-8 leading-tight">
            Secure Your Code
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-lilac-400 to-lilac-300">
              Before You Deploy
            </span>
          </h1>
          
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-12 leading-relaxed">
            AI-powered GitHub code analysis for vulnerabilities. Detect security flaws, 
            get intelligent fix suggestions, and deploy with confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link
              to="/scan"
              className="group bg-lilac-400 text-darkpurple-900 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-lilac-300 hover:shadow-2xl hover:shadow-lilac-400/30 transition-all duration-300 flex items-center space-x-2"
            >
              <span>Scan Your Repo</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            
            <button className="flex items-center space-x-3 text-white border-2 border-lilac-400 px-8 py-4 rounded-xl hover:border-lilac-300 hover:bg-lilac-400/10 transition-colors duration-300">
              <Github className="w-5 h-5" />
              <span>Connect with GitHub</span>
            </button>
          </div>

          {/* Hero Illustration Placeholder */}
          <div className="relative max-w-4xl mx-auto">
            <div className="bg-gradient-to-r from-darkpurple-900/30 to-lilac-900/30 rounded-2xl p-8 backdrop-blur-sm border border-lilac-400/20">
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div key={item} className="bg-deepblack/40 rounded-lg p-4 border border-lilac-400/20">
                    <div className="w-full h-4 bg-gradient-to-r from-lilac-400/50 to-darkpurple-600/50 rounded mb-2"></div>
                    <div className="w-2/3 h-2 bg-gray-600 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 bg-deepblack/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-white mb-4">
              AI-Powered Security Analysis
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Advanced machine learning algorithms scan your code for vulnerabilities 
              and provide actionable security insights.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 p-8 rounded-2xl border border-lilac-400/20 hover:border-lilac-400/40 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Detect Vulnerabilities</h3>
              <p className="text-gray-400 leading-relaxed">
                Identify security flaws, code injection risks, and authentication 
                vulnerabilities across your entire codebase with precision.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 p-8 rounded-2xl border border-lilac-400/20 hover:border-lilac-400/40 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-lilac-400 to-darkpurple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Zap className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Get AI Fix Suggestions</h3>
              <p className="text-gray-400 leading-relaxed">
                Get intelligent, context-aware code fixes powered by advanced AI 
                that understand your specific programming patterns and architecture.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 p-8 rounded-2xl border border-lilac-400/20 hover:border-lilac-400/40 transition-all duration-300 group">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Approve & Commit Changes</h3>
              <p className="text-gray-400 leading-relaxed">
                Review AI-generated fixes, approve changes with confidence, and 
                commit secure code directly to your repository with one click.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="px-6 py-20">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lilac-400 to-lilac-300 mb-2">
                10K+
              </div>
              <p className="text-gray-400">Repositories Scanned</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lilac-400 to-lilac-300 mb-2">
                50K+
              </div>
              <p className="text-gray-400">Vulnerabilities Fixed</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lilac-400 to-lilac-300 mb-2">
                99.9%
              </div>
              <p className="text-gray-400">Accuracy Rate</p>
            </div>
            <div>
              <div className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-lilac-400 to-lilac-300 mb-2">
                24/7
              </div>
              <p className="text-gray-400">Continuous Monitoring</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 bg-gradient-to-r from-darkpurple-900/20 to-lilac-900/20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-6">
            Ready to Secure Your Code?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Join thousands of developers who trust SecureScan AI to protect their applications.
          </p>
          <Link
            to="/dashboard"
            className="bg-lilac-400 text-darkpurple-900 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-lilac-300 hover:shadow-2xl hover:shadow-lilac-400/30 transition-all duration-300 inline-flex items-center space-x-2"
          >
            <span>Start Free Trial</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-lilac-400/20">
        <div className="max-w-7xl mx-auto text-center text-gray-400">
          <p>&copy; 2025 SecureScan AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;