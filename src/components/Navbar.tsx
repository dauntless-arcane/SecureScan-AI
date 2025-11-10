import React from 'react';
import { Search, Bell, Menu, User } from 'lucide-react';

interface NavbarProps {
  onMenuClick: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuClick }) => {
  return (
    <nav className="bg-deepblack/50 backdrop-blur-sm border-b border-lilac-400/20 px-4 lg:px-8 py-4">
      <div className="flex items-center justify-between">
        {/* Left section */}
        <div className="flex items-center space-x-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
          >
            <Menu className="w-6 h-6" />
          </button>
          
          {/* Search bar */}
          <div className="hidden md:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search repositories..."
                className="bg-darkpurple-900 text-white pl-10 pr-4 py-2 rounded-lg border border-lilac-400/30 focus:border-lilac-400 focus:ring-1 focus:ring-lilac-400 outline-none transition-colors w-64"
              />
            </div>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center space-x-4">
          {/* Mobile search button */}
          <button className="md:hidden text-gray-400 hover:text-white transition-colors">
            <Search className="w-6 h-6" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button className="text-gray-400 hover:text-white transition-colors relative">
              <Bell className="w-6 h-6" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                3
              </span>
            </button>
          </div>

          {/* Profile */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-lilac-400 to-darkpurple-600 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div className="hidden lg:block">
              <p className="text-white text-sm font-medium">John Doe</p>
              <p className="text-gray-400 text-xs">Security Engineer</p>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;