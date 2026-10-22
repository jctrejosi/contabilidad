import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// AccessGate desactivado temporalmente (2026-10-21): Fortuner27 no está
// disponible y el gate bloqueaba toda la interfaz. Ver docs/CAMBIOS.md.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
