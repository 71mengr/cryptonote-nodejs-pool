var parentCoin = "TKM";

var api = "https://api.tkmchain.site";
var replaceLoopbackApiHost = true;

function isLoopbackApiHost(hostname) {
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1" || hostname === "[::1]";
}

function normalizeApiEndpoint(endpoint) {
    if (!replaceLoopbackApiHost || typeof window === "undefined" || !window.location.hostname || isLoopbackApiHost(window.location.hostname)) {
        return endpoint;
    }

    var endpointUrl = document.createElement("a");
    endpointUrl.href = endpoint;

    if (!isLoopbackApiHost(endpointUrl.hostname)) {
        return endpoint;
    }

    endpointUrl.hostname = window.location.hostname;
    return endpointUrl.protocol + "//" + endpointUrl.host + endpointUrl.pathname.replace(/\/$/, "");
}

api = normalizeApiEndpoint(api);

var poolHost = "pool.tkmchain.site";

var email = "support@tkmchain.site";
var telegram = "https://t.me/TKM";
var discord = "https://discord.gg/TKM";

var marketCurrencies = ["{symbol}-BTC", "{symbol}-USD", "{symbol}-EUR", "{symbol}-CAD"];

var blockchainExplorer = "https://explorer.tkmchain.site/{symbol}/block/{id}";
var transactionExplorer = "https://explorer.tkmchain.site/{symbol}/transaction/{id}";

var themeCss = "themes/default.css";
var defaultLang = "en";

// Merged Mining:
// var api = "http://poolhost/apiMerged";
// var blockchainExplorer = "http://explorer.ird.cash/?hash={id}#block";
// var transactionExplorer = "http://explorer.ird.cash/?hash={id}#transaction";
