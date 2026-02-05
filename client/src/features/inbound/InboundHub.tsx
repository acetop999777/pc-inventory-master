import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ReceiptsList from './ReceiptsList';
import ReceiptCreate from './ReceiptCreate';
import ReceiptDetail from './ReceiptDetail';

export default function InboundHub() {
  return (
    <div className="min-h-full">
      <Routes>
        <Route path="/" element={<Navigate to="/inbound/receipts" replace />} />
        <Route path="/receipts" element={<ReceiptsList />} />
        <Route path="/receipts/new" element={<ReceiptCreate />} />
        <Route path="/receipts/:id" element={<ReceiptDetail />} />
      </Routes>
    </div>
  );
}
