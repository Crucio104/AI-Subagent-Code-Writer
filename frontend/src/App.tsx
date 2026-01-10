import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import 'github-markdown-css/github-markdown.css'
import { Button } from './components/ui/button'
import { AgentStatus } from './components/AgentStatus'
import { FileCode, MonitorPlay, ArrowRight, Bot, FolderOpen, X, Copy, Download, Check, Play, ChevronDown, ChevronUp, RefreshCw, Mic, MicOff, Hammer, Plus, FolderPlus, Trash2, Terminal } from 'lucide-react'
import { Terminal as XTerminal } from './components/Terminal';
import type { TerminalRef } from './components/Terminal';
import { cn } from './lib/utils'
import { FileExplorer } from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';
import { CreateFileModal } from './components/CreateFileModal';

import FileActionMenu from './components/FileActionMenu';
import { ConfirmationModal } from './components/ConfirmationModal';
import { NameInputModal } from './components/NameInputModal';
import Portal from './components/Portal';
import { Save, Pencil } from 'lucide-react';

const LANGUAGES = [
  { id: 'Python', name: 'Python', ext: '.py', color: 'bg-blue-500' },
  { id: 'JavaScript', name: 'JavaScript', ext: '.js', color: 'bg-yellow-400' },
  { id: 'TypeScript', name: 'TypeScript', ext: '.ts', color: 'bg-blue-600' },
  { id: 'Java', name: 'Java', ext: '.java', color: 'bg-orange-600' },
  { id: 'C++', name: 'C++', ext: '.cpp', color: 'bg-indigo-600' },
  { id: 'C', name: 'C', ext: '.c', color: 'bg-slate-500' },
  { id: 'Go', name: 'Go', ext: '.go', color: 'bg-cyan-600' },
  { id: 'Rust', name: 'Rust', ext: '.rs', color: 'bg-orange-700' },
] as const;

function LanguageSelector({ value, onChange }: { value: string, onChange: (val: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedLang = LANGUAGES.find(l => l.id === value) || LANGUAGES[0];

  return (
    <div className="relative mb-3 z-50 text-left" ref={containerRef}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-muted p-2 rounded-xl border transition-all duration-200",
          isOpen ? "border-primary/50 bg-muted" : "border-border/40 hover:border-primary/30"
        )}
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-center gap-2.5">
          <div className={cn("w-2 h-2 rounded-full ring-2 ring-opacity-20", selectedLang.color.replace('bg-', 'ring-'), selectedLang.color)} />
          <div className="flex flex-col items-start leading-none">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Language</span>
            <span className="text-xs font-semibold text-foreground mt-0.5">{selectedLang.name}</span>
          </div>
        </div>
        <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform duration-300", isOpen && "rotate-180")} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95, pointerEvents: 'none' }}
            animate={{ opacity: 1, y: 0, scale: 1, pointerEvents: 'auto' }}
            exit={{ opacity: 0, y: -5, scale: 0.95, pointerEvents: 'none' }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 right-0 mt-1.5 p-1 bg-zinc-950 border border-border/50 rounded-xl shadow-xl flex flex-col gap-0.5 overflow-hidden z-[60]"
          >
            {LANGUAGES.map((lang) => (
              <button
                key={lang.id}
                onClick={() => { onChange(lang.id); setIsOpen(false); }}
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-xs font-medium transition-colors",
                  value === lang.id ? "bg-primary/10 text-primary" : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn("w-1.5 h-1.5 rounded-full", lang.color)} />
                <span>{lang.name}</span>
                {value === lang.id && <Check className="w-3 h-3 ml-auto" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface LogItem {
  agent_name: string;
  content: string;
  files?: Record<string, string>;
  status: 'done' | 'working' | 'error';
  error?: string;
}

const socketUrl = 'ws://localhost:8000/generate';

const buildFileTree = (files: { [key: string]: string }) => {
  const root: any = {};
  Object.keys(files).forEach(path => {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const parts = cleanPath.split('/');

    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (i === parts.length - 1) {
        current[part] = files[path];
      } else {
        if (current[part] && typeof current[part] === 'string') {
          return;
        }
        current[part] = current[part] || {};
        current = current[part];
      }
    }
  });
  return root;
};

function App() {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [timeline, setTimeline] = useState<LogItem[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [useLocalLLM, setUseLocalLLM] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'activity' | 'files'>('activity');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const [language, setLanguage] = useState('Python');
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef<TerminalRef>(null);
  const lastTestLogLenRef = useRef(0);



  // Initial load of files
  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const res = await fetch('http://localhost:8000/list-files');
        if (res.ok) {
          const data = await res.json();
          if (data.files) {
            setGeneratedFiles(data.files);
          }
        }
      } catch (e) {
        console.error("Failed to fetch files:", e);
      }
    };
    fetchFiles();
  }, []);

  useEffect(() => {
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  const [openAiKey, setOpenAiKey] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [autoFix, setAutoFix] = useState(false);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isTerminalOpen, setIsTerminalOpen] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createModalType, setCreateModalType] = useState<'file' | 'folder'>('file');
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });
  const plusButtonRef = useRef<HTMLButtonElement>(null);

  const toggleMenu = () => {
    if (isHeaderMenuOpen) {
      setIsHeaderMenuOpen(false);
      return;
    }

    if (plusButtonRef.current) {
      const rect = plusButtonRef.current.getBoundingClientRect();
      // Position to the right of the button
      setMenuPos({
        top: rect.top,
        left: rect.right + 8
      });
      setIsHeaderMenuOpen(true);
    }
  };

  useEffect(() => {
    const handleScroll = () => {
      if (isHeaderMenuOpen) setIsHeaderMenuOpen(false);
    };
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    }
  }, [isHeaderMenuOpen]);


  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number; path: string; type: 'file' | 'folder' | null }>({
    isOpen: false,
    x: 0,
    y: 0,
    path: '',
    type: null
  });

  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.isOpen) setContextMenu({ ...contextMenu, isOpen: false });
    };
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [contextMenu.isOpen]);

  const handleContextMenu = (path: string, type: 'file' | 'folder', e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // Stop bubbling
    setContextMenu({
      isOpen: true,
      x: e.pageX,
      y: e.pageY,
      path: path,
      type: type
    });
  };

  const [creationPath, setCreationPath] = useState('');

  const [actionMenu, setActionMenu] = useState<{ isOpen: boolean; x: number; y: number; path: string }>({
    isOpen: false,
    x: 0,
    y: 0,
    path: ''
  });

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; path: string }>({ isOpen: false, path: '' });
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; path: string }>({ isOpen: false, path: '' });
  const [duplicateModal, setDuplicateModal] = useState<{ isOpen: boolean; path: string }>({ isOpen: false, path: '' });
  const [alertModal, setAlertModal] = useState<{ isOpen: boolean; title: string; message: string }>({ isOpen: false, title: '', message: '' });

  const handleActionMenu = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActionMenu({
      isOpen: true,
      x: e.pageX,
      y: e.pageY,
      path: path
    });
  };

  const handleDelete = async () => {
    try {
      const response = await fetch('http://localhost:8000/delete-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: deleteModal.path })
      });
      if (!response.ok) throw new Error('Delete failed');
      setDeleteModal({ isOpen: false, path: '' });

      const newFiles = { ...generatedFiles };
      Object.keys(newFiles).forEach(k => {
        if (k === deleteModal.path || k.startsWith(deleteModal.path + '/')) {
          delete newFiles[k];
        }
      });
      setGeneratedFiles(newFiles);


      const newOpenFiles = openFiles.filter(f => f !== deleteModal.path && !f.startsWith(deleteModal.path + '/'));
      setOpenFiles(newOpenFiles);


      if (selectedFile === deleteModal.path || selectedFile?.startsWith(deleteModal.path + '/')) {
        setSelectedFile(null);
      }

    } catch (error) {
      console.error("Delete failed", error);
      alert("Failed to delete item: " + error);
    }
  };

  const handleRename = async (newName: string) => {
    const oldPath = renameModal.path;
    const parent = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = parent ? `${parent}/${newName}` : newName;

    try {
      const response = await fetch('http://localhost:8000/rename-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: oldPath, new_path: newPath })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setRenameModal({ isOpen: false, path: '' });

      const newFiles = { ...generatedFiles };

      Object.keys(newFiles).forEach(k => {
        if (k === oldPath) {
          newFiles[newPath] = newFiles[k];
          delete newFiles[k];
        } else if (k.startsWith(oldPath + '/')) {
          const suffix = k.substring(oldPath.length);
          newFiles[newPath + suffix] = newFiles[k];
          delete newFiles[k];
        }
      });
      setGeneratedFiles(newFiles);


      setOpenFiles(prev => prev.map(f => {
        if (f === oldPath) return newPath;
        if (f.startsWith(oldPath + '/')) return newPath + f.substring(oldPath.length);
        return f;
      }));


      if (selectedFile === oldPath) setSelectedFile(newPath);
      else if (selectedFile?.startsWith(oldPath + '/')) {
        setSelectedFile(newPath + selectedFile.substring(oldPath.length));
      }

    } catch (error) {
      alert(error);
    }
  };

  const handleMoveItem = async (sourcePath: string, targetPath: string) => {
    // Calculate new path
    const basename = sourcePath.split('/').pop();
    if (!basename) return;
    const newPath = targetPath ? `${targetPath}/${basename}` : basename;

    if (newPath === sourcePath) return;

    try {
      const response = await fetch('http://localhost:8000/rename-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ old_path: sourcePath, new_path: newPath })
      });

      if (!response.ok) {
        // HTTP error (500 etc)
        const data = await response.json();
        console.error("Move error:", data);
        setAlertModal({
          isOpen: true,
          title: "Move Failed",
          message: data.error || "An unknown error occurred while moving the item."
        });
        return;
      }

      const data = await response.json();
      if (data.error) {
        console.error("Move business error:", data);
        if (data.error === "Destination already exists") {
          setAlertModal({
            isOpen: true,
            title: "Cannot Move Item",
            message: `A file or folder with the name '${basename}' already exists in the destination folder. The item remains in its original location.`
          });
        } else {
          setAlertModal({
            isOpen: true,
            title: "Move Failed",
            message: data.error || "An unknown error occurred while moving the item."
          });
        }
        return;
      }

      // Update local state
      const newFiles = { ...generatedFiles };

      Object.keys(newFiles).forEach(k => {
        if (k === sourcePath) {
          newFiles[newPath] = newFiles[k];
          delete newFiles[k];
        } else if (k.startsWith(sourcePath + '/')) {
          const suffix = k.substring(sourcePath.length);
          newFiles[newPath + suffix] = newFiles[k];
          delete newFiles[k];
        }
      });
      setGeneratedFiles(newFiles);

      // Update refs
      setOpenFiles(prev => prev.map(f => {
        if (f === sourcePath) return newPath;
        if (f.startsWith(sourcePath + '/')) return newPath + f.substring(sourcePath.length);
        return f;
      }));

      if (selectedFile === sourcePath) setSelectedFile(newPath);
      else if (selectedFile && selectedFile.startsWith(sourcePath + '/')) {
        setSelectedFile(newPath + selectedFile.substring(sourcePath.length));
      }

    } catch (e) {
      console.error("Move exception:", e);
    }
  };

  const handleDuplicate = async (newName: string) => {
    const sourcePath = duplicateModal.path;
    const parent = sourcePath.substring(0, sourcePath.lastIndexOf('/'));
    const newPath = parent ? `${parent}/${newName}` : newName;

    try {
      const response = await fetch('http://localhost:8000/duplicate-item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_path: sourcePath, new_path: newPath })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setDuplicateModal({ isOpen: false, path: '' });

      const newFiles = { ...generatedFiles };

      Object.keys(newFiles).forEach(k => {
        if (k === sourcePath) {
          newFiles[newPath] = newFiles[k];
        } else if (k.startsWith(sourcePath + '/')) {
          const suffix = k.substring(sourcePath.length);
          newFiles[newPath + suffix] = newFiles[k];
        }
      });
      setGeneratedFiles(newFiles);

    } catch (error) {
      alert(error);
    }
  };

  const [deleteAllModal, setDeleteAllModal] = useState(false);

  const handleDeleteAll = async () => {
    try {
      const response = await fetch('http://localhost:8000/delete-all', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to delete all');
      setGeneratedFiles({});
      setOpenFiles([]);
      setSelectedFile(null);
      setDeleteAllModal(false);
      // Clear all tabs
      // Since tabManager is not state, we assume tabs are cleared by openFiles change or we need to clear them if managed in state?
      // Looking at tabManager usage, it seems to be just a helper or derived.
      // Re-reading code: tabManager was used in FileExplorer select.
    } catch (e) {
      console.error(e);
      alert("Failed to delete all");
    }
  };

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert("Browser does not support speech recognition. Please use Chrome or Edge.");
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = 'it-IT';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        alert("Microphone access denied. Please allow microphone permissions.");
      } else {
        alert("Errore riconoscimento vocale: " + event.error);
      }
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setPrompt(prev => prev + (prev ? " " : "") + transcript);
    };
    try {
      recognition.start();
    } catch (e) {
      alert("Errore nell'avvio del riconoscimento vocale: " + e);
    }
  };

  const startGeneration = () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setTimeline([]);
    // Do not clear files to prevent flicker and loss of context

    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket(socketUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({
        prompt,
        use_local_llm: useLocalLLM,
        api_key: !useLocalLLM ? openAiKey : undefined,
        auto_fix: autoFix,
        language: language
      }));
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      fetch('http://127.0.0.1:8000/')
        .then(res => res.json())
        .then(data => alert(`WS Failed but HTTP OK: ${data.message}`))
        .catch(err => alert(`Fatal: Cannot reach Backend entirely. Details: ${err}`));
      setIsProcessing(false);
    };

    lastTestLogLenRef.current = 0;

    ws.onmessage = (event) => {
      if (ws !== wsRef.current) return;
      const data = JSON.parse(event.data);

      if (data.status === 'done') {
        setIsProcessing(false);
        ws.close();
        return;
      }

      if (data.error) {
        alert("Error: " + data.error);
        setIsProcessing(false);
        ws.close();
        return;
      }

      if (data.agent_name === 'Tester' && data.files && data.files["TEST_RESULTS.log"]) {
        const fullLog = data.files["TEST_RESULTS.log"];
        const newContent = fullLog.slice(lastTestLogLenRef.current);
        if (newContent) {
          const formatted = newContent.replace(/\n/g, '\r\n');
          terminalRef.current?.writeToTerminal(formatted);
          lastTestLogLenRef.current = fullLog.length;
        }
      }

      setTimeline(prev => {
        const newTimeline = [...prev];
        const lastItem = newTimeline[newTimeline.length - 1];

        if (data.clear_history) {
          return [{
            agent_name: data.agent_name,
            content: data.content,
            status: data.is_error ? 'error' : 'working'
          }];
        }

        if (lastItem && lastItem.agent_name === data.agent_name && lastItem.status === 'working') {
          lastItem.content = data.content;
          if (data.is_error) {
            lastItem.status = 'error';
          } else if (data.content.startsWith("Done!")) {
            lastItem.status = 'done';
          }
          return [...newTimeline];
        }

        return [
          ...prev.map(item => ({ ...item, status: item.status === 'working' ? 'done' as const : item.status })),
          {
            agent_name: data.agent_name,
            content: data.content,
            status: data.is_error ? 'error' : 'working'
          }
        ];
      });

      if (data.files) {
        setGeneratedFiles(prev => ({ ...prev, ...data.files }));
        const newFiles = Object.keys(data.files);
        setOpenFiles(prev => Array.from(new Set([...prev, ...newFiles])));

        if (newFiles.length > 0) {
          setSelectedFile(newFiles[0]);
        }
      }
    };

    ws.onclose = () => {
      if (ws === wsRef.current) {
        setIsProcessing(false);
        setTimeline(prev => prev.map(item => ({ ...item, status: item.status === 'working' ? 'done' as const : item.status })));
      }
    };
  };

  const closeFile = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    const newOpen = openFiles.filter(f => f !== filename);
    setOpenFiles(newOpen);
    if (selectedFile === filename) {
      setSelectedFile(newOpen.length > 0 ? newOpen[newOpen.length - 1] : null);
    }
  };

  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const handleCopy = (e: React.MouseEvent, filename: string, content: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(content);
    setCopiedFile(filename);
    setTimeout(() => setCopiedFile(null), 2000);
  };

  const handleDownload = (e: React.MouseEvent, filename: string, content: string) => {
    e.stopPropagation();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const [isRunning, setIsRunning] = useState(false);

  const handleRun = async (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    setIsRunning(true);
    setIsTerminalOpen(true);

    if (terminalRef.current) {
      terminalRef.current.sendText('\x03');
      setTimeout(() => {
        const ext = filename.split('.').pop();
        const dir = filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/')) : '.';
        const fileBase = filename.split('/').pop() || filename;
        const name = fileBase.split('.')[0];

        const WORKSPACE_BASE = '/app/workspace';
        const absDir = dir === '.' ? WORKSPACE_BASE : `${WORKSPACE_BASE}/${dir}`;

        let cmd = '';
        const cdCmd = `cd ${absDir} &&`;

        switch (ext) {
          case 'py':
            cmd = `${cdCmd} python3 ${absDir}/${fileBase}`;
            break;
          case 'js':
          case 'ts':
            cmd = `echo "Execution disabled for JavaScript/TypeScript files."`;
            break;
          case 'cpp':
          case 'cc':
            cmd = `${cdCmd} g++ ${absDir}/*.${ext} -o ${absDir}/${name} && ${absDir}/${name}`;
            break;
          case 'c':
            cmd = `${cdCmd} gcc ${absDir}/*.c -o ${absDir}/${name} && ${absDir}/${name}`;
            break;
          case 'java':
            cmd = `${cdCmd} javac ${absDir}/*.java && java -cp ${absDir} ${name}`;
            break;
          case 'go':
            cmd = `${cdCmd} (test -f go.mod || (go mod init myproject && go mod tidy)) && go run .`;
            break;
          case 'rs':
            cmd = `${cdCmd} rustc -A warnings ${absDir}/${fileBase} -o ${absDir}/${name} && ${absDir}/${name}`;
            break;
          default:
            cmd = `echo "No execution logic for .${ext} files"`;
        }

        terminalRef.current?.sendText(`${cmd}\r`);
      }, 50);
    }
    setTimeout(() => setIsRunning(false), 300);
  };

  const handleBuild = (e: React.MouseEvent, filename: string) => {
    e.stopPropagation();
    if (isRunning || !terminalRef.current) return;

    setIsRunning(true);
    setIsTerminalOpen(true);
    terminalRef.current.sendText('\x03');
    setTimeout(() => {
      const ext = filename.split('.').pop();
      const dir = filename.includes('/') ? filename.substring(0, filename.lastIndexOf('/')) : '.';
      const fileBase = filename.split('/').pop() || filename;
      const name = fileBase.split('.')[0];

      const WORKSPACE_BASE = '/app/workspace';
      const absDir = dir === '.' ? WORKSPACE_BASE : `${WORKSPACE_BASE}/${dir}`;

      let cmd = '';
      const cdCmd = `cd ${absDir} &&`;

      switch (ext) {
        case 'cpp':
        case 'cc':
          cmd = `${cdCmd} g++ ${absDir}/*.${ext} -o ${absDir}/${name} && echo "Build Complete: ${absDir}/${name}"`;
          break;
        case 'c':
          cmd = `${cdCmd} gcc ${absDir}/*.c -o ${absDir}/${name} && echo "Build Complete: ${absDir}/${name}"`;
          break;
        case 'java':
          cmd = `${cdCmd} javac ${absDir}/*.java && echo "Build Complete: ${absDir}/${name}.class"`;
          break;
        case 'go':
          cmd = `${cdCmd} (test -f go.mod || (go mod init myproject && go mod tidy)) && go build -o ${absDir}/${name} . && echo "Build Complete: ${absDir}/${name}"`;
          break;
        case 'rs':
          cmd = `${cdCmd} rustc -A warnings ${absDir}/${fileBase} -o ${absDir}/${name} && echo "Build Complete: ${absDir}/${name}"`;
          break;
        default:
          cmd = `echo "No build step for .${ext} files"`;
      }

      terminalRef.current?.sendText(`${cmd}\r`);
    }, 50);
    setTimeout(() => setIsRunning(false), 300);
  };



  const handleSave = async (filename: string, content: string) => {
    try {
      const response = await fetch('http://localhost:8000/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, content }),
      });
      const data = await response.json();
      if (data.error) {
        alert('Error saving file: ' + data.error);
      } else {
        console.log('Saved successfully');
      }
    } catch (e) {
      alert('Network error saving file: ' + e);
    }
  };

  const handleCreateFile = (filename: string) => {
    // 1. Add to generatedFiles (empty content)
    setGeneratedFiles(prev => ({
      ...prev,
      [filename]: ''
    }));

    // 2. Add to openFiles if not present
    if (!openFiles.includes(filename)) {
      setOpenFiles(prev => [...prev, filename]);
    }

    // 3. Select it
    setSelectedFile(filename);

    // 4. Ideally save empty file to backend so it exists for build/run
    handleSave(filename, "");
  };

  const handleCreateFolder = async (folderName: string) => {
    try {
      const response = await fetch('http://localhost:8000/create-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folderName }),
      });
      const data = await response.json();

      if (data.error) {
        alert('Error creating folder: ' + data.error);
      } else {
        // Update generatedFiles to include the .keep file so it shows in explorer
        setGeneratedFiles(prev => ({
          ...prev,
          [`${folderName}/.keep`]: ''
        }));
      }
    } catch (e) {
      alert('Network error creating folder: ' + e);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground font-sans flex flex-col overflow-hidden transition-colors duration-300">
      <div className="flex-1 flex min-h-0">
        <aside className="w-80 lg:w-96 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border/50 relative z-[100]">
            <div className="flex items-center justify-between mb-4 relative z-50">
              <h2 className="text-xl font-black tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                OpenSyntax
              </h2>
              <div className="relative">
                <button
                  ref={plusButtonRef}
                  onClick={toggleMenu}
                  className={cn(
                    "p-1 rounded-md transition-colors",
                    isHeaderMenuOpen ? "bg-muted text-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  title="New..."
                >
                  <Plus className="w-4 h-4" />
                </button>

                {isHeaderMenuOpen && (
                  <Portal>
                    <div
                      className="fixed inset-0 z-[99]"
                      onClick={() => setIsHeaderMenuOpen(false)}
                      style={{ backgroundColor: 'transparent' }}
                    />
                    <div
                      className="fixed w-48 bg-zinc-950 border border-border rounded-xl shadow-2xl z-[100] overflow-hidden"
                      style={{
                        top: menuPos.top,
                        left: menuPos.left,
                      }}
                    >
                      <div className="p-1 flex flex-col gap-0.5">
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            setCreationPath('');
                            setCreateModalType('file');
                            setIsCreateModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                        >
                          <FileCode className="w-3.5 h-3.5" />
                          New File...
                        </button>
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            setCreationPath('');
                            setCreateModalType('folder');
                            setIsCreateModalOpen(true);
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                        >
                          <FolderPlus className="w-3.5 h-3.5" />
                          New Folder...
                        </button>
                        <button
                          onClick={() => {
                            setIsHeaderMenuOpen(false);
                            if (!isTerminalOpen) {
                              setIsTerminalOpen(true);
                            }
                          }}
                          className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                          New Terminal
                        </button>
                      </div>
                    </div>
                  </Portal>
                )}
              </div>
            </div>

            {/* Context Menu Portal */}
            {contextMenu.isOpen && (
              <Portal>
                <div
                  className="fixed z-[9999] min-w-[160px] bg-zinc-950 border border-border rounded-xl shadow-2xl p-1 flex flex-col gap-0.5 overflow-hidden animation-in fade-in zoom-in-95 duration-100"
                  style={{ top: contextMenu.y, left: contextMenu.x }}
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                >
                  <button
                    onClick={() => {
                      const isFile = contextMenu.type === 'file';
                      // If it's a file, create in its parent. If folder, create in it.
                      // If root (path empty), create in root.
                      const parentPath = isFile && contextMenu.path.includes('/')
                        ? contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'))
                        : isFile ? '' : contextMenu.path;

                      setCreationPath(parentPath);
                      setCreateModalType('file');
                      setIsCreateModalOpen(true);
                      setContextMenu({ ...contextMenu, isOpen: false });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    New File...
                  </button>
                  <button
                    onClick={() => {
                      const isFile = contextMenu.type === 'file';
                      const parentPath = isFile && contextMenu.path.includes('/')
                        ? contextMenu.path.substring(0, contextMenu.path.lastIndexOf('/'))
                        : isFile ? '' : contextMenu.path;

                      setCreationPath(parentPath);
                      setCreateModalType('folder');
                      setIsCreateModalOpen(true);
                      setContextMenu({ ...contextMenu, isOpen: false });
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    New Folder...
                  </button>

                  {contextMenu.path && (
                    <>
                      <div className="h-px bg-border/50 my-0.5" />

                      <button
                        onClick={() => {
                          setRenameModal({ isOpen: true, path: contextMenu.path });
                          setContextMenu({ ...contextMenu, isOpen: false });
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Rename
                      </button>
                      <button
                        onClick={() => {
                          setDuplicateModal({ isOpen: true, path: contextMenu.path });
                          setContextMenu({ ...contextMenu, isOpen: false });
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors w-full text-left"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        Duplicate
                      </button>
                      <button
                        onClick={() => {
                          setDeleteModal({ isOpen: true, path: contextMenu.path });
                          setContextMenu({ ...contextMenu, isOpen: false });
                        }}
                        className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors w-full text-left"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
                {/* Backdrop to close */}
                <div
                  className="fixed inset-0 z-[9998]"
                  onClick={() => setContextMenu({ ...contextMenu, isOpen: false })}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ ...contextMenu, isOpen: false }); }}
                />
              </Portal>
            )}

            <div className="space-y-3">
              <div className="flex p-1 bg-muted/50 rounded-2xl relative isolate">
                <div className="absolute inset-1 pointer-events-none">
                  <AnimatePresence>
                    {useLocalLLM ? (
                      <motion.div
                        layoutId="llm-toggle-indicator"
                        className="absolute left-0 top-0 bottom-0 w-1/2 bg-secondary/80 shadow-sm rounded-xl border border-border/50"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    ) : (
                      <motion.div
                        layoutId="llm-toggle-indicator"
                        className="absolute right-0 top-0 bottom-0 w-1/2 bg-secondary/80 shadow-sm rounded-xl border border-border/50"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </AnimatePresence>
                </div>
                <button
                  onClick={() => setUseLocalLLM(true)}
                  className={cn(
                    "relative z-10 flex-1 text-xs font-medium py-1.5 rounded-xl transition-all duration-300",
                    useLocalLLM ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Local LLM
                </button>
                <div className={cn("relative z-10 flex-1 flex items-center rounded-xl overflow-hidden transition-all duration-300", !useLocalLLM ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}>
                  <button onClick={() => setUseLocalLLM(false)} className="flex-1 text-xs font-medium py-1.5 h-full text-center hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                    OpenAI API
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setUseLocalLLM(false); setShowKeyInput(!showKeyInput); }} className="px-2 py-1.5 h-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors border-l border-border/20">
                    <ChevronDown className={cn("w-3 h-3 transition-transform", showKeyInput && "rotate-180")} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {showKeyInput && !useLocalLLM && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="pb-2">
                      <input type="password" placeholder="sk-..." value={openAiKey} onChange={(e) => setOpenAiKey(e.target.value)} className="w-full text-xs p-2 rounded-xl bg-muted/30 border border-border/50 focus:outline-none focus:border-primary/50 transition-colors font-mono" />
                    </div>
                  </motion.div>

                )}
              </AnimatePresence>

              <LanguageSelector value={language} onChange={setLanguage} />

              <div className="relative">
                <textarea
                  className="w-full min-h-[160px] p-4 pr-12 rounded-2xl border border-input bg-white text-black dark:bg-[#000000] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none placeholder:text-muted-foreground/50 transition-all font-mono custom-scrollbar shadow-sm"
                  placeholder="Describe what you want to build..."
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); startGeneration(); } }}
                />
                <button
                  type="button"
                  onClick={startListening}
                  className={cn("absolute bottom-3 right-3 p-2 rounded-xl transition-all duration-300 z-10 cursor-pointer hover:scale-110 active:scale-95", isListening ? "bg-red-500/20 text-red-500 animate-pulse" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground")}
                  title="Voice Input"
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>

              <div className="flex gap-2 items-stretch">
                <Button
                  onClick={() => setAutoFix(!autoFix)}
                  variant={autoFix ? "default" : "outline"}
                  className={cn(
                    "group px-4 gap-2 border shadow-sm transition-all duration-300",
                    !autoFix && "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/60 hover:text-foreground hover:border-border"
                  )}
                  title={autoFix ? "Auto-Fix: Enabled (Retry Loop)" : "Auto-Fix: Disabled (Single Pass)"}
                >
                  <RefreshCw className={cn("w-4 h-4 transition-transform duration-500", autoFix ? "rotate-180" : "group-hover:rotate-90")} />
                  <span className="font-semibold tracking-wide">Auto-fix</span>
                </Button>

                <Button className="flex-1 justify-between group transition-colors shadow-sm" onClick={startGeneration} disabled={!prompt}>
                  <span className="font-semibold tracking-wide">{isProcessing ? "Restart Generation" : "Generate Code"}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>

                {isProcessing && (
                  <Button variant="destructive" size="icon" className="aspect-square rounded-xl shadow-sm" onClick={() => { if (wsRef.current) wsRef.current.close(); setIsProcessing(false); }} title="Stop Generation">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 border-b border-border/40 bg-muted/10">
            <div className="flex p-1 bg-muted/50 rounded-2xl relative isolate">
              <div className="absolute inset-1 pointer-events-none">
                <AnimatePresence>
                  {sidebarTab === 'activity' ? (
                    <motion.div layoutId="sidebar-tab-indicator" className="absolute left-0 top-0 bottom-0 w-1/2 bg-secondary/80 shadow-sm rounded-xl border border-border/50" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                  ) : (
                    <motion.div layoutId="sidebar-tab-indicator" className="absolute right-0 top-0 bottom-0 w-1/2 bg-secondary/80 shadow-sm rounded-xl border border-border/50" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                  )}
                </AnimatePresence>
              </div>
              <button onClick={() => setSidebarTab('activity')} className={cn("relative z-10 flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl transition-colors duration-200", sidebarTab === 'activity' ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}>
                <Bot className={cn("w-4 h-4", sidebarTab === 'activity' ? "text-foreground" : "opacity-70")} />
                Activity
              </button>
              <button onClick={() => setSidebarTab('files')} className={cn("relative z-10 flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl transition-colors duration-200", sidebarTab === 'files' ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground")}>
                <FolderOpen className={cn("w-4 h-4", sidebarTab === 'files' ? "text-foreground" : "opacity-70")} />
                Files
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {sidebarTab === 'activity' ? (
              <div className="flex-1 min-h-0">
                <AgentStatus timeline={timeline} />
              </div>
            ) : (
              <>
                <div
                  className="flex-1 overflow-y-auto min-h-0 custom-scrollbar p-2 transition-colors duration-200"
                  onContextMenu={(e) => {
                    e.preventDefault();
                    handleContextMenu('', 'folder', e);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.dataTransfer.dropEffect = 'move';
                    e.currentTarget.classList.add('bg-muted/10');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('bg-muted/10');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.currentTarget.classList.remove('bg-muted/10');
                    const data = e.dataTransfer.getData('application/json');
                    if (data) {
                      try {
                        const { path: sourcePath } = JSON.parse(data);
                        // Drop on root means target is empty string
                        // Check if source path is valid
                        if (sourcePath) {
                          handleMoveItem(sourcePath, '');
                        }
                      } catch (err) {
                      }
                    }
                  }}
                >
                  {Object.keys(generatedFiles).length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center pointer-events-none">
                      <p className="text-sm">No files in workspace</p>
                      <p className="text-xs mt-1 opacity-50">Create a file or run an agent</p>
                    </div>
                  ) : (
                    <FileExplorer
                      files={buildFileTree(generatedFiles)}
                      onFileSelect={(path) => {
                        const fullPathKey = Object.keys(generatedFiles).find(k => {
                          return k === path || k.endsWith(path);
                        });
                        if (fullPathKey || path) {
                          const target = fullPathKey || path;
                          setSelectedFile(target);
                          if (!openFiles.includes(target)) {
                            setOpenFiles(prev => [...prev, target]);
                          }
                        }
                      }}
                      onContextMenu={(path, type, e) => handleContextMenu(path, type, e)}
                      onActionMenu={handleActionMenu}
                      onMoveItem={handleMoveItem}
                    />
                  )}

                </div>
                <div className="p-2 border-t border-border flex gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 gap-2 border-primary/20 hover:bg-primary/10 hover:text-primary transition-colors h-8 text-xs"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = 'http://localhost:8000/download-project';
                      link.download = 'project_files.zip';
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                  >
                    <Download className="w-3 h-3" />
                    Download
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-destructive/20 hover:bg-destructive/10 hover:text-destructive transition-colors h-8 text-xs px-3"
                    onClick={() => setDeleteAllModal(true)}
                    title="Delete All Files"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </aside>

        <main className="flex-1 bg-muted/10 flex flex-col min-w-0">
          <div className="h-12 border-b border-border bg-background flex items-center px-4 gap-2 overflow-x-auto scrollbar-hide shrink-0">
            <AnimatePresence initial={false} mode="popLayout">
              {openFiles.length === 0 ? (
                null
              ) : (
                openFiles.map(filename => (
                  <motion.button
                    layout
                    initial={{ opacity: 0, scale: 0.8, x: -20 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, width: 0, padding: 0, margin: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    key={filename}
                    onClick={() => setSelectedFile(filename)}
                    className={cn("h-8 pl-3 pr-1.5 text-xs font-medium rounded-xl flex items-center gap-2 transition-all shrink-0 group relative hover:text-foreground", selectedFile === filename ? "text-foreground font-semibold" : "text-muted-foreground")}
                  >
                    {selectedFile === filename && (
                      <motion.div layoutId="active-file-tab" className="absolute inset-0 bg-secondary/80 rounded-xl shadow-sm z-0 border border-border/50" transition={{ type: "spring", stiffness: 500, damping: 30 }} />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{filename}</span>
                    </span>
                    <div onClick={(e) => closeFile(e, filename)} className={cn("relative z-10 p-0.5 rounded-full hover:bg-black/20 transition-colors opacity-0 group-hover:opacity-100", selectedFile === filename && "opacity-100 hover:bg-white/20")}>
                      <X className="w-3 h-3" />
                    </div>
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>

          <div className={cn("flex-1 relative bg-background custom-scrollbar flex flex-col", (selectedFile?.endsWith('.md') || !selectedFile) ? "overflow-auto" : "overflow-hidden")}>
            {selectedFile ? (
              <div className={cn("flex flex-col", (selectedFile?.endsWith('.md') || !selectedFile) ? "min-h-full" : "h-full")}>
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-6 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">{selectedFile}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleSave(selectedFile, generatedFiles[selectedFile])} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Save (Ctrl+S)">
                      <Save className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={(e) => handleCopy(e, selectedFile, generatedFiles[selectedFile])} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Copy content">
                      {copiedFile === selectedFile ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={(e) => handleDownload(e, selectedFile, generatedFiles[selectedFile])} className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors" title="Download file">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {['cpp', 'cc', 'c', 'java', 'go', 'rs'].some(ext => selectedFile.endsWith('.' + ext)) && (
                      <button onClick={(e) => handleBuild(e, selectedFile)} className={cn("p-1.5 hover:bg-amber-500/10 rounded-md text-muted-foreground hover:text-amber-500 transition-colors", isRunning && "animate-pulse")} title="Build Only" disabled={isRunning}>
                        <Hammer className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {['py', 'cpp', 'cc', 'c', 'java', 'go', 'rs'].some(ext => selectedFile.endsWith('.' + ext)) && (
                      <button onClick={(e) => handleRun(e, selectedFile)} className={cn("p-1.5 hover:bg-emerald-500/10 rounded-md text-muted-foreground hover:text-emerald-500 transition-colors", isRunning && "animate-pulse text-emerald-500")} title="Run / Compile & Run" disabled={isRunning}>
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
                {selectedFile.endsWith('.md') ? (
                  <div className="p-6 markdown-body text-sm bg-transparent">
                    <ReactMarkdown>{generatedFiles[selectedFile] || ''}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0">
                    <CodeEditor
                      filename={selectedFile}
                      content={generatedFiles[selectedFile] || ''}
                      onChange={(value) => {
                        setGeneratedFiles(prev => ({
                          ...prev,
                          [selectedFile]: value || ''
                        }));
                      }}
                      onSave={() => handleSave(selectedFile, generatedFiles[selectedFile])}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground/40 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/20 flex items-center justify-center">
                  <MonitorPlay className="w-8 h-8" />
                </div>
                <p className="text-sm font-medium">No file selected</p>
              </div>
            )}
          </div>

          {isTerminalOpen && (
            <TerminalPanel
              title="System Terminal"
              onClose={() => setIsTerminalOpen(false)}
              height={terminalHeight}
              onHeightChange={setTerminalHeight}
              xtermRef={terminalRef}
            />
          )}

          <CreateFileModal
            isOpen={isCreateModalOpen}
            onClose={() => setIsCreateModalOpen(false)}
            onCreate={(name) => {
              const fullName = creationPath ? `${creationPath}/${name}` : name;
              if (createModalType === 'file') {
                handleCreateFile(fullName);
              } else {
                handleCreateFolder(fullName);
              }
            }}
            type={createModalType}
            currentPath={creationPath}
            existingPaths={Object.keys(generatedFiles)}
          />

          <FileActionMenu
            isOpen={actionMenu.isOpen}
            x={actionMenu.x}
            y={actionMenu.y}
            onClose={() => setActionMenu({ ...actionMenu, isOpen: false })}
            onRename={() => setRenameModal({ isOpen: true, path: actionMenu.path })}
            onDuplicate={() => setDuplicateModal({ isOpen: true, path: actionMenu.path })}
            onDelete={() => setDeleteModal({ isOpen: true, path: actionMenu.path })}
          />

          <ConfirmationModal
            isOpen={deleteAllModal}
            title="Delete All Files"
            message="Are you sure you want to delete ALL files and folders in the workspace? This action cannot be undone."
            confirmLabel="Delete All"
            onClose={() => setDeleteAllModal(false)}
            onConfirm={handleDeleteAll}
            isDestructive
          />

          <ConfirmationModal
            isOpen={deleteModal.isOpen}
            title="Delete Item"
            message={`Are you sure you want to delete '${deleteModal.path}'? This action cannot be undone.`}
            confirmLabel="Delete"
            isDestructive
            onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
            onConfirm={handleDelete}
          />

          <ConfirmationModal
            isOpen={alertModal.isOpen}
            title={alertModal.title}
            message={alertModal.message}
            confirmLabel="OK"
            onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
            onConfirm={() => setAlertModal({ ...alertModal, isOpen: false })}
            isAlert
          />

          <NameInputModal
            isOpen={renameModal.isOpen}
            title="Rename Item"
            initialValue={renameModal.path.split('/').pop() || ''}
            mode="rename"
            isFile={(() => {
              // Heuristic: if it has an extension that we know, or assume file if simple file node (hard to know for sure without checking fileTree)
              // But typically renames keep type.
              // We can check if extension is present in current name.
              return (renameModal.path.split('/').pop() || '').includes('.');
            })()}
            onClose={() => setRenameModal({ ...renameModal, isOpen: false })}
            onSubmit={handleRename}
            existingNames={
              Object.keys(generatedFiles)
                .map(p => {
                  const parent = renameModal.path.includes('/') ? renameModal.path.substring(0, renameModal.path.lastIndexOf('/')) : '';
                  if (p.startsWith(parent + '/') || (parent === '' && !p.includes('/'))) {
                    // sibling
                    // extract basename
                    const parts = p.split('/');
                    return parts[parts.length - 1];
                  }
                  if (parent === '' && !p.includes('/')) return p;
                  return null;
                })
                .filter((p): p is string => p !== null)
            }
          />

          <NameInputModal
            isOpen={duplicateModal.isOpen}
            title="Duplicate Item"
            initialValue={() => {
              const name = duplicateModal.path.split('/').pop() || '';
              const lastDotIndex = name.lastIndexOf('.');
              if (lastDotIndex > 0) {
                const base = name.substring(0, lastDotIndex);
                const ext = name.substring(lastDotIndex);
                return `${base}_copy${ext}`;
              }
              return name + '_copy';
            }}
            mode="duplicate"
            isFile={(duplicateModal.path.split('/').pop() || '').includes('.')} // Simple heuristic
            onClose={() => setDuplicateModal({ ...duplicateModal, isOpen: false })}
            onSubmit={handleDuplicate}
            existingNames={
              Object.keys(generatedFiles)
                .map(p => {
                  const parent = duplicateModal.path.includes('/') ? duplicateModal.path.substring(0, duplicateModal.path.lastIndexOf('/')) : '';
                  const pParent = p.includes('/') ? p.substring(0, p.lastIndexOf('/')) : '';
                  if (pParent === parent) return p.split('/').pop() || '';
                  return null;
                })
                .filter((p): p is string => p !== null)
            }
          />
        </main>
      </div >
    </div >
  )
}

interface TerminalPanelProps {
  title: string;
  onClose: () => void;
  height: number;
  onHeightChange: (h: number) => void;
  isRunOutput?: boolean;
  xtermRef?: React.RefObject<TerminalRef | null>;
}

function TerminalPanel({ title, height, onHeightChange, isRunOutput, xtermRef, onClose }: TerminalPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const isResizingRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  };

  useEffect(() => {
    let rafId: number | null = null;
    let targetHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;

      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 60 && newHeight < window.innerHeight * 0.8) {
        targetHeight = newHeight;
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            onHeightChange(targetHeight);
            rafId = null;
          });
        }
      }
    };

    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        setIsResizing(false);
        document.body.style.cursor = 'default';
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [onHeightChange, height]);

  return (
    <>
      {!isMinimized && (
        <div
          className="h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors z-20 relative"
          onMouseDown={startResizing}
        />
      )}

      <motion.div
        initial={false}
        style={{ height: isMinimized ? 29 : height }}
        className={cn(
          "border-t border-border bg-zinc-950/95 font-mono text-xs flex flex-col shrink-0 overflow-hidden relative shadow-2xl z-20 backdrop-blur-sm",
          isRunOutput ? "text-emerald-300" : "text-zinc-300"
        )}
      >
        {isResizing && (
          <div className="absolute inset-0 z-50 cursor-row-resize" />
        )}

        <div className="flex items-center px-2 border-b border-white/5 bg-gradient-to-r from-[#0f0f11] to-[#09090b] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.02)] shrink-0 select-none h-7">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-indigo-500/10 flex items-center justify-center ring-1 ring-indigo-500/20 shadow-sm">
              <Terminal className="w-2.5 h-2.5 text-indigo-400" />
            </div>
            <span className="uppercase tracking-widest font-bold text-[9px] text-zinc-400/80 leading-none">
              {title}
            </span>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-5 h-5 flex items-center justify-center hover:bg-white/5 rounded-sm transition-colors text-zinc-500 hover:text-zinc-300"
              title={isMinimized ? "Expand Terminal" : "Minimize Terminal"}
            >
              {isMinimized ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center hover:bg-red-500/10 rounded-sm transition-colors text-zinc-500 hover:text-red-400"
              title="Close Terminal"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-hidden relative bg-zinc-950/50 custom-scrollbar"
        >
          <XTerminal height={isMinimized ? 0 : height} ref={xtermRef} />
        </div>
      </motion.div>
    </>
  );
}

export default App;
