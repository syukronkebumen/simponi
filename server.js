const express = require('express');
const { exec } = require('child_process');
const axios = require('axios');

const app = express();
const port = 3023;
const moment = require('moment-timezone');
const processList = require('./dummy_data.json')
// Set view engine
app.set('view engine', 'ejs');

// Serve static files
app.use(express.static('public'));

// Get PM2 process list
app.get('/', async (req, res) => {
    exec('pm2 jlist', (err, stdout, stderr) => {
        if (err || stderr) {
            console.error("Error fetching PM2 list:", err || stderr);
            return res.status(500).send('Error fetching PM2 process list');
        }
        // const processList = JSON.parse(stdout).map(proc => {
        //     const uptime = proc.pm2_env.pm_uptime
        //         ? moment(proc.pm2_env.pm_uptime).tz('Asia/Jakarta').format('YYYY-MM-DD HH:mm:ss')
        //         : 'N/A';
        //     return {
        //         ...proc,
        //         formatted_uptime: uptime
        //     };
        // });
        console.log('sasas', processList)
        // res.render('index', { processList });
        res.render('index', { processList });
        // res.json(dummyData);
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


// Start server
app.listen(port, () => {
    console.log(`Dashboard is running at http://localhost:${port}`);
});
