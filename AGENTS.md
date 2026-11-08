# Правила репозитория

## Названия коммитов

Стандартизированные заголовки:

- `Major changes` — новая функциональность, значимые изменения
- `Minor changes` — мелкие правки, конфиги, документация
- `Bugfix: <описание>` — исправления (описание перечисляет что починено)

Не использовать conventional commits, подписи ассистентов и произвольные заголовки.

## Сборка и релизы

- `android/` и `ios/` сгенерированы prebuild и в .gitignore — конфигурация живёт в `app.config.js`.
- Релизы триггерятся тегами `v*`; версия с `dev` → prerelease, без → Latest.
- Тестовые APK собираются автоматически только для веток `test/**`.
- Тяжёлые патчи лежат в `patches/` и применяются через patch-package (postinstall).

## Верификация

- Линт: `npm run eslint`
- Android debug на эмулятор: `npx expo run:android` (эмулятор обычно `emulator-5554`)
- Android release: `cd android && gradlew.bat assembleRelease` после `npx expo prebuild --platform android`
