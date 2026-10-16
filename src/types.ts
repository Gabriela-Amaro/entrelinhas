export interface DocumentFile {
  id: string;
  name: string;
  path: string;
  content: string;
  native?: boolean;
  rootId?: string;
  unavailable?: boolean;
  savedContent?: string;
}
export interface FolderRoot { id: string; name: string; path: string; native?: boolean }
export interface Workspace {
  version: 1;
  documents: DocumentFile[];
  roots: FolderRoot[];
  tabs: string[];
  activeId: string | null;
  secondaryId: string | null;
  scroll: Record<string, number>;
  expanded: string[];
  theme: 'dark' | 'light';
  fontSize: number;
  sidebar: boolean;
  outline: boolean;
  source: boolean;
  editing?: boolean;
}
export interface ImportResult { documents: DocumentFile[]; roots: FolderRoot[]; warnings?: string[] }
export interface DesktopBridge {
  pickFiles(): Promise<ImportResult | null>;
  pickFolder(): Promise<ImportResult | null>;
  readDocument(path: string): Promise<string>;
  writeDocument(path: string, content: string, expectedContent: string): Promise<void>;
  saveDocumentAs(name: string, content: string): Promise<DocumentFile | null>;
  restore(): Promise<Workspace | null>;
  save(state: Workspace): Promise<void>;
  flushAndClose(state: Workspace): Promise<void>;
  openExternal(url: string): Promise<void>;
  onOpen(callback: (result: ImportResult) => void): () => void;
  onCommand(callback: (command: string) => void): () => void;
  getPending(): Promise<ImportResult | null>;
}
declare global { interface Window { desktop?: DesktopBridge } }
