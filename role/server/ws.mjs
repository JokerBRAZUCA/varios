// WebSocket mínimo (RFC 6455) para o servidor do Rolê, sem dependências.
// Só texto, sem extensões; quadros do cliente precisam vir mascarados.
import crypto from 'node:crypto';
import {EventEmitter} from 'node:events';

const GUID='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function acceptUpgrade(req,socket,{maxPayload=4096,origins=null}={}){
  const key=req.headers['sec-websocket-key'];
  const ok=String(req.headers.upgrade||'').toLowerCase()==='websocket'&&req.headers['sec-websocket-version']==='13'&&
    typeof key==='string'&&Buffer.from(key,'base64').length===16;
  const origin=req.headers.origin;
  if(!ok||(origins&&origin&&!origins.includes(origin))){
    socket.end(`HTTP/1.1 ${ok?403:400} ${ok?'Forbidden':'Bad Request'}\r\nConnection: close\r\n\r\n`);
    return null;
  }
  const accept=crypto.createHash('sha1').update(key+GUID).digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  socket.setNoDelay(true);
  return new WS(socket,maxPayload);
}

export class WS extends EventEmitter{
  constructor(socket,maxPayload){
    super();
    this.socket=socket;this.max=maxPayload;this.buf=Buffer.alloc(0);this.frag=null;this.closed=false;this.lastSeen=Date.now();
    socket.on('data',c=>this.#data(c));
    socket.on('close',()=>this.#gone());
    socket.on('error',()=>this.#gone());
  }
  get buffered(){return this.socket.writableLength}
  #data(chunk){
    this.lastSeen=Date.now();
    this.buf=this.buf.length?Buffer.concat([this.buf,chunk]):chunk;
    while(!this.closed){
      const b=this.buf;if(b.length<2)return;
      const fin=b[0]&0x80,op=b[0]&0x0f,masked=b[1]&0x80;let len=b[1]&0x7f,off=2;
      if(b[0]&0x70||!masked)return this.close(1002);
      if(len===126){if(b.length<4)return;len=b.readUInt16BE(2);off=4}
      else if(len===127){if(b.length<10)return;if(b.readUInt32BE(2)!==0)return this.close(1009);len=b.readUInt32BE(6);off=10}
      if(len>this.max)return this.close(1009);
      if(b.length<off+4+len)return;
      const mask=b.subarray(off,off+4),data=Buffer.from(b.subarray(off+4,off+4+len));
      for(let i=0;i<data.length;i++)data[i]^=mask[i&3];
      this.buf=b.subarray(off+4+len);
      if(op>=8){
        if(!fin||len>125)return this.close(1002);
        if(op===8){this.close(1000);return}
        if(op===9)this.#frame(10,data);
        continue;
      }
      if(op===0){
        if(!this.frag)return this.close(1002);
        this.frag.parts.push(data);this.frag.size+=len;
        if(this.frag.size>this.max)return this.close(1009);
        if(fin){const f=this.frag;this.frag=null;this.#message(f.op,Buffer.concat(f.parts))}
      }else if(op===1||op===2){
        if(this.frag)return this.close(1002);
        if(fin)this.#message(op,data);else this.frag={op,parts:[data],size:len};
      }else return this.close(1002);
    }
  }
  #message(op,data){
    if(op!==1)return this.close(1003);
    this.emit('message',data.toString('utf8'));
  }
  #frame(op,data){
    if(this.closed&&op!==8)return;
    const len=data.length;let h;
    if(len<126){h=Buffer.alloc(2);h[1]=len}
    else if(len<65536){h=Buffer.alloc(4);h[1]=126;h.writeUInt16BE(len,2)}
    else{h=Buffer.alloc(10);h[1]=127;h.writeUInt32BE(0,2);h.writeUInt32BE(len,6)}
    h[0]=0x80|op;
    try{this.socket.write(Buffer.concat([h,data]))}catch{this.#gone()}
  }
  send(text){if(!this.closed)this.#frame(1,Buffer.from(text))}
  ping(){if(!this.closed)this.#frame(9,Buffer.alloc(0))}
  close(code=1000){
    if(this.closed)return;
    const d=Buffer.alloc(2);d.writeUInt16BE(code);this.#frame(8,d);
    this.closed=true;this.socket.end();
    setTimeout(()=>this.socket.destroy(),1000).unref();
    this.emit('close',code);
  }
  terminate(){if(!this.closed){this.closed=true;this.emit('close',1006)}this.socket.destroy()}
  #gone(){if(!this.closed){this.closed=true;this.emit('close',1006)}}
}
