var http = require('http');
var https = require('https');
let logSystem = 'apiInterfaces';

function fromRpcQuantity(value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    return parseInt(value, value.indexOf('0x') === 0 ? 16 : 10) || 0;
}

function jsonHttpRequest(host, port, data, callback) {
    var options = {
        hostname: host,
        port: port,
        path: '/',
        method: 'POST',
        headers: {
            'Content-Length': Buffer.byteLength(data),
            'Content-Type': 'application/json'
        }
    };

    var req = (port === 443 ? https : http).request(options, function (res) {
        var replyData = '';
        res.on('data', function (chunk) {
            replyData += chunk;
        });
        res.on('end', function () {
            try {
                var replyJson = JSON.parse(replyData);
                callback(null, replyJson);
            } catch (e) {
                callback(e, null);
            }
        });
    });

    req.on('error', function (e) {
        callback(e, null);
    });

    req.end(data);
}

function rpc(host, port, method, params, callback) {
    var request = {
        id: "1",
        jsonrpc: "2.0",
        method: method,
        params: params || []
    };
    var data = JSON.stringify(request);

    jsonHttpRequest(host, port, data, function (error, replyJson) {
        if (error) {
            callback(error, null);
            return;
        }
        if (replyJson && replyJson.error) {
            callback(replyJson.error, null);
            return;
        }
        callback(null, replyJson ? replyJson.result : null);
    });
}

function poolRpc(host, port, path, callback) {
    var options = {
        hostname: host,
        port: port,
        path: path,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };

    var req = (port === 443 ? https : http).request(options, function (res) {
        var replyData = '';
        res.on('data', function (chunk) {
            replyData += chunk;
        });
        res.on('end', function () {
            try {
                var replyJson = JSON.parse(replyData);
                callback(null, replyJson);
            } catch (e) {
                callback(e, null);
            }
        });
    });

    req.on('error', function (e) {
        callback(e, null);
    });

    req.end();
}

module.exports = function (daemonConfig, walletConfig) {
    // Pool API configuration
    var poolApiHost = "127.0.0.1";
    var poolApiPort = 25000;

    return {
        rpcDaemon: function (method, params, callback) {
            var ethMethod = method;
            var ethParams = params || [];

            switch (method) {
                case 'getlastblockheader':
                    ethMethod = 'eth_getBlockByNumber';
                    ethParams = ['latest', false];
                    break;
                case 'getblocktemplate':
                    ethMethod = 'eth_getWork';
                    ethParams = [];
                    break;
                case 'submitblock':
                    ethMethod = 'eth_submitWork';
                    break;
                default:
                    break;
            }

            rpc(daemonConfig.host, daemonConfig.port, ethMethod, ethParams, function (err, result) {
                if (err) {
                    callback(err, null);
                    return;
                }

                if (method === 'getlastblockheader' && result) {
                    callback(null, {
                        block_header: {
                            hash: result.hash || '',
                            height: result.number ? fromRpcQuantity(result.number) : 0,
                            timestamp: result.timestamp ? fromRpcQuantity(result.timestamp) : 0,
                            difficulty: result.difficulty ? fromRpcQuantity(result.difficulty) : 0
                        },
                        status: 'OK'
                    });
                } else if (method === 'getblocktemplate' && result && result.length >= 3) {
                    callback(null, {
                        blocktemplate_blob: result[0] ? result[0].replace('0x', '') : '',
                        seed_hash: result[1] ? result[1].replace('0x', '') : '',
                        target: result[2] ? result[2].replace('0x', '') : '',
                        difficulty: parseInt(result[2], 16),
                        height: result[3] ? fromRpcQuantity(result[3]) : 0,
                        status: 'OK'
                    });
                } else {
                    callback(null, result);
                }
            });
        },
        rpcWallet: function (method, params, callback) {
            this.rpcDaemon(method, params, callback);
        },
        pool: function (path, callback) {
            poolRpc(poolApiHost, poolApiPort, path, callback);
        },
        jsonHttpRequest: jsonHttpRequest
    };
};
