import React from 'react'
import { View, ScrollView, ActivityIndicator } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'

import { clearCache, clearSongCache, getStatCache } from '~/utils/cache'
import { confirmAlert } from '~/utils/alert'
import { cacheSongs, isOfflineSupported, scanLibrary, stopOffline, useOffline } from '~/utils/offline'
import { useConfig } from '~/contexts/config'
import { useSettings, useSetSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import ButtonMenu from '~/components/settings/ButtonMenu'
import ButtonSwitch from '~/components/settings/ButtonSwitch'
import Header from '~/components/Header'
import ListMap from '~/components/lists/ListMap'
import mainStyles from '~/styles/main'
import OptionInput from '~/components/settings/OptionInput'
import settingStyles from '~/styles/settings'
import size from '~/styles/size'
import TableItem from '~/components/settings/TableItem'

const GIGABYTE = 1024 * 1024 * 1024

const formatSize = (bytes) => {
	if (bytes === null || bytes === undefined) return '?'
	if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toFixed(1)} GB`
	return `${Math.round(bytes / (1024 * 1024))} MB`
}

const CacheSettings = () => {
	const { t } = useTranslation()
	const navigation = useNavigation()
	const config = useConfig()
	const offline = useOffline()
	const [isScanning, setIsScanning] = React.useState(false)
	const insets = useSafeAreaInsets()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const theme = useTheme()
	const [cacheNextSong, setCacheNextSong] = React.useState(settings.cacheNextSong.toString())
	const [statCache, setStatCache] = React.useState([
		{ name: 'Loading...', count: '' },
	])

	const getStat = () => {
		getStatCache()
			.then((res) => {
				setStatCache(res)
			})
	}

	React.useEffect(() => {
		getStat()
	}, [offline.running])

	const downloadEverything = async () => {
		if (isScanning) return
		setIsScanning(true)
		try {
			const library = await scanLibrary(config)
			if (!library.missing.length) {
				confirmAlert(t('Download all music'), t('All music is already cached'), () => { })
				return
			}
			const lines = [
				`${t('Songs to download')}: ${library.missing.length}`,
				`${t('Approximate size')}: ${formatSize(library.bytes)}`,
				`${t('Free space on the phone')}: ${formatSize(library.free)}`,
			]
			if (library.free !== null && library.bytes > library.free) lines.push(t('There is not enough free space for all of it'))
			confirmAlert(t('Download all music'), lines.join('\n'), () => cacheSongs(config, library.songs))
		} catch (error) {
			confirmAlert(t('Download all music'), `${t('Could not load the song list')}: ${error?.message || error}`, () => { })
		} finally {
			setIsScanning(false)
		}
	}

	React.useEffect(() => {
		setCacheNextSong(settings.cacheNextSong.toString())
	}, [settings.cacheNextSong])

	React.useEffect(() => {
		if (cacheNextSong === '') return
		const number = parseInt(cacheNextSong)
		if (number === settings.cacheNextSong) return
		setSettings({ ...settings, cacheNextSong: number })
	}, [cacheNextSong])

	return (
		<ScrollView
			style={mainStyles.mainContainer(theme)}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
		>
			<Header title={t("Cache")} />
			<View style={settingStyles.contentMainContainer}>
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.cache.Song caching')}</Text>
				<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
					<ButtonSwitch
						title={t("settings.cache.Enable song caching")}
						value={settings.isSongCaching}
						onPress={() => setSettings({ ...settings, isSongCaching: !settings.isSongCaching })}
					/>
					<ButtonSwitch
						title={t("settings.cache.Show cached songs")}
						value={settings.showCache}
						onPress={() => setSettings({ ...settings, showCache: !settings.showCache })}
					/>
					<OptionInput
						title={t("settings.cache.Cache next song")}
						value={cacheNextSong}
						onChangeText={(text) => setCacheNextSong(text.replace(/[^0-9]/g, ''))}
						inputMode="numeric"
						isLast
					/>
				</View>
				<Text style={settingStyles.description(theme)}>{t('settings.cache.Cache next song description')}</Text>
				<View style={settingStyles.optionsContainer(theme)}>
					<ButtonMenu
						title={t("settings.cache.Clear API cache")}
						icon="trash"
						onPress={() => confirmAlert(
							t('settings.cache.Clear API cache'),
							t('settings.cache.Clear API cache alert message'),
							async () => {
								await clearCache()
								getStat()
							}
						)}
					/>
					<ButtonMenu
						title={t("settings.cache.Clear song cache")}
						icon="trash"
						onPress={() => confirmAlert(
							t('settings.cache.Clear song cache'),
							t('settings.cache.Clear cache alert message'),
							async () => {
								await clearSongCache()
								getStat()
							}
						)}
						isLast
					/>
				</View>
				{isOfflineSupported ? (
					<>
						<Text style={settingStyles.titleContainer(theme)}>{t('Offline')}</Text>
						<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
							<ButtonMenu
								title={t('Albums for offline')}
								icon="folder-open"
								onPress={() => navigation.navigate('Settings/OfflineAlbums')}
							/>
							<ButtonMenu
								title={t('Download all music')}
								icon="cloud-download"
								endText={isScanning ? t('Counting songs') : ''}
								onPress={downloadEverything}
								isLast={!offline.running}
							/>
							{offline.running ? (
								<>
									<View style={settingStyles.optionItem(theme)}>
										<ActivityIndicator size="small" color={theme.primaryTouch} style={{ marginRight: 12 }} />
										<Text style={[settingStyles.primaryText(theme), { flex: 1 }]}>{t('Downloading')}</Text>
										<Text style={{ color: theme.secondaryText, fontSize: size.text.medium }}>
											{`${offline.done} / ${offline.total}${offline.failed ? ` · ${t('failed')}: ${offline.failed}` : ''}`}
										</Text>
									</View>
									<ButtonMenu
										title={t('Stop downloading')}
										icon="stop"
										onPress={stopOffline}
										isLast
									/>
								</>
							) : null}
						</View>
						<Text style={settingStyles.description(theme)}>{t('Offline description')}</Text>
					</>
				) : null}
				<Text style={settingStyles.titleContainer(theme)}>{t('settings.cache.Cache stats')}</Text>
				<View style={settingStyles.optionsContainer(theme)}>
					<ListMap
						data={statCache}
						renderItem={(item, index) => (
							<TableItem
								key={index}
								title={item.name}
								value={item.count}
								isLast={index === statCache.length - 1}
							/>
						)}
						ListEmptyComponent={(
							<View style={settingStyles.optionItem(theme, true)}>
								<Text style={{ color: theme.primaryText, fontSize: size.text.medium, fontWeight: '400' }}>{t('settings.cache.No cache')}</Text>
							</View>
						)}
					/>
				</View>
			</View>
		</ScrollView>
	)
}

export default CacheSettings