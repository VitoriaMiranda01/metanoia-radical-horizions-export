import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Instagram, Menu, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const LandingNav = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-black/90 backdrop-blur-md border-b border-white/10 py-4' : 'bg-transparent py-6'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          {/* Logo */}
          {/* The Link wrapper already exists, just added cursor-pointer class */}
          <Link to="/" className="flex items-center space-x-3 group cursor-pointer"> 
            <img 
              src="https://horizons-cdn.hostinger.com/13c6e949-152b-4918-9648-ee8b27e5e2cf/ea6fe427e17542cbf0e791fb09fba6dc.png" 
              alt="Metanoia Radical Logo" 
              className="h-10 md:h-12 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div className="hidden md:block leading-tight">
              <h1 className="text-lg font-bold text-white tracking-wide uppercase">
                Metanoia <span className="text-red-600">Radical</span> <span className="text-green-600">SERRA</span>
              </h1>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <a 
              href="https://www.instagram.com/metanoiaradicalserra" 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 text-gray-400 hover:text-pink-500 transition-colors bg-white/5 rounded-full hover:bg-white/10"
            >
              <Instagram className="w-5 h-5" />
            </a>
            
            <Button
              onClick={() => navigate('/equipante')}
              className="bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-full px-6 transition-all transform hover:scale-105 shadow-lg shadow-orange-900/20"
            >
              Equipantes
            </Button>
             <Button
              onClick={() => navigate('/login')}
              className="bg-white text-black hover:bg-gray-200 rounded-full"
            >
              Organizadores
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white p-2"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-black border-b border-white/10 overflow-hidden"
          >
            <div className="px-4 py-6 space-y-4 flex flex-col items-center">
               <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-gray-300 hover:text-white"
              >
                <Instagram className="w-5 h-5" />
                <span>Siga-nos no Instagram</span>
              </a>
              <Button
                onClick={() => navigate('/equipante')}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
              >
                Área do Equipante
              </Button>
               <Button
                onClick={() => navigate('/login')}
                className="w-full bg-white text-black hover:bg-gray-200"
              >
                Organizadores
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default LandingNav;