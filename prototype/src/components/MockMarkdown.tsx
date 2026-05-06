import { useMemo } from 'react'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function inline(text: string) {
  let out = escapeHtml(text)
  out = out.replace(
    /\[\[([^\]]+)\]\]/g,
    '<a class="text-[var(--color-noxe-accent)] underline decoration-[var(--color-noxe-accent)]/30 underline-offset-2 hover:decoration-[var(--color-noxe-accent)]" href="#">$1</a>',
  )
  out = out.replace(/`([^`]+)`/g, '<code class="rounded bg-[var(--color-noxe-panel-2)] px-1 py-0.5 font-mono text-[0.85em] text-[var(--color-noxe-ink)]">$1</code>')
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  out = out.replace(/(^|\W)_([^_]+)_/g, '$1<em>$2</em>')
  return out
}

export function MockMarkdown({ source }: { source: string }) {
  const html = useMemo(() => {
    const lines = source.split('\n')
    const out: string[] = []
    let inCode = false
    let codeLang = ''
    let codeBuf: string[] = []
    let listType: 'ul' | 'ol' | null = null

    const closeList = () => {
      if (listType) {
        out.push(`</${listType}>`)
        listType = null
      }
    }

    for (const raw of lines) {
      if (raw.startsWith('```')) {
        if (!inCode) {
          closeList()
          inCode = true
          codeLang = raw.slice(3).trim()
          codeBuf = []
        } else {
          inCode = false
          out.push(
            `<pre class="my-4 overflow-x-auto rounded-lg border border-[var(--color-noxe-border)] bg-[var(--color-noxe-panel-2)] p-3 text-[13px]"><code class="font-mono text-[var(--color-noxe-ink)]" data-lang="${escapeHtml(
              codeLang,
            )}">${escapeHtml(codeBuf.join('\n'))}</code></pre>`,
          )
          codeBuf = []
          codeLang = ''
        }
        continue
      }
      if (inCode) {
        codeBuf.push(raw)
        continue
      }

      const line = raw

      if (/^#\s+/.test(line)) {
        closeList()
        out.push(`<h1 class="mt-2 mb-3 text-[28px] font-semibold tracking-tight">${inline(line.replace(/^#\s+/, ''))}</h1>`)
        continue
      }
      if (/^##\s+/.test(line)) {
        closeList()
        out.push(`<h2 class="mt-6 mb-2 text-[20px] font-semibold tracking-tight">${inline(line.replace(/^##\s+/, ''))}</h2>`)
        continue
      }
      if (/^###\s+/.test(line)) {
        closeList()
        out.push(`<h3 class="mt-5 mb-2 text-[16px] font-semibold">${inline(line.replace(/^###\s+/, ''))}</h3>`)
        continue
      }
      if (/^>\s+/.test(line)) {
        closeList()
        out.push(`<blockquote class="my-3 border-l-2 border-[var(--color-noxe-border-strong)] pl-3 text-[var(--color-noxe-muted)] italic">${inline(line.replace(/^>\s+/, ''))}</blockquote>`)
        continue
      }
      const taskMatch = line.match(/^-\s\[( |x)\]\s+(.*)$/)
      if (taskMatch) {
        if (listType !== 'ul') {
          closeList()
          listType = 'ul'
          out.push('<ul class="my-2 space-y-1 pl-1">')
        }
        const checked = taskMatch[1] === 'x'
        out.push(
          `<li class="flex items-start gap-2"><input type="checkbox" ${checked ? 'checked' : ''} disabled class="mt-1 accent-[var(--color-noxe-accent)]"/><span class="${checked ? 'text-[var(--color-noxe-muted)] line-through' : ''}">${inline(taskMatch[2])}</span></li>`,
        )
        continue
      }
      if (/^-\s+/.test(line)) {
        if (listType !== 'ul') {
          closeList()
          listType = 'ul'
          out.push('<ul class="my-2 list-disc space-y-1 pl-6">')
        }
        out.push(`<li>${inline(line.replace(/^-\s+/, ''))}</li>`)
        continue
      }
      if (/^\d+\.\s+/.test(line)) {
        if (listType !== 'ol') {
          closeList()
          listType = 'ol'
          out.push('<ol class="my-2 list-decimal space-y-1 pl-6">')
        }
        out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`)
        continue
      }
      if (line.trim() === '') {
        closeList()
        continue
      }
      closeList()
      out.push(`<p class="my-3 leading-7 text-[15px]">${inline(line)}</p>`)
    }
    closeList()
    return out.join('\n')
  }, [source])

  return <div className="prose-noxe" dangerouslySetInnerHTML={{ __html: html }} />
}
