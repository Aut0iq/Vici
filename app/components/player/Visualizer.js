import React from 'react'
import { View, Modal, Pressable, StyleSheet, Platform } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { WebView } from 'react-native-webview'
import AsyncStorage from '@react-native-async-storage/async-storage'

import Text from '~/components/Text'
import { useSong } from '~/contexts/song'
import { prepareButterchurn } from '~/utils/butterchurn'
import {
	isVisualizerAvailable,
	hasVisualizerPermission,
	requestVisualizerPermission,
	startVisualizer,
} from '~/../modules/audio-route/visualizer'
import GlassView from '~/components/GlassView'
import IconButton from '~/components/button/IconButton'
import PlayButton from '~/components/button/PlayButton'

const BANDS = 28
const KEY_PRESET = 'visualizer.preset'
const GOLD = '#E6BD55'

// Сама картинка рисуется в маленькой веб-странице: так эффекты работают плавно
// и их легко менять, не пересобирая приложение.
const Visualizer = ({ visible, close }) => {
	const { t } = useTranslation()
	const insets = useSafeAreaInsets()
	const song = useSong()
	const webview = React.useRef(null)
	const [source, setSource] = React.useState(null)
	const [presetName, setPresetName] = React.useState('')
	const [fit, setFit] = React.useState('native')
	const savedPreset = React.useRef(null)

	// Запоминаем выбранный пресет, чтобы в следующий раз открылся он же
	React.useEffect(() => {
		AsyncStorage.getItem(KEY_PRESET).then((value) => { savedPreset.current = value })
	}, [])
	const [error, setError] = React.useState(null)
	const info = song?.songInfo

	// Готовим страницу с butterchurn и пресетами MilkDrop
	React.useEffect(() => {
		if (!visible || source) return
		prepareButterchurn()
			.then((uri) => setSource({ uri }))
			.catch((e) => setError(String(e?.message || e)))
	}, [visible])

	// Волна звука от системы -> в butterchurn
	React.useEffect(() => {
		if (!visible) return
		let stop = null
		let cancelled = false

		const run = async () => {
			if (!isVisualizerAvailable()) {
				setError(t('Visualizer is not available in this build'))
				return
			}
			const allowed = (await hasVisualizerPermission()) || (await requestVisualizerPermission())
			if (!allowed) {
				setError(t('Allow audio access to see the visualizer'))
				return
			}
			setError(null)
			stop = await startVisualizer(BANDS, {
				onWave: ({ wave }) => {
					webview.current?.injectJavaScript(`window.vici({wave:${JSON.stringify(wave)}});true;`)
				},
			})
			if (!stop && !cancelled) setError(t('Could not read the audio'))
		}
		run()

		return () => {
			cancelled = true
			stop?.()
		}
	}, [visible])

	return (
		<Modal visible={visible} statusBarTranslucent={true} navigationBarTranslucent={true} onRequestClose={close}>
			<View style={{ flex: 1, backgroundColor: '#0E0A0F' }}>
				{source ? (
					<WebView
						ref={webview}
						source={source}
						style={{ flex: 1, backgroundColor: '#0E0A0F' }}
						originWhitelist={['*']}
						javaScriptEnabled={true}
						domStorageEnabled={true}
						allowFileAccess={true}
						allowFileAccessFromFileURLs={true}
						allowUniversalAccessFromFileURLs={true}
						mediaPlaybackRequiresUserAction={false}
						scrollEnabled={false}
						androidLayerType={Platform.OS === 'android' ? 'hardware' : undefined}
						onMessage={(event) => {
							try {
								const data = JSON.parse(event.nativeEvent.data)
								if (data.type === 'preset') {
								setPresetName(data.name)
								savedPreset.current = data.name
								AsyncStorage.setItem(KEY_PRESET, data.name).catch(() => { })
							}
							if (data.type === 'ready') {
								webview.current?.injectJavaScript(`window.vici({presetName:${JSON.stringify(savedPreset.current || '')}});true;`)
							}
							} catch { }
						}}
					/>
				) : null}

				{error ? (
					<View style={styles.error} pointerEvents="none">
						<Text style={styles.errorText}>{error}</Text>
					</View>
				) : null}

				<View style={[styles.top, { top: insets.top + 12 }]}>
					<GlassView radius={21} style={styles.round}>
						<IconButton icon="times" size={18} color="#F6F0E8" style={styles.roundInner} onPress={close} />
					</GlassView>
					<View style={{ flexDirection: 'row', gap: 10 }}>
					<GlassView radius={21} style={styles.round}>
						<IconButton
							icon={fit === 'native' ? 'crosshairs' : (fit === 'cover' ? 'expand' : 'compress')}
							size={16}
							color="#F6F0E8"
							style={styles.roundInner}
							onPress={() => {
								const next = fit === 'native' ? 'cover' : (fit === 'cover' ? 'contain' : 'native')
								setFit(next)
								webview.current?.injectJavaScript(`window.vici({fit:"${next}"});true;`)
							}}
						/>
					</GlassView>
					<GlassView radius={21} style={styles.round}>
						<IconButton
							icon="star"
							size={18}
							color={GOLD}
							style={styles.roundInner}
							onPress={() => webview.current?.injectJavaScript("window.vici({preset:'next'});true;")}
						/>
					</GlassView>
					</View>
				</View>

				{presetName ? (
					<Text numberOfLines={1} style={[styles.preset, { top: insets.top + 22 }]}>{presetName}</Text>
				) : null}

				<GlassView radius={29} style={[styles.pill, { bottom: insets.bottom + 18 }]}>
					<View style={{ flex: 1, minWidth: 0, paddingLeft: 16 }}>
						<Text numberOfLines={1} style={styles.title}>{info?.title || 'Vici'}</Text>
						<Text numberOfLines={1} style={styles.artist}>{info?.artist || ''}</Text>
					</View>
					<PlayButton size={20} color="#F6F0E8" style={styles.roundInner} />
				</GlassView>
			</View>
		</Modal>
	)
}

const styles = StyleSheet.create({
	top: {
		position: 'absolute',
		left: 16,
		right: 16,
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	round: {
		width: 42,
		height: 42,
	},
	roundInner: {
		width: 42,
		height: 42,
		alignItems: 'center',
		justifyContent: 'center',
	},
	pill: {
		position: 'absolute',
		left: 16,
		right: 16,
		height: 58,
		flexDirection: 'row',
		alignItems: 'center',
		paddingRight: 8,
	},
	title: {
		color: '#F6F0E8',
		fontSize: 14,
		fontWeight: 'bold',
	},
	artist: {
		color: 'rgba(246,240,232,0.62)',
		fontSize: 12,
	},
	error: {
		position: 'absolute',
		left: 24,
		right: 24,
		top: '45%',
		alignItems: 'center',
	},
	preset: {
		position: 'absolute',
		left: 70,
		right: 70,
		textAlign: 'center',
		color: 'rgba(246,240,232,0.55)',
		fontSize: 11,
	},
	errorText: {
		color: '#F6F0E8',
		fontSize: 15,
		textAlign: 'center',
	},
})

export default Visualizer
