import { useState } from 'react';
import { ChevronRight, ChevronDown, File, Folder, Code, FileText, Image, Layout, Globe, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FileNode {
    [key: string]: string | FileNode;
}

interface FileExplorerProps {
    files: FileNode;
    onFileSelect: (path: string, content: string) => void;
    basePath?: string;
}

const getFileIcon = (filename: string) => {
    if (filename.endsWith('.tsx') || filename.endsWith('.ts')) return <Code className="w-4 h-4 text-blue-400" />;
    if (filename.endsWith('.css')) return <Layout className="w-4 h-4 text-sky-400" />;
    if (filename.endsWith('.html')) return <Globe className="w-4 h-4 text-orange-400" />;
    if (filename.endsWith('.png') || filename.endsWith('.jpg')) return <Image className="w-4 h-4 text-purple-400" />;
    if (filename.endsWith('.json')) return <FileText className="w-4 h-4 text-yellow-400" />;
    return <File className="w-4 h-4 text-gray-400" />;
};

const FileItem = ({ name, content, path, onSelect }: { name: string, content: string, path: string, onSelect: (p: string, c: string) => void }) => {
    return (
        <div className="group flex items-center justify-between py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={(e) => {
                e.stopPropagation();
                console.log('FileItem clicked:', path);
                onSelect(path, content);
            }}>
            <div className="flex items-center gap-2 overflow-hidden">
                {getFileIcon(name)}
                <span className="truncate">{name}</span>
            </div>
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
        </div>
    );
};

const FolderItem = ({ name, content, path, onSelect }: { name: string, content: FileNode, path: string, onSelect: (p: string, c: string) => void }) => {
    const [isOpen, setIsOpen] = useState(true);

    return (
        <div>
            <div
                className="flex items-center gap-1 py-1 px-2 hover:bg-muted/50 rounded cursor-pointer text-sm font-medium text-foreground/80 hover:text-foreground transition-colors select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <span className="opacity-50">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </span>
                <Folder className="w-4 h-4 text-yellow-500/80" />
                <span className="truncate">{name}</span>
            </div>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="ml-4 border-l border-border/20 pl-1 overflow-hidden"
                    >
                        <FileExplorer files={content} onFileSelect={onSelect} basePath={path} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export const FileExplorer = ({ files, onFileSelect, basePath = '' }: FileExplorerProps) => {
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
                const content = files[key];
                const currentPath = basePath ? `${basePath}/${key}` : key;

                if (typeof content === 'string') {
                    return <FileItem key={key} name={key} content={content} path={currentPath} onSelect={onFileSelect} />;
                } else {
                    return <FolderItem key={key} name={key} content={content} path={currentPath} onSelect={onFileSelect} />;
                }
            })}
        </div>
    );
};
