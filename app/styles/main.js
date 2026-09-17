import { StyleSheet } from "react-native"
import size from "~/styles/size"

export default StyleSheet.create({
	mainContainer: (theme) => ({
		flex: 1,
		// В теме Vici фон рисует ScreenBackground, поэтому здесь прозрачно
		backgroundColor: theme.ambient ? 'transparent' : theme.primaryBack,
	}),
	contentMainContainer: (insets, statusBar = true) => ({
		paddingTop: statusBar ? insets.top : 0,
		paddingBottom: insets.bottom + 180, // место под парящие мини-плеер и меню
		paddingStart: insets.left,
		paddingEnd: insets.right,
	}),
	mainTitle: theme => ({
		color: theme.primaryText,
		fontSize: size.title.medium,
		fontWeight: 'bold',
		margin: 20,
		marginTop: 30
	}),
	subTitle: theme => ({
		color: theme.primaryText,
		fontSize: size.title.small,
		fontWeight: 'bold',
	}),
	titleSection: theme => ({
		color: theme.primaryText,
		fontSize: size.title.small,
		fontWeight: 'bold',
		marginHorizontal: 20,
		marginTop: 25,
		marginBottom: 12
	}),
	stdVerticalMargin: {
		marginHorizontal: 20,
	},
	button: {
		flex: 1,
		height: 50,
		alignItems: "center",
		justifyContent: "center",
	},
	coverSmall: theme => ({
		height: size.image.small,
		width: size.image.small,
		// marginStart: 10,
		borderRadius: 12,
		overflow: 'hidden',
		backgroundColor: theme.secondaryBack,
	}),
	icon: {
		width: size.image.small,
		height: size.image.small,
		borderRadius: 10,
		marginEnd: 10
	},
	opacity: ({ pressed, enable = true }) => ({
		opacity: (pressed && enable) ? 0.5 : 1,
	}),
	smallText: color => ({
		color: color,
		fontSize: size.text.small,
		textAlign: 'left',
	}),
	mediumText: color => ({
		color: color,
		fontSize: size.text.medium,
		textAlign: 'left',
	}),
	largeText: color => ({
		color: color,
		fontSize: size.text.large,
		textAlign: 'left',
	}),
})