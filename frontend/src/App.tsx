import { useState, useRef, useEffect } from 'react'
import { Workbook } from "@fortune-sheet/react"
import "@fortune-sheet/react/dist/index.css"
import { TaskOrchestrator } from './orchestrator/Orchestrator'
import { loadFolders, saveFolders } from './lib/store'
import type { FolderNode, Message } from './lib/store'
import { initWebLLM } from './lib/webllm'
import './App.css'

function App() {
  const [folders, setFolders] = useState<FolderNode[]>(loadFolders())
  const [activeFolderId, setActiveFolderId] = useState<string>(folders[0]?.id || '')
  const [chatInput, setChatInput] = useState('')
  const [workspaceState, setWorkspaceState] = useState<string>('Empty Workspace')
  const [sheetData, setSheetData] = useState<any[]>([{ name: "Sheet1", celldata: [] }])
  const [showFortuneSheet, setShowFortuneSheet] = useState(false)

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false)
  const [webLlmProgress, setWebLlmProgress] = useState('')

  const chatHistoryRef = useRef<HTMLDivElement>(null)

  const activeFolder = folders.find(f => f.id === activeFolderId) || folders[0]

  // Persist folders when they change
  useEffect(() => {
      saveFolders(folders);
  }, [folders])

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [activeFolder.chatHistory])

  const handleRunTask = async () => {
    if (!chatInput.trim()) return;

    const userPrompt = chatInput;
    setChatInput('');

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

    // Execute Task Routing (WebLLM locally or Groq externally)
    const contextStr = `This chat is strictly bounded to the folder: ${activeFolder.name}. Provide concise answers.`;
    const result = await TaskOrchestrator.handleTask(userPrompt, activeFolder.name, contextStr)

    let systemResponse = "Task completed.";
    setShowFortuneSheet(false);

    if (typeof result === 'string') {
        systemResponse = result;
    } else {
        systemResponse = result.message || "Done.";
        if (result.action === 'duckdb_sql') {
            setWorkspaceState(`Data Grid / FortuneSheet View [Context: ${activeFolder.name}]`);
            const dataResult = (result as any).data;
            if (dataResult && Array.isArray(dataResult)) {
                // Convert array of objects to FortuneSheet celldata format
                const headers = Object.keys(dataResult[0] || {});
                const celldata: any[] = [];

                // Add headers
                headers.forEach((header, c) => {
                    celldata.push({ r: 0, c, v: { v: header, m: header, bl: 1 } });
                });

                // Add rows
                dataResult.forEach((row: any, r: number) => {
                    headers.forEach((header, c) => {
                        const val = row[header];
                        celldata.push({ r: r + 1, c, v: { v: val, m: String(val) } });
                    });
                });

                setSheetData([{ name: "Result Data", celldata }]);
            }
            setShowFortuneSheet(true);
        }
    }

    updateHistory({ role: 'system', content: systemResponse });
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRunTask();
    }
  }

  const createNewFolder = () => {
      const name = window.prompt("Enter new folder name:");
      if (!name) return;
      const newFolder: FolderNode = {
          id: `f-${Date.now()}`,
          name,
          files: [],
          chatHistory: [{role: 'system', content: `Context bounded to new folder: ${name}`}]
      };
      setFolders(prev => [...prev, newFolder]);
      setActiveFolderId(newFolder.id);
  }

  const handleSaveSettings = () => {
      // API Key saving removed as we are 100% Local Ollama now
      setShowSettings(false);
  }

  // Pre-load WebLLM to cache the model if desired
  const handlePreloadAI = async () => {
      setWebLlmProgress('Initializing local AI (this takes a moment to download weights)...');
      try {
          await initWebLLM((progress) => setWebLlmProgress(`Local AI: ${progress.text}`));
          setWebLlmProgress('Local AI Ready ✅');
      } catch (e) {
          setWebLlmProgress('Failed to load Local AI.');
      }
  }

  return (
    <div className="octa-desktop">
      {/* SETTINGS MODAL */}
      {showSettings && (
          <div className="modal-overlay">
              <div className="modal-content">
                  <h3>Octa Settings</h3>

                  <p style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>
                    Octa Desktop is running in 100% Local, Air-Gapped Mode.
                    Complex logic is routed to your local Ollama instance.
                  </p>

                  <label style={{marginTop: '1rem'}}>Local AI Engine (For offline drafting)</label>
                  <button className="btn-secondary" style={{width: '100%', marginBottom: '1.5rem'}} onClick={handlePreloadAI}>
                      {webLlmProgress || 'Preload WebLLM Engine'}
                  </button>

                  <div className="modal-actions">
                      <button className="btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                      <button className="btn-primary" onClick={handleSaveSettings}>Save</button>
                  </div>
              </div>
          </div>
      )}

      {/* LEFT SIDEBAR - FILE EXPLORER */}
      <div className="sidebar">
        <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2>Octa Desktop</h2>
          <button className="btn-secondary" style={{padding: '0.2rem 0.5rem'}} onClick={() => setShowSettings(true)}>⚙️</button>
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
          <button className="add-folder-btn" onClick={createNewFolder}>+ New Folder</button>
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
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
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
        <div className="workspace-content" style={{padding: showFortuneSheet ? 0 : '1rem'}}>
          {showFortuneSheet ? (
              <div style={{width: '100%', height: '100%', background: '#fff'}}>
                  <Workbook data={sheetData} />
              </div>
          ) : (
              <div className="placeholder-grid">
                {workspaceState}
              </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App
