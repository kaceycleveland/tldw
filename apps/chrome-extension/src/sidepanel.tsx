import ReactDOM from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidepanel from './components/Sidepanel';
import "./style.css";

console.log("TLDW Side panel loaded!");

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
  <AuthProvider>
    <ProtectedRoute>
      <Sidepanel />
    </ProtectedRoute>
  </AuthProvider>
);
