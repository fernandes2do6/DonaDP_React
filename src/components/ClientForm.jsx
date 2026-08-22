import { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import { addDoc, collection, setDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const ClientForm = ({ clientToEdit, onClose }) => {
    const { financeiro } = useData();
    const [formData, setFormData] = useState({ nome: '', whatsapp: '', endereco: '' });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (clientToEdit) setFormData(clientToEdit);
    }, [clientToEdit]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (!formData.nome) { alert("Preencha o nome!"); setSubmitting(false); return; }

            const payload = { ...formData, whatsapp: formData.whatsapp || "(00) 00000-0000" };

            if (clientToEdit) {
                const oldName = clientToEdit.nome;
                const newName = formData.nome;
                await setDoc(doc(db, "clientes", clientToEdit.id), payload, { merge: true });

                if (oldName && oldName !== newName) {
                    const salesQuery = query(collection(db, "vendas"), where("cliente", "==", oldName));
                    const salesSnapshot = await getDocs(salesQuery);
                    salesSnapshot.forEach(async (docSnap) => {
                        await setDoc(doc(db, "vendas", docSnap.id), { cliente: newName }, { merge: true });
                    });

                    const relevantFin = financeiro.filter(f => f.ref && f.ref.includes(oldName));
                    for (const fin of relevantFin) {
                        const newRef = fin.ref.replace(oldName, newName);
                        await setDoc(doc(db, "financeiro", fin.id), { ref: newRef }, { merge: true });
                    }
                }
                alert("Cliente atualizado!");
            } else {
                await addDoc(collection(db, "clientes"), { ...payload, saldo: "R$ 0,00", timestamp: Date.now() });
                alert('Cliente salvo!');
            }
            onClose();
        } catch (error) {
            console.error(error);
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
                <label className={labelClass}>Nome Completo</label>
                <input type="text" value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} className={inputClass} required />
            </div>
            <div>
                <label className={labelClass}>WhatsApp</label>
                <input type="text" value={formData.whatsapp} onChange={(e) => handleChange('whatsapp', e.target.value)} placeholder="(00) 00000-0000" className={inputClass} />
            </div>
            <div>
                <label className={labelClass}>Endereço</label>
                <input type="text" value={formData.endereco || ''} onChange={(e) => handleChange('endereco', e.target.value)} className={inputClass} />
            </div>

            <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-brand-brown/30 text-dark-text hover:bg-light-surface transition-colors" disabled={submitting}>Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 transition-colors shadow-lg shadow-brand-orange/20" disabled={submitting}>
                    {submitting ? 'Salvando...' : 'Salvar Cliente'}
                </button>
            </div>
        </form>
    );
};

export default ClientForm;
