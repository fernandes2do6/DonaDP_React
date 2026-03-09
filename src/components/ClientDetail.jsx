import { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { X, WhatsappLogo, Phone, MapPin, MagnifyingGlass, Check, LinkSimple, PencilSimple, Trash, Plus } from 'phosphor-react';
import { formatCurrency, parseCurrency } from '../utils/formatters';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from './GlassCard';
import Modal from './Modal';
import SalesForm from './SalesForm';

const ClientDetail = ({ client, onClose }) => {
    const { vendas, financeiro } = useData();
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [searchUnlinked, setSearchUnlinked] = useState('');
    const [selectedToLink, setSelectedToLink] = useState(new Set());
    const [linking, setLinking] = useState(false);
    const [filterStatus, setFilterStatus] = useState('Todas');
    const [filterMarca, setFilterMarca] = useState('Todas');
    const [filterCiclo, setFilterCiclo] = useState('Todos');

    // Edit sale state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState(null);

    // New sale state
    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    if (!client) return null;

    const phone = client.whatsapp || client.telefone || '';
    const hasWhatsApp = phone && phone !== '(00) 00000-0000';
    const clientName = client.nome || '';

    // Base vendas deste cliente (case-insensitive match)
    const baseClientSales = vendas.filter(v =>
        v.cliente && clientName && v.cliente.toLowerCase() === clientName.toLowerCase()
    );

    const availableMarcas = [...new Set(baseClientSales.map(v => v.marca).filter(Boolean))].sort();
    const availableCiclos = [...new Set(baseClientSales.map(v => v.produtoDesc).filter(Boolean))].sort();

    // Vendas filtradas
    const clientSales = baseClientSales.filter(v => {
        if (filterStatus !== 'Todas') {
            if (filterStatus === 'Pendente' && v.status === 'Pago') return false;
            if (filterStatus === 'Pago' && v.status !== 'Pago') return false;
        }
        if (filterMarca !== 'Todas' && v.marca !== filterMarca) return false;
        if (filterCiclo !== 'Todos' && v.produtoDesc !== filterCiclo) return false;
        return true;
    });

    const totalClientSales = clientSales.reduce((acc, v) => acc + parseCurrency(v.total), 0);

    // Todas as vendas para vincular (filtrável por busca)
    const allSalesForLinking = vendas.filter(v =>
        // Excluir vendas já deste cliente
        !(v.cliente && clientName && v.cliente.toLowerCase() === clientName.toLowerCase())
    ).filter(v =>
        !searchUnlinked ||
        (v.produtoDesc || '').toLowerCase().includes(searchUnlinked.toLowerCase()) ||
        (v.cliente || '').toLowerCase().includes(searchUnlinked.toLowerCase()) ||
        (v.marca || '').toLowerCase().includes(searchUnlinked.toLowerCase()) ||
        (v.data || '').includes(searchUnlinked)
    );

    const handleOpenWhatsApp = () => {
        if (hasWhatsApp) {
            const cleanPhone = phone.replace(/\D/g, '');
            window.open(`https://wa.me/55${cleanPhone}`, '_blank');
        } else {
            alert('Este cliente não possui WhatsApp cadastrado.');
        }
    };

    const toggleLinkSelection = (id) => {
        const newSet = new Set(selectedToLink);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedToLink(newSet);
    };

    const handleLinkSales = async () => {
        if (selectedToLink.size === 0) return;
        setLinking(true);
        try {
            const promises = Array.from(selectedToLink).map(id =>
                updateDoc(doc(db, 'vendas', id), { cliente: clientName })
            );
            await Promise.all(promises);
            setSelectedToLink(new Set());
            setShowLinkModal(false);
            alert(`${promises.length} venda(s) vinculada(s) a ${clientName}!`);
        } catch (error) {
            alert('Erro ao vincular: ' + error.message);
        } finally {
            setLinking(false);
        }
    };

    const openEditSale = (sale) => {
        setEditingSale(sale);
        setIsEditModalOpen(true);
    };

    const cascadeDeleteFinanceiro = async (vendaId) => {
        if (!vendaId || typeof vendaId !== 'string') return;
        const prefix = vendaId.slice(0, 4);
        const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
        const linked = safeFinanceiro.filter(f => f && f.ref && typeof f.ref === 'string' && f.ref.includes(prefix));
        
        for (const f of linked) {
            try {
                await deleteDoc(doc(db, 'financeiro', f.id));
            } catch (err) {
                console.error("Erro ao apagar financeiro vinculado:", err);
            }
        }
    };

    const handleDeleteSale = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Tem certeza que deseja apagar esta venda?')) {
            try {
                await cascadeDeleteFinanceiro(id);
            } catch (error) {
                console.error("Error in cascade: ", error);
            }

            try {
                await deleteDoc(doc(db, 'vendas', id));
            } catch (error) {
                console.error("Sale delete error:", error);
                alert('Erro na exclusão da venda: ' + error.message);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-dark-bg">
            {/* TopBar */}
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                    <X size={22} className="text-dark-muted" />
                </button>
                <h2 className="text-sm font-semibold text-white">Detalhes do Cliente</h2>
                <div className="w-8" /> {/* spacer */}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-28 space-y-4">

                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-brand-purple/20 border-2 border-brand-purple/40 flex items-center justify-center shrink-0">
                        <span className="text-brand-purple font-bold text-2xl">
                            {clientName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white">{clientName}</h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <WhatsappLogo size={14} className={hasWhatsApp ? 'text-brand-green' : 'text-dark-muted'} />
                            <span className={`text-xs ${hasWhatsApp ? 'text-brand-green' : 'text-dark-muted'}`}>
                                {hasWhatsApp ? 'WhatsApp disponível' : 'Sem WhatsApp'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* WhatsApp Button */}
                <button
                    onClick={handleOpenWhatsApp}
                    className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${hasWhatsApp
                        ? 'bg-brand-purple text-white shadow-lg shadow-brand-purple/30 hover:bg-brand-purple/90'
                        : 'bg-dark-surface text-dark-muted border border-dark-border cursor-not-allowed'
                        }`}
                >
                    <WhatsappLogo size={20} weight="fill" />
                    Conversar no WhatsApp
                </button>

                {/* Contact Info Card */}
                <GlassCard className="p-4!">
                    <h3 className="text-sm font-semibold text-white mb-3">Informações de Contato</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Phone size={12} className="text-dark-muted" />
                                <span className="text-[10px] text-dark-muted uppercase font-medium">Telefone</span>
                            </div>
                            <p className="text-sm text-white">{phone || 'Não informado'}</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <MapPin size={12} className="text-dark-muted" />
                                <span className="text-[10px] text-dark-muted uppercase font-medium">Endereço</span>
                            </div>
                            <p className="text-sm text-white truncate">{client.endereco || 'Não informado'}</p>
                        </div>
                    </div>
                </GlassCard>

                {/* Sales History Card */}
                <GlassCard className="p-4!">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-white">Histórico de Vendas</h3>
                        <span className="text-[10px] bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full font-medium">
                            {clientSales.length} venda(s) • {formatCurrency(totalClientSales)}
                        </span>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-2 mb-3">
                        {/* Status Pills */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                            {['Todas', 'Pendente', 'Pago'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors border ${filterStatus === status
                                        ? 'bg-brand-purple/20 border-brand-purple text-brand-purple'
                                        : 'bg-dark-surface border-dark-border text-dark-muted hover:border-white/10'
                                        }`}
                                >
                                    {status === 'Todas' ? 'Todas' : status === 'Pendente' ? 'Pendentes' : 'Pagos'}
                                </button>
                            ))}
                        </div>
                        {/* Dropdowns (Marca e Ciclo) */}
                        <div className="flex gap-2">
                            <select
                                value={filterMarca}
                                onChange={(e) => setFilterMarca(e.target.value)}
                                className="flex-1 bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-brand-purple"
                            >
                                <option value="Todas">Todas as Marcas</option>
                                {availableMarcas.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select
                                value={filterCiclo}
                                onChange={(e) => setFilterCiclo(e.target.value)}
                                className="flex-1 bg-dark-surface border border-dark-border rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-brand-purple"
                            >
                                <option value="Todos">Todos os Ciclos (Produtos)</option>
                                {availableCiclos.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>

                    {clientSales.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2">
                            {clientSales.map(sale => {
                                const total = parseCurrency(sale.total);
                                const custo = parseCurrency(sale.custo);
                                const lucro = total - custo;
                                const isPago = sale.status === 'Pago';
                                return (
                                    <div key={sale.id} className="px-3 py-3 rounded-xl bg-dark-bg/50 border border-white/5 hover:border-white/10 transition-colors">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-white truncate">{sale.produtoDesc || 'Produto diverso'}</div>
                                                <div className="text-[10px] text-dark-muted flex items-center gap-2 mt-0.5">
                                                    <span>{sale.data || '—'}</span>
                                                    {sale.marca && <span className="bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 rounded">{sale.marca}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2 shrink-0">
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${isPago
                                                    ? 'bg-brand-green/10 text-brand-green'
                                                    : 'bg-brand-pink/10 text-brand-pink'
                                                    }`}>
                                                    {isPago ? 'Pago' : 'Pendente'}
                                                </span>
                                                <button
                                                    onClick={() => openEditSale(sale)}
                                                    className="p-1.5 rounded-full bg-dark-surface hover:bg-white/10 text-brand-purple transition-colors"
                                                    title="Editar Venda"
                                                >
                                                    <PencilSimple size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteSale(sale.id, e)}
                                                    className="p-1.5 rounded-full bg-dark-surface hover:bg-white/10 text-brand-pink transition-colors"
                                                    title="Apagar Venda"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] mt-1">
                                            <div>
                                                <span className="text-dark-muted">Valor: </span>
                                                <span className="text-white font-semibold">{formatCurrency(total)}</span>
                                            </div>
                                            {custo > 0 && (
                                                <div>
                                                    <span className="text-dark-muted">Custo: </span>
                                                    <span className="text-dark-muted">{formatCurrency(custo)}</span>
                                                </div>
                                            )}
                                            {custo > 0 && (
                                                <div>
                                                    <span className="text-dark-muted">Lucro: </span>
                                                    <span className={lucro >= 0 ? 'text-brand-green' : 'text-brand-pink'}>{formatCurrency(lucro)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-dark-muted text-sm">
                            Nenhuma venda vinculada a este cliente.
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Actions: Buscar e Vincular Vendas & Nova Venda */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-linear-to-t from-dark-bg via-dark-bg/90 to-transparent z-40 pointer-events-none">
                <div className="flex gap-3 justify-center w-full max-w-md mx-auto pointer-events-auto pb-2">
                    <button
                        onClick={() => setShowLinkModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-dark-surface/80 backdrop-blur-md border border-brand-purple/50 text-brand-purple rounded-xl shadow-lg hover:bg-brand-purple/10 active:scale-95 transition-all font-semibold text-sm"
                    >
                        <LinkSimple size={18} weight="bold" />
                        Vincular
                    </button>
                    <button
                        onClick={() => setIsNewSaleModalOpen(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-brand-purple text-white rounded-xl shadow-lg shadow-brand-purple/40 hover:bg-brand-purple/90 hover:scale-105 active:scale-95 transition-all font-semibold text-sm"
                    >
                        <Plus size={18} weight="bold" />
                        Nova Venda
                    </button>
                </div>
            </div>

            {/* Link Sales Sub-Modal */}
            {showLinkModal && (
                <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLinkModal(false)} />

                    <div className="relative w-full max-w-lg bg-dark-surface border border-dark-border rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-white/5">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <LinkSimple size={16} className="text-brand-purple" />
                                Vincular a {clientName}
                            </h3>
                            <button onClick={() => setShowLinkModal(false)} className="p-1 rounded-full hover:bg-white/10">
                                <X size={18} className="text-dark-muted" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-white/5">
                            <div className="relative">
                                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-muted" size={14} />
                                <input
                                    type="text"
                                    placeholder="Buscar por produto, marca, cliente ou data..."
                                    value={searchUnlinked}
                                    onChange={(e) => setSearchUnlinked(e.target.value)}
                                    className="w-full bg-dark-bg border border-dark-border rounded-lg pl-8 pr-3 py-2 text-white text-xs focus:outline-none focus:border-brand-purple"
                                />
                            </div>
                        </div>

                        {/* All Sales List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                            {allSalesForLinking.length > 0 ? (
                                allSalesForLinking.map(sale => {
                                    const isSelected = selectedToLink.has(sale.id);
                                    return (
                                        <div
                                            key={sale.id}
                                            onClick={() => toggleLinkSelection(sale.id)}
                                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${isSelected
                                                ? 'bg-brand-purple/20 border-brand-purple/40'
                                                : 'bg-dark-bg/50 border-white/5 hover:border-white/10'
                                                }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm text-white truncate">{sale.produtoDesc || 'Produto diverso'}</div>
                                                <div className="text-[10px] text-dark-muted">
                                                    {sale.data || '—'} • {sale.marca || ''}
                                                    {sale.cliente ? ` • Cliente: ${sale.cliente}` : ' • Sem cliente'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-bold text-white">{formatCurrency(sale.total)}</span>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-brand-purple border-brand-purple'
                                                    : 'border-dark-border'
                                                    }`}>
                                                    {isSelected && <Check size={12} weight="bold" className="text-white" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-dark-muted text-sm">
                                    Nenhuma venda encontrada.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        {selectedToLink.size > 0 && (
                            <div className="p-3 border-t border-white/5">
                                <button
                                    onClick={handleLinkSales}
                                    disabled={linking}
                                    className="w-full py-3 rounded-xl bg-brand-purple text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-purple/90 active:scale-95 transition-all shadow-lg shadow-brand-purple/20"
                                >
                                    <LinkSimple size={16} weight="bold" />
                                    {linking ? 'Vinculando...' : `Vincular ${selectedToLink.size} venda(s)`}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Sale Modal */}
            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Venda">
                <SalesForm
                    saleToEdit={editingSale}
                    onClose={() => setIsEditModalOpen(false)}
                />
            </Modal>

            {/* New Sale Modal */}
            <Modal isOpen={isNewSaleModalOpen} onClose={() => setIsNewSaleModalOpen(false)} title={`Nova Venda - ${clientName}`}>
                <SalesForm
                    defaultClient={clientName}
                    onClose={() => setIsNewSaleModalOpen(false)}
                />
            </Modal>
        </div>
    );
};

export default ClientDetail;
