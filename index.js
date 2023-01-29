const WebSocket = require('ws');
const server = new WebSocket.Server({
    port: process.env.PORT || 8080
});
let sockets = [];

console.log(`Started :${server.options.port}`);

server.on('connection', (socket) => {
    sockets.push(socket);

    console.log('New client connected!');
    sendData(socket, {status: "ok"});
    
    socket.on('message', (data) => {
        try {
            let content = JSON.parse(data);

            if (content.type !== 'register') {
                return;
            }
    
            sockets.forEach(s => sendData(s, content));
        } catch (e) {
            console.log('Not allowed message format!');
        }
    });
    
    socket.on('close', () => {
        sockets = sockets.filter(s => s !== socket);
    });
});

function sendData(socket, content) {
    socket.send(
        JSON.stringify(content)
    );
}