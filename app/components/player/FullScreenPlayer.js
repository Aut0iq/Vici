import React from 'react'
import { Text, View, Modal, FlatList, StyleSheet, useWindowDimensions, Pressable, Platform, LayoutAnimation, UIManager } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'

import { useConfig } from '~/contexts/config'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useCachedFirst } from '~/utils/api'
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
	const config = useConfig()
	const songDispatch = useSongDispatch()
	const song = useSong()
	const insets = useSafeAreaInsets()
	const navigation = useNavigation()
	const { width } = useWindowDimensions()
	const [isQueue, setIsQueue] = React.useState(false)
	const [hasLyrics, setHasLyrics] = React.useState(false)
	const [isOptArtists, setIsOptArtists] = React.useState(false)
	const [isOpt, setIsOpt] = React.useState(false)

	const [stars] = useCachedFirst([], 'getStarred2', null, (json, setData) => {
		setData(json?.starred2?.song || [])
	}, [song.songInfo?.id])

	const contentWidth = Math.min(width, 500)
	const coverSize = Math.round(contentWidth * (hasLyrics ? 0.56 : 0.78))
	const isShuffle = song.actionEndOfSong === 'random'

	// Плавно перестраиваем экран, когда появляется или пропадает текст
	const onLyricsAvailable = React.useCallback((available) => {
		setHasLyrics((prev) => {
			if (prev !== available && Platform.OS !== 'web') {
				LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
			}
			return available
		})
	}, [])

	const goToAlbum = () => {
		navigation.navigate('Album', { id: song.songInfo.albumId, name: song.songInfo.album, artist: song.songInfo.artist, artistId: song.songInfo.artistId })
		setFullScreen(false)
	}

	return (
		<Modal
			statusBarTranslucent={true}
			navigationBarTranslucent={true}
			onRequestClose={() => setFullScreen(false)}
		>
			<View style={{ flex: 1, backgroundColor: VICI.ink, overflow: 'hidden' }}>
				{/* Фон в цветах обложки */}
				<AmbientBackground song={song.songInfo} />

				<View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 14, alignItems: 'center' }}>
					<View style={{ width: '100%', maxWidth: 500, flex: 1 }}>
						{/* Верхняя панель */}
						<View style={styles.topBar}>
							<GlassButton icon="chevron-down" onPress={() => setFullScreen(false)} />
							<Pressable onPress={goToAlbum} style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
								<Text numberOfLines={1} style={{ color: VICI.text3, fontSize: 11 }}>{song.songInfo.isLiveStream ? 'Radio' : 'Album'}</Text>
								<Text numberOfLines={1} style={{ color: VICI.text, fontSize: 13, fontWeight: 'bold' }}>{song.songInfo.album || song.songInfo.title}</Text>
							</Pressable>
							<GlassButton icon="ellipsis-h" onPress={() => setIsOpt(true)} />
						</View>

						{/* Обложка с пластинкой и текст песни */}
						<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
							{isQueue ? (
								<Queue song={song} stars={stars} setFullScreen={setFullScreen} width={contentWidth - 32} height="100%" />
							) : (
								<>
									<VinylCover coverSize={coverSize} width={contentWidth} />
									<GlassView radius={26} style={[styles.lyricsBox, hasLyrics ? { height: 170, marginTop: 22, opacity: 1 } : { height: 0, marginTop: 0, opacity: 0 }]}>
										<Lyric
											song={song}
											style={{ width: '100%', height: 170 }}
											sizeText={15}
											activeSizeText={19}
											gap={10}
											paddingVertical={66}
											color={{ active: VICI.gold, inactive: VICI.text3 }}
											onAvailable={onLyricsAvailable}
										/>
									</GlassView>
								</>
							)}
						</View>

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
								<View style={styles.playCircle}>
									<PlayButton
										size={24}
										color="#1a1206"
										style={{ width: 66, height: 66, justifyContent: 'center', alignItems: 'center' }}
									/>
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
				</View>

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
			</View>
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
		marginTop: 14,
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
	playCircle: {
		width: 66,
		height: 66,
		borderRadius: 33,
		backgroundColor: VICI.gold,
		borderTopWidth: 1,
		borderColor: '#FFF1BF',
		alignItems: 'center',
		justifyContent: 'center',
		elevation: 8,
	},
})

export default FullScreenPlayer
