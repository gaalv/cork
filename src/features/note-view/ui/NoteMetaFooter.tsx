type NoteMetaFooterProps = {
  body: string;
  created?: string;
  updated?: number;
};

export function NoteMetaFooter({ body, created, updated }: NoteMetaFooterProps) {
  return (
    <footer className="space-y-1 border-t border-[var(--color-noxe-border)] pt-3 text-xs text-[var(--color-noxe-muted)]">
      <p>{wordCount(body)} words</p>
      {created ? <p>Created {created}</p> : null}
      {updated ? <p>Updated {formatDate(updated)}</p> : null}
    </footer>
  );
}

function wordCount(body: string): number {
  return body.trim().split(/\s+/).filter(Boolean).length;
}

function formatDate(value: number): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
