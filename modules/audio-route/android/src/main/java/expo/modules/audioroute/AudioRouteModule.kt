package expo.modules.audioroute

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Следит за подключением наушников и колонок (Bluetooth, провод, USB)
// и сообщает об этом в JavaScript
class AudioRouteModule : Module() {
  private var deviceCallback: AudioDeviceCallback? = null
  private var skipFirstCallback = true
  private val handler = Handler(Looper.getMainLooper())

  private val audioManager: AudioManager?
    get() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager

  private fun isExternal(type: Int): Boolean = when (type) {
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
    AudioDeviceInfo.TYPE_BLUETOOTH_SCO,
    AudioDeviceInfo.TYPE_WIRED_HEADSET,
    AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
    AudioDeviceInfo.TYPE_USB_HEADSET,
    AudioDeviceInfo.TYPE_USB_DEVICE -> true
    else -> false
  }

  private fun typeName(type: Int): String = when (type) {
    AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
    AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_USB_DEVICE -> "usb"
    else -> "wired"
  }

  // Открывает системный экран: из текущей активности, если она есть, иначе новой задачей.
  // Ловим Throwable, а не Exception: прошивки бросают из startActivity что угодно,
  // и вылет приложения из-за настроек батареи недопустим.
  private fun startSystemScreen(intent: Intent): Boolean {
    val activity = appContext.currentActivity
    val context = activity ?: appContext.reactContext ?: return false
    if (activity == null) intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return try {
      context.startActivity(intent)
      true
    } catch (error: Throwable) {
      false
    }
  }

  override fun definition() = ModuleDefinition {
    Name("AudioRoute")

    Events("onDeviceConnected")

    // Отключены ли для приложения ограничения батареи
    AsyncFunction("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      power?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    // Открывает системный экран «Оптимизация батареи», где ограничение снимают вручную.
    // Прямой диалог ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS не используем: на Samsung
    // он валил приложение. Если экрана в прошивке нет — показываем страницу приложения.
    AsyncFunction("openBatteryOptimizationSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val fallbacks = listOf(
        Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
        Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.fromParts("package", context.packageName, null)
        )
      )
      fallbacks.any { startSystemScreen(it) }
    }

    AsyncFunction("isExternalConnected") {
      val devices = audioManager?.getDevices(AudioManager.GET_DEVICES_OUTPUTS)
      devices?.any { isExternal(it.type) } ?: false
    }

    OnStartObserving {
      val manager = audioManager ?: return@OnStartObserving
      skipFirstCallback = true
      val callback = object : AudioDeviceCallback() {
        override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) {
          // Система сразу после подписки сообщает об уже подключённых устройствах — это пропускаем,
          // иначе музыка включалась бы при каждом запуске приложения
          if (skipFirstCallback) {
            skipFirstCallback = false
            return
          }
          val device = addedDevices?.firstOrNull { isExternal(it.type) } ?: return
          sendEvent(
            "onDeviceConnected",
            mapOf(
              "type" to typeName(device.type),
              "name" to (device.productName?.toString() ?: "")
            )
          )
        }
      }
      manager.registerAudioDeviceCallback(callback, handler)
      deviceCallback = callback
    }

    OnStopObserving {
      deviceCallback?.let { audioManager?.unregisterAudioDeviceCallback(it) }
      deviceCallback = null
    }
  }
}
