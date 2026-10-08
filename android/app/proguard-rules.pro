# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile

# ─── R8 켜기 (2026-10-09, Play 권장 조치) ─────────────────────────────────────────
# Capacitor 는 플러그인 메서드를 리플렉션(@PluginMethod)으로 찾고 JS 브리지는 @JavascriptInterface 를 쓴다.
#   capacitor-android 가 consumer 규칙을 같이 배포하지만, 여기 한 번 더 적어 둔다(플러그인 업데이트로 규칙이 바뀌어도 안전).
-keep class com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keepclassmembers class * {
    @com.getcapacitor.PluginMethod <methods>;
    @com.getcapacitor.annotation.PermissionCallback <methods>;
    @com.getcapacitor.annotation.ActivityCallback <methods>;
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.healthplatform.app.** { *; }
# 소셜 로그인 플러그인(@capgo) — 제공자 클래스를 이름으로 찾는다
-keep class ee.forgr.capacitor.social.login.** { *; }
# Firebase 메시징(FCM) — 라이브러리 consumer 규칙이 있지만 서비스 클래스는 명시
-keep class com.google.firebase.messaging.** { *; }
-dontwarn com.facebook.**
