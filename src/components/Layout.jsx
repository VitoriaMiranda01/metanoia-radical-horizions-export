import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganizerAuth } from '@/hooks/useOrganizerAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Users, UserCheck, Tent, Wrench, Settings, Grid, HeartHandshake, Banknote } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { isOrganizer, isParceiro, isAprovador } = useOrganizerAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };
  
  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'organizador':
        return 'Organizador';
      case 'organizador-aprovador':
        return 'Aprovador';
      case 'equipante':
        return 'Equipante';
      case 'acampante':
        return 'Acampante';
      case 'parceiro':
        return 'Parceiro';
      default:
        return 'Usuário';
    }
  }

  // Base navigation
  const navigationItems = [
    { path: '/acampante', label: 'Área do Acampante', icon: Tent, roles: ['acampante'] },
    { path: '/equipante', label: 'Área do Equipante', icon: Wrench, roles: ['equipante'] },
    { path: '/gerenciar', label: 'Gerenciar Inscrições', icon: Users, roles: ['organizador'] },
    { path: '/aprovacoes', label: 'Aprovações', icon: UserCheck, roles: ['organizador', 'organizador-aprovador'] }
  ];

  // Organizer specific navigation (Settings/Scales)
  const organizerItems = [
    { path: '/organizer/configuracoes', label: 'Configurações', icon: Settings },
    { path: '/organizer/escalas', label: 'Escalas', icon: Grid },
    { path: '/pagamentos-pendentes', label: 'Pagamentos Pendentes', icon: Banknote }
  ];

  const availableItems = user ? navigationItems.filter(item => 
    item.roles.includes(user.role)
  ) : [];

  const displayIdentifier = user?.nome || user?.name || user?.codigo || 'Usuário';

  return (
    <div className="min-h-screen bg-neutral-950 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-black to-black">
      <nav className="glass-effect border-b border-white/10 sticky top-0 z-50 bg-black/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <motion.div 
              className="flex items-center space-x-4"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Link to="/" className="flex items-center gap-3 cursor-pointer">
                 <img 
                    src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/ea6fe427e17542cbf0e791fb09fba6dc.png" 
                    alt="Metanoia Radical Logo" 
                    className="h-12 w-auto object-contain"
                  />
                  <div className="hidden md:block">
                    <h1 className="text-xl font-bold text-white tracking-wide uppercase leading-tight">Metanoia <span className="text-red-600">Radical</span> <span className="text-green-600">SERRA</span></h1>
                    {user && (
                      <span className="text-xs text-gray-400 uppercase tracking-widest block">
                        {getRoleDisplayName(user.role)}
                      </span>
                    )}
                  </div>
              </Link>
            </motion.div>

            <div className="flex items-center space-x-1 md:space-x-2">

              {availableItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? "default" : "ghost"}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center space-x-2 transition-all duration-300 ${
                      isActive 
                        ? 'bg-red-700 hover:bg-red-800 text-white shadow-lg shadow-red-900/20' 
                        : 'hover:bg-white/5 text-gray-300 hover:text-white'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{item.label}</span>
                  </Button>
                );
              })}

              {isParceiro && (
                <Button
                  variant={location.pathname === '/parceiros' ? "default" : "ghost"}
                  onClick={() => navigate('/parceiros')}
                  className={`flex items-center space-x-2 transition-all duration-300 ${
                    location.pathname === '/parceiros'
                      ? 'bg-red-700 hover:bg-red-800 text-white shadow-lg shadow-red-900/20' 
                      : 'hover:bg-white/5 text-gray-300 hover:text-white'
                  }`}
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span className="hidden lg:inline">Parceiros</span>
                </Button>
              )}

              {isOrganizer && (
                <div className="flex items-center space-x-1 ml-2 pl-2 border-l border-white/10">
                  {organizerItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                     return (
                      <Button
                        key={item.path}
                        variant={isActive ? "default" : "ghost"}
                        onClick={() => navigate(item.path)}
                        title={item.label}
                        className={`transition-all duration-300 ${
                          isActive 
                            ? 'bg-red-700 hover:bg-red-800 text-white' 
                            : 'hover:bg-white/5 text-gray-300 hover:text-white'
                        }`}
                        size="icon"
                      >
                        <Icon className="w-4 h-4" />
                      </Button>
                    );
                  })}
                </div>
              )}

              {user && (
                <div className="flex items-center space-x-3 ml-2 pl-2 md:ml-4 md:pl-4 border-l border-white/10">
                  <span className="text-sm text-gray-400 hidden md:inline">Olá, {displayIdentifier.split(' ')[0]}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="hover:bg-red-900/20 hover:text-red-400 text-gray-400"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;