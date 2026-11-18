import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import { App } from './app/App'
import { requestPersistentStorage } from './app/persistStorage'
import { replayJournal } from './db/noteJournal'

void requestPersistentStorage()
void replayJournal()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
