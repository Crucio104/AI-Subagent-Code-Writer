import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Code, FileText, Image, Layout, Globe, ExternalLink, MoreHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileNode {
    [key: string]: string | FileNode;
}

interface FileExplorerProps {
    files: FileNode;
    onFileSelect: (path: string, content: string) => void;
    basePath?: string;
    onContextMenu?: (path: string, type: 'file' | 'folder', e: React.MouseEvent) => void;
    onActionMenu?: (path: string, e: React.MouseEvent) => void;
    onMoveItem?: (sourcePath: string, targetPath: string) => void;
}

const getFileIcon = (filename: string) => {
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return <Code className="w-4 h-4 text-blue-400" />;
    if (filename.endsWith('.css')) return <Layout className="w-4 h-4 text-sky-400" />;
    if (filename.endsWith('.html')) return <Globe className="w-4 h-4 text-orange-400" />;
    if (filename.endsWith('.png') || filename.endsWith('.jpg')) return <Image className="w-4 h-4 text-purple-400" />;
    if (filename.endsWith('.json')) return <FileText className="w-4 h-4 text-yellow-400" />;
    return <File className="w-4 h-4 text-gray-400" />;
};

const FileItem = ({ name, content, path, onSelect, onContextMenu, onAction }: { name: string, content: string, path: string, onSelect: (p: string, c: string) => void, onContextMenu?: (path: string, type: 'file' | 'folder', e: React.MouseEvent) => void, onAction?: (path: string, e: React.MouseEvent) => void }) => {
    return (
        <div className="group flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
            draggable
            onDragStart={(e) => {
                e.dataTransfer.setData('application/json', JSON.stringify({ path, type: 'file' }));
                e.dataTransfer.effectAllowed = 'move';
            }}
            onClick={(e) => {
                e.stopPropagation();
                console.log('FileItem clicked:', path);
                onSelect(path, content);
            }}
            onContextMenu={(e) => {
                if (onContextMenu) {
                    onContextMenu(path, 'file', e);
                }
            }}
        >
            <div className="flex items-center gap-2 overflow-hidden flex-1">
                {getFileIcon(name)}
                <span className="truncate">{name}</span>
            </div>

            <div className="flex items-center">
                {name.endsWith('.html') && (
                    <a
                        href={`http://localhost:8000/preview/${path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded"
                        title="Open Live Preview"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <ExternalLink className="w-3 h-3 text-emerald-400" />
                    </a>
                )}
                <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onAction) onAction(path, e);
                    }}
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

const FolderItem = ({ name, content, path, onSelect, onContextMenu, onAction, onMove }: { name: string, content: FileNode, path: string, onSelect: (p: string, c: string) => void, onContextMenu?: (path: string, type: 'file' | 'folder', e: React.MouseEvent) => void, onAction?: (path: string, e: React.MouseEvent) => void, onMove?: (s: string, t: string) => void }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [isDragOver, setIsDragOver] = useState(false);

    return (
        <div>
            <div
                className={`group flex items-center justify-between py-1 px-2 rounded cursor-pointer text-sm font-medium text-foreground/80 hover:text-foreground transition-colors select-none ${isDragOver ? 'bg-indigo-500/20 ring-1 ring-indigo-500/50' : 'hover:bg-muted/50'}`}
                draggable
                onDragStart={(e) => {
                    e.dataTransfer.setData('application/json', JSON.stringify({ path, type: 'folder' }));
                    e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isDragOver) setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);
                }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragOver(false);
                    const data = e.dataTransfer.getData('application/json');
                    if (data) {
                        try {
                            const { path: sourcePath } = JSON.parse(data);
                            if (sourcePath && sourcePath !== path && !path.startsWith(sourcePath + '/')) {
                                if (onMove) onMove(sourcePath, path);
                            }
                        } catch (err) {
                            console.error('Drop error', err);
                        }
                    }
                }}
                onClick={() => setIsOpen(!isOpen)}
                onContextMenu={(e) => {
                    if (onContextMenu) {
                        onContextMenu(path, 'folder', e);
                    }
                }}
            >
                <div className="flex items-center gap-1 flex-1 overflow-hidden">
                    <span className="opacity-50">
                        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </span>
                    <Folder className="w-4 h-4 text-yellow-500/80" />
                    <span className="truncate">{name}</span>
                </div>
                <button
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded transition-opacity"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onAction) onAction(path, e);
                    }}
                >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-4 border-l border-border/20 pl-1 overflow-hidden"
                    >
                        <FileExplorer files={content} onFileSelect={onSelect} basePath={path} onContextMenu={onContextMenu} onActionMenu={onAction} onMoveItem={onMove} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const FileExplorer = ({ files, onFileSelect, basePath = '', onContextMenu, onActionMenu, onMoveItem }: FileExplorerProps) => {
    // Sort: Folders first, then files
    const sortedKeys = Object.keys(files).sort((a, b) => {
        const isADir = typeof files[a] === 'object';
        const isBDir = typeof files[b] === 'object';
        if (isADir === isBDir) return a.localeCompare(b);
        return isADir ? -1 : 1;
    });

    return (
        <div className="flex flex-col gap-0.5">
            {sortedKeys.map(key => {
                if (key === '.keep') return null;
                const content = files[key];
                const currentPath = basePath ? `${basePath}/${key}` : key;

                if (typeof content === 'string') {
                    return <FileItem key={key} name={key} content={content} path={currentPath} onSelect={onFileSelect} onContextMenu={onContextMenu} onAction={onActionMenu} />;
                } else {
                    return <FolderItem key={key} name={key} content={content} path={currentPath} onSelect={onFileSelect} onContextMenu={onContextMenu} onAction={onActionMenu} onMove={onMoveItem} />;
                }
            })}
        </div>
    );
};
