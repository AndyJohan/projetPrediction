import './App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import HistoriquePage from './pages/HistoriquePage';
import PredictionPage from './pages/PredictionPage';
import CartePage from './pages/CartePage';
import AssistantPage from './pages/AssistantPage';
import ParametrePage from './pages/ParametrePage';
import SupportPage from './pages/SupportPage';

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/historique" replace />} />
            <Route path="/historique" element={<HistoriquePage />} />
            <Route path="/prediction" element={<PredictionPage />} />
            <Route path="/carte" element={<CartePage />} />
            <Route path="/assistant-ia" element={<AssistantPage />} />
            <Route path="/parametre" element={<ParametrePage />} />
            <Route path="/support" element={<SupportPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
