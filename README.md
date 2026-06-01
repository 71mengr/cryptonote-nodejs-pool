![Zent Cash](https://github.com/ZentCashFoundation/brand/blob/master/logo/wordmark/zentcash_wordmark_color.png "Zent Cash")

[![Discord](https://img.shields.io/discord/527428494154792960?label=Discord%20-%20Zent%20Cash%20[ZTC])](https://discord.gg/tfaUE2G) 
[![GitHub issues](https://img.shields.io/github/issues/ZentCashFoundation/cryptonote-nodejs-pool?label=Issues)](https://github.com/ZentCashFoundation/cryptonote-nodejs-pool/issues)
[![GitHub contributors](https://img.shields.io/github/contributors-anon/ZentCashFoundation/cryptonote-nodejs-pool?label=Contributors)](https://github.com/ZentCashFoundation/cryptonote-nodejs-pool/graphs/contributors) 
[![GitHub All Releases](https://img.shields.io/github/downloads/ZentCashFoundation/cryptonote-nodejs-pool/total?label=Downloads)](https://github.com/ZentCashFoundation/cryptonote-nodejs-pool) 
![Version](https://img.shields.io/github/v/release/ZentCashFoundation/cryptonote-nodejs-pool)


High performance Node.js (with native C addons) mining pool for CryptoNote based coins. Comes with lightweight example front-end script which uses the pool's AJAX API. Support for Cryptonight, Cryptonight Light, Cryptonight Fast, Cryptonight Heavy, Cryptonight Pico, Argon2 and RandomX algorithms.

#### Table of Contents
* [Features](#features)
* [Usage](#usage)
  * [Requirements](#requirements)
  * [Downloading & Installing](#1-downloading--installing)
  * [Configuration](#2-configuration)
  * [Starting the Pool](#3-start-the-pool)
  * [Host the front-end](#4-host-the-front-end)
  * [Customizing your website](#5-customize-your-website)
  * [SSL](#ssl)
  * [Upgrading](#upgrading)
* [JSON-RPC API Commands from CLI](#json-rpc-api-commands-from-cli)
* [JSON-RPC Restful API Commands from CLI](#json-rpc-restful-api-commands-from-cli)
* [Monitoring Your Pool](#monitoring-your-pool)
* [Community Support](#community--support)
* [Pools Using This Software](#pools-using-this-software)
* [Donations](#donations)
* [Credits](#credits)
* [License](#license)


Features
===

#### Optimized pool server
* TCP (stratum-like) protocol for server-push based jobs
* Compared to old HTTP protocol, this has a higher hash rate, lower network/CPU server load, lower orphan block percent, and less error prone
* Support for Cryptonight, Cryptonight Light, Cryptonight Heavy, Cryptonight Pico, Argon2 and RandomX algorithms.
* Custom API to support coins based on Zent Cash, Ninjacoin, Bitcoin Nova and Turtlecoin (Restful API)
* IP banning to prevent low-diff share attacks
* Socket flooding detection
* Share trust algorithm to reduce share validation hashing CPU load
* Clustering for vertical scaling
* Ability to configure multiple ports - each with their own difficulty
* Miner login (wallet address) validation
* Workers identification (specify worker name as the password)
* Variable difficulty / share limiter
* Set fixed difficulty on miner client by passing "address" param with "+[difficulty]" postfix
* Modular components for horizontal scaling (pool server, database, stats/API, payment processing, front-end)
* SSL support for both pool and API servers
* RBPPS (PROP) payment system

#### Live statistics API
* Currency network/block difficulty
* Current block height
* Network hashrate
* Pool hashrate
* Each miners' individual stats (hashrate, shares submitted, pending balance, total paid, payout estimate, etc)
* Blocks found (pending, confirmed, and orphaned)
* Historic charts of pool's hashrate, miners count and coin difficulty
* Historic charts of users's hashrate and payments

#### Mined blocks explorer
* Mined blocks table with block status (pending, confirmed, and orphaned)
* Blocks luck (shares/difficulty) statistics
* Universal blocks and transactions explorer

#### Smart payment processing
* Splintered transactions to deal with max transaction size
* Minimum payment threshold before balance will be paid out
* Minimum denomination for truncating payment amount precision to reduce size/complexity of block transactions
* Prevent "transaction is too big" error with "payments.maxTransactionAmount" option
* Option to enable dynamic transfer fee based on number of payees per transaction and option to have miner pay transfer fee instead of pool owner (applied to dynamic fee only)
* Control transactions priority with config.payments.priority (default: 0).
* Set payment ID on miner client when using "[address].[paymentID]" login
* Integrated payment ID addresses support for Exchanges

#### Admin panel
* Aggregated pool statistics
* Coin daemon & wallet RPC services stability monitoring
* Log files data access
* Users list with detailed statistics

#### Pool stability monitoring
* Detailed logging in process console & log files
* Coin daemon & wallet RPC services stability monitoring
* See logs data from admin panel

#### Extra features
* An easily extendable, responsive, light-weight front-end using API to display data
* Onishin's [keepalive function](https://github.com/perl5577/cpuminer-multi/commit/0c8aedb)
* Support for merged mining
* Support for slush mining system (disabled by default)
* E-Mail Notifications on worker connected, disconnected (timeout) or banned (support MailGun, SMTP and Sendmail)
* Telegram channel notifications when a block is unlocked
* Discord channel notifications when a block is unlocked
* Top 10 miners report
* Finder Reward (Top 1)
* Multilingual user interface

Usage
===

#### Requirements
* Coin daemon(s) (find the coin's repo and build latest version from source)
* [Node.js](http://nodejs.org/) v18.0+
  * For Ubuntu: 
 ```
  sudo apt-get install build-essential libssl-dev curl
  curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash
  sudo apt-get install -y nodejs
 ```
  
* [Redis](http://redis.io/) key-value store v2.6+ 
  * For Ubuntu: 
```
sudo add-apt-repository ppa:chris-lea/redis-server
sudo apt-get update
sudo apt-get install redis-server
 ```
 Dont forget to tune redis-server:
 ```
echo never > /sys/kernel/mm/transparent_hugepage/enabled
echo 1024 > /proc/sys/net/core/somaxconn
 ```
 Add this lines to your /etc/rc.local and make it executable
 ```
 chmod +x /etc/rc.local
 ```
 
* libssl required for the node-multi-hashing module
  * For Ubuntu: `sudo apt-get install libssl-dev`

* Boost is required for the cryptoforknote-util module
  * For Ubuntu: `sudo apt-get install libboost-all-dev`
  
* libsodium  
  * For Ubuntu: `sudo apt-get install libsodium-dev`

* libgmp-dev
  * For Ubuntu: `sudo apt-get install libgmp-dev`

* build-essential
  * For Ubuntu: `sudo apt-get install build-essential`

##### Seriously
Those are legitimate requirements. If you use old versions of Node.js or Redis that may come with your system package manager then you will have problems. Follow the linked instructions to get the last stable versions.

[**Redis warning**](http://redis.io/topics/security): It'sa good idea to learn about and understand software that
you are using - a good place to start with redis is [data persistence](http://redis.io/topics/persistence).

**Do not run the pool as root** : create a new user without ssh access to avoid security issues :
```bash
sudo adduser --disabled-password --disabled-login your-user
```
To login with this user : 
```
sudo su - your-user
```

#### 1) Downloading & Installing


Clone the repository and run `npm update` for all the dependencies to be installed:

```bash
git clone https://github.com/ZentCashFoundation/cryptonote-nodejs-pool.git pool
cd pool

npm update
```

#### 2) Configuration

Copy the `config_examples/COIN.json` file of your choice to `config.json` then overview each options and change any to match your preferred setup.

Explanation for each field:
```javascript
{
    /* Pool host displayed in notifications and front-end */
    "poolHost": "your.pool.host", 
    
    /* Used for storage in redis so multiple coins can share the same redis instance. */
    /* Must match the parentCoin variable in config.js */
    "coin": "Zent", 
    
    /* Used for front-end display */
    "symbol": "ZTC",

    /* Number of coin decimals places for notifications and front-end */
    "coinDecimalPlaces": 2, 
    /* Coin network time to mine one block, see DIFFICULTY_TARGET constant in DAEMON_CODE/src/cryptonote_config.h */
    "coinDifficultyTarget": 120,
    
    //used on blocks page to generate hyperlinks.
    "blockchainExplorer": "http://explorer.zent.cash/?hash={id}#blockchain_block",
    
    /* Used on the payments page to generate hyperlinks */
    "transactionExplorer": "http://explorer.zent.cash/?hash={id}#blockchain_transaction",

    /* Set daemon type. Supported values: default, forknote (Fix block height + 1), bytecoin (ByteCoin Wallet RPC API), ethereum (Ethereum JSON-RPC/getWork) */
    "daemonType": "ethereum",
    
    /* Set RandomX algorithm settings.
    This pool is RandomX-only; other cnAlgorithm values are ignored at runtime.
    Supported RandomX variant: 0 (RandomX / rx/0).
    Supported blob types: 0 (Cryptonote), 1 (Forknote v1), 2 (Forknote v2), 3 (Cryptonote v2 / Masari) */
    "cnAlgorithm": "randomx",
    "cnVariant": 0,
    "cnBlobType": 2,
    "isRandomX": true,
    "includeAlgo": "rx/0",
   
    /* True to include block.height in job to miner */
    "includeHeight": true,

    /* Select the RestFul API for Wallet */
    "restfulApiWallet" : true,

    /* Select the RestFul API for Daemon and Wallet */
    "restfulApiDaemonAndWallet": false,	

    /* Logging */
    "logging": {

        "files": {
            
            /* Specifies the level of log output verbosity. This level and anything
            more severe will be logged. Options are: info, warn, or error. */
            "level": "info",

            /* Directory where to write log files. */
            "directory": "logs",

            /* How often (in seconds) to append/flush data to the log files. */
            "flushInterval": 5
        },
        "console": {
            "level": "info",
            /* Gives console output useful colors. If you direct that output to a log file
             then disable this feature to avoid nasty characters in the file. */
            "colors": true
        }
    },
    "hashingUtil": true,
    "childPools": null, // Specific configuration for merged mining

    /* Modular Pool Server */
    "poolServer": {
        "enabled": true, //Enable or disable the mining service
        "mergedMining": false, // Enable or disable merged mining
        
        /* Set to "auto" by default which will spawn one process/fork/worker for each CPU
        core in your system. Each of these workers will run a separate instance of your
        pool(s), and the kernel will load balance miners using these forks. Optionally,
        the 'forks' field can be a number for how many forks will be spawned. */
        "clusterForks": "auto",
        
        /* Address where block rewards go, and miner payments come from. */
        "poolAddress": "Your ZTC Wallet address",
       
        /* This is the Integrated address prefix used for miner login validation. */
        "intAddressPrefix": null,
        
        /* Poll RPC daemons for new blocks every this many milliseconds. */
        "blockRefreshInterval": 1000,

         /* How many seconds until we consider a miner disconnected. */
        "minerTimeout": 900,

        "sslCert": "./cert.pem", // The SSL certificate
        "sslKey": "./privkey.pem", // The SSL private key
        "sslCA": "./chain.pem", // The SSL certificate authority chain
        "ports": [
            {
                "port": 11151, // Port for mining apps to connect to
                "difficulty": 400000, // Initial difficulty miners are set to
                "desc": "Low end hardware" // Description of port
            },
            {
                "port": 11152, // Port for mining apps to connect to
                "difficulty": 600000, // Initial difficulty miners are set to
                "desc": "Mid range hardware" // Description of port
            },
            {
                "port": 11153, // Port for mining apps to connect to
                "difficulty": 700000, // Initial difficulty miners are set to
                "desc": "High end hardware" // Description of port
            },
            {
                "port": 11154, // Port for mining apps to connect to
                "difficulty": 1000000, // Initial difficulty miners are set to
                "desc": "Very hight end hardware" // Description of port
            }
        ],
        /* Variable difficulty is a feature that will automatically adjust difficulty for
        individual miners based on their hashrate in order to lower networking and CPU
        overhead. */
        "varDiff": {
            "minDiff": 100, // Minimum difficulty
            "maxDiff": 5000000, // Maximum difficulty
            "targetTime": 60, // Try to get 1 share per this many seconds
            "retargetTime": 30, // Check to see if we should retarget every this many seconds
            "variancePercent": 30, // Allow time to vary this % from target without retargeting
            "maxJump": 100 // Limit diff percent increase/decrease in a single retargeting
        },
        
         /* Set payment ID on miner client side by passing <address>+<paymentID> */
        "paymentId": {
            "addressSeparator": "+" // Character separator between <address> and <paymentID>
        },
        
	"separators": [
            {
                "value": "+",
                "desc": "plus"
            },
            {
                "value": ".",
                "desc": "dot"
            }
        ],

        /* Set difficulty on miner client side by passing <address> param with .<difficulty> postfix */
        "fixedDiff": {
            "enabled": true,
            "addressSeparator": "." // Character separator between <address> and <difficulty>
        },
        
        /* Feature to trust share difficulties from miners which can
        significantly reduce CPU load. */
        "shareTrust": {
            "enabled": true,
            "min": 10, // Minimum percent probability for share hashing
            "stepDown": 3, // Increase trust probability % this much with each valid share
            "threshold": 10, // Amount of valid shares required before trusting begins
            "penalty": 30 // Upon breaking trust require this many valid share before trusting
        },

        /* If under low-diff share attack we can ban their IP to reduce system/network load. */
        "banning": {
            "enabled": true, // With this option enabled the pool will ban a miner when the miner sends invalid hashes
            "time": 600, // How many seconds to ban worker for
            "invalidPercent": 25, // What percent of invalid shares triggers ban
            "checkThreshold": 30 // Perform check when this many shares have been submitted
        },

        /* Slush Mining is a reward calculation technique which disincentivizes pool hopping and 
        rewards 'loyal' miners by valuing younger shares higher than older shares. Remember
        adjusting the weight!
        More about it here: https://mining.bitcoin.cz/help/#!/manual/rewards */
        "slushMining": {
            "enabled": false, // Enables slush mining. Recommended for pools catering to professional miners
            
            /* Defines how fast the score assigned to a share declines in time. 
            The value should roughly be equivalent to the average round duration in seconds 
            divided by 8. When deviating by too much numbers may get too high for JS. */
            "weight": 300, 
            "blockTime": 120,
            "lastBlockCheckRate": 1
         }
    },

    /* Module that sends payments to miners according to their submitted shares. */
    "payments": {
        "enabled": true,
        "interval": 120, // How often to run in seconds
        "maxAddresses": 100, // Split up payments if sending to more than this many addresses
        "mixin": 3, // Number of transactions yours is indistinguishable from
        "priority": 0, // The transaction priority
        "transferFee": 10, // Fee to pay for each transaction
        "dynamicTransferFee": true, // Enable dynamic transfer fee (fee is multiplied by number of miners)
	"feePerByte": false, //Enables or disables the dynamic fee or fee per byte for transactions
        "minerPayFee" : true, // Miner pays the transfer fee instead of pool owner when using dynamic transfer fee
        "minPayment": 5000, // Miner balance required before sending payment
        "maxPayment": null, // Maximum miner balance allowed in miner settings 
        "maxTransactionAmount": 0, // Split transactions by this amount (to prevent "too big transaction" error)
        "denomination": 100 // Truncate to this precision and store remainder
    },
    
    /* Module that monitors the submitted block maturities and manages rounds. Confirmed
    blocks mark the end of a round where workers' balances are increased in proportion
    to their shares. */
    "blockUnlocker": {
        "enabled": true,
        "interval": 30, // How often to check block statuses in seconds
        "depth": 20, // Block depth required for a block to unlocked/mature.
	"poolFee": 0.5, // 0.5% pool fee (1% total fee total including donations)
	"soloFee": 0.0, // Solo fee
	"finderReward" : 0.0, // Finder Reward
        "devDonation": 0.5, // 0.5% donation to send to pool dev
        "networkFee": 0.0, // Network/Governance fee
        /* Some forknote coins have an issue with block height in RPC request, to fix you can enable this option.
        See: https://github.com/forknote/forknote-pool/issues/48 */
        "fixBlockHeightRPC": false
    },

    /* AJAX API used for front-end website. */
    "api": {
        "enabled": true,
        "hashrateWindow": 600, // How many second worth of shares used to estimate hash rate
        "updateInterval": 5, // Gather stats and broadcast every this many seconds
        "bindIp": "0.0.0.0", // Bind API to a specific IP (set to 0.0.0.0 for all)
        "port": 8134, // The API port
        "blocks": 30, // Amount of blocks to send at a time
        "payments": 30, // Amount of payments to send at a time
        "password": "Admin Api Password", // Password required for admin stats
        "ssl": false, // Enable SSL API
        "sslPort": 8135, // The SSL port
        "sslCert": "./cert.pem", // The SSL certificate
        "sslKey": "./privkey.pem", // The SSL private key
        "sslCA": "./cert.pem", // The SSL certificate authority chain
        "trustProxyIP": true // Proxy X-Forwarded-For support
    },

    /* Coin daemon connection details */
    "daemon": {
        "host": "127.0.0.1",
        "port": 21698
    },

    /* Wallet daemon connection details */
    "wallet": {
        "host": "127.0.0.1",
        "port": 21699,
	"password": "Wallet RPC Password"
    },

    /* Redis connection info */
    "redis": {
        "host": "127.0.0.1",
        "port": 6379,
        "auth": null, // If set, client will run redis auth command on connect. Use for remote db
        "db": 2, // Set the REDIS database to use (default to 0)
	"cleanupInterval": 15 // Set the REDIS database cleanup interval (in days)
    },

    /* Pool Notifications */
    "notifications": {
        "emailTemplate": "email_templates/default.txt",
        "emailSubject": {
            "emailAdded": "Your email was registered",
            "workerConnected": "Worker %WORKER_NAME% connected",
            "workerTimeout": "Worker %WORKER_NAME% stopped hashing",
            "workerBanned": "Worker %WORKER_NAME% banned",
            "blockFound": "Block %HEIGHT% found !",
            "blockUnlocked": "Block %HEIGHT% unlocked !",
            "blockOrphaned": "Block %HEIGHT% orphaned !",
            "payment": "We sent you a payment !"
        },
        "emailMessage": {
            "emailAdded": "Your email has been registered to receive pool notifications.",
            "workerConnected": "Your worker %WORKER_NAME% for address %MINER% is now connected from ip %IP%.",
            "workerTimeout": "Your worker %WORKER_NAME% for address %MINER% has stopped submitting hashes on %LAST_HASH%.",
            "workerBanned": "Your worker %WORKER_NAME% for address %MINER% has been banned.",
            "blockFound": "Block found at height %HEIGHT% by miner %MINER% on %TIME%. Waiting maturity.",
            "blockUnlocked": "Block mined at height %HEIGHT% with %REWARD% and %EFFORT% effort on %TIME%.",
            "blockOrphaned": "Block orphaned at height %HEIGHT% :(",
            "payment": "A payment of %AMOUNT% has been sent to %ADDRESS% wallet."
        },
        "telegramMessage": {
            "workerConnected": "Your worker _%WORKER_NAME%_ for address _%MINER%_ is now connected from ip _%IP%_.",
            "workerTimeout": "Your worker _%WORKER_NAME%_ for address _%MINER%_ has stopped submitting hashes on _%LAST_HASH%_.",
            "workerBanned": "Your worker _%WORKER_NAME%_ for address _%MINER%_ has been banned.",
            "blockFound": "*Block found at height* _%HEIGHT%_ *by miner* _%MINER%_*! Waiting maturity.*",
            "blockUnlocked": "*Block mined at height* _%HEIGHT%_ *with* _%REWARD%_ *and* _%EFFORT%_ *effort on* _%TIME%_*.*",
            "blockOrphaned": "*Block orphaned at height* _%HEIGHT%_ *:(*",
            "payment": "A payment of _%AMOUNT%_ has been sent."
        },
        "discordMessage": {
            "workerConnected": "Your worker _%WORKER_NAME%_ for address _%MINER%_ is now connected from ip _%IP%_.",
            "workerTimeout": "Your worker _%WORKER_NAME%_ for address _%MINER%_ has stopped submitting hashes on _%LAST_HASH%_.",
            "workerBanned": "Your worker _%WORKER_NAME%_ for address _%MINER%_ has been banned.",
            "blockFound": "*Block found at height* _%HEIGHT%_ *by miner* _%MINER%_*! Waiting maturity.*",
            "blockUnlocked": "*Block mined at height* _%HEIGHT%_ *with* _%REWARD%_ *and* _%EFFORT%_ *effort on* _%TIME%_*.*",
            "blockOrphaned": "*Block orphaned at height* _%HEIGHT%_ *:(*",
            "payment": "A payment of _%AMOUNT%_ has been sent."
        }
    },

    /* Email Notifications */
    "email": {
        "enabled": false, // Activate and deactivate plugin
        "fromAddress": "your@email.com", // Your sender email
        "transport": "sendmail", // The transport mode (sendmail, smtp or mailgun)
        
        // Configuration for sendmail transport
        // Documentation: http://nodemailer.com/transports/sendmail/
        "sendmail": {
            "path": "/usr/sbin/sendmail" // The path to sendmail command
        },

        // Configuration for SMTP transport
        // Documentation: http://nodemailer.com/smtp/
        "smtp": {
            "host": "smtp.example.com", // SMTP server
            "port": 587, // SMTP port (25, 587 or 465)
            "secure": false, // TLS (if false will upgrade with STARTTLS)
            "auth": {
                "user": "username", // SMTP username
                "pass": "password" // SMTP password
            },
            "tls": {
                "rejectUnauthorized": false // Reject unauthorized TLS/SSL certificate
            }
        },

        // Configuration for MailGun transport
        "mailgun": {
            "key": "your-private-key", // Your MailGun Private API key
            "domain": "mg.yourdomain" // Your MailGun domain
        }
    },

    /* Discord channel notifications */
    "discord": {
        "enabled": false, // Enable or Disable the bot
        "token": "", // The bot unique authorization token
        "channel": "" // The telegram channel id 
    },

    /* Telegram channel notifications.
    See Telegram documentation to setup your bot: https://core.telegram.org/
    bots#3-how-do-i-create-a-bot */
    "telegram": {
        "enabled": false, // Enable or Disable the bot
        "botName": "", // The bot user name.
        "token": "", // The bot unique authorization token
        "channel": "", // The telegram channel id 
        "channelStats": {
            "enabled": false, // Enable periodical updater of pool statistics in telegram channel
            "interval": 30 // Periodical update interval (in minutes)
        },
        "botCommands": { // Set the telegram bot commands
            "stats": "/stats", // Pool statistics
            "report": "/report", // Enable and disable reports
            "notify": "/notify", // Enable and disable telegram notifications
            "blocks": "/blocks"  // Enable and disable warning of new mined block
        }
    },

    /* Monitoring RPC services. Statistics will be displayed in Admin panel */
    "monitoring": {
        "daemon": {
            "checkInterval": 60, // Interval of sending rpcMethod request
            "rpcMethod": "getblockcount" // RPC method name 
        },
        "wallet": {
            "checkInterval": 60, // Interval of sending rpcMethod request
            "rpcMethod": "getBalance" // RPC method name
        }
    },

    /* Collect pool statistics to display in frontend charts  */
    "charts": {
        "pool": {
            "hashrate": {
                "enabled": true, // Enable data collection and chart displaying in frontend
                "updateInterval": 60, // How often to get current value
                "stepInterval": 1800, // Chart step interval calculated as average of all updated values
                "maximumPeriod": 86400 // Chart maximum periods (chart points number = maximumPeriod / stepInterval = 48)
            },
            "workers": {
                "enabled": true, // Enable data collection and chart displaying in frontend
                "updateInterval": 60, // How often to get current value
                "stepInterval": 1800, // Chart step interval calculated as average of all updated values
                "maximumPeriod": 86400 // Chart maximum periods 
            },
            "difficulty": {
                "enabled": true, // Enable data collection and chart displaying in frontend
                "updateInterval": 1800, // How often to get current value
                "stepInterval": 10800, // Chart step interval calculated as average of all updated values
                "maximumPeriod": 604800 // Chart maximum periods 
            },
	        "miners": {
                "enabled": true, // Enable data collection and chart displaying in frontend
                "updateInterval": 60, // How often to get current value
                "stepInterval": 1800, // Chart step interval calculated as average of all updated values
                "maximumPeriod": 8640 // Chart maximum periods 
            }
        },
        "user": { // Chart data displayed in user stats block
            "hashrate": {
                "enabled": true, // Enable data collection and chart displaying in frontend
                "updateInterval": 180, // How often to get current value
                "stepInterval": 1800, // Chart step interval calculated as average of all updated values
                "maximumPeriod": 86400 // Chart maximum periods 
            },
            "worker_hashrate": {
                "enabled": true, // Enable data collection and chart displaying in frontend
                "updateInterval": 60, // How often to get current value
                "stepInterval": 60, // Chart step interval calculated as average of all updated values
                "maximumPeriod": 86400 // Chart maximum periods 
            },
            "payments": {  // Payment chart uses all user payments data stored in DB
                "enabled": true // Enable data collection and chart displaying in frontend
            }
        },
        "blocks": {
            "enabled": true, // Enable data collection and chart displaying in frontend
            "days": 30 // Number of days displayed in chart (if value is 1, display last 24 hours)
        }
    }
}


```

#### 3) Start the pool

```bash
node init.js
```

The file `config.json` is used by default but a file can be specified using the `-config=file` command argument, for example:

```bash
node init.js -config=config_backup.json
```

This software contains four distinct modules:
* `pool` - Which opens ports for miners to connect and processes shares
* `api` - Used by the website to display network, pool and miners' data
* `unlocker` - Processes block candidates and increases miners' balances when blocks are unlocked
* `payments` - Sends out payments to miners according to their balances stored in redis
* `chartsDataCollector` - Processes miners and workers hashrate stats and charts
* `telegramBot`	- Processes telegram bot commands


By default, running the `init.js` script will start up all four modules. You can optionally have the script start only start a specific module by using the `-module=name` command argument, for example:

```bash
node init.js -module=api
```

[Example screenshot](http://i.imgur.com/SEgrI3b.png) of running the pool in single module mode with tmux.

To keep your pool up, on operating system with systemd, you can create add your pool software as a service.  
Use this [example](https://github.com/ZentCashFoundation/cryptonote-nodejs-pool/blob/master/deployment/linux-automation/coins-standard-api/coin-pool.service) to create the systemd service `/lib/systemd/system/coin-pool.service`
Then enable and start the service with the following commands : 

```
sudo systemctl enable cryptonote-nodejs-pool.service
sudo systemctl start cryptonote-nodejs-pool.service
```

#### 4) Host the front-end

Simply host the contents of the `website_example` directory on file server capable of serving simple static files.


Edit the variables in the `website_example/config.js` file to use your pool's specific configuration.
Variable explanations:

```javascript

/*  Currency Name */
var parentCoin = "coin";

/* Must point to the API setup in your config.json file. */
var api = "http://poolhost:8117";

/* Contact email address. */
var email = "support@poolhost.com";

/* Pool Telegram URL. */
var telegram = "https://t.me/YourPool";

/* Pool Discord URL */
var discord = "https://discordapp.com/invite/YourPool";

/* Any custom CSS theme for pool frontend */
var themeCss = "themes/light.css";

/* Default language */
var defaultLang = 'en';

```

#### 5) Customize your website

The following files are included so that you can customize your pool website without having to make significant changes to `index.html` or other front-end files thus reducing the difficulty of merging updates with your own changes:
* `custom.css` for creating your own pool style
* `custom.js` for changing the functionality of your pool website


Then simply serve the files via nginx, Apache, Google Drive, or anything that can host static content.

#### SSL

You can configure the API to be accessible via SSL using various methods. Find an example for nginx below:

* Using SSL api in `config.json`:

By using this you will need to update your `api` variable in the `website_example/config.js`. For example:  
`var api = "https://poolhost:8119";`

* Inside your SSL Listener, add the following:

``` javascript
location ~ ^/api/(.*) {
    proxy_pass http://127.0.0.1:8117/$1$is_args$args;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

By adding this you will need to update your `api` variable in the `website_example/config.js` to include the /api. For example:  
`var api = "http://poolhost/api";`

You no longer need to include the port in the variable because of the proxy connection.

* Using his own subdomain, for example `api.poolhost.com`:

```bash
server {
    server_name api.poolhost.com
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    
    ssl_certificate /your/ssl/certificate;
    ssl_certificate_key /your/ssl/certificate_key;

    location / {
        more_set_headers 'Access-Control-Allow-Origin: *';
        proxy_pass http://127.0.01:8117;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}
```

By adding this you will need to update your `api` variable in the `website_example/config.js`. For example:  
`var api = "//api.poolhost.com";`

You no longer need to include the port in the variable because of the proxy connection.

#### Upgrading
When updating to the latest code its important to not only `git pull` the latest from this repo, but to also update the Node.js modules, and any config files that may have been changed.
* Inside your pool directory (where the init.js script is) do `git pull` to get the latest code.
* Remove the dependencies by deleting the `node_modules` directory with `rm -r node_modules`.
* Run `npm update` to force updating/reinstalling of the dependencies.
* Compare your `config.json` to the latest example ones in this repo or the ones in the setup instructions where each config field is explained. You may need to modify or add any new changes.

### JSON-RPC API Commands from CLI

Documentation for JSON-RPC commands can be found here:
* Daemon https://wiki.bytecoin.org/wiki/JSON_RPC_API
* Wallet https://wiki.bytecoin.org/wiki/Wallet_JSON_RPC_API


Curl can be used to use the JSON-RPC commands from command-line. Here is an example of calling `getblockheaderbyheight` for block 100:

```bash
curl 127.0.0.1:18081/json_rpc -d '{"method":"getblockheaderbyheight","params":{"height":100}}'
```

### JSON-RPC Restful API Commands from CLI (Zent Cash, Cirquity, Bitcoin Nova, Turtlecoin...)

* 1- Run daemon with enable-blockexplorer command
```bash
./Zentd --enable-blockexplorer 
```
* 2- Run the wallet-api with coinbase transaction  
```bash
./wallet-api --scan-coinbase-transactions  --rpc-password yourRpcPasssword (Not wallet password)  
```
* 3-Open the wallet with Curl command 
```bash
curl -X POST "http://127.0.0.1:21699/wallet/open" -H "accept: application/json" -H "X-API-KEY: yourRpcPasssword" -H "Content-Type: application/json" -d "{ \"daemonHost\": \"127.0.0.1\", \"daemonPort\": 21698, \"filename\": \"/your/wallet/file/address/name.wallet\", \"password\": \"YourWalletPassword\"}"
```

### Monitoring Your Pool

* To inspect and make changes to redis I suggest using [redis-commander](https://github.com/joeferner/redis-commander)
* To monitor server load for CPU, Network, IO, etc - I suggest using [Netdata](https://github.com/firehol/netdata)
* To keep your pool node script running in background, logging to file, and automatically restarting if it crashes - I suggest using [forever](https://github.com/nodejitsu/forever) or [PM2](https://github.com/Unitech/pm2)

Community / Support
===

* [GitHub Issues](https://github.com/ZentCashFoundation/cryptonote-nodejs-pool/issues)

#### Pools Using This Software

* https://superblockchain.con-ip.com/ztc/
* https://pool.leviar.io/
* https://pool.croat.community/

Donations
---------

Thanks for supporting my works on this project! If you want to make a donation to [SuperBlockchain-Pool](https://github.com/ZentCashFoundation/cryptonote-nodejs-pool/), the developper of this project, you can send any amount of your choice to one of theses addresses:

* Bitcoin (BTC): `17qFGHhPWLQrGsd9k8BUGNdFerJKijaJCa`
* Bitcoin Cash (BCH): `qq7jengltv0f3rg9qg6llyr2pf4373449ccfgvk33d`
* Dash (DASH): `XjTYnPDckSzJxraNc9HAN6zduzetfbehF4`
* Ethereum (ETH): `0xECcDf9E1aB9c9B6Bcbd24Dda4B1638507ee6f7D3`
* Litecoin (LTC): `LYX2vPD1HDRYPxeLfVUZCq4FUmnKd8d9g1`

Credits
---------

* [fancoder](//github.com/fancoder) - Developper on cryptonote-universal-pool project from which current project is forked.
* [dvandal](//github.com/dvandal) - Developer of cryptonote-nodejs-pool software
* [SuperBlockchain-Pool](//github.com/SuperBlockchain-Pool) - Responsible for the cryptonote-nodejs-pool software for Zent Cash
