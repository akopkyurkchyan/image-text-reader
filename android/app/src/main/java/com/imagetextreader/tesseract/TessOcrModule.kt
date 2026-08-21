package com.imagetextreader.tesseract

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.net.Uri
import android.util.Log
import androidx.exifinterface.media.ExifInterface
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.Executors

/**
 * On-device Cyrillic OCR via Tesseract (ML Kit has no Cyrillic model).
 */
class TessOcrModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "TessOcr"

  @ReactMethod
  fun recognizeCyrillic(imageUri: String, promise: Promise) {
    executor.execute {
      var preparedBitmap: Bitmap? = null
      var tempFile: File? = null

      try {
        val dataPath = ensureTessData()
        tempFile = materializeImage(imageUri)
        preparedBitmap = loadPreparedBitmap(tempFile)
          ?: run {
            promise.reject("TESS_IMAGE_FAILED", "Could not load image for OCR: $imageUri")
            return@execute
          }

        Log.i(
          TAG,
          "OCR start ${preparedBitmap.width}x${preparedBitmap.height} data=$dataPath",
        )

        // Hand Tesseract a PNG on disk: Leptonica decodes it itself, which avoids
        // the row-stride mismatch that shears in-memory bitmaps.
        val ocrInput = writePreparedPng(preparedBitmap)
        promise.resolve(recognizeBestEffort(dataPath, ocrInput))
      } catch (error: Exception) {
        Log.e(TAG, "Tesseract OCR failed for $imageUri", error)
        promise.reject("TESS_ERROR", error.message ?: "Tesseract OCR failed", error)
      } finally {
        preparedBitmap?.recycle()
        tempFile?.delete()
      }
    }
  }

  /**
   * Page-level layout first; retry with tighter segmentation modes when the
   * first pass finds nothing readable (common for photos of a single block).
   */
  private fun recognizeBestEffort(dataPath: String, imageFile: File): String {
    val tessApi = TessBaseAPI()
    try {
      if (!tessApi.init(dataPath, "rus", TessBaseAPI.OEM_LSTM_ONLY)) {
        throw IllegalStateException("Failed to initialize Tesseract for Cyrillic")
      }

      tessApi.setVariable("preserve_interword_spaces", "1")

      val pageSegModes =
        listOf(
          TessBaseAPI.PageSegMode.PSM_AUTO,
          TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK,
          TessBaseAPI.PageSegMode.PSM_SPARSE_TEXT,
        )

      var bestText = ""
      var bestLetters = 0

      for (mode in pageSegModes) {
        tessApi.setPageSegMode(mode)
        tessApi.setImage(imageFile)

        val text = tessApi.getUTF8Text()?.trim().orEmpty()
        val confidence = tessApi.meanConfidence()
        val letters = countLetters(text)
        Log.i(TAG, "psm=$mode confidence=$confidence chars=${text.length} letters=$letters")

        // Completeness matters more than confidence: a partial read of the
        // cleanest region scores high while dropping most of the page.
        if (letters >= MIN_LETTERS && confidence >= MIN_CONFIDENCE && letters > bestLetters) {
          bestText = text
          bestLetters = letters
        }

        if (bestLetters > 0 && confidence >= GOOD_CONFIDENCE) {
          break
        }
      }

      return bestText
    } finally {
      tessApi.recycle()
    }
  }

  private fun countLetters(text: String): Int = text.count { it.isLetter() }

  /** Odd pixel widths trigger row-stride shearing in the native layer. */
  private fun roundToFour(value: Float): Int =
    (Math.round(value / 4f) * 4).coerceAtLeast(4)

  private fun ensureTessData(): String {
    val tessParent = File(reactContext.filesDir, "tesseract")
    val tessDataDir = File(tessParent, "tessdata")
    if (!tessDataDir.exists()) {
      tessDataDir.mkdirs()
    }

    val versionMarker = File(tessParent, "model-version.txt")
    val outFile = File(tessDataDir, "rus.traineddata")
    val needsRefresh =
      !outFile.exists() ||
        outFile.length() < MIN_MODEL_BYTES ||
        !versionMarker.exists() ||
        versionMarker.readText().trim() != TESSDATA_VERSION

    if (needsRefresh) {
      Log.i(TAG, "Copying rus.traineddata from assets (version=$TESSDATA_VERSION)")
      reactContext.assets.open("tessdata/rus.traineddata").use { input ->
        FileOutputStream(outFile).use { output ->
          input.copyTo(output)
        }
      }
      versionMarker.writeText(TESSDATA_VERSION)
    }

    if (outFile.length() < MIN_MODEL_BYTES) {
      throw IllegalStateException(
        "rus.traineddata missing or too small (${outFile.length()} bytes)",
      )
    }

    return tessParent.absolutePath
  }

  /**
   * Copy any picker URI (content://, file://, absolute path) into a stable cache file.
   */
  private fun materializeImage(imageUri: String): File {
    val dest = File(reactContext.cacheDir, "tess-ocr-${System.currentTimeMillis()}.img")
    val uri = Uri.parse(imageUri)

    if (uri.scheme == "content") {
      reactContext.contentResolver.openInputStream(uri)?.use { input ->
        FileOutputStream(dest).use { output -> input.copyTo(output) }
      } ?: throw IllegalStateException("Unable to open content URI")
    } else {
      val path = uri.path ?: imageUri.removePrefix("file://")
      FileInputStream(File(path)).use { input ->
        FileOutputStream(dest).use { output -> input.copyTo(output) }
      }
    }

    if (dest.length() == 0L) {
      throw IllegalStateException("Failed to materialize image for OCR")
    }

    return dest
  }

  private fun loadPreparedBitmap(file: File): Bitmap? {
    val decoded = decodeWithinBudget(file) ?: return null
    val oriented = applyExifOrientation(decoded, file)
    val scaled = normalizeSize(oriented)
    return toGrayscaleArgb(scaled)
  }

  /**
   * Large photos are downsampled so the LSTM engine stays within memory limits.
   */
  private fun decodeWithinBudget(file: File): Bitmap? {
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(file.absolutePath, bounds)

    var sampleSize = 1
    var maxSide = maxOf(bounds.outWidth, bounds.outHeight)
    while (maxSide / sampleSize > MAX_OCR_SIDE * 2) {
      sampleSize *= 2
    }

    val options = BitmapFactory.Options().apply {
      inSampleSize = sampleSize
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }

    return BitmapFactory.decodeFile(file.absolutePath, options)
  }

  /**
   * Tesseract works best around 1500-2500 px on the long edge for a page of text.
   * Interpolated upscaling of tiny images blurs glyphs, so only nudge modest sizes.
   */
  private fun normalizeSize(bitmap: Bitmap): Bitmap {
    val maxSide = maxOf(bitmap.width, bitmap.height)

    val scale =
      when {
        maxSide > MAX_OCR_SIDE -> MAX_OCR_SIDE.toFloat() / maxSide
        maxSide < MIN_OCR_SIDE -> MIN_OCR_SIDE.toFloat() / maxSide
        else -> 1f
      }

    val width = roundToFour(bitmap.width * scale)
    val height = roundToFour(bitmap.height * scale)

    if (width == bitmap.width && height == bitmap.height) {
      return bitmap
    }

    val scaled = Bitmap.createScaledBitmap(bitmap, width, height, true)
    if (scaled !== bitmap) {
      bitmap.recycle()
    }
    return scaled
  }

  private fun toGrayscaleArgb(bitmap: Bitmap): Bitmap {
    val gray = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(gray)
    val paint = Paint().apply {
      isAntiAlias = true
      colorFilter = ColorMatrixColorFilter(ColorMatrix().apply { setSaturation(0f) })
    }
    canvas.drawBitmap(bitmap, 0f, 0f, paint)
    bitmap.recycle()
    return gray
  }

  private fun applyExifOrientation(bitmap: Bitmap, file: File): Bitmap {
    val orientation =
      try {
        ExifInterface(file.absolutePath).getAttributeInt(
          ExifInterface.TAG_ORIENTATION,
          ExifInterface.ORIENTATION_NORMAL,
        )
      } catch (_: Exception) {
        ExifInterface.ORIENTATION_NORMAL
      }

    val degrees =
      when (orientation) {
        ExifInterface.ORIENTATION_ROTATE_90 -> 90f
        ExifInterface.ORIENTATION_ROTATE_180 -> 180f
        ExifInterface.ORIENTATION_ROTATE_270 -> 270f
        else -> 0f
      }

    if (degrees == 0f) {
      return bitmap
    }

    val matrix = Matrix().apply { postRotate(degrees) }
    val rotated =
      Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
    if (rotated !== bitmap) {
      bitmap.recycle()
    }
    return rotated
  }

  private fun writePreparedPng(bitmap: Bitmap): File {
    val target = File(reactContext.cacheDir, "tess-ocr-input.png")
    FileOutputStream(target).use { output ->
      if (!bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)) {
        throw IllegalStateException("Failed to encode prepared image for OCR")
      }
    }
    Log.i(TAG, "Prepared OCR input at ${target.absolutePath} (${target.length()} bytes)")
    return target
  }

  companion object {
    private const val TAG = "TessOcr"
    private const val TESSDATA_VERSION = "rus-best-v1"
    private const val MIN_OCR_SIDE = 1500
    private const val MAX_OCR_SIDE = 2400
    private const val GOOD_CONFIDENCE = 80
    private const val MIN_CONFIDENCE = 45
    private const val MIN_LETTERS = 3
    private const val MIN_MODEL_BYTES = 5_000_000L
  }
}
