package expo.modules.audioroute

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.InputStream
import java.io.OutputStream

internal object Id3 {
  private const val BUFFER = 256 * 1024

  private val textFrames = listOf(
    "TIT2" to "title",
    "TPE1" to "artist",
    "TALB" to "album",
    "TPE2" to "albumArtist",
    "TRCK" to "track",
    "TPOS" to "disc",
    "TYER" to "year",
    "TCON" to "genre"
  )

  private fun frame(out: ByteArrayOutputStream, id: String, payload: ByteArray) {
    out.write(id.toByteArray(Charsets.ISO_8859_1))
    out.write(byteArrayOf((payload.size ushr 24).toByte(), (payload.size ushr 16).toByte(), (payload.size ushr 8).toByte(), payload.size.toByte()))
    out.write(byteArrayOf(0, 0))
    out.write(payload)
  }

  private fun text(value: String): ByteArray = byteArrayOf(1) + byteArrayOf(0xFF.toByte(), 0xFE.toByte()) + value.toByteArray(Charsets.UTF_16LE)

  private fun picture(file: File): ByteArray? {
    if (!file.isFile) return null
    val data = file.readBytes()
    val mime = when {
      data.size > 3 && data[0] == 0xFF.toByte() && data[1] == 0xD8.toByte() -> "image/jpeg"
      data.size > 4 && data[0] == 0x89.toByte() && data[1] == 'P'.code.toByte() -> "image/png"
      else -> return null
    }
    return byteArrayOf(0) + mime.toByteArray(Charsets.ISO_8859_1) + byteArrayOf(0, 3, 0) + data
  }

  fun build(tags: Map<String, Any?>): ByteArray {
    val frames = ByteArrayOutputStream()
    for ((id, key) in textFrames) {
      val value = tags[key]?.toString()?.trim().orEmpty()
      if (value.isNotEmpty()) frame(frames, id, text(value))
    }
    (tags["cover"] as? String)?.takeIf { it.isNotEmpty() }?.let { path ->
      picture(File(path.removePrefix("file://")))?.let { frame(frames, "APIC", it) }
    }
    val size = frames.size()
    val header = byteArrayOf(
      'I'.code.toByte(), 'D'.code.toByte(), '3'.code.toByte(), 3, 0, 0,
      ((size shr 21) and 0x7F).toByte(), ((size shr 14) and 0x7F).toByte(), ((size shr 7) and 0x7F).toByte(), (size and 0x7F).toByte()
    )
    return header + frames.toByteArray()
  }

  private fun skipExisting(input: BufferedInputStream) {
    input.mark(10)
    val head = ByteArray(10)
    var read = 0
    while (read < 10) {
      val count = input.read(head, read, 10 - read)
      if (count < 0) break
      read += count
    }
    if (read < 10 || head[0] != 'I'.code.toByte() || head[1] != 'D'.code.toByte() || head[2] != '3'.code.toByte()) {
      input.reset()
      return
    }
    var remaining = ((head[6].toInt() and 0x7F) shl 21) or ((head[7].toInt() and 0x7F) shl 14) or
      ((head[8].toInt() and 0x7F) shl 7) or (head[9].toInt() and 0x7F)
    if (head[5].toInt() and 0x10 != 0) remaining += 10
    var left = remaining.toLong()
    while (left > 0) {
      val skipped = input.skip(left)
      if (skipped <= 0) {
        if (input.read() < 0) break
        left -= 1
      } else {
        left -= skipped
      }
    }
  }

  fun copy(input: InputStream, output: OutputStream, tags: Map<String, Any?>?) {
    if (tags == null) {
      input.copyTo(output, BUFFER)
      return
    }
    val buffered = BufferedInputStream(input, BUFFER)
    skipExisting(buffered)
    output.write(build(tags))
    buffered.copyTo(output, BUFFER)
  }
}
