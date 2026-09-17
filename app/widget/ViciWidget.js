import React from 'react'
import { FlexWidget, TextWidget, ImageWidget, SvgWidget } from 'react-native-android-widget'

export const WIDGET_NAME = 'ViciPlayer'

const GOLD = '#E6BD55'
const svg = (path, color) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`
const ICON_PLAY = svg('M7 4.5v15l12.5-7.5z', '#1A1206')
const ICON_PAUSE = svg('M6 5h4.2v14H6zM13.8 5H18v14h-4.2z', '#1A1206')
const ICON_PREV = svg('M5 5.5h2.5v13H5zM19 5.5v13L9 12z', '#F6F0E8')
const ICON_NEXT = svg('M5 5.5v13L15 12zM16.5 5.5H19v13h-2.5z', '#F6F0E8')
const ICON_NOTE = svg('M9 17.5a3 3 0 1 1-2-2.83V5l12-2v11.5a3 3 0 1 1-2-2.83V6.3L9 7.6z', GOLD)

// Виджет 5×1: обложка, название, исполнитель и кнопки управления.
// Нажатие на свободное место открывает приложение с плеером на весь экран.
export const DEFAULT_COLORS = { background: 'rgba(34, 22, 30, 1)', edge: 'rgba(255, 255, 255, 0.12)' }

export const ViciWidget = ({ title, artist, cover, isPlaying, colors, height = 64 }) => {
	// Обложка занимает почти всю высоту виджета
	const coverSize = Math.max(40, Math.min(Math.round(height) - 12, 120))
	// Старые сохранённые цвета (с градиентом) не подходят — берём цвета по умолчанию
	const palette = colors?.background ? colors : DEFAULT_COLORS
	return (
	<FlexWidget
		clickAction="OPEN_URI"
		clickActionData={{ uri: 'vici://player' }}
		style={{
			height: 'match_parent',
			width: 'match_parent',
			flexDirection: 'row',
			alignItems: 'center',
			paddingLeft: 6,
			paddingRight: 8,
			borderRadius: 28,
			backgroundColor: palette.background || DEFAULT_COLORS.background,
			borderWidth: 1,
			borderColor: palette.edge,
		}}
	>
		{cover ? (
			<ImageWidget
				image={cover}
				imageWidth={coverSize}
				imageHeight={coverSize}
				radius={Math.round(coverSize * 0.26)}
				clickAction="OPEN_URI"
				clickActionData={{ uri: 'vici://player' }}
			/>
		) : (
			<FlexWidget
				style={{ width: coverSize, height: coverSize, borderRadius: Math.round(coverSize * 0.26), backgroundColor: 'rgba(255, 255, 255, 0.08)', justifyContent: 'center', alignItems: 'center' }}
			>
				<SvgWidget svg={ICON_NOTE} style={{ width: 20, height: 20 }} />
			</FlexWidget>
		)}

		<FlexWidget
			clickAction="OPEN_URI"
			clickActionData={{ uri: 'vici://player' }}
			style={{ flex: 1, flexDirection: 'column', justifyContent: 'center', marginLeft: 10, marginRight: 4, height: 'match_parent' }}
		>
			<TextWidget
				text={title || 'Vici'}
				maxLines={1}
				truncate="END"
				style={{ fontSize: height > 80 ? 16 : 14, fontWeight: '700', color: '#F6F0E8' }}
			/>
			<TextWidget
				text={artist || 'Нажмите, чтобы открыть'}
				maxLines={1}
				truncate="END"
				style={{ fontSize: height > 80 ? 13 : 12, color: '#D0C6CB' }}
			/>
		</FlexWidget>

		<FlexWidget clickAction="PREV" style={{ width: 38, height: 44, justifyContent: 'center', alignItems: 'center' }}>
			<SvgWidget svg={ICON_PREV} style={{ width: 20, height: 20 }} />
		</FlexWidget>
		<FlexWidget
			clickAction="PLAY_PAUSE"
			style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: GOLD, justifyContent: 'center', alignItems: 'center', marginHorizontal: 2 }}
		>
			<SvgWidget svg={isPlaying ? ICON_PAUSE : ICON_PLAY} style={{ width: 18, height: 18 }} />
		</FlexWidget>
		<FlexWidget clickAction="NEXT" style={{ width: 38, height: 44, justifyContent: 'center', alignItems: 'center' }}>
			<SvgWidget svg={ICON_NEXT} style={{ width: 20, height: 20 }} />
		</FlexWidget>
	</FlexWidget>
	)
}
