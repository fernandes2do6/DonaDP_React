import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BottomNav from './BottomNav';
import AutumnLeaves from './AutumnLeaves';
import ChatPanel from './chat/ChatPanel';
import { List, X, Gear, UsersThree, ChartBar, Info, ChatCircleDots, Sparkle } from 'phosphor-react';

const Layout = ({ children }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const navigate = useNavigate();

    const menuOptions = [
        { icon: <ChatCircleDots size={22} />, label: 'Assistente IA (Chat)', action: () => setChatOpen(true) },
        { icon: <ChartBar size={22} />, label: 'Relatórios', action: () => navigate('/reports') },
        { icon: <Gear size={22} />, label: 'Configurações', action: () => alert('Em breve: Configurações') },
        { icon: <UsersThree size={22} />, label: 'Usuários', action: () => alert('Em breve: Usuários') },
        { icon: <Info size={22} />, label: 'Sobre o App', action: () => alert('Dona D&P App v2.0\nDesenvolvido com React + Firebase') },
    ];

    return (
        <div className="min-h-screen bg-light-bg text-dark-text pb-24 font-sans relative">
            <AutumnLeaves />
            {/* Header com Botão Menu e Botão do Chat */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-light-bg/80 backdrop-blur-md border-b border-brand-brown/30/30 flex justify-between items-center px-6 z-40">
                <h1 className="text-xl font-bold bg-gradient-to-r from-brand-orange to-brand-yellow bg-clip-text text-transparent">
                    Dona D&P
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setChatOpen(true)}
                        className="p-2 rounded-xl bg-gradient-to-r from-brand-orange to-brand-yellow text-white shadow-md shadow-brand-orange/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold"
                        title="Abrir Assistente Inteligente"
                    >
                        <Sparkle size={18} weight="fill" />
                        <span className="hidden sm:inline">Assistente</span>
                    </button>
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="p-2 rounded-xl bg-light-surface text-dark-text border border-brand-brown/30/50 hover:bg-light-bg transition-colors"
                    >
                        <List size={22} />
                    </button>
                </div>
            </header>

            {/* Overlay do Menu (Slide-up) */}
            {menuOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    onClick={() => setMenuOpen(false)}
                >
                    <div
                        className="absolute bottom-0 left-0 right-0 bg-light-surface rounded-t-3xl border-t border-brand-brown/30/50 p-6 pb-12 animate-in slide-in-from-bottom duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-lg font-bold text-light-text uppercase tracking-wider">Configurações & Menu</h2>
                            <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full bg-light-bg text-light-muted">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            {menuOptions.map((opt, i) => (
                                <button
                                    key={i}
                                    onClick={() => { opt.action(); setMenuOpen(false); }}
                                    className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-light-bg border border-brand-brown/30/50 text-center hover:border-brand-orange/50 transition-all active:scale-95 cursor-pointer"
                                >
                                    <span className="text-brand-orange">{opt.icon}</span>
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

            {/* Botão Flutuante (FAB) do Chat Lateral */}
            <button
                onClick={() => setChatOpen(true)}
                className="fixed bottom-24 right-5 z-40 w-13 h-13 rounded-full bg-gradient-to-tr from-brand-orange to-brand-yellow text-white shadow-xl shadow-brand-orange/30 hover:scale-110 active:scale-95 flex items-center justify-center transition-all cursor-pointer group"
                title="Conversar com a Assistente"
            >
                <Sparkle size={24} weight="fill" className="group-hover:rotate-12 transition-transform" />
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
            </button>

            {/* Painel Lateral do Chat */}
            <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />

            <BottomNav />
        </div>
    );
};

export default Layout;
