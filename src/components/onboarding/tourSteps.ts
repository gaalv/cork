/**
 * The first-run tour.
 *
 * Steps target real elements through `data-tour` attributes rather than CSS
 * selectors tied to styling, so a class rename cannot silently break the tour.
 * A step whose target is absent is skipped at runtime — the Inspector, for
 * instance, is not mounted until a note is open.
 */

export type TourStep = {
  id: string;
  /** Value of the `data-tour` attribute to spotlight. Null centres the card. */
  target: string | null;
  title: string;
  body: string;
  placement?: "right" | "left" | "bottom" | "top" | "center";
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    target: null,
    placement: "center",
    title: "Welcome to Cork",
    body: "A quick tour of the four things worth knowing. It takes about a minute, and you can leave at any point.",
  },
  {
    id: "sidebar",
    target: "sidebar",
    placement: "right",
    title: "Your vault",
    body: "Folders, tags and filters live here. Everything is a plain Markdown file on disk — open the same folder in any other editor and nothing breaks.",
  },
  {
    id: "notes-list",
    target: "notes-list",
    placement: "right",
    title: "Notes",
    body: "The middle column lists whatever the sidebar is showing. A new note lands wherever you are: inside a folder it stays there, anywhere else it goes to the Inbox.",
  },
  {
    id: "editor",
    target: "editor",
    placement: "left",
    title: "The editor",
    body: "Markdown renders as you type. Link notes with [[double brackets]] — type them and a list of your notes appears. Paste an image and it shows up inline.",
  },
  {
    id: "palette",
    target: null,
    placement: "center",
    title: "Command palette",
    body: "Press ⌘K for everything else: search across the vault, jump to a note, create folders, change settings. Press ? at any time for the shortcut list.",
  },
];
