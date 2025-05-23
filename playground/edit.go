// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package main

import (
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"runtime"
	"strings"
)

const hostname = "play.xgo.dev"

var editTemplate = template.Must(template.ParseFiles("edit.html"))

type editData struct {
	Snippet   *snippet
	Share     bool
	Analytics bool
	GoVersion string
}

func (s *server) handleEdit(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	if r.Method == "OPTIONS" {
		// This is likely a pre-flight CORS request.
		return
	}

	// Redirect foo.play.golang.org to play.golang.org.
	if strings.HasSuffix(r.Host, "."+hostname) {
		http.Redirect(w, r, "https://"+hostname, http.StatusFound)
		return
	}

	// Serve 404 for /foo.
	if r.URL.Path != "/" && !strings.HasPrefix(r.URL.Path, "/p/") {
		http.NotFound(w, r)
		return
	}

	snip := &snippet{Body: []byte(hello)}
	if strings.HasPrefix(r.URL.Path, "/p/") {
		if !allowShare(r) {
			w.WriteHeader(http.StatusUnavailableForLegalReasons)
			w.Write([]byte(`<h1>Unavailable For Legal Reasons</h1><p>Viewing and/or sharing code snippets is not available in your country for legal reasons. This message might also appear if your country is misdetected. If you believe this is an error, please <a href="https://golang.org/issue">file an issue</a>.</p>`))
			return
		}
		id := r.URL.Path[3:]
		serveText := false
		if strings.HasSuffix(id, ".gop") {
			id = id[:len(id)-4]
			serveText = true
		}

		if err := s.db.GetSnippet(r.Context(), id, snip); err != nil {
			if errors.Is(err, ErrNoSuchEntity) {
				s.log.Errorf("loading Snippet: %v", err)
			}
			http.Error(w, "Snippet not found", http.StatusNotFound)
			return
		}
		if serveText {
			if r.FormValue("download") == "true" {
				w.Header().Set(
					"Content-Disposition", fmt.Sprintf(`attachment; filename="%s.gop"`, id),
				)
			}
			w.Header().Set("Content-type", "text/plain; charset=utf-8")
			w.Write(snip.Body)
			return
		}
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	data := &editData{
		Snippet:   snip,
		Share:     allowShare(r),
		Analytics: r.Host == hostname,
		GoVersion: runtime.Version(),
	}
	if err := editTemplate.Execute(w, data); err != nil {
		s.log.Errorf("editTemplate.Execute(w, %+v): %v", data, err)
		return
	}
}

const hello = `fields := [
	"engineering",
	"STEM education",
	"and data science",
]

println "The XGo language for", fields.join(", ")
`
