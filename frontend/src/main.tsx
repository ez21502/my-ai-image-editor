import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { TMAProvider } from './providers/TMAProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TMAProvider>
      <App />
    </TMAProvider>
  </StrictMode>,
)