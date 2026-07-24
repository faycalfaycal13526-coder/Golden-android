package com.goldenstore.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class GoldenFirebaseMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "goldenstore_notifications";
    private static final String TAG = "GoldenFCM";

    @Override
    public void onNewToken(String token) {
        MainActivity.setPendingPushToken(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        if (remoteMessage.getData().isEmpty()) return;
        String title = remoteMessage.getData().get("title");
        String body = remoteMessage.getData().get("body");
        String appSlug = remoteMessage.getData().get("app_slug");
        String image = remoteMessage.getData().get("image");
        String storeLogo = remoteMessage.getData().get("store_logo");

        if (title == null || title.isEmpty()) {
            RemoteMessage.Notification notification = remoteMessage.getNotification();
            if (notification != null) {
                title = notification.getTitle();
                body = notification.getBody();
            }
        }
        if (title == null || title.isEmpty()) return;
        if (body == null) body = "";

        Bitmap largeIcon = null;
        try {
            String imgUrl = (image != null && !image.isEmpty()) ? image : (storeLogo != null && !storeLogo.isEmpty() ? storeLogo : null);
            if (imgUrl != null) largeIcon = downloadBitmap(imgUrl);
        } catch (Exception e) {
            Log.e(TAG, "Icon download failed", e);
        }

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        createChannel(nm);

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        String type = remoteMessage.getData().get("type");
        String extra = remoteMessage.getData().get("extra");
        if (type != null && !type.isEmpty()) intent.putExtra("notification_type", type);
        if (extra != null && !extra.isEmpty()) intent.putExtra("notification_extra", extra);
        if (appSlug != null && !appSlug.isEmpty()) intent.putExtra("app_slug", appSlug);
        int reqCode = (int) System.currentTimeMillis();
        PendingIntent pendingIntent = PendingIntent.getActivity(this, reqCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher_foreground)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_HIGH);
        if (largeIcon != null) builder.setLargeIcon(largeIcon);

        int id = (appSlug != null && !appSlug.isEmpty()) ? appSlug.hashCode() : (int) System.currentTimeMillis();
        nm.notify(id, builder.build());
    }

    private Bitmap downloadBitmap(String urlString) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(urlString).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(15000);
        InputStream in = conn.getInputStream();
        Bitmap bmp = BitmapFactory.decodeStream(in);
        in.close();
        conn.disconnect();
        return bmp;
    }

    private void createChannel(NotificationManager nm) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Golden Store", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Notifications from Golden Store");
            nm.createNotificationChannel(channel);
        }
    }
}
