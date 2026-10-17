const WebSocket = require("ws");

const args = process.argv.slice(2);

function getArg(name) {
    const index = args.indexOf(name);
    return index === -1 ? null : args[index + 1];
}

const port = getArg("-port");
const pluginUUID = getArg("-pluginUUID");

if (!port || !pluginUUID) {
    console.error("Faltan los argumentos de StreamDock.");
    process.exit(1);
}

const ws = new WebSocket(`ws://127.0.0.1:${port}`);

ws.on("open", () => {
    console.log("Conectado a StreamDock");

    ws.send(JSON.stringify({
        event: "registerPlugin",
        uuid: pluginUUID
    }));
});

ws.on("message", (data) => {
    try {
        const message = JSON.parse(data.toString());

        console.log("Evento recibido:", message.event);

        if (message.event === "willAppear") {
            ws.send(JSON.stringify({
                event: "setTitle",
                context: message.context,
                payload: {
                    title: "125 mg/dL",
                    target: 0
                }
            }));
        }
    } catch (error) {
        console.error("Error procesando el mensaje:", error.message);
    }
});

ws.on("error", (error) => {
    console.error("Error de conexión:", error.message);
});

ws.on("close", () => {
    console.log("Conexión cerrada.");
});
