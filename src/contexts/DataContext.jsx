import { createContext, useContext, useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../services/firebase';

const DataContext = createContext();

// eslint-disable-next-line react-refresh/only-export-components
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const [clientes, setClientes] = useState([]);
    const [produtos, setProdutos] = useState([]);
    const [vendas, setVendas] = useState([]);
    const [financeiro, setFinanceiro] = useState([]);
    const [pgos, setPgos] = useState([]); // NEW: Payment Groups
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Use a flag or ref to track mounted state, although Firebase unsubscribe handles this.
        console.log("Setting up Firestore listeners...");

        const unsubClientes = onSnapshot(collection(db, "clientes"), (snapshot) => {
            setClientes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubProdutos = onSnapshot(collection(db, "produtos"), (snapshot) => {
            setProdutos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubVendas = onSnapshot(query(collection(db, "vendas"), orderBy("timestamp", "desc")), (snapshot) => {
            setVendas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubPgos = onSnapshot(query(collection(db, "pgos"), orderBy("timestamp", "desc")), (snapshot) => {
            setPgos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubFinanceiro = onSnapshot(query(collection(db, "financeiro"), orderBy("timestamp", "desc")), (snapshot) => {
            setFinanceiro(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false); // Assume loaded once finance loads (or could wait for all)
        });

        return () => {
            // Cleanup listeners on unmount
            unsubClientes();
            unsubProdutos();
            unsubVendas();
            unsubFinanceiro();
            unsubPgos();
        };
    }, []);

    const value = {
        clientes,
        produtos,
        vendas,
        financeiro,
        pgos, // NEW
        loading
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};
