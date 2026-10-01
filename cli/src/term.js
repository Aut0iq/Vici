import readline from 'node:readline'

const ESC = '\x1b['
const truecolor = /truecolor|24bit/i.test(process.env.COLORTERM || '')

const fg = (r, g, b, fallback) => (truecolor ? `${ESC}38;2;${r};${g};${b}m` : `${ESC}38;5;${fallback}m`)
const bg = (r, g, b, fallback) => (truecolor ? `${ESC}48;2;${r};${g};${b}m` : `${ESC}48;5;${fallback}m`)

export const style = {
	reset: `${ESC}0m`,
	bold: `${ESC}1m`,
	gold: fg(230, 189, 85, 179),
	text: fg(236, 230, 220, 254),
	muted: fg(150, 140, 135, 245),
	accent: fg(196, 76, 96, 167),
	selected: bg(58, 36, 44, 237),
}

const charWidth = (code) => {
	if (code === 0 || code < 32 || (code >= 0x7f && code < 0xa0)) return 0
	if ((code >= 0x300 && code <= 0x36f) || (code >= 0x200b && code <= 0x200f) || (code >= 0xfe00 && code <= 0xfe0f)) return 0
	if (
		(code >= 0x1100 && code <= 0x115f) ||
		(code >= 0x2e80 && code <= 0xa4cf) ||
		(code >= 0xac00 && code <= 0xd7a3) ||
		(code >= 0xf900 && code <= 0xfaff) ||
		(code >= 0xfe30 && code <= 0xfe4f) ||
		(code >= 0xff00 && code <= 0xff60) ||
		(code >= 0xffe0 && code <= 0xffe6) ||
		(code >= 0x1f300 && code <= 0x1faff) ||
		(code >= 0x20000 && code <= 0x3fffd)
	) return 2
	return 1
}

export const width = (text) => {
	let total = 0
	for (const char of String(text)) total += charWidth(char.codePointAt(0))
	return total
}

export const fit = (text, size, align = 'left') => {
	if (size <= 0) return ''
	const source = String(text ?? '').replace(/[\r\n\t]+/g, ' ')
	let out = ''
	let used = 0
	if (width(source) <= size) {
		out = source
		used = width(source)
	} else {
		for (const char of source) {
			const w = charWidth(char.codePointAt(0))
			if (used + w > size - 1) break
			out += char
			used += w
		}
		out += '…'
		used += 1
	}
	const pad = ' '.repeat(Math.max(0, size - used))
	return align === 'right' ? pad + out : out + pad
}

export const formatTime = (seconds) => {
	if (!Number.isFinite(seconds) || seconds < 0) return '--:--'
	const total = Math.floor(seconds)
	const h = Math.floor(total / 3600)
	const m = Math.floor((total % 3600) / 60)
	const s = total % 60
	const mm = String(m).padStart(2, '0')
	const ss = String(s).padStart(2, '0')
	return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export const size = () => ({
	cols: process.stdout.columns || 80,
	rows: process.stdout.rows || 24,
})

let active = false

export const enter = () => {
	if (active) return
	active = true
	readline.emitKeypressEvents(process.stdin)
	process.stdin.setRawMode(true)
	process.stdin.resume()
	process.stdout.write(`${ESC}?1049h${ESC}?25l`)
}

export const leave = () => {
	if (!active) return
	active = false
	process.stdout.write(`${style.reset}${ESC}?25h${ESC}?1049l`)
	if (process.stdin.isTTY) process.stdin.setRawMode(false)
	process.stdin.pause()
}

export const draw = (lines) => {
	process.stdout.write(`${ESC}H${lines.map((line) => `${line}${style.reset}${ESC}K`).join('\r\n')}${ESC}J`)
}

export const onKey = (handler) => {
	process.stdin.on('keypress', (text, key) => handler(text, key || {}))
}

export const onResize = (handler) => {
	process.stdout.on('resize', handler)
}
