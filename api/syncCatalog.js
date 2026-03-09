import { scrapeCatalog } from './utils/scraper.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { marca, bypassCache } = req.body;

        if (!marca) {
            return res.status(400).json({ error: 'Marca é obrigatória' });
        }

        // Simula processo de scraping/API request para a marca específica
        const result = await scrapeCatalog(marca, bypassCache);

        return res.status(200).json({
            success: true,
            marca,
            ...result
        });

    } catch (error) {
        console.error('API Sync Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Erro interno no motor de sincronização'
        });
    }
}
