const concurrently = require('concurrently');
concurrently([
    'npm:watch-*',
    { command: 'npm run serve', name: 'client'},
    { command: 'npm run server', name: 'server'},
], {
    prefix: 'name',
    killOthers: ['failure', 'success'],
    restartTries: 3,
});