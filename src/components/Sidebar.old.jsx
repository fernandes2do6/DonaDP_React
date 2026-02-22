import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
    SquaresFour,
    ShoppingBag,
    Users,
    Package,
    CurrencyDollar,

    CloudArrowUp,
    CaretDown,
    CaretUp
} from 'phosphor-react';
import { useData } from '../contexts/DataContext';
import { exportBackupGeral } from '../utils/maintenance';

const Sidebar = () => {
    // We can access data context here if we need to show badges or status
    const { loading } = useData();
    const [isBrandsOpen, setIsBrandsOpen] = useState(true); // Default open to show structure

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                Dona D&P <small style={{ fontSize: '0.6rem', opacity: 0.5, marginLeft: '5px' }}>v4.0 React</small>
                <div
                    className={`status-dot ${!loading ? 'online' : ''}`}
                    title={!loading ? "Banco de Dados: Conectado" : "Conectando..."}
                ></div>
            </div>

            <div className="sidebar-menu">
                <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <SquaresFour size={24} /> Dashboard
                </NavLink>
                <NavLink to="/sales" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <ShoppingBag size={24} /> Vendas / PGOs
                </NavLink>
                <NavLink to="/clients" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Users size={24} /> Clientes
                </NavLink>
                <div
                    className={`nav-item ${window.location.pathname.includes('/products') ? 'active' : ''}`}
                    onClick={() => setIsBrandsOpen(!isBrandsOpen)}
                    style={{ cursor: 'pointer', justifyContent: 'space-between' }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <Package size={24} /> Marcas / Ciclo
                    </div>
                    {isBrandsOpen ? <CaretUp size={16} /> : <CaretDown size={16} />}
                </div>

                {isBrandsOpen && (
                    <div className="submenu" style={{ marginLeft: '20px', borderLeft: '2px solid rgba(255,255,255,0.1)', paddingLeft: '10px' }}>
                        <NavLink to="/products?brand=Natura" className={({ isActive }) => `nav-item ${isActive && window.location.search.includes('Natura') ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '8px' }}>
                            <div className="dot" style={{ background: '#8A2BE2', width: 8, height: 8, borderRadius: '50%', marginRight: 8 }}></div> Natura
                        </NavLink>
                        <NavLink to="/products?brand=Avon" className={({ isActive }) => `nav-item ${isActive && window.location.search.includes('Avon') ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '8px' }}>
                            <div className="dot" style={{ background: '#00FF7F', width: 8, height: 8, borderRadius: '50%', marginRight: 8 }}></div> Avon
                        </NavLink>
                        <NavLink to="/products?brand=Boticário" className={({ isActive }) => `nav-item ${isActive && window.location.search.includes('Boticário') ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '8px' }}>
                            <div className="dot" style={{ background: '#FF4D4D', width: 8, height: 8, borderRadius: '50%', marginRight: 8 }}></div> Boticário
                        </NavLink>
                        <NavLink to="/products?brand=Eudora" className={({ isActive }) => `nav-item ${isActive && window.location.search.includes('Eudora') ? 'active' : ''}`} style={{ fontSize: '0.9rem', padding: '8px' }}>
                            <div className="dot" style={{ background: '#FFA500', width: 8, height: 8, borderRadius: '50%', marginRight: 8 }}></div> Eudora
                        </NavLink>
                    </div>
                )}


                <NavLink to="/finance" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <CurrencyDollar size={24} /> Financeiro
                </NavLink>

                <hr style={{ border: 0, borderTop: '1px solid rgba(255,255,255,0.1)', margin: '10px 24px' }} />



                <div className="nav-item" onClick={exportBackupGeral} style={{ color: '#2196F3', marginTop: '5px' }}>
                    <CloudArrowUp size={24} /> Backup Geral
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
