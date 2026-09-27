import { Platform, useWindowDimensions } from 'react-native'

import { useSettings } from '~/contexts/settings'

export const DESKTOP_WIDTH = 1000

export const QUEUE_WIDTH = 340

const useIsDesktop = () => {
	const settings = useSettings()
	const { width } = useWindowDimensions()

	if (settings.isDesktop) return true
	return Platform.OS === 'web' && width >= DESKTOP_WIDTH
}

export default useIsDesktop
