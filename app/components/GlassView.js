import React from 'react'
import { View, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

// Настоящее размытие под нижним меню и мини-плеером.
// На слабых телефонах и эмуляторе оно может тормозить — тогда поставьте false.
export const USE_BLUR = true

// «Жидкое стекло»: полупрозрачная заливка, блик сверху и светлая кромка.
// Всё, что лежит под панелью, просвечивает сквозь неё.
const GlassView = ({ children, style, radius = 24, intensity = 1, ...rest }) => {
	const a = (value) => Math.min(1, value * intensity)
	return (
		<View style={[{ borderRadius: radius, overflow: 'hidden' }, style]} {...rest}>
			{/* Основа стекла: светлее сверху слева, прозрачнее к центру */}
			<LinearGradient
				colors={[`rgba(255,255,255,${a(0.22)})`, `rgba(255,255,255,${a(0.07)})`, `rgba(255,255,255,${a(0.12)})`]}
				locations={[0, 0.55, 1]}
				start={{ x: 0, y: 0 }}
				end={{ x: 1, y: 1 }}
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			/>
			{/* Блик в верхней части */}
			<LinearGradient
				colors={[`rgba(255,255,255,${a(0.16)})`, 'rgba(255,255,255,0)']}
				start={{ x: 0.5, y: 0 }}
				end={{ x: 0.5, y: 0.45 }}
				style={StyleSheet.absoluteFill}
				pointerEvents="none"
			/>
			{/* Кромка: ярче сверху, мягче снизу — как грань стекла на свету */}
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
