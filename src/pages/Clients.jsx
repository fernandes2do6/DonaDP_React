import { useState } from 'react';
import ClientDetail from '../components/ClientDetail';
import { useData } from '../contexts/DataContext';
import { Plus, MagnifyingGlass, PencilSimple, Trash, WhatsappLogo, Eye, SortAscending, Clock } from 'phosphor-react';
import Modal from '../components/Modal';
import ClientForm from '../components/ClientForm';
import { doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from '../components/GlassCard';

const Clients = () => {
    const { clientes, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('alphabetical'); // 'alphabetical' | 'created'
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [selectedClients, setSelectedClients] = useState(new Set());
    const [viewingClient, setViewingClient] = useState(null);

    const safeClients = Array.isArray(clientes) ? clientes : [];
    const filteredClients = safeClients.filter(c =>
        c.nome && c.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortedClients = [...filteredClients].sort((a, b) => {
        if (sortBy === 'alphabetical') {
            const nameA = (a.nome || '').trim();
            const nameB = (b.nome || '').trim();
            return nameA.localeCompare(nameB, 'pt-BR', { sensitivity: 'base' });
        }
        if (sortBy === 'created') {
            const timeA = a.timestamp || 0;
            const timeB = b.timestamp || 0;
            return timeB - timeA;
        }
        return 0;
    });

    const openNew = () => { setEditingClient(null); setIsModalOpen(true); };
    const openEdit = (client, e) => { e.stopPropagation(); setEditingClient(client); setIsModalOpen(true); };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Apagar este cliente?")) {
            try { await deleteDoc(doc(db, "clientes", id)); }
            catch (error) { alert('Erro: ' + error.message); }
        }
    };

    const toggleSelection = (id) => {
        const newSet = new Set(selectedClients);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedClients(newSet);
    };

    const handleDeleteSelected = async () => {
        if (selectedClients.size === 0) return;
        if (window.confirm(`Apagar ${selectedClients.size} clientes?`)) {
            const batch = writeBatch(db);
            selectedClients.forEach(id => batch.delete(doc(db, "clientes", id)));
            await batch.commit();
            setSelectedClients(new Set());
        }
    };

    const openWhatsApp = (client, e) => {
        e.stopPropagation();
        const phone = (client.whatsapp || client.telefone || '').replace(/\D/g, '');
        if (phone) window.open(`https://wa.me/55${phone}`, '_blank');
        else alert('Sem número cadastrado');
    };

    if (loading) return <div className="text-center text-brand-orange mt-10 animate-pulse">Carregando...</div>;

    return (
        <div className="pb-24 space-y-4">
            {/* Header / Search + Sorting Filters */}
            <div className="sticky top-0 z-40 bg-light-bg/95 backdrop-blur-sm pt-2 pb-2 space-y-2.5">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-light-muted" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar cliente..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="input-field pl-10 py-2 text-sm"
                        />
                    </div>
                    <button
                        onClick={handleDeleteSelected}
                        disabled={selectedClients.size === 0}
                        className={`p-2 rounded-xl transition-all ${selectedClients.size > 0 ? 'bg-brand-yellow text-light-text cursor-pointer' : 'bg-light-surface text-light-muted opacity-40 cursor-not-allowed'}`}
                        title="Apagar clientes selecionados"
                    >
                        <Trash size={20} weight="bold" />
                    </button>
                </div>

                {/* Filtros de Ordenação: Ordem Alfabética e Ordem de Cadastro */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 no-scrollbar">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setSortBy('alphabetical')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                                sortBy === 'alphabetical'
                                    ? 'bg-brand-orange/20 border-brand-orange text-brand-orange shadow-[0_0_10px_rgba(234,88,12,0.2)]'
                                    : 'bg-light-surface border-brand-brown/30 text-light-muted hover:border-brand-brown/40'
                            }`}
                        >
                            <SortAscending size={15} weight={sortBy === 'alphabetical' ? 'bold' : 'regular'} />
                            Ordem Alfabética
                        </button>

                        <button
                            onClick={() => setSortBy('created')}
                            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5 cursor-pointer ${
                                sortBy === 'created'
                                    ? 'bg-brand-orange/20 border-brand-orange text-brand-orange shadow-[0_0_10px_rgba(234,88,12,0.2)]'
                                    : 'bg-light-surface border-brand-brown/30 text-light-muted hover:border-brand-brown/40'
                            }`}
                        >
                            <Clock size={15} weight={sortBy === 'created' ? 'bold' : 'regular'} />
                            Ordem de Cadastro
                        </button>
                    </div>

                    <span className="text-xs text-light-muted whitespace-nowrap px-1">
                        {sortedClients.length} cliente(s)
                    </span>
                </div>
            </div>

            {/* Lista de Clientes */}
            <div className="space-y-2">
                {sortedClients.map(client => {
                    const isSelected = selectedClients.has(client.id);
                    const phone = client.whatsapp || client.telefone || '';
                    return (
                        <GlassCard
                            key={client.id}
                            onClick={() => toggleSelection(client.id)}
                            className={`relative !p-4 border transition-all duration-300 transform flex justify-between items-center cursor-pointer ${isSelected
                                ? 'border-brand-orange bg-brand-orange/40 shadow-[0_20px_40px_rgba(139,92,246,0.5)] -translate-y-2 scale-[1.02] z-10 ring-2 ring-brand-orange/60'
                                : 'border-white/5 hover:border-brand-brown/20 opacity-70 scale-95 grayscale-[0.3]'}`}
                        >
                            {/* Info do Cliente */}
                            <div className="flex items-center gap-3 min-w-0">
                                {/* Avatar inicial */}
                                <div className="w-10 h-10 rounded-full bg-brand-orange/20 border border-brand-orange/30 flex items-center justify-center flex-shrink-0">
                                    <span className="text-brand-orange font-bold text-sm">
                                        {client.nome?.charAt(0).toUpperCase()}
                                    </span>
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-semibold text-dark-text truncate">{client.nome}</h3>
                                    {phone ? (
                                        <div className="text-xs text-light-muted mt-0.5 flex items-center gap-1">
                                            <WhatsappLogo size={12} className="text-brand-green" />
                                            <span>{phone}</span>
                                        </div>
                                    ) : (
                                        <div className="text-xs text-light-muted/50 mt-0.5">Sem WhatsApp</div>
                                    )}
                                </div>
                            </div>

                            {/* Botões de Ação */}
                            <div className="flex gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                                <button
                                    onClick={() => setViewingClient(client)}
                                    className="p-2 rounded-full bg-light-surface hover:bg-white/10 text-brand-orange transition-colors"
                                    title="Ver detalhes"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={(e) => openEdit(client, e)}
                                    className="p-2 rounded-full bg-light-surface hover:bg-white/10 text-brand-orange transition-colors"
                                >
                                    <PencilSimple size={16} />
                                </button>
                                {phone && (
                                    <button
                                        onClick={(e) => openWhatsApp(client, e)}
                                        className="p-2 rounded-full bg-light-surface hover:bg-white/10 text-brand-green transition-colors"
                                    >
                                        <WhatsappLogo size={16} />
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleDelete(client.id, e)}
                                    className="p-2 rounded-full bg-light-surface hover:bg-white/10 text-brand-yellow transition-colors"
                                >
                                    <Trash size={16} />
                                </button>
                            </div>
                        </GlassCard>
                    );
                })}
                {filteredClients.length === 0 && (
                    <div className="text-center py-10 text-light-muted">Nenhum cliente encontrado.</div>
                )}
            </div>

            {/* Modal de Edição de Cliente */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingClient ? "Editar Cliente" : "Novo Cliente"}>
                <ClientForm clientToEdit={editingClient} onClose={() => setIsModalOpen(false)} />
            </Modal>

            {/* Client Detail Overlay */}
            {viewingClient && (
                <ClientDetail client={viewingClient} onClose={() => setViewingClient(null)} />
            )}
        </div>
    );
};

export default Clients;
