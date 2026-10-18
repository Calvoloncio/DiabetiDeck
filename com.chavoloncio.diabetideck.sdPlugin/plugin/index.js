

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


function actualizarImagen(context, valor, tendencia, estado = "") {
    if (ws.readyState !== WebSocket.OPEN) {
        return;
    }

    let colorGlucosa = "#FFFFFF";

    if (estado === "") {
        if (valor < 70) {
            colorGlucosa = "#FF3030";       // Rojo
        } else if (valor < 180) {
            colorGlucosa = "#39E079";       // Verde
        } else if (valor < 250) {
            colorGlucosa = "#FFE44D";       // Amarillo
        } else if (valor < 380) {
            colorGlucosa = "#FFAD42";       // Amarillo anaranjado
        } else {
            colorGlucosa = "#FF493D";       // Naranja rojizo
        }
    }



    const contenido = estado === "SIN CONEXIÓN"
        ? `
            <g fill="none" stroke="#FFD447" stroke-width="5"
            stroke-linecap="round">
                <path d="M35 48 Q72 13 109 48"/>
                <path d="M47 61 Q72 38 97 61"/>
                <path d="M59 74 Q72 62 85 74"/>
            </g>
            <circle cx="72" cy="88" r="4" fill="#FFD447"/>
            <text x="72" y="119" text-anchor="middle"
                font-size="14" font-weight="bold"
                fill="#FFD447">SIN CONEXIÓN</text>
        `
        : estado
            ? `<text x="72" y="68" text-anchor="middle"
                font-size="15" font-weight="bold"
                fill="#FFFFFF">${estado}</text>`
            : `
                <text x="72" y="66" text-anchor="middle"
                    font-size="39" font-weight="bold"
                    fill="${colorGlucosa}">${valor}</text>
                <text x="72" y="91" text-anchor="middle"
                    font-size="17" fill="#B7C5CE">mg/dL</text>
                <text x="72" y="119" text-anchor="middle"
                    font-size="30" font-weight="bold"
                    fill="#43D9A3">${tendencia}</text>
            `;


    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg"
             width="144" height="144" viewBox="0 0 144 144">
            <rect width="144" height="144" rx="14" fill="#101820"/>
            ${contenido}
        </svg>
    `;

    const imagen = "data:image/svg+xml;charset=utf8,"
        + encodeURIComponent(svg);

    ws.send(JSON.stringify({
        event: "setImage",
        context: context,
        payload: {
            image: imagen,
            target: 0
        }
    }));

    // Evita que el título anterior siga apareciendo debajo.
    ws.send(JSON.stringify({
        event: "setTitle",
        context: context,
        payload: {
            title: "",
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

                for (const context of teclasVisibles) {
                    if (lectura.ok && Number.isFinite(lectura.value)) {
                        actualizarImagen(
                            context,
                            Math.round(lectura.value),
                            lectura.trend || ""
                        );
                    } else if (
                        lectura.value !== null &&
                        lectura.value !== undefined
                    ) {
                        actualizarImagen(context, "", "", "DATOS ANTIGUOS");
                    } else {
                        actualizarImagen(context, "", "", "SIN DATOS");
                    }
                }
            } catch (error) {
                console.error("Error leyendo los datos:", error.message);

                for (const context of teclasVisibles) {
                    actualizarImagen(context, "", "", "ERROR DE DATOS");
                }
            }
        });
    }).on("error", (error) => {
        console.error("No se puede conectar con el servicio:", error.message);

        for (const context of teclasVisibles) {
            actualizarImagen(context, "", "", "SIN CONEXIÓN");
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
