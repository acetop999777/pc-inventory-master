import React from 'react';
import { AppProviders } from './app/providers/AppProviders';
import AppLegacy from './AppLegacy';

export default function App() {
  return (
    <AppProviders>
      <AppLegacy />
    </AppProviders>
  );
}
