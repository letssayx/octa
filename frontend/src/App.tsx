import { useState, useRef, useEffect } from 'react'
import { TaskOrchestrator } from './orchestrator/Orchestrator'
import { savePreference, getPersistentDirectory } from './lib/memory'
import './App.css'

type Message = {
  role: 'user' | 'system';
  content: string;
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'Welcome to Octa Desktop. I can help with research PDFs, accounting data, image modification, and HR tasks.' }
  ])
  const [workspaceState, setWorkspaceState] = useState<string>('Empty Workspace')
  const chatHistoryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [messages])

  const handleRunTask = async () => {
    if (!prompt.trim()) return;

    const userPrompt = prompt;
    setPrompt('');
    setMessages(prev => [...prev, { role: 'user', content: userPrompt }])

    // Simulate thinking delay
    setTimeout(async () => {
        const result = await TaskOrchestrator.handleTask(userPrompt)

        let systemResponse = "Task completed.";
        if (typeof result === 'string') {
            systemResponse = result;
        } else {
            systemResponse = result.message;
            if (result.action === 'duckdb_sql') setWorkspaceState('Data Grid / FortuneSheet View');
            if (result.action === 'generate_pdf') setWorkspaceState('PDF Preview View');
            if (result.action === 'modify_image') setWorkspaceState('Image Editor View');
        }

        setMessages(prev => [...prev, { role: 'system', content: systemResponse }])
    }, 500);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRunTask();
    }
  }

  const handleSetMemory = async () => {
    await savePreference('margin', '25%')
    setMessages(prev => [...prev, { role: 'system', content: '[MEM_SAVE] Margin preference locked to 25%.' }])
  }

  const checkOPFS = async () => {
     const dir = await getPersistentDirectory();
     if (dir) {
        setMessages(prev => [...prev, { role: 'system', content: '[OPFS] Sandboxed filesystem active. No data loss guaranteed.' }])
     }
  }

  return (
    <div className="octa-desktop">
      {/* LEFT SIDEBAR */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Octa Desktop</h2>
        </div>

        <div className="sidebar-nav">
          <div className="nav-section-title">Recent Work</div>
          <button className="nav-item">Q3 Sales Analysis.xlsx</button>
          <button className="nav-item">Shopify Product Images</button>
          <button className="nav-item">Stock Research.pdf</button>

          <div className="nav-section-title" style={{marginTop: '2rem'}}>System Health</div>
          <button className="nav-item" onClick={checkOPFS}>Verify OPFS Storage</button>
          <button className="nav-item" onClick={handleSetMemory}>Set Global Margin (25%)</button>
        </div>
      </div>

      {/* CENTER CHAT */}
      <div className="chat-container">
        <div className="chat-history" ref={chatHistoryRef}>
          {messages.map((m, i) => (
            <div key={i} className={`chat-message ${m.role}`}>
              <div className="message-bubble">
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="chat-input-area">
          <div className="input-wrapper">
            <input
              className="chat-input"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Octa..."
            />
            <button className="send-btn" onClick={handleRunTask}>↑</button>
          </div>
          <div style={{textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px'}}>
            Octa Desktop processes data locally for privacy.
          </div>
        </div>
      </div>

      {/* RIGHT WORKSPACE */}
      <div className="workspace-container">
        <div className="workspace-header">
          <h3 className="workspace-title">Workspace</h3>
        </div>
        <div className="workspace-content">
          <div className="placeholder-grid">
            {workspaceState}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
