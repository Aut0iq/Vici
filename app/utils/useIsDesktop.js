import { Platform, useWindowDimensions } from 'react-native'

import { useSettings } from '~/contexts/settings'

// С этой ширины окно считается настольным: боковое меню, очередь справа,
// полоса плеера внизу. На телефоне раскладка включается только галочкой в настройках
export const DESKTOP_WIDTH = 1000

// Ширина колонки с очередью воспроизведения
export const QUEUE_WIDTH = 340

const useIsDesktop = () => {
	const settings = useSettings()
	const { width } = useWindowDimensions()

	if (settings.isDesktop) return true
	return Platform.OS === 'web' && width >= DESKTOP_WIDTH
}

export default useIsDesktop
