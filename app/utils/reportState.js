const TRANSIENT_DELAY = 350

let timer = null

const reportState = (songDispatch, state, isTransient = false) => {
	clearTimeout(timer)
	timer = null
	if (!isTransient) {
		songDispatch({ type: 'setState', state })
		return
	}
	timer = setTimeout(() => {
		timer = null
		songDispatch({ type: 'setState', state })
	}, TRANSIENT_DELAY)
}

export default reportState
