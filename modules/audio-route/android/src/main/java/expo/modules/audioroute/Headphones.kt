package expo.modules.audioroute

import android.Manifest
import android.bluetooth.BluetoothA2dp
import android.bluetooth.BluetoothProfile
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.Log
import com.facebook.react.HeadlessJsTaskService
import com.facebook.react.bridge.Arguments
import com.facebook.react.jstasks.HeadlessJsTaskConfig

object Headphones {
  private const val PREFS = "vici.headphones"
  private const val KEY_ENABLED = "playOnConnect"

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY_ENABLED, enabled).apply()
  }

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

  fun canReceive(context: Context): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
      context.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED

  fun isBluetoothOutput(context: Context): Boolean {
    val manager = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return false
    return manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS).any { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP }
  }
}

class HeadphonesReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != BluetoothA2dp.ACTION_CONNECTION_STATE_CHANGED) return
    if (intent.getIntExtra(BluetoothProfile.EXTRA_STATE, -1) != BluetoothProfile.STATE_CONNECTED) return
    if (!Headphones.isEnabled(context)) return
    val app = context.applicationContext
    val pending = goAsync()
    val handler = Handler(Looper.getMainLooper())
    val deadline = SystemClock.elapsedRealtime() + WAIT_MS
    handler.postDelayed(object : Runnable {
      override fun run() {
        val ready = Headphones.isBluetoothOutput(app)
        if (!ready && SystemClock.elapsedRealtime() < deadline) {
          handler.postDelayed(this, POLL_MS)
          return
        }
        if (ready) start(app) else Log.w(TAG, "Bluetooth audio output did not appear, playback not started")
        pending.finish()
      }
    }, FIRST_DELAY_MS)
  }

  private fun start(context: Context) {
    try {
      HeadlessJsTaskService.acquireWakeLockNow(context)
      context.startService(Intent(context, HeadphonesTaskService::class.java))
    } catch (error: Exception) {
      Log.w(TAG, "Playback not started: ${error.message}")
    }
  }

  companion object {
    private const val TAG = "ViciHeadphones"
    private const val FIRST_DELAY_MS = 1200L
    private const val POLL_MS = 500L
    private const val WAIT_MS = 7000L
  }
}

class HeadphonesTaskService : HeadlessJsTaskService() {
  override fun getTaskConfig(intent: Intent?): HeadlessJsTaskConfig =
    HeadlessJsTaskConfig(TASK, Arguments.createMap(), TIMEOUT_MS, true)

  companion object {
    const val TASK = "ViciHeadphones"
    private const val TIMEOUT_MS = 60000L
  }
}
