package com.goldenstore.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import java.util.Map;

public class PackageChangeReceiver extends BroadcastReceiver {
    private static final String TAG = "PackageChangeReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String action = intent.getAction();
        boolean replaced = Intent.ACTION_PACKAGE_REPLACED.equals(action);
        boolean removed = Intent.ACTION_PACKAGE_REMOVED.equals(action);
        boolean added = Intent.ACTION_PACKAGE_ADDED.equals(action);
        if (!added && !replaced && !removed) return;

        Uri data = intent.getData();
        if (data == null) return;
        String pkg = data.getSchemeSpecificPart();
        if (pkg == null || pkg.isEmpty()) return;

        // Ignore partial removals (the app is being replaced/upgraded).
        if (removed && intent.getBooleanExtra(Intent.EXTRA_REPLACING, false)) return;

        Log.i(TAG, "Broadcast received: action=" + action + ", package=" + pkg);

        MainActivity activity = MainActivity.currentActivity.get();
        if (activity != null && activity.gsAndroid != null) {
            if (removed) {
                activity.gsAndroid.onPackageUninstalled(pkg);
            } else {
                activity.gsAndroid.onPackageInstalled(pkg);
            }
        } else if (context != null) {
            try {
                android.content.SharedPreferences prefs = context.getSharedPreferences("gs_installed_apps", Context.MODE_PRIVATE);
                if (removed) {
                    Map<String, ?> all = prefs.getAll();
                    for (Map.Entry<String, ?> entry : all.entrySet()) {
                        if (pkg.equals(entry.getValue())) {
                            prefs.edit().remove(entry.getKey()).apply();
                        }
                    }
                }
            } catch (Exception ignore) {}
        }
    }
}
