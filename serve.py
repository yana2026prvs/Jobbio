#!/usr/bin/env python3
"""Static file server for local preview.

Avoids the stock `python3 -m http.server` CLI, whose argparse setup calls
os.getcwd() to build the --directory default — that call can be blocked by
sandboxed environments (PermissionError: [Errno 1] Operation not permitted).
This script hardcodes the served directory instead, so no getcwd() call is
ever made.
"""
import http.server
import socketserver

PORT = 8000
DIRECTORY = "/Users/anaprideus/Documents/Claude/Jobbio"


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with ReusableTCPServer(("", PORT), Handler) as httpd:
        print(f"Serving {DIRECTORY} at http://localhost:{PORT}")
        httpd.serve_forever()
