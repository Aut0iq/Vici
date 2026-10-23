import React from 'react'
import { View, Platform } from 'react-native'

import { useTheme } from '~/contexts/theme'
import Player from '~/utils/player'
import IconButton from '~/components/button/IconButton'
import SlideBar from '~/components/button/SlideBar'

const STEPS = 20
const NOTCH = 50

const stepVolume = (direction) => {
	const next = Math.round(Player.getVolume() * STEPS + direction) / STEPS
	Player.setVolume(Math.min(1, Math.max(0, next)))
}

const VolumeControl = ({ color, iconStyle = {}, styleBar = {} }) => {
	const theme = useTheme()
	const volume = Player.updateVolume()
	const ref = React.useRef(null)

	React.useEffect(() => {
		const node = ref.current
		if (Platform.OS !== 'web' || !node?.addEventListener) return
		let rest = 0
		const onWheel = (e) => {
			if (!e.deltaY) return
			e.preventDefault()
			const delta = e.deltaMode ? e.deltaY * 100 : e.deltaY
			if (Math.abs(delta) >= NOTCH) {
				rest = 0
				return stepVolume(delta < 0 ? 1 : -1)
			}
			if (Math.sign(rest) !== Math.sign(delta)) rest = 0
			rest += delta
			if (Math.abs(rest) < NOTCH) return
			stepVolume(rest < 0 ? 1 : -1)
			rest = 0
		}
		node.addEventListener('wheel', onWheel, { passive: false })
		return () => node.removeEventListener('wheel', onWheel)
	}, [])

	return (
		<View ref={ref} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, flexShrink: 1 }}>
			<IconButton
				icon={volume ? "volume-up" : "volume-off"}
				size={17}
				color={color}
				style={[{ width: 27 }, iconStyle]}
				onPress={() => Player.setVolume(volume ? 0 : 1)}
			/>
			<SlideBar
				progress={volume}
				onStart={(progress) => Player.setVolume(progress)}
				onChange={(progress) => Player.setVolume(progress)}
				stylePress={{ width: 100, flexShrink: 1, height: 25, paddingVertical: 10 }}
				styleBar={[{ width: '100%', height: '100%', borderRadius: 3, overflow: 'hidden' }, styleBar]}
				styleProgress={{ backgroundColor: theme.primaryTouch }}
				isBitogno={true}
			/>
		</View>
	)
}

export default VolumeControl
