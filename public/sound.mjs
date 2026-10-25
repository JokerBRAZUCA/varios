export class UpdateSound {
 constructor(play=()=>{}) {this.play=play;this.revisions={};this.initialized=false;this.enabled=false;}
 observe(revisions) {const entries=Object.entries(revisions).filter(([,v])=>v);const changed=this.initialized&&entries.some(([key,value])=>this.revisions[key]&&this.revisions[key]!==value);for(const [key,value]of entries)this.revisions[key]=value;this.initialized=entries.length>0||this.initialized;if(changed&&this.enabled)this.play();return changed;}
}
export function confirmationTone(context) {
 if(context.state!=='running')return;
 const start=context.currentTime;
 for(let i=0;i<5;i++) {const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=i%2?1568:1318;const t=start+i*.055;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.055,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+.053);oscillator.connect(gain);gain.connect(context.destination);oscillator.start(t);oscillator.stop(t+.055);}
}
