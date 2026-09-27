import React from 'react'
import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

export const USE_BLUR = true

const GlassView = ({ children, style, radius = 24, intensity = 1, ...rest }) => {
	const a = (value) => Math.min(1, value * intensity)
	return (
		<View style={[{ borderRadius: radius, overflow: 'hidden' }, style]} {...rest}>
			<LinearGradient
				colors={[`rgba(255,255,255,${a(0.22)})`, `rgba(255,255,255,${a(0.07)})`, `rgba(255,255,255,${a(0.12)})`]}
				locations={[0, 0.55, 1]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			/>
			<LinearGradient
				colors={[`rgba(255,255,255,${a(0.16)})`, 'rgba(255,255,255,0)']}
				start={{ x: 0.5, y: 0 }}
				end={{ x: 0.5, y: 0.45 }}
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			/>
			<View
				pointerEvents="none"
				style={[
					StyleSheet.absoluteFill,
					{
						borderRadius: radius,
						borderWidth: 1,
						borderTopColor: `rgba(255,255,255,${a(0.45)})`,
						borderLeftColor: `rgba(255,255,255,${a(0.22)})`,
						borderRightColor: `rgba(255,255,255,${a(0.12)})`,
						borderBottomColor: `rgba(255,255,255,${a(0.08)})`,
					},
				]}
			/>
			{children}
		</View>
	)
}

export default GlassView
