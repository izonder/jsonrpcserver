# JSON-RPC Server

Simple-to-use JSON-RPC Server with endpoints implementation ([JSON-RPC Specification](http://www.jsonrpc.org/specification)).

# install

```
$ npm install jsonrpcserver --save
```

# how to use

```
var logger = require('mylogger'),
    API = require('myapi'),
    JsonRpcServer = require('jsonrpcserver');
    
var rpcServerInstance = new JsonRpcServer(logger); //logger is an optional one

...

rpcServerInstance.register('/my/new/endpoint', {
    "context": new API(),
    "map": {
        "testMethod": {
            "handler": "test",
            "params": [
                {
                    "type": "string",
                    "required": true
                }
            ]
        },
        "yetAnotherMethod": {
            "handler": function(options, cb) {
                (typeof cb == 'function') && cb(null, options);
            },
            "params": {
                "first": {
                    "type": "number",
                    "required": true
                },
                "second": {
                    "type": "any",
                    "required": false,
                    "default": "Foo"
                }
            }
        }
    }
});

...

rpcServerInstance.init({
    handler: 80,
    timeout: 10
});
```

# api

## `constructor (logger)` - create the server

* `logger` - an optional parameter, it means reference to the logger instance; console will use by default

## `register (endpoint, map)` - register endpoint

You can use `register` method (as well as `unload`) at any time in code, definition order (before or after `init`) doesn't matter.

* `endpoint` - <string> - endpoint URI, that will handle your requests
* `map` - <object> - API schema map, such as (type `'any'` could use for non-strict type validation):

```
/**
 * @param map = {
 *      context: <object>,
 *      map: {
 *          methodName1: {
 *              handler: <functionName|callable>,
 *              //-- with named params ---
 *              params: {
 *                  param1: {
 *                      type: "string|number|boolean|object|array|any",
 *                      required: true|false,
 *                      default: <defaultValue>
 *                  },
 *              ...
 *              }
 *              //-- or with array-like params --
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
 */
```

## `unload (endpoint)` - unload the endpoint

* `endpoint` - <string> - endpoint URI that would be unloaded 

## `init (configuration)` - instantiate the server

* `configuration` - <object> - an optional parameter, that describe server configuration (look below, with defaults):

```
{
    "handler": 80,  // it may be port, unix-socket path or instance of HTTP/HTTPS server, by default 80 port
    "https": false, // boolean flag sets true if we want set up the HTTPS server
    "key": null,    // the SSL-key path (for HTTPS only)
    "cert": null,   // the SSL-cert path (for HTTPS only)
    "timeout": 60   // the request timeout in sec, by default 60
}
```

# todo

Not-implemented features:
* batch requests support
* getting SMD-schema

# license

MIT

