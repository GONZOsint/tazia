//go:build windows

package firewall

import (
	"fmt"
	"os/exec"
	"strings"
)

const ruleName = "TAZIA Turn Helper"

// EnsureOpen opens UDP/TCP listen ports + UDP relay range for Private/Domain profiles.
// listenPort is the preferred TURN port; we also allow listenPort..(listenPort+10) for -auto-port.
// Requires Administrator; returns a soft error otherwise.
func EnsureOpen(port int, minRelay, maxRelay uint16) error {
	if ruleExists() {
		return nil
	}
	listenEnd := port + 10
	udpPorts := fmt.Sprintf("%d-%d,%d-%d", port, listenEnd, minRelay, maxRelay)
	tcpPorts := fmt.Sprintf("%d-%d", port, listenEnd)
	for _, spec := range []struct {
		proto string
		ports string
	}{
		{"UDP", udpPorts},
		{"TCP", tcpPorts},
	} {
		cmd := exec.Command("netsh", "advfirewall", "firewall", "add", "rule",
			fmt.Sprintf("name=%s (%s)", ruleName, spec.proto),
			"dir=in",
			"action=allow",
			fmt.Sprintf("protocol=%s", spec.proto),
			fmt.Sprintf("localport=%s", spec.ports),
			"profile=private,domain",
		)
		out, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("firewall (run as Admin once): %w — %s", err, strings.TrimSpace(string(out)))
		}
	}
	return nil
}

func ruleExists() bool {
	cmd := exec.Command("netsh", "advfirewall", "firewall", "show", "rule", fmt.Sprintf("name=%s (UDP)", ruleName))
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false
	}
	return strings.Contains(string(out), ruleName)
}
