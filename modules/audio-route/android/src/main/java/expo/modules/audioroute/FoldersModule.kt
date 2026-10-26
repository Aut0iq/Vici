package expo.modules.audioroute

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileNotFoundException

class FoldersModule : Module() {
  private val resolver: ContentResolver
    get() = appContext.reactContext?.contentResolver
      ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready", null)

  private fun state(uri: String): String = try {
    resolver.query(Uri.parse(uri), arrayOf(Document.COLUMN_DISPLAY_NAME), null, null, null).use { cursor ->
      when {
        cursor == null -> "unknown"
        cursor.moveToFirst() -> "yes"
        else -> "no"
      }
    }
  } catch (error: SecurityException) {
    "unknown"
  } catch (error: FileNotFoundException) {
    "no"
  } catch (error: IllegalArgumentException) {
    "no"
  } catch (error: Throwable) {
    "unknown"
  }

  override fun definition() = ModuleDefinition {
    Name("Folders")

    AsyncFunction("isGranted") { treeUri: String ->
      resolver.persistedUriPermissions.any { it.uri.toString() == treeUri && it.isReadPermission && it.isWritePermission }
    }

    AsyncFunction("release") { treeUri: String ->
      val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      runCatching { resolver.releasePersistableUriPermission(Uri.parse(treeUri), flags) }
      true
    }

    AsyncFunction("label") { treeUri: String ->
      val id = DocumentsContract.getTreeDocumentId(Uri.parse(treeUri))
      mapOf(
        "isPrimary" to (id.substringBefore(':') == "primary"),
        "path" to id.substringAfter(':', "")
      )
    }

    AsyncFunction("find") { treeUri: String, path: List<String> ->
      var dir = Documents.root(Uri.parse(treeUri))
      for (name in path) {
        val child = Documents.child(resolver, dir, name) ?: return@AsyncFunction null
        if (child["isDir"] != true) return@AsyncFunction null
        dir = Uri.parse(child["uri"] as String)
      }
      dir.toString()
    }

    AsyncFunction("prepare") { treeUri: String, path: List<String>, hidden: Boolean ->
      var dir = Documents.root(Uri.parse(treeUri))
      for (name in path) dir = Documents.folder(resolver, dir, name)
      if (hidden && Documents.child(resolver, dir, ".nomedia") == null) {
        DocumentsContract.createDocument(resolver, dir, "application/octet-stream", ".nomedia")
      }
      dir.toString()
    }

    AsyncFunction("store") { sourceUri: String, dirUri: String, name: String ->
      val dir = Uri.parse(dirUri)
      Documents.child(resolver, dir, name)?.let { DocumentsContract.deleteDocument(resolver, Uri.parse(it["uri"] as String)) }
      val target = DocumentsContract.createDocument(resolver, dir, "application/octet-stream", name)
        ?: throw CodedException("ERR_CREATE", "Could not create $name", null)
      try {
        val output = resolver.openOutputStream(target, "w")
          ?: throw CodedException("ERR_WRITE", "Could not write $name", null)
        output.use { stream -> Documents.open(resolver, sourceUri).use { it.copyTo(stream, 256 * 1024) } }
      } catch (error: Throwable) {
        runCatching { DocumentsContract.deleteDocument(resolver, target) }
        throw error
      }
      target.toString()
    }

    AsyncFunction("dirs") { dirUri: String ->
      Documents.children(resolver, Uri.parse(dirUri)).filter { it["isDir"] == true }
    }

    AsyncFunction("list") { dirUri: String ->
      Documents.children(resolver, Uri.parse(dirUri)).filter { it["isDir"] == false && it["name"] != ".nomedia" }
    }

    AsyncFunction("copyToFile") { sourceUri: String, targetPath: String ->
      val target = File(Uri.parse(targetPath).path ?: targetPath)
      target.parentFile?.mkdirs()
      try {
        target.outputStream().use { stream -> Documents.open(resolver, sourceUri).use { it.copyTo(stream, 256 * 1024) } }
      } catch (error: Throwable) {
        target.delete()
        throw error
      }
      true
    }

    AsyncFunction("remove") { uri: String ->
      runCatching { DocumentsContract.deleteDocument(resolver, Uri.parse(uri)) }.getOrDefault(false)
    }

    AsyncFunction("check") { uris: List<String> ->
      uris.map { state(it) }
    }

    AsyncFunction("tree") { treeUri: String ->
      val result = mutableListOf<Map<String, String>>()
      val queue = ArrayDeque<Pair<Uri, String>>()
      queue.add(Documents.root(Uri.parse(treeUri)) to "")
      while (queue.isNotEmpty()) {
        val (dir, prefix) = queue.removeFirst()
        for (child in Documents.children(resolver, dir)) {
          val name = child["name"] as String
          val path = if (prefix.isEmpty()) name else "$prefix/$name"
          if (child["isDir"] == true) queue.add(Uri.parse(child["uri"] as String) to path)
          else result.add(mapOf("path" to path, "uri" to child["uri"] as String))
        }
      }
      result
    }
  }
}
