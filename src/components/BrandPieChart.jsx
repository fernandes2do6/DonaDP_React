import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

const brandColors = {
    'Natura': '#EA580C',    // Orange
    'Avon': '#EAB308',      // Yellow
    'Boticário': '#78350F', // Brown
    'Eudora': '#D97706'     // Amber
};

const BrandPieChart = ({ data, onBrandClick, selectedBrands = [] }) => {
    const counts = { 'Natura': 0, 'Avon': 0, 'Boticário': 0, 'Eudora': 0 };
    data.forEach(item => {
        const brand = item.marca || 'Outros';
        if (counts[brand] !== undefined) counts[brand]++;
    });

    const chartData = {
        labels: Object.keys(counts),
        datasets: [{
            data: Object.values(counts),
            backgroundColor: Object.keys(counts).map(b => brandColors[b]),
            borderWidth: 0,
            hoverOffset: 20,
        }],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false }
        },
        layout: { padding: 10 }
    };

    const hasSelection = selectedBrands.length > 0;

    return (
        <div className="flex items-center gap-4">
            <div className="w-40 h-40 flex-shrink-0">
                <Pie data={chartData} options={options} />
            </div>
            <div className="flex flex-col gap-2">
                {Object.keys(counts).map(brand => {
                    const isSelected = selectedBrands.includes(brand);
                    return (
                        <button
                            key={brand}
                            onClick={() => onBrandClick && onBrandClick(brand)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${isSelected
                                    ? 'bg-brand-orange/10 ring-1 ring-brand-orange/30 scale-105'
                                    : hasSelection
                                        ? 'opacity-40 hover:opacity-70'
                                        : 'hover:bg-brand-orange/5'
                                }`}
                        >
                            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: brandColors[brand] }} />
                            <span className="text-light-text">{brand}</span>
                            <span className="text-light-muted ml-auto">({counts[brand]})</span>
                        </button>
                    );
                })}
                {hasSelection && (
                    <button
                        onClick={() => onBrandClick && onBrandClick(null)}
                        className="text-[10px] text-brand-orange hover:text-light-text transition-colors text-center mt-1"
                    >
                        Limpar filtro
                    </button>
                )}
            </div>
        </div>
    );
};

export default BrandPieChart;
