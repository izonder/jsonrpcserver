/**
 * Specification:
 * http://www.jsonrpc.org/specification#error_object
 * http://www.jsonrpc.org/historical/json-rpc-over-http.html#errors
 */
module.exports = {
    "E_PARSE_ERROR_32700":          {httpCode: 500, response: {code: -32700, message: "Parse error"}, name: "E_PARSE_ERROR_32700"},
    "E_INVALID_REQUEST_32600":      {httpCode: 400, response: {code: -32600, message: "Invalid Request"}, name: "E_INVALID_REQUEST_32600"},
    "E_METHOD_NOT_FOUND_32601":     {httpCode: 404, response: {code: -32601, message: "Method not found"}, name: "E_METHOD_NOT_FOUND_32601"},
    "E_INVALID_PARAMS_32602":       {httpCode: 500, response: {code: -32602, message: "Invalid params"}, name: "E_INVALID_PARAMS_32602"},
    "E_INTERNAL_ERROR_32603":       {httpCode: 500, response: {code: -32603, message: "Internal error"}, name: "E_INTERNAL_ERROR_32603"},
    "E_SERVER_ERROR_32000":         {httpCode: 500, response: {code: -32000, message: "Server error"}, name: "E_SERVER_ERROR_32000"},
    "E_UNKNOWN_ENDPOINT_32001":     {httpCode: 500, response: {code: -32001, message: "Server error", data: "Unknown endpoint"}, name: "E_UNKNOWN_ENDPOINT_32001"},
    "E_NO_BATCH_32002":             {httpCode: 500, response: {code: -32002, message: "Server error", data: "Batch requests not implemented"}, name: "E_NO_BATCH_32002"}, //TODO: remove when batch would implemented
    "E_INVALID_CONTENT_TYPE_32003": {httpCode: 500, response: {code: -32003, message: "Server error", data: "Incorrect Content-Type"}, name: "E_INVALID_CONTENT_TYPE_32003"},

    "E_DISALLOWED_REQUEST_METHOD":  {httpCode: 405, response: null, name: "E_DISALLOWED_REQUEST_METHOD"},
    "E_TIMEOUT":                    {httpCode: 504, response: null, name: "E_TIMEOUT"}
};