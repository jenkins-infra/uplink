/*
 * Each acceptance test starts and stops its own server on the same port.
 * Since NodeJS 19 the global HTTP agent keeps connections alive, so a request
 * can be sent over a pooled socket which belongs to the server of the previous
 * test (being closed), and fail with "socket hang up".
 */
import http from 'http';
import https from 'https';

http.globalAgent = new http.Agent({ keepAlive: false });
https.globalAgent = new https.Agent({ keepAlive: false });
