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
// connect to database
const { pool } = require("./db");
const { error } = require('console');

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

app.get('/notifier', async (req, res) => {
    try {
        const success = req.flash('success');
        const error = req.flash('error');
        res.render('notifier.ejs', { logged: req.session.isAuthenticated, success, error });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/login', async (req, res) => {
    try {
        res.render('login.ejs', { logged: req.session.isAuthenticated });
    } catch (error) {
        console.log(error);
        res.status(500).send('Internal server error');
    }
});

app.get('/notifier/get/logs', async (req, res) => {
    // get params backup = true
    const backup = req.query.backup || false;
    const limit = req.query.limit || -1;
    // 0 = today, 1 = yesterday, 2 = day before, ..., -1 = all
    const dayBefore = req.query.dayBefore || -1;
    const json = await getNotifierStatus(backup, limit, dayBefore);
    if(!req.session.isAuthenticated) {
        json.forEach(row => {
            if (row.type == "info" || row.type == "error") row.message = '*** log in to see event ***';
        });
    }
    res.json(json);
});

app.get('/notifier/get/status', async (req, res) => {
    const backup = req.query.backup || false;
    const limit = 1;
    const json = await getNotifierStatus(backup, limit);
    const lastLog = json[0];
    const now = new Date();
    const lastLogDate = new Date(lastLog.timestamp);
    // CORS allow from fn.lkev.in and ferminotify.lkev.in and ferminotify.sirico.dev and localhost
    res.header("Access-Control-Allow-Origin", "https://fn.lkev.in");
    res.header("Access-Control-Allow-Origin", "https://ferminotify.lkev.in");
    res.header("Access-Control-Allow-Origin", "https://ferminotify.sirico.dev");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    if (now - lastLogDate > 600000) {
        if(backup) return res.json({ status: 'idle' });
        res.json({ status: 'error' });
    } else {
        res.json({ status: lastLog.type });
    }
});

app.get('/webapp/get/stats', async (req, res) => {
    // return total number of logs for each domain
    const dayBefore = req.query.dayBefore || -1;
    var query = "SELECT COALESCE(domain, 'unknown') AS domain, COUNT(*) AS count FROM webapp_stats";
    if (dayBefore >= 0) {
        const date = new Date();
        date.setDate(date.getDate() - dayBefore);
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
        const parts = new Intl.DateTimeFormat('it-IT', options).formatToParts(date);
        const dateStr = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
        query += ` WHERE timestamp::date = '${dateStr}'`;
    }
    query += ' GROUP BY domain';
    try {
        const result = await pool.query(query);
        const domainCounts = {};
        result.rows.forEach(row => {
          domainCounts[row.domain] = row.count;
        });
        res.json(domainCounts);
    } catch (error) {
        console.log('[ERR] Database query failed:', error.message);
        res.json([]);
    }
});

app.get("/webapp/get/logs", async (req, res) => {
    // get params backup = true
    const limit = req.query.limit || -1;
    // 0 = today, 1 = yesterday, 2 = day before, ..., -1 = all
    const dayBefore = req.query.dayBefore || -1;
    const json = await getWebappLogs(limit, dayBefore);
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

async function getWebappLogs(limit = -1, dayBefore = -1) {
    var query = 'SELECT * FROM logs_webapp';
    if (dayBefore >= 0) {
        const date = new Date();
        date.setDate(date.getDate() - dayBefore);
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
        const parts = new Intl.DateTimeFormat('it-IT', options).formatToParts(date);
        const dateStr = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
        query += ` WHERE timestamp::date = '${dateStr}'`;
    }
    query += ' ORDER BY timestamp DESC';
    if (limit > 0) query += ` LIMIT ${limit}`;
    try {
        const result = await pool.query(query);
        return result.rows;
    } catch (error) {
        console.log('[ERR] Database query failed:', error.message);
        return [{ timestamp: new Date(), type: 'error', message: '[STATUS] Database query failed. Check database connection.' }];
    }
}

// Function to get the notifier status
async function getNotifierStatus(backup = false, limit = -1, dayBefore = -1) {
    var query = backup ? 'SELECT * FROM logs_backup_notifier' : 'SELECT * FROM logs_notifier';
    if (dayBefore >= 0) {
        const date = new Date();
        date.setDate(date.getDate() - dayBefore);
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
        const parts = new Intl.DateTimeFormat('it-IT', options).formatToParts(date);
        const dateStr = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
        query += ` WHERE timestamp::date = '${dateStr}'`;
    }
    query += ' ORDER BY timestamp DESC';
    if (limit > 0) query += ` LIMIT ${limit}`;
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