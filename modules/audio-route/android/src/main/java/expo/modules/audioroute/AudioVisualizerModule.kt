package expo.modules.audioroute

import android.media.audiofx.Visualizer
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

private const val WAVE_SIZE = 512

class AudioVisualizerModule : Module() {
  private var visualizer: Visualizer? = null
  private var bandCount = 24

  override fun definition() = ModuleDefinition {
    Name("AudioVisualizer")

    Events("onBands", "onWave")

    AsyncFunction("start") { bands: Int ->
      stopVisualizer()
      bandCount = bands.coerceIn(8, 64)
      try {
        val v = Visualizer(0)
        v.captureSize = Visualizer.getCaptureSizeRange()[1]
        v.setDataCaptureListener(
          object : Visualizer.OnDataCaptureListener {
            override fun onWaveFormDataCapture(vis: Visualizer?, waveform: ByteArray?, rate: Int) {
              val data = waveform ?: return
              sendEvent("onWave", mapOf("wave" to toWave(data)))
            }

            override fun onFftDataCapture(vis: Visualizer?, fft: ByteArray?, rate: Int) {
              val data = fft ?: return
              sendEvent("onBands", mapOf("bands" to toBands(data), "level" to level(data)))
            }
          },
          Visualizer.getMaxCaptureRate(),
          true,
          true
        )
        v.enabled = true
        visualizer = v
        true
      } catch (e: Exception) {
        stopVisualizer()
        false
      }
    }

    AsyncFunction("stop") {
      stopVisualizer()
      true
    }

    OnDestroy {
      stopVisualizer()
    }
  }

  private fun stopVisualizer() {
    try {
      visualizer?.enabled = false
      visualizer?.release()
    } catch (e: Exception) {
    }
    visualizer = null
  }

  private fun toWave(waveform: ByteArray): List<Int> {
    val out = ArrayList<Int>(WAVE_SIZE)
    val step = max(1, waveform.size / WAVE_SIZE)
    var i = 0
    while (out.size < WAVE_SIZE && i < waveform.size) {
      out.add(waveform[i].toInt() and 0xFF)
      i += step
    }
    while (out.size < WAVE_SIZE) out.add(128)
    return out
  }

  private fun toBands(fft: ByteArray): List<Float> {
    val bins = fft.size / 2
    val magnitudes = FloatArray(bins)
    for (i in 1 until bins) {
      val real = fft[i * 2].toFloat()
      val imaginary = fft[i * 2 + 1].toFloat()
      magnitudes[i] = hypot(real, imaginary)
    }

    val result = ArrayList<Float>(bandCount)
    for (band in 0 until bandCount) {
      val from = binForBand(band, bins)
      val to = max(from + 1, binForBand(band + 1, bins))
      var sum = 0f
      for (i in from until min(to, bins)) sum += magnitudes[i]
      val average = sum / (to - from)
      val boost = 1f + band.toFloat() / bandCount * 1.6f
      result.add(min(1f, (average / 40f) * boost))
    }
    return result
  }

  private fun binForBand(band: Int, bins: Int): Int {
    val ratio = band.toFloat() / bandCount
    return (bins.toFloat().pow(ratio)).toInt().coerceIn(1, bins - 1)
  }

  private fun level(fft: ByteArray): Float {
    val bins = fft.size / 2
    var sum = 0f
    val to = min(12, bins)
    for (i in 1 until to) sum += hypot(fft[i * 2].toFloat(), fft[i * 2 + 1].toFloat())
    return min(1f, sum / (to - 1) / 60f)
  }
}
