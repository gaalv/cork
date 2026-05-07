import { create } from "zustand";

export type ShellView = { kind: "home" } | { kind: "note"; id: string } | { kind: "calendar" };
export type DrawerId = "search" | "folders" | "recent" | "starred" | "tags";
export type ToastMessage = {
  id: string;
  title: string;
  description?: string;
};

type PersistedShellState = {
  view?: ShellView;
  drawer?: DrawerId | null;
};

type ShellStore = {
  view: ShellView;
  history: ShellView[];
  cursor: number;
  drawer: DrawerId | null;
  lastDrawer: DrawerId;
  paletteOpen: boolean;
  helpOpen: boolean;
  toasts: ToastMessage[];
  navigate: (view: ShellView) => void;
  back: () => void;
  forward: () => void;
  toggleDrawer: (drawer: DrawerId) => void;
  closeDrawer: () => void;
  openPalette: () => void;
  closePalette: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  pushToast: (toast: Omit<ToastMessage, "id"> & { id?: string }) => void;
  dismissToast: (id: string) => void;
  reset: () => void;
};

const STORAGE_KEY = "noxe.shell";
const DEFAULT_VIEW: ShellView = { kind: "home" };
const DEFAULT_DRAWER: DrawerId = "search";

const persisted = loadPersisted();
const initialView = persisted.view ?? DEFAULT_VIEW;

export const useShellStore = create<ShellStore>((set) => ({
  view: initialView,
  history: [initialView],
  cursor: 0,
  drawer: persisted.drawer ?? null,
  lastDrawer: persisted.drawer ?? DEFAULT_DRAWER,
  paletteOpen: false,
  helpOpen: false,
  toasts: [],

  navigate(view) {
    set((state) => {
      const history = [...state.history.slice(0, state.cursor + 1), view];
      return { view, history, cursor: history.length - 1 };
    });
    schedulePersist();
  },

  back() {
    set((state) => {
      if (state.cursor <= 0) {
        return state;
      }
      const cursor = state.cursor - 1;
      return { cursor, view: state.history[cursor] ?? DEFAULT_VIEW };
    });
    schedulePersist();
  },

  forward() {
    set((state) => {
      if (state.cursor >= state.history.length - 1) {
        return state;
      }
      const cursor = state.cursor + 1;
      return { cursor, view: state.history[cursor] ?? DEFAULT_VIEW };
    });
    schedulePersist();
  },

  toggleDrawer(drawer) {
    set((state) => ({
      drawer: state.drawer === drawer ? null : drawer,
      lastDrawer: drawer,
    }));
    schedulePersist();
  },

  closeDrawer() {
    set({ drawer: null });
    schedulePersist();
  },

  openPalette() {
    set({ paletteOpen: true });
  },

  closePalette() {
    set({ paletteOpen: false });
  },

  openHelp() {
    set({ helpOpen: true });
  },

  closeHelp() {
    set({ helpOpen: false });
  },

  pushToast(toast) {
    const id = toast.id ?? cryptoRandomId();
    set((state) => ({
      toasts: [{ id, title: toast.title, description: toast.description }, ...state.toasts].slice(0, 3),
    }));
  },

  dismissToast(id) {
    set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) }));
  },

  reset() {
    set({
      view: DEFAULT_VIEW,
      history: [DEFAULT_VIEW],
      cursor: 0,
      drawer: null,
      lastDrawer: DEFAULT_DRAWER,
      paletteOpen: false,
      helpOpen: false,
      toasts: [],
    });
    schedulePersist();
  },
}));

let persistTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePersist() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistShellState();
  }, 300);
}

function persistShellState() {
  if (typeof window === "undefined") {
    return;
  }
  const state = useShellStore.getState();
  const value = JSON.stringify({ view: state.view, drawer: state.drawer } satisfies PersistedShellState);
  window.localStorage.setItem(STORAGE_KEY, value);
}

function loadPersisted(): PersistedShellState {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!isPersistedShellState(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function isPersistedShellState(value: unknown): value is PersistedShellState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as PersistedShellState;
  return (candidate.view === undefined || isShellView(candidate.view)) &&
    (candidate.drawer === undefined || candidate.drawer === null || isDrawerId(candidate.drawer));
}

function isShellView(value: unknown): value is ShellView {
  if (typeof value !== "object" || value === null || !("kind" in value)) {
    return false;
  }
  if (value.kind === "home" || value.kind === "calendar") {
    return true;
  }
  return value.kind === "note" && "id" in value && typeof value.id === "string";
}

function isDrawerId(value: unknown): value is DrawerId {
  return value === "search" || value === "folders" || value === "recent" || value === "starred" || value === "tags";
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `toast-${Date.now()}`;
}
