export const parseCurrency = (value) => {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    // Remove "R$", dots, and convert comma to dot
    return parseFloat(value.toString().replace("R$", "").replace(/\./g, "").replace(",", ".").trim()) || 0;
};

export const formatCurrency = (value) => {
    const num = parseCurrency(value);
    return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
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

export const getLocalISODate = () => {
    // Returns local YYYY-MM-DD instead of UTC
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    return (new Date(Date.now() - tzoffset)).toISOString().split('T')[0];
};

export const generateBillingMessage = ({ cliente, total, produtoDesc, marca }) => {
    const clientName = cliente || 'Cliente';
    const formattedTotal = formatCurrency(total);

    let brandText = 'da Avon';
    if (marca) {
        const m = marca.trim().toLowerCase();
        if (m === 'boticário' || m === 'boticario') {
            brandText = 'do Boticário';
        } else if (m === 'natura') {
            brandText = 'da Natura';
        } else if (m === 'eudora') {
            brandText = 'da Eudora';
        } else if (m === 'avon') {
            brandText = 'da Avon';
        } else {
            brandText = `da ${marca}`;
        }
    }

    let cicloText = 'do Ciclo atual';
    if (produtoDesc) {
        const p = produtoDesc.trim();
        if (p.toLowerCase().startsWith('ciclo')) {
            cicloText = `do ${p}`;
        } else {
            cicloText = `do Ciclo ${p}`;
        }
    }

    return `Bom dia, ${clientName}! Como você está? Espero que esteja tudo ótimo! ☀️💛\n\nEstou passando rapidinho para lembrar do valor de ${formattedTotal} ${cicloText} ${brandText}.\n\n🔑 Chave Pix: patriciasantos690@gmail.com\n\nQualquer dúvida ou se precisar de algo, é só me chamar, tá bom? Muito obrigada e um excelente dia para você! 💜😊`;
};

