export const COMPOSITOR_WGSL = /* wgsl */ `
struct Uniforms {
  linear: vec4f,
  translate: vec4f,
  size: vec4f,
  fx: vec4f,
  tint: vec4f,
  misc: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(1) @binding(0) var source: texture_2d<f32>;
@group(1) @binding(1) var linearSampler: sampler;
@group(1) @binding(2) var backdrop: texture_2d<f32>;
struct VOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f };
@vertex fn vertexMain(@builtin(vertex_index) i:u32) -> VOut {
  let corners=array<vec2f,6>(vec2f(0,0),vec2f(1,0),vec2f(0,1),vec2f(0,1),vec2f(1,0),vec2f(1,1));
  let uv=corners[i];
  let p=uv*(u.size.xy+u.size.z*2)-vec2f(u.size.z);
  let world=vec2f(u.linear.x*p.x+u.linear.z*p.y,u.linear.y*p.x+u.linear.w*p.y)+u.translate.xy;
  var o:VOut;o.pos=vec4f(world.x/u.translate.z*2-1,1-world.y/u.translate.w*2,0,1);o.uv=uv;return o;
}
fn tap(uv:vec2f)->vec4f {
  if(any(uv<vec2f(0))||any(uv>vec2f(1))){return vec4f(0);}
  return textureSampleLevel(source,linearSampler,uv,0);
}
fn effect(uv:vec2f)->vec4f {
  let dimensions=vec2f(textureDimensions(source));
  let resolutionScale=dimensions.x/(u.size.x+u.size.z*2);
  var c=tap(uv);
  let directions=array<vec2f,12>(vec2f(1,0),vec2f(.866,.5),vec2f(.5,.866),vec2f(0,1),vec2f(-.5,.866),vec2f(-.866,.5),vec2f(-1,0),vec2f(-.866,-.5),vec2f(-.5,-.866),vec2f(0,-1),vec2f(.5,-.866),vec2f(.866,-.5));
  if(u.fx.x>.01){
    var sum=c*4;var total=4.0;
    for(var i=0;i<12;i++){
      sum+=tap(uv+directions[i]*u.fx.x*resolutionScale/dimensions)*2;
      sum+=tap(uv+directions[i]*u.fx.x*.45*resolutionScale/dimensions)*3;total+=5;
    }
    c=sum/total;
  }
  if(u.fx.y>.01){
    var alpha=0.0;
    for(var i=0;i<12;i++){alpha+=tap(uv+directions[i]*u.fx.y*.6*resolutionScale/dimensions).a;alpha+=tap(uv+directions[i]*u.fx.y*.28*resolutionScale/dimensions).a;}
    let a=clamp(alpha/24*.8,0,1)*(1-c.a);
    c=vec4f(c.rgb+u.tint.rgb*a,c.a+a);
  }
  if(c.a<.00001){return vec4f(0);}
  var straight=c.rgb/c.a;
  straight*=exp2(u.fx.z);
  let lum=dot(straight,vec3f(.2126,.7152,.0722));straight=mix(vec3f(lum),straight,u.fx.w/100);
  let h=u.tint.w;let cs=cos(h);let sn=sin(h);
  let axis=normalize(vec3f(1));straight=straight*cs+cross(axis,straight)*sn+axis*dot(axis,straight)*(1-cs);
  return vec4f(clamp(straight,vec3f(0),vec3f(1))*c.a,c.a)*u.size.w;
}
@fragment fn normalMain(i:VOut)->@location(0) vec4f {return effect(i.uv);}
@fragment fn blendMain(i:VOut)->@location(0) vec4f {
  let s=effect(i.uv);let b=textureSampleLevel(backdrop,linearSampler,i.pos.xy/vec2f(textureDimensions(backdrop)),0);
  let cs=s.rgb/max(s.a,.00001);let cb=b.rgb/max(b.a,.00001);var blend=cs;
  let mode=u32(u.misc.x);
  switch(mode){
    case 1u:{blend=cs*cb;}
    case 2u:{blend=1-(1-cs)*(1-cb);}
    case 3u:{blend=min(cs+cb,vec3f(1));}
    case 4u:{blend=select(2*cb*cs,1-2*(1-cb)*(1-cs),cb>vec3f(.5));}
    case 5u:{blend=abs(cb-cs);}
    default:{}
  }
  return vec4f((1-s.a)*b.rgb+(1-b.a)*s.rgb+s.a*b.a*blend,s.a+b.a*(1-s.a));
}
`;
export const PRESENT_WGSL = /* wgsl */ `
@group(0) @binding(0) var image:texture_2d<f32>;
@group(0) @binding(1) var smp:sampler;
struct Out{@builtin(position) pos:vec4f,@location(0) uv:vec2f};
@vertex fn vs(@builtin(vertex_index) i:u32)->Out{
  let p=array<vec2f,3>(vec2f(-1,-1),vec2f(3,-1),vec2f(-1,3));var o:Out;o.pos=vec4f(p[i],0,1);o.uv=vec2f((p[i].x+1)*.5,(1-p[i].y)*.5);return o;
}
@fragment fn fs(i:Out)->@location(0) vec4f{return textureSampleLevel(image,smp,i.uv,0);}
`;
