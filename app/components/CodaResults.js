import React from 'react'
import { View, ScrollView, Pressable, Alert, Platform, StyleSheet, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'

import Text from '~/components/Text'
import { useSettings } from '~/contexts/settings'
import { useTheme } from '~/contexts/theme'
import { codaEnqueue, codaFind, codaJob, isCodaJobFinished, isCodaReady } from '~/utils/coda'
import { secondToTime } from '~/utils/player'
import ImageError from '~/components/ImageError'
import SectionTitle from '~/components/SectionTitle'
import logger from '~/utils/logger'
import mainStyles from '~/styles/main'
import size from '~/styles/size'

const SEARCH_DELAY = 700
const POLL_INTERVAL = 3000
const REFRESH_DELAYS = [4000, 15000]

const ERRORS = {
	auth: 'The Coda token no longer works. Connect Coda again in the settings.',
	locked: 'Too many attempts, try again in a few minutes',
	network: 'Could not reach the Coda server',
	outdated: 'Update the Coda server to search from vici',
}

const badgeText = (t, job) => {
	if (!job) return t('Not downloaded')
	if (job.status === 'queued') return t('In queue')
	if (job.status === 'downloading') return job.total ? `${job.done || 0} / ${job.total}` : t('Downloading')
	if (job.status === 'done') return t('Downloaded')
	if (job.status === 'partial') return t('Partly downloaded')
	return t('Failed')
}

const Badge = ({ job, style = null }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const failed = job && isCodaJobFinished(job) && job.status !== 'done' && job.status !== 'partial'

	return (
		<View style={[styles.badge, style]}>
			<Text numberOfLines={1} style={[styles.badgeText, { color: failed ? theme.secondaryText : theme.primaryTouch }]}>
				{badgeText(t, job)}
			</Text>
		</View>
	)
}

const CodaResults = ({ query, onDownloaded = () => { } }) => {
	const { t } = useTranslation()
	const theme = useTheme()
	const settings = useSettings()
	const coda = settings.coda
	const enabled = Platform.OS !== 'web' && isCodaReady(coda)
	const [found, setFound] = React.useState(null)
	const [state, setState] = React.useState('idle')
	const [error, setError] = React.useState(null)
	const [jobs, setJobs] = React.useState({})
	const timers = React.useRef([])

	React.useEffect(() => () => timers.current.forEach(clearTimeout), [])

	React.useEffect(() => {
		if (!enabled || query.trim().length < 2) {
			setFound(null)
			setState('idle')
			return
		}
		let cancelled = false
		setState('loading')
		const timer = setTimeout(() => {
			codaFind(coda, query.trim())
				.then((result) => {
					if (cancelled) return
					setFound(result)
					setState('ready')
				})
				.catch((failure) => {
					if (cancelled) return
					logger.warn('Coda', `Search failed: ${failure.message}`)
					setError(ERRORS[failure.code] || failure.message)
					setState('error')
				})
		}, SEARCH_DELAY)
		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [enabled, query, coda?.url, coda?.token])

	React.useEffect(() => {
		const active = Object.entries(jobs).filter(([, job]) => job.id && !isCodaJobFinished(job))
		if (!active.length) return
		const timer = setInterval(() => {
			active.forEach(([key, job]) => {
				codaJob(coda, job.id)
					.then((fresh) => {
						setJobs((current) => ({ ...current, [key]: { ...current[key], ...fresh } }))
						if (isCodaJobFinished(fresh) && (fresh.status === 'done' || fresh.status === 'partial')) {
							REFRESH_DELAYS.forEach((delay) => timers.current.push(setTimeout(onDownloaded, delay)))
						}
					})
					.catch((failure) => logger.warn('Coda', `Job ${job.id}: ${failure.message}`))
			})
		}, POLL_INTERVAL)
		return () => clearInterval(timer)
	}, [jobs, coda?.url, coda?.token])

	const start = (keys, target) => {
		const mark = (job) => setJobs((current) => keys.reduce((next, key) => ({ ...next, [key]: job }), { ...current }))
		mark({ status: 'queued' })
		codaEnqueue(coda, target)
			.then((result) => mark({ id: result.job, status: 'queued' }))
			.catch((failure) => {
				logger.error('Coda', `Enqueue failed: ${failure.message}`)
				mark({ status: 'error' })
				Alert.alert('Coda', t(ERRORS[failure.code] || failure.message))
			})
	}

	const isBusy = (key) => jobs[key] && !isCodaJobFinished(jobs[key])

	const pressTrack = (track) => {
		const trackKey = `track:${track.id}`
		const albumKey = `album:${track.album_id}`
		if (isBusy(trackKey)) return
		Alert.alert(track.title, [track.artist, track.album].filter(Boolean).join(' · '), [
			{ text: t('Cancel'), style: 'cancel' },
			...(track.album_id ? [{ text: t('Whole album'), onPress: () => start([trackKey, albumKey], { album_id: track.album_id }) }] : []),
			{ text: t('Only this song'), onPress: () => start([trackKey], { track_id: track.id }) },
		])
	}

	const pressAlbum = (album) => {
		const key = `album:${album.id}`
		if (isBusy(key)) return
		Alert.alert(album.title, [album.artist, album.total ? `${t('Songs')}: ${album.total}` : null].filter(Boolean).join(' · '), [
			{ text: t('Cancel'), style: 'cancel' },
			{ text: t('Download'), onPress: () => start([key], { album_id: album.id }) },
		])
	}

	if (!enabled || state === 'idle') return null

	if (state === 'loading') return (
		<View style={styles.note}>
			<ActivityIndicator size="small" color={theme.primaryTouch} />
			<Text style={styles.noteText(theme)}>{t('Searching in Coda…')}</Text>
		</View>
	)

	if (state === 'error') return (
		<View style={styles.note}>
			<Text style={styles.noteText(theme)}>{`Coda: ${t(error)}`}</Text>
		</View>
	)

	if (!found?.albums.length && !found?.tracks.length) return null

	return (
		<>
			<SectionTitle title={t('Not on the server yet')} />
			<Text style={styles.hint(theme)}>{t('Tap to download with Coda')}</Text>
			{found.albums.length ? (
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.albums}>
					{found.albums.map((album) => (
						<Pressable
							key={album.id}
							style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.album])}
							onPress={() => pressAlbum(album)}
						>
							<View>
								<ImageError
									style={[styles.albumCover, { backgroundColor: theme.secondaryBack }]}
									source={{ uri: album.cover }}
								/>
								<Badge job={jobs[`album:${album.id}`]} style={styles.coverBadge} />
							</View>
							<Text numberOfLines={1} style={styles.albumTitle(theme)}>{album.title}</Text>
							<Text numberOfLines={1} style={styles.albumArtist(theme)}>{album.artist || '-'}</Text>
						</Pressable>
					))}
				</ScrollView>
			) : null}
			{found.tracks.map((track) => (
				<Pressable
					key={track.id}
					style={({ pressed }) => ([mainStyles.opacity({ pressed }), styles.track])}
					onPress={() => pressTrack(track)}
				>
					<ImageError
						style={[styles.trackCover, { backgroundColor: theme.secondaryBack }]}
						source={{ uri: track.cover }}
					/>
					<View style={{ flex: 1 }}>
						<Text numberOfLines={1} style={{ color: theme.primaryText, fontSize: size.text.medium }}>{track.title}</Text>
						<Text numberOfLines={1} style={{ color: theme.secondaryText, fontSize: size.text.small }}>{track.artist}</Text>
					</View>
					<View style={{ alignItems: 'flex-end', gap: 4 }}>
						<Badge job={jobs[`track:${track.id}`]} />
						<Text style={{ color: theme.secondaryText, fontSize: 12 }}>{secondToTime(track.duration)}</Text>
					</View>
				</Pressable>
			))}
		</>
	)
}

const styles = StyleSheet.create({
	note: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginHorizontal: 20,
		marginVertical: 10,
	},
	noteText: (theme) => ({
		flex: 1,
		color: theme.secondaryText,
		fontSize: size.text.small,
	}),
	hint: (theme) => ({
		marginHorizontal: 20,
		marginTop: -6,
		color: theme.secondaryText,
		fontSize: size.text.small,
	}),
	albums: {
		paddingHorizontal: 20,
		gap: 10,
	},
	album: {
		width: size.image.large,
		alignItems: 'center',
	},
	albumCover: {
		width: size.image.large,
		height: size.image.large,
		marginBottom: 6,
		borderRadius: 18,
		overflow: 'hidden',
	},
	albumTitle: (theme) => ({
		color: theme.primaryText,
		fontSize: size.text.small,
		width: size.image.large,
		marginVertical: 3,
	}),
	albumArtist: (theme) => ({
		color: theme.secondaryText,
		fontSize: size.text.small,
		width: size.image.large,
	}),
	track: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		marginHorizontal: 20,
	},
	trackCover: {
		width: size.image.small,
		height: size.image.small,
		borderRadius: 8,
		overflow: 'hidden',
	},
	badge: {
		paddingHorizontal: 7,
		paddingVertical: 2,
		borderRadius: 9,
		backgroundColor: 'rgba(0,0,0,0.68)',
	},
	badgeText: {
		fontSize: 10,
		fontWeight: 'bold',
	},
	coverBadge: {
		position: 'absolute',
		top: 6,
		right: 6,
		maxWidth: size.image.large - 12,
	},
})

export default CodaResults
