import React from 'react';
import { AppProviders } from './app/providers/AppProviders';
import AppRouter from './AppRouter';

export default function App() {
  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
}
