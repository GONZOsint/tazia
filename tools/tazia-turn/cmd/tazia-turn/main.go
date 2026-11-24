package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/tazia-app/tazia-turn/internal/card"
	"github.com/tazia-app/tazia-turn/internal/clipboard"
	"github.com/tazia-app/tazia-turn/internal/firewall"
	"github.com/tazia-app/tazia-turn/internal/netutil"
	"github.com/tazia-app/tazia-turn/internal/persist"
	"github.com/tazia-app/tazia-turn/internal/server"
)

func main() {
	port := flag.Int("port", 3478, "TURN listen port")
	user := flag.String("user", "tazia", "TURN username")
	pass := flag.String("pass", "", "TURN password (reuse saved / random if empty)")
	external := flag.String("external-ip", "", "Advertised IP (auto LAN if empty)")
	public := flag.Bool("public", false, "Use public IP instead of LAN")
	noFirewall := flag.Bool("no-firewall", false, "Skip Windows firewall rule")
	autoPort := flag.Bool("auto-port", true, "If listen port is busy, try the next 10 ports")
	fresh := flag.Bool("fresh", false, "Ignore saved password; generate a new one")
	clearSaved := flag.Bool("clear-saved", false, "Delete saved credentials and exit")
	flag.Parse()

	logger := log.New(os.Stdout, "", 0)

	if *clearSaved {
		if err := persist.Clear(); err != nil {
			logger.Fatalf("clear-saved: %v", err)
		}
		logger.Printf("cleared saved TAZIA Turn credentials")
		return
	}

	ext := *external
	var err error
	if ext == "" {
		if *public {
			ext, err = netutil.PublicIPv4()
		} else {
			ext, err = netutil.LanIPv4()
		}
		if err != nil {
			logger.Fatalf("detect IP: %v", err)
		}
	}

	password := *pass
	if password == "" && !*fresh {
		if saved, ok := persist.LoadPassword(*user); ok {
			password = saved
			logger.Printf("reusing saved password (pass -fresh to rotate)")
		}
	}
	if password == "" {
		password, err = server.RandomPassword()
		if err != nil {
			logger.Fatalf("password: %v", err)
		}
	}

	cfg := server.DefaultConfig()
	cfg.Port = *port
	cfg.Username = *user
	cfg.Password = password
	cfg.ExternalIP = ext
	cfg.Logger = logger

	if !*noFirewall {
		if err := firewall.EnsureOpen(cfg.Port, cfg.MinPort, cfg.MaxPort); err != nil {
			logger.Printf("!! %v", err)
		}
	}

	var srv *server.Server
	if *autoPort {
		srv, err = server.StartWithFallback(cfg, 10)
	} else {
		srv, err = server.Start(cfg)
	}
	if err != nil {
		logger.Fatalf("start: %v", err)
	}
	defer srv.Close()

	live := srv.Config()
	creds := card.Build(live.ExternalIP, live.Port, live.Username, password)
	if err := persist.Save(persist.Session{
		URL:        creds.URL,
		Username:   creds.Username,
		Password:   creds.Password,
		ExternalIP: creds.ExternalIP,
		Port:       creds.Port,
	}); err != nil {
		logger.Printf("persist: %v", err)
	}

	fmt.Print(creds.Banner())
	if err := clipboard.Write(creds.Lines()); err != nil {
		logger.Printf("clipboard: unavailable (%v)", err)
	} else {
		logger.Printf("clipboard: URL / user / pass (3 lines)")
	}

	logger.Printf("running — Ctrl+C to stop")
	ch := make(chan os.Signal, 1)
	signal.Notify(ch, os.Interrupt, syscall.SIGTERM)
	<-ch
	logger.Printf("stopping…")
}
