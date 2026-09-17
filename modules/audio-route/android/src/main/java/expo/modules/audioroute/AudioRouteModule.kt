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

  override fun definition() = ModuleDefinition {
    Name("AudioRoute")

    Events("onDeviceConnected")

    // Отключены ли для приложения ограничения батареи
    AsyncFunction("isIgnoringBatteryOptimizations") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val power = context.getSystemService(Context.POWER_SERVICE) as? PowerManager
      power?.isIgnoringBatteryOptimizations(context.packageName) ?: false
    }

    // Окно «Разрешить работу в фоне». Если система его не покажет — открываем общий список
    AsyncFunction("openBatteryOptimizationSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val direct = Intent(
        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        Uri.parse("package:" + context.packageName)
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(direct)
        true
      } catch (e: Exception) {
        try {
          context.startActivity(
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
              .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          )
          true
        } catch (e2: Exception) {
          false
        }
      }
    }

    // «Режимы и routines» Samsung. Возвращает false, если такого приложения нет
    AsyncFunction("openRoutines") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val intent = context.packageManager.getLaunchIntentForPackage("com.samsung.android.app.routines")
        ?: return@AsyncFunction false
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(intent)
        true
      } catch (e: Exception) {
        false
      }
    }

    // Bluetooth-настройки телефона
    AsyncFunction("openBluetoothSettings") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      try {
        context.startActivity(
          Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        true
      } catch (e: Exception) {
        false
      }
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
