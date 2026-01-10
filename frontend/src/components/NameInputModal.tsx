import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Pencil, Copy } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface NameInputModalProps {
    isOpen: boolean;
    title: string;
    initialValue: string | (() => string);
    onClose: () => void;
    onSubmit: (value: string) => void;
    mode: 'rename' | 'duplicate';
    isFile?: boolean;
    existingNames?: string[];
}

export const NameInputModal: React.FC<NameInputModalProps> = ({
    isOpen,
    title,
    initialValue,
    onClose,
    onSubmit,
    mode,
    isFile = true,
    existingNames = []
}) => {
    const [value, setValue] = useState('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            setValue(typeof initialValue === 'function' ? initialValue() : initialValue);
            setError('');
        }
    }, [isOpen, initialValue]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;

        const initVal = typeof initialValue === 'function' ? initialValue() : initialValue;
        if (trimmed === initVal && mode === 'rename') {
            onClose();
            return;
        }

        if (existingNames.includes(trimmed)) {
            setError("A file with this name already exists.");
            return;
        }

        if (isFile) {
            const allowed = ['py', 'js', 'ts', 'tsx', 'jsx', 'java', 'c', 'cpp', 'h', 'hpp', 'rs', 'go', 'md', 'txt', 'json', 'html', 'css'];

            // Must have extension
            if (trimmed.indexOf('.') === -1) {
                setError("File name must have an extension.");
                return;
            }

            const ext = trimmed.split('.').pop();
            if (!ext || !allowed.includes(ext.toLowerCase())) {
                setError(`Invalid or unsupported extension: .${ext}`);
                return;
            }
        }

        onSubmit(trimmed);
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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1050]"
                        onClick={onClose}
                    />
                    <div className="fixed inset-0 flex items-center justify-center z-[1100] pointer-events-none">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 10 }}
                            className="bg-card border border-border w-full max-w-sm rounded-xl shadow-xl pointer-events-auto overflow-hidden"
                        >
                            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/20">
                                <div className="flex items-center gap-2 font-semibold">
                                    {mode === 'rename' ? <Pencil className="w-4 h-4 text-blue-500" /> : <Copy className="w-4 h-4 text-green-500" />}
                                    <span>{title}</span>
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
                                    <label htmlFor="nameInput" className="text-xs font-medium text-muted-foreground ml-1">
                                        Name
                                    </label>
                                    <Input
                                        id="nameInput"
                                        value={value}
                                        onChange={(e) => {
                                            setValue(e.target.value);
                                            setError('');
                                        }}
                                        autoFocus
                                        className={`font-mono ${error ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                    />
                                    {error && (
                                        <p className="text-[10px] text-red-500 font-medium ml-1 mt-1">{error}</p>
                                    )}
                                </div>

                                <div className="flex justify-end gap-2 pt-2">
                                    <Button type="button" variant="ghost" onClick={onClose} size="sm">
                                        Cancel
                                    </Button>
                                    <Button type="submit" size="sm">
                                        {mode === 'rename' ? 'Rename' : 'Duplicate'}
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
