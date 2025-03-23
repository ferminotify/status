// connect to database
const { pool } = require("../../db");

const PATH = '/notifier';

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

module.exports = function(app) {
	app.get(`${PATH}/get/logs`, async (req, res) => {
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
	
	app.get(`${PATH}/get/status`, async (req, res) => {
		const backup = req.query.backup || false;
		const limit = 1;
		const json = await getNotifierStatus(backup, limit);
		const lastLog = json[0];
		const now = new Date();
		const lastLogDate = new Date(lastLog.timestamp);
		const allowedOrigin = ['https://fn.lkev.in', 'https://ferminotify.lkev.in', 'https://ferminotify.sirico.dev'];
		if (process.env.NODE_ENV === 'development') allowedOrigin.push('http://localhost:3000');
		const origin = req.get('origin');
		if (allowedOrigin.includes(origin)) res.header("Access-Control-Allow-Origin", origin);
		res.header("Access-Control-Allow-Methods", "GET");
		res.header("Access-Control-Allow-Headers", "Content-Type");
		if (now - lastLogDate > 600000) {
			if(backup) return res.json({ status: 'idle' });
			res.json({ status: 'error' });
		} else {
			res.json({ status: lastLog.type });
		}
	});
}