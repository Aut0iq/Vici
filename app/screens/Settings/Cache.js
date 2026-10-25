import React from 'react'
import { View, ScrollView, ActivityIndicator, Alert } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'

import {
	changeCacheFolder,
	clearCache,
	clearSongCache,
	getCacheFolder,
	getDownloadUri,
	getStatCache,
	isCacheFolderSupported,
	pickCacheFolder,
} from '~/utils/cache'
import {
	downloadSongs,
	getDownloadFolder,
	isDownloadFolderSupported,
	pickDownloadFolder,
	setDownloadFolder,
	stopDownloads,
	useDownloads,
} from '~/utils/download'
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
const MP3_BYTES_PER_SECOND = 40000

const formatSize = (bytes) => {
	if (bytes === null || bytes === undefined) return '?'
	if (bytes >= GIGABYTE) return `${(bytes / GIGABYTE).toFixed(1)} GB`
	return `${Math.round(bytes / (1024 * 1024))} MB`
}

const ProgressRow = ({ title, done, total, failed, stopTitle, onStop }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	return (
		<>
			<View style={settingStyles.optionItem(theme)}>
				<ActivityIndicator size="small" color={theme.primaryTouch} style={{ marginRight: 12 }} />
				<Text style={[settingStyles.primaryText(theme), { flex: 1 }]}>{title}</Text>
				<Text style={{ color: theme.secondaryText, fontSize: size.text.medium }}>
					{`${done} / ${total}${failed ? ` · ${t('failed')}: ${failed}` : ''}`}
				</Text>
			</View>
			{onStop ? <ButtonMenu title={stopTitle} icon="stop" onPress={onStop} isLast /> : null}
		</>
	)
}

const CacheSettings = () => {
	const { t } = useTranslation()
	const navigation = useNavigation()
	const config = useConfig()
	const offline = useOffline()
	const downloads = useDownloads()
	const [scanning, setScanning] = React.useState(null)
	const insets = useSafeAreaInsets()
	const settings = useSettings()
	const setSettings = useSetSettings()
	const theme = useTheme()
	const [cacheNextSong, setCacheNextSong] = React.useState(settings.cacheNextSong.toString())
	const [cacheFolder, setCacheFolder] = React.useState(null)
	const [downloadFolder, setDownloadFolderState] = React.useState(null)
	const [moving, setMoving] = React.useState(null)
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
	}, [offline.running, downloads.running])

	const loadFolders = () => {
		if (isCacheFolderSupported) getCacheFolder().then(setCacheFolder).catch(() => setCacheFolder(null))
		if (isDownloadFolderSupported) getDownloadFolder().then(setDownloadFolderState).catch(() => setDownloadFolderState(null))
	}

	React.useEffect(loadFolders, [config])

	const folderText = (folder, fallback) => {
		if (!folder) return fallback
		if (!folder.isAvailable) return t('Folder unavailable')
		return [folder.isPrimary ? t('Phone') : t('SD card'), folder.path].filter(Boolean).join('/')
	}

	const switchCacheFolder = async (treeUri, move) => {
		setMoving({ done: 0, failed: 0, total: 0 })
		try {
			const result = await changeCacheFolder(treeUri, move, setMoving)
			if (result.failed) Alert.alert(t('Cache folder'), `${t('Not moved')}: ${result.failed}`)
		} catch (error) {
			Alert.alert(t('Cache folder'), `${t('Could not use this folder')}: ${error?.message || error}`)
		} finally {
			setMoving(null)
			loadFolders()
			getStat()
		}
	}

	const askMove = (treeUri) => {
		const count = global.listCacheSong?.length || 0
		if (!count) return switchCacheFolder(treeUri, false)
		Alert.alert(
			t('Cache folder'),
			`${t('Move cached songs to the new place?')} (${count})`,
			[
				{ text: t('Cancel'), style: 'cancel' },
				{ text: t('Do not move'), onPress: () => switchCacheFolder(treeUri, false) },
				{ text: t('Move'), onPress: () => switchCacheFolder(treeUri, true) },
			]
		)
	}

	const chooseCacheFolder = async () => {
		if (moving || offline.running) return
		const treeUri = await pickCacheFolder().catch(() => null)
		if (!treeUri || treeUri === cacheFolder?.treeUri) return
		askMove(treeUri)
	}

	const chooseDownloadFolder = async () => {
		const treeUri = await pickDownloadFolder().catch(() => null)
		if (!treeUri) return
		await setDownloadFolder(treeUri)
		loadFolders()
	}

	const resetDownloadFolder = async () => {
		await setDownloadFolder(null)
		loadFolders()
	}

	const scan = async (kind, prepare) => {
		if (scanning) return
		setScanning(kind)
		try {
			await prepare(await scanLibrary(config))
		} catch (error) {
			confirmAlert(t(kind === 'cache' ? 'Cache all music' : 'Download all music'), `${t('Could not load the song list')}: ${error?.message || error}`, () => { })
		} finally {
			setScanning(null)
		}
	}

	const cacheEverything = () => scan('cache', (library) => {
		if (!library.missing.length) {
			confirmAlert(t('Cache all music'), t('All music is already cached'), () => { })
			return
		}
		const lines = [
			`${t('Songs to cache')}: ${library.missing.length}`,
			`${t('Approximate size')}: ${formatSize(library.bytes)}`,
		]
		if (!cacheFolder) lines.push(`${t('Free space on the phone')}: ${formatSize(library.free)}`)
		if (!cacheFolder && library.free !== null && library.bytes > library.free) lines.push(t('There is not enough free space for all of it'))
		confirmAlert(t('Cache all music'), lines.join('\n'), () => cacheSongs(config, library.songs))
	})

	const downloadEverything = () => scan('download', (library) => {
		const missing = library.songs.filter((song) => !getDownloadUri(song.id))
		if (!missing.length) {
			confirmAlert(t('Download all music'), t('All music is already downloaded'), () => { })
			return
		}
		const bytes = missing.reduce((sum, song) => sum + (song.duration || 0) * MP3_BYTES_PER_SECOND, 0)
		const lines = [
			`${t('Songs to download')}: ${missing.length}`,
			`${t('Approximate size')}: ${formatSize(bytes)}`,
			`${t('Where')}: ${folderText(downloadFolder, 'Music/Vici')}`,
		]
		if (!downloadFolder || downloadFolder.isPrimary) {
			lines.push(`${t('Free space on the phone')}: ${formatSize(library.free)}`)
			if (library.free !== null && bytes > library.free) lines.push(t('There is not enough free space for all of it'))
		}
		confirmAlert(t('Download all music'), lines.join('\n'), () => downloadSongs(config, missing, t))
	})

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

				{isOfflineSupported ? (
					<>
						<Text style={settingStyles.titleContainer(theme)}>{t('Cache')}</Text>
						<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
							{isCacheFolderSupported ? (
								<>
									<ButtonMenu
										title={t('Cache folder')}
										icon="folder"
										endText={folderText(cacheFolder, t('App storage'))}
										onPress={chooseCacheFolder}
									/>
									{cacheFolder && !moving ? (
										<ButtonMenu title={t('Keep in app storage')} icon="undo" onPress={() => askMove(null)} />
									) : null}
									{moving ? (
										<ProgressRow title={t('Moving songs')} done={moving.done + moving.failed} total={moving.total} />
									) : null}
								</>
							) : null}
							<ButtonMenu
								title={t('Cache albums')}
								icon="folder-open"
								onPress={() => navigation.navigate('Settings/OfflineAlbums', { mode: 'cache' })}
							/>
							<ButtonMenu
								title={t('Cache all music')}
								icon="cloud-download"
								endText={scanning === 'cache' ? t('Counting songs') : ''}
								onPress={cacheEverything}
								isLast={!offline.running}
							/>
							{offline.running ? (
								<ProgressRow
									title={t('Caching')}
									done={offline.done}
									total={offline.total}
									failed={offline.failed}
									stopTitle={t('Stop caching')}
									onStop={stopOffline}
								/>
							) : null}
						</View>
						<Text style={settingStyles.description(theme)}>{t('Cache description')}</Text>
					</>
				) : null}

				{isDownloadFolderSupported ? (
					<>
						<Text style={settingStyles.titleContainer(theme)}>{t('Downloads')}</Text>
						<View style={[settingStyles.optionsContainer(theme), { marginBottom: 5 }]}>
							<ButtonMenu
								title={t('Download folder')}
								icon="folder"
								endText={folderText(downloadFolder, 'Music/Vici')}
								onPress={chooseDownloadFolder}
							/>
							{downloadFolder ? (
								<ButtonMenu title={t('Save to Music/Vici')} icon="undo" onPress={resetDownloadFolder} />
							) : null}
							<ButtonMenu
								title={t('Download albums')}
								icon="folder-open"
								onPress={() => navigation.navigate('Settings/OfflineAlbums', { mode: 'download' })}
							/>
							<ButtonMenu
								title={t('Download all music')}
								icon="download"
								endText={scanning === 'download' ? t('Counting songs') : ''}
								onPress={downloadEverything}
								isLast={!downloads.running}
							/>
							{downloads.running ? (
								<ProgressRow
									title={t('Downloading songs')}
									done={downloads.done}
									total={downloads.total}
									failed={downloads.failed}
									stopTitle={t('Stop downloading')}
									onStop={stopDownloads}
								/>
							) : null}
						</View>
						<Text style={settingStyles.description(theme)}>{t('Download folder description')}</Text>
					</>
				) : null}

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
