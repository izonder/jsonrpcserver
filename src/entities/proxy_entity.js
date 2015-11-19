'use strict';

var util = require('util'),
    HttpEntity = require('./http_entity');

/**
 * Improving proxy entity
 * @param logger
 * @param requestObject
 * @param customCallback
 * @param timeout
 * @param cleaner
 * @constructor
 */
function ProxyEntity(logger, requestObject, customCallback, timeout, cleaner)
{
    this.data = {};

    this.logger = logger;
    this.request = requestObject;
    this.response = customCallback;
    this.timeout = timeout;
    this.timeoutHandler = null;
    this.cleaner = cleaner;

    if(this.validate()) {
        this.timeoutHandler = setTimeout((this.timeout || 60) * 1000, this.entityTimeout.bind(this));
        this.parseRequestData();
    }
}

util.inherits(ProxyEntity, HttpEntity);

/**
 * Validate params
 * @returns {boolean}
 */
ProxyEntity.prototype.validate = function()
{
    if(this.request && typeof this.request != 'object') this.request = null;
    if(typeof this.response != 'function') this.response = null;

    if(! (this.request && this.response)) {
        this.logger.warn('JSON-RPC entity: Invalid entity params');
        this.destroy();
    }

    return !!(this.request && this.response);
};

/**
 * Parse request payload
 */
ProxyEntity.prototype.parseRequestData = function()
{
    this.data = {
        method: this.request.method,
        rawHeaders: this.request.headers,
        rawData: this.request.payload,
        content: this.request.payload,
        requestId: this.request.payload.id, //TODO: would be not 'undefined' for batch requests
        isBatch: Array.isArray(this.request.payload),
        url: this.request.url
    };

    this.emit('ready');
};

/**
 * Send response
 * @param httpCode
 * @param headers
 * @param payload
 */
ProxyEntity.prototype.sendResponse = function(httpCode, headers, payload)
{
    clearTimeout(this.timeoutHandler);

    var response = {
        httpCode: httpCode,
        headers: headers,
        payload: payload
    };

    this.getResponse()(JSON.parse(JSON.stringify(response)));
};

module.exports = ProxyEntity;