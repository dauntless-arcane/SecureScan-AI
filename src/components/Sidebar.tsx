import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  FileText, 
  Settings, 
  X, 
  Shield 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const location = useLocation();

  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: Search, label: 'Scan Repo', path: '/scan' },
    { icon: FileText, label: 'Reports', path: '/reports' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 left-0 z-50 w-64 h-full bg-deepblack border-r border-lilac-400/20
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-lilac-400/20">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-lilac-400 to-darkpurple-600 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">SecureScan AI</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Menu Items */}
        <nav className="mt-8 px-6">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => onClose()}
                    className={`
                      flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200
                      ${isActive(item.path)
                        ? 'bg-gradient-to-r from-lilac-400 to-darkpurple-600 text-white shadow-lg shadow-lilac-400/25'
                        : 'text-gray-400 hover:text-white hover:bg-lilac-400/10 hover:border hover:border-lilac-400/20'
                      }
                    `}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Section */}
        <div className="absolute bottom-6 left-6 right-6">
          <div className="bg-gradient-to-r from-darkpurple-900/50 to-lilac-900/50 rounded-lg p-4 border border-lilac-400/20">
            <p className="text-sm text-gray-300 mb-2">Security Score</p>
            <div className="flex items-center space-x-2">
              <div className="flex-1 bg-gray-800 rounded-full h-2">
                <div className="bg-gradient-to-r from-lilac-400 to-darkpurple-600 h-2 rounded-full w-3/4"></div>
              </div>
              <span className="text-sm font-semibold text-white">85%</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;