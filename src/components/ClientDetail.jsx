import { useState, useEffect, useRef } from 'react';
import { useData } from '../contexts/DataContext';
import { X, WhatsappLogo, Phone, MapPin, MagnifyingGlass, Check, LinkSimple, PencilSimple, Trash, Plus, CaretDown, CaretUp, FileText, Image as ImageIcon, DownloadSimple, Paperclip } from 'phosphor-react';
import { formatCurrency, parseCurrency, formatDateForDisplay, getLocalISODate } from '../utils/formatters';
import { doc, updateDoc, deleteDoc, addDoc, collection } from 'firebase/firestore';
import { db } from '../services/firebase';
import GlassCard from './GlassCard';
import Modal from './Modal';
import SalesForm from './SalesForm';
import ClientForm from './ClientForm';

const ClientDetail = ({ client, onClose }) => {
    const { vendas, financeiro, clientes, saldos } = useData();
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [searchUnlinked, setSearchUnlinked] = useState('');
    const [selectedToLink, setSelectedToLink] = useState(new Set());
    const [linking, setLinking] = useState(false);
    const [filterStatus, setFilterStatus] = useState('Todas');
    const [filterMarca, setFilterMarca] = useState('Todas');
    const [filterCiclo, setFilterCiclo] = useState('Todos');
    const [filterData, setFilterData] = useState([]);
    const [isDataDropdownOpen, setIsDataDropdownOpen] = useState(false);

    // Edit client state
    const [isEditClientModalOpen, setIsEditClientModalOpen] = useState(false);

    // Edit sale state
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSale, setEditingSale] = useState(null);

    // New sale state
    const [isNewSaleModalOpen, setIsNewSaleModalOpen] = useState(false);

    // Saldo state
    const [showSaldoModal, setShowSaldoModal] = useState(false);
    const [saldoData, setSaldoData] = useState(getLocalISODate());
    const [saldoValor, setSaldoValor] = useState('');
    const [saldoLoading, setSaldoLoading] = useState(false);
    const [editingSaldoId, setEditingSaldoId] = useState(null);
    const [isSaldoExpanded, setIsSaldoExpanded] = useState(false);

    // Attachments state
    const [isUploading, setIsUploading] = useState(false);
    const [previewImage, setPreviewImage] = useState(null);
    const fileInputRef = useRef(null);

    // Lock body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'unset'; };
    }, []);

    if (!client) return null;

    // Live binding from Context so edits cascade immediately
    const liveClient = clientes?.find(c => c.id === client.id) || client;

    const phone = liveClient.whatsapp || liveClient.telefone || '';
    const hasWhatsApp = phone && phone !== '(00) 00000-0000';
    const clientName = liveClient.nome || '';

    // Base vendas deste cliente (case-insensitive match)
    const baseClientSales = vendas.filter(v =>
        v.cliente && clientName && v.cliente.toLowerCase() === clientName.toLowerCase()
    );

    const getBaseProdutoDesc = (desc) => {
        if (!desc) return '';
        return String(desc).split(' (Parcela')[0].trim();
    };

    // Helper functions for individual filters
    const passStatus = (v) => {
        if (filterStatus === 'Todas') return true;
        if (filterStatus === 'Pendente' && v.status === 'Pago') return false;
        if (filterStatus === 'Pago' && v.status !== 'Pago') return false;
        return true;
    };
    const passMarca = (v) => filterMarca === 'Todas' || v.marca === filterMarca;
    const passCiclo = (v) => filterCiclo === 'Todos' || getBaseProdutoDesc(v.produtoDesc) === filterCiclo;
    const passData = (v) => {
        if (filterData.length === 0) return true;
        const formatted = formatDateForDisplay(v.dataPagamento || v.data);
        return filterData.includes(formatted);
    };

    // Vendas filtradas final (o que renderiza na tela)
    const clientSales = baseClientSales.filter(v => passStatus(v) && passMarca(v) && passCiclo(v) && passData(v));

    // Base para os dropdowns (cada dropdown ignora o próprio filtro para permitir selecionar outras opções compatíveis)
    const salesForMarca = baseClientSales.filter(v => passStatus(v) && passCiclo(v) && passData(v));
    const salesForCiclo = baseClientSales.filter(v => passStatus(v) && passMarca(v) && passData(v));
    const salesForData = baseClientSales.filter(v => passStatus(v) && passMarca(v) && passCiclo(v));

    const availableMarcas = [...new Set(salesForMarca.map(v => v.marca).filter(Boolean))].sort();
    const availableCiclos = [...new Set(salesForCiclo.map(v => getBaseProdutoDesc(v.produtoDesc)).filter(Boolean))].sort();
    const availableDatas = [...new Set(salesForData.map(v => {
        return formatDateForDisplay(v.dataPagamento || v.data) || null;
    }).filter(Boolean))].sort((a, b) => { // Sort descending by DD/MM/YYYY
        const [dA, mA, yA] = a.split('/').map(Number);
        const [dB, mB, yB] = b.split('/').map(Number);
        const dateA = new Date(yA, mA - 1, dA).getTime();
        const dateB = new Date(yB, mB - 1, dB).getTime();
        return dateB - dateA;
    });

    const totalClientSales = clientSales.reduce((acc, v) => acc + parseCurrency(v.total), 0);

    // Filtros e Totais para Saldos Recebidos
    const clientSaldos = saldos ? saldos.filter(s =>
        s.cliente && clientName && s.cliente.toLowerCase() === clientName.toLowerCase()
    ) : [];
    const totalClientSaldos = clientSaldos.reduce((acc, s) => acc + parseCurrency(s.valor), 0);
    const totalVendasPendentes = baseClientSales.filter(v => v.status !== 'Pago').reduce((acc, v) => acc + parseCurrency(v.total), 0);
    const totalClientPendingSales = Math.max(0, totalVendasPendentes - totalClientSaldos);

    // Todas as vendas para vincular (filtrável por busca)
    const allSalesForLinking = vendas.filter(v =>
        // Excluir vendas já deste cliente
        !(v.cliente && clientName && v.cliente.toLowerCase() === clientName.toLowerCase())
    ).filter(v =>
        !searchUnlinked ||
        (v.produtoDesc || '').toLowerCase().includes(searchUnlinked.toLowerCase()) ||
        (v.cliente || '').toLowerCase().includes(searchUnlinked.toLowerCase()) ||
        (v.marca || '').toLowerCase().includes(searchUnlinked.toLowerCase()) ||
        ((v.dataPagamento || v.data) || '').includes(searchUnlinked) || (formatDateForDisplay(v.dataPagamento || v.data) || '').includes(searchUnlinked)
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

    const handleTogglePaymentStatus = async (sale, e) => {
        e.stopPropagation();
        const newStatus = sale.status === 'Pago' ? 'Pendente' : 'Pago';
        const updates = { status: newStatus };
        
        if (newStatus === 'Pago') {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            updates.dataPago = `${yyyy}-${mm}-${dd}`;
        } else {
            updates.dataPago = '';
        }

        try {
            await updateDoc(doc(db, 'vendas', sale.id), updates);
            
            const prefix = sale.id.slice(0, 4);
            const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
            const linked = safeFinanceiro.filter(f => f && f.ref && typeof f.ref === 'string' && f.ref.includes(prefix));
            
            for (const f of linked) {
                try {
                    await updateDoc(doc(db, 'financeiro', f.id), { status: newStatus });
                } catch (err) {
                    console.error("Erro ao atualizar status do financeiro:", err);
                }
            }
        } catch (error) {
            console.error("Erro ao atualizar status:", error);
            alert("Erro ao atualizar status da venda.");
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

    const handleSaveSaldo = async () => {
        if (!saldoValor) return;
        setSaldoLoading(true);
        try {
            if (editingSaldoId) {
                await updateDoc(doc(db, 'saldos_recebidos', editingSaldoId), {
                    valor: saldoValor,
                    data: saldoData
                });
            } else {
                await addDoc(collection(db, 'saldos_recebidos'), {
                    cliente: clientName,
                    valor: saldoValor,
                    data: saldoData,
                    timestamp: Date.now()
                });
            }
            setShowSaldoModal(false);
            setSaldoValor('');
            setEditingSaldoId(null);
            setSaldoData(getLocalISODate());
        } catch (error) {
            alert('Erro ao salvar saldo: ' + error.message);
        } finally {
            setSaldoLoading(false);
        }
    };

    const handleDeleteSaldo = async (id, e) => {
        e.stopPropagation();
        if (window.confirm('Apagar este recebimento de saldo?')) {
            await deleteDoc(doc(db, 'saldos_recebidos', id));
        }
    };

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
                    const MAX_HEIGHT = 800;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);

                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    resolve(dataUrl);
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    const handleFileUpload = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setIsUploading(true);
        try {
            const uploadedAnexos = [];
            for (const file of files) {
                if (!file.type.startsWith('image/')) {
                    alert(`O arquivo ${file.name} não é uma imagem válida.`);
                    continue;
                }

                // Compress image to Base64
                const base64Data = await compressImage(file);
                // Approx size calculation from base64 length
                const approxSize = Math.round((base64Data.length * 3) / 4);
                
                uploadedAnexos.push({
                    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
                    name: file.name,
                    url: base64Data, // Data URI
                    type: 'image/jpeg', // We converted to jpeg
                    date: getLocalISODate(),
                    size: approxSize
                });
            }

            if (uploadedAnexos.length > 0) {
                const currentAnexos = liveClient.anexos || [];
                // Check if total size won't exceed Firestore limits roughly (1MB limit)
                const totalCurrentSize = currentAnexos.reduce((acc, a) => acc + (a.url?.length || 0), 0);
                const newUploadSize = uploadedAnexos.reduce((acc, a) => acc + (a.url?.length || 0), 0);
                
                if (totalCurrentSize + newUploadSize > 850000) { // Keep safe margin
                    alert("Aviso: Limite de armazenamento por cliente atingido. Apague algumas imagens antigas para adicionar novas.");
                    setIsUploading(false);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }

                await updateDoc(doc(db, 'clientes', client.id), {
                    anexos: [...currentAnexos, ...uploadedAnexos]
                });
            }
        } catch (error) {
            console.error("Erro no upload (detalhes):", error);
            alert("Erro ao fazer upload do(s) arquivo(s): " + error.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input
        }
    };

    const handleDeleteAttachment = async (anexo, e) => {
        e.stopPropagation();
        if (window.confirm(`Tem certeza que deseja apagar a imagem "${anexo.name}"?`)) {
            try {
                // Remove from Firestore
                const currentAnexos = liveClient.anexos || [];
                const updatedAnexos = currentAnexos.filter(a => a.id !== anexo.id);
                await updateDoc(doc(db, 'clientes', client.id), {
                    anexos: updatedAnexos
                });
            } catch (error) {
                console.error("Erro ao apagar imagem:", error);
                alert("Erro ao apagar imagem.");
            }
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-light-bg">
            {/* TopBar */}
            <div className="flex items-center justify-between p-4 border-b border-brand-brown/30">
                <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10 transition-colors">
                    <X size={22} className="text-light-muted" />
                </button>
                <h2 className="text-sm font-semibold text-light-text">Detalhes do Cliente</h2>
                <button 
                    onClick={() => setIsEditClientModalOpen(true)} 
                    className="p-1.5 rounded-full hover:bg-white/10 transition-colors text-brand-orange"
                    title="Editar Informações do Cliente"
                >
                    <PencilSimple size={20} />
                </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-28 space-y-4">

                {/* Avatar + Name */}
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-brand-orange/20 border-2 border-brand-orange/40 flex items-center justify-center shrink-0">
                        <span className="text-brand-orange font-bold text-2xl">
                            {clientName.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-light-text">{clientName}</h1>
                        <div className="flex items-center gap-1 mt-0.5">
                            <WhatsappLogo size={14} className={hasWhatsApp ? 'text-brand-green' : 'text-light-muted'} />
                            <span className={`text-xs ${hasWhatsApp ? 'text-brand-green' : 'text-light-muted'}`}>
                                {hasWhatsApp ? 'WhatsApp disponível' : 'Sem WhatsApp'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* WhatsApp Button */}
                <button
                    onClick={handleOpenWhatsApp}
                    className={`w-full py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 ${hasWhatsApp
                        ? 'bg-brand-orange text-white shadow-lg shadow-brand-orange/30 hover:bg-brand-orange/90'
                        : 'bg-light-surface text-light-muted border border-brand-brown/30 cursor-not-allowed'
                        }`}
                >
                    <WhatsappLogo size={20} weight="fill" />
                    Conversar no WhatsApp
                </button>

                {/* Contact Info Card */}
                <GlassCard className="p-4!">
                    <h3 className="text-sm font-semibold text-light-text mb-3">Informações de Contato</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <Phone size={12} className="text-light-muted" />
                                <span className="text-[10px] text-light-muted uppercase font-medium">Telefone</span>
                            </div>
                            <p className="text-sm text-light-text">{phone || 'Não informado'}</p>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 mb-1">
                                <MapPin size={12} className="text-light-muted" />
                                <span className="text-[10px] text-light-muted uppercase font-medium">Endereço</span>
                            </div>
                            <p className="text-sm text-light-text truncate">{client.endereco || 'Não informado'}</p>
                        </div>
                    </div>
                </GlassCard>

                {/* Saldos Avulsos / Lembretes Card */}
                <GlassCard className="p-4!">
                    <div 
                        className="flex justify-between items-start cursor-pointer group"
                        onClick={() => setIsSaldoExpanded(!isSaldoExpanded)}
                    >
                        <div>
                            <div className="flex items-center gap-1.5">
                                <h3 className="text-sm font-semibold text-light-text group-hover:text-brand-green transition-colors">Lembretes de Saldos</h3>
                                {isSaldoExpanded ? <CaretUp size={14} className="text-light-muted group-hover:text-brand-green" /> : <CaretDown size={14} className="text-light-muted group-hover:text-brand-green" />}
                            </div>
                            <p className="text-[10px] text-light-muted leading-tight mt-0.5">Clique para ver todos</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className="text-[10px] bg-brand-green/10 text-brand-green px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Saldo: {formatCurrency(totalClientSaldos)}
                            </span>
                            <span className="text-[10px] bg-brand-yellow/10 text-brand-yellow px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                                Falta Receber: {formatCurrency(totalClientPendingSales)}
                            </span>
                        </div>
                    </div>

                    {isSaldoExpanded && (
                        <div className="mt-4 pt-3 border-t border-white/5 animate-fade-in">
                            <div className="flex justify-end mb-3">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSaldoValor('');
                                        setSaldoData(getLocalISODate());
                                        setEditingSaldoId(null);
                                        setShowSaldoModal(true);
                                    }}
                                    className="px-3 py-1.5 flex items-center gap-1.5 rounded-lg bg-brand-green/10 hover:bg-brand-green/20 text-brand-green transition-colors border border-brand-green/20 text-xs font-bold"
                                    title="Adicionar Lembrete de Saldo"
                                >
                                    <Plus size={14} weight="bold" /> Adicionar Saldo
                                </button>
                            </div>

                            {clientSaldos.length > 0 ? (
                                <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-2">
                                    {clientSaldos.sort((a,b) => {
                                        const dateA = new Date((a.dataPagamento || a.data) + 'T12:00:00').getTime();
                                        const dateB = new Date((b.dataPagamento || b.data) + 'T12:00:00').getTime();
                                        return dateB - dateA;
                                    }).map(saldo => (
                                        <div key={`saldo-${saldo.id}`} className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-brand-green/5 border border-brand-green/20 transition-colors">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-bold text-brand-green">{formatCurrency(parseCurrency(saldo.valor))}</div>
                                                <div className="text-[10px] text-light-muted mt-0.5">
                                                    {formatDateForDisplay(saldo.data)}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSaldoValor(saldo.valor);
                                                        setSaldoData(saldo.data);
                                                        setEditingSaldoId(saldo.id);
                                                        setShowSaldoModal(true);
                                                    }}
                                                    className="px-2 py-1 rounded-full bg-light-surface hover:bg-white/10 text-brand-orange transition-colors flex gap-1 items-center font-semibold text-[10px]"
                                                    title="Editar Lembrete"
                                                >
                                                    <PencilSimple size={12} /> Editar
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteSaldo(saldo.id, e);
                                                    }}
                                                    className="p-1.5 rounded-full bg-light-surface hover:bg-white/10 text-brand-yellow transition-colors"
                                                    title="Apagar Lembrete"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-4 text-light-muted text-sm border border-dashed border-white/5 rounded-xl bg-light-surface/30">
                                    Nenhum lembrete de saldo registrado.
                                </div>
                            )}
                        </div>
                    )}
                </GlassCard>

                {/* Documentos e Anexos Card */}
                <GlassCard className="p-4!">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-light-text flex items-center gap-1.5">
                            <Paperclip size={16} className="text-brand-orange" />
                            Documentos e Anexos
                        </h3>
                        <span className="text-[10px] bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full font-medium">
                            {(liveClient.anexos || []).length} arquivo(s)
                        </span>
                    </div>

                    <div className="space-y-3">
                        <input 
                            type="file" 
                            multiple 
                            ref={fileInputRef} 
                            style={{ display: 'none' }} 
                            onChange={handleFileUpload}
                            accept="image/*"
                        />
                        
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={isUploading}
                            className="w-full py-2.5 rounded-xl border border-dashed border-brand-orange/40 text-brand-orange hover:bg-brand-orange/10 transition-colors font-medium text-xs flex items-center justify-center gap-2"
                        >
                            {isUploading ? (
                                <span className="animate-pulse">Processando imagem...</span>
                            ) : (
                                <>
                                    <Plus size={14} weight="bold" />
                                    Adicionar Imagem
                                </>
                            )}
                        </button>

                        {(liveClient.anexos || []).length > 0 ? (
                            <div className="max-h-[200px] overflow-y-auto custom-scrollbar space-y-2 mt-2">
                                {(liveClient.anexos || []).map(anexo => {
                                    const isImage = anexo.type?.startsWith('image/');
                                    const sizeInMB = (anexo.size / (1024 * 1024)).toFixed(2);
                                    
                                    return (
                                        <div key={anexo.id} className="flex justify-between items-center px-3 py-2.5 rounded-xl bg-light-bg/50 border border-white/5 hover:border-brand-brown/20 transition-colors group cursor-pointer" onClick={() => setPreviewImage(anexo.url)}>
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isImage ? 'bg-brand-yellow/10 text-brand-yellow' : 'bg-brand-orange/10 text-brand-orange'}`}>
                                                    {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium text-light-text truncate group-hover:text-brand-orange transition-colors">{anexo.name}</p>
                                                    <p className="text-[10px] text-light-muted mt-0.5">
                                                        {formatDateForDisplay(anexo.date)} • {sizeInMB} MB
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0 ml-2 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewImage(anexo.url);
                                                    }}
                                                    className="p-1.5 rounded-full bg-light-surface hover:bg-white/10 text-brand-green transition-colors"
                                                    title="Ver/Baixar"
                                                >
                                                    <DownloadSimple size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteAttachment(anexo, e)}
                                                    className="p-1.5 rounded-full bg-light-surface hover:bg-white/10 text-brand-yellow transition-colors"
                                                    title="Excluir"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-4 text-light-muted text-[11px] border border-dashed border-white/5 rounded-xl bg-light-surface/30">
                                Nenhum documento anexado.
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Sales History Card */}
                <GlassCard className="p-4!">
                    <div className="flex justify-between items-center mb-3">
                        <h3 className="text-sm font-semibold text-light-text">Histórico de Vendas</h3>
                        <span className="text-[10px] bg-brand-orange/10 text-brand-orange px-2 py-0.5 rounded-full font-medium">
                            {clientSales.length} venda(s) • {formatCurrency(totalClientSales)}
                        </span>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col gap-2 mb-3">
                        {/* Status Pills */}
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-2">
                            {['Todas', 'Pendente', 'Pago'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-3 py-1 rounded-full text-[10px] font-medium transition-colors border ${filterStatus === status
                                        ? 'bg-brand-orange/20 border-brand-orange text-brand-orange'
                                        : 'bg-light-surface border-brand-brown/30 text-light-muted hover:border-brand-brown/20'
                                        }`}
                                >
                                    {status === 'Todas' ? 'Todas' : status === 'Pendente' ? 'Pendentes' : 'Pagos'}
                                </button>
                            ))}
                        </div>
                        {/* Dropdowns (Marca, Ciclo, Data) */}
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select
                                value={filterMarca}
                                onChange={(e) => setFilterMarca(e.target.value)}
                                className="flex-1 bg-light-surface border border-brand-brown/30 rounded-lg px-2 py-1.5 text-[11px] text-light-text focus:outline-none focus:border-brand-orange"
                            >
                                <option value="Todas">Todas as Marcas</option>
                                {availableMarcas.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <select
                                value={filterCiclo}
                                onChange={(e) => setFilterCiclo(e.target.value)}
                                className="flex-1 bg-light-surface border border-brand-brown/30 rounded-lg px-2 py-1.5 text-[11px] text-light-text focus:outline-none focus:border-brand-orange"
                            >
                                <option value="Todos">Todos os Ciclos</option>
                                {availableCiclos.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="relative flex-1">
                                <div 
                                    onClick={() => setIsDataDropdownOpen(!isDataDropdownOpen)}
                                    className="bg-light-surface border border-brand-brown/30 rounded-lg px-2 py-1.5 text-[11px] text-light-text cursor-pointer flex justify-between items-center"
                                >
                                    <span className="truncate pr-2">
                                        {filterData.length === 0 ? 'Todas as Datas' : 
                                         filterData.length === 1 ? filterData[0] : 
                                         `${filterData.length} datas`}
                                    </span>
                                    <CaretDown size={12} className="text-light-muted shrink-0" />
                                </div>
                                
                                {isDataDropdownOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsDataDropdownOpen(false)}></div>
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-light-surface border border-brand-brown/30 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar p-1 min-w-max">
                                            <div 
                                                className="flex items-center gap-2 px-2 py-2 hover:bg-white/5 rounded cursor-pointer transition-colors"
                                                onClick={() => {
                                                    setFilterData([]);
                                                    setIsDataDropdownOpen(false);
                                                }}
                                            >
                                                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${filterData.length === 0 ? 'bg-brand-orange border-brand-orange text-white' : 'border-brand-brown/30'}`}>
                                                    {filterData.length === 0 && <Check size={10} weight="bold" />}
                                                </div>
                                                <span className="text-[11px] text-light-text font-medium">Todas as Datas</span>
                                            </div>
                                            {availableDatas.map(d => {
                                                const isSelected = filterData.includes(d);
                                                return (
                                                    <div 
                                                        key={d}
                                                        className="flex items-center gap-2 px-2 py-2 hover:bg-white/5 rounded cursor-pointer transition-colors"
                                                        onClick={() => {
                                                            if (isSelected) {
                                                                setFilterData(filterData.filter(x => x !== d));
                                                            } else {
                                                                setFilterData([...filterData, d]);
                                                            }
                                                        }}
                                                    >
                                                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${isSelected ? 'bg-brand-orange border-brand-orange text-white' : 'border-brand-brown/30'}`}>
                                                            {isSelected && <Check size={10} weight="bold" />}
                                                        </div>
                                                        <span className="text-[11px] text-light-text">{d}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {clientSales.length > 0 ? (
                        <div className="max-h-[400px] overflow-y-auto custom-scrollbar space-y-2 pb-2">
                            {clientSales.sort((a,b) => {
                                const dateA = new Date((a.dataPagamento || a.data) + 'T12:00:00').getTime();
                                const dateB = new Date((b.dataPagamento || b.data) + 'T12:00:00').getTime();
                                return dateB - dateA;
                            }).map(sale => {
                                const total = parseCurrency(sale.total);
                                const custo = parseCurrency(sale.custo);
                                const lucro = total - custo;
                                const isPago = sale.status === 'Pago';
                                return (
                                    <div key={`sale-${sale.id}`} className="px-3 py-3 rounded-xl bg-light-bg/50 border border-white/5 hover:border-brand-brown/20 transition-colors">
                                        <div className="flex justify-between items-start mb-1.5">
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-light-text truncate">{sale.produtoDesc || 'Produto diverso'}</div>
                                                <div className="text-[10px] text-light-muted flex items-center gap-2 mt-0.5">
                                                    <span>{formatDateForDisplay(sale.dataPagamento || sale.data) || '—'}</span>
                                                    {sale.marca && <span className="bg-brand-orange/10 text-brand-orange px-1.5 py-0.5 rounded">{sale.marca}</span>}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-2 shrink-0">
                                                <button
                                                    onClick={(e) => handleTogglePaymentStatus(sale, e)}
                                                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors cursor-pointer ${isPago
                                                        ? 'bg-brand-green/10 text-brand-green hover:bg-brand-green/20'
                                                        : 'bg-brand-yellow/10 text-brand-yellow hover:bg-brand-yellow/20'
                                                        }`}
                                                    title={`Marcar como ${isPago ? 'Pendente' : 'Pago'}`}
                                                >
                                                    {isPago ? 'Pago' : 'Pendente'}
                                                </button>
                                                <button
                                                    onClick={() => openEditSale(sale)}
                                                    className="p-1.5 rounded-full bg-light-surface hover:bg-white/10 text-brand-orange transition-colors"
                                                    title="Editar Venda"
                                                >
                                                    <PencilSimple size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDeleteSale(sale.id, e)}
                                                    className="p-1.5 rounded-full bg-light-surface hover:bg-white/10 text-brand-yellow transition-colors"
                                                    title="Apagar Venda"
                                                >
                                                    <Trash size={14} />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-[11px] mt-1">
                                            <div>
                                                <span className="text-light-muted">Valor: </span>
                                                <span className="text-light-text font-semibold">{formatCurrency(total)}</span>
                                            </div>
                                            {custo > 0 && (
                                                <div>
                                                    <span className="text-light-muted">Custo: </span>
                                                    <span className="text-light-muted">{formatCurrency(custo)}</span>
                                                </div>
                                            )}
                                            {custo > 0 && (
                                                <div>
                                                    <span className="text-light-muted">Lucro: </span>
                                                    <span className={lucro >= 0 ? 'text-brand-green' : 'text-brand-yellow'}>{formatCurrency(lucro)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-6 text-light-muted text-sm">
                            Nenhum registro encontrado.
                        </div>
                    )}
                </GlassCard>
            </div>

            {/* Actions: Nova Venda */}
            <div className="absolute bottom-0 left-0 right-0 p-4 pt-12 bg-linear-to-t from-dark-bg via-dark-bg/90 to-transparent z-40 pointer-events-none">
                <div className="flex justify-center w-full max-w-md mx-auto pointer-events-auto pb-2">
                    <button
                        onClick={() => setIsNewSaleModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-orange text-white rounded-xl shadow-lg shadow-brand-orange/40 hover:bg-brand-orange/90 hover:scale-105 active:scale-95 transition-all font-semibold text-sm"
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

                    <div className="relative w-full max-w-lg bg-light-surface border border-brand-brown/30 rounded-2xl shadow-2xl overflow-hidden max-h-[70vh] flex flex-col">
                        {/* Header */}
                        <div className="flex justify-between items-center p-4 border-b border-white/5">
                            <h3 className="text-sm font-semibold text-light-text flex items-center gap-2">
                                <LinkSimple size={16} className="text-brand-orange" />
                                Vincular a {clientName}
                            </h3>
                            <button onClick={() => setShowLinkModal(false)} className="p-1 rounded-full hover:bg-white/10">
                                <X size={18} className="text-light-muted" />
                            </button>
                        </div>

                        {/* Search */}
                        <div className="p-3 border-b border-white/5">
                            <div className="relative">
                                <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-light-muted" size={14} />
                                <input
                                    type="text"
                                    placeholder="Buscar por produto, marca, cliente ou data..."
                                    value={searchUnlinked}
                                    onChange={(e) => setSearchUnlinked(e.target.value)}
                                    className="w-full bg-light-bg border border-brand-brown/30 rounded-lg pl-8 pr-3 py-2 text-light-text text-xs focus:outline-none focus:border-brand-orange"
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
                                                ? 'bg-brand-orange/20 border-brand-orange/40'
                                                : 'bg-light-bg/50 border-white/5 hover:border-brand-brown/20'
                                                }`}
                                        >
                                            <div className="min-w-0">
                                                <div className="text-sm text-light-text truncate">{sale.produtoDesc || 'Produto diverso'}</div>
                                                <div className="text-[10px] text-light-muted">
                                                    {formatDateForDisplay(sale.dataPagamento || sale.data) || '—'} • {sale.marca || ''}
                                                    {sale.cliente ? ` • Cliente: ${sale.cliente}` : ' • Sem cliente'}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-sm font-bold text-light-text">{formatCurrency(sale.total)}</span>
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${isSelected
                                                    ? 'bg-brand-orange border-brand-orange'
                                                    : 'border-brand-brown/30'
                                                    }`}>
                                                    {isSelected && <Check size={12} weight="bold" className="text-light-text" />}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-light-muted text-sm">
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
                                    className="w-full py-3 rounded-xl bg-brand-orange text-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-brand-orange/90 active:scale-95 transition-all shadow-lg shadow-brand-orange/20"
                                >
                                    <LinkSimple size={16} weight="bold" />
                                    {linking ? 'Vinculando...' : `Vincular ${selectedToLink.size} venda(s)`}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Edit Client Modal */}
            <Modal isOpen={isEditClientModalOpen} onClose={() => setIsEditClientModalOpen(false)} title="Editar Cliente">
                <ClientForm 
                    clientToEdit={liveClient} 
                    onClose={() => setIsEditClientModalOpen(false)} 
                />
            </Modal>

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

            {/* Modal Saldo Avulso */}
            {showSaldoModal && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSaldoModal(false)} />
                    <div className="relative w-full max-w-sm bg-light-surface border border-brand-brown/30 rounded-2xl shadow-2xl overflow-hidden p-5">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-sm font-semibold text-light-text">
                                {editingSaldoId ? 'Editar Saldo' : 'Adicionar Saldo'}
                            </h3>
                            <button onClick={() => setShowSaldoModal(false)} className="p-1 rounded-full hover:bg-white/10">
                                <X size={18} className="text-light-muted" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs text-light-muted mb-1 font-medium">Valor Recebido (R$)</label>
                                <input
                                    type="text"
                                    value={saldoValor}
                                    onChange={(e) => setSaldoValor(e.target.value)}
                                    className="w-full bg-light-bg border border-brand-brown/30 rounded-lg px-3 py-2 text-light-text focus:outline-none focus:border-brand-orange text-sm"
                                    placeholder="Ex: 100,00"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-light-muted mb-1 font-medium">Data do Recebimento</label>
                                <input
                                    type="date"
                                    value={saldoData}
                                    onChange={(e) => setSaldoData(e.target.value)}
                                    className="w-full bg-light-bg border border-brand-brown/30 rounded-lg px-3 py-2 text-light-text focus:outline-none focus:border-brand-orange text-sm"
                                />
                            </div>
                            <button
                                onClick={handleSaveSaldo}
                                disabled={saldoLoading || !saldoValor}
                                className="w-full py-3 mt-2 rounded-xl bg-brand-green text-dark-bg font-bold text-sm flex items-center justify-center gap-2 hover:bg-brand-green/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saldoLoading ? 'Salvando...' : 'Salvar Saldo'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Image Preview Overlay */}
            {previewImage && (
                <div 
                    className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" 
                    onClick={() => setPreviewImage(null)}
                >
                    <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-light-text hover:bg-white/20 transition-colors">
                        <X size={24} />
                    </button>
                    <img 
                        src={previewImage} 
                        alt="Preview" 
                        className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" 
                        onClick={e => e.stopPropagation()} 
                    />
                    <a 
                        href={previewImage} 
                        download={`imagem_cliente_${Date.now()}.jpg`}
                        className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-2 bg-brand-orange text-white rounded-full shadow-lg shadow-brand-orange/20 hover:scale-105 transition-transform flex items-center gap-2 text-sm font-semibold"
                        onClick={e => e.stopPropagation()}
                    >
                        <DownloadSimple size={18} />
                        Baixar Imagem
                    </a>
                </div>
            )}
        </div>
    );
};

export default ClientDetail;
