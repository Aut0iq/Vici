import React from 'react'
import { View, Pressable, Platform, StyleSheet } from 'react-native'
import Text from '~/components/Text'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlurView } from 'expo-blur'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useSong, useSongDispatch } from '~/contexts/song'
import { useConfig } from '~/contexts/config'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import { BAR_HEIGHT, BAR_MARGIN } from '~/components/bar/BottomBar'
import GlassView, { USE_BLUR } from '~/components/GlassView'
import IconButton from '~/components/button/IconButton'
import ImageError from '~/components/ImageError'
import PlayButton from '~/components/button/PlayButton'
import Player from '~/utils/player'
import useKeyboardIsOpen from '~/utils/useKeyboardIsOpen'

const HEIGHT = 62

// Тонкая золотая полоска прогресса по нижнему краю
const Progress = ({ color }) => {
	const time = Player.updateTime()
	const progress = time.duration > 0 && time.duration !== Infinity ? Math.min(1, time.position / time.duration) : 0
	return (
		<View style={styles.progressTrack} pointerEvents="none">
			<View style={{ width: `${progress * 100}%`, height: '100%', backgroundColor: color }} />
		</View>
	)
}

// Мини-плеер: стеклянная капсула над нижним меню
const BoxPlayer = ({ setFullScreen }) => {
	const song = useSong()
	const songDispatch = useSongDispatch()
	const config = useConfig()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const isKeyboardOpen = useKeyboardIsOpen()

	if (isKeyboardOpen) return null
	return (
		<View
			style={[styles.wrap, { bottom: (insets.bottom || 8) + BAR_MARGIN + BAR_HEIGHT + 10, left: insets.left + 14, right: insets.right + 14 }]}
		>
			{USE_BLUR ? <BlurView
				intensity={30}
				tint="dark"
				experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
				style={[StyleSheet.absoluteFill, { borderRadius: 22, overflow: 'hidden' }]}
			/> : null}
			<View style={[StyleSheet.absoluteFill, styles.tint]} />
			<GlassView radius={22} intensity={0.5}>
				<Pressable onPress={() => setFullScreen(true)} style={styles.row}>
					<ImageError source={{ uri: urlCover(config, song?.songInfo, 100) }} style={styles.cover}>
						<View style={[styles.cover, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
							<Icon name="music" size={18} color={theme.playerPrimaryText} />
						</View>
					</ImageError>
					<View style={{ flex: 1 }}>
						<Text style={styles.title} numberOfLines={1}>{song?.songInfo?.title || 'Song title'}</Text>
						<Text style={styles.artist} numberOfLines={1}>{song?.songInfo?.artist || 'Artist'}</Text>
					</View>
					<PlayButton size={20} color="#F6F0E8" style={styles.button} />
					<IconButton
						icon="step-forward"
						size={18}
						color="#F6F0E8"
						style={styles.button}
						onPress={() => Player.nextSong(config, song, songDispatch)}
					/>
				</Pressable>
				<Progress color={theme.primaryTouch} />
			</GlassView>
		</View>
	)
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		height: HEIGHT,
		borderRadius: 22,
		elevation: 10,
	},
	tint: {
		borderRadius: 22,
		backgroundColor: USE_BLUR ? 'rgba(22,15,21,0.15)' : 'rgba(22,15,21,0.6)',
	},
	row: {
		height: HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		paddingLeft: 8,
		paddingRight: 6,
		gap: 11,
	},
	cover: {
		width: 46,
		height: 46,
		borderRadius: 13,
		alignItems: 'center',
		justifyContent: 'center',
	},
	title: {
		color: '#F6F0E8',
		fontSize: 14,
		fontWeight: 'bold',
	},
	artist: {
		color: 'rgba(246,240,232,0.62)',
		fontSize: 12,
		marginTop: 1,
	},
	button: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
	progressTrack: {
		position: 'absolute',
		left: 22,
		right: 22,
		bottom: 0,
		height: 2,
		borderRadius: 2,
		overflow: 'hidden',
		backgroundColor: 'rgba(255,255,255,0.12)',
	},
})

export default BoxPlayer
