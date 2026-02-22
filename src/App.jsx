import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { DataProvider } from './contexts/DataContext';
import Layout from './components/Layout';

// Pages
import Dashboard from './pages/Dashboard';
import Sales from './pages/Sales';
import Clients from './pages/Clients';
import Products from './pages/Products';

function App() {
  return (
    <DataProvider>
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/products" element={<Products />} />
          </Routes>
        </Layout>
      </Router>
    </DataProvider>
  );
}

export default App;
