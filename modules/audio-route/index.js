import { requireOptionalNativeModule } from 'expo-modules-core'

// Модуль есть только на Android; на других платформах молча ничего не делаем
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

// Отключены ли ограничения батареи для приложения
export const isIgnoringBatteryOptimizations = () => callBoolean('isIgnoringBatteryOptimizations')

// Системные окна: работа в фоне, «Режимы и routines», Bluetooth
export const openBatteryOptimizationSettings = () => callBoolean('openBatteryOptimizationSettings')
export const openRoutines = () => callBoolean('openRoutines')
export const openBluetoothSettings = () => callBoolean('openBluetoothSettings')

// Вызывает обработчик, когда подключили наушники или колонку.
// Возвращает функцию для отписки.
export const addDeviceConnectedListener = (listener) => {
	if (!AudioRoute) return () => { }
	const subscription = AudioRoute.addListener('onDeviceConnected', listener)
	return () => subscription.remove()
}
