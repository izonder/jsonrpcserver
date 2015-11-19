var assert = require('assert'),
    jsonRpcServer = new (require('./../index'))(),
    map = {
        context: {},
        map: {
            test: {
                handler: function(params, cb) {
                    cb(null, params);
                },
                params: {
                    foo: {
                        type: "string",
                        required: true
                    },
                    bar: {
                        type: "any",
                        required: false,
                        default: 'baz'
                    }
                }
            }
        }
    },
    testCases = [
        {
            title: 'Basic test',
            endpoint: '/myendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'test',
                params: { foo: 'bar', bar: 1 },
                id: 1
            },
            expected: {
                httpCode: 200,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    result: {
                        foo: 'bar',
                        bar: 1
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Incorrect endpoint',
            endpoint: '/anotherendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'test',
                params: { foo: 'bar' },
                id: 1
            },
            expected: {
                httpCode: 500,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32001,
                        message: 'Server error',
                        data: 'Unknown endpoint'
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Unknown method',
            endpoint: '/myendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'oops',
                params: { foo: 'bar' },
                id: 1
            },
            expected: {
                httpCode: 404,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32601,
                        message: 'Method not found'
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Incorrect request',
            endpoint: '/myendpoint',
            payload: {
                params: { foo: 'bar' },
                id: 1
            },
            expected: {
                httpCode: 400,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32600,
                        message: 'Invalid request'
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Notification request',
            endpoint: '/myendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'test',
                params: { foo: 'bar' }
            },
            expected: {
                httpCode: 204,
                headers: { 'Content-Type': 'application/json-rpc' }
            }
        },
        {
            title: 'Invalid params',
            endpoint: '/myendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'test',
                params: { Foo: 'bar' },
                id: 1
            },
            expected: {
                httpCode: 500,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32602,
                        message: 'Invalid params'
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Default param value',
            endpoint: '/myendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'test',
                params: { foo: 'bar' },
                id: 1
            },
            expected: {
                httpCode: 200,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    result: {
                        foo: 'bar',
                        bar: 'baz'
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Incorrect param type',
            endpoint: '/myendpoint',
            payload: {
                jsonrpc: '2.0',
                method: 'test',
                params: { foo: 123 },
                id: 1
            },
            expected: {
                httpCode: 500,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32602,
                        message: 'Invalid params'
                    },
                    id: 1
                }
            }
        },
        {
            title: 'Batch request',
            endpoint: '/myendpoint',
            payload: [
                {
                    jsonrpc: '2.0',
                    method: 'test',
                    params: { foo: 123 },
                    id: 1
                }
            ],
            expected: {
                httpCode: 500,
                headers: { 'Content-Type': 'application/json-rpc' },
                payload: {
                    jsonrpc: '2.0',
                    error: {
                        code: -32002,
                        message: 'Server error',
                        data: 'Batch requests not implemented'
                    },
                    id: null //now for all batch request
                }
            }
        }
    ];

jsonRpcServer.register('/myendpoint', map);

for(var i in testCases) {
    if(testCases.hasOwnProperty(i)){
        var test = testCases[i];
        jsonRpcServer.proxy(test.endpoint, test.payload, function(test, response){
            assert.deepStrictEqual(response, test.expected, test.title);
            console.log([Date.now(), ' - ', test.title, ' - OK!'].join(''));
        }.bind({}, test));
    }
}

