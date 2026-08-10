#!/usr/bin/env python3
"""Tiny static server for local preview of the fit-map page.
Serves this folder over http so fetch('./data.json') works (file:// blocks it).
Usage: python3 serve.py [port]
"""
import http.server
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)

Handler = http.server.SimpleHTTPRequestHandler
httpd = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
print("Serving %s at http://127.0.0.1:%d/" % (ROOT, PORT))
httpd.serve_forever()
