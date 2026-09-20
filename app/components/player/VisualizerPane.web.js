import React from 'react'
import { View, StyleSheet } from 'react-native'
import Text from '~/components/Text'
import AsyncStorage from '@react-native-async-storage/async-storage'

import useButterchurn from '~/utils/butterchurnWeb'
import GlassView from '~/components/GlassView'
import IconButton from '~/components/button/IconButton'

const KEY_PRESET = 'visualizer.preset'
const GOLD = '#E6BD55'

// Визуализатор внутри плеера: слева обложка, справа эта панель
const VisualizerPane = ({ active = true }) => {
	const canvas = React.useRef(null)
	const [saved, setSaved] = React.useState(undefined)

	// Ждём сохранённый пресет, чтобы открыть тот же, что и в прошлый раз
	React.useEffect(() => {
		AsyncStorage.getItem(KEY_PRESET)
			.then((value) => setSaved(value || ''))
			.catch(() => setSaved(''))
	}, [])

	const { presetName, nextPreset } = useButterchurn(canvas, active && saved !== undefined, saved)

	React.useEffect(() => {
		if (presetName) AsyncStorage.setItem(KEY_PRESET, presetName).catch(() => { })
	}, [presetName])

	return (
		<View style={styles.container}>
			<canvas ref={canvas} style={{ width: '100%', height: '100%', display: 'block' }} />
			<View style={styles.overlay} pointerEvents="box-none">
				<Text numberOfLines={1} style={styles.preset}>{presetName}</Text>
				<GlassView radius={19} style={styles.round}>
					<IconButton icon="star" size={16} color={GOLD} style={styles.roundInner} onPress={nextPreset} />
				</GlassView>
			</View>
		</View>
	)
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		overflow: 'hidden',
		borderRadius: 12,
		backgroundColor: '#0B070C',
	},
	overlay: {
		position: 'absolute',
		left: 12,
		right: 12,
		bottom: 12,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	preset: {
		flex: 1,
		color: 'rgba(246,240,232,0.55)',
		fontSize: 11,
	},
	round: {
		width: 38,
		height: 38,
	},
	roundInner: {
		width: 38,
		height: 38,
		alignItems: 'center',
		justifyContent: 'center',
	},
})

export default VisualizerPane
