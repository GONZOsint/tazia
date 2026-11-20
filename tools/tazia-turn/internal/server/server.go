package server

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"net"
	"os"
	"strings"
	"sync"

	"github.com/pion/turn/v4"
)

// Config for a long-term-credential TURN helper.
type Config struct {
	ListenIP   string // usually "0.0.0.0"
	ExternalIP string // advertised to peers (LAN or public)
	Port       int
	Realm      string
	Username   string
	Password   string
	MinPort    uint16
	MaxPort    uint16
	Logger     *log.Logger
}

// Server wraps pion/turn.
type Server struct {
	cfg    Config
	udp    net.PacketConn
	tcp    net.Listener
	srv    *turn.Server
	mu     sync.Mutex
	closed bool
}

func DefaultConfig() Config {
	return Config{
		ListenIP: "0.0.0.0",
		Port:     3478,
		Realm:    "tazia.local",
		Username: "tazia",
		MinPort:  49160,
		MaxPort:  49200,
		Logger:   log.New(os.Stdout, "", log.LstdFlags),
	}
}

// RandomPassword returns a URL-safe secret (~24 chars).
func RandomPassword() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

func (c Config) authKey(username string, realm string, password string) []byte {
	return turn.GenerateAuthKey(username, realm, password)
}

// Start binds UDP+TCP and serves TURN/STUN until Close.
func Start(cfg Config) (*Server, error) {
	if cfg.ExternalIP == "" {
		return nil, fmt.Errorf("ExternalIP is required")
	}
	extIP := net.ParseIP(cfg.ExternalIP)
	if extIP == nil || extIP.To4() == nil {
		return nil, fmt.Errorf("ExternalIP must be an IPv4 address, got %q", cfg.ExternalIP)
	}
	cfg.ExternalIP = extIP.To4().String()

	if cfg.Password == "" {
		return nil, fmt.Errorf("Password is required")
	}
	if cfg.Username == "" {
		cfg.Username = "tazia"
	}
	if cfg.Realm == "" {
		cfg.Realm = "tazia.local"
	}
	if cfg.Port == 0 {
		cfg.Port = 3478
	}
	if cfg.ListenIP == "" {
		cfg.ListenIP = "0.0.0.0"
	}
	if cfg.MinPort == 0 {
		cfg.MinPort = 49160
	}
	if cfg.MaxPort == 0 {
		cfg.MaxPort = 49200
	}
	if cfg.MinPort > cfg.MaxPort {
		return nil, fmt.Errorf("MinPort (%d) > MaxPort (%d)", cfg.MinPort, cfg.MaxPort)
	}
	if cfg.Logger == nil {
		cfg.Logger = log.New(os.Stdout, "", log.LstdFlags)
	}

	udpAddr, err := net.ResolveUDPAddr("udp", fmt.Sprintf("%s:%d", cfg.ListenIP, cfg.Port))
	if err != nil {
		return nil, err
	}
	udp, err := net.ListenUDP("udp", udpAddr)
	if err != nil {
		return nil, wrapListenErr("udp", cfg.Port, err)
	}

	tcpAddr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf("%s:%d", cfg.ListenIP, cfg.Port))
	if err != nil {
		_ = udp.Close()
		return nil, err
	}
	tcp, err := net.ListenTCP("tcp", tcpAddr)
	if err != nil {
		_ = udp.Close()
		return nil, wrapListenErr("tcp", cfg.Port, err)
	}

	key := cfg.authKey(cfg.Username, cfg.Realm, cfg.Password)

	relayGen := &turn.RelayAddressGeneratorPortRange{
		RelayAddress: extIP.To4(),
		Address:      "0.0.0.0",
		MinPort:      cfg.MinPort,
		MaxPort:      cfg.MaxPort,
	}

	s, err := turn.NewServer(turn.ServerConfig{
		Realm: cfg.Realm,
		AuthHandler: func(username string, realm string, srcAddr net.Addr) ([]byte, bool) {
			if username != cfg.Username || realm != cfg.Realm {
				return nil, false
			}
			return key, true
		},
		PacketConnConfigs: []turn.PacketConnConfig{{
			PacketConn:            udp,
			RelayAddressGenerator: relayGen,
		}},
		ListenerConfigs: []turn.ListenerConfig{{
			Listener:              tcp,
			RelayAddressGenerator: relayGen,
		}},
	})
	if err != nil {
		_ = udp.Close()
		_ = tcp.Close()
		return nil, err
	}

	cfg.Logger.Printf("tazia-turn listening udp/tcp :%d external-ip=%s user=%s realm=%s",
		cfg.Port, cfg.ExternalIP, cfg.Username, cfg.Realm)

	return &Server{cfg: cfg, udp: udp, tcp: tcp, srv: s}, nil
}

func wrapListenErr(proto string, port int, err error) error {
	msg := err.Error()
	if strings.Contains(msg, "Only one usage") ||
		strings.Contains(msg, "address already in use") ||
		strings.Contains(msg, "bind:") {
		return fmt.Errorf("listen %s :%d: %w — port busy (stop Docker coturn or pass -port)", proto, port, err)
	}
	return fmt.Errorf("listen %s: %w", proto, err)
}

func (s *Server) Config() Config {
	return s.cfg
}

func (s *Server) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return nil
	}
	s.closed = true
	// turn.Server.Close already shuts listeners; ignore follow-up close errors.
	if s.srv != nil {
		_ = s.srv.Close()
	}
	if s.udp != nil {
		_ = s.udp.Close()
	}
	if s.tcp != nil {
		_ = s.tcp.Close()
	}
	return nil
}
