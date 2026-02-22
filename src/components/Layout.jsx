import { useState } from 'react';
import BottomNav from './BottomNav';
import { List, X, Gear, UsersThree, ChartBar, Info } from 'phosphor-react';

const Layout = ({ children }) => {
    const [menuOpen, setMenuOpen] = useState(false);

    const menuOptions = [
        { icon: <Gear size={22} />, label: 'Configurações', action: () => alert('Em breve: Configurações') },
        { icon: <UsersThree size={22} />, label: 'Usuários', action: () => alert('Em breve: Usuários') },
        { icon: <ChartBar size={22} />, label: 'Relatórios', action: () => alert('Em breve: Relatórios') },
        { icon: <Info size={22} />, label: 'Sobre o App', action: () => alert('Dona D&P App v2.0\nDesenvolvido com React + Firebase') },
    ];

    return (
        <div className="min-h-screen bg-dark-bg text-dark-text pb-24 font-sans">
            {/* Header com Botão Menu */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-dark-bg/80 backdrop-blur-md border-b border-dark-border/30 flex justify-between items-center px-6 z-40">
                <h1 className="text-xl font-bold bg-gradient-to-r from-brand-purple to-brand-pink bg-clip-text text-transparent">
                    Dona D&P
                </h1>
                <button
                    onClick={() => setMenuOpen(true)}
                    className="p-2 rounded-xl bg-dark-surface text-dark-text border border-dark-border/50"
                >
                    <List size={22} />
                </button>
            </header>

            {/* Overlay do Menu (Slide-up) */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    onClick={() => setMenuOpen(false)}
                >
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-dark-surface rounded-t-3xl border-t border-dark-border/50 p-6 pb-12 animate-in slide-in-from-bottom duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-white uppercase tracking-wider">Configurações & Menu</h2>
                            <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full bg-dark-bg text-dark-muted">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {menuOptions.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => { opt.action(); setMenuOpen(false); }}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-dark-bg border border-dark-border/50 text-center hover:border-brand-purple/50 transition-all active:scale-95"
                                >
                                    <span className="text-brand-purple">{opt.icon}</span>
                                    <span className="text-sm font-medium text-dark-text">{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Espaçamento para o Header fixo */}
            <main className="w-full max-w-md mx-auto md:max-w-lg lg:max-w-2xl px-4 pt-20">
                {children}
            </main>

            <BottomNav />
        </div>
    );
};

export default Layout;
