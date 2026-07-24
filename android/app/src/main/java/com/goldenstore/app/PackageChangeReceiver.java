package com.goldenstore.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

public class PackageChangeReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        Uri data = intent.getData();
        if (data == null) return;
        String pkg = data.getSchemeSpecificPart();
        if (pkg == null || pkg.isEmpty()) return;
        MainActivity activity = MainActivity.currentActivity.get();
        if (activity != null && activity.gsAndroid != null) {
            activity.gsAndroid.onPackageInstalled(pkg);
        }
    }
}
