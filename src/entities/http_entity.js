'use strict';

var http = require('http'),
    url = require('url'),
    util = require('util'),
    EventEmitter = require('events').EventEmitter,
    RpcErrors = require('./../errors');

/**
 * Improving request entity
 * @param logger
 * @param request
 * @param response
 * @param timeout
 * @param cleaner
 * @constructor
 */
function HttpEntity(logger, request, response, timeout, cleaner)
{
    this.raw = [];
    this.data = {};

    this.logger = logger;
    this.request = request;
    this.response = response;
    this.timeout = timeout;
    this.cleaner = cleaner;

    if(this.validate()) {
        this.request.on('data', this.onChunk.bind(this));
        this.request.on('end', this.parseRequestData.bind(this));

        this.response.setTimeout((this.timeout || 60) * 1000, this.entityTimeout.bind(this));

        this.response.on('close', this.destroy.bind(this));
        this.response.on('finish', this.destroy.bind(this));
    }
}

util.inherits(HttpEntity, EventEmitter);

/**
 * Validate params
 * @returns {boolean}
 */
HttpEntity.prototype.validate = function()
{
    if(! this.request instanceof http.IncomingMessage) this.request = null;
    if(! this.response instanceof http.ServerResponse) this.response = null;

    if(! (this.request && this.response)) {
        this.logger.warn('JSON-RPC entity: Invalid entity params');
        this.destroy();
    }

    return !!(this.request && this.response);
};

/**
 * On stream chunk callback
 * @param chunk
 */
HttpEntity.prototype.onChunk = function(chunk)
{
    this.raw.push(chunk);
};

/**
 * Parse request payload
 */
HttpEntity.prototype.parseRequestData = function()
{
    var content = undefined;
    try{
        content = JSON.parse(this.raw.join(''));
    }
    catch(e) {
        this.logger.warn('JSON-RPC entity: request parse error:', this.raw.join('') || '[empty request data]');
    }

    this.data = {
        method: this.request.method,
        rawHeaders: this.request.headers,
        rawData: this.data,
        content: content,
        requestId: content && content.id,
        isBatch: Array.isArray(content),
        url: url.parse(this.request.url, true)
    };

    this.emit('ready');
};

/**
 * Request getter
 * @returns {*}
 */
HttpEntity.prototype.getRequest = function()
{
    return this.data;
};

/**
 * Response getter
 * @returns {*}
 */
HttpEntity.prototype.getResponse = function()
{
    return this.response;
};

/**
 * Entity handle error
 */
HttpEntity.prototype.entityTimeout = function()
{
    this.logger.warn('JSON-RPC entity: Entity timed out:', this.data);
    this.processResponse(RpcErrors.E_TIMEOUT);
};

/**
 * Proceed response
 * @param error
 * @param data
 */
HttpEntity.prototype.processResponse = function(error, data)
{
    var httpCode = 200,
        response = undefined,
        errorField = null,
        errorData = null,
        idField = typeof this.data.requestId == 'undefined' ? null : this.data.requestId,
        headers = {"Content-Type": "application/json-rpc"};

    //Error
    if(error) {
        var errorKey = error.name;
        if(! (errorKey in RpcErrors)) {
            errorKey = 'E_SERVER_ERROR_32000';
            errorData = error;
        }
        httpCode = RpcErrors[errorKey].httpCode;
        errorField = RpcErrors[errorKey].response;
        if(errorData) errorField.data = errorData;

        if(errorKey == 'E_DISALLOWED_REQUEST_METHOD') headers['Allow'] = 'POST'; //TODO: allow the GET method when SMD would implemented
        if(errorField) {
            response = {
                jsonrpc: "2.0",
                error: errorField,
                id: idField
            };
        }
    }

    //Result
    else if(! (!idField && (typeof idField == 'object'))) { //idField != null
        response = {
            jsonrpc: "2.0",
            result: data,
            id: idField
        }
    }

    //Notification
    else httpCode = 204;

    //Send response
    this.sendResponse(httpCode, headers, response);

    this.destroy();
};

/**
 * Send response
 * @param httpCode
 * @param headers
 * @param payload
 */
HttpEntity.prototype.sendResponse = function(httpCode, headers, payload)
{
    this.getResponse().writeHead(httpCode, headers);
    this.getResponse().end(JSON.stringify(payload));
};

/**
 * Destroying of the entity
 */
HttpEntity.prototype.destroy = function()
{
    this.request = null;
    this.response = null;

    (typeof this.cleaner == 'function') && this.cleaner();

    this.cleaner = null;
};

module.exports = HttpEntity;