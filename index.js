const WebSocket = require('ws');
const server = new WebSocket.Server({
    port: process.env.PORT || 8080
});
const balanceDefault = process.env.BALANCE_DEFAULT || 100;
let sockets = [];
let pixelStorage = [];

console.log(`Started :${server.options.port}`);

server.on('connection', (socket) => {
    sockets.push({socket, balance: balanceDefault});

    console.log('New client connected!');

    sendData(
        socket,
        {
            type: "load",
            balance: balanceDefault,
            data: pixelStorage
        }
    );
    
    socket.on('message', (data) => {
        try {
            let content = JSON.parse(data);

            if (content.type !== 'register') {
                return;
            }

            pixelStorage.push(content.data);
    
            sockets.forEach(
                s => {
                    if (s.socket === socket) {
                        s.balance -= s.balance > 0 ? 1 : 0;
                    }

                    sendData(s.socket, {...content, balance: s.balance});
                }
            );
        } catch (e) {
            console.log('Not allowed message format!');
        }
    });
    
    socket.on('close', () => {
        sockets = sockets.filter(s => s.socket !== socket);
    });
});

function sendData(socket, content) {
    socket.send(
        JSON.stringify(content)
    );
}