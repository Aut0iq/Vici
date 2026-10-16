import { isForeground, onBackground } from '~/utils/foreground'

const SETTLE = 650

let timer = null
let pending = null
let lastSkip = 0

const runPending = () => {
	clearTimeout(timer)
	timer = null
	const load = pending
	pending = null
	if (load) load()
}

onBackground(runPending)

export const loadNow = (load) => {
	clearTimeout(timer)
	timer = null
	pending = null
	return load()
}

export const loadSettled = (load) => {
	const now = Date.now()
	const isBurst = now - lastSkip < SETTLE
	lastSkip = now
	clearTimeout(timer)
	timer = null
	pending = null
	if (!isBurst || !isForeground()) return load()
	pending = load
	timer = setTimeout(runPending, SETTLE)
}
