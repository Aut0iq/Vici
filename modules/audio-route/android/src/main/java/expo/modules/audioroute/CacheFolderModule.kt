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
import java.io.InputStream

class CacheFolderModule : Module() {
  private val binary = "application/octet-stream"

  private val resolver: ContentResolver
    get() = appContext.reactContext?.contentResolver
      ?: throw CodedException("ERR_NO_CONTEXT", "The app is not ready", null)

  private fun children(dir: Uri): List<Map<String, Any>> {
    val uri = DocumentsContract.buildChildDocumentsUriUsingTree(dir, DocumentsContract.getDocumentId(dir))
    val columns = arrayOf(Document.COLUMN_DOCUMENT_ID, Document.COLUMN_DISPLAY_NAME, Document.COLUMN_SIZE, Document.COLUMN_MIME_TYPE)
    val result = mutableListOf<Map<String, Any>>()
    resolver.query(uri, columns, null, null, null)?.use { cursor ->
      while (cursor.moveToNext()) {
        val id = cursor.getString(0) ?: continue
        result.add(
          mapOf(
            "uri" to DocumentsContract.buildDocumentUriUsingTree(dir, id).toString(),
            "name" to (cursor.getString(1) ?: ""),
            "size" to (if (cursor.isNull(2)) 0.0 else cursor.getLong(2).toDouble()),
            "isDir" to (cursor.getString(3) == Document.MIME_TYPE_DIR)
          )
        )
      }
    }
    return result
  }

  private fun child(dir: Uri, name: String): Map<String, Any>? = children(dir).firstOrNull { it["name"] == name }

  private fun folder(dir: Uri, name: String): Uri {
    val existing = child(dir, name)
    if (existing != null && existing["isDir"] == true) return Uri.parse(existing["uri"] as String)
    return DocumentsContract.createDocument(resolver, dir, Document.MIME_TYPE_DIR, name)
      ?: throw CodedException("ERR_CREATE", "Could not create the folder $name", null)
  }

  private fun open(uri: String): InputStream {
    val parsed = Uri.parse(uri)
    if (parsed.scheme == "content") {
      return resolver.openInputStream(parsed) ?: throw CodedException("ERR_READ", "Could not read $uri", null)
    }
    return File(parsed.path ?: uri).inputStream()
  }

  override fun definition() = ModuleDefinition {
    Name("CacheFolder")

    AsyncFunction("isGranted") { treeUri: String ->
      resolver.persistedUriPermissions.any { it.uri.toString() == treeUri && it.isReadPermission && it.isWritePermission }
    }

    AsyncFunction("release") { treeUri: String ->
      val flags = Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION
      runCatching { resolver.releasePersistableUriPermission(Uri.parse(treeUri), flags) }
      true
    }

    AsyncFunction("prepare") { treeUri: String, path: List<String> ->
      val tree = Uri.parse(treeUri)
      var dir = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))
      for (name in path) dir = folder(dir, name)
      if (child(dir, ".nomedia") == null) DocumentsContract.createDocument(resolver, dir, binary, ".nomedia")
      dir.toString()
    }

    AsyncFunction("list") { dirUri: String ->
      children(Uri.parse(dirUri)).filter { it["isDir"] == false && it["name"] != ".nomedia" }
    }

    AsyncFunction("store") { sourceUri: String, dirUri: String, name: String ->
      val dir = Uri.parse(dirUri)
      child(dir, name)?.let { DocumentsContract.deleteDocument(resolver, Uri.parse(it["uri"] as String)) }
      val target = DocumentsContract.createDocument(resolver, dir, binary, name)
        ?: throw CodedException("ERR_CREATE", "Could not create $name", null)
      try {
        val output = resolver.openOutputStream(target, "w")
          ?: throw CodedException("ERR_WRITE", "Could not write $name", null)
        output.use { stream -> open(sourceUri).use { it.copyTo(stream, 256 * 1024) } }
      } catch (error: Throwable) {
        runCatching { DocumentsContract.deleteDocument(resolver, target) }
        throw error
      }
      target.toString()
    }

    AsyncFunction("copyToFile") { sourceUri: String, targetPath: String ->
      val target = File(Uri.parse(targetPath).path ?: targetPath)
      target.parentFile?.mkdirs()
      try {
        target.outputStream().use { stream -> open(sourceUri).use { it.copyTo(stream, 256 * 1024) } }
      } catch (error: Throwable) {
        target.delete()
        throw error
      }
      true
    }

    AsyncFunction("remove") { uri: String ->
      runCatching { DocumentsContract.deleteDocument(resolver, Uri.parse(uri)) }.getOrDefault(false)
    }

    AsyncFunction("label") { treeUri: String ->
      val id = DocumentsContract.getTreeDocumentId(Uri.parse(treeUri))
      mapOf(
        "isPrimary" to (id.substringBefore(':') == "primary"),
        "path" to id.substringAfter(':', "")
      )
    }
  }
}
