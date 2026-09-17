import React from 'react'
import { Platform } from 'react-native'
import { initialWindowMetrics, SafeAreaProvider } from 'react-native-safe-area-context'
import { useFonts } from 'expo-font'
import { Manrope_400Regular, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope'
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel'

import '~/i18next/i18next'
import { version } from '~/../package.json'
import AppProvider from '~/contexts'
import logger from '~/utils/logger'
import Navigation from '~/components/Navigation'


global.maxBitRate = 0
global.streamFormat = 'mp3'

const App = () => {
	// Загружаем шрифты Vici. Если не получилось — приложение всё равно запустится со стандартным шрифтом
	const [fontsLoaded, fontsError] = useFonts({
		Manrope_400Regular,
		Manrope_500Medium,
		Manrope_600SemiBold,
		Manrope_700Bold,
		Manrope_800ExtraBold,
		Cinzel_700Bold,
	})

	React.useEffect(() => {
		logger.info('App', `App started (version: ${version}, platform: ${Platform.OS} ${Platform.Version})`)
	}, [])

	React.useEffect(() => {
		if (fontsError) logger.error('Fonts', `Fonts failed to load: ${fontsError?.message || fontsError}`)
		else if (fontsLoaded) logger.info('Fonts', 'Fonts loaded')
	}, [fontsLoaded, fontsError])

	if (!fontsLoaded && !fontsError) return null

	return (
		<AppProvider>
			<SafeAreaProvider initialMetrics={initialWindowMetrics}>
				<Navigation />
			</SafeAreaProvider>
		</AppProvider>
	)
}

export default App