package app.tazia.turn

import android.content.Context
import android.content.SharedPreferences
import android.net.wifi.WifiManager
import java.io.File
import java.lang.Process as JavaProcess
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.random.Random

data class TurnCard(
    val url: String,
    val username: String,
    val password: String,
    val externalIp: String,
    val port: Int,
)

/**
 * Runs the packaged Go binary from jniLibs (named libtazia_turn.so so Android
 * extracts it to nativeLibraryDir, which is executable on most devices).
 */
class NativeTurnHelper(private val context: Context) {
    private var process: JavaProcess? = null
    private var multicastLock: WifiManager.MulticastLock? = null
    private var wifiLock: WifiManager.WifiLock? = null
    private val drainPool = Executors.newCachedThreadPool()
    private var watchPool: ScheduledExecutorService? = null
    private val watching = AtomicBoolean(false)
    private val prefs: SharedPreferences =
        context.getSharedPreferences("tazia_turn", Context.MODE_PRIVATE)

    /** Invoked on the helper thread when the native process exits unexpectedly. */
    @Volatile var onProcessDied: ((exitCode: Int) -> Unit)? = null

    fun start(preferredPort: Int = 3478, username: String = "tazia"): TurnCard {
        stop()
        val ip = lanIPv4() ?: throw IllegalStateException("No Wi‑Fi/LAN IPv4 — connect to Wi‑Fi")
        val password = loadOrCreatePassword(username)
        val bin = nativeBinary()
        if (!bin.exists()) {
            throw IllegalStateException(
                "Native helper missing (${bin.name}). Rebuild with tools/tazia-turn/build/build-android.ps1",
            )
        }
        bin.setExecutable(true)

        acquireWifiLocks()

        var lastErr: Exception? = null
        for (offset in 0..10) {
            val port = preferredPort + offset
            try {
                val proc = spawn(bin, ip, port, username, password)
                process = proc
                startWatchdog(proc)
                val card = TurnCard(
                    url = "turn:$ip:$port",
                    username = username,
                    password = password,
                    externalIp = ip,
                    port = port,
                )
                saveCard(card)
                return card
            } catch (e: Exception) {
                lastErr = e
                process = null
            }
        }
        releaseWifiLocks()
        throw lastErr ?: IllegalStateException("Could not bind TURN ports $preferredPort–${preferredPort + 10}")
    }

    fun stop() {
        stopWatchdog()
        process?.let { p ->
            p.destroy()
            if (!p.waitFor(2, TimeUnit.SECONDS)) {
                p.destroyForcibly()
            }
        }
        process = null
        releaseWifiLocks()
    }

    fun isAlive(): Boolean {
        val p = process ?: return false
        return try {
            p.exitValue()
            false
        } catch (_: IllegalThreadStateException) {
            true
        }
    }

    private fun spawn(
        bin: File,
        ip: String,
        port: Int,
        username: String,
        password: String,
    ): JavaProcess {
        val pb = ProcessBuilder(
            bin.absolutePath,
            "-external-ip", ip,
            "-port", port.toString(),
            "-user", username,
            "-pass", password,
            "-no-firewall",
            "-auto-port=false",
        )
        pb.redirectErrorStream(true)
        pb.directory(context.filesDir)
        pb.environment()["HOME"] = context.filesDir.absolutePath
        val proc = pb.start()

        // Drain stdout so a full pipe cannot stall the helper.
        drainPool.execute {
            try {
                proc.inputStream.bufferedReader().use { reader ->
                    while (reader.readLine() != null) {
                        // discard — card is owned by Kotlin
                    }
                }
            } catch (_: Exception) {
            }
        }

        // Fail fast if binary dies immediately (port busy / blocked).
        Thread.sleep(450)
        try {
            val code = proc.exitValue()
            throw IllegalStateException("Helper exited $code (port $port busy or binary blocked?)")
        } catch (_: IllegalThreadStateException) {
            // still running
        }
        return proc
    }

    private fun startWatchdog(proc: JavaProcess) {
        stopWatchdog()
        watching.set(true)
        val pool = Executors.newSingleThreadScheduledExecutor()
        watchPool = pool
        pool.scheduleWithFixedDelay({
            if (!watching.get()) return@scheduleWithFixedDelay
            try {
                val code = proc.exitValue()
                watching.set(false)
                onProcessDied?.invoke(code)
            } catch (_: IllegalThreadStateException) {
                // still alive
            }
        }, 1, 2, TimeUnit.SECONDS)
    }

    private fun stopWatchdog() {
        watching.set(false)
        watchPool?.shutdownNow()
        watchPool = null
    }

    private fun nativeBinary(): File {
        val dir = File(context.applicationInfo.nativeLibraryDir)
        val primary = File(dir, "libtazia_turn.so")
        if (primary.exists()) return primary
        return File(dir, "tazia-turn")
    }

    private fun acquireWifiLocks() {
        val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        val mLock = wifi.createMulticastLock("tazia-turn-mcast")
        mLock.setReferenceCounted(false)
        mLock.acquire()
        multicastLock = mLock

        @Suppress("DEPRECATION")
        val wLock = wifi.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "tazia-turn-wifi")
        wLock.setReferenceCounted(false)
        wLock.acquire()
        wifiLock = wLock

        android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_FOREGROUND)
    }

    private fun releaseWifiLocks() {
        multicastLock?.let { if (it.isHeld) it.release() }
        multicastLock = null
        wifiLock?.let { if (it.isHeld) it.release() }
        wifiLock = null
    }

    private fun lanIPv4(): String? {
        data class Cand(val ip: String, val score: Int)
        var best: Cand? = null
        val interfaces = Collections.list(NetworkInterface.getNetworkInterfaces())
        for (nif in interfaces) {
            if (!nif.isUp || nif.isLoopback) continue
            val name = nif.name.lowercase()
            if (name.contains("rmnet") || name.contains("dummy") || name.contains("tun") ||
                name.contains("vpn") || name.startsWith("veth")
            ) {
                continue
            }
            val score = when {
                name.startsWith("wlan") || name.contains("wifi") -> 0
                name.startsWith("eth") -> 1
                else -> 5
            }
            for (addr in Collections.list(nif.inetAddresses)) {
                if (addr is Inet4Address && !addr.isLoopbackAddress && addr.isSiteLocalAddress) {
                    val c = Cand(addr.hostAddress ?: continue, score)
                    if (best == null || c.score < best!!.score) best = c
                }
            }
        }
        return best?.ip
    }

    private fun loadOrCreatePassword(username: String): String {
        val savedUser = prefs.getString(KEY_USER, null)
        val savedPass = prefs.getString(KEY_PASS, null)
        if (savedUser == username && !savedPass.isNullOrBlank()) {
            return savedPass
        }
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
        val fresh = (1..20).map { alphabet[Random.nextInt(alphabet.length)] }.joinToString("")
        prefs.edit().putString(KEY_USER, username).putString(KEY_PASS, fresh).apply()
        return fresh
    }

    private fun saveCard(card: TurnCard) {
        prefs.edit()
            .putString(KEY_URL, card.url)
            .putString(KEY_USER, card.username)
            .putString(KEY_PASS, card.password)
            .putString(KEY_IP, card.externalIp)
            .putInt(KEY_PORT, card.port)
            .apply()
    }

    companion object {
        private const val KEY_URL = "url"
        private const val KEY_USER = "user"
        private const val KEY_PASS = "pass"
        private const val KEY_IP = "ip"
        private const val KEY_PORT = "port"

        fun loadLastCard(context: Context): TurnCard? {
            val p = context.getSharedPreferences("tazia_turn", Context.MODE_PRIVATE)
            val url = p.getString(KEY_URL, null) ?: return null
            val user = p.getString(KEY_USER, null) ?: return null
            val pass = p.getString(KEY_PASS, null) ?: return null
            val ip = p.getString(KEY_IP, null) ?: return null
            val port = p.getInt(KEY_PORT, 0)
            if (port <= 0) return null
            return TurnCard(url, user, pass, ip, port)
        }

        /** Force a new password on next start. */
        fun clearSavedPassword(context: Context) {
            context.getSharedPreferences("tazia_turn", Context.MODE_PRIVATE)
                .edit()
                .remove(KEY_PASS)
                .apply()
        }
    }
}
