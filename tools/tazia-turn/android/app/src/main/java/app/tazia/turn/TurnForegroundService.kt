package app.tazia.turn

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Binder
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.util.concurrent.Executors

class TurnForegroundService : Service() {
    companion object {
        const val ACTION_START = "app.tazia.turn.START"
        const val ACTION_STOP = "app.tazia.turn.STOP"
        const val ACTION_STATE = "app.tazia.turn.STATE"
        private const val CHANNEL_ID = "tazia_turn"
        private const val NOTIF_ID = 3478

        /** Survives brief unbind so the activity can still show the last card/error. */
        @Volatile var lastCard: TurnCard? = null
            private set
        @Volatile var lastError: String? = null
            private set
        @Volatile var lastRunning: Boolean = false
            private set
    }

    inner class LocalBinder : Binder() {
        fun getService(): TurnForegroundService = this@TurnForegroundService
    }

    private val binder = LocalBinder()
    private val executor = Executors.newSingleThreadExecutor()
    private val mainHandler = Handler(Looper.getMainLooper())
    private val helper = NativeTurnHelper(this)

    @Volatile private var running = false
    @Volatile private var card: TurnCard? = null
    @Volatile private var error: String? = null

    override fun onBind(intent: Intent?): IBinder = binder

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopHelper()
                publish()
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_START, null -> {
                startForeground(NOTIF_ID, buildNotification(getString(R.string.notif_starting)))
                startHelper()
            }
        }
        // Do not sticky-restart with a new random password.
        return START_NOT_STICKY
    }

    fun isRunning(): Boolean = running
    fun currentCard(): TurnCard? = card ?: lastCard
    fun lastError(): String? = error ?: TurnForegroundService.lastError

    private fun startHelper() {
        executor.execute {
            try {
                val started = helper.start()
                card = started
                running = true
                error = null
                mainHandler.post {
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NOTIF_ID, buildNotification(started.url))
                    publish()
                }
            } catch (e: Exception) {
                running = false
                card = null
                error = e.message ?: e.toString()
                mainHandler.post {
                    publish()
                    stopForeground(STOP_FOREGROUND_REMOVE)
                    stopSelf()
                }
            }
        }
    }

    private fun stopHelper() {
        helper.stop()
        running = false
        // Keep last card for copy-after-stop convenience.
    }

    private fun publish() {
        lastCard = card
        lastError = error
        lastRunning = running
        sendBroadcast(
            Intent(ACTION_STATE).setPackage(packageName),
        )
    }

    override fun onDestroy() {
        stopHelper()
        lastRunning = false
        executor.shutdownNow()
        super.onDestroy()
    }

    private fun buildNotification(content: String): Notification {
        ensureChannel()
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.notif_title))
            .setContentText(content)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun ensureChannel() {
        if (Build.VERSION.SDK_INT < 26) return
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                getString(R.string.notif_channel),
                NotificationManager.IMPORTANCE_LOW,
            ),
        )
    }
}
