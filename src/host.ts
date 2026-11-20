/** Small audited subset, NOT a claim that private reader fields are public APIs. */
export interface ToolbarEvent {
  reader: unknown;
  doc: Document;
  append: (...nodes: Node[]) => void;
}
export interface Host {
  version: string;
  debug(message: string): void;
  Prefs: {
    get(key: string, global?: boolean): unknown;
    set(key: string, value: boolean | string | number, global?: boolean): void;
  };
  Reader: {
    registerEventListener(type: string, handler: (event: ToolbarEvent) => void, pluginID?: string): void;
    unregisterEventListener(type: string, handler: (event: ToolbarEvent) => void): void;
  };
  PreferencePanes: {
    register(options: {pluginID: string; src: string; id: string; label: string}): Promise<string>;
    unregister(id: string): void;
  };
}
export interface Timers {
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
}
export interface ReadingTarget {
  document: Document;
  root: HTMLElement;
  side: "primary" | "secondary";
}
export type Status = {
  code: string;
  detail: string;
  prefixes?: number;
  truncated?: boolean;
};
