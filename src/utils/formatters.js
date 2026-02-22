export const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove "R$", dots, and convert comma to dot
    return parseFloat(value.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
};

export const formatCurrency = (value) => {
    return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export const formatDateForInput = (dateString) => {
    // Converts DD/MM/YYYY to YYYY-MM-DD
    if (!dateString) return "";
    const parts = dateString.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dateString;
};

export const formatDateForDisplay = (dateStringIso) => {
    // Converts YYYY-MM-DD to DD/MM/YYYY
    if (!dateStringIso) return "";
    const parts = dateStringIso.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStringIso;
};
