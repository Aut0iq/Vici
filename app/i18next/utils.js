import { Platform, NativeModules } from 'react-native'

const langOf = (locale) => {
	if (/^zh.*(hant|[-_](tw|hk|mo))/i.test(locale || '')) return 'zhHant'
	return (locale || '').substring(0, 2)
}

export const localeLang = () => {
	if (Platform.OS === 'android') return langOf(NativeModules.I18nManager.localeIdentifier)
	else if (Platform.OS === 'web') return langOf(navigator.language || navigator.userLanguage || 'en')
	return null
}