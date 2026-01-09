import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
// remark-gfm removed to fix build error
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import 'github-markdown-css/github-markdown.css'
import { Button } from './components/ui/button'
import { AgentStatus } from './components/AgentStatus'
import { FileCode, Terminal, MonitorPlay, ArrowRight, Bot, FolderOpen, X, Copy, Download, Check, Play, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from './lib/utils'

interface LogItem {
  agent_name: string;
  content: string;
  files?: Record<string, string>;
  status: 'done' | 'working' | 'error';
  error?: string;
}

function App() {
  const [prompt, setPrompt] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [timeline, setTimeline] = useState<LogItem[]>([])
  const [generatedFiles, setGeneratedFiles] = useState<Record<string, string>>({})
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [useLocalLLM, setUseLocalLLM] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'activity' | 'files'>('activity');
  const [openFiles, setOpenFiles] = useState<string[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    // Force Dark Mode always
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  // Theme toggle removed as requested

  // Resizable Terminal State
  const [terminalHeight, setTerminalHeight] = useState(192); // Default 192px (12rem/48 class)


  const startGeneration = () => {
    if (!prompt.trim()) return;
    setIsProcessing(true);
    setTimeline([]);
    setGeneratedFiles({});
    setOpenFiles([]);
    setSelectedFile(null);

    if (wsRef.current) wsRef.current.close();

    const ws = new WebSocket('ws://127.0.0.1:8000/generate');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('Connected to backend');
      ws.send(JSON.stringify({ prompt, use_local_llm: useLocalLLM }));
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      // Try to fetch to see if it's a network issue or WS issue
      fetch('http://127.0.0.1:8000/')
        .then(res => res.json())
        .then(data => alert(`WS Failed but HTTP OK: ${data.message}`))
        .catch(err => alert(`Fatal: Cannot reach Backend at all (HTTP & WS failed). \n\nDetails: ${err}`));
      setIsProcessing(false);
    };

    ws.onmessage = (event) => {
      // Prevent handling messages from old sockets
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

      setTimeline(prev => {
        const newTimeline = [...prev];
        const lastItem = newTimeline[newTimeline.length - 1];

        // If same agent, update content
        if (lastItem && lastItem.agent_name === data.agent_name && lastItem.status === 'working') {
          lastItem.content = data.content;
          if (data.is_error) {
            lastItem.status = 'error';
          } else if (data.content.startsWith("Done!")) {
            lastItem.status = 'done';
          }
          return [...newTimeline];
        }

        // If different agent or new start
        return [
          ...prev.map(item => ({ ...item, status: item.status === 'working' ? 'done' as const : item.status })),
          {
            agent_name: data.agent_name,
            content: data.content,
            status: data.is_error ? 'error' as const : 'working' as const
          }
        ];
      });

      if (data.files) {
        setGeneratedFiles(prev => ({ ...prev, ...data.files }));
        const newFiles = Object.keys(data.files);
        setOpenFiles(prev => Array.from(new Set([...prev, ...newFiles])));

        if (newFiles.length > 0) {
          // Auto-open logic: User specifically requested to open the first generated file.
          // We force selection of the first file in the new batch.
          setSelectedFile(newFiles[0]);
        }
      }
    };

    ws.onclose = () => {
      // Only handle close if this is the current socket
      if (ws === wsRef.current) {
        console.log('Connection closed');
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
      // Select the last opened file or null
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

  const handleRun = async (e: React.MouseEvent, filename: string, content: string) => {
    e.stopPropagation();
    setIsRunning(true);
    setGeneratedFiles(prev => ({ ...prev, 'RUN_OUTPUT.log': 'Running script...' }));

    try {
      const response = await fetch('http://127.0.0.1:8000/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: content, filename })
      });

      const data = await response.json();

      let output = "";
      if (data.error) {
        output += `Error:\n${data.error}\n`;
      }
      if (data.output) {
        output += `Output:\n${data.output}\n`;
      }
      if (!data.output && !data.error) {
        output = "Script executed successfully with no output.";
      }
      output += `\nExit Code: ${data.exit_code}`;

      setGeneratedFiles(prev => ({ ...prev, 'RUN_OUTPUT.log': output }));
    } catch (err: any) {
      setGeneratedFiles(prev => ({ ...prev, 'RUN_OUTPUT.log': `Failed to execute script.\nError: ${err.toString()}` }));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="h-screen bg-background text-foreground font-sans flex flex-col overflow-hidden transition-colors duration-300">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-6 justify-between bg-card z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
            Ag
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-tight">AgentForge</h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-medium">Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted/50 text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          System Ready
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Sidebar - Timeline */}
        <aside className="w-80 lg:w-96 border-r border-border bg-card flex flex-col shrink-0">
          <div className="p-4 border-b border-border/50">
            <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">New Task</p>
            <div className="space-y-3">
              <div className="flex p-1 bg-muted/50 rounded-2xl relative isolate">
                {/* Animated Background Indicator */}
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
                <button
                  onClick={() => setUseLocalLLM(false)}
                  className={cn(
                    "relative z-10 flex-1 text-xs font-medium py-1.5 rounded-xl transition-all duration-300",
                    !useLocalLLM ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  OpenAI API
                </button>
              </div>

              <textarea
                className="w-full min-h-[100px] p-3 rounded-2xl border border-input bg-white text-black dark:bg-[#000000] dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none placeholder:text-muted-foreground/60 transition-all font-mono custom-scrollbar"
                placeholder="Describe what you want to build..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={false}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    startGeneration();
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  className="flex-1 justify-between group transition-colors"
                  onClick={startGeneration}
                  disabled={!prompt}
                >
                  <span>{isProcessing ? "Restart Generation" : "Generate Code"}</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>

                {isProcessing && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="aspect-square rounded-xl"
                    onClick={() => {
                      if (wsRef.current) wsRef.current.close();
                      setIsProcessing(false);
                    }}
                    title="Stop Generation"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Tabs - Premium Segmented Control */}
          <div className="px-4 py-3 border-b border-border/40 bg-muted/10">
            <div className="flex p-1 bg-muted/50 rounded-2xl relative isolate">
              {/* Animated Background Indicator */}
              <div className="absolute inset-1 pointer-events-none">
                <AnimatePresence>
                  {sidebarTab === 'activity' ? (
                    <motion.div
                      layoutId="sidebar-tab-indicator"
                      className="absolute left-0 top-0 bottom-0 w-1/2 bg-secondary/80 shadow-sm rounded-xl border border-border/50"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  ) : (
                    <motion.div
                      layoutId="sidebar-tab-indicator"
                      className="absolute right-0 top-0 bottom-0 w-1/2 bg-secondary/80 shadow-sm rounded-xl border border-border/50"
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setSidebarTab('activity')}
                className={cn(
                  "relative z-10 flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl transition-colors duration-200",
                  sidebarTab === 'activity'
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Bot className={cn("w-4 h-4", sidebarTab === 'activity' ? "text-foreground" : "opacity-70")} />
                Activity
              </button>

              <button
                onClick={() => setSidebarTab('files')}
                className={cn(
                  "relative z-10 flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2 rounded-xl transition-colors duration-200",
                  sidebarTab === 'files'
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <FolderOpen className={cn("w-4 h-4", sidebarTab === 'files' ? "text-foreground" : "opacity-70")} />
                Files
              </button>
            </div>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            {sidebarTab === 'activity' ? (
              <div className="flex-1 min-h-0">
                <AgentStatus timeline={timeline} />
              </div>
            ) : (
              <div className="flex-1 overflow-auto p-4 space-y-1 custom-scrollbar">
                {Object.keys(generatedFiles).length === 0 ? (
                  <div className="text-center text-muted-foreground text-sm py-10 flex flex-col items-center gap-2">
                    <FolderOpen className="w-8 h-8 opacity-20" />
                    <span>No files generated yet.</span>
                  </div>
                ) : (
                  Object.keys(generatedFiles).map((filename) => (
                    <div
                      key={filename}
                      className={cn(
                        "w-full rounded-xl text-sm transition-all flex items-center gap-2 group pr-2 relative overflow-hidden",
                        selectedFile === filename
                          ? "text-foreground font-semibold"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {selectedFile === filename && (
                        <motion.div
                          layoutId="active-sidebar-file"
                          className="absolute inset-0 bg-secondary/80 rounded-xl shadow-sm z-0 border border-border/50"
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      )}
                      <button
                        onClick={() => {
                          if (!openFiles.includes(filename)) {
                            setOpenFiles(prev => [...prev, filename]);
                          }
                          setSelectedFile(filename);
                        }}
                        className="flex-1 text-left px-3 py-2.5 flex items-center gap-3 z-0"
                      >
                        <FileCode className={cn("w-4 h-4 shrink-0", selectedFile === filename ? "opacity-100 text-foreground" : "opacity-70 group-hover:opacity-100")} />
                        <span className="truncate font-medium">{filename}</span>
                      </button>

                      {/* Sidebar Actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 shrink-0">
                        <button
                          onClick={(e) => handleCopy(e, filename, generatedFiles[filename])}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            selectedFile === filename
                              ? "hover:bg-background/20 text-foreground"
                              : "hover:bg-background text-muted-foreground hover:text-foreground"
                          )}
                          title="Copy content"
                        >
                          {copiedFile === filename ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={(e) => handleDownload(e, filename, generatedFiles[filename])}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors",
                            selectedFile === filename
                              ? "hover:bg-background/20 text-foreground"
                              : "hover:bg-background text-muted-foreground hover:text-foreground"
                          )}
                          title="Download file"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content - Code View */}
        <main className="flex-1 bg-muted/10 flex flex-col min-w-0">
          {/* Header showing selected file */}
          <div className="h-12 border-b border-border bg-background flex items-center px-4 gap-2 overflow-x-auto scrollbar-hide shrink-0">
            <AnimatePresence initial={false} mode="popLayout">
              {openFiles.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-xs text-muted-foreground flex items-center gap-2 px-2"
                >
                  <Terminal className="w-3.5 h-3.5" />
                  Output Terminal
                </motion.div>
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
                    className={cn(
                      "h-8 pl-3 pr-1.5 text-xs font-medium rounded-xl flex items-center gap-2 transition-all shrink-0 group relative hover:text-foreground",
                      selectedFile === filename
                        ? "text-foreground font-semibold"
                        : "text-muted-foreground"
                    )}
                  >
                    {selectedFile === filename && (
                      <motion.div
                        layoutId="active-file-tab"
                        className="absolute inset-0 bg-secondary/80 rounded-xl shadow-sm z-0 border border-border/50"
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{filename}</span>
                    </span>
                    <div
                      onClick={(e) => closeFile(e, filename)}
                      className={cn(
                        "relative z-10 p-0.5 rounded-full hover:bg-black/20 transition-colors opacity-0 group-hover:opacity-100",
                        selectedFile === filename && "opacity-100 hover:bg-white/20"
                      )}
                    >
                      <X className="w-3 h-3" />
                    </div>
                  </motion.button>
                ))
              )}
            </AnimatePresence>
          </div>

          {/* Editor Area */}
          <div className="flex-1 overflow-auto relative bg-background custom-scrollbar">
            {selectedFile ? (
              <div className="min-h-full">
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/40 px-6 py-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">{selectedFile}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => handleCopy(e, selectedFile, generatedFiles[selectedFile])}
                      className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy content"
                    >
                      {copiedFile === selectedFile ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={(e) => handleDownload(e, selectedFile, generatedFiles[selectedFile])}
                      className="p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors"
                      title="Download file"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                    {selectedFile.endsWith('.py') && (
                      <button
                        onClick={(e) => handleRun(e, selectedFile, generatedFiles[selectedFile])}
                        className={cn(
                          "p-1.5 hover:bg-emerald-500/10 rounded-md text-muted-foreground hover:text-emerald-500 transition-colors",
                          isRunning && "animate-pulse text-emerald-500"
                        )}
                        title="Run Python Script"
                        disabled={isRunning}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                  </div>
                </div>
                {selectedFile!.endsWith('.md') ? (
                  <div className="p-6 markdown-body text-sm bg-transparent">
                    <ReactMarkdown>{generatedFiles[selectedFile!] || ''}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-sm font-mono leading-relaxed overflow-hidden h-full">
                    <SyntaxHighlighter
                      language={selectedFile!.endsWith('.py') ? 'python' : selectedFile!.endsWith('.tsx') ? 'tsx' : selectedFile!.endsWith('.ts') ? 'typescript' : selectedFile!.endsWith('.css') ? 'css' : 'javascript'}
                      style={vscDarkPlus}
                      customStyle={{ margin: 0, borderRadius: 0, height: '100%', background: 'transparent', padding: '1.5rem' }}
                      showLineNumbers={true}
                    >
                      {generatedFiles[selectedFile!] || ''}
                    </SyntaxHighlighter>
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

          {/* Terminal Panel */}
          {/* Resizable Terminal */}
          {generatedFiles['RUN_OUTPUT.log'] && (
            <TerminalPanel
              title="Output Console"
              content={generatedFiles['RUN_OUTPUT.log']}
              onClose={() => setGeneratedFiles(prev => {
                const newFiles = { ...prev };
                delete newFiles['RUN_OUTPUT.log'];
                return newFiles;
              })}
              height={terminalHeight}
              onHeightChange={setTerminalHeight}
              isRunOutput
            />
          )}

          {generatedFiles['TEST_RESULTS.log'] && !generatedFiles['RUN_OUTPUT.log'] && (
            <TerminalPanel
              title="Test Execution Output"
              content={generatedFiles['TEST_RESULTS.log']}
              onClose={() => setGeneratedFiles(prev => {
                const newFiles = { ...prev };
                delete newFiles['TEST_RESULTS.log'];
                return newFiles;
              })}
              height={terminalHeight}
              onHeightChange={setTerminalHeight}
            />
          )}
        </main>
      </div>
    </div>
  )
}

interface TerminalPanelProps {
  title: string;
  content: string;
  onClose: () => void;
  height: number;
  onHeightChange: (h: number) => void;
  isRunOutput?: boolean;
}

function TerminalPanel({ title, content, onClose, height, onHeightChange, isRunOutput }: TerminalPanelProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);

  // Auto-scroll to bottom when content changes
  useEffect(() => {
    if (scrollRef.current && !isMinimized) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [content, isMinimized]);

  const startResizing = (e: React.MouseEvent) => {
    isResizingRef.current = true;
    document.body.style.cursor = 'row-resize';
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current) return;
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 100 && newHeight < window.innerHeight * 0.8) {
        onHeightChange(newHeight);
      }
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
      document.body.style.cursor = 'default';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [onHeightChange]);

  return (
    <>
      {/* Resize Handle - Only show if not minimized */}
      {!isMinimized && (
        <div
          className="h-1 bg-border hover:bg-primary/50 cursor-row-resize transition-colors z-20 relative"
          onMouseDown={startResizing}
        />
      )}

      <motion.div
        initial={false}
        animate={{ height: isMinimized ? 40 : height }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
          "border-t border-border bg-black font-mono text-xs flex flex-col shrink-0 overflow-hidden relative shadow-2xl z-20",
          isRunOutput ? "text-emerald-400" : "text-green-400"
        )}
      >
        {/* Terminal Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 bg-white/5 shrink-0 select-none">
          <Terminal className="w-3.5 h-3.5 opacity-70" />
          <span className="uppercase tracking-widest font-semibold flex-1 text-[10px] opacity-90">{title}</span>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white"
              title={isMinimized ? "Expand Terminal" : "Minimize Terminal"}
            >
              {isMinimized ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors text-white/70 hover:text-white hover:bg-red-500/20 hover:text-red-400"
              title="Close Terminal"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Terminal Content */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto p-4 custom-scrollbar whitespace-pre-wrap select-text"
        >
          {content}
        </div>
      </motion.div>
    </>
  );
}

export default App
