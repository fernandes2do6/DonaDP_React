import React, { useRef } from 'react';
import Modal from './Modal';
import { CloudArrowDown, WarningCircle, UploadSimple } from 'phosphor-react';

const CatalogViewerModal = ({ isOpen, onClose, brand, catalog, onFallbackRequest, onFileUpload }) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            onFileUpload(file);
        }
    };
    if (!catalog) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Catálogo Atual - ${brand}`}>
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between text-sm text-dark-muted px-2">
                    <span className="font-semibold text-white">{catalog.ciclo || 'Ciclo Vigente'}</span>
                    <span>Válido até: {catalog.dataFim ? new Date(catalog.dataFim + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</span>
                </div>

                {/* PDF Viewer Container */}
                <div className="w-full bg-dark-bg border border-white/5 rounded-xl overflow-hidden shadow-inner relative" style={{ height: '55vh' }}>
                    {catalog.pdfUrl ? (
                        <iframe
                            src={`${catalog.pdfUrl}#toolbar=0&navpanes=0`}
                            title={`Catálogo ${brand}`}
                            className="w-full h-full border-none"
                            loading="lazy"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-dark-muted">
                            <WarningCircle size={48} className="text-brand-pink mb-4 opacity-70" />
                            <p className="mb-2">Não foi possível carregar o PDF automaticamente.</p>
                            <p className="text-xs max-w-xs">A fonte oficial da marca pode ter restrições ou mudado de endereço temporariamente.</p>

                            <div className="mt-6 flex flex-col gap-3 w-full max-w-xs">
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-brand-purple text-white rounded-lg hover:bg-brand-purple/90 transition-colors text-sm font-medium w-full"
                                >
                                    <UploadSimple size={18} />
                                    Importar PDF Local
                                </button>
                                <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    ref={fileInputRef}
                                    onChange={handleFileChange}
                                />

                                <div className="flex items-center gap-2 text-dark-muted my-1">
                                    <div className="h-px bg-white/10 flex-1"></div>
                                    <span className="text-xs uppercase tracking-wider">OU</span>
                                    <div className="h-px bg-white/10 flex-1"></div>
                                </div>

                                <button
                                    onClick={onFallbackRequest}
                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-dark-surface border border-brand-purple/50 text-brand-purple rounded-lg hover:bg-brand-purple/10 transition-colors text-sm font-medium w-full"
                                >
                                    <CloudArrowDown size={18} />
                                    Inserir Link Manual
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="text-[10px] text-center text-dark-muted opacity-50 px-4">
                    Visualização integrada de PDFs do motor Dona D&P Sync.
                </div>
            </div>
        </Modal>
    );
};

export default CatalogViewerModal;
