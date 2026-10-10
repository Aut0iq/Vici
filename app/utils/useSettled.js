import React from 'react'

const useSettled = (value, delay = 250) => {
	const [settled, setSettled] = React.useState(value)
	const lastChange = React.useRef(0)

	React.useEffect(() => {
		if (Object.is(value, settled)) return
		const now = Date.now()
		const isBurst = now - lastChange.current < delay
		lastChange.current = now
		if (!isBurst) {
			setSettled(value)
			return
		}
		const timer = setTimeout(() => setSettled(value), delay)
		return () => clearTimeout(timer)
	}, [value])

	return settled
}

export default useSettled
