import { useState } from 'react';
import { useApp } from '../store/appStore';
import type { FileNode } from '../types';
import { Icon } from './Icon';

interface RenameState {
  path: string;
  value: string;
}

function TreeItem({
  node,
  depth,
  expanded,
  toggle,
  rename,
  setRename
}: {
  node: FileNode;
  depth: number;
  expanded: Set<string>;
  toggle: (path: string) => void;
  rename: RenameState | null;
  setRename: (r: RenameState | null) => void;
}) {
  const filePath = useApp((s) => s.filePath);
  const { openFile, newFile, renameEntry, duplicateEntry, trashEntry } = useApp.getState();
  const isOpen = expanded.has(node.path);
  const isActive = filePath === node.path;
  const renaming = rename?.path === node.path;

  const commitRename = () => {
    if (rename && rename.value.trim() && rename.value !== node.name) {
      let name = rename.value.trim();
      if (node.kind === 'file' && !/\.(mmd|mermaid)$/i.test(name)) name += '.mmd';
      void renameEntry(node, name);
    }
    setRename(null);
  };

  return (
    <>
      <div
        className={`tree-row${isActive ? ' active' : ''}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => (node.kind === 'folder' ? toggle(node.path) : void openFile(node.path))}
        onDoubleClick={(e) => {
          e.stopPropagation();
          setRename({ path: node.path, value: node.name });
        }}
      >
        <Icon
          name={node.kind === 'folder' ? (isOpen ? 'folder_open' : 'folder') : 'account_tree'}
          filled={node.kind === 'folder'}
        />
        {renaming ? (
          <input
            className="tree-rename"
            value={rename.value}
            autoFocus
            onChange={(e) => setRename({ path: node.path, value: e.target.value })}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRename(null);
            }}
            onBlur={commitRename}
          />
        ) : (
          <span className="row-name" title={node.name}>
            {node.kind === 'file' ? node.name.replace(/\.(mmd|mermaid)$/i, '') : node.name}
          </span>
        )}
        {!renaming && (
          <span className="row-actions" onClick={(e) => e.stopPropagation()}>
            {node.kind === 'folder' && (
              <button
                className="icon-btn"
                title="Novo diagrama aqui"
                onClick={() => void newFile(node.path)}
              >
                <Icon name="note_add" />
              </button>
            )}
            <button
              className="icon-btn"
              title="Renomear"
              onClick={() => setRename({ path: node.path, value: node.name })}
            >
              <Icon name="edit" />
            </button>
            {node.kind === 'file' && (
              <button
                className="icon-btn"
                title="Duplicar"
                onClick={() => void duplicateEntry(node)}
              >
                <Icon name="content_copy" />
              </button>
            )}
            <button
              className="icon-btn"
              title="Mover para a Lixeira"
              onClick={() => void trashEntry(node)}
            >
              <Icon name="delete" />
            </button>
          </span>
        )}
      </div>
      {node.kind === 'folder' &&
        isOpen &&
        node.children?.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            toggle={toggle}
            rename={rename}
            setRename={setRename}
          />
        ))}
    </>
  );
}

export function Sidebar() {
  const tree = useApp((s) => s.tree);
  const { newFile, newFolder, closeProject } = useApp.getState();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [rename, setRename] = useState<RenameState | null>(null);

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <span className="title">Arquivos</span>
        <button className="icon-btn" title="Novo diagrama" onClick={() => void newFile()}>
          <Icon name="note_add" />
        </button>
        <button className="icon-btn" title="Nova pasta" onClick={() => void newFolder()}>
          <Icon name="create_new_folder" />
        </button>
      </div>
      <div className="tree">
        {tree.length === 0 && (
          <div style={{ padding: '14px 10px', fontSize: 12, color: 'var(--text-soft)' }}>
            Nenhum diagrama ainda. Crie o primeiro com o botão acima.
          </div>
        )}
        {tree.map((node) => (
          <TreeItem
            key={node.path}
            node={node}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            rename={rename}
            setRename={setRename}
          />
        ))}
      </div>
      <div className="sidebar-foot">
        <button className="btn btn-ghost" onClick={() => void closeProject()}>
          <Icon name="swap_horiz" size={16} />
          Trocar de projeto
        </button>
      </div>
    </aside>
  );
}
