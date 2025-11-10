import React, { useState } from 'react';
import { User, Mail, Github, Bell, Shield, Moon, Key, Download, Upload } from 'lucide-react';

const Settings: React.FC = () => {
  const [profileData, setProfileData] = useState({
    name: 'John Doe',
    email: 'john.doe@example.com',
    company: 'Tech Corp',
    role: 'Security Engineer'
  });

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    criticalVulns: true,
    weeklyReports: false,
    newFeatures: true
  });

  const [githubConnected, setGithubConnected] = useState(true);

  const handleProfileChange = (field: string, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
  };

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }));
  };

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean, onChange: (value: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-lilac-400' : 'bg-gray-600'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
        <p className="text-gray-400">Manage your account preferences and security settings</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Profile Settings */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Information */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-6 h-6 text-lilac-400" />
              <h2 className="text-2xl font-bold text-white">Profile Information</h2>
            </div>

            {/* Avatar Upload */}
            <div className="flex items-center space-x-6 mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-lilac-400 to-darkpurple-600 rounded-full flex items-center justify-center">
                <User className="w-10 h-10 text-white" />
              </div>
              <div className="space-y-2">
                <button className="flex items-center space-x-2 bg-lilac-400 text-darkpurple-900 px-4 py-2 rounded-lg font-medium hover:bg-lilac-300 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Upload Photo</span>
                </button>
                <p className="text-sm text-gray-400">JPG, PNG, or GIF (max 5MB)</p>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-white font-medium mb-2">Full Name</label>
                <input
                  type="text"
                  value={profileData.name}
                  onChange={(e) => handleProfileChange('name', e.target.value)}
                  className="w-full bg-darkpurple-900/50 text-white px-4 py-3 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Email Address</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => handleProfileChange('email', e.target.value)}
                  className="w-full bg-darkpurple-900/50 text-white px-4 py-3 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Company</label>
                <input
                  type="text"
                  value={profileData.company}
                  onChange={(e) => handleProfileChange('company', e.target.value)}
                  className="w-full bg-darkpurple-900/50 text-white px-4 py-3 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-white font-medium mb-2">Role</label>
                <input
                  type="text"
                  value={profileData.role}
                  onChange={(e) => handleProfileChange('role', e.target.value)}
                  className="w-full bg-darkpurple-900/50 text-white px-4 py-3 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none transition-colors"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-6 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all">
                Save Changes
              </button>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-6">
              <Bell className="w-6 h-6 text-lilac-400" />
              <h2 className="text-2xl font-bold text-white">Notification Preferences</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Email Alerts</h3>
                  <p className="text-gray-400 text-sm">Receive email notifications for security events</p>
                </div>
                <ToggleSwitch
                  enabled={notifications.emailAlerts}
                  onChange={(value) => handleNotificationChange('emailAlerts', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Critical Vulnerabilities</h3>
                  <p className="text-gray-400 text-sm">Instant notifications for critical security issues</p>
                </div>
                <ToggleSwitch
                  enabled={notifications.criticalVulns}
                  onChange={(value) => handleNotificationChange('criticalVulns', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Weekly Reports</h3>
                  <p className="text-gray-400 text-sm">Weekly summary of security scan results</p>
                </div>
                <ToggleSwitch
                  enabled={notifications.weeklyReports}
                  onChange={(value) => handleNotificationChange('weeklyReports', value)}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">New Features</h3>
                  <p className="text-gray-400 text-sm">Updates about new SecureScan AI features</p>
                </div>
                <ToggleSwitch
                  enabled={notifications.newFeatures}
                  onChange={(value) => handleNotificationChange('newFeatures', value)}
                />
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-8 border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="w-6 h-6 text-lilac-400" />
              <h2 className="text-2xl font-bold text-white">Security Settings</h2>
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Two-Factor Authentication</h3>
                  <p className="text-gray-400 text-sm">Add an extra layer of security to your account</p>
                </div>
                <button className="bg-lilac-400 text-darkpurple-900 px-4 py-2 rounded-lg font-medium hover:bg-lilac-300 transition-colors">
                  Enable 2FA
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Change Password</h3>
                  <p className="text-gray-400 text-sm">Update your account password</p>
                </div>
                <button className="flex items-center space-x-2 border border-lilac-400/50 text-white px-4 py-2 rounded-lg font-medium hover:border-lilac-400 hover:bg-lilac-400/10 transition-colors">
                  <Key className="w-4 h-4" />
                  <span>Change</span>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">API Keys</h3>
                  <p className="text-gray-400 text-sm">Manage API keys for integrations</p>
                </div>
                <button className="border border-lilac-400/50 text-white px-4 py-2 rounded-lg font-medium hover:border-lilac-400 hover:bg-lilac-400/10 transition-colors">
                  Manage Keys
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Settings */}
        <div className="space-y-8">
          {/* GitHub Integration */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-6 border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-6">
              <Github className="w-6 h-6 text-lilac-400" />
              <h3 className="text-xl font-bold text-white">GitHub Integration</h3>
            </div>

            {githubConnected ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-green-400 font-medium">Connected</span>
                </div>
                <p className="text-gray-400 text-sm">Connected to @johndoe</p>
                <button 
                  onClick={() => setGithubConnected(false)}
                  className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-400 font-medium">Not Connected</span>
                </div>
                <p className="text-gray-400 text-sm">Connect your GitHub account to scan repositories</p>
                <button 
                  onClick={() => setGithubConnected(true)}
                  className="w-full bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg hover:shadow-lilac-400/25 transition-all"
                >
                  Connect GitHub
                </button>
              </div>
            )}
          </div>

          {/* Theme Settings */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-6 border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-6">
              <Moon className="w-6 h-6 text-lilac-400" />
              <h3 className="text-xl font-bold text-white">Appearance</h3>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium">Dark Mode</span>
                <ToggleSwitch enabled={true} onChange={() => {}} />
              </div>
              <p className="text-gray-400 text-sm">Dark mode is always enabled for optimal security visualization</p>
            </div>
          </div>

          {/* Data Export */}
          <div className="bg-gradient-to-br from-darkpurple-900/30 to-deepblack/50 rounded-2xl p-6 border border-lilac-400/20">
            <div className="flex items-center space-x-3 mb-6">
              <Download className="w-6 h-6 text-lilac-400" />
              <h3 className="text-xl font-bold text-white">Data Export</h3>
            </div>

            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Download all your security scan data and reports</p>
              <button className="w-full border border-lilac-400/50 text-white px-4 py-2 rounded-lg font-medium hover:border-lilac-400 hover:bg-lilac-400/10 transition-colors">
                Export Data
              </button>
            </div>
          </div>

          {/* Account Actions */}
          <div className="bg-gradient-to-br from-red-900/30 to-deepblack/50 rounded-2xl p-6 border border-red-500/20">
            <h3 className="text-xl font-bold text-white mb-4">Danger Zone</h3>
            <div className="space-y-4">
              <div>
                <p className="text-white font-medium mb-2">Delete Account</p>
                <p className="text-gray-400 text-sm mb-4">Permanently delete your account and all associated data</p>
                <button className="w-full bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;