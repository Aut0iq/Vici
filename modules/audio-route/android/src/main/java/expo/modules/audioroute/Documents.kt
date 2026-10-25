package expo.modules.audioroute

import android.content.ContentResolver
import android.net.Uri
import android.os.Environment
import android.provider.DocumentsContract
import android.provider.DocumentsContract.Document
import expo.modules.kotlin.exception.CodedException
import java.io.File
import java.io.InputStream

internal object Documents {
  fun root(tree: Uri): Uri = DocumentsContract.buildDocumentUriUsingTree(tree, DocumentsContract.getTreeDocumentId(tree))

  fun children(resolver: ContentResolver, dir: Uri): List<Map<String, Any>> {
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

  fun child(resolver: ContentResolver, dir: Uri, name: String): Map<String, Any>? =
    children(resolver, dir).firstOrNull { it["name"] == name }

  fun folder(resolver: ContentResolver, dir: Uri, name: String): Uri {
    val existing = child(resolver, dir, name)
    if (existing != null && existing["isDir"] == true) return Uri.parse(existing["uri"] as String)
    return DocumentsContract.createDocument(resolver, dir, Document.MIME_TYPE_DIR, name)
      ?: throw CodedException("ERR_CREATE", "Could not create the folder $name", null)
  }

  fun open(resolver: ContentResolver, uri: String): InputStream {
    val parsed = Uri.parse(uri)
    if (parsed.scheme == "content") {
      return resolver.openInputStream(parsed) ?: throw CodedException("ERR_READ", "Could not read $uri", null)
    }
    val file = File(parsed.path ?: uri)
    if (!file.isFile) throw CodedException("ERR_NO_FILE", "Nothing to read at $uri", null)
    return file.inputStream()
  }

  fun filePath(document: Uri): String? {
    val id = runCatching { DocumentsContract.getDocumentId(document) }.getOrNull() ?: return null
    val volume = id.substringBefore(':')
    val path = id.substringAfter(':', "")
    val base = if (volume == "primary") Environment.getExternalStorageDirectory().path else "/storage/$volume"
    return "$base/$path"
  }
}
