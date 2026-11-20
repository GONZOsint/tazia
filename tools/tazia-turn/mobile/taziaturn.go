// Package taziaturn exposes a tiny API for gomobile bind / embedding.
package taziaturn

import (
	"sync"

	"github.com/tazia-app/tazia-turn/internal/card"
	"github.com/tazia-app/tazia-turn/internal/netutil"
	"github.com/tazia-app/tazia-turn/internal/server"
)

var (
	mu     sync.Mutex
	active *server.Server
	last   card.Credentials
)

// Status is a gomobile-friendly snapshot.
type Status struct {
	Running    bool
	URL        string
	Username   string
	Password   string
	ExternalIP string
	Port       int
	Error      string
}

// DetectLanIP returns the device LAN IPv4.
func DetectLanIP() (string, error) {
	return netutil.LanIPv4()
}

// Start launches TURN on port (default 3478). Empty password → random.
// externalIP empty → auto LAN detect.
func Start(externalIP string, port int, username, password string) *Status {
	mu.Lock()
	defer mu.Unlock()

	if active != nil {
		st := statusLocked()
		st.Error = "already running"
		return st
	}

	cfg := server.DefaultConfig()
	if port > 0 {
		cfg.Port = port
	}
	if username != "" {
		cfg.Username = username
	}
	if password == "" {
		p, err := server.RandomPassword()
		if err != nil {
			return &Status{Error: err.Error()}
		}
		password = p
	}
	cfg.Password = password

	if externalIP == "" {
		ip, err := netutil.LanIPv4()
		if err != nil {
			return &Status{Error: err.Error()}
		}
		externalIP = ip
	}
	cfg.ExternalIP = externalIP

	srv, err := server.Start(cfg)
	if err != nil {
		return &Status{Error: err.Error()}
	}
	active = srv
	last = card.Build(externalIP, cfg.Port, cfg.Username, password)
	return statusLocked()
}

// Stop shuts down the helper.
func Stop() *Status {
	mu.Lock()
	defer mu.Unlock()
	if active != nil {
		_ = active.Close()
		active = nil
	}
	return statusLocked()
}

// GetStatus returns the current card / running flag.
func GetStatus() *Status {
	mu.Lock()
	defer mu.Unlock()
	return statusLocked()
}

func statusLocked() *Status {
	return &Status{
		Running:    active != nil,
		URL:        last.URL,
		Username:   last.Username,
		Password:   last.Password,
		ExternalIP: last.ExternalIP,
		Port:       last.Port,
	}
}
