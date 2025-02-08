const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const port = 3023;
const moment = require('moment-timezone');
const processList = require('./dummy_data.json')
const dataDomain    = require('./dataset/data_domain.json')
const sslChecker = require('ssl-checker');
let deployLogs = {};
// Fungsi untuk memeriksa status SSL domain
async function checkSSL(domain) {
    try {
        const sslInfo = await sslChecker(domain, { method: "GET" });
        return {
            valid: sslInfo.valid,
            validFrom: sslInfo.valid_from,
            validTo: sslInfo.valid_to,
            daysRemaining: sslInfo.days_remaining
        };
    } catch (error) {
        console.error(`Error checking SSL for domain ${domain}:`, error);
        return null;
    }
}
// Set view engine
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public'));

// Middleware untuk parsing request body
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware untuk sesi
app.use(
    session({
        secret: '!qAx-@wsx-#edc-$rfv', // Ubah dengan key rahasia Anda
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false } // Pastikan ini secure: true jika menggunakan HTTPS
    })
);

// User login credentials (hardcoded untuk contoh)
const USERNAME = 'admin';
const PASSWORD = 'password123';

// Middleware untuk mengecek login
function isAuthenticated(req, res, next) {
    if (req.session.loggedIn) {
        return next();
    }
    res.redirect('/login');
}

// Login page
app.get('/login', (req, res) => {
    res.send(`
        <form method="POST" action="/login">
            <h2>Login</h2>
            <label>Username:</label>
            <input type="text" name="username" required><br>
            <label>Password:</label>
            <input type="password" name="password" required><br>
            <button type="submit">Login</button>
        </form>
    `);
});

// Login handler
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === USERNAME && password === PASSWORD) {
        req.session.loggedIn = true;
        res.redirect('/');
    } else {
        res.send('Invalid username or password. <a href="/login">Try again</a>');
    }
});

// Logout handler
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Error logging out.');
        }
        res.redirect('/login');
    });
});

// Tambahkan middleware untuk melindungi dashboard
app.use(isAuthenticated);

// Get PM2 process list
app.get('/', async (req, res) => {
    exec('pm2 jlist', (err, stdout, stderr) => {
        if (err || stderr) {
            console.error("Error fetching PM2 list:", err || stderr);
            return res.status(500).send('Error fetching PM2 process list');
        }
        const processList = JSON.parse(stdout).map(proc => {
            const uptime = proc.pm2_env.pm_uptime
                ? moment(proc.pm2_env.pm_uptime).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
                : 'N/A';
            return {
                ...proc,
                formatted_uptime: uptime
            };
        });
        // res.render('index', { processList });
        res.render('index', { processList });
    });
});

// Restart a specific application
app.post('/restart/:id', (req, res) => {
    const processId = req.params.id;
    exec(`pm2 restart ${processId}`, (err, stdout, stderr) => {
        if (err || stderr) {
            console.error(`Error restarting process ${processId}:`, err || stderr);
            return res.status(500).send(`Error restarting process ${processId}`);
        }
        res.redirect('/');
    });
});

// Stop a specific application
app.post('/stop/:id', (req, res) => {
    const processId = req.params.id;
    exec(`pm2 stop ${processId}`, (err, stdout, stderr) => {
        if (err || stderr) {
            console.error(`Error stopping process ${processId}:`, err || stderr);
            return res.status(500).send(`Error stopping process ${processId}`);
        }
        res.redirect('/');
    });
});

// Route untuk memeriksa status SSL
app.get('/ssl-status', async (req, res) => {
    const domains = dataDomain; // Ganti dengan domain Anda
    const results = [];

    for (const domain of domains.data) {
        const status = await checkSSL(domain);
        if (status) {
            results.push({ domain, ...status });
        } else {
            results.push({ domain, error: 'Unable to check SSL' });
        }
    }
    console.log(results)
    res.render('ssl-status', { results });
});

const appConfig = {
    "simpuskes.com"               : { path: "/home/simpuskes/htdocs/simpuskes.com", branch: "main" },
    "abab.simpuskes.com"          : { path: "/home/simpuskes-abab/htdocs/abab.simpuskes.com", branch: "simpus-abab" },
    "airitam.simpuskes.com"       : { path: "/home/simpuskes-airitam/htdocs/airitam.simpuskes.com", branch: "simpus-airitam" }
};

app.post('/deploy/:appName', async (req, res) => {
    const appName = req.params.appName;
    const config = appConfig[appName];

    if (!config) {
        deployLogs[appName] = `Deploy Failed: App config not found`;
        // return res.redirect('/');
        return res.render('index', { deployLogs });

    }

    deployLogs[appName] = 'Deploying...';

    try {
        exec(`cd ${config.path} && git pull origin ${config.branch} && npm install && npm run build && pm2 restart ${appName}`, 
        (error, stdout, stderr) => {
            if (error || stderr) {
                deployLogs[appName] = `Deploy Failed: ${error || stderr}`;
            } else {
                deployLogs[appName] = `Deploy Success: ${stdout}`;
            }
            // res.redirect('/');
            res.render('index', { deployLogs });

        });
        
    } catch (error) {
        deployLogs[appName] = `Deploy Failed: ${error.message}`;
        // res.redirect('/');
        res.render('index', { deployLogs });

    }
});


// Start server
app.listen(port, () => {
    console.log(`Dashboard is running at http://localhost:${port}`);
});
