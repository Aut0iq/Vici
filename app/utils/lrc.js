// Разбор LRC: поддерживает [mm:ss], [mm:ss.x], [mm:ss.xx], [mm:ss.xxx],
// несколько меток на одной строке и тег [offset:±ms]
export const parseLrc = (lrc) => {
	if (typeof lrc !== 'string' || !lrc.length) return []
	const TAG = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g
	const offsetMatch = lrc.match(/\[offset:\s*([+-]?\d+)\s*\]/i)
	const offset = offsetMatch ? parseInt(offsetMatch[1], 10) / 1000 : 0
	const lyrics = []

	for (const rawLine of lrc.split(/\r?\n/)) {
		const times = []
		let match
		TAG.lastIndex = 0
		while ((match = TAG.exec(rawLine)) !== null) {
			const fraction = match[3] ? parseInt(match[3], 10) / Math.pow(10, match[3].length) : 0
			times.push(parseInt(match[1], 10) * 60 + parseInt(match[2], 10) + fraction)
		}
		if (!times.length) continue
		const text = rawLine.replace(TAG, '').trim()
		for (const time of times) lyrics.push({ time: Math.max(0, time - offset), text })
	}
	return lyrics.sort((a, b) => a.time - b.time)
}
