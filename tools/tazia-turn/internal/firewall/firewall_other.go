//go:build !windows

package firewall

// EnsureOpen is a no-op on non-Windows (macOS usually allows listener; Linux: open UFW manually).
func EnsureOpen(port int, minRelay, maxRelay uint16) error {
	_ = port
	_ = minRelay
	_ = maxRelay
	return nil
}
