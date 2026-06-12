import { create } from 'zustand';
import { detectDiagramType, parseFlow } from '../mermaid/parser';
import { genFlow, nextNodeId } from '../mermaid/codegen';
import { renderMermaid } from '../mermaid/renderer';
import type {
  EdgeType,
  FileNode,
  FlowModel,
  LayoutOverrides,
  NodeShape,
  Selection,
  UpdaterEvent
} from '../types';

export const DEFAULT_DIAGRAM = `flowchart TD
  inicio([Início]) --> tarefa[Primeira tarefa]
  tarefa --> decisao{Tudo certo?}
  decisao -->|Sim| fim([Fim])
  decisao -->|Não| tarefa
`;

export type Tool = 'select' | 'connect';

interface UpdateState {
  status: 'idle' | 'available' | 'downloading' | 'downloaded' | 'error' | 'dev' | 'uptodate';
  version?: string;
  percent?: number;
  message?: string;
  dismissed: boolean;
}

interface AppState {
  appVersion: string;
  recents: string[];
  projectPath: string | null;
  projectName: string;
  tree: FileNode[];

  filePath: string | null;
  fileName: string;
  code: string;
  savedCode: string;
  /** incrementado quando o código muda por fonte externa ao editor de texto */
  codeRev: number;
  model: FlowModel | null;
  diagramType: string | null;
  layout: LayoutOverrides;

  renderSvg: string;
  renderError: string | null;
  svgRev: number;

  selection: Selection;
  tool: Tool;
  connectFrom: string | null;

  zoom: number;
  pan: { x: number; y: number };
  showCode: boolean;
  showSidebar: boolean;

  update: UpdateState;

  bootstrap(): Promise<void>;
  newProject(): Promise<void>;
  openProjectDialog(): Promise<void>;
  openProject(path: string): Promise<void>;
  closeProject(): Promise<void>;
  refreshTree(): Promise<void>;

  openFile(path: string): Promise<void>;
  newFile(dir?: string): Promise<void>;
  newFolder(dir?: string): Promise<void>;
  renameEntry(node: FileNode, newName: string): Promise<void>;
  duplicateEntry(node: FileNode): Promise<void>;
  trashEntry(node: FileNode): Promise<void>;

  setCode(code: string, source: 'editor' | 'gui' | 'file'): void;
  saveNow(): Promise<void>;

  applyModel(model: FlowModel): void;
  renameNode(id: string, label: string): void;
  setNodeShape(id: string, shape: NodeShape): void;
  setNodeFill(id: string, color: string | null): void;
  addNode(shape: NodeShape): void;
  addEdge(from: string, to: string): void;
  setEdgeLabel(index: number, label: string): void;
  setEdgeType(index: number, type: EdgeType): void;
  setDirection(dir: FlowModel['direction']): void;
  deleteSelection(): void;

  setSelection(sel: Selection): void;
  setTool(tool: Tool): void;
  setConnectFrom(id: string | null): void;

  setNodeOffset(id: string, offset: [number, number]): void;
  clearLayout(): void;

  setZoom(zoom: number): void;
  setPan(pan: { x: number; y: number }): void;
  setView(zoom: number, pan: { x: number; y: number }): void;
  toggleCode(): void;
  toggleSidebar(): void;

  handleUpdaterEvent(ev: UpdaterEvent): void;
  dismissUpdate(): void;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let layoutTimer: ReturnType<typeof setTimeout> | undefined;
let renderTimer: ReturnType<typeof setTimeout> | undefined;
let renderSeq = 0;

const basename = (p: string) => p.split('/').pop() ?? p;

function firstFile(tree: FileNode[]): FileNode | null {
  for (const node of tree) {
    if (node.kind === 'file') return node;
    if (node.children) {
      const found = firstFile(node.children);
      if (found) return found;
    }
  }
  return null;
}

export const useApp = create<AppState>((set, get) => {
  function scheduleRender(immediate = false) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(async () => {
      const code = get().code;
      const mySeq = ++renderSeq;
      if (!code.trim()) {
        set({ renderSvg: '', renderError: null });
        return;
      }
      try {
        const svg = await renderMermaid(code);
        if (mySeq === renderSeq) {
          set((s) => ({ renderSvg: svg, renderError: null, svgRev: s.svgRev + 1 }));
        }
      } catch (err) {
        if (mySeq === renderSeq) {
          set({ renderError: String((err as Error)?.message ?? err) });
        }
      }
    }, immediate ? 0 : 200);
  }

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void get().saveNow(), 800);
  }

  function scheduleLayoutSave() {
    clearTimeout(layoutTimer);
    layoutTimer = setTimeout(() => {
      const { filePath, layout } = get();
      if (filePath) void window.api.writeLayout(filePath, layout);
    }, 500);
  }

  async function flushFile() {
    clearTimeout(saveTimer);
    clearTimeout(layoutTimer);
    const { filePath, code, savedCode, layout } = get();
    if (filePath && code !== savedCode) {
      await window.api.writeFile(filePath, code);
      set({ savedCode: code });
    }
    if (filePath) {
      await window.api.writeLayout(filePath, layout);
    }
  }

  function ingestCode(code: string, source: 'editor' | 'gui' | 'file') {
    const model = parseFlow(code);
    set((s) => {
      let selection = s.selection;
      if (selection?.kind === 'node') {
        const nodeId = selection.id;
        if (!model?.nodes.some((n) => n.id === nodeId)) selection = null;
      }
      if (selection?.kind === 'edge' && !(model && selection.index < model.edges.length)) {
        selection = null;
      }
      return {
        code,
        model,
        diagramType: detectDiagramType(code),
        codeRev: source === 'editor' ? s.codeRev : s.codeRev + 1,
        selection
      };
    });
    if (source !== 'file') scheduleSave();
    scheduleRender(source === 'file');
  }

  return {
    appVersion: '',
    recents: [],
    projectPath: null,
    projectName: '',
    tree: [],

    filePath: null,
    fileName: '',
    code: '',
    savedCode: '',
    codeRev: 0,
    model: null,
    diagramType: null,
    layout: {},

    renderSvg: '',
    renderError: null,
    svgRev: 0,

    selection: null,
    tool: 'select',
    connectFrom: null,

    zoom: 1,
    pan: { x: 0, y: 0 },
    showCode: true,
    showSidebar: true,

    update: { status: 'idle', dismissed: false },

    async bootstrap() {
      const [recents, appVersion] = await Promise.all([
        window.api.getRecents(),
        window.api.getVersion()
      ]);
      set({ recents, appVersion });
    },

    async newProject() {
      const path = await window.api.newProjectDialog();
      if (!path) return;
      await window.api.createFile(path, 'diagrama.mmd', DEFAULT_DIAGRAM);
      await get().openProject(path);
    },

    async openProjectDialog() {
      const path = await window.api.openProjectDialog();
      if (path) await get().openProject(path);
    },

    async openProject(path: string) {
      await flushFile();
      const [tree, recents] = await Promise.all([
        window.api.readTree(path),
        window.api.addRecent(path)
      ]);
      set({
        projectPath: path,
        projectName: basename(path),
        tree,
        recents,
        filePath: null,
        fileName: '',
        code: '',
        savedCode: '',
        model: null,
        renderSvg: '',
        renderError: null,
        selection: null,
        layout: {}
      });
      const first = firstFile(tree);
      if (first) await get().openFile(first.path);
    },

    async closeProject() {
      await flushFile();
      set({
        projectPath: null,
        projectName: '',
        tree: [],
        filePath: null,
        fileName: '',
        code: '',
        savedCode: '',
        model: null,
        renderSvg: '',
        renderError: null,
        selection: null,
        layout: {}
      });
    },

    async refreshTree() {
      const { projectPath } = get();
      if (!projectPath) return;
      set({ tree: await window.api.readTree(projectPath) });
    },

    async openFile(path: string) {
      await flushFile();
      const [code, layout] = await Promise.all([
        window.api.readFile(path),
        window.api.readLayout(path)
      ]);
      set({
        filePath: path,
        fileName: basename(path),
        savedCode: code,
        layout,
        selection: null,
        connectFrom: null,
        tool: 'select',
        zoom: 1,
        pan: { x: 0, y: 0 }
      });
      ingestCode(code, 'file');
    },

    async newFile(dir?: string) {
      const { projectPath } = get();
      if (!projectPath) return;
      const path = await window.api.createFile(dir ?? projectPath, 'novo-diagrama.mmd', DEFAULT_DIAGRAM);
      await get().refreshTree();
      await get().openFile(path);
    },

    async newFolder(dir?: string) {
      const { projectPath } = get();
      if (!projectPath) return;
      await window.api.createFolder(dir ?? projectPath, 'Nova pasta');
      await get().refreshTree();
    },

    async renameEntry(node, newName) {
      const renamed = await window.api.renamePath(node.path, newName);
      if (get().filePath === node.path) {
        set({ filePath: renamed, fileName: basename(renamed) });
      }
      await get().refreshTree();
    },

    async duplicateEntry(node) {
      if (node.kind !== 'file') return;
      await window.api.duplicateFile(node.path);
      await get().refreshTree();
    },

    async trashEntry(node) {
      const { filePath } = get();
      const closesOpen =
        filePath === node.path || (node.kind === 'folder' && filePath?.startsWith(node.path + '/'));
      if (closesOpen) {
        clearTimeout(saveTimer);
        clearTimeout(layoutTimer);
        set({
          filePath: null,
          fileName: '',
          code: '',
          savedCode: '',
          model: null,
          renderSvg: '',
          renderError: null,
          selection: null,
          layout: {}
        });
      }
      await window.api.trashPath(node.path);
      await get().refreshTree();
      if (closesOpen) {
        const first = firstFile(get().tree);
        if (first) await get().openFile(first.path);
      }
    },

    setCode(code, source) {
      if (code === get().code) return;
      ingestCode(code, source);
    },

    async saveNow() {
      clearTimeout(saveTimer);
      const { filePath, code, savedCode } = get();
      if (!filePath || code === savedCode) return;
      await window.api.writeFile(filePath, code);
      set({ savedCode: code });
    },

    applyModel(model) {
      get().setCode(genFlow(model), 'gui');
    },

    renameNode(id, label) {
      const model = structuredClone(get().model);
      const node = model?.nodes.find((n) => n.id === id);
      if (!model || !node) return;
      node.label = label;
      node.defined = true;
      get().applyModel(model);
    },

    setNodeShape(id, shape) {
      const model = structuredClone(get().model);
      const node = model?.nodes.find((n) => n.id === id);
      if (!model || !node) return;
      node.shape = shape;
      node.defined = true;
      get().applyModel(model);
    },

    setNodeFill(id, color) {
      const model = structuredClone(get().model);
      if (!model) return;
      const styleRe = new RegExp(`^style\\s+${id}\\s`);
      model.extras = model.extras.filter((l) => !styleRe.test(l));
      if (color) {
        model.extras.push(`style ${id} fill:${color},stroke:#465775`);
      }
      get().applyModel(model);
    },

    addNode(shape) {
      const model = structuredClone(get().model);
      if (!model) return;
      const id = nextNodeId(model);
      model.nodes.push({ id, label: 'Novo nó', shape, defined: true });
      get().applyModel(model);
      set({ selection: { kind: 'node', id } });
    },

    addEdge(from, to) {
      const model = structuredClone(get().model);
      if (!model || from === to) return;
      model.edges.push({ from, to, label: '', type: 'arrow' });
      get().applyModel(model);
      set({ selection: { kind: 'edge', index: model.edges.length - 1 }, connectFrom: null });
    },

    setEdgeLabel(index, label) {
      const model = structuredClone(get().model);
      if (!model || !model.edges[index]) return;
      model.edges[index].label = label;
      get().applyModel(model);
    },

    setEdgeType(index, type) {
      const model = structuredClone(get().model);
      if (!model || !model.edges[index]) return;
      model.edges[index].type = type;
      get().applyModel(model);
    },

    setDirection(dir) {
      const model = structuredClone(get().model);
      if (!model) return;
      model.direction = dir;
      get().applyModel(model);
    },

    deleteSelection() {
      const { selection } = get();
      const model = structuredClone(get().model);
      if (!model || !selection) return;
      if (selection.kind === 'node') {
        const id = selection.id;
        model.nodes = model.nodes.filter((n) => n.id !== id);
        model.edges = model.edges.filter((e) => e.from !== id && e.to !== id);
        const styleRe = new RegExp(`^style\\s+${id}\\s`);
        model.extras = model.extras.filter((l) => !styleRe.test(l));
        const layout = { ...get().layout };
        delete layout[id];
        set({ layout, selection: null });
        scheduleLayoutSave();
      } else {
        model.edges.splice(selection.index, 1);
        set({ selection: null });
      }
      get().applyModel(model);
    },

    setSelection(sel) {
      set({ selection: sel });
    },

    setTool(tool) {
      set({ tool, connectFrom: null });
    },

    setConnectFrom(id) {
      set({ connectFrom: id });
    },

    setNodeOffset(id, offset) {
      const layout = { ...get().layout };
      if (Math.abs(offset[0]) < 0.5 && Math.abs(offset[1]) < 0.5) {
        delete layout[id];
      } else {
        layout[id] = offset;
      }
      set({ layout });
      scheduleLayoutSave();
    },

    clearLayout() {
      set({ layout: {} });
      const { filePath } = get();
      if (filePath) void window.api.writeLayout(filePath, {});
    },

    setZoom(zoom) {
      set({ zoom });
    },

    setPan(pan) {
      set({ pan });
    },

    setView(zoom, pan) {
      set({ zoom, pan });
    },

    toggleCode() {
      set((s) => ({ showCode: !s.showCode }));
    },

    toggleSidebar() {
      set((s) => ({ showSidebar: !s.showSidebar }));
    },

    handleUpdaterEvent(ev) {
      switch (ev.type) {
        case 'available':
          set({ update: { status: 'available', version: ev.version, dismissed: false } });
          break;
        case 'progress':
          set((s) => ({
            update: { ...s.update, status: 'downloading', percent: ev.percent, dismissed: false }
          }));
          break;
        case 'downloaded':
          set((s) => ({
            update: { ...s.update, status: 'downloaded', version: ev.version, dismissed: false }
          }));
          break;
        case 'not-available':
          set((s) =>
            s.update.status === 'idle' || s.update.status === 'uptodate'
              ? { update: { status: 'uptodate', dismissed: false } as UpdateState }
              : { update: s.update }
          );
          break;
        case 'dev-mode':
          set({ update: { status: 'dev', dismissed: false } });
          break;
        case 'error':
          set({ update: { status: 'error', message: ev.message, dismissed: false } });
          break;
      }
    },

    dismissUpdate() {
      set((s) => ({ update: { ...s.update, dismissed: true } }));
    }
  };
});
