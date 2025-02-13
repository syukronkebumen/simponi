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
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server);

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
        res.render('index', { processList, deployLogs });
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

// Fungsi untuk menjalankan perintah dan menangkap output
function executeCommand(command, cwd) {
    return new Promise((resolve, reject) => {
        exec(command, { cwd }, (error, stdout, stderr) => {
            if (error) {
                reject({ success: false, message: stderr || error.message });
            } else {
                resolve({ success: true, message: stdout });
            }
        });
    });
}

const appConfig = {
    // "simpuskes.com"               : { path: "/home/simpuskes/htdocs/simpuskes.com", branch: "main" },
    // "abab.simpuskes.com"          : { path: "/home/simpuskes-abab/htdocs/abab.simpuskes.com", branch: "simpus-abab" },
    // "airitam.simpuskes.com"       : { path: "/home/simpuskes-airitam/htdocs/airitam.simpuskes.com", branch: "simpus-airitam" },
    // "kartadewa.simpuskes.com"     : { path: "/home/simpuskes-kartadewa/htdocs/kartadewa.simpuskes.com", branch: "simpus-kertadewa" },
    // "simpangbabat.simpuskes.com"  : { path: "/home/simpuskes-simpangbabat/htdocs/simpangbabat.simpuskes.com", branch: "simpus-simpangbabat" },
    // "sungaibaung.simpuskes.com"   : { path: "/home/simpuskes-sungaibaung/htdocs/sungaibaung.simpuskes.com", branch: "simpus-sungaibaung" },
    // "talangubi.simpuskes.com"     : { path: "/home/simpuskes-talangubi/htdocs/talangubi.simpuskes.com", branch: "simpus-talangubi" },
    // "tanahabang.simpuskes.com"    : { path: "/home/simpuskes-tanahabang/htdocs/tanahabang.simpuskes.com", branch: "simpus-tanahabang" },
    // "tanjungbaru.simpuskes.com"   : { path: "/home/simpuskes-tanjungbaru/htdocs/tanjungbaru.simpuskes.com", branch: "simpus-tanjungbaru" },
    // "tempirai.simpuskes.com"      : { path: "/home/simpuskes-tempirai/htdocs/tempirai.simpuskes.com", branch: "simpus-tempirai" },
    "skp.simpuskes.com"           : { path: "/home/simpuskes-skp/htdocs/skp.simpuskes.com", branch: "dev" }
};

app.post('/deploy/:appName', async (req, res) => {
    const appName = req.params.appName;
    const config = appConfig[appName];

    if (!config) {
        deployLogs[appName] = `Deploy Failed: App config not found`;
        // return res.redirect('/');
        return res.render('index', { processList, deployLogs });
    }

    deployLogs[appName] = 'Starting deployment...';

    try {
       // 1. Git Pull
        deployLogs[appName] = 'Pulling latest code...';
        const gitResult = await executeCommand(`git pull origin ${config.branch}`, config.path);
        if (!gitResult.success) throw new Error(`Git Pull Failed: ${gitResult.message}`);
        
        // 2. NPM Install
        deployLogs[appName] = 'Installing dependencies...';
        const npmInstallResult = await executeCommand(`npm install`, config.path);
        if (!npmInstallResult.success) throw new Error(`NPM Install Failed: ${npmInstallResult.message}`);
        
        // 3. NPM Build
        deployLogs[appName] = 'Building application...';
        const npmBuildResult = await executeCommand(`npm run build`, config.path);
        if (!npmBuildResult.success) throw new Error(`Build Failed: ${npmBuildResult.message}`);

        // 4. PM2 Restart
        deployLogs[appName] = 'Restarting application...';
        const pm2RestartResult = await executeCommand(`pm2 restart ${appName}`, config.path);
        if (!pm2RestartResult.success) throw new Error(`PM2 Restart Failed: ${pm2RestartResult.message}`);

        deployLogs[appName] = 'Deploy Success ✅';
        
    } catch (error) {
        deployLogs[appName] = `Deploy Failed ❌: ${error.message}`;
        // res.redirect('/');
    }

    res.render('index', { processList, deployLogs });
});

// Saat client terhubung ke WebSocket
io.on('connection', (socket) => {
    console.log('Client connected');
});

app.post('/deploy-all', async (req, res) => {
    io.emit('deploy-status', { message: "Starting deployment for all applications..." });

    for (const appName in appConfig) {
        try {
            const config = appConfig[appName];
            if (!config) {
                io.emit('deploy-status', { appName, message: "Deploy Failed: App config not found" });
                continue;
            }

            io.emit('deploy-status', { appName, message: "Pulling latest code..." });
            const gitResult = await executeCommand(`git pull origin ${config.branch}`, config.path);
            if (!gitResult.success) throw new Error(`Git Pull Failed: ${gitResult.message}`);

            io.emit('deploy-status', { appName, message: "Installing dependencies..." });
            const npmInstallResult = await executeCommand(`npm install`, config.path);
            if (!npmInstallResult.success) throw new Error(`NPM Install Failed: ${npmInstallResult.message}`);

            io.emit('deploy-status', { appName, message: "Building application..." });
            const npmBuildResult = await executeCommand(`npm run build`, config.path);
            if (!npmBuildResult.success) throw new Error(`Build Failed: ${npmBuildResult.message}`);

            io.emit('deploy-status', { appName, message: "Restarting application..." });
            const pm2RestartResult = await executeCommand(`pm2 restart ${appName}`, config.path);
            if (!pm2RestartResult.success) throw new Error(`PM2 Restart Failed: ${pm2RestartResult.message}`);

            io.emit('deploy-status', { appName, message: "Deploy Success ✅" });

        } catch (error) {
            io.emit('deploy-status', { appName, message: `Deploy Failed ❌: ${error.message}` });
        }
    }

    io.emit('deploy-status', { message: "All applications deployed!" });
    res.json({ message: "Deployment started, check status in UI." });
});

// Start server
app.listen(port, () => {
    console.log(`Dashboard is running at http://localhost:${port}`);
});
