package app.kairo.personal;

import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Kairo sleep tracking without a watch: reads the phone's own screen on/off history
 * (UsageStatsManager, needs the user to grant "Usage access"). Nothing leaves the device.
 */
@CapacitorPlugin(name = "SleepTracker")
public class SleepTrackerPlugin extends Plugin {

    private boolean hasUsageAccess() {
        AppOpsManager ops = (AppOpsManager) getContext().getSystemService(Context.APP_OPS_SERVICE);
        int mode;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            mode = ops.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        } else {
            mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getContext().getPackageName());
        }
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    @PluginMethod
    public void hasPermission(PluginCall call) {
        JSObject r = new JSObject();
        r.put("granted", hasUsageAccess());
        call.resolve(r);
    }

    @PluginMethod
    public void openPermissionSettings(PluginCall call) {
        Intent i = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(i);
        call.resolve();
    }

    /** Returns [{ts, type:"on"|"off"}] between `from` and `to` (epoch ms). */
    @PluginMethod
    public void getScreenEvents(PluginCall call) {
        if (!hasUsageAccess()) { call.reject("USAGE_ACCESS_DENIED"); return; }
        long from = call.getLong("from", System.currentTimeMillis() - 24L * 3600 * 1000);
        long to = call.getLong("to", System.currentTimeMillis());
        UsageStatsManager usm = (UsageStatsManager) getContext().getSystemService(Context.USAGE_STATS_SERVICE);
        UsageEvents events = usm.queryEvents(from, to);
        JSArray out = new JSArray();
        UsageEvents.Event e = new UsageEvents.Event();
        while (events.hasNextEvent()) {
            events.getNextEvent(e);
            String type = null;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                if (e.getEventType() == UsageEvents.Event.SCREEN_INTERACTIVE) type = "on";
                else if (e.getEventType() == UsageEvents.Event.SCREEN_NON_INTERACTIVE) type = "off";
            } else {
                // Pre-Android 9 fallback: app foreground/background as a proxy for phone use
                if (e.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) type = "on";
                else if (e.getEventType() == UsageEvents.Event.MOVE_TO_BACKGROUND) type = "off";
            }
            if (type != null) {
                JSObject o = new JSObject();
                o.put("ts", e.getTimeStamp());
                o.put("type", type);
                out.put(o);
            }
        }
        JSObject r = new JSObject();
        r.put("events", out);
        call.resolve(r);
    }
}
