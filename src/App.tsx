import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Home from './Home';
import { isAuthenticated } from './auth';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  // Use the Vite base URL so the app works both at root and when deployed under a subpath
  const base = import.meta.env.BASE_URL || '/';

  return (
    <Router basename={base}>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home/*" element={<RequireAuth><Home/></RequireAuth>} />
      </Routes>
    </Router>
  );
}
