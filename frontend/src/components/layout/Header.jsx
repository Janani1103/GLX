import { useNavigate } from 'react-router-dom';
import { LogOut, User as UserIcon, Menu, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../features/auth/authApi';
import NotificationDropdown from '../ui/NotificationDropdown';

export default function Header({ onToggleSidebar }) {
    const navigate = useNavigate();
    const { user, logout } = useAuthStore();

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (err) {
            // Even if backend fails, log out locally
        }
        logout();
        toast.success('Logged out successfully');
        navigate('/login');
    };

    const roleLabel = {
        admin: 'Administrator',
        manager: 'Manager',
        accountant: 'Accountant',
        sales_manager: 'Sales Manager',
        sales_rep: 'Sales Rep',
        warehouse_staff: 'Warehouse Staff',
        production_staff: 'Production Staff',
        staff: 'Staff',
    }[user?.role] || 'User';

    return (
        <header className="no-print h-14 sm:h-16 bg-white border-b border-gray-200 flex items-center justify-between px-3 sm:px-6 flex-shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                {/* Hamburger toggle */}
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition min-w-[40px] min-h-[40px] flex items-center justify-center flex-shrink-0"
                    aria-label="Toggle sidebar"
                >
                    <Menu size={20} />
                </button>
                
                {/* Welcome pill — hidden on very small xs screens */}
                <div className="hidden xs:flex items-center gap-2 px-2.5 py-1.5 bg-gradient-to-r from-primary-50 to-blue-50/20 rounded-full border border-primary-100/50 shadow-sm hover:shadow transition duration-200">
                    <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 flex-shrink-0">
                        <Sparkles size={9} className="animate-pulse" />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 truncate max-w-[120px] sm:max-w-[200px] font-medium">
                        <span className="hidden sm:inline">Welcome, </span>
                        <span className="font-bold text-primary-700">{user?.fullName || user?.firstName || 'User'}</span>
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                <NotificationDropdown />

                {/* Avatar + role — hidden on mobile */}
                <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <button onClick={() => navigate('/profile')}>
                            <UserIcon className="w-4 h-4 text-primary-600" />
                        </button>
                    </div>
                    <div className="text-sm hidden md:block">
                        <p className="font-medium text-gray-900 leading-tight">
                            {user?.fullName === 'New Admin' ? 'Admin Panel' : (user?.fullName === 'Admin User' ? roleLabel : user?.fullName)}
                        </p>
                        <p className="text-xs text-gray-500 leading-tight">{roleLabel}</p>
                    </div>
                </div>

                {/* Mobile: icon-only avatar button */}
                <button
                    onClick={() => navigate('/profile')}
                    className="sm:hidden w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0"
                    aria-label="My profile"
                >
                    <UserIcon className="w-4 h-4 text-primary-600" />
                </button>

                {/* Logout — text on sm+, icon-only on mobile */}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition border border-rose-200/80 shadow-xs min-h-[36px]"
                    title="Log out of system"
                >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        </header>
    );
}