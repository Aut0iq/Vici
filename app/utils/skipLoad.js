const SETTLE = 250

let timer = null
let lastSkip = 0

export const loadNow = (load) => {
	clearTimeout(timer)
	timer = null
	return load()
}

export const loadSettled = (load) => {
	const now = Date.now()
	const isBurst = now - lastSkip < SETTLE
	lastSkip = now
	clearTimeout(timer)
	timer = null
	if (!isBurst) return load()
	timer = setTimeout(() => {
		timer = null
		load()
	}, SETTLE)
}
