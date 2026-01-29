import React, { useMemo } from 'react';
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';

import { MainLayout } from './presentation/layouts/MainLayout';
import Dashboard from './presentation/modules/Dashboard/Dashboard';
import InventoryHub from './presentation/modules/Inventory/InventoryHub';
import InboundHub from './presentation/modules/Inbound/InboundHub';

import { NavigationGuardProvider, useNavigationGuard } from './app/navigation/NavigationGuard';
import {
  ClientsDraftProvider,
  ClientsListRoute,
  ClientDetailRoute,
} from './features/clients/ClientsRoutes';

function viewFromPath(pathname: string): 'clients' | 'inventory' | 'inbound' | 'dashboard' {
  if (pathname.startsWith('/inventory')) return 'inventory';
  if (pathname.startsWith('/inbound')) return 'inbound';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  return 'clients';
}

function pathForView(v: string): string {
  switch (v) {
    case 'inventory':
      return '/inventory';
    case 'inbound':
      return '/inbound';
    case 'dashboard':
      return '/dashboard';
    default:
      return '/clients';
  }
}

function AppShell() {
  const loc = useLocation();
  const nav = useNavigate();
  const guard = useNavigationGuard();

  const currentView = useMemo(() => viewFromPath(loc.pathname), [loc.pathname]);

  return (
    <MainLayout
      currentView={currentView}
      onChangeView={(v) => {
        void guard.run(() => nav(pathForView(v)));
      }}
    >
      <ClientsDraftProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/clients" replace />} />

          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/inventory" element={<InventoryHub />} />
          <Route path="/inbound/*" element={<InboundHub />} />

          <Route path="/clients" element={<ClientsListRoute />} />
          <Route path="/clients/:id" element={<ClientDetailRoute />} />

          <Route path="*" element={<Navigate to="/clients" replace />} />
        </Routes>
      </ClientsDraftProvider>
    </MainLayout>
  );
}

export default function AppLegacy() {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NavigationGuardProvider>
        <AppShell />
      </NavigationGuardProvider>
    </HashRouter>
  );
}
