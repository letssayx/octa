import React, { useState, useEffect } from 'react';
import { loadSettings, saveSettings, type Settings } from '../lib/store';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [settings, setSettings] = useState<Settings>({
        llmProvider: 'auto',
        groqApiKey: '',
        openRouterApiKey: '',
        hfApiKey: '',
        theme: 'dark',
        osStyle: 'windows'
    });

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
            <div className="modal-content w-96">
                <h2 className="text-xl font-semibold mb-4">Settings</h2>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Theme</label>
                    <select
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-heading)]"
                        value={settings.theme}
                        onChange={(e) => setSettings({ ...settings, theme: e.target.value as 'light' | 'dark' | 'system' })}
                    >
                        <option value="system">System Auto</option>
                        <option value="light">Light Mode</option>
                        <option value="dark">DeepSeek Dark</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">Window Style</label>
                    <select
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-heading)]"
                        value={settings.osStyle}
                        onChange={(e) => setSettings({ ...settings, osStyle: e.target.value as 'windows' | 'mac' | 'linux' })}
                    >
                        <option value="windows">Windows Standard</option>
                        <option value="mac">macOS Glass</option>
                        <option value="linux">Linux Ubuntu</option>
                    </select>
                </div>

                <hr className="my-4 border-[var(--border-color)]" />

                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">LLM Provider</label>
                    <select
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-heading)]"
                        value={settings.llmProvider}
                        onChange={(e) => setSettings({ ...settings, llmProvider: e.target.value as 'auto' | 'groq' | 'openrouter' | 'huggingface' })}
                    >
                        <option value="auto">Auto-Router (Best model for task)</option>
                        <option value="groq">Groq (Fast / Llama3)</option>
                        <option value="openrouter">OpenRouter (Coding / Qwen)</option>
                        <option value="huggingface">Hugging Face (Vision / Specific)</option>
                    </select>
                </div>

                {(settings.llmProvider === 'groq' || settings.llmProvider === 'auto') && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Groq API Key</label>
                        <input
                            type="password"
                            placeholder="gsk_..."
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-heading)]"
                            value={settings.groqApiKey}
                            onChange={(e) => setSettings({ ...settings, groqApiKey: e.target.value })}
                        />
                    </div>
                )}

                {(settings.llmProvider === 'openrouter' || settings.llmProvider === 'auto') && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">OpenRouter API Key</label>
                        <input
                            type="password"
                            placeholder="sk-or-v1-..."
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-heading)]"
                            value={settings.openRouterApiKey}
                            onChange={(e) => setSettings({ ...settings, openRouterApiKey: e.target.value })}
                        />
                    </div>
                )}

                {(settings.llmProvider === 'huggingface' || settings.llmProvider === 'auto') && (
                    <div className="mb-6">
                        <label className="block text-sm font-medium mb-2">Hugging Face API Key</label>
                        <input
                            type="password"
                            placeholder="hf_..."
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-2 focus:outline-none focus:border-[var(--accent-color)] text-[var(--text-heading)]"
                            value={settings.hfApiKey}
                            onChange={(e) => setSettings({ ...settings, hfApiKey: e.target.value })}
                        />
                        <p className="text-xs text-[var(--text-muted)] mt-1">
                            Keys are stored locally in your browser.
                        </p>
                    </div>
                )}

                <div className="flex justify-end space-x-2">
                    <button
                        onClick={onClose}
                        className="btn-secondary px-4 py-2 rounded text-sm transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="btn-primary px-4 py-2 rounded text-sm transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};
