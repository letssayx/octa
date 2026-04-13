import { useState, useRef, useEffect } from 'react'
import { TaskOrchestrator } from './orchestrator/Orchestrator'
import './App.css'

type Message = {
  role: 'user' | 'system';
  content: string;
}

// Mocking OPFS Folder Structure
type FileNode = { name: string; type: 'file' | 'context' };
type FolderNode = {
    id: string;
    name: string;
    files: FileNode[];
    chatHistory: Message[]; // Each folder isolates its own history
}

const INITIAL_FOLDERS: FolderNode[] = [
    {
        id: 'f1',
        name: 'Q3 Accounting',
        files: [{name: 'sales_q3.csv', type: 'file'}, {name: 'inventory.xlsx', type: 'file'}],
        chatHistory: [{role: 'system', content: 'Context isolated to: Q3 Accounting. Implicit margin set to 18% via hidden .octa_context.'}]
    },
    {
        id: 'f2',
        name: 'Myntra Image Assets',
        files: [{name: 'summer_collection.zip', type: 'file'}],
        chatHistory: [{role: 'system', content: 'Context isolated to: Myntra Image Assets. Auto-formatting to 1024x1024.'}]
    },
    {
        id: 'f3',
        name: 'HR & Payroll',
        files: [{name: 'staff_august.csv', type: 'file'}],
        chatHistory: [{role: 'system', content: 'Context isolated to: HR & Payroll.'}]
    }
]

function App() {
  const [folders, setFolders] = useState<FolderNode[]>(INITIAL_FOLDERS)
  const [activeFolderId, setActiveFolderId] = useState<string>('f1')
  const [prompt, setPrompt] = useState('')
  const [workspaceState, setWorkspaceState] = useState<string>('Empty Workspace')
  const chatHistoryRef = useRef<HTMLDivElement>(null)

  const activeFolder = folders.find(f => f.id === activeFolderId) || folders[0]

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [activeFolder.chatHistory])

  const handleRunTask = async () => {
    if (!prompt.trim()) return;

    const userPrompt = prompt;
    setPrompt('');

    // 1. Update the local context's chat history
    const updateHistory = (newMsg: Message) => {
        setFolders(prev => prev.map(f => {
            if (f.id === activeFolderId) {
                return { ...f, chatHistory: [...f.chatHistory, newMsg] }
            }
            return f;
        }))
    }

    updateHistory({ role: 'user', content: userPrompt });

    // Simulate thinking delay
    setTimeout(async () => {
        // In a real app, Orchestrator would receive `activeFolder.id` to read the correct `.octa_context` file via OPFS
        const result = await TaskOrchestrator.handleTask(userPrompt)

        let systemResponse = "Task completed.";
        if (typeof result === 'string') {
            systemResponse = result;
        } else {
            systemResponse = result.message;
            if (result.action === 'duckdb_sql') setWorkspaceState(`Data Grid / FortuneSheet View [Context: ${activeFolder.name}]`);
            if (result.action === 'generate_pdf') setWorkspaceState(`PDF Preview View [Context: ${activeFolder.name}]`);
            if (result.action === 'modify_image') setWorkspaceState(`Image Editor View [Context: ${activeFolder.name}]`);
        }

        updateHistory({ role: 'system', content: systemResponse });
    }, 500);
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRunTask();
    }
  }

  return (
    <div className="octa-desktop">
      {/* LEFT SIDEBAR - FILE EXPLORER */}
      <div className="sidebar">
        <div className="sidebar-header">
          <h2>Octa Desktop</h2>
        </div>

        <div className="sidebar-nav">
          {folders.map(folder => (
              <div key={folder.id} className="folder-wrapper">
                  <div
                    className={`folder-header ${activeFolderId === folder.id ? 'active' : ''}`}
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                      <span className="folder-icon">📁</span>
                      {folder.name}
                  </div>
                  {activeFolderId === folder.id && (
                      <div className="folder-contents">
                          {folder.files.map((file, idx) => (
                              <div key={idx} className="file-item">
                                  <span className="file-icon">📄</span>
                                  {file.name}
                              </div>
                          ))}
                      </div>
                  )}
              </div>
          ))}
        </div>
      </div>

      {/* CENTER CHAT */}
      <div className="chat-container">
        <div className="chat-header">
            Context Bounded to: {activeFolder.name}
        </div>
        <div className="chat-history" ref={chatHistoryRef}>
          {activeFolder.chatHistory.map((m, i) => (
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
              placeholder={`Message Octa inside "${activeFolder.name}"...`}
            />
            <button className="send-btn" onClick={handleRunTask}>↑</button>
          </div>
          <div style={{textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '8px'}}>
            Implicit Grounded Memory active for this folder.
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
