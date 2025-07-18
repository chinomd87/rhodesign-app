import React from "react";
import { Routes, Route } from "react-router-dom";
import MainApp from "./components/MainApp";
import SigningPage from "./pages/SigningPage";
import SignatureComplete from "./pages/SignatureComplete";
import MFADashboard from "./components/MFADashboard";
import ProtectedRoute from "./components/ProtectedRoute";

function AppRouter() {
  return (
    <Routes>
      {/* Protected routes that require authentication */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainApp />
          </ProtectedRoute>
        }
      />

      {/* MFA Management */}
      <Route
        path="/mfa"
        element={
          <ProtectedRoute>
            <MFADashboard />
          </ProtectedRoute>
        }
      />

      {/* Public routes for document signing */}
      <Route path="/sign/:documentId/:signerId" element={<SigningPage />} />
      <Route path="/signature-complete" element={<SignatureComplete />} />
    </Routes>
  );
}

export default AppRouter;
