import { StyleSheet } from 'react-native'
import size from '~/styles/size'

export default StyleSheet.create({
	titleContainer: theme => ({
		width: '100%',
		fontSize: 12,
		textTransform: 'uppercase',
		fontWeight: 'bold',
		color: theme.secondaryText,
		marginBottom: 5,
		marginStart: 10,
	}),
	optionsContainer: (theme, isDescription = false) => ({
		flexDirection: 'column',
		width: '100%',
		paddingVertical: 1,
		paddingHorizontal: 17,
		backgroundColor: theme.glass || theme.secondaryBack,
		borderRadius: theme.glass ? 20 : 10,
		borderWidth: theme.glass ? 1 : 0,
		borderColor: theme.glassEdge,
		borderTopColor: theme.glassHighlight,
		overflow: 'hidden',
		marginBottom: isDescription ? 5 : 20,
	}),
	description: theme => ({
		color: theme.secondaryText,
		fontSize: size.text.small,
		marginStart: 5,
		marginBottom: 20,
		width: '100%',
		textAlign: 'left'
	}),
	contentMainContainer: {
		maxWidth: 800,
		width: '100%',
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 20,
		paddingStart: 20,
		paddingEnd: 20,
		alignSelf: 'center',
	},
	optionItem: (theme, isLast) => ({
		width: '100%',
		height: 50,
		paddingEnd: 5,
		alignItems: 'center',
		borderBottomColor: theme.glassLine || theme.secondaryText,
		borderBottomWidth: isLast ? 0 : 1,
		flexDirection: 'row',
	}),
	primaryText: (theme) => ({
		color: theme.primaryText,
		fontSize: size.text.medium,
		marginEnd: 10,
	}),
})