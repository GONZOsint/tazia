package app.tazia.turn

import android.content.Context
import android.net.wifi.WifiManager
import java.io.File
import java.lang.Process as JavaProcess
import java.net.Inet4Address
import java.net.NetworkInterface
import java.util.Collections
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
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

    fun start(port: Int = 3478, username: String = "tazia"): TurnCard {
        stop()
        val ip = lanIPv4() ?: throw IllegalStateException("No Wi‑Fi/LAN IPv4 — connect to Wi‑Fi")
        val password = randomPassword()
        val bin = nativeBinary()
        if (!bin.exists()) {
            throw IllegalStateException(
                "Native helper missing (${bin.name}). Rebuild with tools/tazia-turn/build/build-android.ps1",
            )
        }
        bin.setExecutable(true)

        acquireWifiLocks()

        val pb = ProcessBuilder(
            bin.absolutePath,
            "-external-ip", ip,
            "-port", port.toString(),
            "-user", username,
            "-pass", password,
            "-no-firewall",
        )
        pb.redirectErrorStream(true)
        pb.directory(context.filesDir)
        pb.environment()["HOME"] = context.filesDir.absolutePath
        val proc = pb.start()
        process = proc

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

        // Fail fast if binary dies immediately.
        Thread.sleep(500)
        try {
            val code = proc.exitValue()
            throw IllegalStateException("Helper exited $code (port busy or binary blocked?)")
        } catch (_: IllegalThreadStateException) {
            // still running
        }

        return TurnCard(
            url = "turn:$ip:$port",
            username = username,
            password = password,
            externalIp = ip,
            port = port,
        )
    }

    fun stop() {
        process?.let { p ->
            p.destroy()
            if (!p.waitFor(2, TimeUnit.SECONDS)) {
                p.destroyForcibly()
            }
        }
        process = null
        releaseWifiLocks()
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

    private fun randomPassword(): String {
        val alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
        return (1..20).map { alphabet[Random.nextInt(alphabet.length)] }.joinToString("")
    }
}
