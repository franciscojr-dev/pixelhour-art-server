const { MongoClient } = require('mongodb');
const WebSocket = require('ws');
const server = new WebSocket.Server({
    port: process.env.PORT || 8080
});
const balanceDefault = process.env.BALANCE_DEFAULT || 100;
let sockets = [];
let pixelStorage = [];
let totalOn = 0;

console.log(`Started :${server.options.port}`);

const uri = "mongodb+srv://msg:deyrRcGrYEtNSh5V@cluster0.qmolew0.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);
let connectedDb = false;
let collect = null;
let collectPixel = null;

async function run() {
    const database = client.db("boa_sprint");
    collect = database.collection("users");
    collectPixel = database.collection("pixels");

    connectedDb = true;
}
run().catch((err) => {
    connectedDb = false;
    console.log(err);
});

async function saveDb(doc) {
    if (!connectedDb) {
        await run();
    }

    if (connectedDb && collect) {
        try {
            const query = {
                user_id: doc.user_id
            };
            const options = {
                projection: { _id: 1, user_id: 1},
            };
            const result = await collect.findOne(query, options);
            
            if (null === result) {
                const resultInsert = await collect.insertOne(doc);
                //console.log(`New user _id: ${resultInsert.insertedId}`);
            } else {
                await collect.updateOne(query, {"$set": {balance: doc.balance}});
                //console.log(`Update user _id: ${doc.user_id}`);
            }
        } catch (e) {
            console.log(e);

            connectedDb = false;
            saveDb(doc);
        }
    }
}

async function savePixelDb(doc) {
    if (!connectedDb) {
        await run();
    }

    if (connectedDb && collectPixel) {
        try {
            const resultInsert = await collectPixel.insertOne(doc);
            //console.log(`New pixel _id: ${resultInsert.insertedId}`);
        } catch (e) {
            console.log(e);

            connectedDb = false;
            savePixelDb(doc);
        }
    }
}

async function getDb(id) {
    if (!connectedDb) {
        await run();
    }

    if (connectedDb && collect) {
        try {
            const query = {
                user_id: id
            };
            const options = {
                projection: { _id: 1, user_id: 1, balance: 1},
            };
            const result = await collect.findOne(query, options);
            
            if (null !== result) {
                return result.balance;
            }
        } catch (e) {
            console.log(e);

            connectedDb = false;
            return getDb(id);
        }

        return null;
    }
}

async function getPixelsDb() {
    if (!connectedDb) {
        await run();
    }

    if (connectedDb && collectPixel) {
        try {
            const result = await collectPixel.find({}).toArray();
            
            if (null !== result) {
                return result;
            }
        } catch (e) {
            console.log(e);

            connectedDb = false;
            return getPixelsDb();
        }
    }
}

async function loadPixel() {
    pixelStorage = await getPixelsDb();
}
loadPixel();

server.on('connection', async (socket) => {
    sockets.push({
        socket,
        balance: 0
    });
    totalOn += 1;
    
    updateOn();
    
    socket.on('message', async (data) => {
        try {
            let content = JSON.parse(data);

            if (content.type === 'getBalance') {
                let resultUser = await getDb(content.data.id);
                let balance = balanceDefault;

                if (resultUser !== null) {
                    balance = resultUser;
                } else {
                    await saveDb({
                        user_id: content.data.id,
                        balance: balance
                    });
                }

                sockets.forEach(
                    (s) => {
                        if (s.socket === socket) {
                            s.balance = balance;
                        }
                    }
                );

                sendData(
                    socket,
                    {
                        type: "load",
                        balance: balance,
                        total_active: totalOn,
                        data: pixelStorage
                    }
                );
            }

            if (content.type !== 'register') {
                return;
            }

            pixelStorage.push(content.data);
    
            sockets.forEach(
                async (s) => {
                    if (s.socket === socket) {
                        s.balance -= s.balance > 0 ? 1 : 0;
                    }

                    sendData(
                        s.socket,
                        {
                            ...content,
                            balance: s.balance,
                            total_active: totalOn
                        }
                    );

                    await saveDb({
                        user_id: content.data.id,
                        balance: s.balance
                    });

                    await savePixelDb({
                        user_id: content.data.id,
                        x: content.data.x,
                        y: content.data.y,
                        color: content.data.color
                    });
                }
            );
        } catch (e) {
            console.log('Not allowed message format!');
        }
    });
    
    socket.on('close', () => {
        sockets = sockets.filter(s => s.socket !== socket);
        totalOn -= totalOn ? 1 : 0;

        updateOn();
    });
});

function updateOn() {
    sockets.forEach(
        s => {
            sendData(
                s.socket,
                {
                    type: "update",
                    balance: s.balance,
                    total_active: totalOn
                }
            );
        }
    );
}

function sendData(socket, content) {
    socket.send(
        JSON.stringify(content)
    );
}