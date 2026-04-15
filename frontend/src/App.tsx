import { useState, useRef, useEffect } from 'react'
import { Workbook } from "@fortune-sheet/react"
import "@fortune-sheet/react/dist/index.css"
import Papa from 'papaparse'
import { TaskOrchestrator } from './orchestrator/Orchestrator'
import { loadFolders, saveFolders, loadAutomations, saveAutomations, loadSettings } from './lib/store'
import type { FolderNode, SavedAutomation } from './lib/store'
import { writeDataToPyodide, executeLocalPython } from './lib/pyodide'
import { SettingsModal } from './components/SettingsModal'
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { X, FileText, Folder } from 'lucide-react';
import './App.css'

// Helper component for message clipping
const ChatBubble = ({ message, action, generatedLogic, onSaveAutomation }: { message: string, action?: string, generatedLogic?: string, onSaveAutomation?: (logic: string) => void }) => {
    const [expanded, setExpanded] = useState(false);
    const MAX_LENGTH = 300;
    const isLong = message.length > MAX_LENGTH;

    return (
        <div className="message-bubble" style={{display: 'flex', flexDirection: 'column'}}>
             <pre style={{whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0}}>
                 {!isLong || expanded ? message : `${message.substring(0, MAX_LENGTH)}...`}
             </pre>
             {isLong && (
                 <button
                    onClick={() => setExpanded(!expanded)}
                    style={{background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', fontSize: '0.75rem', marginTop: '4px', padding: 0, alignSelf: 'flex-start'}}
                 >
                     {expanded ? 'Show Less ↑' : 'Read More ↓'}
                 </button>
             )}
             {action === 'python_compute' && generatedLogic && onSaveAutomation && (
                 <button
                    onClick={() => onSaveAutomation(generatedLogic)}
                    className="btn-primary"
                    style={{marginTop: '12px', fontSize: '0.75rem', padding: '0.3rem 0.6rem', alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '4px'}}
                 >
                     <span>⚡</span> Save as Automation
                 </button>
             )}
        </div>
    )
}

function App() {
  const [_settings, setSettings] = useState(loadSettings())
  const [folders, setFolders] = useState<FolderNode[]>(loadFolders())
  const [activeFolderId, setActiveFolderId] = useState<string>(folders[0]?.id || '')
  const [automations, setAutomations] = useState<SavedAutomation[]>(loadAutomations())
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

  // Persist automations when they change
  useEffect(() => {
      saveAutomations(automations);
  }, [automations])

  // Apply Theme & OS Style
  useEffect(() => {
      const s = loadSettings();
      setSettings(s);

      const isDark = s.theme === 'dark' || (s.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      if (isDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
      } else {
          document.documentElement.removeAttribute('data-theme');
      }

      document.documentElement.setAttribute('data-os', s.osStyle);
  }, [showSettings, _settings.theme, _settings.osStyle]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight
    }
  }, [activeFolder.chatHistory])

  // 1. Update the local context's chat history
  const updateHistory = (role: 'user' | 'system', content: string, action?: string, generatedLogic?: string) => {
      setFolders(prev => prev.map(f => {
          if (f.id === activeFolderId) {
              return { ...f, chatHistory: [...f.chatHistory, {role, content, timestamp: Date.now(), action, generatedLogic}] }
          }
          return f;
      }))
  }

  const handleRunAutomation = async (automation: SavedAutomation) => {
      updateHistory('user', `⚡ Executing automation: ${automation.name}`);
      setWorkspaceState('Running zero-token local automation...');

      try {
          const pyResult = await executeLocalPython(automation.pythonCode);
          let dataResult: any = null;

          if (pyResult && typeof pyResult.toJs === 'function') {
              dataResult = pyResult.toJs();
          } else if (typeof pyResult === 'string') {
              try {
                   dataResult = JSON.parse(pyResult);
              } catch(e) {
                   dataResult = [{ "Result": pyResult }];
              }
          } else {
              dataResult = pyResult;
          }

          if (!Array.isArray(dataResult)) {
              dataResult = [{ "Result": String(pyResult) }];
          }

          setWorkspaceState(`Data Grid / FortuneSheet View [Context: ${activeFolder.name}]`);

          if (dataResult && Array.isArray(dataResult)) {
              const headers = Object.keys(dataResult[0] || {});
              const celldata: any[] = [];
              headers.forEach((h, col) => celldata.push({ r: 0, c: col, v: { v: h, m: h, bl: 1 } }));
              dataResult.forEach((row, r) => {
                  headers.forEach((h, c) => {
                      const val = String(row[h] || '');
                      celldata.push({ r: r+1, c, v: { v: val, m: val } });
                  });
              });
              setSheetData([{ name: "Sheet1", celldata }]);
              setShowFortuneSheet(true);
          }

          updateHistory('system', `Automation "${automation.name}" executed successfully.`, 'python_compute', automation.pythonCode);
      } catch (e: any) {
          console.error("Automation error:", e);
          updateHistory('system', `[Execution Error]\n${e.message}`, 'none');
      }
  };

  const handleRunTask = async () => {
    if (!chatInput.trim()) return;

    const userPrompt = chatInput;
    setChatInput('');

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
    let actionType = "none";
    let generatedLogic = "";
    setShowFortuneSheet(false);

    if (typeof result === 'string') {
        systemResponse = result;
    } else {
        systemResponse = result.message || "Done.";
        actionType = result.action;
        if (result.action === 'duckdb_sql' || result.action === 'python_compute') {
            setWorkspaceState(`Data Grid / FortuneSheet View [Context: ${activeFolder.name}]`);
            const dataResult = (result as any).data;

            if (result.action === 'python_compute') {
                generatedLogic = (result as any).generatedLogic;
                setPendingLogicToLock(generatedLogic);
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

    updateHistory('system', systemResponse, actionType, generatedLogic);
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

      <PanelGroup direction="horizontal" id="octa-desktop-layout" style={{height: '100vh', width: '100vw', display: 'flex'}}>
          {/* LEFT SIDEBAR - FILE EXPLORER */}
          <Panel defaultSize={20} minSize={15} maxSize={30} className="sidebar" style={{borderRight: '1px solid var(--border-color)', height: '100vh', display: 'flex', flexDirection: 'column'}}>
            <div className="sidebar-header" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <div style={{display: 'flex', alignItems: 'center'}}>
                  <div className="mac-traffic-lights">
                      <span className="close"></span>
                      <span className="min"></span>
                      <span className="max"></span>
                  </div>
                  <h2>Octa Desktop</h2>
              </div>
              <button className="btn-secondary" style={{padding: '0.2rem 0.5rem'}} onClick={() => setShowSettings(true)}>⚙️</button>
            </div>

            <div className="sidebar-nav" style={{flex: 1, overflowY: 'auto'}}>
              <h3 style={{fontSize: '0.8rem', padding: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.5rem'}}>Folders</h3>
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

              {automations.length > 0 && (
                  <div style={{marginTop: '2rem'}}>
                      <h3 style={{fontSize: '0.8rem', padding: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase'}}>My Automations</h3>
                      <div className="folder-contents">
                          {automations.map(auto => (
                              <div key={auto.id} className="file-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}} title="Click to run on current data">
                                  <div onClick={() => handleRunAutomation(auto)} style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'var(--accent-color)'}}>
                                      <span style={{fontSize: '1rem'}}>⚡</span>
                                      <span style={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px'}}>{auto.name}</span>
                                  </div>
                                  <button className="delete-btn" onClick={(e) => {
                                      e.stopPropagation();
                                      const newAuto = automations.filter(a => a.id !== auto.id);
                                      setAutomations(newAuto);
                                      saveAutomations(newAuto);
                                  }}>
                                      <X size={14} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              )}
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
                  <ChatBubble
                      message={m.content}
                      action={m.action}
                      generatedLogic={m.generatedLogic}
                      onSaveAutomation={(logic) => {
                          const name = window.prompt("Name this automation for 1-click repetitive runs (e.g. 'Monthly Profit Calculation'):");
                          if (name) {
                              const newAuto = {
                                  id: `auto-${Date.now()}`,
                                  name,
                                  pythonCode: logic,
                                  timestamp: Date.now()
                              };
                              setAutomations(prev => [...prev, newAuto]);
                          }
                      }}
                  />
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
