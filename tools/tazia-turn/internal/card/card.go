package card

import (
	"fmt"
	"strings"
)

// Credentials shown in TAZIA → Zones → Fix.
type Credentials struct {
	URL        string
	Username   string
	Password   string
	ExternalIP string
	Port       int
}

func (c Credentials) Lines() string {
	return strings.Join([]string{c.URL, c.Username, c.Password}, "\n")
}

func (c Credentials) Banner() string {
	var b strings.Builder
	b.WriteString("\n")
	b.WriteString("  TAZIA → Zones → Fix / Zonas → Arreglar\n")
	b.WriteString("  ------------------------------------\n")
	b.WriteString("  Helper server: ON\n")
	b.WriteString(fmt.Sprintf("  URL:      %s\n", c.URL))
	b.WriteString(fmt.Sprintf("  Username: %s\n", c.Username))
	b.WriteString(fmt.Sprintf("  Password: %s\n", c.Password))
	b.WriteString("  Hide IP:  ON (default)\n")
	b.WriteString("\n")
	b.WriteString("  Both peers: same config → leave and rejoin the zone.\n")
	b.WriteString("  Same Wi‑Fi P2P: uncheck “Hide my internet address”.\n")
	return b.String()
}

func Build(externalIP string, port int, user, pass string) Credentials {
	return Credentials{
		URL:        fmt.Sprintf("turn:%s:%d", externalIP, port),
		Username:   user,
		Password:   pass,
		ExternalIP: externalIP,
		Port:       port,
	}
}
