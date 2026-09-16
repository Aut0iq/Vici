import React from 'react'
import { ScrollView, Text, View, StyleSheet, Pressable, ActivityIndicator } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import Icon from 'react-native-vector-icons/FontAwesome'

import { useConfig } from '~/contexts/config'
import { useCachedAndApi, getApi } from '~/utils/api'
import { useSong, useSongDispatch } from '~/contexts/song'
import { useTheme } from '~/contexts/theme'
import { urlCover } from '~/utils/url'
import AmbientBackground from '~/components/player/AmbientBackground'
import GlassView from '~/components/GlassView'
import ImageError from '~/components/ImageError'
import mainStyles from '~/styles/main'
import Player from '~/utils/player'
import RotateIconButton from '~/components/button/RotateIconButton'
import size from '~/styles/size'

// Миксом считаем плейлист, название которого заканчивается на «mix»
// (например, «Agressive mix», «Energy Mix»)
export const isMix = (playlist) => /\bmix$/i.test((playlist?.name || '').trim())
const mixTitle = (name = '') => name.trim().replace(/\s*mix$/i, '') || name

const MixCard = ({ mix, navigation }) => {
	const { t } = useTranslation()
	const config = useConfig()
	const theme = useTheme()
	const songDispatch = useSongDispatch()
	const [isLoading, setIsLoading] = React.useState(false)
	const minutes = Math.round((mix.duration || 0) / 60)

	// Загружаем треки микса и сразу включаем с первого
	const playMix = () => {
		if (isLoading) return
		setIsLoading(true)
		getApi(config, 'getPlaylist', { id: mix.id })
			.then((json) => {
				const songs = json?.playlist?.entry || []
				if (songs.length) Player.playSong(config, songDispatch, songs, 0)
			})
			.catch(() => { })
			.finally(() => setIsLoading(false))
	}

	return (
		<Pressable
			onPress={() => navigation.navigate('Playlist', { playlist: mix })}
			style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
		>
			<GlassView radius={24} intensity={0.55} style={styles.card}>
				<ImageError source={{ uri: urlCover(config, mix, 200) }} style={styles.cover}>
					<View style={[styles.cover, styles.coverEmpty]}>
						<Icon name="magic" size={26} color={theme.primaryTouch} />
					</View>
				</ImageError>
				<View style={{ flex: 1, minWidth: 0 }}>
					<Text style={styles.label}>MIX</Text>
					<Text style={styles.title} numberOfLines={1}>{mixTitle(mix.name)}</Text>
					<Text style={styles.info} numberOfLines={1}>
						{mix.songCount || 0} ♪{minutes ? ` · ${minutes} ${t('min')}` : ''}
					</Text>
				</View>
				<Pressable onPress={playMix} hitSlop={8} style={({ pressed }) => [styles.play, { opacity: pressed ? 0.7 : 1 }]}>
					{isLoading ?
						<ActivityIndicator size="small" color="#1A1206" /> :
						<Icon name="play" size={16} color="#1A1206" style={{ marginLeft: 3 }} />
					}
				</Pressable>
			</GlassView>
		</Pressable>
	)
}

const Mixes = ({ navigation }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const theme = useTheme()
	const song = useSong()

	const [mixes, refreshMixes] = useCachedAndApi([], 'getPlaylists', null, (json, setData) => {
		const list = (json?.playlists?.playlist || []).filter(isMix)
		list.sort((a, b) => (b.changed || '').localeCompare(a.changed || ''))
		setData(list)
	}, [])

	return (
		<View style={{ flex: 1, backgroundColor: theme.primaryBack }}>
			<AmbientBackground song={song?.songInfo} />
			<View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(14,10,15,0.35)' }]} />
			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={mainStyles.contentMainContainer(insets)}
			>
				<View style={styles.header}>
					<Text style={[mainStyles.mainTitle(theme), { margin: 0, marginTop: 0 }]}>{t('Mixes')}</Text>
					<RotateIconButton
						icon="refresh"
						size={size.icon.large}
						color={theme.primaryText}
						style={{ paddingHorizontal: 10 }}
						onPress={(rotate) => { rotate(); refreshMixes() }}
					/>
				</View>

				<View style={{ gap: 12, paddingHorizontal: 16 }}>
					{mixes?.length ?
						mixes.map((mix) => <MixCard key={mix.id} mix={mix} navigation={navigation} />) :
						<GlassView radius={24} intensity={0.55} style={{ padding: 20 }}>
							<Text style={styles.title}>{t('No mixes yet')}</Text>
							<Text style={[styles.info, { marginTop: 6 }]}>{t('Playlists ending with "mix" will appear here')}</Text>
						</GlassView>
					}
				</View>
			</ScrollView>
		</View>
	)
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
		marginStart: 20,
		marginEnd: 10,
		marginTop: 30,
		marginBottom: 20,
	},
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		padding: 12,
	},
	cover: {
		width: 76,
		height: 76,
		borderRadius: 16,
	},
	coverEmpty: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: 'rgba(255,255,255,0.06)',
	},
	label: {
		color: '#E6BD55',
		fontSize: 11,
		fontWeight: 'bold',
		letterSpacing: 2,
	},
	title: {
		color: '#F6F0E8',
		fontSize: 20,
		fontWeight: 'bold',
		marginVertical: 1,
	},
	info: {
		color: 'rgba(246,240,232,0.62)',
		fontSize: 13,
	},
	play: {
		width: 46,
		height: 46,
		borderRadius: 23,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: '#E6BD55',
		borderTopWidth: 1,
		borderColor: '#FFF1BF',
		marginRight: 4,
	},
})

export default Mixes
