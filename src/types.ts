export interface FileNode {
  name: string;
  path: string;
  kind: 'file' | 'folder';
  children?: FileNode[];
}

export type NodeShape =
  | 'rect'
  | 'round'
  | 'stadium'
  | 'circle'
  | 'diamond'
  | 'hexagon'
  | 'subroutine'
  | 'cylinder'
  | 'asymmetric';

export type EdgeType = 'arrow' | 'open' | 'dotted' | 'thick';

export interface FlowNode {
  id: string;
  label: string;
  shape: NodeShape;
  /** teve definição explícita com delimitadores de forma */
  defined: boolean;
  /** índice do subgraph ao qual pertence */
  subgraph?: number;
}

export interface FlowEdge {
  from: string;
  to: string;
  label: string;
  type: EdgeType;
}

export interface FlowSubgraph {
  /** texto após `subgraph`, reutilizado tal-qual no codegen */
  raw: string;
  direction?: string;
}

export type FlowDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL';

export interface FlowModel {
  header: 'flowchart' | 'graph';
  direction: FlowDirection;
  nodes: FlowNode[];
  edges: FlowEdge[];
  subgraphs: FlowSubgraph[];
  /** diretivas %%{...}%% que precedem o header */
  init: string[];
  /** linhas preservadas: classDef, class, style, linkStyle, click, comentários… */
  extras: string[];
}

/** offsets de posição manual por id de nó: [dx, dy] em unidades do SVG */
export type LayoutOverrides = Record<string, [number, number]>;

export type Selection = { kind: 'node'; id: string } | { kind: 'edge'; index: number } | null;

export interface UpdaterEvent {
  type: string;
  version?: string;
  percent?: number;
  message?: string;
}

export interface ExportSaveOptions {
  defaultName: string;
  filterName: string;
  ext: string;
  data: string;
  encoding: 'utf8' | 'base64';
}

export interface Api {
  newProjectDialog(): Promise<string | null>;
  openProjectDialog(): Promise<string | null>;
  readTree(root: string): Promise<FileNode[]>;
  readFile(p: string): Promise<string>;
  writeFile(p: string, content: string): Promise<void>;
  createFile(dir: string, name: string, content: string): Promise<string>;
  createFolder(dir: string, name: string): Promise<string>;
  duplicateFile(p: string): Promise<string>;
  renamePath(oldPath: string, newName: string): Promise<string>;
  trashPath(p: string): Promise<void>;
  readLayout(filePath: string): Promise<LayoutOverrides>;
  writeLayout(filePath: string, data: LayoutOverrides): Promise<void>;
  getRecents(): Promise<string[]>;
  addRecent(p: string): Promise<string[]>;
  exportSave(opts: ExportSaveOptions): Promise<string | null>;
  exportPdf(opts: { svg: string; width: number; height: number; defaultName: string }): Promise<string | null>;
  updaterCheck(): Promise<void>;
  updaterDownload(): Promise<void>;
  updaterInstall(): Promise<void>;
  openReleases(): Promise<void>;
  getVersion(): Promise<string>;
  onMenu(cb: (action: string) => void): () => void;
  onUpdaterEvent(cb: (ev: UpdaterEvent) => void): () => void;
}

declare global {
  interface Window {
    api: Api;
  }
}
