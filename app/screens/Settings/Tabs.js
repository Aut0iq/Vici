import React from 'react'
import { View, ScrollView } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import ButtonSwitch from '~/components/settings/ButtonSwitch'
import Header from '~/components/Header'
import TabsOrder from '~/components/settings/TabsOrder'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'

const TabsSettings = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const settings = useSettings()
	const setSettings = useSetSettings()

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
		>
			<Header title={t('Tabs')} />

			<View style={settingStyles.contentMainContainer}>
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.tabs.Bottom bar')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<TabsOrder />
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.tabs.Bottom bar Description')}</Text>

				<Text style={settingStyles.titleContainer(theme)}>{t('settings.tabs.Swipe')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<ButtonSwitch
						title={t('settings.tabs.Switch by swipe')}
						icon="arrows-h"
						value={settings.tabSwipe !== false}
						onPress={() => setSettings({ ...settings, tabSwipe: settings.tabSwipe === false })}
						isLast
					/>
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.tabs.Swipe Description')}</Text>
			</View>
		</ScrollView>
	)
}

export default TabsSettings
