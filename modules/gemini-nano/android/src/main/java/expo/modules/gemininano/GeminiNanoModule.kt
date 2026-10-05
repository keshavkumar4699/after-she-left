package expo.modules.gemininano

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS bridge for [GeminiNanoEngine]. The app uses it to write the daily prayer on the phone
 * (Premium on supported devices); everything else falls back to the cloud or the template.
 */
class GeminiNanoModule : Module() {
  private val engine = GeminiNanoEngine()

  override fun definition() = ModuleDefinition {
    Name("GeminiNano")

    /** "available" | "downloadable" | "downloading" | "unavailable" */
    AsyncFunction("checkStatus") { promise: Promise ->
      engine.checkStatus(callbackFor(promise))
    }

    /** Downloads the model through AICore; resolves with the final status. */
    AsyncFunction("download") { promise: Promise ->
      engine.download(callbackFor(promise))
    }

    AsyncFunction("generate") { prompt: String, temperature: Double, topK: Int, maxOutputTokens: Int, promise: Promise ->
      engine.generate(prompt, temperature.toFloat(), topK, maxOutputTokens, callbackFor(promise))
    }

    OnDestroy {
      engine.close()
    }
  }

  private fun callbackFor(promise: Promise) = object : GeminiNanoEngine.Callback {
    override fun success(value: String?) {
      promise.resolve(value)
    }

    override fun failure(code: String, message: String) {
      promise.reject(code, message, null)
    }
  }
}
