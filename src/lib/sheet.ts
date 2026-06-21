/**
 * Parsing data tabel penerima dari CSV / TSV (paste Excel/Sheets) / XLSX
 * menjadi baris terstruktur { phone, name, message, file }.
 */

export interface SheetRow {
  phone: string
  name: string
  message: string
  file: string
}

const SYNONYMS = {
  phone: ['nomor', 'no', 'nohp', 'no hp', 'no_hp', 'hp', 'phone', 'telepon', 'telp', 'whatsapp', 'wa', 'number', 'no telp'],
  name: ['nama', 'name', 'tujuan', 'penerima', 'contact', 'kontak'],
  message: ['pesan', 'message', 'text', 'teks', 'isi', 'msg', 'content', 'caption'],
  file: ['file', 'lampiran', 'attachment', 'media', 'gambar', 'foto', 'dokumen', 'berkas'],
} as const

type ColKey = keyof typeof SYNONYMS

function matchHeader(cell: string): ColKey | null {
  const c = cell.trim().toLowerCase()
  for (const key of Object.keys(SYNONYMS) as ColKey[]) {
    if ((SYNONYMS[key] as readonly string[]).includes(c)) return key
  }
  return null
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? ''
  const tabs = (firstLine.match(/\t/g) ?? []).length
  const semis = (firstLine.match(/;/g) ?? []).length
  const commas = (firstLine.match(/,/g) ?? []).length
  if (tabs > 0) return '\t'
  if (semis > commas) return ';'
  return ','
}

/** Parser delimited sederhana yang menghormati tanda kutip ganda (RFC4180-ish). */
function parseDelimited(text: string, delim: string): string[][] {
  const rows: string[][] = []
  let field = ''
  let row: string[] = []
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
      continue
    }
    if (c === delim) {
      row.push(field)
      field = ''
      i++
      continue
    }
    if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
      continue
    }
    if (c === '\r') {
      i++
      continue
    }
    field += c
    i++
  }
  row.push(field)
  rows.push(row)
  return rows
}

/** Ubah matriks string (array of rows) menjadi SheetRow, dengan deteksi header. */
export function matrixToRows(matrix: string[][]): SheetRow[] {
  const data = matrix.filter(r => r.some(c => (c ?? '').toString().trim() !== ''))
  if (data.length === 0) return []

  const first = data[0].map(c => (c ?? '').toString())
  const map: Partial<Record<ColKey, number>> = {}
  first.forEach((cell, idx) => {
    const k = matchHeader(cell)
    if (k && map[k] === undefined) map[k] = idx
  })

  let bodyStart = 0
  let idx: Record<ColKey, number> = { phone: 0, name: 1, message: 2, file: 3 }

  // Mode header hanya bila kolom nomor terdeteksi dari baris pertama
  if (map.phone !== undefined) {
    bodyStart = 1
    idx = {
      phone: map.phone,
      name: map.name ?? -1,
      message: map.message ?? -1,
      file: map.file ?? -1,
    }
  }

  const get = (row: string[], i: number) =>
    i >= 0 && i < row.length ? (row[i] ?? '').toString().trim() : ''

  const out: SheetRow[] = []
  for (let r = bodyStart; r < data.length; r++) {
    const row = data[r]
    const phone = get(row, idx.phone)
    const name = get(row, idx.name)
    const message = get(row, idx.message)
    const file = get(row, idx.file)
    if (!phone && !name && !message && !file) continue
    out.push({ phone, name, message, file })
  }
  return out
}

export function parseSheetText(text: string): SheetRow[] {
  if (!text.trim()) return []
  return matrixToRows(parseDelimited(text, detectDelimiter(text)))
}

export async function parseSheetFile(file: File): Promise<SheetRow[]> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buf = await file.arrayBuffer()
    const wb = XLSX.read(buf, { type: 'array' })
    const sheet = wb.Sheets[wb.SheetNames[0]]
    if (!sheet) return []
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as unknown[][]
    return matrixToRows(matrix.map(r => (r ?? []).map(c => (c ?? '').toString())))
  }
  // csv / tsv / txt
  return parseSheetText(await file.text())
}

/** Ganti placeholder {nama} & {nomor} dengan nilai baris. */
export function applyTemplate(message: string, vars: { nama: string; nomor: string }): string {
  return message.replace(/\{nama\}/gi, vars.nama).replace(/\{nomor\}/gi, vars.nomor)
}

/** Isi file template CSV untuk diunduh. */
export const TEMPLATE_CSV = [
  'nomor,nama,pesan,file',
  '628123456789,Budi,Halo {nama} selamat pagi,',
  '628987654321,Sari,Promo khusus untukmu {nama},promo.jpg',
  '08123456789,Andi,Terima kasih sudah berlangganan,',
].join('\n')
