// Load required modules
var http = require('http');
var https = require('https');
let logSystem = 'apiInterfacesc';

function normalizeHex (value) {
    if (typeof value !== 'string') return value;
    return value.indexOf('0x') === 0 ? value.substring(2) : value;
}

function toRpcQuantity (value) {
    if (typeof value === 'string' && value.indexOf('0x') === 0) return value;
    return '0x' + Number(value || 0).toString(16);
}

function fromRpcQuantity (value) {
    if (typeof value === 'number') return value;
    if (typeof value !== 'string') return 0;
    return parseInt(value, value.indexOf('0x') === 0 ? 16 : 10) || 0;
}

function ethereumBlockHeader (block) {
    block = block || {};
    return {
        block_size: fromRpcQuantity(block.size),
        depth: 0,
        difficulty: fromRpcQuantity(block.difficulty),
        hash: normalizeHex(block.hash || ''),
        height: fromRpcQuantity(block.number),
        major_version: 0,
        minor_version: 0,
        nonce: fromRpcQuantity(block.nonce),
        num_txes: Array.isArray(block.transactions) ? block.transactions.length : 0,
        orphan_status: false,
        prev_hash: normalizeHex(block.parentHash || ''),
        reward: 0,
        timestamp: fromRpcQuantity(block.timestamp)
    };
}

function normalizeEthereumResult (method, result) {
    switch (method) {
        case 'randomx_getSeedHash':
            return normalizeHex(result || '');
        case 'randomx_hash':
            return normalizeHex(result || '');
        case 'randomx_getCurrentEpoch':
            return fromRpcQuantity(result);
        case 'randomx_getCacheInfo':
        case 'randomx_getDatasetInfo':
            return result;
        case 'eth_blockNumber':
            return {
                count: fromRpcQuantity(result),
                difficulty: 0,
                height: fromRpcQuantity(result),
                status: 'OK'
            };
        case 'eth_getBlockByNumber':
        case 'eth_getBlockByHash':
            let blockHeader = ethereumBlockHeader(result);
            return {
                block_header: blockHeader,
                block: {
                    alreadyGeneratedCoins: '',
                    alreadyGeneratedTransactions: blockHeader.num_txes,
                    baseReward: 0,
                    blockSize: blockHeader.block_size,
                    depth: blockHeader.depth,
                    difficulty: blockHeader.difficulty,
                    effectiveSizeMedian: 0,
                    hash: blockHeader.hash,
                    height: blockHeader.height,
                    major_version: blockHeader.major_version,
                    minor_version: blockHeader.minor_version,
                    nonce: blockHeader.nonce,
                    orphan_status: blockHeader.orphan_status,
                    penalty: 0,
                    prev_hash: blockHeader.prev_hash,
                    reward: blockHeader.reward,
                    sizeMedian: 0,
                    timestamp: blockHeader.timestamp,
                    totalFeeAmount: 0,
                    transactions: result && result.transactions ? result.transactions : [],
                    transactionsCumulativeSize: 0
                },
                json: JSON.stringify({ miner_tx: { vout: [{ amount: 0 }] } }),
                status: 'OK'
            };
        case 'eth_getWork':
            let work = Array.isArray(result) ? result : [];
            return {
                blocktemplate_blob: normalizeHex(work[0] || ''),
                difficulty: work[2] ? fromRpcQuantity(work[2]) : 0,
                height: 0,
                num_transactions: 0,
                pow_hash: normalizeHex(work[0] || ''),
                reserved_offset: 0,
                seed_hash: normalizeHex(work[1] || ''),
                status: 'OK',
                target: normalizeHex(work[2] || '')
            };
        case 'eth_submitWork':
            return { status: result === true ? 'OK' : 'ERROR' };
        default:
            return result;
    }
}

function ethereumRpcPayload (method, params) {
    switch (method) {
        case 'getblockcount':
        case 'get_info':
            return { method: 'eth_blockNumber', params: [] };
        case 'getlastblockheader':
            return { method: 'eth_getBlockByNumber', params: ['latest', false] };
        case 'getblockheaderbyheight':
            return { method: 'eth_getBlockByNumber', params: [toRpcQuantity(params && params.height), false] };
        case 'getblock':
            if (params && params.hash) return { method: 'eth_getBlockByHash', params: [params.hash.indexOf('0x') === 0 ? params.hash : '0x' + params.hash, true] };
            return { method: 'eth_getBlockByNumber', params: [toRpcQuantity(params && params.height), true] };
        case 'getblocktemplate':
            return { method: 'eth_getWork', params: [] };
        case 'submitblock':
            return { method: 'eth_submitWork', params: params };
        case 'eth_getBlockByNumber':
            if (Array.isArray(params) && typeof params[0] === 'number') params[0] = toRpcQuantity(params[0]);
            return { method: method, params: params };
        default:
            return { method: method, params: params };
    }
}


function jsonHttpRequest(host, port, data, callback, path) {
    config.restfulApiDaemonAndWallet = config.restfulApiDaemonAndWallet || false
    config.restfulApiWallet = config.restfulApiWallet	|| false
    if (
        (config.restfulApiDaemonAndWallet == true || (config.restfulApiWallet == true && port == config.wallet.port))
        && (host == config.daemon.host || host == config.wallet.host)
        && (port == config.daemon.port || port == config.wallet.port)
    ) {
        let address = '';
        let jsonData = JSON.parse(data);
        let methodSend = 'GET';
        let resultFormat = '';
        switch (jsonData.method) {
            case 'getblockcount':
                address += '/block/count';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        jsonrpc: '2.0',
                        result: {
                            count: 0,
                            status: 'OK'
                        }
                    }
                ));
                break;
            case 'getBalance':
                address += '/balance';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        id: 1,
                        jsonrpc: '2.0',
                        result: {
                            availableBalance: 0,
                            lockedAmount: 0
                        }
                    }
                ));
                break;
            case 'getblock':
                address += '/block/' + jsonData.params.hash;
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        jsonrpc: '2.0',
                        result: {
                            block: {
                                alreadyGeneratedCoins: '',
                                alreadyGeneratedTransactions: 0,
                                baseReward: 0,
                                blockSize: 0,
                                depth: 0,
                                difficulty: 0,
                                effectiveSizeMedian: 0,
                                hash: '',
                                height: 0,
                                major_version: 0,
                                minor_version: 0,
                                nonce: 0,
                                orphan_status: false,
                                penalty: 0.0,
                                prev_hash: '',
                                reward: 0,
                                sizeMedian: 0,
                                timestamp: 0,
                                totalFeeAmount: 0,
                                transactions: [
                                    {
                                        amount_out: 0,
                                        fee: 0,
                                        hash: '',
                                        size: 0
                                    }
                                ],
                                transactionsCumulativeSize: 0
                            },
                            status: 'OK'
                        }
                    }
                ));
                break;
            case 'getlastblockheader':
                address += '/block/last';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        jsonrpc: '2.0',
                        result: {
                            block_header: {
                                block_size: 0,
                                depth: 0,
                                difficulty: 0,
                                hash: '',
                                height: 0,
                                major_version: 0,
                                minor_version: 0,
                                nonce: 0,
                                num_txes: 0,
                                orphan_status: false,
                                prev_hash: '',
                                reward: 0,
                                timestamp: 0
                            },
                            status: 'OK'
                        }
                    }
                ));
                break;

            case 'getblockheaderbyheight':
                address += '/block/' + jsonData.params.height;
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        jsonrpc: '2.0',
                        result: {
                            block_header: {
                                block_size: 0,
                                depth: 0,
                                difficulty: 0,
                                hash: '',
                                height: 0,
                                major_version: 0,
                                minor_version: 0,
                                nonce: 0,
                                num_txes: 0,
                                orphan_status: false,
                                prev_hash: '',
                                reward: 0,
                                timestamp: 0
                            },
                            status: 'OK'
                        }
                    }
                ));
                break;

            case 'get_info':
                address += '/info';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        alt_blocks_count: 0,
                        difficulty: 0,
                        grey_peerlist_size: 0,
                        hashrate: 0,
                        height: 0,
                        incoming_connections_count: 0,
                        last_known_block_index: 0,
                        major_version: 0,
                        minor_version: 0,
                        network_height: 0,
                        outgoing_connections_count: 0,
                        start_time: 0,
                        status: 'OK',
                        supported_height: 0,
                        synced: true,
                        testnet: false,
                        tx_count: 0,
                        tx_pool_size: 0,
                        upgrade_heights: [],
                        version: '0',
                        white_peerlist_size: 0
                    }
                ));
                break;
            case 'getblocktemplate':
                address += '/block/template';
                methodSend = 'POST';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        jsonrpc: '2.0',
                        result: {
                            blocktemplate_blob: '',
                            difficulty: 0,
                            height: 0,
                            reserved_offset: 0,
                            status: 'OK'
                        }
                    }
                ));
                break;
            case 'sendTransaction':
                address += '/transactions/send/advanced';
                methodSend = 'POST';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        id: 1,
                        jsonrpc: '2.0',
                        result: {
                            transactionHash: '',
                            fee: 0
                        }
                    }
                ));
                break;
            case 'submitblock':
                address += '/block';
                methodSend = 'POST';
                resultFormat = JSON.parse(JSON.stringify(
                    {
                        jsonrpc: '2.0',
                        result: {
                            status: 'OK'
                        }
                    }
                ));
                break;
            default:
                log('error', logSystem, 'host: %j, port: %j, method: %j, params: %j, callback: %s', [host, port, jsonDataLog.method, jsonDataLog.params, callback]);
                break;
        }
        if (methodSend == 'POST') {
            switch (jsonData.method) {
                case "getblocktemplate":
                    data = JSON.stringify({
                        address: jsonData.params.wallet_address,
                        reserveSize: jsonData.params.reserve_size
                    });
                    break;
                case "sendTransaction":
                    var arrayObj = [];
                    for (let i = 0; i < jsonData.params.transfers.length; i++) {
                        var objPay = { address: '', amount: 0 };
                        objPay.address = jsonData.params.transfers[i].address;
                        objPay.amount = jsonData.params.transfers[i].amount;
                        arrayObj.push(objPay);
                    }
                    let dataTemp = {
                        mixin: jsonData.params.anonymity,
                        unlockTime: jsonData.params.unlockTime,
                        destinations: arrayObj
                    };
                    if (jsonData.params.changeAddress) {
                        dataTemp.changeAddress = jsonData.params.changeAddress;
                    }
                    if (jsonData.params.paymentId) {
                        dataTemp.paymentID = jsonData.params.paymentId;
                    }
                    data = JSON.stringify(dataTemp)

                    break;
                case "submitblock":
                    data = jsonData.params[0];
                    break;
                default:
                    break;
            }
            path = address;
            callback = callback || function () { };


            var options = {
                hostname: host,
                port: port,
                path: path,
                method: 'POST',
                headers: {
                    'Content-Length': data.length,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'X-API-KEY': config.wallet.password
                }
            };

            var req = (port === 443 ? https : http)
                .request(options, function (res) {
                    var replyData = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        replyData += chunk;
                    });
                    res.on('end', function () {
                        var replyJson;
                        var tempReply;
                        try {
                            replyJson = replyData ? JSON.parse(replyData) : {};
                            tempReply = resultFormat;
                            switch (jsonData.method) {
                                case 'getblocktemplate':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.result.blocktemplate_blob = replyJson.blob;
                                        tempReply.result.difficulty = replyJson.difficulty;
                                        tempReply.result.height = replyJson.height;
                                        tempReply.result.reserved_offset = replyJson.reservedOffset;
                                        replyJson = tempReply;
                                    }
                                    break;
                                case 'sendTransaction':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.result.transactionHash = replyJson.transactionHash;
                                        tempReply.result.fee = replyJson.fee;
                                        replyJson = tempReply;
                                    }
                                    break;
                                case 'submitblock':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        replyJson = tempReply;
                                    }
                                    break;
                                default:
                                    break;
                            }
                        } catch (e) {
                            callback(e, {});
                            return;
                        }
                        callback(null, replyJson);
                    });
                });

                req.on('error', function (e) {
                        callback(e, {});
                });
                if (!req.finished) {
                    req.end(data);
                }
        } else {
            options = {
                hostname: host,
                port: port,
                path: address,
                headers: {
                    'X-API-KEY': config.wallet.password,
                    'Accept': 'application/json'
                }
            };
            var req = (port === 443 ? https : http)
                .get(options, function (res) {
                    var replyData = '';
                    res.setEncoding('utf8');
                    res.on('data', function (chunk) {
                        replyData += chunk;
                    });
                    res.on('end', function () {
                        var replyJson;
                        var tempReply;
                        try {
                            replyJson = replyData ? JSON.parse(replyData) : {};
                            tempReply = resultFormat;
                            switch (jsonData.method) {
                                case 'getlastblockheader':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.result.block_header.block_size = replyJson.size;
                                        tempReply.result.block_header.depth = replyJson.depth;
                                        tempReply.result.block_header.difficulty = replyJson.difficulty;
                                        tempReply.result.block_header.hash = replyJson.hash;
                                        tempReply.result.block_header.height = replyJson.height;
                                        tempReply.result.block_header.major_version = replyJson.majorVersion;
                                        tempReply.result.block_header.minor_version = replyJson.minorVersion;
                                        tempReply.result.block_header.nonce = replyJson.nonce;
                                        tempReply.result.block_header.num_txes = replyJson.transactionCount;
                                        tempReply.result.block_header.orphan_status = replyJson.orphan;
                                        tempReply.result.block_header.prev_hash = replyJson.prevHash;
                                        tempReply.result.block_header.reward = replyJson.reward;
                                        tempReply.result.block_header.timestamp = replyJson.timestamp;
                                        replyJson = tempReply;
                                    }
                                    break;
                                case 'getBalance':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                          tempReply.result.availableBalance = replyJson.unlocked / config.coinUnits;
                                          tempReply.result.lockedAmount = replyJson.locked / config.coinUnits;
                                          replyJson = tempReply;
                                    }
                                    break;
                                case 'getblockheaderbyheight':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.result.block_header.block_size = replyJson.size;
                                        tempReply.result.block_header.depth = replyJson.depth;
                                        tempReply.result.block_header.difficulty = replyJson.difficulty;
                                        tempReply.result.block_header.hash = replyJson.hash;
                                        tempReply.result.block_header.height = replyJson.height;
                                        tempReply.result.block_header.major_version = replyJson.majorVersion;
                                        tempReply.result.block_header.minor_version = replyJson.minorVersion;
                                        tempReply.result.block_header.nonce = replyJson.nonce;
                                        tempReply.result.block_header.num_txes = replyJson.transactionCount;
                                        tempReply.result.block_header.orphan_status = replyJson.orphan;
                                        tempReply.result.block_header.prev_hash = replyJson.prevHash;
                                        tempReply.result.block_header.reward = replyJson.reward;
                                        tempReply.result.block_header.timestamp = replyJson.timestamp;
                                        replyJson = tempReply;
                                    }
                                    break;
                                case 'getblockcount':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.result.count = replyJson;
                                        replyJson = tempReply;
                                    }
                                    break;
                                case 'get_info':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.alt_blocks_count = replyJson.alternateBlockCount
                                        tempReply.result.difficulty = replyJson.difficulty
                                        tempReply.result.grey_peerlist_size = replyJson.greyPeerlistSize
                                        tempReply.result.hashrate = replyJson.hashrate
                                        tempReply.result.height = replyJson.height
                                        tempReply.result.incoming_connections_count = replyJson.incomingConnections
                                        tempReply.result.last_known_block_index = replyJson.lastBlockIndex
                                        tempReply.result.major_version = replyJson.majorVersion
                                        tempReply.result.minor_version = replyJson.minorVersion
                                        tempReply.result.network_height = replyJson.networkHeight
                                        tempReply.result.outgoing_connections_count = replyJson.outgoingConnections
                                        tempReply.result.start_time = replyJson.startTime
                                        tempReply.result.supported_height = replyJson.supportedHeight
                                        tempReply.result.synced = replyJson.synced
                                        tempReply.result.tx_count = replyJson.transactionsSize
                                        tempReply.result.tx_pool_size = replyJson.transactionsPoolSize
                                        tempReply.result.upgrade_heights = replyJson.upgradeHeights
                                        tempReply.result.version = replyJson.version
                                        tempReply.result.white_peerlist_size = replyJson.whitePeerlistSize
                                        replyJson = tempReply;
                                    }
                                    break;
                                case 'getblock':
                                    if (replyJson.error != null) {
                                        replyJson = replyJson
                                    } else {
                                        tempReply.result.block.alreadyGeneratedCoins = replyJson.alreadyGeneratedCoins;
                                        tempReply.result.block.alreadyGeneratedTransactions = replyJson.alreadyGeneratedTransactions;
                                        tempReply.result.block.baseReward = replyJson.baseReward;
                                        tempReply.result.block.blockSize = replyJson.size;
                                        tempReply.result.block.depth = replyJson.depth;
                                        tempReply.result.block.difficulty = replyJson.difficulty;
                                        tempReply.result.block.effectiveSizeMedian = 100000;
                                        tempReply.result.block.hash = replyJson.hash;
                                        tempReply.result.block.height = replyJson.height;
                                        tempReply.result.block.major_version = replyJson.majorVersion;
                                        tempReply.result.block.minor_version = replyJson.minorVersion;
                                        tempReply.result.block.nonce = replyJson.nonce;
                                        tempReply.result.block.orphan_status = replyJson.orphan;
                                        tempReply.result.block.penalty = replyJson.penalty;
                                        tempReply.result.block.prev_hash = replyJson.prevHash;
                                        tempReply.result.block.reward = replyJson.reward;
                                        tempReply.result.block.sizeMedian = replyJson.sizeMedian;
                                        tempReply.result.block.timestamp = replyJson.timestamp;
                                        tempReply.result.block.totalFeeAmount = replyJson.totalFeeAmount;
                                        tempReply.result.block.transactionsCumulativeSize = replyJson.transactionsCumulativeSize;
                                        if (replyJson.transactions != null) {
                                            if (replyJson.transactions.count > 0) {
                                                for (let i = 0; i < replyJson.transactions.count; i++) {
                                                    replyJson.transactions[i].amount_out = replyJson.transactions[i].amountOut;
                                                }

                                            }
                                        }
                                        tempReply.result.block.transactions = replyJson.transactions;
                                        replyJson = tempReply;
                                    }
                                    break;
                                default:
                                    break;
                            }
                        } catch (e) {
                            callback(e, {});
                            return;
                        }
                        callback(null, replyJson);
                    });
                });

                req.on('error', function (e) {
                        callback(e, {});
                });
                if (!req.finished) {
                    req.end(data);
                }
        }

    }
    else {
        path = path || '/json_rpc';
        callback = callback || function () { };
        var options = {
            hostname: host,
            port: port,
            path: path,
            method: data ? 'POST' : 'GET',
            headers: {
                'Content-Length': data.length,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };
        var req = (port === 443 ? https : http)
            .request(options, function (res) {
                var replyData = '';
                res.setEncoding('utf8');
                res.on('data', function (chunk) {
                    replyData += chunk;
                });
                res.on('end', function () {
                    var replyJson;
                    try {
                        replyJson = replyData ? JSON.parse(replyData) : {};
                    } catch (e) {
                        callback(e, {});
                        return;
                    }
                    if (replyJson && !replyJson.error) {
                        let requestJson = data ? JSON.parse(data) : {};
                        if (requestJson.method && (requestJson.method.indexOf('eth_') === 0 || requestJson.method.indexOf('randomx_') === 0)) {
                            replyJson.result = normalizeEthereumResult(requestJson.method, replyJson.result);
                        }
                    }
                    callback(null, replyJson);
                });
            });

            req.on('error', function (e) {
                    callback(e, {});
            });
            if (!req.finished) {
                req.end(data);
            }
    }

}

/**
 * Send RPC request
 **/
function rpc(host, port, method, params, callback) {

    var payload = ethereumRpcPayload(method, params);
    var request = {
        id: "0",
        jsonrpc: "2.0",
        password: config.wallet.password,
        method: payload.method,
        params: payload.params
    };
    var data = JSON.stringify(request);

    jsonHttpRequest(host, port, data, function (error, replyJson) {
        if (error) {
            callback(error, {});
            return;
        }
        let result = replyJson.result;
        if (!(result && (result.block_header || result.blocktemplate_blob || result.status || result.height !== undefined))) {
            result = normalizeEthereumResult(payload.method, result);
        }
        callback(replyJson.error, result);
    });

}

/**
 * Send RPC requests in batch mode
 **/
function batchRpc(host, port, array, callback) {
    var rpcArray = [];
    for (var i = 0; i < array.length; i++) {
        var payload = ethereumRpcPayload(array[i][0], array[i][1]);
        rpcArray.push({
            id: i.toString(),
            jsonrpc: "2.0",
	    password: config.wallet.password,
            method: payload.method,
            params: payload.params
        });
    }
    var data = JSON.stringify(rpcArray);
    jsonHttpRequest(host, port, data, callback);
}

/**
 * Send RPC request to pool API
 **/
function poolRpc(host, port, path, callback) {
    jsonHttpRequest(host, port, '', callback, path);
}

/**
 * Exports API interfaces functions
 **/
module.exports = function (daemonConfig, walletConfig, poolApiConfig) {
    return {
        batchRpcDaemon: function (batchArray, callback) {
            batchRpc(daemonConfig.host, daemonConfig.port, batchArray, callback);
        },
        rpcDaemon: function (method, params, callback, serverConfig) {
            if (serverConfig) {
                rpc(serverConfig.host, serverConfig.port, method, params, callback);
            } else {
                rpc(daemonConfig.host, daemonConfig.port, method, params, callback);
            }
        },
        rpcWallet: function (method, params, callback) {
            rpc(walletConfig.host, walletConfig.port, method, params, callback);
        },
        pool: function (path, callback) {
            var bindIp = config.api.bindIp ? config.api.bindIp : "0.0.0.0";
            var poolApi = (bindIp !== "0.0.0.0" ? poolApiConfig.bindIp : "127.0.0.1");
            poolRpc(poolApi, poolApiConfig.port, path, callback);
        },
        jsonHttpRequest: jsonHttpRequest
    }
};
