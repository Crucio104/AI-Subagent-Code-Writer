
import React, { useRef } from 'react';
import Editor from '@monaco-editor/react';
import type { OnMount } from '@monaco-editor/react';

interface CodeEditorProps {
    filename: string;
    content: string;
    onChange: (value: string | undefined) => void;
    onSave: () => void;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ filename, content, onChange, onSave }) => {
    const editorRef = useRef<any>(null);

    const handleEditorDidMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        monaco.editor.defineTheme('custom-transparent', {
            base: 'vs-dark',
            inherit: true,
            rules: [],
            colors: {
                'editor.background': '#00000000', // Transparent
            }
        });
        monaco.editor.setTheme('custom-transparent');

        // Add Save command (Ctrl+S / Cmd+S)
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            onSave();
        });
    };


    return (
        <Editor
            height="100%"
            path={filename}
            value={content}
            theme="custom-transparent"
            onChange={onChange}
            onMount={handleEditorDidMount}
            options={{
                minimap: { enabled: false },
                fontSize: 14,
                padding: { top: 16 },
                scrollBeyondLastLine: false,
                automaticLayout: true,
            }}
        />
    );
};

export default CodeEditor;
