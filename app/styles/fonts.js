import React from 'react'
import { StyleSheet } from 'react-native'

export const FONTS = {
	regular: 'Manrope_400Regular',
	medium: 'Manrope_500Medium',
	semibold: 'Manrope_600SemiBold',
	bold: 'Manrope_700Bold',
	extrabold: 'Manrope_800ExtraBold',
	display: 'Cinzel_700Bold',
}

const BY_WEIGHT = {
	'100': FONTS.regular,
	'200': FONTS.regular,
	'300': FONTS.regular,
	'400': FONTS.regular,
	normal: FONTS.regular,
	'500': FONTS.medium,
	'600': FONTS.semibold,
	'700': FONTS.bold,
	bold: FONTS.bold,
	'800': FONTS.extrabold,
	'900': FONTS.extrabold,
}

const CYRILLIC = /[\u0400-\u04FF]/
const textOf = (children) => React.Children.toArray(children).filter((c) => typeof c === 'string' || typeof c === 'number').join('')

export const withFont = (style, children = null) => {
	const flat = StyleSheet.flatten(style) || {}
	if (flat.fontFamily === 'display') {
		const family = CYRILLIC.test(textOf(children)) ? FONTS.extrabold : FONTS.display
		return [style, { fontFamily: family, fontWeight: 'normal' }]
	}
	if (flat.fontFamily) return style
	const family = BY_WEIGHT[String(flat.fontWeight || 'normal')] || FONTS.regular
	return [style, { fontFamily: family, fontWeight: 'normal' }]
}
