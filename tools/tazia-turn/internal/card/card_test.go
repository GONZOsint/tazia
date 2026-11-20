package card

import (
	"strings"
	"testing"
)

func TestBuildAndLines(t *testing.T) {
	c := Build("192.168.1.10", 3478, "tazia", "secret")
	if c.URL != "turn:192.168.1.10:3478" {
		t.Fatalf("url: %s", c.URL)
	}
	want := "turn:192.168.1.10:3478\ntazia\nsecret"
	if c.Lines() != want {
		t.Fatalf("lines:\n%s", c.Lines())
	}
	b := c.Banner()
	for _, part := range []string{c.URL, c.Username, c.Password} {
		if !strings.Contains(b, part) {
			t.Fatalf("banner missing %q:\n%s", part, b)
		}
	}
}
