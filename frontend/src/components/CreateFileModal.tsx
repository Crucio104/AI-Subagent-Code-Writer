
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FilePlus, FolderPlus } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface CreateFileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (filename: string) => void;
    type?: 'file' | 'folder';
    currentPath?: string;
    existingPaths?: string[];
}

const ALLOWED_EXTENSIONS = [
    '.py', '.js', '.ts', '.tsx', '.jsx', '.html', '.css', '.json', '.md',
    '.java', '.c', '.cpp', '.rs', '.go'
];

export const CreateFileModal: React.FC<CreateFileModalProps> = ({ isOpen, onClose, onCreate, type = 'file', currentPath = '', existingPaths = [] }) => {
    const [filename, setFilename] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = filename.trim();
        if (!trimmed) return;

        // Duplicate Check
        const targetPath = currentPath ? `${currentPath}/${trimmed}` : trimmed;

        // Exact match check
        if (existingPaths.includes(targetPath)) {
            setError("A file or folder with this name already exists.");
            return;
        }

        // Folder existence check (if it's a folder, ensure it doesn't conflict with file/folder of same name)
        // Also check if a folder exists with that name (by checking if any file starts with targetPath + '/')
        // Actually, generatedFiles keys includes folder/.keep, so exact match covers most.
        // But if we create a folder 'foo', and 'foo' file exists, exact match catches it.
        // If we create file 'foo', and folder 'foo' exists (meaning 'foo/.keep' exists), strict match won't catch 'foo' == 'foo/.keep'.

        // Let's refine:
        // If we represent folders as 'path/.keep', checking if 'path' exists as a folder means checking if 'path/.keep' exists.
        if (existingPaths.includes(`${targetPath}/.keep`)) {
            setError("A folder with this name already exists.");
            return;
        }

        if (type === 'file') {
            if (trimmed.startsWith('.')) {
                setError("Filename cannot start with a dot (must have a name before extension)");
                return;
            }
            if (!ALLOWED_EXTENSIONS.some(ext => trimmed.toLowerCase().endsWith(ext))) {
                setError(`Invalid extension. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`);
                return;
            }
        }

        onCreate(trimmed);
        setFilename('');
        setError('');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-card border border-border w-full max-w-md rounded-xl shadow-xl pointer-events-auto overflow-hidden"
                        >
                            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-2 font-semibold">
                                    {type === 'folder' ? <FolderPlus className="w-4 h-4 text-yellow-500" /> : <FilePlus className="w-4 h-4 text-primary" />}
                                    <span>{type === 'folder' ? 'Create New Folder' : 'Create New File'}</span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1 hover:bg-muted/50 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="p-4 space-y-4">
                                <div className="space-y-2">
                                    <label htmlFor="filename" className="text-xs font-medium text-muted-foreground ml-1">
                                        {type === 'folder' ? 'Folder Name' : 'Filename (with extension)'}
                                    </label>
                                    <Input
                                        id="filename"
                                        placeholder={type === 'folder' ? "e.g., components" : "e.g., script.py, component.tsx"}
                                        value={filename}
                                        onChange={(e) => {
                                            setFilename(e.target.value);
                                            setError('');
                                        }}
                                        autoFocus
                                        className={`font-mono ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                    />
                                    {error && (
                                        <p className="text-[10px] text-red-500 font-medium ml-1 mt-1">
                                            {error}
                                        </p>
                                    )}

                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="ghost" onClick={onClose}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={!filename.trim()}>
                                        {type === 'folder' ? 'Create Folder' : 'Create File'}
                                    </Button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
