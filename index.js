const WebSocket = require('ws');
const server = new WebSocket.Server({
    port: process.env.PORT || 8080
});
let sockets = [];

console.log(`Started :${server.options.port}`);

server.on('connection', (socket) => {
    sockets.push(socket);

    console.log('Connect');
    
    socket.on('message', (msg) => {
        sockets.forEach(s => s.send(msg));
    });
    
    socket.on('close', () => {
        sockets = sockets.filter(s => s !== socket);
    });
});