let async = require('async');
let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
let lastHash;
let latestBlockHeight = 0;
let logSystem = 'daemon';

require('./exceptionWriter.js')(logSystem);

function runInterval() {
    async.waterfall([
        function (callback) {
            // Get the latest block header
            apiInterfaces.rpcDaemon('getlastblockheader', [], function (err, result) {
                if (err) {
                    log('error', logSystem, 'Error from daemon: %j', [err]);
                    setTimeout(runInterval, 3000);
                    return;
                }
                if (result && result.block_header) {
                    let hash = result.block_header.hash;
                    let height = result.block_header.height;
                    if (!lastHash || lastHash !== hash) {
                        lastHash = hash;
                        latestBlockHeight = height;
                        log('info', logSystem, 'New block found: %d (%s)', [height, hash.substring(0, 16)]);
                        callback(null, true);
                        return;
                    }
                    callback(true);
                    return;
                } else {
                    log('error', logSystem, 'Bad response from daemon');
                    setTimeout(runInterval, 3000);
                    return;
                }
            });
        },
        function (getNew, callback) {
            // Fetch new work template
            apiInterfaces.rpcDaemon('getblocktemplate', [], function (err, result) {
                if (err) {
                    log('error', logSystem, 'Error polling getblocktemplate: %j', [err]);
                    callback(null);
                    return;
                }
                if (result && result.blocktemplate_blob) {
                    process.send({
                        type: 'BlockTemplate',
                        block: result
                    });
                    log('info', logSystem, 'New work template at height %d, difficulty %s', [result.height, result.difficulty]);
                } else {
                    log('error', logSystem, 'Invalid blocktemplate response');
                }
                callback(null);
            });
        }
    ], function (error) {
        setTimeout(runInterval, config.poolServer.blockRefreshInterval || 1000);
    });
}

// Start the daemon
runInterval();
