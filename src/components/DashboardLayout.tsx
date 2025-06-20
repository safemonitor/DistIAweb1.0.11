import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { DeliveryNotifications } from './DeliveryNotifications';
import { Sidebar } from './Sidebar';
import { signOut } from '../lib/auth';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 hidden md:block">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between px-6 py-4">
            <h1 className="text-xl font-semibold text-gray-900">
              Morocco Distribution Company
            </h1>
            <div className="flex items-center space-x-4">
              <DeliveryNotifications />
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-900 focus:outline-none"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  );
}