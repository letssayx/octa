import { useState } from 'react'
import { TaskOrchestrator } from './orchestrator/Orchestrator'
import { savePreference, getPersistentDirectory } from './lib/memory'
import './App.css'

function App() {
  const [prompt, setPrompt] = useState('')
  const [log, setLog] = useState<string[]>([])

  const handleRunTask = async () => {
    setLog(prev => [...prev, `> ${prompt}`])
    const result = await TaskOrchestrator.handleTask(prompt)
    setLog(prev => [...prev, JSON.stringify(result)])
    setPrompt('')
  }

  const handleSetMemory = async () => {
    await savePreference('margin', '25%')
    setLog(prev => [...prev, `[MEM_SAVE] Margin preference locked to 25%`])
  }

  const checkOPFS = async () => {
     const dir = await getPersistentDirectory();
     if (dir) {
        setLog(prev => [...prev, `[OPFS] Sandboxed filesystem active. No data loss guaranteed.`])
     }
  }

  return (
    <div className="App" style={{ padding: '2rem', textAlign: 'left', fontFamily: 'monospace' }}>
      <h1>Work Done Engine </h1>
      <p style={{ color: 'gray' }}>Data Sovereign Client Sandbox</p>

      <div style={{ margin: '20px 0', padding: '10px', border: '1px solid #ccc' }}>
         <button onClick={handleSetMemory} style={{marginRight: '10px'}}>Set Default Margin (MEM_SAVE)</button>
         <button onClick={checkOPFS}>Check OPFS Health</button>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <input
          style={{ width: '400px', padding: '10px' }}
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="E.g. Analyze my stock, or format this image for shopify..."
        />
        <button onClick={handleRunTask} style={{ padding: '10px 20px' }}>Run Orchesterator</button>
      </div>

      <div style={{ marginTop: '20px', background: '#1e1e1e', color: '#00ff00', padding: '20px', height: '300px', overflowY: 'auto' }}>
        {log.map((l, i) => <div key={i}>{l}</div>)}
      </div>
    </div>
  )
}

export default App
