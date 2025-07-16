import React from 'react';
import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './authConfig';
import App from './App.jsx';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import './index.css';

const msalInstance = new PublicClientApplication(msalConfig);

createRoot(document.getElementById('root')).render(
    <MsalProvider instance={msalInstance}>
        <App />
    </MsalProvider>
);
