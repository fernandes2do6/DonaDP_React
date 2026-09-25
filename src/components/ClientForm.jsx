import { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { addDoc, collection, setDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const ClientForm = ({ clientToEdit, onClose }) => {
    const { financeiro } = useData();
    const [formData, setFormData] = useState({ 
        nome: '', 
        whatsapp: '', 
        endereco: '',
        observacoes: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (clientToEdit) {
            setFormData({
                nome: clientToEdit.nome || '',
                whatsapp: clientToEdit.whatsapp || clientToEdit.telefone || '',
                endereco: clientToEdit.endereco || '',
                observacoes: clientToEdit.observacoes || ''
            });
        }
    }, [clientToEdit]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    // Phone auto-mask (DD) 9XXXX-XXXX
    const handlePhoneChange = (value) => {
        let clean = value.replace(/\D/g, '').slice(0, 11);
        let formatted = clean;
        if (clean.length > 2) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
        }
        if (clean.length > 7) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
        }
        setFormData(prev => ({ ...prev, whatsapp: formatted }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const cleanName = formData.nome?.trim();
        if (!cleanName || cleanName.length < 2) {
            alert("Por favor, preencha o Nome Completo do cliente!");
            return;
        }

        setSubmitting(true);
        try {
            const payload = { 
                nome: cleanName, 
                whatsapp: formData.whatsapp?.trim() || "(00) 00000-0000",
                endereco: formData.endereco?.trim() || "",
                observacoes: formData.observacoes?.trim() || ""
            };

            if (clientToEdit) {
                const oldName = clientToEdit.nome;
                const newName = cleanName;
                await setDoc(doc(db, "clientes", clientToEdit.id), payload, { merge: true });

                if (oldName && oldName !== newName) {
                    const salesQuery = query(collection(db, "vendas"), where("cliente", "==", oldName));
                    const salesSnapshot = await getDocs(salesQuery);
                    salesSnapshot.forEach(async (docSnap) => {
                        await setDoc(doc(db, "vendas", docSnap.id), { cliente: newName }, { merge: true });
                    });

                    const safeFinanceiro = Array.isArray(financeiro) ? financeiro : [];
                    const relevantFin = safeFinanceiro.filter(f => f && f.ref && f.ref.includes(oldName));
                    for (const fin of relevantFin) {
                        const newRef = fin.ref.replace(oldName, newName);
                        await setDoc(doc(db, "financeiro", fin.id), { ref: newRef }, { merge: true });
                    }
                }
                alert("Cliente atualizado com sucesso!");
            } else {
                await addDoc(collection(db, "clientes"), { 
                    ...payload, 
                    saldo: "R$ 0,00", 
                    timestamp: Date.now() 
                });
                alert('Cliente cadastrado com sucesso!');
            }
            onClose();
        } catch (error) {
            console.error("Erro ao salvar cliente:", error);
            alert("Erro: " + error.message);
        } finally {
            setSubmitting(false);
        }
    };

    const inputClass = "w-full bg-light-bg border border-brand-brown/30 rounded-lg px-3 py-2 text-light-text focus:outline-none focus:border-brand-orange transition-colors text-sm";
    const labelClass = "block text-xs text-light-muted mb-1 font-medium";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className={labelClass}>
                    Nome Completo <span className="text-brand-orange font-bold">*</span>
                </label>
                <input 
                    type="text" 
                    value={formData.nome} 
                    onChange={(e) => handleChange('nome', e.target.value)} 
                    placeholder="Ex: Maria da Silva" 
                    className={inputClass} 
                    required 
                    autoFocus
                />
            </div>
            <div>
                <label className={labelClass}>
                    WhatsApp / Telefone <span className="text-light-muted font-normal">(Recomendado)</span>
                </label>
                <input 
                    type="tel" 
                    value={formData.whatsapp} 
                    onChange={(e) => handlePhoneChange(e.target.value)} 
                    placeholder="(11) 98765-4321" 
                    className={inputClass} 
                />
            </div>
            <div>
                <label className={labelClass}>Endereço</label>
                <input 
                    type="text" 
                    value={formData.endereco} 
                    onChange={(e) => handleChange('endereco', e.target.value)} 
                    placeholder="Ex: Rua das Flores, 123 - Apto 4" 
                    className={inputClass} 
                />
            </div>
            <div>
                <label className={labelClass}>Observações / Preferências</label>
                <textarea 
                    value={formData.observacoes} 
                    onChange={(e) => handleChange('observacoes', e.target.value)} 
                    placeholder="Ex: Gosta de fragrâncias florais, paga todo dia 10..." 
                    className={`${inputClass} resize-none h-20`}
                />
            </div>

            <div className="pt-4 flex gap-3">
                <button 
                    type="button" 
                    onClick={onClose} 
                    className="flex-1 py-3 rounded-xl border border-brand-brown/30 text-dark-text hover:bg-light-surface transition-colors cursor-pointer" 
                    disabled={submitting}
                >
                    Cancelar
                </button>
                <button 
                    type="submit" 
                    className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 transition-colors shadow-lg shadow-brand-orange/20 cursor-pointer disabled:opacity-50" 
                    disabled={submitting}
                >
                    {submitting ? 'Salvando...' : clientToEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </button>
            </div>
        </form>
    );
};

export default ClientForm;
