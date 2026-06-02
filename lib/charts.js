// Load required modules
let fs = require('fs');
let async = require('async');
let http = require('http');
let apiInterfaces = require('./apiInterfaces.js')(config.daemon, config.wallet, config.api);

// Set charts cleanup interval
let cleanupInterval = config.redis.cleanupInterval && config.redis.cleanupInterval > 0 ? config.redis.cleanupInterval : 15;

// Initialize log system
let logSystem = 'charts';
require('./exceptionWriter.js')(logSystem);

/**
 * Charts data collectors (used by chartsDataCollector.js)
 **/

// Start data collectors
function startDataCollectors () {
	async.each(Object.keys(config.charts.pool), function (chartName) {
		let settings = config.charts.pool[chartName];
		if (settings.enabled) {
			setInterval(function () {
				collectPoolStatWithInterval(chartName, settings);
			}, settings.updateInterval * 1000);
		}
	});

	let userSettings = config.charts.user.hashrate;
	if (userSettings.enabled) {
		setInterval(function () {
			collectUsersHashrate('hashrate', userSettings);
		}, userSettings.updateInterval * 1000)
	}

	let workerSettings = config.charts.user.worker_hashrate;
	if (workerSettings && workerSettings.enabled) {
		setInterval(function () {
			collectWorkersHashrate('worker_hashrate', workerSettings);
		}, workerSettings.updateInterval * 1000);
	}
}


// Chart data functions
let chartStatFuncs = {
	hashrate: getPoolHashrate,
	miners: getPoolMiners,
	workers: getPoolWorkers,
	difficulty: getNetworkDifficulty
};

// Statistic value handler
let statValueHandler = {
	avg: function (set, value) {
		set[1] = (set[1] * set[2] + value) / (set[2] + 1);
	},
	avgRound: function (set, value) {
		statValueHandler.avg(set, value);
		set[1] = Math.round(set[1]);
	},
	max: function (set, value) {
		if (value > set[1]) {
			set[1] = value;
		}
	}
};

// Presave functions
let preSaveFunctions = {
	hashrate: statValueHandler.avgRound,
	hashrateSolo: statValueHandler.avgRound,
	workers: statValueHandler.max,
	workersSolo: statValueHandler.max,
	difficulty: statValueHandler.avgRound
};

// Store collected values in redis database
function storeCollectedValues (chartName, values, settings) {
	for (let i in values) {
		storeCollectedValue(chartName + ':' + i, [values[i]], settings);
	}
}

// Store collected value in redis database
function storeCollectedValue (chartName, values, settings) {
	let now = new Date() / 1000 | 0;
        if (!values || (Array.isArray(values) && values.length === 0)) {
                return;
        }
	values.forEach((value, index) => {
		let name = `${chartName}` + (index === 0 ? '' : 'Solo')
		return getChartDataFromRedis(name, function (sets) {
			let lastSet = sets[sets.length - 1]; // [time, avgValue, updatesCount]
			if (!lastSet || now - lastSet[0] > settings.stepInterval) {
				lastSet = [now, value, 1];
				sets.push(lastSet);
				while (now - sets[0][0] > settings.maximumPeriod) { // clear old sets
					sets.shift();
				}
			} else {
				preSaveFunctions[name] ?
					preSaveFunctions[name](lastSet, value) :
					statValueHandler.avgRound(lastSet, value);
				lastSet[2]++;
			}

			if (getStatsRedisKey(name)
				.search(`^${config.coin}:charts:hashrate$`) >= 0) {
				redisClient.set(getStatsRedisKey(name), JSON.stringify(sets), 'EX', (86400 * cleanupInterval));
			} else if (getStatsRedisKey(name)
				.search(`^${config.coin}:charts:hashrateSolo$`) >= 0) {
				redisClient.set(getStatsRedisKey(name), JSON.stringify(sets), 'EX', (86400 * cleanupInterval));
			} else {
				redisClient.set(getStatsRedisKey(name), JSON.stringify(sets));
			}
			log('info', logSystem, name + ' chart collected value ' + value + '. Total sets count ' + sets.length);
		});
	})
}

// Collect pool statistics with an interval
function collectPoolStatWithInterval (chartName, settings) {
	async.waterfall([
		chartStatFuncs[chartName],
		function (values, callback) {
			storeCollectedValue(chartName, values, settings, callback);
		}
	]);
}

/**
 * Get chart data from redis database
 **/
function getChartDataFromRedis (chartName, callback) {
	redisClient.get(getStatsRedisKey(chartName), function (error, data) {
		callback(data ? JSON.parse(data) : []);
	});
}

/**
 * Return redis key for chart data
 **/
function getStatsRedisKey (chartName) {
	return config.coin + ':charts:' + chartName;
}

/**
 * Get pool statistics from API
 **/
function getPoolStats (callback) {
        apiInterfaces.pool('/stats', function (error, data) {
                if (error) {
                        log('error', logSystem, 'Unable to get API data for stats: ' + error);
                        callback(error, null);
                        return;
                }
                // Add null check for data
                if (!data) {
                        log('error', logSystem, 'No data received from API');
                        callback(new Error('No data'), null);
                        return;
                }
                callback(null, data);
        });
}


/**
 * Get pool hashrate from API
 **/
function getPoolHashrate (callback) {
        getPoolStats(function (error, stats) {
                if (error || !stats) {
                        callback(error, [0, 0]);
                        return;
                }
                // Add null checks for stats.pool
                var hashrate = (stats.pool && stats.pool.hashrate) ? Math.round(stats.pool.hashrate) : 0;
                var hashrateSolo = (stats.pool && stats.pool.hashrateSolo) ? Math.round(stats.pool.hashrateSolo) : 0;
                callback(null, [hashrate, hashrateSolo]);
        });
}


/**
 * Get pool miners from API
 **/
function getPoolMiners (callback) {
        getPoolStats(function (error, stats) {
                if (error || !stats) {
                        callback(error, [0, 0]);
                        return;
                }
                var miners = (stats.pool && stats.pool.miners) ? stats.pool.miners : 0;
                var minersSolo = (stats.pool && stats.pool.minersSolo) ? stats.pool.minersSolo : 0;
                callback(null, [miners, minersSolo]);
        });
}

/**
 * Get pool workers from API
 **/
function getPoolWorkers (callback) {
        getPoolStats(function (error, stats) {
                if (error || !stats) {
                        callback(error, [0, 0]);
                        return;
                }
                var workers = (stats.pool && stats.pool.workers) ? stats.pool.workers : 0;
                var workersSolo = (stats.pool && stats.pool.workersSolo) ? stats.pool.workersSolo : 0;
                callback(null, [workers, workersSolo]);
        });
}

/**
 * Get network difficulty from API
 **/
function getNetworkDifficulty (callback) {
        getPoolStats(function (error, stats) {
                if (error || !stats || !stats.network) {
                        callback(error, [0]);
                        return;
                }
                var difficulty = stats.network.difficulty ? stats.network.difficulty : 0;
                callback(null, [difficulty]);
        });
}

/**
 * Get users hashrate from API
 **/
function getUsersHashrates (callback) {
        apiInterfaces.pool('/miners_hashrate', function (error, data) {
                if (error) {
                        log('error', logSystem, 'Unable to get API data for miners_hashrate: ' + error);
                        callback({});
                        return;
                }
                // Add null checks for data
                if (!data) {
                        log('error', logSystem, 'No data received from miners_hashrate API');
                        callback({});
                        return;
                }
                let resultData = data.minersHashrate || {};
                callback(resultData);
        });
}

/**
 * Get workers' hashrates from API
 **/
function getWorkersHashrates (callback) {
        apiInterfaces.pool('/workers_hashrate', function (error, data) {
                if (error) {
                        log('error', logSystem, 'Unable to get API data for workers_hashrate: ' + error);
                        callback({});
                        return;
                }
                if (!data) {
                        log('error', logSystem, 'No data received from workers_hashrate API');
                        callback({});
                        return;
                }
                let resultData = data.workersHashrate || {};
                callback(resultData);
        });
}

/**
 * Collect users hashrate from API
 **/
function collectUsersHashrate (chartName, settings) {
	let redisBaseKey = getStatsRedisKey(chartName) + ':';
	redisClient.keys(redisBaseKey + '*', function (keys) {
		let hashrates = {};
		for (let i in keys) {
			hashrates[keys[i].substr(redisBaseKey.length)] = 0;
		}
		getUsersHashrates(function (newHashrates) {
			for (let address in newHashrates) {
				hashrates[address] = newHashrates[address];
			}
			storeCollectedValues(chartName, hashrates, settings);
		});
	});
}

/**
 * Get user hashrate chart data
 **/
function getUserHashrateChartData (address, callback) {
	getChartDataFromRedis('hashrate:' + address, callback);
}

/**
 * Collect worker hashrates from API
 **/
function collectWorkersHashrate (chartName, settings) {
	let redisBaseKey = getStatsRedisKey(chartName) + ':';
	redisClient.keys(redisBaseKey + '*', function (keys) {
		let hashrates = {};
		for (let i in keys) {
			hashrates[keys[i].substr(redisBaseKey.length)] = 0;
		}
		getWorkersHashrates(function (newHashrates) {
			for (let addr_worker in newHashrates) {
				hashrates[addr_worker] = newHashrates[addr_worker];
			}
			storeCollectedValues(chartName, hashrates, settings);
		});
	});
}

/**
 * Convert payments data to chart
 **/
function convertPaymentsDataToChart (paymentsData) {
	let data = [];
	if (paymentsData && paymentsData.length) {
		for (let i = 0; paymentsData[i]; i += 2) {
			data.unshift([+paymentsData[i + 1], paymentsData[i].split(':')[1]]);
		}
	}
	return data;
}

/**
 * Return pool charts data
 **/
function getPoolChartsData (callback) {
	let chartsNames = [];
	let redisKeys = [];
	for (let chartName in config.charts.pool) {
		if (config.charts.pool[chartName].enabled) {
			chartsNames.push(chartName);
			redisKeys.push(getStatsRedisKey(chartName));
		}
	}
	chartsNames.push('hashrateSolo')
	chartsNames.push('minersSolo')
	chartsNames.push('workersSolo')
	redisKeys.push(getStatsRedisKey('hashrateSolo'))
	redisKeys.push(getStatsRedisKey('minersSolo'))
	redisKeys.push(getStatsRedisKey('workersSolo'))
	if (redisKeys.length) {
		redisClient.mget(redisKeys, function (error, data) {
			let stats = {};
			if (data) {
				for (let i in data) {
					if (data[i]) {
						stats[chartsNames[i]] = JSON.parse(data[i]);
					}
				}
			}
			callback(error, stats);
		});
	} else {
		callback(null, {});
	}
}

/**
 * Return user charts data
 **/
function getUserChartsData (address, paymentsData, callback) {
	let stats = {};
	let chartsFuncs = {
		hashrate: function (callback) {
			getUserHashrateChartData(address, function (data) {
				callback(null, data);
			});
		},

		payments: function (callback) {
			callback(null, convertPaymentsDataToChart(paymentsData));
		}
	};
	for (let chartName in chartsFuncs) {
		if (!config.charts.user[chartName].enabled) {
			delete chartsFuncs[chartName];
		}
	}
	async.parallel(chartsFuncs, callback);
}


/**
 * Exports charts functions
 **/
module.exports = {
	startDataCollectors: startDataCollectors,
	getUserChartsData: getUserChartsData,
	getPoolChartsData: getPoolChartsData
};
