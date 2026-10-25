import React from 'react'
import { View, ScrollView, Linking, Platform } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { confirmAlert } from '~/utils/alert'
import { useSetSettings, defaultSettings, useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import ButtonMenu from '~/components/settings/ButtonMenu'
import ButtonSwitch from '~/components/settings/ButtonSwitch'
import mainStyles from '~/styles/main'
import settingStyles from '~/styles/settings'
import ScreenBackground from '~/components/ScreenBackground'
import BrandCard from '~/components/settings/BrandCard'

const Settings = ({ navigation }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const config = useConfig()
	const theme = useTheme()
	const setSettings = useSetSettings()
	const setting = useSettings()

	return (
		<ScreenBackground>
		<ScrollView
			style={{ flex: 1 }}
			contentContainerStyle={[
				mainStyles.contentMainContainer(insets),
				settingStyles.contentMainContainer
			]}
		>
			<Text style={[mainStyles.mainTitle(theme), { alignSelf: 'flex-start', marginHorizontal: 0, marginTop: 30, marginBottom: 20 }]}>{t('tabs.Settings')}</Text>
			<BrandCard />
			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonMenu
					title={t("Connect")}
					endText={config.query ? (config.name?.length ? config.name : t('Connected')) : t('Not connected')}
					icon="server"
					onPress={() => navigation.navigate('Connect')}
					isLast
				/>
			</View>

			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonSwitch
					title={t("Desktop")}
					icon="desktop"
					value={setting.isDesktop}
					onPress={() => setSettings({ ...setting, isDesktop: !setting.isDesktop })}
					isLast />
			</View>

			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonMenu
					title={t("Home")}
					icon="home"
					onPress={() => navigation.navigate('Settings/Home')}
				/>
				<ButtonMenu
					title={t("Tabs")}
					icon="columns"
					onPress={() => navigation.navigate('Settings/Tabs')}
				/>
				<ButtonMenu
					title={t("Playlists")}
					icon="list-ul"
					onPress={() => navigation.navigate('Settings/Playlists')}
				/>
				<ButtonMenu
					title={t("Player")}
					icon="play"
					onPress={() => navigation.navigate('Settings/Player')}
				/>
				<ButtonMenu
					title={t("Cache")}
					icon="database"
					onPress={() => navigation.navigate('Settings/Cache')}
					isLast
				/>
			</View>
			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonMenu
					title={t("Theme")}
					icon="tint"
					onPress={() => navigation.navigate('Settings/Theme')}
				/>
				<ButtonMenu
					title={t("Language")}
					icon="language"
					onPress={() => navigation.navigate('Settings/Language')}
				/>
				<ButtonMenu
					title="Last.fm"
					icon="lastfm"
					onPress={() => navigation.navigate('Settings/LastFm')}
					isLast
				/>
			</View>

			{config.query && (
				<View style={settingStyles.optionsContainer(theme)}>
					<ButtonMenu
						title={t("Shares")}
						icon="link"
						onPress={() => navigation.navigate('Settings/Shares')}
					/>
					<ButtonMenu
						title={t("Logs")}
						icon="file-text"
						onPress={() => navigation.navigate('Settings/Logs')}
					/>
					{Platform.OS !== 'web' && (
						<>
							<ButtonMenu
								title="Coda"
								icon="cloud-download"
								onPress={() => navigation.navigate('Settings/Coda')}
							/>
							<ButtonMenu
								title={t('Import')}
								icon="upload"
								onPress={() => navigation.navigate('Settings/Import')}
							/>
						</>
					)}
					<ButtonMenu
						title={t("Informations")}
						icon="info"
						onPress={() => navigation.navigate('Settings/Informations')}
						isLast
					/>
				</View>
			)}

			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonMenu
					title="Github"
					icon="github"
					onPress={() => Linking.openURL('https://github.com/Aut0iq/Vici')}
					isLast
				/>
			</View>

			<View style={settingStyles.optionsContainer(theme)}>
				<ButtonMenu
					title={t("Reset Settings")}
					icon="undo"
					onPress={() => {
						confirmAlert(
							t('Reset Settings'),
							'Are you sure you want to reset all settings?',
							() => setSettings({
								...JSON.parse(JSON.stringify(defaultSettings)),
								servers: setting.servers
							})
						)
					}}
					isLast
				/>
			</View>

		</ScrollView>
		</ScreenBackground>
	)
}

export default Settings