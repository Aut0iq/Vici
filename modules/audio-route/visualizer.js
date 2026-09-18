import { requireOptionalNativeModule } from 'expo-modules-core'
import { PermissionsAndroid, Platform } from 'react-native'

const AudioVisualizer = requireOptionalNativeModule('AudioVisualizer')

export const isVisualizerAvailable = () => !!AudioVisualizer

// Android требует разрешение на запись звука, чтобы читать спектр играющей музыки.
// Микрофон при этом не используется.
export const requestVisualizerPermission = async () => {
	if (Platform.OS !== 'android') return false
	const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
	return granted === PermissionsAndroid.RESULTS.GRANTED
}

export const hasVisualizerPermission = async () => {
	if (Platform.OS !== 'android') return false
	return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
}

// Запускает чтение звука.
// onBands получает { bands, level } — для простых эффектов,
// onWave получает { wave } — волну для butterchurn
export const startVisualizer = async (bands, { onBands = null, onWave = null } = {}) => {
	if (!AudioVisualizer) return null
	const subscriptions = []
	if (onBands) subscriptions.push(AudioVisualizer.addListener('onBands', onBands))
	if (onWave) subscriptions.push(AudioVisualizer.addListener('onWave', onWave))
	const started = await AudioVisualizer.start(bands).catch(() => false)
	if (!started) {
		subscriptions.forEach((s) => s.remove())
		return null
	}
	return () => {
		subscriptions.forEach((s) => s.remove())
		AudioVisualizer.stop().catch(() => { })
	}
}
