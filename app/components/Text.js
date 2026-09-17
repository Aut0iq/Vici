import React from 'react'
import { Text as RNText, TextInput as RNTextInput } from 'react-native'

import { withFont } from '~/styles/fonts'

// Text и TextInput со шрифтами Vici. Используются во всём приложении вместо стандартных.
const Text = React.forwardRef(({ style, children, ...props }, ref) => (
	<RNText ref={ref} {...props} style={withFont(style, children)}>{children}</RNText>
))
Text.displayName = 'Text'

export const TextInput = React.forwardRef(({ style, ...props }, ref) => (
	<RNTextInput ref={ref} {...props} style={withFont(style)} />
))
TextInput.displayName = 'TextInput'

export default Text
