import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

export interface TerminalRef {
    writeToTerminal: (data: string) => void;
    sendText: (text: string) => void;
}

interface TerminalProps {
    wsUrl?: string;
    height?: number; // Optional height prop
}

export const Terminal = forwardRef<TerminalRef, TerminalProps>(({ wsUrl = 'ws://localhost:8000/terminal', height }, ref) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    useImperativeHandle(ref, () => ({
        writeToTerminal: (data: string) => {
            if (xtermRef.current) {
                xtermRef.current.write(data);
            }
        },
        sendText: (text: string) => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(text);
                // Also focus the terminal so the user sees the cursor
                xtermRef.current?.focus();
            }
        }
    }));

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#09090b', // zinc-950
                foreground: '#f4f4f5', // zinc-100
                cursor: '#a1a1aa',
                selectionBackground: 'rgba(255, 255, 255, 0.3)',
            },
            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
            fontSize: 13,
            lineHeight: 1.2,
            convertEol: true, // Crucial for proper line endings
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Connect to WebSocket
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            // Send initial resize/init if needed
            term.write('\r\n\x1b[32m[Connected to Backend Shell]\x1b[0m\r\n');
        };

        ws.onmessage = (event) => {
            term.write(event.data);
        };

        ws.onclose = () => {
            term.write('\r\n\x1b[31m[Connection Closed]\x1b[0m\r\n');
        };

        ws.onerror = (err) => {
            console.error("Terminal WS Error", err);
            term.write('\r\n\x1b[31m[Connection Error]\x1b[0m\r\n');
        }

        // Handle User Input
        term.onData((data) => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(data);
            }
        });

        // Handle Resize
        const handleResize = () => {
            fitAddon.fit();
            // Ideally send new cols/rows to backend here
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
            ws.close();
            term.dispose();
        };
    }, [wsUrl]);

    // Re-fit when height changes (if controlled by parent)
    useEffect(() => {
        if (fitAddonRef.current) {
            // Small timeout to allow layout transition to finish
            setTimeout(() => {
                fitAddonRef.current?.fit();
            }, 50);
        }
    }, [height]);

    return (
        <div
            className="w-full h-full overflow-hidden bg-zinc-950 p-1"
            ref={terminalRef}
        />
    );
});

Terminal.displayName = 'Terminal';
