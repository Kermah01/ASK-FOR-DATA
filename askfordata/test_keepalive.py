"""
Tests du keep-alive (askfordata/keepalive.py).

    python manage.py test askfordata
"""

import datetime
import fcntl
import hashlib
import http.server
import os
import tempfile
import threading
import time
import unittest

from django.test import SimpleTestCase

from askfordata import keepalive

UTC = datetime.timezone.utc
WEEKDAYS = {1, 2, 3, 4, 5}


def utc(year, month, day, hour, minute=0):
    return datetime.datetime(year, month, day, hour, minute, tzinfo=UTC)


class WindowTests(unittest.TestCase):
    # 2026-10-19 est un lundi.

    def test_parse_days(self):
        self.assertEqual(keepalive.parse_days("1-5"), WEEKDAYS)
        self.assertEqual(keepalive.parse_days("1,3, 6-7"), {1, 3, 6, 7})
        with self.assertRaises(ValueError):
            keepalive.parse_days("0-5")

    def test_inside_window(self):
        self.assertTrue(keepalive.in_window(utc(2026, 10, 19, 8, 0), WEEKDAYS, 8, 19))   # lundi, borne basse incluse
        self.assertTrue(keepalive.in_window(utc(2026, 10, 21, 12, 30), WEEKDAYS, 8, 19))  # mercredi midi
        self.assertTrue(keepalive.in_window(utc(2026, 10, 23, 18, 59), WEEKDAYS, 8, 19))  # vendredi 18:59

    def test_outside_window(self):
        self.assertFalse(keepalive.in_window(utc(2026, 10, 19, 7, 59), WEEKDAYS, 8, 19))  # avant 08:00
        self.assertFalse(keepalive.in_window(utc(2026, 10, 23, 19, 0), WEEKDAYS, 8, 19))  # borne haute exclue
        self.assertFalse(keepalive.in_window(utc(2026, 10, 20, 2, 0), WEEKDAYS, 8, 19))   # nuit

    def test_weekend(self):
        self.assertFalse(keepalive.in_window(utc(2026, 10, 24, 12, 0), WEEKDAYS, 8, 19))  # samedi
        self.assertFalse(keepalive.in_window(utc(2026, 10, 25, 12, 0), WEEKDAYS, 8, 19))  # dimanche


class ConfigTests(unittest.TestCase):

    def test_inactive_without_url(self):
        self.assertIsNone(keepalive.load_config({}, "/api/health"))
        self.assertIsNone(keepalive.start(default_path="/api/health", environ={}))

    def test_disabled_flag(self):
        env = {"RENDER_EXTERNAL_URL": "https://x.onrender.com", "KEEPALIVE_DISABLED": "1"}
        self.assertIsNone(keepalive.load_config(env, "/api/health"))

    def test_render_external_url_with_default_path(self):
        config = keepalive.load_config({"RENDER_EXTERNAL_URL": "https://x.onrender.com/"}, "/api/health")
        self.assertEqual(config["url"], "https://x.onrender.com/api/health")
        self.assertEqual((config["days"], config["start_hour"], config["end_hour"], config["interval"]),
                         (WEEKDAYS, 8, 19, 600))

    def test_explicit_url_and_window(self):
        env = {
            "KEEPALIVE_URL": "https://exemple.org/ping",
            "RENDER_EXTERNAL_URL": "https://x.onrender.com",
            "KEEPALIVE_DAYS": "1-7", "KEEPALIVE_START_HOUR": "0",
            "KEEPALIVE_END_HOUR": "24", "KEEPALIVE_INTERVAL_SECONDS": "5",
        }
        config = keepalive.load_config(env, "/api/health")
        self.assertEqual(config["url"], "https://exemple.org/ping")
        self.assertEqual((config["days"], config["start_hour"], config["end_hour"], config["interval"]),
                         (set(range(1, 8)), 0, 24, 5))


class _Handler(http.server.BaseHTTPRequestHandler):
    hits = 0

    def do_GET(self):
        type(self).hits += 1
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"ok")

    def log_message(self, *args):
        pass


class ThreadTests(unittest.TestCase):

    def setUp(self):
        _Handler.hits = 0
        self.server = http.server.HTTPServer(("127.0.0.1", 0), _Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.env = {
            "KEEPALIVE_URL": "http://127.0.0.1:%s/" % self.server.server_port,
            "KEEPALIVE_INTERVAL_SECONDS": "1",
        }
        os.environ.setdefault("NO_PROXY", "127.0.0.1")

    def tearDown(self):
        keepalive.stop()
        self.server.shutdown()
        self.server.server_close()

    def test_pings_inside_window(self):
        thread = keepalive.start(environ=self.env, clock=lambda: utc(2026, 10, 21, 10))
        self.assertIsNotNone(thread)
        time.sleep(2.5)
        self.assertGreaterEqual(_Handler.hits, 1)
        # Deuxième appel dans le même processus : pas de second thread.
        self.assertIsNone(keepalive.start(environ=self.env, clock=lambda: utc(2026, 10, 21, 10)))

    def test_silent_outside_window(self):
        self.assertIsNotNone(keepalive.start(environ=self.env, clock=lambda: utc(2026, 10, 24, 10)))
        time.sleep(2.5)
        self.assertEqual(_Handler.hits, 0)

    def test_lock_held_by_another_worker(self):
        url = self.env["KEEPALIVE_URL"]
        name = "keepalive-%s.lock" % hashlib.sha1(url.encode()).hexdigest()[:12]
        with open(os.path.join(tempfile.gettempdir(), name), "w") as other_worker:
            fcntl.flock(other_worker, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertIsNone(keepalive.start(environ=self.env))

    def test_ping_never_raises(self):
        self.assertFalse(keepalive.ping("http://127.0.0.1:1/"))


class HealthRouteTests(SimpleTestCase):
    # Route visée par le keep-alive. SimpleTestCase interdit les requêtes en
    # base : la route doit s'en passer. secure=True : redirection HTTPS en prod.

    def test_api_health(self):
        response = self.client.get("/api/health", secure=True)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
