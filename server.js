const express = require('express');
const path = require('path');

const bcrypt = require('bcrypt');
const flash = require("express-flash");
const session = require('express-session');

// env
require('dotenv').config();

const app = express();
app.use(flash());
app.use(express.urlencoded({ extended: false }));
app.use(session({ secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));

const PORT = process.env.PORT || 3001;
// ejs
app.set('view engine', 'ejs');

app.get('/', async (req, res) => {
    try {
        const success = req.flash('success');
        const error = req.flash('error');
        res.render('index.ejs', { success, error });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    }
});

const notifierAPI = require("./routes/notifier/api");
notifierAPI(app);
const notifier = require("./routes/notifier/endpoint");
notifier(app);

const webappAPI = require("./routes/webapp/api");
webappAPI(app);

app.get('/login', async (req, res) => {
    try {
        res.render('login.ejs', { logged: req.session.isAuthenticated });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/db/get/status', async (req, res) => {
    const allowedOrigin = ['https://fn.lkev.in', 'https://ferminotify.lkev.in', 'https://ferminotify.sirico.dev'];
    const origin = req.get('origin');
    if (allowedOrigin.includes(origin)) res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    try {
        const result = await pool.query('SELECT NOW()');
        res.json({ status: 'ok', time: result.rows[0].now });
    } catch (error) {
        console.error('[ERR] Database query failed:', error.message);
        res.json({ status: 'error' });
    }
});

app.post('/login', (req, res) => {
    const psw = req.body.password;
    console.log("Sent: " + psw);
    // admin psw from env
    const adminpsw = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
    bcrypt.compare(psw, adminpsw, (err, isMatch) => {
        if (err){
            console.log(err);
            return res.sendStatus(500);
        }
        if (isMatch) {
            console.log('Logged in');
            req.session.isAuthenticated = true; // Set the session variable
            req.flash('success', 'Loggato 😎');
            return res.redirect('/'); // Redirect to the home page
        } else {
            req.flash('error', 'Password errata');
            return res.redirect('/');
        }
    });
});

app.post('/logout', (req, res) => {
    req.session.isAuthenticated = false;
    res.redirect('/');
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
	console.log(`Server running on port ${PORT}`);
});

