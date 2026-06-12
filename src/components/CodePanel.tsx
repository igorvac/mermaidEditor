import { useEffect, useRef } from 'react';
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';
import { mermaid as mermaidLang } from 'codemirror-lang-mermaid';
import { useApp } from '../store/appStore';
import { Icon } from './Icon';

const editorTheme = EditorView.theme({
  '&': { height: '100%', fontSize: '12.5px', color: '#465775' },
  '.cm-scroller': {
    fontFamily: "'SF Mono', ui-monospace, Menlo, monospace",
    lineHeight: '1.6'
  },
  '&.cm-focused': { outline: 'none' },
  '.cm-content': { caretColor: '#EF6F6C' },
  '.cm-cursor': { borderLeftColor: '#EF6F6C' },
  '.cm-activeLine': { backgroundColor: 'rgba(212, 205, 244, 0.22)' },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'rgba(212, 205, 244, 0.55)'
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'rgba(70, 87, 117, 0.38)'
  },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#465775' }
});

export function CodePanel() {
  const fileName = useApp((s) => s.fileName);
  const codeRev = useApp((s) => s.codeRev);
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const applyingRef = useRef(false);

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: useApp.getState().code,
        extensions: [
          lineNumbers(),
          history(),
          highlightActiveLine(),
          bracketMatching(),
          syntaxHighlighting(defaultHighlightStyle),
          mermaidLang(),
          EditorView.lineWrapping,
          editorTheme,
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !applyingRef.current) {
              useApp.getState().setCode(update.state.doc.toString(), 'editor');
            }
          })
        ]
      })
    });
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // alterações vindas da GUI ou de troca de arquivo
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const code = useApp.getState().code;
    if (view.state.doc.toString() !== code) {
      applyingRef.current = true;
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: code } });
      applyingRef.current = false;
    }
  }, [codeRev]);

  return (
    <>
      <div className="code-head">
        <Icon name="code" />
        <span className="file-name">{fileName || 'Sem arquivo'}</span>
      </div>
      <div className="code-body" ref={hostRef} />
    </>
  );
}
