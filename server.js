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

const PORT = process.env.PORT || 3000;
// ejs
app.set('view engine', 'ejs');
// connect to database
const { pool } = require("./db");

// dash
app.get('/', async (req, res) => {
    try {
        const success = req.flash('success');
        const error = req.flash('error');
        res.render('index.ejs', { logged: req.session.isAuthenticated, success, error });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/backup', async (req, res) => {
    try {
        const success = req.flash('success');
        const error = req.flash('error');
        res.render('backup.ejs', { logged: req.session.isAuthenticated, success, error });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/notifier/get/status', async (req, res) => {
    // get params backup = true
    const backup = req.query.backup || false;
    const json = await getNotifierStatus(backup);
    if(!req.session.isAuthenticated) {
        json.forEach(row => {
            if (row.type == "info" || row.type == "error") row.message = '*** log in to see event ***';
        });
    }
    res.json(json);
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

// Function to get the notifier status
async function getNotifierStatus(backup = false) {
    const query = backup ? 'SELECT * FROM logs_backup_notifier ORDER BY timestamp DESC' : 'SELECT * FROM logs_notifier ORDER BY timestamp DESC';
    try {
        const result = await pool.query(query);
        //console.log(result.rows);
        return result.rows;
    } catch (error) {
        console.log('[ERR] Database query failed:', error.message);
        return [{
            timestamp: (() => {
                const options = {
                    timeZone: 'Europe/Rome',
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    fractionalSecondDigits: 3,
                };
                const parts = new Intl.DateTimeFormat('it-IT', options).formatToParts(new Date());
                return `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value} ${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}.${String(Date.now() % 1000).padStart(3, '0')}`;
            })(),
            type: 'error',
            message: '[STATUS] Database query failed. Check database connection.'
        }];
    }
}