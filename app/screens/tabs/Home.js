import React from 'react'
import { View, ScrollView, StyleSheet, Pressable, Platform } from 'react-native'
import Text from '~/components/Text'
import { useNavigation } from '@react-navigation/native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import { useConfig } from '~/contexts/config'
import { getApi, getApiNetworkFirst } from '~/utils/api'
import { playSong } from '~/utils/player'
import { useSettings } from '~/contexts/settings'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import RotateIconButton from '~/components/button/RotateIconButton'
import HorizontalList from '~/components/lists/HorizontalList'
import IconButton from '~/components/button/IconButton'
import mainStyles from '~/styles/main'
import { urlCover } from '~/utils/url'
import AmbientBackground from '~/components/player/AmbientBackground'
import GlassView from '~/components/GlassView'
import ImageError from '~/components/ImageError'
import Player from '~/utils/player'
import Icon from 'react-native-vector-icons/FontAwesome'
import size from '~/styles/size'


// Карточка «Продолжить слушать»: то, что сейчас в очереди
const ContinueCard = ({ onRandom }) => {
	const { t } = useTranslation()
	const song = useSong()
	const config = useConfig()
	const theme = useTheme()
	const info = song?.songInfo
	const songDispatch = useSongDispatch()
	const isPlaying = song?.state === Player.State.Playing

	// Та же логика, что у кнопки воспроизведения
	const onContinue = () => {
		if (!song.isSongLoad) Player.playSong(config, songDispatch, song.queue, song.index)
		else if (isPlaying) Player.pauseSong()
		else Player.resumeSong()
	}

	return (
		<GlassView radius={26} intensity={0.55} style={styles.card}>
			{/* Красный край планеты, как на иконке */}
			<View pointerEvents="none" style={styles.planet} />
			<View style={styles.cardRow}>
				{info ? (
					<ImageError source={{ uri: urlCover(config, info, 200) }} style={styles.cardCover} />
				) : (
					<View style={[styles.cardCover, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />
				)}
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.cardLabel} numberOfLines={1}>{info ? t('Continue listening') : t('Nothing to continue')}</Text>
					<Text style={styles.cardTitle} numberOfLines={1}>{info ? (info.album || info.title) : 'Vici'}</Text>
					<Text style={styles.cardLabel} numberOfLines={1}>
						{info ? `${info.artist || ''}${song.queue?.length > 1 ? ` · ${song.index + 1} / ${song.queue.length}` : ''}` : t('Pick something or play a random song')}
					</Text>
					{info && song.queue?.length > 1 ? (
						<View style={styles.cardTrack}>
							<View style={{ width: `${((song.index + 1) / song.queue.length) * 100}%`, height: '100%', backgroundColor: theme.primaryTouch }} />
						</View>
					) : null}
					<View style={{ flexDirection: 'row', marginTop: 10 }}>
						{info ? (
							<Pressable onPress={onContinue} style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}>
								<Icon name={isPlaying ? 'pause' : 'play'} size={12} color="#1A1206" style={{ width: 16, textAlign: 'center' }} />
								<Text style={styles.chipText}>{t('Continue')}</Text>
							</Pressable>
						) : (
							<Pressable onPress={onRandom} style={({ pressed }) => [styles.chip, { opacity: pressed ? 0.7 : 1 }]}>
								<Text style={styles.chipText}>{t('Random Song')}</Text>
							</Pressable>
						)}
					</View>
				</View>
			</View>
		</GlassView>
	)
}

const Home = () => {
	const { t } = useTranslation()
	const navigation = useNavigation()
	const insets = useSafeAreaInsets()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const settings = useSettings()
	const theme = useTheme()
	const song = useSong()
	const [statusRefresh, setStatusRefresh] = React.useState()
	const [refresh, setRefresh] = React.useState(0)

	const clickRandomSong = () => {
		getApiNetworkFirst(config, 'getRandomSongs', 'size=50')
			.then((json) => {
				playSong(config, songDispatch, json.randomSongs.song, 0)
			})
			.catch(() => { })
	}

	const forceRefresh = (rotate = () => { }) => {
		setRefresh(refresh + 1)
		rotate()
	}

	const getStatusRefresh = () => {
		getApi(config, 'getScanStatus')
			.then((json) => {
				if (json.scanStatus.scanning) {
					setTimeout(() => {
						getStatusRefresh()
					}, 1000)
					setStatusRefresh(json.scanStatus)
				} else {
					forceRefresh()
					setStatusRefresh()
				}
			})
			.catch(() => { })
	}

	const refreshServer = () => {
		forceRefresh()
		getApi(config, 'startScan', 'fullScan=true')
			.then(() => {
				getStatusRefresh()
			})
			.catch(() => { })
	}

	return (
		<View style={{ flex: 1, backgroundColor: theme.primaryBack }}>
			{/* Фон в цветах текущего трека, приглушённый */}
			<AmbientBackground song={song?.songInfo} />
			<View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,15,0.35)' }]} />
		<ScrollView vertical={true}
			style={{ flex: 1 }}
			contentContainerStyle={mainStyles.contentMainContainer(insets)}
		>
			<View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 20, marginTop: 14, marginBottom: 6 }}>
				<Text style={styles.brand}>VICI</Text>
				<View style={{ flexDirection: 'row', alignItems: 'center' }}>
					<IconButton
						icon="random"
						size={size.icon.tiny}
						color={theme.primaryText}
						style={{ paddingHorizontal: 10, paddingVertical: 5 }}
						onPress={clickRandomSong}
					/>
					{
						settings.listenBrainzUser ?
							<IconButton
								icon="bell-o"
								size={size.icon.tiny}
								color={theme.primaryText}
								style={{ paddingHorizontal: 10, paddingVertical: 5 }}
								onPress={() => navigation.navigate('FreshReleases')}
							/> : null
					}
					{statusRefresh ?
						<Pressable onPress={forceRefresh} style={mainStyles.opacity}
						>
							<Text style={mainStyles.subTitle(theme)}>
								{statusRefresh.count}°
							</Text>
						</Pressable> :
						<RotateIconButton
							icon="refresh"
							size={size.icon.large}
							color={theme.primaryText}
							style={{ paddingHorizontal: 10 }}
							onPress={forceRefresh}
							onLongPress={refreshServer}
							delayLongPress={200}
						/>
					}
				</View>
			</View>
			{config?.url ? <ContinueCard onRandom={clickRandomSong} /> : null}
			{config?.url && settings?.homeOrderV2?.map((value, index) =>
				<HorizontalList key={index} refresh={refresh}{...value} />
			)}
		</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	brand: {
		color: '#E6BD55',
		fontSize: 24,
		fontWeight: 'bold',
		letterSpacing: 6,
		fontFamily: 'display',
	},
	card: {
		marginHorizontal: 16,
		marginTop: 10,
		marginBottom: 6,
	},
	planet: {
		position: 'absolute',
		left: '-40%',
		width: '180%',
		bottom: -598,
		height: 600,
		borderRadius: 600,
		borderTopWidth: 2,
		borderColor: 'rgba(225,50,43,0.8)',
	},
	cardRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		padding: 14,
	},
	cardCover: {
		width: 96,
		height: 96,
		borderRadius: 16,
	},
	cardLabel: {
		color: 'rgba(246,240,232,0.62)',
		fontSize: 12,
	},
	cardTitle: {
		color: '#F6F0E8',
		fontSize: 18,
		fontWeight: 'bold',
		marginVertical: 1,
	},
	cardTrack: {
		height: 3,
		borderRadius: 3,
		overflow: 'hidden',
		backgroundColor: 'rgba(255,255,255,0.14)',
		marginTop: 8,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingVertical: 5,
		paddingLeft: 8,
		paddingRight: 14,
		borderRadius: 999,
		backgroundColor: '#E6BD55',
		borderTopWidth: 1,
		borderColor: '#FFF1BF',
	},
	chipText: {
		color: '#1A1206',
		fontSize: 13,
		fontWeight: 'bold',
	},
})

export default Home