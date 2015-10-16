'use strict';

var http = require('http'),
    https = require('https'),
    fs = require('fs'),
    RpcEntity = require('./entity'),
    RpcErrors = require('./errors');

/**
 * JSON-RPC server
 * TODO: Implement batch requests
 * TODO: Implement SMD schema
 * @param logger
 * @constructor
 */
function RpcServer(logger)
{
    this.logger = logger || console;

    this.entities = {};
    this.endpoints = {};

    this.options = {};
    this.defaults = {
        handler: 80,
        https: false,
        key: null,
        cert: null,
        timeout: 60
    };
    this.server = null;
}

/**
 * Server initialization
 * @param options
 * @param cb
 */
RpcServer.prototype.init = function(options, cb)
{
    this.options = options || {};
    this.server = this.options.handler && (this.options.handler instanceof http.Server || this.options.handler instanceof https.Server) ? this.options.handler : this.createServer();

    this.server.on('request', this.handleRequest.bind(this));
    this.logger.info('JSON-RPC server: server established');
    (typeof cb == 'function') && cb();
};

/**
 * WebServer instantiate
 */
RpcServer.prototype.createServer = function()
{
    var server = this.options.https ? https.createServer({key: this.options.key, cert: this.options.cert}) : http.createServer(),
        handler = this.options.handler || this.defaults.handler;

    //detect port or unix-socket
    if(typeof handler == 'string' && /\/\w+/.test(handler)) {
        if(fs.existsSync(handler)) {
            try{
                fs.unlinkSync(handler);
            }
            catch(e){
                this.logger.error('JSON-RPC server: unix-socket unlink error, unix:' + handler, e.stack || e);
            }
        }
        server.listen(handler, this.shareUnixSocket.bind(this, handler));
    }
    else server.listen(handler);

    return server;
};

/**
 * Chmod unix-socket
 * @param unixSocket
 */
RpcServer.prototype.shareUnixSocket = function(unixSocket)
{
    try {
        this.logger.info('JSON-RPC server: bound unix-socket:', unixSocket);
        fs.chmodSync(unixSocket, '777');
    }
    catch(e){
        this.logger.error('JSON-RPC server: can\'t chmod unix-socket', unixSocket);
    }
};

/**
 * Register endpoint
 * @param endpoint
 * @param map
 */
RpcServer.prototype.register = function(endpoint, map)
{
    if(this.isValidMap(map)) {
        this.endpoints[endpoint] = map;
        this.logger.info('JSON-RPC server: registered endpoint:', endpoint);
    }
    else this.logger.warn('JSON-RPC server: invalid endpoint schema:', endpoint, '=>', map);
};

/**
 * Unload endpoint
 * @param endpoint
 */
RpcServer.prototype.unload = function(endpoint)
{
    delete this.endpoints[endpoint];
    this.logger.info('JSON-RPC server: unloaded endpoint:', endpoint);
};

/**
 * Validate methods map
 * @param map = {
 *      context: <object>,
 *      map: {
 *          methodName1: {
 *              handler: <functionName|callable>,
 *              params: {
 *                  param1: {
 *                      type: "string|number|boolean|object|array|any",
 *                      required: true|false,
 *                      default: <defaultValue>
 *                  },
 *              ...
 *              }
 *              //-- or --
 *              params: [
 *                  {
 *                      type: "string|number|boolean|object|array|any",
 *                      required: true|false,
 *                      default: <defaultValue>
 *                  },
 *              ...
 *              ]
 *          },
 *          ...
 *      }
 * }
 * @returns {boolean}
 */
RpcServer.prototype.isValidMap = function(map)
{
    return !!(map && typeof map == 'object' && map.context && map.map); //todo: deep check of structure
};

/**
 * Handle requests
 * @param request
 * @param response
 */
RpcServer.prototype.handleRequest = function(request, response)
{
    var uuid = this.generateUuid();
    this.entities[uuid] = new RpcEntity(this.logger, request, response, this.options.timeout || this.defaults.timeout, this.cleanup.bind(this, uuid));
    this.entities[uuid].on('ready', this.checkRequest.bind(this, uuid));
};

/**
 * Step-by-step check request
 * @param uuid
 */
RpcServer.prototype.checkRequest = function(uuid)
{
    var error = null,
        isNotification = false,
        request = this.entities[uuid] && this.entities[uuid].getRequest();

    //check the entity
    if(!request) error = RpcErrors.E_INTERNAL_ERROR_32603;
    //check the HTTP method
    else if(request.method != 'POST') error = RpcErrors.E_DISALLOWED_REQUEST_METHOD;
    //check Content-Type
    else if(['application/json-rpc', 'application/json', 'application/jsonrequest'].indexOf(request.rawHeaders['content-type']) == -1) error = RpcErrors.E_INVALID_CONTENT_TYPE_32003;
    //check the parse error
    else if(typeof request.content == 'undefined') error = RpcErrors.E_PARSE_ERROR_32700;
    //check the batch request
    //TODO: remove, when the batch requests would implemented
    else if(request.isBatch) error = RpcErrors.E_NO_BATCH_32002;
    //check fields
    else if(! (request.content.hasOwnProperty('jsonrpc') && (request.content.jsonrpc == '2.0') && request.content.hasOwnProperty('method') && (typeof request.content.method == 'string'))) error = RpcErrors.E_INVALID_REQUEST_32600;
    else if(request.content.hasOwnProperty('id') && !((typeof request.content.id == 'string') || (typeof request.content.id == 'number') || ((typeof request.content.id == 'object') && !request.content.id))) error = RpcErrors.E_INVALID_REQUEST_32600;
    //check the endpoint
    else if(! (request.url.path in this.endpoints)) error = RpcErrors.E_UNKNOWN_ENDPOINT_32001;
    //check the method
    else if(! (request.content.method in this.endpoints[request.url.path].map)) error = RpcErrors.E_METHOD_NOT_FOUND_32601;
    //check params
    else if(!this.checkParams(request.url.path, request.content.method, request.content.params)) error = RpcErrors.E_INVALID_PARAMS_32602;

    //if notification
    if(request.content && !request.content.hasOwnProperty('id')) isNotification = true;

    if(!error) this.callMethod(uuid, request.url.path, request.content.method, request.content.params);
    if(error || isNotification) this.processResponse(uuid, error);
};

/**
 * Check the params
 * @param endpoint
 * @param method
 * @param params
 * @returns {boolean}
 */
RpcServer.prototype.checkParams = function(endpoint, method, params)
{
    if(! (this.endpoints[endpoint] && this.endpoints[endpoint].map[method])) return false;

    var schema = this.endpoints[endpoint].map[method].params,
        schemaType = this.getArgType(schema),
        paramsType = this.getArgType(params);

    return !!(
        (paramsType == schemaType) &&                               //equal types
        (
            (paramsType == 'null') ||                               //may be omitted
            (
                (['array', 'object'].indexOf(paramsType) > -1) &&   //must be the structure if exists
                !!this.prepareParams(endpoint, method, params)      //iterate and check params, null if failed
            )
        )
    );
};

/**
 * Prepare the params,
 * @param endpoint
 * @param method
 * @param params
 * @returns {*}
 */
RpcServer.prototype.prepareParams = function(endpoint, method, params)
{
    if(! (this.endpoints[endpoint] && this.endpoints[endpoint].map[method])) return null;

    var schema = this.endpoints[endpoint].map[method].params,
        schemaType = this.getArgType(schema),
        readyParams = null;

    //set readyParams type
    switch (schemaType) {
        case 'array':
            readyParams = [];
            break;

        case 'object':
            readyParams = {};
            break;

        default:
            return null;
    }

    //iterate the schema
    for(var i in schema) {
        if(schema.hasOwnProperty(i)) {
            if(params.hasOwnProperty(i)){ //todo: may be incorrect to use hasOwnProperty with arrays?
                if((schema[i].type != 'any') && (schema[i].type != this.getArgType(params[i]))) return null;
                readyParams[i] = params[i];
            }
            else {
                if(schema[i].required) return null;
                else readyParams[i] = schema[i].default;
            }
        }
    }

    return readyParams;
};

/**
 * Define arg type
 * @param arg
 * @returns {'string'|'number'|'boolean'|'array'|'object'|'null'}
 */
RpcServer.prototype.getArgType = function(arg)
{
    var argType = typeof arg;
    if(['string', 'number', 'boolean'].indexOf(argType) > -1) return argType;
    if(arg && argType == 'object') {
        return Array.isArray(arg) ? 'array' : 'object';
    }
    return 'null';
};

/**
 * UUID generator, check unique
 * @returns {string}
 */
RpcServer.prototype.generateUuid = function()
{
    var uuid = [this._getQ(), this._getQ(), '-', this._getQ(), '-', this._getQ(), '-', this._getQ(), '-', this._getQ(), this._getQ(), this._getQ()].join('');
    if(this.entities.hasOwnProperty(uuid)) return this.generateUuid();
    else return uuid;
};

/**
 * Generate quartet
 * @returns {string}
 * @private
 */
RpcServer.prototype._getQ = function()
{
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
};

/**
 * Cleanup callback
 * @param uuid
 */
RpcServer.prototype.cleanup = function(uuid)
{
    delete this.entities[uuid];
};

/**
 * Call the API method
 * Method signature: function(params, cb, rawRequest, batchIndex?) { ... }
 * @param uuid
 * @param endpoint
 * @param method
 * @param params
 */
RpcServer.prototype.callMethod = function(uuid, endpoint, method, params)
{
    var context = this.endpoints[endpoint] && this.endpoints[endpoint].context,
        handler = this.endpoints[endpoint] && this.endpoints[endpoint].map[method] && this.endpoints[endpoint].map[method].handler;

    if(!this.entities[uuid]) this.logger.warn('JSON-RPC server: unknown consumer');
    else {
        if(context && (typeof context == 'object')) {
            var callback = null;
            if((typeof handler == 'string') && (typeof context[handler] == 'function')) callback = context[handler];
            else if(typeof handler == 'function') callback = handler;

            if(!callback) this.logger.error('JSON-RPC server: not implemented method, endpoint:', endpoint, 'method:', method);
            else {
                //call the API method
                callback.apply(context, [
                    this.prepareParams(endpoint, method, params),
                    this.entities[uuid].processResponse.bind(this.entities[uuid]),
                    this.entities[uuid].getRequest(),
                    0 //todo: change it when batch requests would implemented
                ]);
            }
        }
        else this.logger.error('JSON-RPC server: possible incorrect or non-instantiate context, endpoint:', endpoint);
    }
};

/**
 * Format and output response
 * @param uuid
 * @param error
 * @param data
 */
RpcServer.prototype.processResponse = function(uuid, error, data)
{
    if(this.entities[uuid]) this.entities[uuid].processResponse(error, data);
    else this.logger.warn('JSON-RPC server: unknown consumer');
};

module.exports = RpcServer;