package com.goldenstore.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

public class PackageChangeReceiver extends BroadcastReceiver {
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

        MainActivity activity = MainActivity.currentActivity.get();
        if (activity != null && activity.gsAndroid != null) {
            if (removed) {
                activity.gsAndroid.onPackageUninstalled(pkg);
            } else {
                activity.gsAndroid.onPackageInstalled(pkg);
            }
        }
    }
}
