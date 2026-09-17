import React from 'react'
import { View, ScrollView } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { localeLang } from '~/i18next/utils'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'
import SelectItem from '~/components/settings/SelectItem'

const languages = [
	{ lang: 'ca', name: 'Català', color: '#FCDD09', flag: '🇦🇩' },
	{ lang: 'de', name: 'Deutsch', color: '#dddddd', flag: '🇩🇪' },
	{ lang: 'en', name: 'English', color: '#dc3545', flag: '🇬🇧' },
	{ lang: 'es', name: 'Español', color: '#af0d12', flag: '🇪🇸' },
	{ lang: 'fr', name: 'Français', color: '#007bff', flag: '🇫🇷' },
	{ lang: 'gl', name: 'Galego', color: '#2195ddff', flag: '🇪🇸' },
	{ lang: 'it', name: 'Italiano', color: '#28a745', flag: '🇮🇹' },
	{ lang: 'ja', name: '日本語', color: '#BC002D', flag: '🇯🇵' },
	{ lang: 'ko', name: '한국어', color: '#0047A0', flag: '🇰🇷' },
	{ lang: 'ptBr', name: "Português do Brasil", color: '#302681', flag: '🇧🇷' },
	{ lang: 'ru', name: 'Русский', color: '#ffc107', flag: '🇷🇺' },
	{ lang: 'zhHans', name: '简体中文', color: '#FF0000', flag: '🇨🇳' },
	{ lang: 'zhHant', name: '正體中文', color: '#0000AA', flag: '🇹🇼' },
]

const sysLang = localeLang()

const Language = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const theme = useTheme()

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
		>
			<Header title={t("Language")} />
			<View style={settingStyles.contentMainContainer}>
				<Text style={settingStyles.titleContainer(theme)}>{t('Language')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<SelectItem
						text={`${t('System default')} (${sysLang || t('Not found')})`}
						emoji={'🖥️'}
						colorIcon={'white'}
						isSelect={!settings.language}
						onPress={() => {
							setSettings({ ...settings, language: null })
						}}
					/>
					{
						languages.map((lang, index) => (
							<SelectItem
								key={index}
								text={lang.name}
								emoji={lang.flag}
								colorIcon={lang.color}
								isSelect={lang.lang == settings.language}
								onPress={() => {
									setSettings({ ...settings, language: lang.lang })
								}}
							/>
						))
					}
				</View>
				<Text
					style={settingStyles.description(theme)}
				>{t('settings.language.description')}</Text>
			</View>
		</ScrollView>
	)
}


export default Language
