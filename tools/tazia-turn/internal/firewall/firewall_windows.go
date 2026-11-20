//go:build windows

package firewall

import (
	"fmt"
	"os/exec"
	"strings"
)

const ruleName = "TAZIA Turn Helper"

// EnsureOpen opens UDP 3478 + relay range for Private/Domain profiles.
// Requires Administrator; returns a soft error otherwise.
func EnsureOpen(port int, minRelay, maxRelay uint16) error {
	if ruleExists() {
		return nil
	}
	ports := fmt.Sprintf("%d,%d-%d", port, minRelay, maxRelay)
	// UDP (STUN/TURN + relay) and TCP (TURN over TCP fallback).
	for _, proto := range []string{"UDP", "TCP"} {
		localPort := ports
		if proto == "TCP" {
			localPort = fmt.Sprintf("%d", port)
		}
		cmd := exec.Command("netsh", "advfirewall", "firewall", "add", "rule",
			fmt.Sprintf("name=%s (%s)", ruleName, proto),
			"dir=in",
			"action=allow",
			fmt.Sprintf("protocol=%s", proto),
			fmt.Sprintf("localport=%s", localPort),
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
