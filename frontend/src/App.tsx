import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Login } from './pages/Login';
import { MinistryDashboard } from './pages/MinistryDashboard';
import { StateDashboard } from './pages/StateDashboard';
import { DistrictDashboard } from './pages/DistrictDashboard';
import { MPDashboard } from './pages/MPDashboard';
import { CoverageDashboard } from './pages/CoverageDashboard';
import { MethodologyPage } from './pages/MethodologyPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { getStoredRole, getAuthToken } from './api/client';

const RootRedirect: React.FC = () => {
  const token = getAuthToken();
  const role = getStoredRole();

  if (!token || !role) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={`/${role}`} replace />;
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Ministry Dashboard */}
        <Route
          path="/ministry"
          element={
            <ProtectedRoute allowedRoles={['ministry']}>
              <MinistryDashboard />
            </ProtectedRoute>
          }
        />

        {/* State Dashboard */}
        <Route
          path="/state"
          element={
            <ProtectedRoute allowedRoles={['state', 'ministry']}>
              <StateDashboard />
            </ProtectedRoute>
          }
        />

        {/* District Dashboard */}
        <Route
          path="/district"
          element={
            <ProtectedRoute allowedRoles={['district', 'ministry']}>
              <DistrictDashboard />
            </ProtectedRoute>
          }
        />

        {/* Member of Parliament Dashboard */}
        <Route
          path="/mp"
          element={
            <ProtectedRoute allowedRoles={['mp', 'ministry']}>
              <MPDashboard />
            </ProtectedRoute>
          }
        />

        {/* Coverage & Data Quality - public, no auth required */}
        <Route path="/coverage" element={<CoverageDashboard />} />

        {/* Methodology & Limitations - public, no auth required */}
        <Route path="/methodology" element={<MethodologyPage />} />

        {/* Default / Fallback redirect */}
        <Route path="/" element={<RootRedirect />} />
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </BrowserRouter>
  );
};
export default App;
