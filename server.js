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
        const json = await getNotifierStatus();
        if(!req.session.isAuthenticated) {
            // for each json row, if status is 2 (found evt) or 3 (telegram) censor evt
            json.forEach(row => {
                if (row.user_id) row.user_id = '***';
                if (row.action === 3 || row.action === 2) row.evt = '*** log in to see event ***';
            });
        }
        res.render('index', { json, logged: req.session.isAuthenticated, success, error });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
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
            req.flash('error', 'Wrong password');
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
async function getNotifierStatus() {
    const query = 'SELECT * FROM logs ORDER BY timestamp DESC';
    try {
        const result = await pool.query(query);
        //console.log(result.rows);
        return result.rows;
    } catch (error) {
        console.log(error);
        throw new Error('Database query failed');
    }
}