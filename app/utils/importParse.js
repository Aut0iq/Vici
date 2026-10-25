const TITLE_COLUMNS = ['track name', 'track title', 'title', 'song', 'track', 'name', 'название', 'трек', 'песня']
const ARTIST_COLUMNS = ['artist name(s)', 'artist names', 'artist name', 'artists', 'artist', 'исполнитель', 'исполнители', 'артист']
const ALBUM_COLUMNS = ['album name', 'album title', 'album', 'альбом']
const DURATION_COLUMNS = ['duration (ms)', 'duration_ms', 'duration', 'длительность']

const DASH = /\s+[-–—]\s+/
const NUMBER = /^\s*\d+\s*[.)]\s*/

const NOISE = [
	/\s*[([](?:from|из)\s[^)\]]*[)\]]/gi,
	/\s*[([](?:feat|ft|with|при участии)\.?\s[^)\]]*[)\]]/gi,
	/\s+(?:feat|ft)\.\s.*$/i,
	/\s+feat\s.*$/i,
	/\s*[([][^)\]]*\b(?:remaster(?:ed)?|radio edit|radio mix|album version|single version|version|mix|edit|live)\b[^)\]]*[)\]]/gi,
	/\s+[-–—]\s+(?:\d{4}\s+)?(?:digital\s+)?(?:remaster(?:ed)?|radio edit|album version|single version|original mix|live)\b.*$/i,
]

const PUNCTUATION = /[!-/:-@[-`{-~«»“”„‘’´·•…‐-―]/g

export const cleanTitle = (title) => {
	let value = String(title || '')
	for (const pattern of NOISE) value = value.replace(pattern, '')
	return value.trim() || String(title || '').trim()
}

export const normalize = (text) => String(text || '')
	.toLowerCase()
	.normalize('NFKD')
	.replace(/[̀-ͯ]/g, '')
	.replace(/ё/g, 'е')
	.replace(/&/g, ' and ')
	.replace(PUNCTUATION, ' ')
	.replace(/\s+/g, ' ')
	.trim()

const BOM = String.fromCharCode(0xfeff)

const stripBom = (text) => {
	const value = String(text || '')
	return value.startsWith(BOM) ? value.slice(1) : value
}

const detectDelimiter = (line) => {
	const counts = [',', ';', '\t'].map((char) => [char, line.split(char).length - 1])
	return counts.sort((a, b) => b[1] - a[1])[0][1] ? counts[0][0] : ','
}

export const parseCsv = (text) => {
	const source = stripBom(text)
	const delimiter = detectDelimiter(source.split(/\r?\n/, 1)[0] || '')
	const rows = []
	let row = []
	let field = ''
	let quoted = false
	for (let i = 0; i < source.length; i++) {
		const char = source[i]
		if (quoted) {
			if (char !== '"') field += char
			else if (source[i + 1] === '"') {
				field += '"'
				i++
			} else quoted = false
		} else if (char === '"') {
			quoted = true
		} else if (char === delimiter) {
			row.push(field)
			field = ''
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && source[i + 1] === '\n') i++
			row.push(field)
			rows.push(row)
			row = []
			field = ''
		} else {
			field += char
		}
	}
	if (field || row.length) {
		row.push(field)
		rows.push(row)
	}
	return rows.filter((cells) => cells.some((cell) => cell.trim()))
}

const findColumn = (header, names) => {
	for (const name of names) {
		const index = header.indexOf(name)
		if (index >= 0) return index
	}
	return -1
}

const toSeconds = (value, isMilliseconds) => {
	const text = String(value || '').trim()
	if (!text) return 0
	if (text.includes(':')) return text.split(':').reduce((total, part) => total * 60 + (parseInt(part, 10) || 0), 0)
	const number = parseFloat(text)
	if (!number) return 0
	return Math.round(isMilliseconds || number > 10000 ? number / 1000 : number)
}

const fromTable = (rows) => {
	const header = rows[0].map((cell) => cell.trim().toLowerCase())
	const title = findColumn(header, TITLE_COLUMNS)
	const artist = findColumn(header, ARTIST_COLUMNS)
	if (title < 0) return null
	const album = findColumn(header, ALBUM_COLUMNS)
	const duration = findColumn(header, DURATION_COLUMNS)
	const isMilliseconds = duration >= 0 && header[duration].includes('ms')
	return rows.slice(1).map((cells) => ({
		title: (cells[title] || '').trim(),
		artists: artist < 0 ? [] : (cells[artist] || '').split(';').map((name) => name.trim()).filter(Boolean),
		album: album < 0 ? '' : (cells[album] || '').trim(),
		duration: duration < 0 ? 0 : toSeconds(cells[duration], isMilliseconds),
	}))
}

const fromLines = (text) => stripBom(text)
	.split(/\r?\n/)
	.map((line) => line.replace(NUMBER, '').trim())
	.filter(Boolean)
	.map((line) => {
		const match = line.match(DASH)
		if (!match) return { title: line, artists: [], album: '', duration: 0 }
		const left = line.slice(0, match.index)
		return {
			title: line.slice(match.index + match[0].length).trim(),
			artists: left.split(/\s*,\s*/).map((name) => name.trim()).filter(Boolean),
			album: '',
			duration: 0,
		}
	})

export const parseImport = (text, fileName = '') => {
	const firstLine = stripBom(text).split(/\r?\n/, 1)[0] || ''
	const isTable = /\.(csv|tsv)$/i.test(fileName) || /track name|artist/i.test(firstLine)
	const table = isTable ? fromTable(parseCsv(text)) : null
	const tracks = (table || fromLines(text)).filter((track) => track.title)
	const seen = new Set()
	return tracks.filter((track) => {
		const key = `${normalize(track.artists[0])}|${normalize(cleanTitle(track.title))}`
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})
}

const similarity = (a, b) => {
	if (!a || !b) return 0
	if (a === b) return 1
	if ((a.includes(b) || b.includes(a)) && Math.min(a.length, b.length) / Math.max(a.length, b.length) >= 0.6) return 0.85
	const left = new Set(a.split(' '))
	const right = new Set(b.split(' '))
	let common = 0
	left.forEach((word) => { if (right.has(word)) common += 1 })
	return common / Math.max(left.size, right.size)
}

const artistMatches = (wanted, found) => {
	const target = normalize(found)
	if (!wanted.length) return true
	if (!target) return false
	return wanted.some((name) => {
		const value = normalize(name)
		return value && (value === target || value.includes(target) || target.includes(value))
	})
}

export const searchQuery = (track, withArtist = true) =>
	[withArtist ? track.artists[0] : '', cleanTitle(track.title)].filter(Boolean).join(' ').trim()

export const pickMatch = (track, candidates) => {
	const title = normalize(cleanTitle(track.title))
	let best = null
	for (const candidate of candidates || []) {
		if (!artistMatches(track.artists, candidate.artist)) continue
		const score = similarity(title, normalize(cleanTitle(candidate.title)))
		if (score < 0.85) continue
		const closeDuration = track.duration && candidate.duration && Math.abs(track.duration - candidate.duration) <= 5
		const total = score + (closeDuration ? 0.1 : 0)
		if (!best || total > best.total) best = { candidate, total }
	}
	return best?.candidate || null
}
