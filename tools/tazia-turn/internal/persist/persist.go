// Package persist stores last TURN card so restarts keep the same password.
package persist

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Session is the last successful helper card (desktop).
type Session struct {
	URL        string `json:"url"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	ExternalIP string `json:"externalIp"`
	Port       int    `json:"port"`
}

func path() (string, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, "tazia-turn", "session.json"), nil
}

// LoadPassword returns a previously saved password for this username, if any.
func LoadPassword(username string) (string, bool) {
	p, err := path()
	if err != nil {
		return "", false
	}
	raw, err := os.ReadFile(p)
	if err != nil {
		return "", false
	}
	var s Session
	if json.Unmarshal(raw, &s) != nil {
		return "", false
	}
	if s.Username != "" && s.Username != username {
		return "", false
	}
	if s.Password == "" {
		return "", false
	}
	return s.Password, true
}

// Save writes the active card (best-effort).
func Save(s Session) error {
	p, err := path()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(p, raw, 0o600)
}

// Clear removes the saved session.
func Clear() error {
	p, err := path()
	if err != nil {
		return err
	}
	err = os.Remove(p)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
