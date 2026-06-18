import type { JSONContent } from '@tiptap/react'

function nodeToText(node: JSONContent): string {
  if (!node) return ''

  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map(nodeToText).join('')

    case 'paragraph': {
      const inner = (node.content ?? []).map(nodeToText).join('')
      return inner + '\n'
    }

    case 'hardBreak':
      return '\n'

    case 'text': {
      const text = node.text ?? ''
      const marks = node.marks ?? []
      const hasBold = marks.some(m => m.type === 'bold')
      const hasItalic = marks.some(m => m.type === 'italic')
      const hasStrike = marks.some(m => m.type === 'strike')
      const hasCode = marks.some(m => m.type === 'code')

      if (hasCode) return `\`\`\`${text}\`\`\``
      if (hasBold && hasItalic) return `*_${text}_*`
      if (hasBold) return `*${text}*`
      if (hasItalic) return `_${text}_`
      if (hasStrike) return `~${text}~`
      return text
    }

    default:
      return (node.content ?? []).map(nodeToText).join('')
  }
}

export function tiptapToWhatsApp(json: JSONContent): string {
  return nodeToText(json).replace(/\n+$/, '')
}
