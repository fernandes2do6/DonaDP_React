import { useState, useEffect } from 'react';
import { addDoc, collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { getLocalISODate } from '../utils/formatters';

const ProductForm = ({ productToEdit, onClose }) => {
    const [formData, setFormData] = useState({
        nome: '',
        marca: 'Natura',
        porcentagem: '',
        dataInicio: getLocalISODate(),
        dataFim: '',
        pdfUrl: '',
        estoque: '0'
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (productToEdit) {
            setFormData({
                nome: productToEdit.nome || '',
                marca: productToEdit.marca || 'Natura',
                porcentagem: productToEdit.porcentagem || '',
                dataInicio: productToEdit.dataInicio || getLocalISODate(),
                dataFim: productToEdit.dataFim || '',
                pdfUrl: productToEdit.pdfUrl || '',
                estoque: productToEdit.estoque?.toString() || '0'
            });
        }
    }, [productToEdit]);

    useEffect(() => {
        if (formData.marca === 'Boticário' && !formData.porcentagem && !productToEdit) {
            setFormData(prev => ({ ...prev, porcentagem: '80' }));
        }
    }, [formData.marca, productToEdit, formData.porcentagem]);

    const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const cleanNome = formData.nome?.trim();
        if (!cleanNome) {
            alert("Por favor, preencha o Nome do Ciclo!");
            return;
        }
        if (!formData.dataInicio) {
            alert("Por favor, selecione a Data de Início do Ciclo!");
            return;
        }
        if (!formData.dataFim) {
            alert("Por favor, selecione a Data de Término do Ciclo!");
            return;
        }
        if (formData.dataFim < formData.dataInicio) {
            alert("A Data de Término não pode ser anterior à Data de Início!");
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                nome: cleanNome,
                marca: formData.marca,
                dataInicio: formData.dataInicio,
                dataFim: formData.dataFim,
                porcentagem: formData.porcentagem ? formData.porcentagem.toString() : '',
                pdfUrl: formData.pdfUrl?.trim() || '',
                estoque: parseInt(formData.estoque) || 0
            };

            if (productToEdit) {
                await setDoc(doc(db, "produtos", productToEdit.id), payload, { merge: true });
                alert("Ciclo atualizado com sucesso!");
            } else {
                await addDoc(collection(db, "produtos"), { ...payload, timestamp: Date.now() });
                alert('Ciclo cadastrado com sucesso!');
            }
            onClose();
        } catch (error) {
            console.error("Erro ao salvar ciclo:", error);
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
                    Nome do Ciclo / Campanha <span className="text-brand-orange font-bold">*</span>
                </label>
                <input 
                    type="text" 
                    value={formData.nome} 
                    onChange={(e) => handleChange('nome', e.target.value)} 
                    placeholder="Ex: Ciclo 15/2026, Especial Dia das Mães..." 
                    className={inputClass} 
                    required 
                    autoFocus
                />
            </div>

            <div>
                <label className={labelClass}>
                    Marca <span className="text-brand-orange font-bold">*</span>
                </label>
                <select 
                    value={formData.marca} 
                    onChange={(e) => handleChange('marca', e.target.value)} 
                    className={inputClass}
                    required
                >
                    <option value="Natura">Natura</option>
                    <option value="Avon">Avon</option>
                    <option value="Boticário">Boticário</option>
                    <option value="Eudora">Eudora</option>
                    <option value="Outros">Outros</option>
                </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelClass}>
                        Início do Ciclo <span className="text-brand-orange font-bold">*</span>
                    </label>
                    <input 
                        type="date" 
                        required 
                        value={formData.dataInicio} 
                        onChange={(e) => handleChange('dataInicio', e.target.value)} 
                        className={inputClass} 
                    />
                </div>
                <div>
                    <label className={labelClass}>
                        Fim do Ciclo <span className="text-brand-orange font-bold">*</span>
                    </label>
                    <input 
                        type="date" 
                        required 
                        value={formData.dataFim} 
                        onChange={(e) => handleChange('dataFim', e.target.value)} 
                        className={inputClass} 
                    />
                </div>
            </div>

            <div>
                <label className={labelClass}>
                    Custo Padrão do Ciclo (%) <span className="text-light-muted font-normal">(Opcional - padrão da marca se vazio)</span>
                </label>
                <input 
                    type="number" 
                    min="0" 
                    max="100" 
                    value={formData.porcentagem} 
                    onChange={(e) => handleChange('porcentagem', e.target.value)} 
                    placeholder="Ex: 30 (deixa vazio para usar padrão da marca)" 
                    className={inputClass} 
                />
            </div>

            <div>
                <label className={labelClass}>
                    Link do Catálogo / Revista PDF <span className="text-light-muted font-normal">(Opcional)</span>
                </label>
                <input 
                    type="url" 
                    value={formData.pdfUrl} 
                    onChange={(e) => handleChange('pdfUrl', e.target.value)} 
                    placeholder="https://..." 
                    className={inputClass} 
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
                    {submitting ? 'Salvando...' : productToEdit ? 'Salvar Alterações' : 'Cadastrar Ciclo'}
                </button>
            </div>
        </form>
    );
};

export default ProductForm;
