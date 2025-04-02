const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const fileUpload = require('express-fileupload');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Database Setup
const db = new sqlite3.Database('./chat.db');
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, msg TEXT, image TEXT, time TEXT)");
});

// Users
const users = JSON.parse(fs.readFileSync('./users.json', 'utf-8'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(fileUpload());
app.set('view engine', 'ejs');

let onlineUsers = {};
let lastSeen = { suraj: "Offline", jyoti: "Offline" };

// Routes
app.get('/', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (users[username] && users[username] === password) {
        res.redirect('/chat?user=' + username);
    } else {
        res.send('Invalid credentials!');
    }
});

// Chat page with old messages
app.get('/chat', (req, res) => {
    const user = req.query.user;
    if (!users[user]) return res.redirect('/');
    db.all("SELECT * FROM messages", [], (err, rows) => {
        res.render('chat', { user, lastSeen, chats: rows });
    });
});

// Profile Picture Change
app.get('/profile', (req, res) => {
    const user = req.query.user;
    if (!users[user]) return res.redirect('/');
    res.render('profile', { user });
});

app.post('/profile', (req, res) => {
    const user = req.body.user;
    let file = req.files.pic;
    const filename = `${user}.png`;
    file.mv(__dirname + `/public/profiles/${filename}`, () => {
        res.redirect('/chat?user=' + user);
    });
});

// Upload image to chat
app.post('/upload', (req, res) => {
    let sampleFile = req.files.file;
    const filename = Date.now() + '_' + sampleFile.name;
    sampleFile.mv(__dirname + '/public/uploads/' + filename, () => {
        res.send({ status: 'success', filename });
    });
});

// ======= SOCKET.IO ===========
io.on('connection', (socket) => {

    socket.on('join', (data) => {
        onlineUsers[data.user] = socket.id;
        lastSeen[data.user] = new Date();
        io.emit('update-status', { user: data.user, status: 'online', lastSeen: lastSeen[data.user] });
    });

    socket.on('chat', (data) => {
        const time = new Date().toLocaleTimeString();
        db.run("INSERT INTO messages (user, msg, image, time) VALUES (?,?,?,?)", [data.user, data.msg || null, data.image || null, time], function() {
            data.id = this.lastID;
            data.time = time;
            io.emit('chat', data);
        });
    });

    socket.on('edit-message', (data) => {
        db.run("UPDATE messages SET msg = ? WHERE id = ? AND user = ?", [data.newMsg, data.id, data.user], () => {
            io.emit('edit-message', data);
        });
    });

    socket.on('delete-message', (data) => {
        db.run("DELETE FROM messages WHERE id = ? AND user = ?", [data.id, data.user], () => {
            io.emit('delete-message', data);
        });
    });

    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });

    socket.on('stop-typing', (data) => {
        socket.broadcast.emit('stop-typing', data);
    });

    socket.on('disconnect', () => {
        for (let user in onlineUsers) {
            if (onlineUsers[user] === socket.id) {
                lastSeen[user] = new Date();
                io.emit('update-status', { user, status: 'offline', lastSeen: lastSeen[user] });
                delete onlineUsers[user];
            }
        }
    });
});
// Handle Voice Upload
app.post('/upload-voice', (req, res) => {
    if (!req.files || !req.files.voice) return res.send({ status: 'error' });
    const filename = Date.now() + '_voice.webm';
    req.files.voice.mv(__dirname + '/public/uploads/' + filename, () => {
        res.send({ status: 'success', filename });
    });
});


http.listen(3000, () => console.log('Chat running on http://localhost:3000'));
