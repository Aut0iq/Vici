package expo.modules.audioroute

import android.content.ContentUris
import android.content.ContentValues
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.provider.DocumentsContract
import android.provider.MediaStore
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class MusicLibraryModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready", null)

  private fun result(status: String, uri: Uri) = mapOf("status" to status, "uri" to uri.toString())

  override fun definition() = ModuleDefinition {
    Name("MusicLibrary")

    AsyncFunction("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
    }

    AsyncFunction("save") { sourceUri: String, folder: String, name: String, mimeType: String, tags: Map<String, Any?>? ->
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
        throw CodedException("ERR_UNSUPPORTED", "Android 10 or newer is required", null)
      }
      val resolver = context.contentResolver
      val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val relativePath = "Music/" + folder.trim('/') + "/"

      resolver.query(
        collection,
        arrayOf(MediaStore.Audio.Media._ID),
        "${MediaStore.Audio.Media.RELATIVE_PATH} = ? AND ${MediaStore.Audio.Media.DISPLAY_NAME} = ?",
        arrayOf(relativePath, name),
        null
      )?.use { cursor ->
        if (cursor.moveToFirst()) return@AsyncFunction result("exists", ContentUris.withAppendedId(collection, cursor.getLong(0)))
      }

      val values = ContentValues().apply {
        put(MediaStore.Audio.Media.DISPLAY_NAME, name)
        put(MediaStore.Audio.Media.MIME_TYPE, mimeType)
        put(MediaStore.Audio.Media.RELATIVE_PATH, relativePath)
        put(MediaStore.Audio.Media.IS_PENDING, 1)
      }
      val target = resolver.insert(collection, values)
        ?: throw CodedException("ERR_INSERT", "The system did not accept the file", null)
      try {
        val output = resolver.openOutputStream(target)
          ?: throw CodedException("ERR_WRITE", "Could not open the file for writing", null)
        output.use { stream -> Documents.open(resolver, sourceUri).use { Id3.copy(it, stream, tags) } }
        values.clear()
        values.put(MediaStore.Audio.Media.IS_PENDING, 0)
        resolver.update(target, values, null, null)
      } catch (error: Throwable) {
        resolver.delete(target, null, null)
        throw error
      }
      result("saved", target)
    }

    AsyncFunction("saveToFolder") { treeUri: String, folders: List<String>, name: String, mimeType: String, sourceUri: String, tags: Map<String, Any?>? ->
      val resolver = context.contentResolver
      var dir = Documents.root(Uri.parse(treeUri))
      for (folder in folders) dir = Documents.folder(resolver, dir, folder)

      Documents.child(resolver, dir, name)?.let {
        return@AsyncFunction result("exists", Uri.parse(it["uri"] as String))
      }

      val target = DocumentsContract.createDocument(resolver, dir, mimeType, name)
        ?: throw CodedException("ERR_CREATE", "Could not create $name", null)
      try {
        val output = resolver.openOutputStream(target, "w")
          ?: throw CodedException("ERR_WRITE", "Could not write $name", null)
        output.use { stream -> Documents.open(resolver, sourceUri).use { Id3.copy(it, stream, tags) } }
      } catch (error: Throwable) {
        runCatching { DocumentsContract.deleteDocument(resolver, target) }
        throw error
      }
      Documents.filePath(target)?.let { MediaScannerConnection.scanFile(context, arrayOf(it), arrayOf(mimeType), null) }
      result("saved", target)
    }
  }
}
