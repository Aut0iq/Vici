import { isForeground, onBackground } from '~/utils/foreground'

const TRANSIENT_DELAY = 350

let timer = null
let pending = null

const flush = () => {
	clearTimeout(timer)
	timer = null
	const report = pending
	pending = null
	if (report) report()
}

onBackground(flush)

const reportState = (songDispatch, state, isTransient = false) => {
	clearTimeout(timer)
	timer = null
	pending = null
	if (!isTransient || !isForeground()) {
		songDispatch({ type: 'setState', state })
		return
	}
	pending = () => songDispatch({ type: 'setState', state })
	timer = setTimeout(flush, TRANSIENT_DELAY)
}

export default reportState
