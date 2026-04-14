import React, { useState, useEffect } from 'react';
import { loadSettings, saveSettings, type Settings } from '../lib/store';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<Settings>({ llmProvider: 'webllm', groqApiKey: '' });

    useEffect(() => {
        if (isOpen) {
            setSettings(loadSettings());
        }
    }, [isOpen]);

    const handleSave = () => {
        saveSettings(settings);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#242424] p-6 rounded-lg w-96 border border-[#3A3A3A] text-[#E0E0E0]">
                <h2 className="text-xl font-semibold mb-4">Settings</h2>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">LLM Provider</label>
                    <select
                        className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded p-2 focus:outline-none focus:border-[#4A4A4A]"
                        value={settings.llmProvider}
                        onChange={(e) => setSettings({ ...settings, llmProvider: e.target.value as 'webllm' | 'groq' })}
                    >
                        <option value="webllm">WebLLM (Local, Slow/Limited)</option>
                        <option value="groq">Groq (Cloud, Fast/Smart)</option>
                    </select>
                </div>

                {settings.llmProvider === 'groq' && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">Groq API Key</label>
                        <input
                            type="password"
                            placeholder="gsk_..."
                            className="w-full bg-[#1A1A1A] border border-[#3A3A3A] rounded p-2 focus:outline-none focus:border-[#4A4A4A]"
                            value={settings.groqApiKey}
                            onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                        />
                        <p className="text-xs text-gray-400 mt-1">
                            Your key is stored locally in your browser.
                        </p>
                    </div>
                )}

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded text-sm hover:bg-[#3A3A3A] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 transition-colors text-white"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
