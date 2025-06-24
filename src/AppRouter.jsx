import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainApp from './components/MainApp';
import SigningPage from './pages/SigningPage';
import SignatureComplete from './pages/SignatureComplete';

function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<MainApp />} />
      <Route path="/sign/:documentId/:signerId" element={<SigningPage />} />
      <Route path="/signature-complete" element={<SignatureComplete />} />
    </Routes>
  );
}

export default AppRouter;
