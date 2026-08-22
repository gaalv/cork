/**
 * The first-run tour.
 *
 * Steps target real elements through `data-tour` attributes rather than CSS
 * selectors tied to styling, so a class rename cannot silently break the tour.
 * A step whose target is absent is skipped at runtime — the Inspector toggle,
 * for instance, is not mounted until a note is open.
 *
 * Kept to eight: the point is to surface what a new user would not otherwise
 * discover, not to inventory the product. Anything already obvious from
 * looking at the screen is left out.
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
    body: "A minute on the parts worth knowing up front. You can leave at any point and pick it up again from Settings.",
  },
  {
    id: "sidebar",
    target: "sidebar",
    placement: "right",
    title: "Your vault",
    body: "Folders, tags and saved filters. Everything here is a plain Markdown file on disk — open the same folder in any other editor and nothing breaks. The Inbox is not a folder: it is every note you have not filed yet.",
  },
  {
    id: "notes-list",
    target: "notes-list",
    placement: "right",
    title: "Notes",
    body: "The middle column lists whatever the sidebar is showing. A new note follows your context: inside a folder it stays there, anywhere else it goes to the Inbox. Deleting archives first — nothing is destroyed until you say so from the Archived view.",
  },
  {
    id: "editor",
    target: "editor",
    placement: "left",
    title: "Writing",
    body: "Markdown renders as you type. Put the caret on a line to see its raw syntax and edit it, move away and it renders again. Paste an image and it appears inline; code fences get real syntax highlighting.",
  },
  {
    id: "links",
    target: "editor",
    placement: "left",
    title: "Linking notes",
    body: "Type [[ and your notes appear — pick one and Cork writes the link. Click a rendered link to follow it. Use [[Folder/Note]] when two notes share a name, and [[Note|other words]] to show something else.",
  },
  {
    id: "inspector",
    target: "inspector",
    placement: "bottom",
    title: "The Inspector",
    body: "Backlinks live here: every note pointing at this one, found for you. Alongside them are the outline, tags, frontmatter properties and the file's git history — you can restore an earlier version of a note from it.",
  },
  {
    id: "capture",
    target: null,
    placement: "center",
    title: "Getting things down fast",
    body: "⌘N for a new note, ⌘⇧T for today's daily note. ⌘⇧I captures from anywhere — even when Cork is not the front window — straight into the Inbox. Templates are in the palette when a blank page is not enough.",
  },
  {
    id: "ai",
    target: null,
    placement: "center",
    title: "AI, if you want it",
    body: "Cork can summarise, rephrase, suggest tags and find related notes — running through the Claude or Copilot CLI you already have installed. No API key, no account, nothing leaves your machine. Off by default; turn it on in Settings › AI.",
  },
  {
    id: "palette",
    target: null,
    placement: "center",
    title: "Everything else is ⌘K",
    body: "The command palette searches the full text of your vault and runs every action Cork has. Press ? at any time for the shortcut list — and ⌘, for settings, where you can replay this tour.",
  },
];
