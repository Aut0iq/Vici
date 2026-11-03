import { registerRootComponent } from 'expo'

import App from './App'
import { initService } from '~/utils/player'
import { registerWidget } from '~/widget'
import { registerHeadphones } from '~/services/headphones'

registerRootComponent(App)

initService()
registerWidget()
registerHeadphones()