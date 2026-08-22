import { useState } from 'react';
import ClientDetail from '../components/ClientDetail';
import { useData } from '../contexts/DataContext';
import { Plus, MagnifyingGlass, PencilSimple, Trash, WhatsappLogo, Eye } from 'phosphor-react';
import Modal from '../components/Modal';
import ClientForm from '../components/ClientForm';
import { doc, deleteDoc, writeBatch } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from '../components/GlassCard';

const Clients = () => {
    const { clientes, loading } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [selectedClients, setSelectedClients] = useState(new Set());
    const [viewingClient, setViewingClient] = useState(null);

    const safeClients = Array.isArray(clientes) ? clientes : [];
    const filteredClients = safeClients.filter(c =>
        c.nome && c.nome.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            {/* Header / Search */}
            <div className="sticky top-0 z-40 bg-light-bg/95 backdrop-blur-sm pt-2 pb-2">
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
                        className={`p-2 rounded-xl transition-all ${selectedClients.size > 0 ? 'bg-brand-yellow text-light-text' : 'bg-light-surface text-light-muted'}`}
                    >
                        <Trash size={20} weight="bold" />
                    </button>
                </div>
                <div className="mt-2 text-xs text-light-muted px-1">{filteredClients.length} cliente(s)</div>
            </div>

            {/* Lista de Clientes */}
            <div className="space-y-2">
                {filteredClients.map(client => {
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

            {/* FAB */}
            <button
                onClick={openNew}
                className="fixed bottom-24 right-4 w-14 h-14 bg-brand-orange text-white rounded-full flex items-center justify-center shadow-lg shadow-brand-orange/40 hover:scale-105 active:scale-95 transition-all z-40"
            >
                <Plus size={24} weight="bold" />
            </button>

            {/* Modal */}
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
