import { loadPyodide } from 'pyodide';
import type { PyodideInterface } from 'pyodide';

let pyodideInstance: PyodideInterface | null = null;

export const initPyodide = async () => {
    if (!pyodideInstance) {
        pyodideInstance = await loadPyodide({
            indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.3/full/"
        });
        await pyodideInstance.loadPackage(["pandas", "openpyxl"]); // Load common data science packages if needed
        console.log("Pyodide initialized locally.");
    }
    return pyodideInstance;
};

export const writeDataToPyodide = async (filename: string, content: string | Uint8Array) => {
    if (!pyodideInstance) {
        await initPyodide();
    }
    pyodideInstance!.FS.writeFile(filename, content);
    console.log(`[Pyodide] Saved ${filename} to virtual filesystem.`);
};

export const executeLocalPython = async (pythonCode: string) => {
    if (!pyodideInstance) {
        await initPyodide();
    }
    try {
        const result = await pyodideInstance!.runPythonAsync(pythonCode);
        return result;
    } catch (e: any) {
        throw new Error(`Python Execution Error: ${e.message}`);
    }
};
