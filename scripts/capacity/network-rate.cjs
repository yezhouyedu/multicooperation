const { ssh, write } = require('./lib.cjs');
const raw=ssh(`python3 - <<'NETWORK_RATE'
import time,json
def read():
    return list(map(int,next(line.split()[1:] for line in open('/proc/net/dev') if line.strip().startswith('eth0:'))))
a=read(); start=time.monotonic(); time.sleep(10); b=read(); seconds=time.monotonic()-start
print(json.dumps(dict(seconds=seconds,rxMbps=(b[0]-a[0])*8/seconds/1e6,txMbps=(b[8]-a[8])*8/seconds/1e6)))
NETWORK_RATE
`,20000);
const result={at:new Date().toISOString(),...JSON.parse(raw)};
write('network-rate-'+Date.now()+'.json',result);console.log(JSON.stringify(result));
