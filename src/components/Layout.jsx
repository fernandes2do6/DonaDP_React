import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav';
import AutumnLeaves from './AutumnLeaves';
import ChatPanel from './chat/ChatPanel';
import Modal from './Modal';
import SalesForm from './SalesForm';
import ClientForm from './ClientForm';
import ProductForm from './ProductForm';
import { List, X, Gear, UsersThree, ChartBar, Info, ChatCircleDots, Sparkle, Plus } from 'phosphor-react';

const Layout = ({ children }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [chatOpen, setChatOpen] = useState(false);
    const [activeModal, setActiveModal] = useState(null); // 'sale' | 'client' | 'product' | null
    const navigate = useNavigate();
    const location = useLocation();

    // Determine FAB configuration and modal title based on current active tab
    const getFabConfig = () => {
        const path = location.pathname;
        if (path === '/clients') {
            return {
                type: 'client',
                label: 'Novo Cliente',
                modalTitle: 'Novo Cliente'
            };
        }
        if (path === '/products') {
            return {
                type: 'product',
                label: 'Novo Ciclo',
                modalTitle: 'Novo Ciclo / Marca'
            };
        }
        if (path === '/sales') {
            return {
                type: 'sale',
                label: 'Nova Venda',
                modalTitle: 'Nova Venda'
            };
        }
        // Default for '/' (Início) and other routes
        return {
            type: 'sale',
            label: 'Nova Venda',
            modalTitle: 'Nova Venda'
        };
    };

    const fabConfig = getFabConfig();

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
            {/* Header com Botão Menu e Botão do Chat Assistente */}
            <header className="fixed top-0 left-0 right-0 h-16 bg-light-bg/80 backdrop-blur-md border-b border-brand-brown/30/30 flex justify-between items-center px-6 z-40">
                <h1 className="text-xl font-bold bg-gradient-to-r from-brand-orange to-brand-yellow bg-clip-text text-transparent">
                    Dona D&P
                </h1>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setChatOpen(true)}
                        className="p-2 px-3 rounded-xl bg-gradient-to-r from-brand-orange to-brand-yellow text-white shadow-md shadow-brand-orange/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                        title="Abrir Assistente Inteligente"
                    >
                        <Sparkle size={18} weight="fill" />
                        <span>Assistente</span>
                    </button>
                    <button
                        onClick={() => setMenuOpen(true)}
                        className="p-2 rounded-xl bg-light-surface text-dark-text border border-brand-brown/30/50 hover:bg-light-bg transition-colors cursor-pointer"
                        title="Abrir Menu"
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
                            <button onClick={() => setMenuOpen(false)} className="p-2 rounded-full bg-light-bg text-light-muted cursor-pointer">
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

            {/* Botão Flutuante (FAB) Contextual por Aba */}
            <button
                onClick={() => setActiveModal(fabConfig.type)}
                className="fixed bottom-24 right-5 z-40 h-13 px-4 rounded-full bg-gradient-to-r from-brand-orange to-brand-yellow text-white shadow-xl shadow-brand-orange/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2 group font-semibold text-sm cursor-pointer"
                title={fabConfig.label}
            >
                <Plus size={22} weight="bold" className="group-hover:rotate-90 transition-transform duration-200" />
                <span className="font-bold tracking-wide">{fabConfig.label}</span>
            </button>

            {/* Modais Globais de Cadastro Rápido via FAB */}
            <Modal
                isOpen={activeModal === 'sale'}
                onClose={() => setActiveModal(null)}
                title="Nova Venda"
            >
                <SalesForm onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal
                isOpen={activeModal === 'client'}
                onClose={() => setActiveModal(null)}
                title="Novo Cliente"
            >
                <ClientForm onClose={() => setActiveModal(null)} />
            </Modal>

            <Modal
                isOpen={activeModal === 'product'}
                onClose={() => setActiveModal(null)}
                title="Novo Ciclo / Marca"
            >
                <ProductForm onClose={() => setActiveModal(null)} />
            </Modal>

            {/* Painel Lateral do Chat (Somente acionado pelo botão Assistente no topo ou menu) */}
            <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />

            <BottomNav />
        </div>
    );
};

export default Layout;
