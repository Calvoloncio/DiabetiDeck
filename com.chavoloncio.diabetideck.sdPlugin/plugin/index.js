const WebSocket = require("ws");

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

console.log("Iniciando DiabetiDeck...");
console.log("Puerto:", port);
console.log("UUID:", pluginUUID);

const ws = new WebSocket(`ws://127.0.0.1:${port}`);

ws.on("open", () => {
    console.log("WebSocket conectado.");

    ws.send(JSON.stringify({
        event: registerEvent,
        uuid: pluginUUID
    }));

    console.log("Registro enviado a StreamDock.");
});

ws.on("message", (data) => {
    try {
        const message = JSON.parse(data.toString());

        console.log("Evento recibido:", message.event);

        if (message.event === "passHello") {
            console.log("StreamDock ha respondido al registro.");
        }

        if (message.event === "willAppear") {
            ws.send(JSON.stringify({
                event: "setTitle",
                context: message.context,
                payload: {
                    title: "125 mg/dL",
                    target: 0
                }
            }));

            console.log("Título de prueba enviado.");
        }
    } catch (error) {
        console.error("Error procesando el mensaje:", error.message);
    }
});

ws.on("error", (error) => {
    console.error("Error de conexión:", error.message);
});

ws.on("close", () => {
    console.log("Conexión cerrada por StreamDock.");
});
