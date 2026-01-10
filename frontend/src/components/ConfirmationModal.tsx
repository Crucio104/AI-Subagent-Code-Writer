import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

interface ConfirmationModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onClose: () => void;
    onConfirm: () => void;
    isDestructive?: boolean;
    isAlert?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    title,
    message,
    confirmLabel = "Confirm",
    onClose,
    onConfirm,
    isDestructive = false,
    isAlert = false
}) => {
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
                                    {isDestructive && <AlertTriangle className="w-4 h-4 text-red-500" />}
                                    <span>{title}</span>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1 hover:bg-muted/50 rounded-md text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="p-4">
                                <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
                            </div>

                            <div className="flex justify-end gap-2 p-4 pt-0">
                                {!isAlert && (
                                    <Button type="button" variant="ghost" onClick={onClose} size="sm">
                                        Cancel
                                    </Button>
                                )}
                                <Button
                                    type="button"
                                    variant={isDestructive ? "destructive" : "default"}
                                    onClick={onConfirm}
                                    size="sm"
                                >
                                    {confirmLabel}
                                </Button>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
};
