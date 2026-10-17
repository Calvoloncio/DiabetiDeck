import json
import threading
import time
from datetime import datetime, timezone
from getpass import getpass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

from pydexcom import Dexcom

HOST = "127.0.0.1"
PORT = 8765
INTERVALO = 60

print("=== DiabetiDeck: conexión con Dexcom ===")
usuario = input("Correo de Dexcom: ").strip()
contrasena = getpass("Contraseña de Dexcom: ")

estado = {
    "ok": False,
    "value": None,
    "trend": "",
    "timestamp": None,
    "error": "Esperando la primera lectura"
}
bloqueo = threading.Lock()


def consultar_dexcom():
    try:
        dexcom = Dexcom(
            username=usuario,
            password=contrasena,
            region="ous"
        )

        while True:
            try:
                lectura = dexcom.get_current_glucose_reading()

                if lectura is None:
                    lectura = dexcom.get_latest_glucose_reading()

                if lectura is None:
                    raise RuntimeError("No hay lecturas disponibles")

                fecha = lectura.datetime
                if fecha.tzinfo is None:
                    fecha = fecha.replace(tzinfo=timezone.utc)

                fecha_utc = fecha.astimezone(timezone.utc)
                edad = (datetime.now(timezone.utc) - fecha_utc).total_seconds()

                nuevo_estado = {
                    "ok": edad <= 420,
                    "value": lectura.value,
                    "trend": str(lectura.trend_arrow),
                    "timestamp": fecha.isoformat(),
                    "age_seconds": max(0, int(edad)),
                    "error": None if edad <= 420 else "Lectura antigua"
                }

                with bloqueo:
                    estado.update(nuevo_estado)

                print(
                    "Lectura recibida. Antigüedad:",
                    max(0, int(edad)),
                    "segundos"
                )

            except Exception as error:
                with bloqueo:
                    estado["ok"] = False
                    estado["error"] = type(error).__name__
                print("Error consultando Dexcom:", type(error).__name__)

            time.sleep(INTERVALO)

    except Exception as error:
        with bloqueo:
            estado["ok"] = False
            estado["error"] = type(error).__name__
        print("No se pudo iniciar la conexión:", type(error).__name__)


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/glucose":
            self.send_error(404)
            return

        with bloqueo:
            respuesta = dict(estado)

        contenido = json.dumps(respuesta).encode("utf-8")

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(contenido)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(contenido)

    def log_message(self, format, *args):
        pass


threading.Thread(target=consultar_dexcom, daemon=True).start()

servidor = ThreadingHTTPServer((HOST, PORT), Handler)
print(f"Servicio local activo en http://{HOST}:{PORT}/glucose")
print("Deja esta ventana abierta mientras uses DiabetiDeck.")
servidor.serve_forever()
