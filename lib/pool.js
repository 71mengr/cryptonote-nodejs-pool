// Load required modules
let fs = require('fs');
let net = require('net');
let tls = require('tls');
let async = require('async');
let bignum = require('bignum');
let socketMap = new Set()
let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
let notifications = require('./notifications.js');
let utils = require('./utils.js');

// Set nonce pattern - must exactly be 8 hex chars
let noncePattern = new RegExp("^[0-9A-Fa-f]{8}$");

// Set redis database cleanup interval
let cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;

// Initialize log system
let logSystem = 'pool';
require('./exceptionWriter.js')(logSystem);

let threadId = '(Thread ' + process.env.forkId + ') ';
let log = function (severity, system, text, data) {
        global.log(severity, system, threadId + text, data);
};

// Set Ethereum daemon type
config.daemonType = 'ethereum';
let isEthereumDaemon = true;

// Set instance id
let instanceId = utils.instanceId();

// Pool variables
let poolStarted = false;
let connectedMiners = {};
let POOL_NONCE_SIZE = 16 + 1;

// Difficulty buffer
let diff1 = bignum('FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF', 16);

// Block templates
let validBlockTemplates = [];
let currentBlockTemplate = null;

/**
 * Convert buffer to byte array
 **/
Buffer.prototype.toByteArray = function () {
        return Array.prototype.slice.call(this, 0);
};

/**
 * Periodical updaters
 **/

// Variable difficulty retarget
setInterval(function () {
        let now = Date.now() / 1000 | 0;
        for (let minerId in connectedMiners) {
                let miner = connectedMiners[minerId];
                if (!miner.noRetarget) {
                        miner.retarget(now);
                }
        }
}, config.poolServer.varDiff.retargetTime * 1000);

// Every 30 seconds clear out timed-out miners and old bans
setInterval(function () {
        let now = Date.now();
        let timeout = config.poolServer.minerTimeout * 1000;
        for (let minerId in connectedMiners) {
                let miner = connectedMiners[minerId];
                if (now - miner.lastBeat > timeout) {
                        log('warn', logSystem, 'Miner timed out and disconnected %s@%s', [miner.login, miner.ip]);
                        delete connectedMiners[minerId];
                        removeConnectedWorker(miner, 'timeout');
                }
        }
}, 30000);

/**
 * Handle multi-thread messages
 **/
process.on('message', function (message) {
        switch (message.type) {
                case 'banIP':
                        break;
                case 'BlockTemplate':
                        try {
                                if (!currentBlockTemplate || message.block.height > currentBlockTemplate.height) {
                                        log('info', logSystem, 'New block to mine at height %d with difficulty %s', [message.block.height, message.block.difficulty]);
                                        processBlockTemplate(message.block);
                                }
                        } catch (e) {
                                log('error', logSystem, `BlockTemplate error: ${e}`);
                        }
                        break;
        }
});

/**
 * Block Template for Ethereum RandomX
 **/
function BlockTemplate(template) {
        this.difficulty = template.difficulty;
        this.height = template.height;
        this.num_transactions = template.num_transactions || 0;
        this.blocktemplate_blob = template.pow_hash || template.blocktemplate_blob;
        this.powHash = template.pow_hash || this.blocktemplate_blob;
        this.target = template.target;
        this.seed_hash = template.seed_hash;
        this.prev_hash = Buffer.from(this.powHash, 'hex');
}

BlockTemplate.prototype = {
        nextBlob: function () {
                return this.blocktemplate_blob;
        }
};

/**
 * Process block template
 **/
function processBlockTemplate(template) {
        let block_template = new BlockTemplate(template);
        
        if (currentBlockTemplate) {
                validBlockTemplates.push(currentBlockTemplate);
        }
        
        while (validBlockTemplates.length > 3) {
                validBlockTemplates.shift();
        }
        
        currentBlockTemplate = block_template;
        notifyConnectedMiners();
}

function notifyConnectedMiners() {
        let now = Date.now() / 1000 | 0;
        for (let minerId in connectedMiners) {
                let miner = connectedMiners[minerId];
                miner.pushMessage('job', miner.getJob());
        }
}

/**
 * Variable difficulty
 **/
let VarDiff = (function () {
        let variance = config.poolServer.varDiff.variancePercent / 100 * config.poolServer.varDiff.targetTime;
        return {
                variance: variance,
                bufferSize: config.poolServer.varDiff.retargetTime / config.poolServer.varDiff.targetTime * 4,
                tMin: config.poolServer.varDiff.targetTime - variance,
                tMax: config.poolServer.varDiff.targetTime + variance,
                maxJump: config.poolServer.varDiff.maxJump
        };
})();

/**
 * Miner for Ethereum RandomX
 **/
function Miner(rewardType, id, login, pass, ip, port, agent, startingDiff, noRetarget, pushMessage) {
        this.rewardType = rewardType;
        this.id = id;
        this.login = login;
        this.pass = pass;
        this.ip = ip;
        this.port = port;
        this.workerName = pass || 'Undefined';
        this.pushMessage = pushMessage;
        this.heartbeat();
        this.noRetarget = noRetarget;
        this.difficulty = startingDiff;
        this.validJobs = [];
        this.lastBlockHeight = 0;
        this.cachedJob = null;
        
        // Vardiff related variables
        this.shareTimeRing = utils.ringBuffer(16);
        this.lastShareTime = Date.now() / 1000 | 0;
}

Miner.prototype = {
        retarget: function (now) {
                let options = config.poolServer.varDiff;
                let sinceLast = now - this.lastShareTime;
                let decreaser = sinceLast > VarDiff.tMax;
                let avg = this.shareTimeRing.avg(decreaser ? sinceLast : null);
                let newDiff;
                let direction;

                if (avg > VarDiff.tMax && this.difficulty > options.minDiff) {
                        newDiff = options.targetTime / avg * this.difficulty;
                        newDiff = newDiff > options.minDiff ? newDiff : options.minDiff;
                        direction = -1;
                } else if (avg < VarDiff.tMin && this.difficulty < options.maxDiff) {
                        newDiff = options.targetTime / avg * this.difficulty;
                        newDiff = newDiff < options.maxDiff ? newDiff : options.maxDiff;
                        direction = 1;
                } else {
                        return;
                }
                if (Math.abs(newDiff - this.difficulty) / this.difficulty * 100 > options.maxJump) {
                        let change = options.maxJump / 100 * this.difficulty * direction;
                        newDiff = this.difficulty + change;
                }
                this.setNewDiff(newDiff);
                this.shareTimeRing.clear();
                if (decreaser) this.lastShareTime = now;
        },
        setNewDiff: function (newDiff) {
                newDiff = Math.round(newDiff);
                if (this.difficulty === newDiff) {
                        return;
                }
                log('info', logSystem, 'Retargetting difficulty %d to %d for %s', [this.difficulty, newDiff, this.login]);
                this.pendingDifficulty = newDiff;
                this.pushMessage('job', this.getJob());
        },
        heartbeat: function () {
                this.lastBeat = Date.now();
        },
        getTargetHex: function () {
                if (this.pendingDifficulty) {
                        this.lastDifficulty = this.difficulty;
                        this.difficulty = this.pendingDifficulty;
                        this.pendingDifficulty = null;
                }
                let padded = Buffer.alloc(32);
                padded.fill(0);
                let diffBuff = diff1.div(this.difficulty).toBuffer();
                diffBuff.copy(padded, 32 - diffBuff.length);
                let buff = padded.slice(0, 4);
                let buffArray = buff.toByteArray().reverse();
                let buffReversed = Buffer.from(buffArray);
                this.target = buffReversed.readUInt32BE(0);
                let hex = buffReversed.toString('hex');
                return hex;
        },
        getJob: function () {
                if (!currentBlockTemplate) {
                        return null;
                }
                
                let blockTemplate = currentBlockTemplate;
                
                if (this.lastBlockHeight === blockTemplate.height && !this.pendingDifficulty && this.cachedJob !== null && !config.daemon.alwaysPoll) {
                        return this.cachedJob;
                }
                
                this.lastBlockHeight = blockTemplate.height;
                let target = this.getTargetHex();
                
                let newJob = {
                        id: utils.uid(),
                        height: blockTemplate.height,
                        difficulty: this.difficulty,
                        submissions: []
                };
                
                this.validJobs.push(newJob);
                while (this.validJobs.length > 4) {
                        this.validJobs.shift();
                }
                
                this.cachedJob = {
                        job_id: newJob.id,
                        id: this.id,
                        blob: blockTemplate.nextBlob(),
                        target: target,
                        height: blockTemplate.height,
                        seed_hash: blockTemplate.seed_hash
                };
                
                return this.cachedJob;
        }
};

/**
 * Handle miner method
 **/
function handleMinerMethod(method, params, ip, portData, sendReply, pushMessage) {
        let miner = connectedMiners[params.id];
        
        switch (method) {
                case 'login':
                        let login = params.login || config.poolServer.poolAddress;
                        if (!login) {
                                sendReply('Missing login');
                                return;
                        }
                        
                        let address = login;
                        let rewardType = 'prop';
                        
                        let difficulty = portData.difficulty;
                        let noRetarget = false;
                        
                        if (config.poolServer.fixedDiff.enabled) {
                                let fixedDiffCharPos = login.lastIndexOf(config.poolServer.fixedDiff.addressSeparator);
                                if (fixedDiffCharPos !== -1 && (login.length - fixedDiffCharPos < 32)) {
                                        let diffValue = login.substr(fixedDiffCharPos + 1);
                                        difficulty = parseInt(diffValue);
                                        login = login.substr(0, fixedDiffCharPos);
                                        if (difficulty && difficulty == diffValue) {
                                                noRetarget = true;
                                                if (difficulty < config.poolServer.varDiff.minDiff) {
                                                        difficulty = config.poolServer.varDiff.minDiff;
                                                }
                                        }
                                }
                        }
                        
                        let minerId = utils.uid();
                        miner = new Miner(rewardType, minerId, login, params.pass, ip, portData.port, params.agent, difficulty, noRetarget, pushMessage);
                        connectedMiners[minerId] = miner;
                        
                        sendReply(null, {
                                id: minerId,
                                job: miner.getJob(),
                                status: 'OK'
                        });
                        
                        newConnectedWorker(miner);
                        break;
                case 'getjob':
                        if (!miner) {
                                sendReply('Unauthenticated');
                                return;
                        }
                        miner.heartbeat();
                        sendReply(null, miner.getJob());
                        break;
                case 'submit':
                        if (!miner) {
                                sendReply('Unauthenticated');
                                return;
                        }
                        miner.heartbeat();
                        
                        let job = miner.validJobs.filter(function (job) {
                                return job.id === params.job_id;
                        })[0];
                        
                        if (!job) {
                                sendReply('Invalid job id');
                                return;
                        }
                        
                        if (!params.nonce || !params.result) {
                                log('warn', logSystem, 'Malformed miner share from %s@%s', [miner.login, miner.ip]);
                                return;
                        }
                        
                        if (!noncePattern.test(params.nonce)) {
                                log('warn', logSystem, 'Malformed nonce from %s@%s', [miner.login, miner.ip]);
                                sendReply('Invalid nonce');
                                return;
                        }
                        
                        params.nonce = params.nonce.toLowerCase();
                        
                        if (job.submissions.indexOf(params.nonce) !== -1) {
                                log('warn', logSystem, 'Duplicate share from %s@%s', [miner.login, miner.ip]);
                                sendReply('Duplicate share');
                                return;
                        }
                        
                        job.submissions.push(params.nonce);
                        
                        let blockTemplate = currentBlockTemplate;
                        if (!blockTemplate) {
                                sendReply('Block expired');
                                return;
                        }
                        
                        let shareAccepted = processShare(miner, job, blockTemplate, params);
                        
                        if (!shareAccepted) {
                                sendReply('Rejected share: invalid result');
                                return;
                        }
                        
                        let now = Date.now() / 1000 | 0;
                        miner.shareTimeRing.append(now - miner.lastShareTime);
                        miner.lastShareTime = now;
                        
                        sendReply(null, { status: 'OK' });
                        break;
                case 'keepalived':
                        if (!miner) {
                                sendReply('Unauthenticated');
                                return;
                        }
                        miner.heartbeat();
                        sendReply(null, { status: 'KEEPALIVED' });
                        break;
                default:
                        sendReply('Invalid method');
                        break;
        }
}

/**
 * New connected worker
 **/
function newConnectedWorker(miner) {
        log('info', logSystem, 'Miner connected %s@%s on port %d', [miner.login, miner.ip, miner.port]);
        if (miner.workerName !== 'Undefined') {
                log('info', logSystem, 'Worker Name: %s', [miner.workerName]);
        }
        if (miner.difficulty) {
                log('info', logSystem, 'Miner difficulty fixed to %s', [miner.difficulty]);
        }
        
        redisClient.sadd(`${config.coin}:workers_ip:${miner.login}`, miner.ip);
        redisClient.hincrby(`${config.coin}:ports:${miner.port}`, 'users', 1);
        redisClient.hincrby(`${config.coin}:active_connections`, `${miner.login}~${miner.workerName}`, 1);
}

/**
 * Remove connected worker
 **/
function removeConnectedWorker(miner, reason) {
        redisClient.hincrby(`${config.coin}:ports:${miner.port}`, 'users', -1);
        redisClient.hincrby(`${config.coin}:active_connections`, `${miner.login}~${miner.workerName}`, -1);
}

function recordShareData(miner, job, shareDiff, blockCandidate, hashHex, shareType, blockTemplate) {
        let dateNow = Date.now();
        let dateNowSeconds = dateNow / 1000 | 0;
        let login = miner.login;
        let job_height = job.height;
        let workerName = miner.workerName;
        
        let redisCommands = [
                ['hincrbyfloat', `${config.coin}:scores:roundCurrent`, login, job.difficulty],
                ['hincrby', `${config.coin}:shares_actual:roundCurrent`, login, job.difficulty],
                ['zadd', `${config.coin}:hashrate`, dateNowSeconds, [job.difficulty, login, dateNow].join(':')],
                ['hincrby', `${config.coin}:workers:${login}`, 'hashes', job.difficulty],
                ['hset', `${config.coin}:workers:${login}`, 'lastShare', dateNowSeconds],
                ['expire', `${config.coin}:workers:${login}`, (86400 * cleanupInterval)],
                ['expire', `${config.coin}:payments:${login}`, (86400 * cleanupInterval)]
        ];
        
        if (workerName && workerName !== 'Undefined') {
                redisCommands.push(['zadd', `${config.coin}:hashrate`, dateNowSeconds, [job.difficulty, login + '~' + workerName, dateNow].join(':')]);
                redisCommands.push(['hincrby', `${config.coin}:unique_workers:${login}~${workerName}`, 'hashes', job.difficulty]);
                redisCommands.push(['hset', `${config.coin}:unique_workers:${login}~${workerName}`, 'lastShare', dateNowSeconds]);
                redisCommands.push(['expire', `${config.coin}:unique_workers:${login}~${workerName}`, (86400 * cleanupInterval)]);
        }
        
        if (blockCandidate) {
                redisCommands.push(['hset', `${config.coin}:stats`, 'lastBlockFound', Date.now()]);
                redisCommands.push(['rename', `${config.coin}:scores:roundCurrent`, `${config.coin}:scores:round${job_height}`]);
                redisCommands.push(['rename', `${config.coin}:shares_actual:roundCurrent`, `${config.coin}:shares_actual:round${job_height}`]);
        }
        
        redisClient.multi(redisCommands).exec(function (err, replies) {
                if (err) {
                        log('error', logSystem, 'Failed to insert share data into redis: %j', [err]);
                        return;
                }
                
                if (blockCandidate) {
                        redisClient.zadd(`${config.coin}:blocks:candidates`, job_height, [
                                'prop',
                                login,
                                hashHex,
                                Date.now() / 1000 | 0,
                                blockTemplate.difficulty,
                                0,
                                0
                        ].join(':'));
                        
                        notifications.sendToAll('blockFound', {
                                'HEIGHT': job_height,
                                'HASH': hashHex,
                                'DIFFICULTY': blockTemplate.difficulty,
                                'MINER': login.substring(0, 7) + '...' + login.substring(login.length - 7)
                        });
                }
        });
        
        log('info', logSystem, 'Accepted %s share at difficulty %d from %s@%s', [shareType, job.difficulty, login, miner.ip]);
}

/**
 * Process miner share for Ethereum RandomX
 **/
function processShare(miner, job, blockTemplate, params) {
        let nonce = params.nonce;
        let resultHash = params.result;
        
        // Convert hex strings to buffers
        let nonceBuffer = Buffer.from(nonce.padStart(16, '0'), 'hex');
        let hashBuffer = Buffer.from(resultHash.slice(2), 'hex');
        
        // Verify the hash meets the difficulty target
        let hashArray = hashBuffer.toByteArray().reverse();
        let hashNum = bignum.fromBuffer(Buffer.from(hashArray));
        let hashDiff = diff1.div(hashNum);
        
        if (hashDiff.lt(job.difficulty)) {
                log('warn', logSystem, 'Rejected low difficulty share of %s from %s@%s', [hashDiff.toString(), miner.login, miner.ip]);
                return false;
        }
        
        let shareType = 'valid';
        
        // Check if this share meets the network difficulty (block found)
        if (hashDiff.ge(blockTemplate.difficulty)) {
                // Submit block to the network
                apiInterfaces.rpcDaemon('eth_submitWork', [
                        '0x' + nonce,
                        '0x' + blockTemplate.powHash,
                        resultHash
                ], function (error, result) {
                        if (error) {
                                log('error', logSystem, 'Error submitting block at height %d from %s@%s: %j', [job.height, miner.login, miner.ip, error]);
                        } else if (result === true) {
                                log('info', logSystem, 'Block found at height %d by miner %s@%s! Hash: %s', [job.height, miner.login, miner.ip, resultHash]);
                                recordShareData(miner, job, hashDiff.toString(), true, resultHash, shareType, blockTemplate);
                        } else {
                                log('warn', logSystem, 'Block submission rejected at height %d from %s@%s', [job.height, miner.login, miner.ip]);
                                recordShareData(miner, job, hashDiff.toString(), false, null, shareType, null);
                        }
                });
        } else {
                recordShareData(miner, job, hashDiff.toString(), false, null, shareType, null);
        }
        
        return true;
}

/**
 * Start pool server on TCP ports
 **/
function startPoolServerTcp(callback) {
        log('info', logSystem, 'Clearing values for connected workers in redis database.');
        redisClient.del(config.coin + ':active_connections');
        
        async.each(config.poolServer.ports, function (portData, cback) {
                let handleMessage = function (socket, jsonData, pushMessage) {
                        if (!jsonData.id) {
                                return;
                        } else if (!jsonData.method) {
                                return;
                        } else if (!jsonData.params) {
                                return;
                        }
                        
                        let sendReply = function (error, result) {
                                if (!socket.writable) return;
                                let sendData = JSON.stringify({
                                        id: jsonData.id,
                                        jsonrpc: "2.0",
                                        error: error ? { code: -1, message: error } : null,
                                        result: result
                                }) + "\n";
                                socket.write(sendData);
                        };
                        
                        handleMinerMethod(jsonData.method, jsonData.params, socket.remoteAddress, portData, sendReply, pushMessage);
                };
                
                let socketResponder = function (socket) {
                        socket.setKeepAlive(true);
                        socket.setEncoding('utf8');
                        socketMap.add(socket);
                        let dataBuffer = '';
                        
                        let pushMessage = function (method, params) {
                                if (!socket.writable) return;
                                let sendData = JSON.stringify({
                                        jsonrpc: "2.0",
                                        method: method,
                                        params: params
                                }) + "\n";
                                socket.write(sendData);
                        };
                        
                        socket.on('data', function (d) {
                                dataBuffer += d;
                                if (Buffer.byteLength(dataBuffer, 'utf8') > 10240) {
                                        dataBuffer = null;
                                        log('warn', logSystem, 'Socket flooding detected from %s', [socket.remoteAddress]);
                                        socket.destroy();
                                        return;
                                }
                                if (dataBuffer.indexOf('\n') !== -1) {
                                        let messages = dataBuffer.split('\n');
                                        let incomplete = dataBuffer.slice(-1) === '\n' ? '' : messages.pop();
                                        for (let i = 0; i < messages.length; i++) {
                                                let message = messages[i];
                                                if (message.trim() === '') continue;
                                                let jsonData;
                                                try {
                                                        jsonData = JSON.parse(message);
                                                } catch (e) {
                                                        if (message.indexOf('GET /') === 0) {
                                                                if (message.indexOf('HTTP/1.1') !== -1 || message.indexOf('HTTP/1.0') !== -1) {
                                                                        socket.end('HTTP/1.1 200 OK\nContent-Type: text/plain\n\nMining server online');
                                                                        break;
                                                                }
                                                        }
                                                        log('warn', logSystem, 'Malformed message from %s: %s', [socket.remoteAddress, message]);
                                                        socket.destroy();
                                                        break;
                                                }
                                                try {
                                                        handleMessage(socket, jsonData, pushMessage);
                                                } catch (e) {
                                                        log('warn', logSystem, 'Exception handling message from %s: %s', [socket.remoteAddress, e.message]);
                                                }
                                        }
                                        dataBuffer = incomplete;
                                }
                        }).on('error', function (err) {
                                if (err.code !== 'ECONNRESET') {
                                        log('warn', logSystem, 'Socket error from %s: %j', [socket.remoteAddress, err]);
                                }
                                socketMap.delete(socket);
                                socket.destroy();
                        }).on('close', function () {
                                pushMessage = function () {};
                                if (socket.miner_ids) {
                                        socket.miner_ids.forEach(miner_id => {
                                                let miner = connectedMiners[miner_id];
                                                if (miner) {
                                                        log('warn', logSystem, 'Miner timed out and disconnected %s@%s', [miner.login, miner.ip]);
                                                        removeConnectedWorker(miner, 'timeout');
                                                        delete connectedMiners[miner_id];
                                                }
                                        });
                                }
                                socketMap.delete(socket);
                        });
                };
                
                if (portData.ssl) {
                        let options = {
                                key: fs.readFileSync(config.poolServer.sslKey),
                                cert: fs.readFileSync(config.poolServer.sslCert),
                        };
                        if (config.poolServer.sslCA && fs.existsSync(config.poolServer.sslCA)) {
                                options.ca = fs.readFileSync(config.poolServer.sslCA);
                        }
                        tls.createServer(options, socketResponder).listen(portData.port, function (error) {
                                if (error) {
                                        log('error', logSystem, 'Could not start SSL server on port %d: %j', [portData.port, error]);
                                        cback(true);
                                        return;
                                }
                                redisClient.del(config.coin + ':ports:' + portData.port);
                                redisClient.hset(config.coin + ':ports:' + portData.port, 'port', portData.port);
                                log('info', logSystem, 'Started SSL server on port %d', [portData.port]);
                                cback();
                        });
                } else {
                        net.createServer(socketResponder).listen(portData.port, function (error) {
                                if (error) {
                                        log('error', logSystem, 'Could not start server on port %d: %j', [portData.port, error]);
                                        cback(true);
                                        return;
                                }
                                redisClient.del(config.coin + ':ports:' + portData.port);
                                redisClient.hset(config.coin + ':ports:' + portData.port, 'port', portData.port);
                                log('info', logSystem, 'Started server on port %d', [portData.port]);
                                cback();
                        });
                }
        }, function (err) {
                callback(!err);
        });
}

/**
 * Initialize pool server
 **/
(function init(loop) {
        async.waterfall([
                function (callback) {
                        if (!poolStarted) {
                                startPoolServerTcp(function (successful) {
                                        poolStarted = true;
                                });
                                setTimeout(init, 1000, loop);
                                return;
                        }
                        callback(true);
                }
        ], function () {
                if (loop === true) {
                        setTimeout(function () {
                                init(true);
                        }, config.poolServer.blockRefreshInterval);
                }
        });
})();
