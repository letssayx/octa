// Temporary synchronous store using localStorage until OPFS FileSystem is fully implemented
export type Message = {
    role: 'user' | 'system';
    content: string;
    timestamp: number;
};

export type FileNode = { name: string; type: 'file' | 'context' };

export type FolderNode = {
    id: string;
    name: string;
    files: FileNode[];
    chatHistory: Message[];
};

const STORAGE_KEY = 'octa_folders';

export const loadFolders = (): FolderNode[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
        return JSON.parse(data);
    }
    // Default starting state
    return [
        {
            id: 'default-1',
            name: 'General Workspace',
            files: [],
            chatHistory: [{role: 'system', content: 'Welcome to your local General Workspace.', timestamp: Date.now()}]
        }
    ];
};

export const saveFolders = (folders: FolderNode[]) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
};
