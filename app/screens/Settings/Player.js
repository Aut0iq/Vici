import React from 'react'
import { View, ScrollView, AppState } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useSettings } from '~/contexts/settings'
import { useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import ButtonMenu from '~/components/settings/ButtonMenu'
import ButtonSwitch from '~/components/settings/ButtonSwitch'
import Header from '~/components/Header'
import mainStyles from '~/styles/main'
import SelectItem from '~/components/settings/SelectItem'
import {
	isIgnoringBatteryOptimizations,
	openBatteryOptimizationSettings,
	openRoutines,
	openBluetoothSettings,
} from '~/../modules/audio-route'
import settingStyles from '~/styles/settings'

const FORMATS = [
	{ name: 'Raw', value: 'raw' },
	{ name: 'MP3', value: 'mp3' },
	{ name: 'AAC', value: 'aac' },
	{ name: 'Opus', value: 'opus' },
]

const BITRATES = [
	{ name: 'Default', value: 0 },
	{ name: '32', value: 32 },
	{ name: '48', value: 48 },
	{ name: '64', value: 64 },
	{ name: '80', value: 80 },
	{ name: '96', value: 96 },
	{ name: '112', value: 112 },
	{ name: '128', value: 128 },
	{ name: '160', value: 160 },
	{ name: '192', value: 192 },
	{ name: '256', value: 256 },
	{ name: '320', value: 320 },
]

const PlayerSettings = () => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const [batteryFree, setBatteryFree] = React.useState(null)
	const [noRoutines, setNoRoutines] = React.useState(false)

	// Проверяем ограничения батареи при открытии экрана и после возврата из системных настроек
	React.useEffect(() => {
		const check = () => isIgnoringBatteryOptimizations().then(setBatteryFree)
		check()
		const subscription = AppState.addEventListener('change', (state) => {
			if (state === 'active') check()
		})
		return () => subscription.remove()
	}, [])

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
		>
			<Header title={t("Player")} />

			<View style={settingStyles.contentMainContainer}>
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.player.Headphones')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<ButtonSwitch
						title={t('settings.player.Play on connect')}
						icon="headphones"
						value={settings.playOnHeadphonesConnect}
						onPress={() => setSettings({ ...settings, playOnHeadphonesConnect: !settings.playOnHeadphonesConnect })}
					/>
					<ButtonMenu
						title={batteryFree ? t('settings.player.Background allowed') : t('settings.player.Allow background')}
						icon={batteryFree ? 'check' : 'battery-half'}
						onPress={() => openBatteryOptimizationSettings()}
					/>
					<ButtonMenu
						title={t('settings.player.Open routines')}
						icon="magic"
						onPress={() => openRoutines().then((ok) => setNoRoutines(!ok))}
					/>
					<ButtonMenu
						title={t('settings.player.Bluetooth settings')}
						icon="bluetooth"
						onPress={() => openBluetoothSettings()}
						isLast
					/>
				</View>
				<Text style={settingStyles.description(theme)}>
					{noRoutines ? t('settings.player.Routines not found') : t('settings.player.Play on connect Description')}
				</Text>

				<Text style={settingStyles.titleContainer(theme)}>{t('settings.player.Stream format')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					{FORMATS.map((item, index) => (
						<SelectItem
							key={index}
							text={item.name}
							icon={'file-audio-o'}
							isSelect={item.value === settings.streamFormat}
							onPress={() => {
								setSettings({ ...settings, streamFormat: item.value })
							}}
						/>
					))}
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.player.Stream format Description')}</Text>

				<Text style={settingStyles.titleContainer(theme)}>{t('settings.player.Max bitrate')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					{
						BITRATES.map((item, index) => (
							<SelectItem
								key={index}
								text={item.name}
								icon={'tachometer'}
								isSelect={item.value === settings.maxBitRate}
								onPress={() => {
									setSettings({ ...settings, maxBitRate: item.value })
								}}
								disabled={settings.streamFormat === 'raw'}
							/>
						))
					}
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.player.Max bitrate Description')}</Text>

				<Text style={settingStyles.titleContainer(theme)}>{t('Play similar songs')}</Text>
				<View style={settingStyles.optionsContainer(theme)}>
					<ButtonSwitch
						title={t('settings.player.Play seed first')}
						value={settings.playSeedFirst}
						onPress={() => setSettings({ ...settings, playSeedFirst: !settings.playSeedFirst })}
						isLast
					/>
				</View>
				<Text style={settingStyles.titleContainer(theme)}>{t('Queue')}</Text>
				<View style={settingStyles.optionsContainer(theme, true)}>
					<ButtonSwitch
						title={t('Enable repeat queue')}
						value={settings.repeatQueue}
						onPress={() => setSettings({ ...settings, repeatQueue: !settings.repeatQueue })}
					/>
					<ButtonSwitch
						title={t('settings.player.Save last queue')}
						value={settings.saveQueue}
						onPress={() => setSettings({ ...settings, saveQueue: !settings.saveQueue })}
						isLast
					/>
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.player.Save last queue Description')}</Text>
			</View>
		</ScrollView>
	)
}

export default PlayerSettings