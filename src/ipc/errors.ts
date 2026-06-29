export type IpcErrorEvent = {
  topic: string;
  message: string;
};

type ErrorListener = (event: IpcErrorEvent) => void;

const listeners = new Set<ErrorListener>();

export function onIpcError(listener: ErrorListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitIpcError(event: IpcErrorEvent) {
  for (const listener of listeners) {
    listener(event);
  }
}
