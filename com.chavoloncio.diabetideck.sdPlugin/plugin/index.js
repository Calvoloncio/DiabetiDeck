

const WebSocket = require("ws");
const http = require("http");

const args = process.argv.slice(2);

function getArg(name) {
    const index = args.indexOf(name);
    return index === -1 ? null : args[index + 1];
}

const port = getArg("-port");
const pluginUUID = getArg("-pluginUUID");
const registerEvent = getArg("-registerEvent") || "registerPlugin";

if (!port || !pluginUUID) {
    console.error("Faltan los argumentos de StreamDock.");
    process.exit(1);
}

const ws = new WebSocket(`ws://127.0.0.1:${port}`);
const teclasVisibles = new Set();

function actualizarTitulo(context, titulo) {
    if (ws.readyState !== WebSocket.OPEN) {
        return;
    }

    ws.send(JSON.stringify({
        event: "setTitle",
        context: context,
        payload: {
            title: titulo,
            target: 0
        }
    }));
}

function consultarGlucosa() {
    http.get("http://127.0.0.1:8765/glucose", (respuesta) => {
        let datos = "";

        respuesta.on("data", (parte) => {
            datos += parte;
        });

        respuesta.on("end", () => {
            try {
                const lectura = JSON.parse(datos);
                let titulo = "Sin datos";

                if (lectura.ok && Number.isFinite(lectura.value)) {
                    const flecha = lectura.trend || "";
                    titulo = `${lectura.value} mg/dL ${flecha}`;
                } else if (lectura.value !== null &&
                           lectura.value !== undefined) {
                    titulo = "Datos antiguos";
                }

                for (const context of teclasVisibles) {
                    actualizarTitulo(context, titulo);
                }

                console.log("Estado de glucosa actualizado:", titulo);
            } catch (error) {
                console.error("Error leyendo los datos:", error.message);

                for (const context of teclasVisibles) {
                    actualizarTitulo(context, "Sin datos");
                }
            }
        });
    }).on("error", (error) => {
        console.error("No se puede conectar con el servicio:", error.message);

        for (const context of teclasVisibles) {
            actualizarTitulo(context, "Sin conexión");
        }
    });
}

ws.on("open", () => {
    console.log("Conectado a StreamDock.");

    ws.send(JSON.stringify({
        event: registerEvent,
        uuid: pluginUUID
    }));

    console.log("Registro enviado a StreamDock.");
});

ws.on("message", (data) => {
    try {
        const mensaje = JSON.parse(data.toString());

        if (mensaje.event === "passHello") {
            console.log("Plugin registrado correctamente.");
        }

        if (mensaje.event === "willAppear") {
            teclasVisibles.add(mensaje.context);
            consultarGlucosa();
        }

        if (mensaje.event === "willDisappear") {
            teclasVisibles.delete(mensaje.context);
        }
    } catch (error) {
        console.error("Error procesando el evento:", error.message);
    }
});

const intervalo = setInterval(() => {
    if (teclasVisibles.size > 0) {
        consultarGlucosa();
    }
}, 30000);

ws.on("error", (error) => {
    console.error("Error de StreamDock:", error.message);
});

ws.on("close", () => {
    clearInterval(intervalo);
    console.log("Conexión cerrada por StreamDock.");
});
