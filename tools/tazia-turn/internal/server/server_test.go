package server

import (
	"io"
	"log"
	"testing"
)

func TestStartRejectsBadExternalIP(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Password = "x"
	cfg.ExternalIP = "not-an-ip"
	cfg.Logger = log.New(io.Discard, "", 0)
	if _, err := Start(cfg); err == nil {
		t.Fatal("expected error for bad ExternalIP")
	}
}

func TestStartAndClose(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Password = "test-pass"
	cfg.ExternalIP = "127.0.0.1"
	cfg.Port = 0 // will become 3478 — may conflict; pick high port
	cfg.Port = 39999
	cfg.MinPort = 50000
	cfg.MaxPort = 50010
	cfg.Logger = log.New(io.Discard, "", 0)

	srv, err := Start(cfg)
	if err != nil {
		t.Fatalf("start: %v", err)
	}
	defer srv.Close()
	if srv.Config().ExternalIP != "127.0.0.1" {
		t.Fatalf("external ip: %s", srv.Config().ExternalIP)
	}
}

func TestRandomPassword(t *testing.T) {
	a, err := RandomPassword()
	if err != nil || len(a) < 16 {
		t.Fatalf("password %q err=%v", a, err)
	}
}

func TestStartWithFallbackSkipsBusyPort(t *testing.T) {
	cfg := DefaultConfig()
	cfg.Password = "test-pass"
	cfg.ExternalIP = "127.0.0.1"
	cfg.Port = 39998
	cfg.MinPort = 50020
	cfg.MaxPort = 50030
	cfg.Logger = log.New(io.Discard, "", 0)

	first, err := Start(cfg)
	if err != nil {
		t.Fatalf("first start: %v", err)
	}
	defer first.Close()

	second, err := StartWithFallback(cfg, 3)
	if err != nil {
		t.Fatalf("fallback: %v", err)
	}
	defer second.Close()
	if second.Config().Port == first.Config().Port {
		t.Fatalf("expected different port, both %d", second.Config().Port)
	}
}
