import { House, ShoppingBag, Users, Tag } from 'phosphor-react';
import { useLocation, useNavigate } from 'react-router-dom';

const BottomNav = () => {
    const navigate = useNavigate();
    const location = useLocation();

    const navItems = [
        { path: '/', icon: House, label: 'Início' },
        { path: '/sales', icon: ShoppingBag, label: 'Vendas e Pagamentos' },
        { path: '/clients', icon: Users, label: 'Clientes' },
        { path: '/products', icon: Tag, label: 'Marcas / Ciclos' },
    ];

    return (
        <div className="fixed bottom-0 left-0 right-0 h-20 bg-dark-bg/80 backdrop-blur-xl border-t border-dark-border/50 flex justify-around items-center px-1 z-40 pb-2">
            {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                    <button
                        key={item.path}
                        onClick={() => navigate(item.path)}
                        className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${isActive ? 'text-brand-purple' : 'text-dark-muted hover:text-dark-text'}`}
                    >
                        <div className={`text-2xl mb-1 transition-transform duration-300 ${isActive ? '-translate-y-1 scale-110 drop-shadow-[0_0_10px_rgba(139,92,246,0.5)]' : ''}`}>
                            <Icon weight={isActive ? 'fill' : 'regular'} />
                        </div>
                        <span className={`text-[9px] font-medium whitespace-nowrap ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                            {item.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default BottomNav;
