# Keep Golden Store JS interfaces and FCM service
-keep public class com.goldenstore.app.MainActivity { public *; }
-keep public class com.goldenstore.app.GSAndroid { public *; }
-keep public class com.goldenstore.app.GoldenFirebaseMessagingService { public *; }
-keep public class com.goldenstore.app.PackageChangeReceiver { public *; }
-keepclassmembers class com.goldenstore.app.GSAndroid { public *; }

# Capacitor / Cordova
-keep class com.getcapacitor.** { *; }
-keepclassmembers class com.getcapacitor.** { *; }
-dontwarn com.getcapacitor.**

# Firebase
-keep class com.google.firebase.** { *; }
-keepclassmembers class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**
-keep class com.google.android.gms.** { *; }
-dontwarn com.google.android.gms.**

# WebView JS interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
