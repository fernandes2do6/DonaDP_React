import { useState, useEffect } from 'react';
import { addDoc, collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { parseCurrency, formatCurrency } from '../utils/formatters';

const ProductForm = ({ productToEdit, onClose }) => {
    const [formData, setFormData] = useState({
        nome: '',
        marca: 'Natura',
        preco: '',
        custo: '',
        porcentagem: '',
        estoque: '',
        dataInicio: '',
        dataFim: ''
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (productToEdit) setFormData(productToEdit);
    }, [productToEdit]);

    useEffect(() => {
        if (formData.marca === 'Boticário' && !formData.porcentagem && !productToEdit) {
            setFormData(prev => ({ ...prev, porcentagem: '80' }));
        }
    }, [formData.marca, productToEdit, formData.porcentagem]);

    useEffect(() => {
        if (formData.preco && formData.porcentagem) {
            const priceVal = parseCurrency(formData.preco);
            const pctVal = parseFloat(formData.porcentagem);
            if (!isNaN(priceVal) && !isNaN(pctVal)) {
                const costVal = priceVal * (pctVal / 100);
                setFormData(prev => {
                    const newCost = formatCurrency(costVal);
                    return prev.custo !== newCost ? { ...prev, custo: newCost } : prev;
                });
            }
        }
    }, [formData.preco, formData.porcentagem]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            if (!formData.nome) { alert("Preencha o nome!"); setSubmitting(false); return; }

            const payload = { ...formData, estoque: parseInt(formData.estoque) || 0 };

            if (productToEdit) {
                await setDoc(doc(db, "produtos", productToEdit.id), payload, { merge: true });
                alert("Ciclo atualizado!");
            } else {
                await addDoc(collection(db, "produtos"), { ...payload, timestamp: Date.now() });
                alert('Ciclo salvo!');
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
                <label className={labelClass}>Ciclo (Ex: Ciclo 12/2026)</label>
                <input type="text" value={formData.nome} onChange={(e) => handleChange('nome', e.target.value)} required className={inputClass} />
            </div>
            <div className="mb-4">
                <label className={labelClass}>Marca</label>
                <select value={formData.marca} onChange={(e) => handleChange('marca', e.target.value)} className={inputClass}>
                    <option value="Natura">Natura</option>
                    <option value="Avon">Avon</option>
                    <option value="Boticário">Boticário</option>
                    <option value="Eudora">Eudora</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>Início Ciclo</label>
                    <input type="date" value={formData.dataInicio} onChange={(e) => handleChange('dataInicio', e.target.value)} className={inputClass} />
                </div>
                <div>
                    <label className={labelClass}>Fim Ciclo</label>
                    <input type="date" value={formData.dataFim} onChange={(e) => handleChange('dataFim', e.target.value)} className={inputClass} />
                </div>
            </div>

            <div className="pt-4 flex gap-3">
                <button type="button" onClick={onClose} className="flex-1 py-3 rounded-xl border border-brand-brown/30 text-dark-text hover:bg-light-surface transition-colors" disabled={submitting}>Cancelar</button>
                <button type="submit" className="flex-1 py-3 rounded-xl bg-brand-orange text-white font-semibold hover:bg-brand-orange/90 transition-colors shadow-lg shadow-brand-orange/20" disabled={submitting}>
                    {submitting ? 'Salvando...' : 'Salvar Ciclo'}
                </button>
            </div>
        </form>
    );
};

export default ProductForm;
