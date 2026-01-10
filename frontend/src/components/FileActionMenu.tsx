import React from 'react';
import Portal from './Portal';
import { Pencil, Copy, Trash2 } from 'lucide-react';

interface FileActionMenuProps {
    isOpen: boolean;
    x: number;
    y: number;
    onClose: () => void;
    onRename: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
}

export const FileActionMenu: React.FC<FileActionMenuProps> = ({
    isOpen,
    x,
    y,
    onClose,
    onRename,
    onDuplicate,
    onDelete,
}) => {
    if (!isOpen) return null;

    return (
        <Portal>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-[999]"
                onClick={onClose}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />

            {/* Menu */}
            <div
                className="fixed z-[1000] min-w-[160px] bg-zinc-950 border border-border rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 overflow-hidden animation-in fade-in zoom-in-95 duration-100"
                style={{ top: y, left: x }}
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={() => { onClose(); onRename(); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                >
                    <Pencil className="w-3.5 h-3.5" />
                    Rename
                </button>
                <button
                    onClick={() => { onClose(); onDuplicate(); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                >
                    <Copy className="w-3.5 h-3.5" />
                    Duplicate
                </button>
                <div className="h-px bg-border/50 my-0.5" />
                <button
                    onClick={() => { onClose(); onDelete(); }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                </button>
            </div>
        </Portal>
    );
};

export default FileActionMenu;
