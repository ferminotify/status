module.exports = function(app) {
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
};