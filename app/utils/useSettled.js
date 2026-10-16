import React from 'react'

import { isForeground, onBackground } from '~/utils/foreground'

const useSettled = (value, delay = 700) => {
	const [settled, setSettled] = React.useState(value)
	const lastChange = React.useRef(0)
	const pending = React.useRef(null)

	React.useEffect(() => onBackground(() => {
		if (!pending.current) return
		const next = pending.current.value
		pending.current = null
		setSettled(next)
	}), [])

	React.useEffect(() => {
		if (Object.is(value, settled)) {
			pending.current = null
			return
		}
		const now = Date.now()
		const isBurst = now - lastChange.current < delay
		lastChange.current = now
		if (!isBurst || !isForeground()) {
			pending.current = null
			setSettled(value)
			return
		}
		pending.current = { value }
		const timer = setTimeout(() => {
			pending.current = null
			setSettled(value)
		}, delay)
		return () => clearTimeout(timer)
	}, [value])

	return settled
}

export default useSettled
