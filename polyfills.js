// Node 21+ removed SlowBuffer; jsonwebtoken → jwa → buffer-equal-constant-time still needs it.
const buffer = require('buffer');
if (typeof buffer.SlowBuffer === 'undefined') {
  buffer.SlowBuffer = buffer.Buffer;
}
