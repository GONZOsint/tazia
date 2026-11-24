package app.tazia.turn

import android.Manifest
import android.content.BroadcastReceiver
import android.content.ClipData
import android.content.ClipboardManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import app.tazia.turn.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding
    private var service: TurnForegroundService? = null
    private var bound = false

    private val notifPermission = registerForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { /* continue anyway */ }

    private val stateReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            render()
        }
    }

    private val connection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, binder: IBinder?) {
            service = (binder as TurnForegroundService.LocalBinder).getService()
            bound = true
            render()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
            service = null
            bound = false
            render()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
            != PackageManager.PERMISSION_GRANTED
        ) {
            notifPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
        }

        binding.btnStart.setOnClickListener {
            ContextCompat.startForegroundService(
                this,
                Intent(this, TurnForegroundService::class.java).apply {
                    action = TurnForegroundService.ACTION_START
                },
            )
            ensureBound()
            // Start is async — refresh a few times while the helper boots.
            listOf(300L, 700L, 1400L).forEach { delay ->
                binding.root.postDelayed({ render() }, delay)
            }
        }

        binding.btnStop.setOnClickListener {
            startService(
                Intent(this, TurnForegroundService::class.java).apply {
                    action = TurnForegroundService.ACTION_STOP
                },
            )
            binding.root.postDelayed({ render() }, 350)
        }

        binding.btnCopy.setOnClickListener {
            val card = currentCard() ?: return@setOnClickListener
            val cm = getSystemService(ClipboardManager::class.java)
            cm.setPrimaryClip(
                ClipData.newPlainText(
                    "tazia-turn",
                    "${card.url}\n${card.username}\n${card.password}",
                ),
            )
            Toast.makeText(this, R.string.copied, Toast.LENGTH_SHORT).show()
        }

        binding.btnRotate.setOnClickListener {
            ContextCompat.startForegroundService(
                this,
                Intent(this, TurnForegroundService::class.java).apply {
                    action = TurnForegroundService.ACTION_ROTATE
                },
            )
            ensureBound()
            listOf(400L, 900L, 1600L).forEach { delay ->
                binding.root.postDelayed({ render() }, delay)
            }
        }
    }

    override fun onStart() {
        super.onStart()
        val filter = IntentFilter(TurnForegroundService.ACTION_STATE)
        ContextCompat.registerReceiver(
            this,
            stateReceiver,
            filter,
            ContextCompat.RECEIVER_NOT_EXPORTED,
        )
        ensureBound()
        render()
    }

    override fun onStop() {
        try {
            unregisterReceiver(stateReceiver)
        } catch (_: Exception) {
        }
        if (bound) {
            unbindService(connection)
            bound = false
            service = null
        }
        super.onStop()
    }

    private fun ensureBound() {
        if (bound) return
        bindService(
            Intent(this, TurnForegroundService::class.java),
            connection,
            Context.BIND_AUTO_CREATE,
        )
    }

    private fun currentCard(): TurnCard? =
        service?.currentCard() ?: TurnForegroundService.lastCard

    private fun render() {
        val card = currentCard()
        val running = service?.isRunning() == true || TurnForegroundService.lastRunning
        val err = service?.lastError() ?: TurnForegroundService.lastError
        binding.status.text = if (running) getString(R.string.status_on) else getString(R.string.status_off)
        binding.urlValue.text = card?.url ?: "—"
        binding.userValue.text = card?.username ?: "—"
        binding.passValue.text = card?.password ?: "—"
        binding.btnStart.isEnabled = !running
        binding.btnStop.isEnabled = running
        binding.btnCopy.isEnabled = card != null
        binding.error.text = err.orEmpty()
    }
}
