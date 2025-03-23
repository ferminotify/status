// connect to database
const { pool } = require("../../db");

const PATH = '/webapp'

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

module.exports = function(app) {
	app.get(`${PATH}/get/stats`, async (req, res) => {
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
	
	app.get(`${PATH}/get/logs`, async (req, res) => {
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
	
	app.get(`${PATH}/get/filtrastats`, async (req, res) => {
		try{
			const result = await pool.query('select keyword, count(*) as c from filtra_eventi_kw group by keyword order by c desc;');
			res.json(result.rows);
		} catch (error) {
			console.error('[ERR] Database query failed:', error.message);
			res.json([]);
		}
	});
};