package com.fazlapp.sellercenter

import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.uimanager.ViewManager

/**
 * The colour of the app window behind the React views. styles.xml starts it
 * as Fazl teal, so launch never flashes white; once the splash covers the
 * screen, JS (src/utils/windowBackground.ts) sets it to the screens' own
 * background. Wherever the React view briefly doesn't reach — as while
 * Google's account chooser closes — the window shows through, and a teal band
 * there looked broken.
 */
class WindowBackgroundModule(context: ReactApplicationContext) :
    ReactContextBaseJavaModule(context) {

  override fun getName(): String = "WindowBackground"

  /** `color` as "#RRGGBB" (or "#AARRGGBB"); anything else is ignored. */
  @ReactMethod
  fun setColor(color: String) {
    val parsed =
        try {
          Color.parseColor(color)
        } catch (e: IllegalArgumentException) {
          return
        }
    UiThreadUtil.runOnUiThread {
      reactApplicationContext.currentActivity
          ?.window
          ?.setBackgroundDrawable(ColorDrawable(parsed))
    }
  }
}

class WindowBackgroundPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(WindowBackgroundModule(reactContext))

  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<in Nothing, in Nothing>> = emptyList()
}
