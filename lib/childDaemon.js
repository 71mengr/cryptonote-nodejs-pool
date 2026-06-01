let async = require('async');
let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);
let lastHash;
let latestBlockHeight = 0;
let POOL_NONCE_SIZE = 16 + 1; // +1 for old XMR/new TRTL bugs
let logSystem = 'childDaemon'
require('./exceptionWriter.js')(logSystem);

function getRandomXSeedHash (host, port, blockNumber, callback) {
	let seedData = JSON.stringify({
		id: "0",
		jsonrpc: "2.0",
		method: 'randomx_getSeedHash',
		params: [blockNumber]
	})

	apiInterfaces.jsonHttpRequest(host, port, seedData, function (err, res) {
		if (err) {
			callback(err)
			return
		}
		if (res.error) {
			callback(res.error)
			return
		}
		callback(null, res.result)
	})
}
let pool = config.childPools[process.env.poolId];

let blockData = JSON.stringify({
	id: "0",
	jsonrpc: "2.0",
	method: 'eth_getBlockByNumber',
	params: ['latest', false]
})

let templateData = JSON.stringify({
	id: "0",
	jsonrpc: "2.0",
	method: 'eth_getWork',
	params: []
})

function runInterval () {
	async.waterfall([
			function (callback) {
				apiInterfaces.jsonHttpRequest(pool.childDaemon.host, pool.childDaemon.port, blockData, function (err, res) {
					if (err) {
						log('error', logSystem, '%s error from daemon', [pool.coin]);
						setTimeout(runInterval, 3000);
						return;
					}
					if (res && res.result && res.result.status === "OK" && res.result.hasOwnProperty('block_header')) {
						let hash = res.result.block_header.hash.toString('hex');
						latestBlockHeight = res.result.block_header.height || latestBlockHeight;
						if (!lastHash || lastHash !== hash) {
							lastHash = hash
							log('info', logSystem, '%s found new hash %s', [pool.coin, hash]);
							callback(null, true);
							return;
						} else if (config.daemon.alwaysPoll || false) {
							callback(null, true);
							return;
						} else {
							callback(true);
							return;
						}
					} else {
						log('error', logSystem, '%s bad reponse from daemon', [pool.coin]);
						setTimeout(runInterval, 3000);
						return;
					}
				});
			},
			function (getbc, callback) {
				apiInterfaces.jsonHttpRequest(pool.childDaemon.host, pool.childDaemon.port, templateData, function (err, res) {
					if (err) {
						log('error', logSystem, '%s Error polling eth_getWork %j', [pool.coin, err])
						callback(null)
						return
					}
					let blockNumber = res.result.height || latestBlockHeight + 1;
					res.result.height = blockNumber;
					if (!res.result.seed_hash) {
						getRandomXSeedHash(pool.childDaemon.host, pool.childDaemon.port, blockNumber, function (seedErr, seedHash) {
							if (seedErr) {
								log('error', logSystem, '%s Error polling randomx_getSeedHash %j', [pool.coin, seedErr])
								callback(null)
								return
							}
							res.result.seed_hash = seedHash;
							process.send({
								type: 'ChildBlockTemplate',
								block: res.result,
								poolIndex: process.env.poolId
							})
							callback(null)
						})
						return
					}
					process.send({
						type: 'ChildBlockTemplate',
						block: res.result,
						poolIndex: process.env.poolId
					})
					callback(null)
				})
			}
		],
		function (error) {
			if (error) {}
			setTimeout(function () {
				runInterval()
			}, config.poolServer.blockRefreshInterval)
		})
}

runInterval()
