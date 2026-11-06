// ---------- bird species: parametric renderer ----------
const TAU=Math.PI*2;
function cub(P,t){const u=1-t;return [u*u*u*P[0][0]+3*u*u*t*P[1][0]+3*u*t*t*P[2][0]+t*t*t*P[3][0],u*u*u*P[0][1]+3*u*u*t*P[1][1]+3*u*t*t*P[2][1]+t*t*t*P[3][1]];}
function tubePath(c,P,w0,w1,n=16){const A=[],B=[];
  for(let i=0;i<=n;i++){const t=i/n,p=cub(P,t),q=cub(P,Math.min(1,t+.01)),r=cub(P,Math.max(0,t-.01));let dx=q[0]-r[0],dy=q[1]-r[1];const d=Math.hypot(dx,dy)||1;dx/=d;dy/=d;
    const w=lerp(w0,w1,t)/2;A.push([p[0]-dy*w,p[1]+dx*w]);B.push([p[0]+dy*w,p[1]-dx*w]);}
  const poly=A.concat(B.reverse());let ar=0;for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length];ar+=p[0]*q[1]-q[0]*p[1];}
  if(ar>0)poly.reverse();c.moveTo(poly[0][0],poly[0][1]);for(const p of poly)c.lineTo(p[0],p[1]);c.closePath();}
function silhouette(c,sp){
  const b=sp.body,h=sp.head;
  c.moveTo(b.f,-b.t*.25);
  c.bezierCurveTo(b.f*.95,-b.t,b.f*.1,-b.t*1.08,-b.r*.35,-b.t*.95);
  c.bezierCurveTo(-b.r*.75,-b.t*.85,-b.r,-b.t*.35,-b.r,0);
  c.bezierCurveTo(-b.r*.85,b.u*.85,-b.r*.25,b.u*1.08,b.f*.15,b.u);
  c.bezierCurveTo(b.f*.75,b.u*.95,b.f*1.08,b.u*.35,b.f,-b.t*.25);c.closePath();
  const n=sp.neck;
  if(n&&n.pts)tubePath(c,n.pts,n.w0,n.w1);
  else{const x0=b.f*.45,y0=-b.t*.5,x1=h.x-h.r*.35,y1=h.y+h.r*.2,w=(n&&n.w)||h.r*1.75;
    tubePath(c,[[x0,y0],[lerp(x0,x1,.35),lerp(y0,y1,.35)],[lerp(x0,x1,.7),lerp(y0,y1,.7)],[x1,y1]],w*1.15,w);}
  c.moveTo(h.x+h.r,h.y);c.ellipse(h.x,h.y,h.r,h.r*(h.ry||1),h.rot||0,0,-TAU,true);
}
function paintPatch(c,p){
  c.save();const a=p.a==null?1:p.a;
  if(p.t==='e'){c.translate(p.x,p.y);c.rotate(p.r||0);c.scale(1,p.ry/p.rx);
    const g=c.createRadialGradient(0,0,0,0,0,p.rx);g.addColorStop(0,rgba(p.c,a));g.addColorStop(p.soft==null?.7:p.soft,rgba(p.c,a));g.addColorStop(1,rgba(p.c,0));
    c.fillStyle=g;c.fillRect(-p.rx,-p.rx,p.rx*2,p.rx*2);}
  else if(p.t==='s'){c.strokeStyle=rgba(p.c,a);c.lineWidth=p.w;c.lineCap='round';c.lineJoin='round';c.beginPath();const P=p.pts;c.moveTo(P[0][0],P[0][1]);
    if(P.length===3)c.quadraticCurveTo(P[1][0],P[1][1],P[2][0],P[2][1]);else for(const q of P.slice(1))c.lineTo(q[0],q[1]);c.stroke();}
  else if(p.t==='f')p.fn(c);
  c.restore();
}
function drawEyeSp(c,sp,dead){
  const e=sp.eye;
  if(e.skin){c.fillStyle=e.skin.c;c.beginPath();c.ellipse(e.x+(e.skin.dx||0),e.y+(e.skin.dy||0),e.skin.rx,e.skin.ry,0,0,TAU);c.fill();
    if(e.skin.lines){c.strokeStyle=e.skin.lines;c.lineWidth=.35;for(let i=0;i<4;i++){c.beginPath();c.arc(e.x+1,e.y+1.2,e.r+1.4+i*.9,1.9,3.1);c.stroke();}}}
  if(e.ring){c.fillStyle=e.ring;c.beginPath();c.arc(e.x,e.y,e.r+(e.rw||.6),0,TAU);c.fill();}
  else{c.fillStyle='rgba(30,18,8,.45)';c.beginPath();c.arc(e.x,e.y,e.r+.7,0,TAU);c.fill();}
  if(dead){c.strokeStyle='#120c08';c.lineWidth=Math.max(.7,e.r*.38);c.lineCap='round';c.beginPath();c.moveTo(e.x-e.r,e.y);c.quadraticCurveTo(e.x,e.y+e.r*.6,e.x+e.r,e.y);c.stroke();return;}
  if(e.iris){c.fillStyle=e.iris;c.beginPath();c.arc(e.x,e.y,e.r,0,TAU);c.fill();c.fillStyle='#070505';c.beginPath();c.arc(e.x+e.r*.12,e.y,e.r*(e.pupil||.55),0,TAU);c.fill();}
  else{const g=c.createRadialGradient(e.x-e.r*.25,e.y-e.r*.25,.2,e.x,e.y,e.r);g.addColorStop(0,'#3c2e24');g.addColorStop(1,'#050403');c.fillStyle=g;c.beginPath();c.arc(e.x,e.y,e.r,0,TAU);c.fill();}
  c.fillStyle='#fff';c.beginPath();c.arc(e.x+e.r*.35,e.y-e.r*.38,Math.max(.35,e.r*.32),0,TAU);c.fill();
  if(e.brow){c.fillStyle=e.brow;c.beginPath();c.moveTo(e.x-e.r*1.8,e.y-e.r*.9);c.quadraticCurveTo(e.x,e.y-e.r*1.9,e.x+e.r*2.2,e.y-e.r*.4);c.quadraticCurveTo(e.x,e.y-e.r*1.05,e.x-e.r*1.8,e.y-e.r*.9);c.fill();}
}
function beakGrad(c,x,y,d,top,bot){const g=c.createLinearGradient(0,y-d/2,0,y+d/2);g.addColorStop(0,mixRGB(top,'#ffffff',.18));g.addColorStop(.5,top);g.addColorStop(1,bot||dk(top,.7));return g;}
function drawBeakSp(c,sp){
  const k=sp.beak,x=k.x,y=k.y,L=k.len,d=k.d,cv=k.curve||0;c.lineJoin='round';
  if(k.t==='cone'||k.t==='dagger'){
    c.beginPath();c.moveTo(x-.6,y-d/2);c.quadraticCurveTo(x+L*.55,y-d*.42+cv*.25,x+L,y+cv);c.lineTo(x+L*.86,y+cv*.95+.15);c.lineTo(x,y+d*.04);c.closePath();
    c.fillStyle=beakGrad(c,x,y-d/4,d/2,k.up);c.fill();
    if(k.hook){c.beginPath();c.moveTo(x+L*.86,y+cv*.9);c.quadraticCurveTo(x+L+.6,y+cv+.2,x+L-.2,y+cv+k.hook);c.lineTo(x+L*.9,y+cv+.4);c.closePath();c.fillStyle=k.up;c.fill();}
    c.beginPath();c.moveTo(x,y+d*.04);c.lineTo(x+L*.86,y+cv*.95+.15);c.quadraticCurveTo(x+L*.45,y+d*.44+cv*.3,x-.6,y+d/2);c.closePath();c.fillStyle=beakGrad(c,x,y+d/4,d/2,k.lo);c.fill();
    if(k.spot){c.fillStyle=k.spot;c.beginPath();c.ellipse(x+L*.72,y+d*.22+cv*.5,1.1,.8,0,0,TAU);c.fill();}
    c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=.35;c.beginPath();c.moveTo(x,y+d*.04);c.lineTo(x+L*.86,y+cv*.95+.15);c.stroke();
    c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=.5;c.beginPath();c.moveTo(x+L*.08,y-d*.38);c.quadraticCurveTo(x+L*.5,y-d*.34+cv*.25,x+L*.85,y+cv*.6);c.stroke();
    if(k.cere){c.fillStyle=k.cere;c.beginPath();c.ellipse(x+1.3,y-d*.42,1.9,1.05,-.15,0,TAU);c.fill();}
  }else if(k.t==='slender'){
    c.beginPath();c.moveTo(x-.5,y-d/2);c.quadraticCurveTo(x+L*.55,y-d*.55+cv*.3,x+L,y+cv);c.quadraticCurveTo(x+L*.55,y+cv*.45+d*.2,x-.5,y+d/2);c.closePath();
    c.fillStyle=beakGrad(c,x,y,d,k.up);c.fill();c.strokeStyle='rgba(255,255,255,.35)';c.lineWidth=.4;c.beginPath();c.moveTo(x+1,y-d*.35);c.quadraticCurveTo(x+L*.5,y-d*.4+cv*.3,x+L*.92,y+cv*.85);c.stroke();
    c.strokeStyle='rgba(0,0,0,.4)';c.lineWidth=.3;c.beginPath();c.moveTo(x,y+d*.05);c.quadraticCurveTo(x+L*.5,y+cv*.4,x+L*.95,y+cv*.95);c.stroke();
  }else if(k.t==='hook'){
    const h=k.hook||2;
    c.beginPath();c.moveTo(x-.6,y-d/2);c.bezierCurveTo(x+L*.45,y-d*.62,x+L*.85,y-d*.38,x+L,y+d*.12);c.quadraticCurveTo(x+L+.3,y+d*.45+h,x+L-h*.55,y+d*.48+h*.75);
    c.quadraticCurveTo(x+L*.78,y+d*.15,x,y+d*.12);c.closePath();c.fillStyle=beakGrad(c,x,y-d*.1,d*.9,k.up);c.fill();
    c.beginPath();c.moveTo(x,y+d*.12);c.lineTo(x+L*.72,y+d*.22);c.quadraticCurveTo(x+L*.35,y+d*.56,x-.6,y+d/2);c.closePath();c.fillStyle=beakGrad(c,x,y+d*.3,d*.4,k.lo);c.fill();
    if(k.cere){c.fillStyle=k.cere;c.beginPath();c.moveTo(x-.6,y-d/2);c.quadraticCurveTo(x+L*.15,y-d*.6,x+L*.28,y-d*.5);c.lineTo(x+L*.24,y+d*.12);c.lineTo(x,y+d*.12);c.closePath();c.fill();
      c.fillStyle='rgba(0,0,0,.45)';c.beginPath();c.ellipse(x+L*.16,y-d*.16,.7,.45,0,0,TAU);c.fill();}
    c.strokeStyle='rgba(255,255,255,.4)';c.lineWidth=.5;c.beginPath();c.moveTo(x+L*.25,y-d*.48);c.bezierCurveTo(x+L*.55,y-d*.52,x+L*.85,y-d*.32,x+L*.96,y+d*.1);c.stroke();
    if(k.beard){c.strokeStyle=k.beard;c.lineWidth=.75;c.lineCap='round';for(let i=0;i<6;i++){c.beginPath();c.moveTo(x+.5+i*.7,y+d*.42);c.quadraticCurveTo(x+1.5+i*.9,y+d*.9+1.5,x+2.6+i*1.1,y+d*1.15+1.6+Math.sin(i)*.6);c.stroke();}}
  }else if(k.t==='parrot'){
    c.beginPath();c.moveTo(x-1,y-d*.5);c.bezierCurveTo(x+L*.6,y-d*.66,x+L*1.12,y-d*.18,x+L*.92,y+d*.48);c.quadraticCurveTo(x+L*.78,y+d*.18,x+L*.5,y+d*.1);c.lineTo(x-.5,y+d*.04);c.closePath();
    let g=c.createLinearGradient(x,y-d/2,x+L,y+d/2);g.addColorStop(0,k.base||k.up);g.addColorStop(.25,k.up);g.addColorStop(.8,mixRGB(k.up,'#c8bca8',.3));g.addColorStop(1,'#3a3430');c.fillStyle=g;c.fill();
    c.beginPath();c.moveTo(x-.5,y+d*.04);c.quadraticCurveTo(x+L*.45,y+d*.12,x+L*.58,y+d*.3);c.quadraticCurveTo(x+L*.3,y+d*.64,x-1,y+d*.52);c.closePath();c.fillStyle=k.lo;c.fill();
    c.strokeStyle='rgba(255,255,255,.45)';c.lineWidth=.55;c.beginPath();c.moveTo(x+L*.15,y-d*.48);c.bezierCurveTo(x+L*.55,y-d*.55,x+L*.95,y-d*.2,x+L*.92,y+d*.3);c.stroke();
  }else if(k.t==='toucan'){
    const up=new Path2D();up.moveTo(x-.6,y-d*.5);up.bezierCurveTo(x+L*.35,y-d*.8,x+L*.8,y-d*.52,x+L,y+d*.05);up.quadraticCurveTo(x+L*.96,y+d*.2,x+L*.86,y+d*.2);
    up.bezierCurveTo(x+L*.6,y+d*.02,x+L*.25,y+d*.12,x,y+d*.06);up.closePath();
    const lo=new Path2D();lo.moveTo(x,y+d*.06);lo.bezierCurveTo(x+L*.3,y+d*.14,x+L*.6,y+d*.06,x+L*.86,y+d*.2);lo.quadraticCurveTo(x+L*.5,y+d*.52,x-.6,y+d*.5);lo.closePath();
    for(const [pth,col] of [[lo,k.lo],[up,k.up]]){c.save();c.clip(pth);
      let g=c.createLinearGradient(x,0,x+L,0);g.addColorStop(0,mixRGB(col,'#ffe08a',.35));g.addColorStop(.6,col);g.addColorStop(1,dk(col,.82));c.fillStyle=g;c.fillRect(x-2,y-d,L+4,d*2);
      g=c.createLinearGradient(0,y-d*.6,0,y+d*.5);g.addColorStop(0,'rgba(255,255,255,.35)');g.addColorStop(.4,'rgba(255,255,255,0)');g.addColorStop(1,'rgba(0,0,0,.25)');c.fillStyle=g;c.fillRect(x-2,y-d,L+4,d*2);
      c.fillStyle=k.tip;c.beginPath();c.ellipse(x+L*.98,y+d*.05,L*.14,d*.85,0,0,TAU);c.fill();
      c.fillStyle=k.base;c.fillRect(x-1,y-d,1.6,d*2);c.restore();}
    c.strokeStyle='rgba(60,20,0,.5)';c.lineWidth=.45;c.beginPath();c.moveTo(x,y+d*.06);c.bezierCurveTo(x+L*.3,y+d*.14,x+L*.6,y+d*.06,x+L*.86,y+d*.2);c.stroke();
  }else if(k.t==='flamingo'){
    const pts=[[x-.5,y],[x+L*.42,y-d*.18],[x+L*.62,y+d*.1],[x+L*.7,y+L*.48]];
    const pth=new Path2D();tubePath(pth,pts,d,.9);c.save();c.clip(pth);
    let g=c.createLinearGradient(0,y-d,0,y+d);g.addColorStop(0,'#fbe3e6');g.addColorStop(1,k.up);c.fillStyle=g;c.fillRect(x-2,y-d*2,L*1.4,L);
    c.fillStyle=k.tip;c.beginPath();c.moveTo(x+L*.5,y-d*2);c.lineTo(x+L*1.2,y-d*2);c.lineTo(x+L*1.2,y+L);c.lineTo(x+L*.44,y+L);c.closePath();c.fill();
    c.strokeStyle='rgba(0,0,0,.35)';c.lineWidth=.4;c.beginPath();c.moveTo(pts[0][0],pts[0][1]+.3);c.bezierCurveTo(pts[1][0],pts[1][1]+.6,pts[2][0]-.4,pts[2][1]+.6,pts[3][0]-.4,pts[3][1]);c.stroke();c.restore();
  }
}
function drawTailSp(c,sp){
  const t=sp.tail;if(!t)return;c.save();c.translate(t.x,t.y);c.rotate(t.ang||.04);
  const n=t.n,mid=(n-1)/2,ord=[...Array(n).keys()].sort((a,b)=>Math.abs(b-mid)-Math.abs(a-mid));
  for(const i of ord){const o=mid?(i-mid)/mid:0;let L=t.len*(1-(t.fork||0)*(1-Math.abs(o))-(t.wedge||0)*Math.abs(o));if(t.streamer&&Math.abs(o)<.3)L+=t.streamer;
    c.save();c.rotate(o*t.spread);
    const g=c.createLinearGradient(0,0,-L,0);
    if(t.col2&&t.grad){g.addColorStop(0,t.col);g.addColorStop(t.band||.5,t.col);g.addColorStop(1,t.col2);}
    else if(t.col2){const b=t.band||.8;g.addColorStop(0,t.col);g.addColorStop(b*.96,dk(t.col,.85));g.addColorStop(b,t.col2);g.addColorStop(1,t.col2);}
    else{g.addColorStop(0,mixRGB(t.col,'#ffffff',.08));g.addColorStop(1,dk(t.col,.72));}
    featherPath(c,L,t.w);c.fillStyle=g;c.fill();
    if(t.bars){c.save();featherPath(c,L,t.w);c.clip();c.strokeStyle=rgba(t.bars,.85);c.lineWidth=.5;c.beginPath();for(let x=-4;x>-L*.82;x-=2.6){c.moveTo(x,-t.w);c.lineTo(x+.6,t.w);}c.stroke();c.restore();}
    c.strokeStyle='rgba(255,255,255,.2)';c.lineWidth=.45;featherPath(c,L,t.w);c.stroke();
    c.strokeStyle='rgba(0,0,0,.3)';c.lineWidth=.35;c.beginPath();c.moveTo(-1,0);c.lineTo(-L*.9,-.3);c.stroke();c.restore();}
  c.restore();
}
function drawLegsSp(c,sp){
  const L=sp.legs,b=sp.body;if(!L)return;c.lineCap='round';c.lineJoin='round';
  if(L.t==='tuck'){c.strokeStyle=L.col;c.lineWidth=1.5;c.beginPath();c.moveTo(-2,b.u*.85);c.lineTo(-7,b.u*1.1);c.lineTo(-10.5,b.u*1.05);c.moveTo(1,b.u*.9);c.lineTo(-3,b.u*1.15);c.lineTo(-6.5,b.u*1.16);c.stroke();}
  else if(L.t==='trail'){const y0=b.u*.65,n=L.len;
    for(const [ox,oy,a] of [[0,0,.75],[2.5,1.6,1]]){c.strokeStyle=a<1?dk(L.col,.8):L.col;c.lineWidth=1.9;c.beginPath();c.moveTo(-1+ox,y0+oy);c.lineTo(-n*.42+ox,y0+2.4+oy);c.lineTo(-n+ox,y0+1.2+oy);c.stroke();
      c.fillStyle=c.strokeStyle;c.beginPath();c.arc(-n*.42+ox,y0+2.4+oy,1.35,0,TAU);c.fill();
      c.lineWidth=.9;c.beginPath();for(const s of [-1.6,0,1.6]){c.moveTo(-n+ox,y0+1.2+oy);c.lineTo(-n-4+ox,y0+1.2+oy+s);}c.stroke();}}
  else if(L.t==='feet'){
    for(const [ox,oy,a] of [[0,0,.8],[2.2,1.8,1]]){const col=a<1?dk(L.col,.8):L.col;c.strokeStyle=col;c.lineWidth=1.7;c.beginPath();c.moveTo(-5+ox,b.u*.75+oy);c.lineTo(-14+ox,b.u*.95+oy);c.stroke();
      c.save();c.translate(-14+ox,b.u*.95+oy);c.rotate(.1);const g=c.createLinearGradient(0,-3,0,4);g.addColorStop(0,mixRGB(col,'#ffffff',.35));g.addColorStop(1,dk(col,.75));c.fillStyle=g;
      c.beginPath();c.moveTo(0,-.8);c.lineTo(-9,-3.6);c.quadraticCurveTo(-10.4,0,-9,3.8);c.lineTo(0,1);c.closePath();c.fill();
      c.strokeStyle=dk(col,.6);c.lineWidth=.45;c.beginPath();c.moveTo(0,0);c.lineTo(-9.2,-3.2);c.moveTo(0,0);c.lineTo(-10,0);c.moveTo(0,0);c.lineTo(-9.2,3.4);c.stroke();c.restore();}}
  else if(L.t==='dangle'){const n=L.len;
    for(const [ox,a] of [[-2.5,.8],[1,1]]){c.strokeStyle=a<1?dk(L.col,.8):L.col;c.lineWidth=1.6;c.beginPath();c.moveTo(ox,b.u*.85);c.lineTo(ox-3,b.u+n*.35);c.lineTo(ox-1,b.u+n);c.stroke();
      c.lineWidth=.9;c.beginPath();c.moveTo(ox-1,b.u+n);c.lineTo(ox+3,b.u+n+.8);c.moveTo(ox-1,b.u+n);c.lineTo(ox-3.5,b.u+n+1);c.stroke();}}
  else if(L.t==='talon'){c.fillStyle=L.fur;c.beginPath();c.ellipse(1,b.u*.85,6.5,4.2,-.25,0,TAU);c.fill();
    c.strokeStyle=L.col;c.lineWidth=2;c.beginPath();c.moveTo(-1,b.u+2.5);c.lineTo(-4,b.u+4.5);c.moveTo(2.5,b.u+3);c.lineTo(1,b.u+5.2);c.stroke();
    c.strokeStyle='#141414';c.lineWidth=.9;c.beginPath();c.moveTo(-4,b.u+4.5);c.quadraticCurveTo(-6,b.u+5,-5.6,b.u+6.4);c.moveTo(1,b.u+5.2);c.quadraticCurveTo(-.5,b.u+6.4,.4,b.u+7.4);c.stroke();}
}
function drawCrestSp(c,sp){const h=sp.head,cr=sp.crest;
  c.beginPath();c.moveTo(h.x+h.r*.45,h.y-h.r*.8);c.quadraticCurveTo(h.x-h.r*.2,h.y-h.r*1.9,h.x-h.r*1.3-cr.len*.12,h.y-h.r*1.85-cr.len*.12);
  c.quadraticCurveTo(h.x-h.r*.65,h.y-h.r*1.25,h.x-h.r*.95,h.y-h.r*.1);c.closePath();
  const g=c.createLinearGradient(0,h.y-h.r*2.2,0,h.y);g.addColorStop(0,mixRGB(cr.c,'#ffffff',.2));g.addColorStop(1,dk(cr.c,.75));c.fillStyle=g;c.fill();
  c.strokeStyle='rgba(10,20,50,.35)';c.lineWidth=.45;for(let i=0;i<3;i++){c.beginPath();c.moveTo(h.x-h.r*(.1+i*.25),h.y-h.r*.7);c.quadraticCurveTo(h.x-h.r*(.4+i*.3),h.y-h.r*(1.4+i*.05),h.x-h.r*(1.1+i*.1),h.y-h.r*(1.7-i*.12));c.stroke();}
}
function drawSpeciesBody(c,sp,dead){
  if(sp.custom){drawBodyParts(c,dead);return;}
  const b=sp.body,h=sp.head,C=sp.col;
  if(sp.legs&&sp.legs.behind)drawLegsSp(c,sp);
  drawTailSp(c,sp);
  if(sp.crest)drawCrestSp(c,sp);
  const top=Math.min(-b.t,h.y-h.r*(h.ry||1)),bot=b.u,x0=-b.r-2,x1=h.x+h.r+2;
  c.beginPath();silhouette(c,sp);c.lineJoin='round';
  c.strokeStyle='rgba(20,12,6,.55)';c.lineWidth=1.3;c.stroke();
  let g=c.createLinearGradient(0,top-1,0,top+b.t*1.1);g.addColorStop(0,sp.sheen?rgba(sp.sheen,.95):'rgba(255,238,205,.95)');g.addColorStop(1,'rgba(255,238,205,0)');c.strokeStyle=g;c.lineWidth=1.5;c.stroke();
  g=c.createLinearGradient(0,top,0,bot);g.addColorStop(0,C.back);g.addColorStop(.55,C.mid||mixRGB(C.back,C.belly,.5));g.addColorStop(1,C.belly);c.fillStyle=g;c.fill();
  c.save();c.beginPath();silhouette(c,sp);c.clip();
  for(const p of sp.patches||[])paintPatch(c,p);
  c.strokeStyle=sp.tex||'rgba(35,22,10,.2)';c.lineWidth=.55;
  for(let r=0;r<3;r++)for(let j=0;j<8;j++){const x=b.f*.35-j*(b.r*1.15/7)-r*1.7,y=-b.t*.82+r*3.1+j*.45;c.beginPath();c.arc(x,y,2,.3,Math.PI-.3);c.stroke();}
  g=c.createRadialGradient(b.f*.5,-b.t*1.1,0,b.f*.5,-b.t*1.1,(b.r+b.f)*.95);g.addColorStop(0,'rgba(255,244,220,.42)');g.addColorStop(1,'rgba(255,244,220,0)');c.fillStyle=g;c.fillRect(x0,top-2,x1-x0,bot-top+4);
  g=c.createRadialGradient(h.x+h.r*.2,h.y-h.r*.75,0,h.x+h.r*.2,h.y-h.r*.75,h.r*1.5);g.addColorStop(0,'rgba(255,248,230,.35)');g.addColorStop(1,'rgba(255,248,230,0)');c.fillStyle=g;c.fillRect(h.x-h.r*2,h.y-h.r*2.2,h.r*4,h.r*4);
  g=c.createLinearGradient(0,-b.t*.1,0,b.u+2);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(15,8,0,.42)');c.fillStyle=g;c.fillRect(x0,-b.t*.1,x1-x0,b.u+4);
  c.restore();
  if(sp.pouch){const p=sp.pouch;g=c.createRadialGradient(p.x+p.rx*.35,p.y-p.ry*.35,.5,p.x,p.y,p.rx*1.1);g.addColorStop(0,mixRGB(p.c,'#ffffff',.45));g.addColorStop(.35,p.c);g.addColorStop(1,dk(p.c,.55));
    c.fillStyle=g;c.beginPath();c.ellipse(p.x,p.y,p.rx,p.ry,-.15,0,TAU);c.fill();c.strokeStyle='rgba(90,0,0,.35)';c.lineWidth=.4;for(let i=0;i<3;i++){c.beginPath();c.arc(p.x-1,p.y+1,p.rx*(.45+i*.18),.6,1.9);c.stroke();}}
  drawBeakSp(c,sp);
  drawEyeSp(c,sp,dead);
  if(sp.legs&&!sp.legs.behind)drawLegsSp(c,sp);
}
function drawWingSp(c,sp,flap,far,dead){
  if(sp.custom){drawWing(c,flap,far,dead);return;}
  const w=sp.wing,C=w.col,k=far?.52:1,D=h=>dk(h,k);
  const ang=dead?-.25:(w.base==null?.18:w.base)+flap*(w.amp||1.1);
  c.save();c.rotate(ang);c.scale(1,.78+.32*Math.abs(flap));
  const spread=dead?0:Math.max(0,-flap),H=-w.arm,cwd=w.cw||1;
  for(let j=w.ns-1;j>=0;j--){const t=j/((w.ns-1)||1);c.save();c.translate(-1-t*(w.arm-3),1.2*cwd);c.rotate(-1.2-t*.28+spread*.12);
    const L=w.sl*(.82+.18*(1-t)),g=c.createLinearGradient(0,0,-L,0);g.addColorStop(0,D(C.sec));g.addColorStop(1,D(C.trail||dk(C.sec,.72)));
    featherPath(c,L,3.5);c.fillStyle=g;c.fill();
    if(w.bars){c.save();featherPath(c,L,3.5);c.clip();c.strokeStyle=rgba(w.bars,.8*k);c.lineWidth=.5;c.beginPath();for(let x=-3;x>-L;x-=2.6){c.moveTo(x,-4);c.lineTo(x,4);}c.stroke();c.restore();}
    if(w.tipsWhite){c.fillStyle=rgba('#f4f6f8',k);c.beginPath();c.ellipse(-L*.9,0,1.4,1.4,0,0,TAU);c.fill();}
    c.strokeStyle=`rgba(255,255,255,${.16*k})`;c.lineWidth=.45;featherPath(c,L,3.5);c.stroke();c.restore();}
  c.save();if(w.bend){c.translate(H,0);c.rotate(w.bend*(1-.35*Math.max(0,flap)));c.translate(-H,0);}
  for(let i=w.np-1;i>=0;i--){c.save();c.translate(H+2+i*1.5,.6+i*.45);c.rotate(-(-.12+i*w.fan)*(1+spread*.5));
    const L=w.pl*(1-i*(w.fingers?.03:.055)),fw=w.fingers&&i<5?w.pw*.8:w.pw,g=c.createLinearGradient(0,0,-L,0);
    if(w.tips){g.addColorStop(0,D(C.pri));g.addColorStop(.5,D(C.pri));g.addColorStop(.66,D(C.tip));g.addColorStop(1,D(C.tip));}
    else{g.addColorStop(0,D(C.pri));g.addColorStop(.7,D(dk(C.pri,.78)));g.addColorStop(1,D(dk(C.pri,.55)));}
    featherPath(c,L,fw);c.fillStyle=g;c.fill();
    if(w.bars){c.save();featherPath(c,L,fw);c.clip();c.strokeStyle=rgba(w.bars,.85*k);c.lineWidth=.55;c.beginPath();for(let x=-5;x>-L*.9;x-=2.8){c.moveTo(x,-fw);c.lineTo(x,fw);}c.stroke();c.restore();}
    if(w.mirror&&i<2){c.fillStyle=rgba(w.mirror,k);c.beginPath();c.ellipse(-L*.87,-.4,1.7,1.05,0,0,TAU);c.fill();}
    if(w.tipsWhite){c.fillStyle=rgba('#f4f6f8',k);c.beginPath();c.ellipse(-L*.92,-.3,1.7,1.2,0,0,TAU);c.fill();}
    if(C.patch&&i>=1&&i<=4){c.fillStyle=rgba(C.patch,k);c.beginPath();c.ellipse(-L*.32,-.2,2.6,1.6,0,0,TAU);c.fill();}
    c.strokeStyle=w.shaft?rgba(w.shaft,.55*k):`rgba(0,0,0,${.4*k})`;c.lineWidth=.45;c.beginPath();c.moveTo(-1,0);c.lineTo(-L*.88,-.4);c.stroke();
    c.strokeStyle=rgba(C.edge||'#e4c696',.38*k);c.lineWidth=.55;featherPath(c,L,fw);c.stroke();c.restore();}
  c.restore();
  const cov=new Path2D();cov.moveTo(3.5,-3);cov.bezierCurveTo(H*.25,-7.5*cwd,H*.75,-6*cwd,H-4,-.5);cov.bezierCurveTo(H*.7,5.5*cwd,H*.2,6.5*cwd,3.5,3);cov.closePath();
  let g=c.createLinearGradient(0,-7*cwd,0,7*cwd);g.addColorStop(0,D(mixRGB(C.cov2||C.cov,'#ffffff',.12)));g.addColorStop(1,D(dk(C.cov,.72)));c.fillStyle=g;c.fill(cov);
  c.save();c.clip(cov);
  if(C.mid){c.fillStyle=D(C.mid);c.beginPath();c.ellipse(H*.45,4.6*cwd,-H*.62,3.4*cwd,0,0,TAU);c.fill();}
  if(C.mid2){c.fillStyle=D(C.mid2);c.beginPath();c.ellipse(H*.45,6.6*cwd,-H*.6,2.6*cwd,0,0,TAU);c.fill();}
  if(C.cov2&&!C.mid){c.fillStyle=D(C.cov2);c.beginPath();c.ellipse(H*.3,-4.5*cwd,-H*.55,2.4*cwd,0,0,TAU);c.fill();}
  if(w.bars){c.strokeStyle=rgba(w.bars,.7*k);c.lineWidth=.5;c.beginPath();for(let x=-2;x>H;x-=3){c.moveTo(x,1.5*cwd);c.lineTo(x-1,6*cwd);}c.stroke();}
  if(w.spots){c.fillStyle=rgba(w.spots,.85*k);for(let i=0;i<9;i++){c.beginPath();c.arc(-2-i*(-H/9),-2.5+(i%3)*1.8,.55,0,TAU);c.fill();}}
  c.strokeStyle=`rgba(30,18,8,${.42*k})`;c.lineWidth=.55;const ncol=Math.max(4,Math.round(-H/3.6));
  for(let r=0;r<2;r++)for(let j=0;j<ncol;j++){c.beginPath();c.arc(-2-j*(-H/ncol)-r*1.8,-1.6*cwd+r*3*cwd,2.2,.3,Math.PI-.3);c.stroke();}
  c.restore();
  if(C.bar){c.strokeStyle=rgba(C.bar,.7*k);c.lineWidth=.9;c.beginPath();c.moveTo(-3,3.4*cwd);c.quadraticCurveTo(H*.5,5.4*cwd,H+1,1.4);c.stroke();}
  if(w.bars2){c.strokeStyle=rgba(w.bars2,.85*k);c.lineWidth=1.3;for(const o of [0,2.6]){c.beginPath();c.moveTo(-4,2+o*cwd);c.quadraticCurveTo(H*.5,3.8*cwd+o*cwd,H+3,.8+o*.6);c.stroke();}}
  if(!far){const hl=c.createLinearGradient(0,-7*cwd,0,0);hl.addColorStop(0,'rgba(255,238,205,.55)');hl.addColorStop(1,'rgba(255,238,205,0)');
    c.beginPath();c.moveTo(3.5,-3);c.bezierCurveTo(H*.25,-7.5*cwd,H*.75,-6*cwd,H-4,-.5);c.strokeStyle=hl;c.lineWidth=1.4;c.stroke();}
  c.restore();
}
function drawSpeciesFull(c,sp,flap,dead){
  const w=sp.wing;c.save();c.translate(w.fsh[0],w.fsh[1]);drawWingSp(c,sp,flap,true,dead);c.restore();
  drawSpeciesBody(c,sp,dead);
  c.save();c.translate(w.sh[0],w.sh[1]);drawWingSp(c,sp,flap,false,dead);c.restore();
}
function measureDraw(fn,X0,Y0,Wd,Ht){const R=2,m=document.createElement('canvas');m.width=Wd*R;m.height=Ht*R;const g=m.getContext('2d');g.scale(R,R);g.translate(-X0,-Y0);fn(g);
  const d=g.getImageData(0,0,m.width,m.height).data;let x0=1e9,y0=1e9,x1=-1,y1=-1;
  for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(d[(y*m.width+x)*4+3]>3){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
  if(x1<0)return {x:-10,y:-10,w:20,h:20};return {x:X0+x0/R-2,y:Y0+y0/R-2,w:(x1-x0)/R+4,h:(y1-y0)/R+4};}
function spBoxes(sp){
  if(!sp.bb){sp.bb=measureDraw(g=>{drawSpeciesBody(g,sp,false);drawSpeciesBody(g,sp,true);},-140,-80,240,160);
    sp.wb=measureDraw(g=>{for(const f of [-1,-.6,-.2,.2,.6,1])drawWingSp(g,sp,f,false,false);drawWingSp(g,sp,0,false,true);},-110,-110,220,220);}
  return sp;
}
