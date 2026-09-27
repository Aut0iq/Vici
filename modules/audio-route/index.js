import { requireOptionalNativeModule } from 'expo-modules-core'

const AudioRoute = requireOptionalNativeModule('AudioRoute')

export const isExternalConnected = async () => {
	if (!AudioRoute) return false
	try {
		return await AudioRoute.isExternalConnected()
	} catch {
		return false
	}
}

const callBoolean = async (method) => {
	if (!AudioRoute) return false
	try {
		return await AudioRoute[method]()
	} catch {
		return false
	}
}

export const isIgnoringBatteryOptimizations = () => callBoolean('isIgnoringBatteryOptimizations')

export const openBatteryOptimizationSettings = () => callBoolean('openBatteryOptimizationSettings')

export const addDeviceConnectedListener = (listener) => {
	if (!AudioRoute) return () => { }
	const subscription = AudioRoute.addListener('onDeviceConnected', listener)
	return () => subscription.remove()
}
