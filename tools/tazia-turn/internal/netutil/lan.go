package netutil

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

// LanIPv4 returns the most likely Wi‑Fi/Ethernet IPv4 for LAN peers.
// Prefers RFC1918 addresses on Wi‑Fi/Ethernet; skips virtual adapters.
func LanIPv4() (string, error) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "", err
	}

	type cand struct {
		ip    string
		score int
	}
	var best *cand

	for _, iface := range ifaces {
		if iface.Flags&net.FlagUp == 0 || iface.Flags&net.FlagLoopback != 0 {
			continue
		}
		name := strings.ToLower(iface.Name)
		if isVirtualIface(name) {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}
		for _, addr := range addrs {
			ipNet, ok := addr.(*net.IPNet)
			if !ok || ipNet.IP.To4() == nil {
				continue
			}
			ip := ipNet.IP.To4()
			if ip.IsLoopback() || ip.IsLinkLocalUnicast() {
				continue
			}
			score := scoreIface(name, ip)
			if best == nil || score < best.score {
				best = &cand{ip: ip.String(), score: score}
			}
		}
	}

	if best != nil {
		return best.ip, nil
	}

	// Fallback: UDP dial trick (OS picks the outbound interface).
	conn, err := net.Dial("udp", "1.1.1.1:80")
	if err != nil {
		return "", fmt.Errorf("no usable LAN IPv4: %w", err)
	}
	defer conn.Close()
	host, _, err := net.SplitHostPort(conn.LocalAddr().String())
	if err != nil {
		return "", err
	}
	if parsed := net.ParseIP(host); parsed != nil && parsed.To4() != nil && !parsed.IsLoopback() {
		return host, nil
	}
	return "", fmt.Errorf("no usable LAN IPv4")
}

func isVirtualIface(name string) bool {
	for _, frag := range []string{
		"vethernet", "docker", "wsl", "hyper-v", "vmware", "virtualbox",
		"tailscale", "zerotier", "hamachi", "vbox", "virbr", "br-", "veth",
	} {
		if strings.Contains(name, frag) {
			return true
		}
	}
	return false
}

func scoreIface(name string, ip net.IP) int {
	score := 20
	switch {
	case strings.Contains(name, "wi-fi"), strings.Contains(name, "wifi"),
		strings.Contains(name, "wlan"), strings.Contains(name, "wireless"):
		score = 0
	case strings.Contains(name, "ethernet"), strings.Contains(name, "eth"),
		strings.HasPrefix(name, "en0"), strings.HasPrefix(name, "en1"):
		score = 1
	case ip.IsPrivate():
		score = 5
	}
	if !ip.IsPrivate() {
		score += 50
	}
	return score
}

// PublicIPv4 best-effort via api.ipify.org.
func PublicIPv4() (string, error) {
	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Get("https://api.ipify.org")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 64))
	if err != nil {
		return "", err
	}
	ip := strings.TrimSpace(string(body))
	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.To4() == nil {
		return "", fmt.Errorf("invalid public IP %q", ip)
	}
	return parsed.To4().String(), nil
}
