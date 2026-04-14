import { useState, useRef, useEffect } from 'react'
import { Workbook } from "@fortune-sheet/react"
import "@fortune-sheet/react/dist/index.css"
import Papa from 'papaparse'
import { TaskOrchestrator } from './orchestrator/Orchestrator'
import { loadFolders, saveFolders } from './lib/store'
import type { FolderNode } from './lib/store'
import { writeDataToPyodide } from './lib/pyodide'
import { SettingsModal } from './components/SettingsModal'
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { X, FileText, Folder } from 'lucide-react';
import './App.css'

// Helper component for message clipping
const ChatBubble = ({ message }: { message: string }) => {
    const [expanded, setExpanded] = useState(false);
    const MAX_LENGTH = 300;
    const isLong = message.length > MAX_LENGTH;

    if (!isLong) {
        return <div className="message-bubble">{message}</div>;
    }

    return (
        <div className="message-bubble">
            {expanded ? message : `${message.substring(0, MAX_LENGTH)}...`}
            <div
                style={{fontSize: '0.8rem', color: '#66b2ff', cursor: 'pointer', marginTop: '4px', textAlign: 'right'}}
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? 'Show Less ⬆' : 'Read More ⬇'}
            </div>
        </div>
    );
};

function App() {
  const [folders, setFolders] = useState<FolderNode[]>(loadFolders())
  const [activeFolderId, setActiveFolderId] = useState<string>(folders[0]?.id || '')
  const [chatInput, setChatInput] = useState('')
  const [workspaceState, setWorkspaceState] = useState<string>('Empty Workspace')
  const [sheetData, setSheetData] = useState<any[]>([{ name: "Sheet1", celldata: [] }])
  const [showFortuneSheet, setShowFortuneSheet] = useState(false)

  // Verification Loop State
  const [pendingLogicToLock, setPendingLogicToLock] = useState<string | null>(null)

  // Settings Modal State
  const [showSettings, setShowSettings] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
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
    const updateHistory = (role: 'user' | 'system', content: string) => {
        setFolders(prev => prev.map(f => {
            if (f.id === activeFolderId) {
                return { ...f, chatHistory: [...f.chatHistory, {role, content, timestamp: Date.now()}] }
            }
            return f;
        }))
    }

    updateHistory('user', userPrompt);

    // Extract sheet data for context and Pyodide
    let sheetContext = "";
    if (sheetData && sheetData.length > 0 && sheetData[0].celldata && sheetData[0].celldata.length > 0) {
        try {
            // Convert FortuneSheet cell data to a simple 2D array
            const cells = sheetData[0].celldata;
            let maxRow = 0;
            let maxCol = 0;
            cells.forEach((c: any) => {
                if (c.r > maxRow) maxRow = c.r;
                if (c.c > maxCol) maxCol = c.c;
            });

            const grid: string[][] = Array(maxRow + 1).fill(null).map(() => Array(maxCol + 1).fill(""));
            cells.forEach((c: any) => {
                grid[c.r][c.c] = c.v?.m || c.v?.v || "";
            });

            // Generate CSV string
            const csvContent = grid.map(row => row.join(",")).join("\n");

            // Write to Pyodide so Python can access it
            writeDataToPyodide("sheet_data.csv", csvContent);

            // Extract headers and sample data for the LLM context
            const headers = grid[0] || [];
            const sampleData = grid.slice(1, 6).map(row => row.join(", ")).join("; ");
            sheetContext = `Data pasted in Active Sheet - Columns: [${headers.join(', ')}]. Sample rows: ${sampleData}. The file is saved as 'sheet_data.csv' on the filesystem.`;

            // Add implicitly to folder files if not there
            if (!activeFolder.files.find(f => f.name === 'sheet_data.csv')) {
               setFolders(prev => prev.map(f => {
                   if (f.id === activeFolderId) {
                       return { ...f, files: [...f.files, { name: 'sheet_data.csv', type: 'file' }] }
                   }
                   return f;
               }));
            }
        } catch(e) {
            console.error("Failed to parse sheet data", e);
        }
    }

    // Aggregate contextual memory
    const historyContext = activeFolder.chatHistory
        .filter(m => m.role === 'system' && (m.content.includes("Schema Columns") || m.content.includes("LOGIC LOCKED")))
        .map(m => m.content).join('\n');

    // Execute Task Routing (WebLLM locally or Groq externally)
    const contextStr = `This chat is strictly bounded to the folder: ${activeFolder.name}.\nContext constraints:\n${historyContext}\n\n${sheetContext}`;
    const result = await TaskOrchestrator.handleTask(userPrompt, activeFolder.name, contextStr)

    let systemResponse = "Task completed.";
    setShowFortuneSheet(false);

    if (typeof result === 'string') {
        systemResponse = result;
    } else {
        systemResponse = result.message || "Done.";
        if (result.action === 'duckdb_sql' || result.action === 'python_compute') {
            setWorkspaceState(`Data Grid / FortuneSheet View [Context: ${activeFolder.name}]`);
            const dataResult = (result as any).data;

            if (result.action === 'python_compute') {
                setPendingLogicToLock((result as any).generatedLogic);
            }

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

    updateHistory('system', systemResponse);
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
          chatHistory: [{role: 'system', content: `Context bounded to new folder: ${name}`, timestamp: Date.now()}]
      };
      setFolders(prev => [...prev, newFolder]);
      setActiveFolderId(newFolder.id);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
          const csvData = event.target?.result as string;
          // Parse only to get headers to prevent token explosion
          // Write full data to local Pyodide memory for Python processing later
          writeDataToPyodide(file.name, csvData);

          // Parse only to get headers to prevent token explosion for the AI
          Papa.parse(csvData, {
              header: true,
              preview: 5, // Read the first 5 rows for sample data
              complete: (results) => {
                  const headers = results.meta.fields || [];
                  const sampleData = JSON.stringify(results.data);
                  const schemaString = `File '${file.name}' attached. Schema Columns: [${headers.join(', ')}]. Sample Data: ${sampleData}`;

                  // Update folder files and append schema to context
                  setFolders(prev => prev.map(f => {
                      if (f.id === activeFolderId) {
                          return {
                              ...f,
                              files: [...f.files, { name: file.name, type: 'file' }],
                              chatHistory: [...f.chatHistory, {role: 'system', content: schemaString, timestamp: Date.now()}]
                          }
                      }
                      return f;
                  }));

                  setWorkspaceState(`File Attached: ${file.name}`);
              }
          });
      };
      reader.readAsText(file);

      // Reset input
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
  }

  const lockVerificationLogic = () => {
      if (!pendingLogicToLock) return;
      const rule = window.prompt("Name this rule to lock it for this folder (e.g. 'Always exclude tax'):");
      if (rule) {
          // Write to implicit folder memory
          setFolders(prev => prev.map(f => {
              if (f.id === activeFolderId) {
                  return { ...f, chatHistory: [...f.chatHistory, {role: 'system', content: `[LOGIC LOCKED]: ${rule}`, timestamp: Date.now()}] }
              }
              return f;
          }));
          alert(`Rule locked into .octa_context for folder ${activeFolder.name}`);
          setPendingLogicToLock(null);
      }
  }

  const deleteFile = (e: React.MouseEvent, folderId: string, filename: string) => {
      e.stopPropagation();
      setFolders(prev => prev.map(f => {
          if (f.id === folderId) {
              return { ...f, files: f.files.filter(file => file.name !== filename) }
          }
          return f;
      }));
  }

  const deleteFolder = (e: React.MouseEvent, folderId: string) => {
      e.stopPropagation();
      if (folders.length <= 1) return; // don't delete last folder
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (activeFolderId === folderId) {
          const remaining = folders.filter(f => f.id !== folderId);
          setActiveFolderId(remaining[0].id);
      }
  }

  return (
    <div className="octa-desktop">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <PanelGroup orientation="horizontal" style={{height: '100vh'}}>
          {/* LEFT SIDEBAR - FILE EXPLORER */}
          <Panel defaultSize={20} minSize={15} maxSize={30} className="sidebar" style={{borderRight: '1px solid var(--border-color)', height: '100vh', display: 'flex', flexDirection: 'column'}}>
            <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h2>Octa Desktop</h2>
              <button className="btn-secondary" style={{padding: '0.2rem 0.5rem'}} onClick={() => setShowSettings(true)}>⚙️</button>
            </div>

            <div className="sidebar-nav" style={{flex: 1, overflowY: 'auto'}}>
              {folders.map(folder => (
                  <div key={folder.id} className="folder-wrapper">
                      <div
                        className={`folder-header ${activeFolderId === folder.id ? 'active' : ''}`}
                        onClick={() => setActiveFolderId(folder.id)}
                        style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}
                      >
                          <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                              <Folder size={16} />
                              {folder.name}
                          </div>
                          {folders.length > 1 && (
                              <button className="delete-btn" onClick={(e) => deleteFolder(e, folder.id)}>
                                  <X size={14} />
                              </button>
                          )}
                      </div>
                      {activeFolderId === folder.id && (
                          <div className="folder-contents">
                              {folder.files.map((file, idx) => (
                                  <div key={idx} className="file-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                                          <FileText size={14} />
                                          <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px'}} title={file.name}>{file.name}</span>
                                      </div>
                                      <button className="delete-btn" onClick={(e) => deleteFile(e, folder.id, file.name)}>
                                          <X size={14} />
                                      </button>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
              ))}
              <button className="add-folder-btn" onClick={createNewFolder}>+ New Folder</button>
            </div>
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* CENTER CHAT */}
          <Panel defaultSize={35} minSize={25} className="chat-container" style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
            <div className="chat-header">
                Context Bounded to: {activeFolder.name}
            </div>
            <div className="chat-history" ref={chatHistoryRef} style={{flex: 1}}>
              {activeFolder.chatHistory.map((m, i) => (
                <div key={i} className={`chat-message ${m.role}`}>
                  <div style={{fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '4px', textAlign: m.role === 'user' ? 'right' : 'left'}}>
                      {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <ChatBubble message={m.content} />
                </div>
              ))}
            </div>

            <div className="chat-input-area">
              <div className="input-wrapper">
                <button
                    className="attach-btn"
                    title="Attach Data File"
                    onClick={() => fileInputRef.current?.click()}
                >
                    📎
                </button>
                <input
                  type="file"
                  accept=".csv"
                  style={{display: 'none'}}
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                />
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
          </Panel>

          <PanelResizeHandle className="resize-handle" />

          {/* RIGHT WORKSPACE */}
          <Panel defaultSize={45} minSize={30} className="workspace-container" style={{height: '100vh', display: 'flex', flexDirection: 'column'}}>
            <div className="workspace-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <h3 className="workspace-title">Workspace</h3>
              <div>
                <button
                  className="btn-secondary"
                  style={{fontSize: '0.8rem', padding: '0.2rem 0.6rem', marginRight: '8px'}}
                  onClick={() => { setShowFortuneSheet(true); setWorkspaceState('Blank Sheet'); }}
                >
                   📝 Open Blank Sheet
                </button>
                {pendingLogicToLock && (
                    <button
                      className="btn-primary"
                      style={{fontSize: '0.8rem', padding: '0.2rem 0.6rem'}}
                      onClick={lockVerificationLogic}
                    >
                       🔒 Lock Verification Logic
                    </button>
                )}
              </div>
            </div>
            <div className="workspace-content" style={{padding: showFortuneSheet ? 0 : '1rem', flex: 1}}>
              {showFortuneSheet ? (
                  <div style={{width: '100%', height: '100%', background: '#fff'}}>
                  <Workbook
                      data={sheetData}
                      onChange={(data) => setSheetData(data)}
                  />
                  </div>
              ) : (
                  <div className="placeholder-grid">
                    {workspaceState}
                  </div>
              )}
            </div>
          </Panel>
      </PanelGroup>
    </div>
  )
}

export default App
