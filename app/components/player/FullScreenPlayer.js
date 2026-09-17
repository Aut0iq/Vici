import React from 'react'
import { View, Modal, FlatList, StyleSheet, useWindowDimensions, Pressable, Platform, LayoutAnimation, UIManager, Animated, PanResponder, Easing } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { LinearGradient } from 'expo-linear-gradient'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useCachedFirst } from '~/utils/api'
import { urlCover } from '~/utils/url'
import ImageError from '~/components/ImageError'
import FavoritedButton from '~/components/button/FavoritedButton'
import IconButton from '~/components/button/IconButton'
import Lyric from '~/components/player/Lyric'
import OptionsMultiArtists from '~/components/options/OptionsMultiArtists'
import OptionsPlayer from '~/components/options/OptionsPlayer'
import OptionsQueue from '~/components/options/OptionsQueue'
import PlayButton from '~/components/button/PlayButton'
import Player from '~/utils/player'
import size from '~/styles/size'
import SlideBar from '~/components/button/SlideBar'
import SongItem from '~/components/item/SongItem'
import VinylCover from '~/components/player/VinylCover'
import GlassView from '~/components/GlassView'
import AmbientBackground from '~/components/player/AmbientBackground'

// Цвета Vici
const VICI = {
	ink: '#0E0A0F',
	gold: '#E6BD55',
	goldDeep: '#B8872C',
	text: '#F6F0E8',
	text2: 'rgba(246,240,232,0.62)',
	text3: 'rgba(246,240,232,0.42)',
	glass: 'rgba(255,255,255,0.08)',
	edge: 'rgba(255,255,255,0.16)',
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true)
}

// Очередь воспроизведения (открывается кнопкой слева от «назад»)
const Queue = ({ song, stars, setFullScreen, width, height }) => {
	const scroll = React.useRef(null)
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const [indexOptions, setIndexOptions] = React.useState(-1)

	React.useEffect(() => {
		scroll.current?.scrollToIndex({ index: song.index, animated: true, viewOffset: 0, viewPosition: 0.5 })
	}, [song.index])

	return (
		<>
			<FlatList
				style={{ width, height }}
				ref={scroll}
				data={song.queue}
				keyExtractor={(_, index) => index}
				showsVerticalScrollIndicator={false}
				onLayout={() => scroll.current?.scrollToIndex({ index: song.index, animated: false, viewOffset: 0, viewPosition: 0.5 })}
				getItemLayout={(_, index) => ({ length: size.image.small + 10, offset: (size.image.small + 10) * index, index })}
				onScrollToIndexFailed={() => { }}
				renderItem={({ item, index }) => (
					<SongItem
						song={{
							...item,
							starred: stars.some(s => s.id === item.id)
						}}
						queue={song.queue}
						index={index}
						setIndexOptions={setIndexOptions}
						onPress={(_track, queue, index) => {
							Player.setIndex(config, songDispatch, queue, index)
						}}
						isPlaying={song.index === index}
					/>
				)}
			/>
			<OptionsQueue queue={song.queue} indexOptions={indexOptions} setIndexOptions={setIndexOptions} closePlayer={() => setFullScreen(false)} />
		</>
	)
}

const TimeBar = () => {
	const [duration, setDuration] = React.useState(0)
	const [fakeTime, setFakeTime] = React.useState(-1)
	const song = useSong()
	const time = Player.updateTime()

	React.useEffect(() => {
		if (song.songInfo?.isLiveStream) {
			setDuration(Infinity)
		} else if ((time.duration === 0 || time.duration === Infinity) && song.songInfo?.duration) {
			setDuration(song.songInfo.duration || 0)
		} else {
			setDuration(time.duration)
		}
	}, [time.duration])

	return (
		<View style={{ width: '100%', paddingHorizontal: 24 }}>
			<SlideBar
				disable={time.duration === 0 || duration === Infinity}
				progress={fakeTime < 0 ? time.position / duration : fakeTime}
				onStart={(progress) => Player.pauseSong() && setFakeTime(progress)}
				onChange={(progress) => setFakeTime(progress)}
				onComplete={(progress) => Player.setPosition(progress * duration) && Player.resumeSong() && setTimeout(() => setFakeTime(-1), 500)}
				stylePress={{ width: '100%', height: 24, paddingVertical: 10 }}
				styleBar={{ width: '100%', height: '100%', borderRadius: size.radius.circle, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.16)' }}
				styleProgress={{ backgroundColor: VICI.gold }}
				styleBitogno={{ backgroundColor: '#FFF1BF' }}
				isBitogno={song.songInfo?.isLiveStream ? false : true}
			/>
			<View style={{ flexDirection: 'row', width: '100%', justifyContent: 'space-between' }}>
				<Text style={styles.time}>{Player.secondToTime(fakeTime < 0 ? time.position : fakeTime * duration)}</Text>
				<Text style={styles.time}>{Player.secondToTime(duration)}</Text>
			</View>
		</View>
	)
}

// Круглая «стеклянная» кнопка
const GlassButton = ({ icon, onPress, iconSize = 18 }) => (
	<GlassView radius={21} style={{ width: 42, height: 42 }}>
		<IconButton
			icon={icon}
			size={iconSize}
			color={VICI.text}
			onPress={onPress}
			style={styles.glassButton}
			styleIcon={{ textAlign: 'center' }}
		/>
	</GlassView>
)

const FullScreenPlayer = ({ setFullScreen }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const song = useSong()
	const insets = useSafeAreaInsets()
	const navigation = useNavigation()
	const { width, height } = useWindowDimensions()
	const [isQueue, setIsQueue] = React.useState(false)
	const [isOptArtists, setIsOptArtists] = React.useState(false)
	const [isOpt, setIsOpt] = React.useState(false)
	const [isLyricsOpen, setIsLyricsOpen] = React.useState(false)
	const useNative = Platform.OS !== 'web'

	// Анимации жестов: сдвиг всего плеера и выезжающая панель с текстом
	const drag = React.useRef(new Animated.Value(0)).current
	const sheet = React.useRef(new Animated.Value(0)).current
	const sheetDrag = React.useRef(new Animated.Value(0)).current
	const isQueueRef = React.useRef(isQueue)
	const isLyricsOpenRef = React.useRef(isLyricsOpen)
	isQueueRef.current = isQueue
	isLyricsOpenRef.current = isLyricsOpen

	// Свернуть плеер: уезжает вниз и превращается в мини-плеер
	const closePlayer = () => {
		Animated.timing(drag, { toValue: height, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: useNative })
			.start(() => setFullScreen(false))
	}

	// Панель с текстом песни
	const openLyrics = () => {
		setIsLyricsOpen(true)
		sheetDrag.setValue(0)
		Animated.timing(sheet, { toValue: 1, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: useNative }).start()
	}
	const closeLyrics = () => {
		Animated.timing(sheet, { toValue: 0, duration: 240, easing: Easing.in(Easing.cubic), useNativeDriver: useNative })
			.start(() => {
				setIsLyricsOpen(false)
				sheetDrag.setValue(0)
			})
	}

	const isVertical = (g) => Math.abs(g.dy) > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.6
	const canSwipePlayer = (g) => !isQueueRef.current && !isLyricsOpenRef.current && isVertical(g)

	// Свайп вниз — свернуть, свайп вверх — открыть текст
	const playerPan = React.useRef(PanResponder.create({
		onMoveShouldSetPanResponderCapture: (_, g) => canSwipePlayer(g),
		onMoveShouldSetPanResponder: (_, g) => canSwipePlayer(g),
		onPanResponderMove: (_, g) => drag.setValue(g.dy > 0 ? g.dy : g.dy * 0.25),
		onPanResponderRelease: (_, g) => {
			if (g.dy > 120 || (g.dy > 30 && g.vy > 0.9)) {
				closePlayer()
				return
			}
			if (g.dy < -70 || (g.dy < -20 && g.vy < -0.8)) openLyrics()
			Animated.spring(drag, { toValue: 0, bounciness: 4, useNativeDriver: useNative }).start()
		},
		onPanResponderTerminate: () => Animated.spring(drag, { toValue: 0, useNativeDriver: useNative }).start(),
	})).current

	// На панели с текстом: потянуть за верхнюю часть вниз — закрыть
	const sheetPan = React.useRef(PanResponder.create({
		onStartShouldSetPanResponder: () => true,
		onMoveShouldSetPanResponder: (_, g) => isVertical(g),
		onPanResponderMove: (_, g) => sheetDrag.setValue(Math.max(0, g.dy)),
		onPanResponderRelease: (_, g) => {
			if (g.dy > 100 || (g.dy > 25 && g.vy > 0.8)) closeLyrics()
			else if (Math.abs(g.dy) < 5 && Math.abs(g.dx) < 5) closeLyrics()
			else Animated.spring(sheetDrag, { toValue: 0, bounciness: 4, useNativeDriver: useNative }).start()
		},
		onPanResponderTerminate: () => Animated.spring(sheetDrag, { toValue: 0, useNativeDriver: useNative }).start(),
	})).current

	const sheetY = Animated.add(sheet.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }), sheetDrag)

	const [stars] = useCachedFirst([], 'getStarred2', null, (json, setData) => {
		setData(json?.starred2?.song || [])
	}, [song.songInfo?.id])

	const contentWidth = Math.min(width, 500)
	const coverSize = Math.min(Math.round(contentWidth * 0.7), 360)
	const isShuffle = song.actionEndOfSong === 'random'

	const goToAlbum = () => {
		navigation.navigate('Album', { id: song.songInfo.albumId, name: song.songInfo.album, artist: song.songInfo.artist, artistId: song.songInfo.artistId })
		setFullScreen(false)
	}

	return (
		<Modal
			transparent={true}
			statusBarTranslucent={true}
			navigationBarTranslucent={true}
			onRequestClose={() => (isLyricsOpenRef.current ? closeLyrics() : closePlayer())}
		>
			<Animated.View
				style={{ flex: 1, backgroundColor: VICI.ink, overflow: 'hidden', transform: [{ translateY: drag }] }}
				{...playerPan.panHandlers}
			>
				{/* Фон в цветах обложки */}
				<AmbientBackground song={song.songInfo} />

				<View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14, alignItems: 'center' }}>
					<View style={{ width: '100%', maxWidth: 500, flex: 1 }}>
						{/* Верхняя панель */}
						<View style={styles.topBar}>
							<GlassButton icon="chevron-down" onPress={closePlayer} />
							<Pressable onPress={goToAlbum} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
								<Text numberOfLines={1} style={{ color: VICI.text3, fontSize: 11 }}>{song.songInfo.isLiveStream ? t('Radio') : t('Album')}</Text>
								<Text numberOfLines={1} style={{ color: VICI.text, fontSize: 13, fontWeight: 'bold' }}>{song.songInfo.album || song.songInfo.title}</Text>
							</Pressable>
							<GlassButton icon="ellipsis-h" onPress={() => setIsOpt(true)} />
						</View>

						{/* Обложка с пластинкой (или очередь) и управление — одним блоком по центру */}
						<View style={{ flex: 1, justifyContent: isQueue ? 'flex-start' : 'center' }}>
							{isQueue ? (
								<View style={{ flex: 1, alignItems: 'center' }}>
									<Queue song={song} stars={stars} setFullScreen={setFullScreen} width={contentWidth - 32} height="100%" />
								</View>
							) : (
								<VinylCover coverSize={coverSize} width={contentWidth} />
							)}

						{/* Название и исполнитель по центру */}
						<View style={styles.meta}>
							<Pressable onPress={goToAlbum} style={{ maxWidth: '100%' }}>
								<Text numberOfLines={1} style={styles.title}>{song.songInfo.title}</Text>
							</Pressable>
							<Pressable
								style={{ maxWidth: '100%' }}
								onPress={() => {
									if (song.songInfo.artists?.length > 1) {
										setIsOptArtists(true)
									} else {
										navigation.navigate('Artist', { id: song.songInfo.artistId, name: song.songInfo.artist })
										setFullScreen(false)
									}
								}}
							>
								<Text numberOfLines={1} style={styles.artist}>{song.songInfo.artist}</Text>
							</Pressable>
							<View style={styles.heart}>
								<FavoritedButton
									id={song.songInfo.id}
									isFavorited={stars.some(s => s.id === song.songInfo.id)}
									rating={song.songInfo?.userRating ?? song.songInfo?.rating ?? 0}
									style={{ padding: 10 }}
								/>
							</View>
						</View>

						<TimeBar />

						{/* Управление */}
						<View style={styles.controls}>
							<IconButton
								icon="bars"
								size={19}
								color={isQueue ? VICI.gold : VICI.text2}
								style={styles.sideButton}
								onPress={() => setIsQueue(!isQueue)}
							/>
							<View style={{ flexDirection: 'row', alignItems: 'center', gap: 26 }}>
								<IconButton
									icon="step-backward"
									size={26}
									color={VICI.text}
									style={{ padding: 8 }}
									onPress={() => Player.previousSong(config, song, songDispatch)}
								/>
								<View style={styles.playShadow}>
									<LinearGradient
										colors={['#F6DC8F', '#E6BD55', '#C99A38']}
										start={{ x: 0.2, y: 0 }}
										end={{ x: 0.8, y: 1 }}
										style={styles.playCircle}
									>
										<PlayButton
											size={24}
											color="#1a1206"
											style={{ width: 68, height: 68, justifyContent: 'center', alignItems: 'center' }}
										/>
									</LinearGradient>
								</View>
								<IconButton
									icon="step-forward"
									size={26}
									color={VICI.text}
									style={{ padding: 8 }}
									onPress={() => Player.nextSong(config, song, songDispatch)}
								/>
							</View>
							<IconButton
								icon="random"
								size={19}
								color={isShuffle ? VICI.gold : VICI.text2}
								style={styles.sideButton}
								onPress={() => Player.setRepeat(songDispatch, isShuffle ? 'next' : 'random')}
							/>
						</View>
						</View>

						{/* Подсказка: текст песни открывается свайпом вверх или нажатием */}
						<Pressable onPress={openLyrics} style={({ pressed }) => [styles.lyricsHint, { opacity: pressed ? 0.6 : 1 }]}>
							<Icon name="chevron-up" size={12} color={VICI.text3} />
							<Text style={styles.lyricsHintText}>{t('Lyrics')}</Text>
						</Pressable>
					</View>
				</View>

				{/* Панель с текстом песни (свайп вверх) */}
				{isLyricsOpen && (
					<>
						<Animated.View
							pointerEvents="none"
							style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,15,0.45)', opacity: sheet }]}
						/>
						<Animated.View style={[styles.sheet, { top: insets.top + 40, transform: [{ translateY: sheetY }] }]}>
							<View style={[StyleSheet.absoluteFill, styles.sheetShade]} />
							<GlassView radius={30} style={StyleSheet.absoluteFill} />
							<View {...sheetPan.panHandlers} style={styles.sheetHeader}>
								<View style={styles.handle} />
								<View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', paddingHorizontal: 20 }}>
									<ImageError
										source={{ uri: urlCover(config, song?.songInfo, 100) }}
										style={{ width: 46, height: 46, borderRadius: 10 }}
									/>
									<View style={{ flex: 1 }}>
										<Text numberOfLines={1} style={{ color: VICI.text, fontSize: 16, fontWeight: 'bold' }}>{song.songInfo.title}</Text>
										<Text numberOfLines={1} style={{ color: VICI.text2, fontSize: 13 }}>{song.songInfo.artist}</Text>
									</View>
								</View>
							</View>
							<Lyric
								song={song}
								style={{ flex: 1, width: '100%' }}
								sizeText={20}
								activeSizeText={26}
								gap={22}
								paddingVertical={Math.round(height * 0.28)}
								color={{ active: VICI.gold, inactive: VICI.text3 }}
							/>
							<View style={{ height: insets.bottom + 10 }} />
						</Animated.View>
					</>
				)}

				<OptionsPlayer
					song={song.songInfo}
					isOpen={isOpt}
					setIsOpen={setIsOpt}
					closePlayer={() => setFullScreen(false)}
				/>
				<OptionsMultiArtists
					albumArtists={song.songInfo.albumArtists || []}
					artists={song.songInfo.artists || []}
					close={() => setIsOptArtists(false)}
					visible={isOptArtists}
					setFullScreen={setFullScreen}
				/>
			</Animated.View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	topBar: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: 16,
		paddingVertical: 8,
	},
	glassButton: {
		width: 42,
		height: 42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	lyricsBox: {
		width: '92%',
	},
	meta: {
		width: '100%',
		alignItems: 'center',
		paddingHorizontal: 64,
		marginTop: 30,
		marginBottom: 6,
	},
	title: {
		color: VICI.text,
		fontSize: 22,
		fontWeight: 'bold',
		textAlign: 'center',
	},
	artist: {
		color: VICI.text2,
		fontSize: 15,
		marginTop: 2,
		textAlign: 'center',
	},
	heart: {
		position: 'absolute',
		right: 14,
		top: 0,
		bottom: 0,
		justifyContent: 'center',
	},
	time: {
		color: VICI.text2,
		fontSize: 11,
		marginTop: 6,
	},
	controls: {
		width: '100%',
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: 18,
		marginTop: 14,
	},
	sideButton: {
		padding: 10,
	},
	sheet: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
		overflow: 'hidden',
	},
	sheetShade: {
		backgroundColor: 'rgba(14,10,15,0.55)',
		borderTopLeftRadius: 30,
		borderTopRightRadius: 30,
	},
	sheetHeader: {
		alignItems: 'center',
		paddingTop: 10,
		paddingBottom: 14,
	},
	handle: {
		width: 42,
		height: 5,
		borderRadius: 3,
		backgroundColor: 'rgba(246,240,232,0.35)',
		marginBottom: 14,
	},
	playShadow: {
		width: 68,
		height: 68,
		borderRadius: 34,
		elevation: 10,
		backgroundColor: '#C99A38',
	},
	playCircle: {
		width: 68,
		height: 68,
		borderRadius: 34,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
	lyricsHint: {
		alignSelf: 'center',
		alignItems: 'center',
		paddingHorizontal: 24,
		paddingTop: 10,
		paddingBottom: 2,
	},
	lyricsHintText: {
		color: VICI.text3,
		fontSize: 11,
		fontFamily: 'display',
		letterSpacing: 2,
		marginTop: 2,
	},
})

export default FullScreenPlayer
