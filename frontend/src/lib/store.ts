// Temporary synchronous store using localStorage until OPFS FileSystem is fully implemented
export type Message = {
    role: 'user' | 'system';
    content: string;
    timestamp: number;
    action?: string;
    generatedLogic?: string;
};

export type FileNode = { name: string; type: 'file' | 'context' };

export type FolderNode = {
    id: string;
    name: string;
    files: FileNode[];
    chatHistory: Message[];
};

export type SavedAutomation = {
    id: string;
    name: string;
    pythonCode: string;
    timestamp: number;
};

const STORAGE_KEY = 'octa_folders';
const SETTINGS_KEY = 'octa_settings';
const AUTOMATIONS_KEY = 'octa_automations';

export type Settings = {
    llmProvider: 'groq' | 'openrouter' | 'huggingface' | 'auto';
    groqApiKey: string;
    openRouterApiKey: string;
    hfApiKey: string;
    theme: 'light' | 'dark' | 'system';
    osStyle: 'windows' | 'mac' | 'linux';
};

export const loadSettings = (): Settings => {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
        return JSON.parse(data);
    }
    return {
        llmProvider: 'auto',
        groqApiKey: '',
        openRouterApiKey: '',
        hfApiKey: '',
        theme: 'dark',
        osStyle: 'windows'
    };
};

export const saveSettings = (settings: Settings) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
};

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

const DEFAULT_SKILLS: SavedAutomation[] = [
    {
        id: 'skill-clean-data',
        name: 'Skill: Clean Data (Drop NaN)',
        pythonCode: `import pandas as pd\ndf = pd.read_csv('sheet_data.csv')\nclean_df = df.dropna()\nresult = clean_df.to_dict(orient='records')\nresult`,
        timestamp: Date.now()
    },
    {
        id: 'skill-summary-stats',
        name: 'Skill: Summary Stats',
        pythonCode: `import pandas as pd\ndf = pd.read_csv('sheet_data.csv')\nsummary = df.describe().reset_index()\nresult = summary.to_dict(orient='records')\nresult`,
        timestamp: Date.now()
    }
];

export const loadAutomations = (): SavedAutomation[] => {
    const data = localStorage.getItem(AUTOMATIONS_KEY);
    if (data) {
        return JSON.parse(data);
    }
    // Return default CrewAI-style tools/skills if empty
    return DEFAULT_SKILLS;
};

export const saveAutomations = (automations: SavedAutomation[]) => {
    localStorage.setItem(AUTOMATIONS_KEY, JSON.stringify(automations));
};
