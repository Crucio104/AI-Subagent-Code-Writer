import React from 'react';
import { Loader2, CheckCircle2, Bot, Code, FileText, Search, ShieldCheck, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface AgentStatusProps {
    timeline: { agent_name: string; content: string; status: 'done' | 'working' | 'error' }[];
}

const getAgentIcon = (name: string) => {
    switch (name.toLowerCase()) {
        case 'system architect': return <Search className="w-3.5 h-3.5" />;
        case 'code generator': return <Code className="w-3.5 h-3.5" />;
        case 'tester': return <ShieldCheck className="w-3.5 h-3.5" />;
        case 'code reviewer': return <Search className="w-3.5 h-3.5" />;
        case 'technical writer': return <FileText className="w-3.5 h-3.5" />;
        default: return <Bot className="w-3.5 h-3.5" />;
    }
}

export const AgentStatus: React.FC<AgentStatusProps> = ({ timeline }) => {
    return (
        <div className="h-full flex flex-col">
            <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                <div className="relative pl-2">
                    {/* Continuous Line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-[1px] bg-border" />

                    <AnimatePresence initial={false}>
                        {timeline.map((item, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="relative flex gap-4 mb-6 last:mb-0 group"
                            >
                                <div className={cn(
                                    "relative z-10 w-6 h-6 rounded-full border bg-background flex items-center justify-center shrink-0 transition-colors duration-300",
                                    item.status === 'working' ? "border-blue-500 text-blue-500 shadow-sm" :
                                        item.status === 'error' ? "border-red-500 text-red-500 bg-red-500/10" :
                                            "border-emerald-500 text-emerald-500"
                                )}>
                                    {item.status === 'working' ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : item.status === 'error' ? (
                                        <XCircle className="w-3 h-3" />
                                    ) : (
                                        <CheckCircle2 className="w-3 h-3" />
                                    )}
                                </div>

                                <div className="flex-1 pt-0.5">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="flex items-center gap-1.5 font-medium text-sm text-foreground">
                                            {getAgentIcon(item.agent_name)}
                                            {item.agent_name}
                                        </span>
                                        {item.status === 'working' && (
                                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                                                Active
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground leading-relaxed">{item.content}</p>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {timeline.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
                            <Bot className="w-8 h-8 mb-2 opacity-20" />
                            <p className="text-sm">Waiting for instructions...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
