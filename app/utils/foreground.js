import { AppState } from 'react-native'

export const isForeground = () => AppState.currentState === 'active'

export const onBackground = (callback) => {
	const subscription = AppState.addEventListener('change', (state) => {
		if (state !== 'active') callback()
	})
	return () => subscription.remove()
}
